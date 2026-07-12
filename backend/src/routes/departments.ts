import { Router } from 'express';
import { PrismaClient, Role, ActiveStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();
const prisma = new PrismaClient();

const departmentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  parentDepartmentId: z.number().nullable().optional(),
  departmentHeadId: z.number().nullable().optional(),
  status: z.nativeEnum(ActiveStatus).optional(),
});

// GET /api/departments (authenticated read)
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        departmentHead: {
          select: { id: true, name: true, email: true }
        },
        parentDepartment: {
          select: { id: true, name: true }
        },
        childDepartments: {
          select: { id: true, name: true, status: true }
        }
      }
    });
    res.json(departments);
  } catch (error) {
    console.error('Fetch departments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/departments (Admin write only)
router.post('/', authenticateJWT, requireRole([Role.ADMIN]), async (req, res) => {
  try {
    const body = departmentSchema.parse(req.body);
    const actor = (req as any).user;

    const newDept = await prisma.department.create({
      data: {
        name: body.name,
        parentDepartmentId: body.parentDepartmentId || null,
        departmentHeadId: body.departmentHeadId || null,
        status: ActiveStatus.ACTIVE,
      },
      include: {
        departmentHead: { select: { id: true, name: true } },
        parentDepartment: { select: { id: true, name: true } }
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'DEPARTMENT_CREATE',
        entityType: 'Department',
        entityId: newDept.id,
        metadata: { name: newDept.name }
      }
    });

    res.status(201).json(newDept);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create department error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/departments/:id (Admin write only)
router.patch('/:id', authenticateJWT, requireRole([Role.ADMIN]), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = departmentSchema.parse(req.body);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid department ID' });
    }

    // Check circular reference if parent department is set
    if (body.parentDepartmentId && body.parentDepartmentId === id) {
      return res.status(400).json({ error: 'A department cannot be its own parent.' });
    }

    const updatedDept = await prisma.department.update({
      where: { id },
      data: {
        name: body.name,
        parentDepartmentId: body.parentDepartmentId !== undefined ? body.parentDepartmentId : undefined,
        departmentHeadId: body.departmentHeadId !== undefined ? body.departmentHeadId : undefined,
        status: body.status,
      },
      include: {
        departmentHead: { select: { id: true, name: true } },
        parentDepartment: { select: { id: true, name: true } }
      }
    });

    // Handle soft deactivation side effects: soft deactivate child departments?
    // The prompt says soft-deactivate via status = INACTIVE. Keep history intact.
    
    // Create activity log
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'DEPARTMENT_UPDATE',
        entityType: 'Department',
        entityId: updatedDept.id,
        metadata: { name: updatedDept.name, status: updatedDept.status }
      }
    });

    res.json(updatedDept);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update department error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
