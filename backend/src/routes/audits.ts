import { Router } from 'express';
import { PrismaClient, Role, AuditCycleStatus, AuditItemResult, AssetStatus, NotificationType } from '@prisma/client';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();
const prisma = new PrismaClient();

const createCycleSchema = z.object({
  name: z.string().min(3, 'Audit name must be at least 3 characters'),
  scopeDepartmentId: z.coerce.number().nullable().optional(),
  scopeLocationId: z.coerce.number().nullable().optional(),
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
  auditorIds: z.array(z.coerce.number()).min(1, 'At least one auditor must be assigned'),
});

const auditItemSchema = z.object({
  result: z.nativeEnum(AuditItemResult),
  notes: z.string().optional().nullable(),
});

// GET /api/audit-cycles (authenticated read list)
router.get('/audit-cycles', authenticateJWT, async (req, res) => {
  try {
    const cycles = await prisma.auditCycle.findMany({
      include: {
        scopeDepartment: { select: { id: true, name: true } },
        scopeLocation: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        auditors: {
          include: {
            employee: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(cycles);
  } catch (error) {
    console.error('Fetch audit cycles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit-cycles/:id (authenticated read detail)
router.get('/audit-cycles/:id', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid cycle ID' });
    }

    const cycle = await prisma.auditCycle.findUnique({
      where: { id },
      include: {
        scopeDepartment: { select: { id: true, name: true } },
        scopeLocation: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        auditors: {
          include: {
            employee: { select: { id: true, name: true, email: true } }
          }
        },
        items: {
          include: {
            asset: {
              include: {
                category: { select: { name: true } },
                location: { select: { name: true } }
              }
            },
            checkedBy: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found' });
    }

    // Compute discrepancy count summary dynamically
    const summary = {
      pending: cycle.items.filter(i => i.result === AuditItemResult.PENDING).length,
      verified: cycle.items.filter(i => i.result === AuditItemResult.VERIFIED).length,
      missing: cycle.items.filter(i => i.result === AuditItemResult.MISSING).length,
      damaged: cycle.items.filter(i => i.result === AuditItemResult.DAMAGED).length,
    };

    res.json({ ...cycle, summary });
  } catch (error) {
    console.error('Get audit cycle detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/audit-cycles (Admin only - create cycle)
router.post('/audit-cycles', authenticateJWT, requireRole([Role.ADMIN]), async (req, res) => {
  try {
    const body = createCycleSchema.parse(req.body);
    const actor = (req as any).user;

    if (!body.scopeDepartmentId && !body.scopeLocationId) {
      return res.status(400).json({ error: 'Scope must include at least one Department and/or Location' });
    }

    const newCycle = await prisma.$transaction(async (tx) => {
      // 1. Create the Audit Cycle record
      const cycle = await tx.auditCycle.create({
        data: {
          name: body.name,
          scopeDepartmentId: body.scopeDepartmentId || null,
          scopeLocationId: body.scopeLocationId || null,
          startDate: body.startDate,
          endDate: body.endDate,
          status: AuditCycleStatus.PLANNED,
          createdById: actor.id
        }
      });

      // 2. Assign auditors
      for (const audId of body.auditorIds) {
        await tx.auditCycleAuditor.create({
          data: {
            auditCycleId: cycle.id,
            employeeId: audId
          }
        });
        
        // Notify assigned auditor
        await tx.notification.create({
          data: {
            employeeId: audId,
            type: NotificationType.AUDIT_ASSIGNED,
            message: `You have been assigned as an auditor for cycle: ${body.name}.`,
            relatedEntityType: 'AuditCycle',
            relatedEntityId: cycle.id
          }
        });
      }

      // 3. Query all active assets matching the scope to populate the AuditItems checklist
      // Logic: Matches locationId if specified. Matches departmentId if the asset's active allocation matches.
      const queryConditions: any[] = [
        { status: { notIn: [AssetStatus.RETIRED, AssetStatus.DISPOSED] } }
      ];

      if (body.scopeLocationId) {
        queryConditions.push({ locationId: body.scopeLocationId });
      }

      if (body.scopeDepartmentId) {
        queryConditions.push({
          allocations: {
            some: {
              status: 'ACTIVE',
              OR: [
                { departmentId: body.scopeDepartmentId },
                { employee: { departmentId: body.scopeDepartmentId } }
              ]
            }
          }
        });
      }

      const scopedAssets = await tx.asset.findMany({
        where: { AND: queryConditions }
      });

      // 4. Create AuditItem checklist rows
      for (const asset of scopedAssets) {
        await tx.auditItem.create({
          data: {
            auditCycleId: cycle.id,
            assetId: asset.id,
            result: AuditItemResult.PENDING
          }
        });
      }

      // Set status to IN_PROGRESS on save
      const updatedCycle = await tx.auditCycle.update({
        where: { id: cycle.id },
        data: { status: AuditCycleStatus.IN_PROGRESS }
      });

      return updatedCycle;
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'AUDIT_CYCLE_CREATE',
        entityType: 'AuditCycle',
        entityId: newCycle.id,
        metadata: { name: newCycle.name }
      }
    });

    res.status(201).json(newCycle);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create audit cycle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/audit-items/:id (Authorized Auditors only - verify item)
router.patch('/audit-items/:id', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = auditItemSchema.parse(req.body);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid audit item ID' });
    }

    const auditItem = await prisma.auditItem.findUnique({
      where: { id },
      include: {
        auditCycle: {
          include: {
            auditors: true
          }
        },
        asset: true
      }
    });

    if (!auditItem) {
      return res.status(404).json({ error: 'Audit item not found' });
    }

    if (auditItem.auditCycle.status === AuditCycleStatus.CLOSED) {
      return res.status(400).json({ error: 'Audit cycle is closed. No modifications allowed.' });
    }

    // Security Gate: Check if current employee is assigned as an auditor for this cycle
    const isAssignedAuditor = auditItem.auditCycle.auditors.some(a => a.employeeId === actor.id);
    if (!isAssignedAuditor) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned as an auditor for this cycle.' });
    }

    const updatedItem = await prisma.auditItem.update({
      where: { id },
      data: {
        result: body.result,
        notes: body.notes,
        checkedById: actor.id,
        checkedAt: new Date()
      }
    });

    // Immediate Alert: If marked Missing or Damaged, fire notification
    if (body.result === AuditItemResult.MISSING || body.result === AuditItemResult.DAMAGED) {
      // Notify Asset Managers
      const managers = await prisma.employee.findMany({
        where: { role: Role.ASSET_MANAGER }
      });
      for (const m of managers) {
        await prisma.notification.create({
          data: {
            employeeId: m.id,
            type: NotificationType.AUDIT_DISCREPANCY_FLAGGED,
            message: `Discrepancy: Asset ${auditItem.asset.name} (${auditItem.asset.assetTag}) marked as ${body.result} in audit cycle: ${auditItem.auditCycle.name}.`,
            relatedEntityType: 'AuditItem',
            relatedEntityId: id
          }
        });
      }
    }

    res.json(updatedItem);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Verify audit item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/audit-cycles/:id/close (Admin only - close/lock cycle)
router.patch('/audit-cycles/:id/close', authenticateJWT, requireRole([Role.ADMIN]), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid cycle ID' });
    }

    const cycle = await prisma.auditCycle.findUnique({
      where: { id },
      include: { items: { include: { asset: true } } }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Audit cycle not found' });
    }

    if (cycle.status === AuditCycleStatus.CLOSED) {
      return res.status(400).json({ error: 'Audit cycle is already closed.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark cycle as CLOSED
      const closedCycle = await tx.auditCycle.update({
        where: { id },
        data: {
          status: AuditCycleStatus.CLOSED,
          closedAt: new Date()
        }
      });

      // 2. Identify missing items
      const missingItems = cycle.items.filter(i => i.result === AuditItemResult.MISSING);

      // 3. Mark all missing assets as LOST
      for (const item of missingItems) {
        await tx.asset.update({
          where: { id: item.assetId },
          data: { status: AssetStatus.LOST }
        });
      }

      return closedCycle;
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'AUDIT_CYCLE_CLOSE',
        entityType: 'AuditCycle',
        entityId: id
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Close audit cycle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
