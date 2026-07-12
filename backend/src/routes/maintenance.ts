import { Router } from 'express';
import { PrismaClient, Role, AssetStatus, MaintenanceStatus, MaintenancePriority, NotificationType } from '@prisma/client';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { upload } from '../middleware/upload';

const router = Router();
const prisma = new PrismaClient();

const raiseRequestSchema = z.object({
  assetId: z.coerce.number(),
  issueDescription: z.string().min(5, 'Description must be at least 5 characters'),
  priority: z.nativeEnum(MaintenancePriority).default(MaintenancePriority.MEDIUM),
});

const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

const assignSchema = z.object({
  technicianName: z.string().min(2, 'Technician name is required'),
});

const resolveSchema = z.object({
  resolutionNotes: z.string().min(5, 'Resolution notes are required'),
});

// GET /api/maintenance-requests (all authenticated read)
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const actor = (req as any).user;
    const { assetId, status } = req.query;

    const where: any = {};
    if (assetId) where.assetId = parseInt(assetId as string);
    if (status) where.status = status as MaintenanceStatus;

    // Employees can see requests they raised. Admin/Managers see all.
    if (actor.role === Role.EMPLOYEE) {
      where.raisedById = actor.id;
    }

    const requests = await prisma.maintenanceRequest.findMany({
      where,
      include: {
        asset: { select: { id: true, assetTag: true, name: true, status: true } },
        raisedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
        attachments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Fetch maintenance requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/maintenance-requests (Raise ticket - supports file upload)
router.post('/', authenticateJWT, upload.single('photo'), async (req, res) => {
  try {
    const actor = (req as any).user;
    const body = raiseRequestSchema.parse(req.body);

    const ticket = await prisma.$transaction(async (tx) => {
      // Create request
      const reqVal = await tx.maintenanceRequest.create({
        data: {
          assetId: body.assetId,
          raisedById: actor.id,
          issueDescription: body.issueDescription,
          priority: body.priority,
          status: MaintenanceStatus.PENDING
        }
      });

      // Handle upload if present
      if (req.file) {
        await tx.attachment.create({
          data: {
            maintenanceRequestId: reqVal.id,
            fileUrl: `/uploads/${req.file.filename}`,
            fileName: req.file.originalname,
            fileType: req.file.mimetype
          }
        });
      }

      // Notify Asset Managers
      const managers = await tx.employee.findMany({
        where: { role: Role.ASSET_MANAGER }
      });
      for (const m of managers) {
        await tx.notification.create({
          data: {
            employeeId: m.id,
            type: NotificationType.MAINTENANCE_REQUEST_RAISED,
            message: `New maintenance request raised for asset ${body.assetId} by ${actor.email}.`,
            relatedEntityType: 'MaintenanceRequest',
            relatedEntityId: reqVal.id
          }
        });
      }

      return reqVal;
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'MAINTENANCE_RAISE',
        entityType: 'MaintenanceRequest',
        entityId: ticket.id,
        metadata: { assetId: body.assetId, priority: body.priority }
      }
    });

    res.status(201).json(ticket);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Raise maintenance request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/maintenance-requests/:id/approve (Asset Manager only)
router.patch('/:id/approve', authenticateJWT, requireRole([Role.ASSET_MANAGER]), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const ticket = await prisma.maintenanceRequest.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Maintenance request not found' });
    }

    if (ticket.status !== MaintenanceStatus.PENDING) {
      return res.status(400).json({ error: 'Request is not in PENDING state' });
    }

    // Approve inside a transaction to flip Asset.status to UNDER_MAINTENANCE
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.APPROVED,
          approvedById: actor.id
        }
      });

      // Flip asset status to UNDER_MAINTENANCE
      await tx.asset.update({
        where: { id: ticket.assetId },
        data: { status: AssetStatus.UNDER_MAINTENANCE }
      });

      // Notify requester
      await tx.notification.create({
        data: {
          employeeId: ticket.raisedById,
          type: NotificationType.MAINTENANCE_APPROVED,
          message: `Your maintenance request for asset ${ticket.assetId} has been approved.`,
          relatedEntityType: 'MaintenanceRequest',
          relatedEntityId: ticket.id
        }
      });

      return updated;
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'MAINTENANCE_APPROVE',
        entityType: 'MaintenanceRequest',
        entityId: id
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/maintenance-requests/:id/reject (Asset Manager only)
router.patch('/:id/reject', authenticateJWT, requireRole([Role.ASSET_MANAGER]), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actor = (req as any).user;
    const { reason } = rejectSchema.parse(req.body);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const ticket = await prisma.maintenanceRequest.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Maintenance request not found' });
    }

    if (ticket.status !== MaintenanceStatus.PENDING) {
      return res.status(400).json({ error: 'Request is not in PENDING state' });
    }

    const rejected = await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceStatus.REJECTED,
        rejectionReason: reason
      }
    });

    // Notify requester
    await prisma.notification.create({
      data: {
        employeeId: ticket.raisedById,
        type: NotificationType.MAINTENANCE_REJECTED,
        message: `Your maintenance request was rejected. Reason: ${reason}`,
        relatedEntityType: 'MaintenanceRequest',
        relatedEntityId: ticket.id
      }
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'MAINTENANCE_REJECT',
        entityType: 'MaintenanceRequest',
        entityId: id,
        metadata: { reason }
      }
    });

    res.json(rejected);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Reject request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/maintenance-requests/:id/assign-technician (Asset Manager only)
