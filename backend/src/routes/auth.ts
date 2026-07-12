import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient, Role, ActiveStatus } from '@prisma/client';
import { authenticateJWT } from '../middleware/auth';

dotenv.config();

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting AssetFlow.');
}

// Zod schemas
const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Signup Route (Always registers as EMPLOYEE)
router.post('/signup', async (req, res) => {
  try {
    const body = signupSchema.parse(req.body);

    const existingUser = await prisma.employee.findUnique({
      where: { email: body.email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    // Hardcode safety parameters
    const newEmployee = await prisma.employee.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: Role.EMPLOYEE, // Enforce server-side
        departmentId: null, // Enforce server-side
        status: ActiveStatus.ACTIVE,
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        actorId: newEmployee.id,
        action: 'SIGNUP',
        entityType: 'Employee',
        entityId: newEmployee.id,
        metadata: { email: newEmployee.email }
      }
    });

    // Generate token
    const token = jwt.sign(
      {
        id: newEmployee.id,
        email: newEmployee.email,
        role: newEmployee.role,
        departmentId: newEmployee.departmentId
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      employee: {
        id: newEmployee.id,
        name: newEmployee.name,
        email: newEmployee.email,
        role: newEmployee.role,
        departmentId: newEmployee.departmentId
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({
      where: { email: body.email }
    });

    if (!employee) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (employee.status === ActiveStatus.INACTIVE) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const isPasswordValid = await bcrypt.compare(body.password, employee.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create activity log
    await prisma.activityLog.create({
      data: {
        actorId: employee.id,
        action: 'LOGIN',
        entityType: 'Employee',
        entityId: employee.id
      }
    });

    // Generate token
    const token = jwt.sign(
      {
        id: employee.id,
        email: employee.email,
        role: employee.role,
        departmentId: employee.departmentId
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        departmentId: employee.departmentId
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot Password Route
router.post('/forgot-password', async (req, res) => {
  try {
    const body = forgotPasswordSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({
      where: { email: body.email }
    });

    const message = 'If the email exists, a reset link has been sent.';
    if (!employee) {
      return res.json({ message });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM PasswordResetToken WHERE employeeId = ${employee.id}`;
      await tx.$executeRaw`INSERT INTO PasswordResetToken (tokenHash, employeeId, expiresAt) VALUES (${tokenHash}, ${employee.id}, ${expiresAt})`;
    });

    // Hand the raw token to the configured email provider here. It is never logged or returned by this API.
    res.json({ message });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset Password Route
router.post('/reset-password', async (req, res) => {
  try {
    const body = resetPasswordSchema.parse(req.body);

    const tokenHash = crypto.createHash('sha256').update(body.token).digest('hex');
    const tokens = await prisma.$queryRaw<Array<{ id: number; employeeId: number; expiresAt: Date }>>`SELECT id, employeeId, expiresAt FROM PasswordResetToken WHERE tokenHash = ${tokenHash} LIMIT 1`;
    const resetToken = tokens[0];

    if (!resetToken || resetToken.expiresAt <= new Date()) {
      if (resetToken) {
        await prisma.$executeRaw`DELETE FROM PasswordResetToken WHERE id = ${resetToken.id}`;
      }
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const newPasswordHash = await bcrypt.hash(body.password, 10);

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: resetToken.employeeId },
        data: { passwordHash: newPasswordHash }
      });
      await tx.$executeRaw`DELETE FROM PasswordResetToken WHERE employeeId = ${resetToken.employeeId}`;
      await tx.activityLog.create({
        data: {
          actorId: resetToken.employeeId,
          action: 'PASSWORD_RESET',
          entityType: 'Employee',
          entityId: resetToken.employeeId
        }
      });
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Me Route (Profile fetcher)
router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const user = (req as any).user;

    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        status: true,
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ employee });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
