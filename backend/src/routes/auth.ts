import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient, Role, ActiveStatus } from '@prisma/client';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'assetflow-super-secret-key-hackathon-2026-very-long';

// In-memory store for password reset tokens (temporary for hackathon)
const resetTokens = new Map<string, { email: string; expiresAt: number }>();

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

    if (!employee) {
      // Avoid revealing user exists/doesn't exist for security, but during demo we can log to console
      console.log(`Password reset requested for non-existent email: ${body.email}`);
      return res.json({ message: 'If the email exists, a reset link has been generated.' });
    }

    // Generate a simple token
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 3600000; // 1 hour expiry

    resetTokens.set(token, { email: body.email, expiresAt });

    // HACKATHON DEMO: Log token reset details to system console for verification
    console.log('\n--- PASSWORD RESET SIMULATION ---');
    console.log(`Employee: ${employee.name} (${employee.email})`);
    console.log(`Reset Token: ${token}`);
    console.log(`Reset link: http://localhost:5173/reset-password?token=${token}`);
    console.log('---------------------------------\n');

    res.json({
      message: 'If the email exists, a reset link has been generated.',
      // Return token in response purely for testing and demo speed, so the user/tests don't have to scan logs
      devToken: token
    });
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

    const tokenData = resetTokens.get(body.token);

    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    if (Date.now() > tokenData.expiresAt) {
      resetTokens.delete(body.token);
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const employee = await prisma.employee.findUnique({
      where: { email: tokenData.email }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const newPasswordHash = await bcrypt.hash(body.password, 10);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash: newPasswordHash }
    });

    resetTokens.delete(body.token);

    await prisma.activityLog.create({
      data: {
        actorId: employee.id,
        action: 'PASSWORD_RESET',
        entityType: 'Employee',
        entityId: employee.id
      }
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
