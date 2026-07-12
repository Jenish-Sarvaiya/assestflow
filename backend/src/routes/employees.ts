import { Router } from 'express';
import { PrismaClient, Role, ActiveStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();
const prisma = new PrismaClient();

const updateEmployeeSchema = z.object({
  departmentId: z.number().nullable().optional(),
  status: z.nativeEnum(ActiveStatus).optional(),
});

const promoteEmployeeSchema = z.object({
  role: z.nativeEnum(Role),
});

// GET /api/employees (all authenticated read directory)
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        departmentId: true,
        createdAt: true,
        department: {
          select: { id: true, name: true }
        }
      }
    });
    res.json(employees);
  } catch (error) {
    console.error('Fetch employees directory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/employees/:id (Admin only - edit department/status)
router.patch('/:id', authenticateJWT, requireRole([Role.ADMIN]), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = updateEmployeeSchema.parse(req.body);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    // Verify department exists if changing
    if (body.departmentId) {
      const deptExists = await prisma.department.findUnique({
        where: { id: body.departmentId }
      });
      if (!deptExists) {
        return res.status(404).json({ error: 'Department not found' });
      }
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        departmentId: body.departmentId !== undefined ? body.departmentId : undefined,
        status: body.status,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        departmentId: true,
        department: { select: { id: true, name: true } }
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'EMPLOYEE_UPDATE',
        entityType: 'Employee',
        entityId: updatedEmployee.id,
        metadata: { name: updatedEmployee.name, status: updatedEmployee.status, departmentId: updatedEmployee.departmentId }
      }
    });

    res.json(updatedEmployee);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/employees/:id/promote (Admin only - promote/demote role)
router.patch('/:id/promote', authenticateJWT, requireRole([Role.ADMIN]), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = promoteEmployeeSchema.parse(req.body);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    // Prevent promoting self or changing self-role to avoid accidental locking out
    if (actor.id === id) {
      return res.status(400).json({ error: 'Admins cannot change their own roles to prevent lockouts' });
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        role: body.role
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        departmentId: true,
        department: { select: { id: true, name: true } }
      }
    });

    // If promoted to DEPARTMENT_HEAD, verify department is set, otherwise warning but let it pass
    // Let's create an activity log
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'EMPLOYEE_PROMOTE',
        entityType: 'Employee',
        entityId: updatedEmployee.id,
        metadata: { name: updatedEmployee.name, newRole: updatedEmployee.role }
      }
    });

    res.json(updatedEmployee);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Promote employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