router.patch('/:id/assign-technician', authenticateJWT, requireRole([Role.ASSET_MANAGER]), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actor = (req as any).user;
    const { technicianName } = assignSchema.parse(req.body);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const ticket = await prisma.maintenanceRequest.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Maintenance request not found' });
    }

    if (ticket.status !== MaintenanceStatus.APPROVED) {
      return res.status(400).json({ error: 'Technician can only be assigned to APPROVED requests' });
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceStatus.TECHNICIAN_ASSIGNED,
        assignedTechnicianName: technicianName
      }
    });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Assign technician error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/maintenance-requests/:id/start-progress (Asset Manager only)
router.patch('/:id/start-progress', authenticateJWT, requireRole([Role.ASSET_MANAGER]), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const ticket = await prisma.maintenanceRequest.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Maintenance request not found' });
    }

    if (ticket.status !== MaintenanceStatus.TECHNICIAN_ASSIGNED) {
      return res.status(400).json({ error: 'Request is not in TECHNICIAN_ASSIGNED state' });
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: { status: MaintenanceStatus.IN_PROGRESS }
    });

    res.json(updated);
  } catch (error) {
    console.error('Start progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/maintenance-requests/:id/resolve (Asset Manager only)
router.patch('/:id/resolve', authenticateJWT, requireRole([Role.ASSET_MANAGER]), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actor = (req as any).user;
    const { resolutionNotes } = resolveSchema.parse(req.body);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const ticket = await prisma.maintenanceRequest.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Maintenance request not found' });
    }

    if (ticket.status !== MaintenanceStatus.IN_PROGRESS) {
      return res.status(400).json({ error: 'Request is not currently IN_PROGRESS' });
    }

    // Resolve inside a transaction to restore appropriate Asset.status
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark request as RESOLVED
      const updated = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.RESOLVED,
          resolutionNotes,
          resolvedAt: new Date()
        }
      });

      // 2. Check for active allocation on this asset
      const activeAllocation = await tx.assetAllocation.findFirst({
        where: {
          assetId: ticket.assetId,
          status: 'ACTIVE'
        }
      });

      // 3. SMART SYNC: restore ALLOCATED status if active allocation exists, otherwise AVAILABLE
      const nextAssetStatus = activeAllocation ? AssetStatus.ALLOCATED : AssetStatus.AVAILABLE;

      await tx.asset.update({
        where: { id: ticket.assetId },
        data: { status: nextAssetStatus }
      });

      return updated;
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'MAINTENANCE_RESOLVE',
        entityType: 'MaintenanceRequest',
        entityId: id,
        metadata: { notes: resolutionNotes }
      }
    });

    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Resolve request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
