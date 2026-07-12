import { Router } from 'express';
import { PrismaClient, Role, AssetStatus, AllocationStatus, TransferStatus, NotificationType } from '@prisma/client';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { lockAssetForWorkflow } from '../services/assetWorkflow';

const router = Router();
const prisma = new PrismaClient();

const allocateSchema = z.object({
  assetId: z.coerce.number(),
  employeeId: z.coerce.number().nullable().optional(),
  departmentId: z.coerce.number().nullable().optional(),
  expectedReturnDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
  conditionAtAllocation: z.string().optional().nullable(),
});

const returnSchema = z.object({
  conditionAtReturn: z.string().optional().nullable(),
  returnNotes: z.string().optional().nullable(),
});

const transferSchema = z.object({
  assetId: z.coerce.number(),
  toEmployeeId: z.coerce.number().nullable().optional(),
  toDepartmentId: z.coerce.number().nullable().optional(),
});

// GET /api/allocations (authenticated read)
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { assetId, employeeId, departmentId, status } = req.query;

    const where: any = {};
    if (assetId) where.assetId = parseInt(assetId as string);
    if (employeeId) where.employeeId = parseInt(employeeId as string);
    if (departmentId) where.departmentId = parseInt(departmentId as string);
    if (status) where.status = status as AllocationStatus;

    const allocations = await prisma.assetAllocation.findMany({
      where,
      include: {
        asset: { select: { id: true, assetTag: true, name: true, status: true } },
        employee: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(allocations);
  } catch (error) {
    console.error('Fetch allocations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/allocations (Asset Manager only)
router.post('/', authenticateJWT, requireRole([Role.ASSET_MANAGER]), async (req, res) => {
  try {
    const body = allocateSchema.parse(req.body);
    const actor = (req as any).user;

    // Validate exactly one of employeeId or departmentId is provided
    const hasEmployee = !!body.employeeId;
    const hasDept = !!body.departmentId;
    if ((hasEmployee && hasDept) || (!hasEmployee && !hasDept)) {
      return res.status(400).json({ error: 'Must allocate to exactly one Employee OR one Department' });
    }

    // Lock the asset first so concurrent allocation attempts are serialized.
    const result = await prisma.$transaction(async (tx) => {
      if (!await lockAssetForWorkflow(tx, body.assetId)) {
        throw { status: 404, message: 'Asset not found' };
      }

      // 1. Fetch asset details
      const asset = await tx.asset.findUnique({
        where: { id: body.assetId }
      });

      if (!asset) {
        throw { status: 404, message: 'Asset not found' };
      }

      if (asset.status !== AssetStatus.AVAILABLE) {
        throw { status: 409, message: `Only available assets can be allocated. Current status is ${asset.status}` };
      }

      // 2. Check for active allocation conflicts
      const activeAllocation = await tx.assetAllocation.findFirst({
        where: {
          assetId: body.assetId,
          status: AllocationStatus.ACTIVE
        },
        include: {
          employee: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } }
        }
      });

      if (activeAllocation) {
        const holderName = activeAllocation.employee
          ? activeAllocation.employee.name
          : activeAllocation.department?.name || 'Department';

        const holderId = activeAllocation.employee
          ? activeAllocation.employee.id
          : activeAllocation.department?.id || 0;

        const holderType = activeAllocation.employee ? 'employee' : 'department';

        // Custom structure for Priya/Raj transfer request workflow (HTTP 409)
        throw {
          status: 409,
          customError: true,
          error: 'ASSET_ALREADY_ALLOCATED',
          currentHolder: {
            type: holderType,
            id: holderId,
            name: holderName
          },
          assetTag: asset.assetTag,
          activeAllocationId: activeAllocation.id
        };
      }

      // 3. Create the new allocation
      const allocation = await tx.assetAllocation.create({
        data: {
          assetId: body.assetId,
          employeeId: body.employeeId || null,
          departmentId: body.departmentId || null,
          expectedReturnDate: body.expectedReturnDate,
          conditionAtAllocation: body.conditionAtAllocation || asset.condition,
          status: AllocationStatus.ACTIVE
        }
      });

      // 4. Update asset status
      await tx.asset.update({
        where: { id: body.assetId },
        data: { status: AssetStatus.ALLOCATED }
      });

      // 5. Fire notification
      if (body.employeeId) {
        await tx.notification.create({
          data: {
            employeeId: body.employeeId,
            type: NotificationType.ASSET_ASSIGNED,
            message: `Asset ${asset.name} (${asset.assetTag}) has been allocated to you.`,
            relatedEntityType: 'Asset',
            relatedEntityId: asset.id
          }
        });
      }

      // Log action
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          action: 'ASSET_ALLOCATE',
          entityType: 'AssetAllocation',
          entityId: allocation.id,
          metadata: { assetId: asset.id, tag: asset.assetTag, allocatedTo: body.employeeId ? `Employee ${body.employeeId}` : `Dept ${body.departmentId}` }
        }
      });

      return { status: 201, data: allocation };
    });

    res.status(result.status).json(result.data);
  } catch (error: any) {
    if (error.customError) {
      return res.status(error.status).json(error);
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Allocate asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/allocations/:id/return (Asset Manager, or Employee returning own allocated asset)
router.post('/:id/return', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = returnSchema.parse(req.body);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid allocation ID' });
    }

    const allocation = await prisma.assetAllocation.findUnique({
      where: { id },
      include: { asset: true }
    });

    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    if (allocation.status !== AllocationStatus.ACTIVE) {
      return res.status(400).json({ error: 'Allocation is not active' });
    }

    // Role check: AM can return anything; Employee can only return their OWN allocated asset
    const isManager = actor.role === Role.ASSET_MANAGER || actor.role === Role.ADMIN;
    const isOwn = allocation.employeeId === actor.id;

    if (!isManager && !isOwn) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to return this asset allocation.' });
    }

    // Process return in a locked transaction.
    const returned = await prisma.$transaction(async (tx) => {
      if (!await lockAssetForWorkflow(tx, allocation.assetId)) {
        throw { status: 404, message: 'Asset not found' };
      }

      const currentAllocation = await tx.assetAllocation.findUnique({ where: { id } });
      if (!currentAllocation || currentAllocation.status !== AllocationStatus.ACTIVE) {
        throw { status: 409, message: 'Allocation was already returned or transferred' };
      }

      const currentAsset = await tx.asset.findUnique({ where: { id: allocation.assetId } });
      if (!currentAsset) {
        throw { status: 404, message: 'Asset not found' };
      }

      const updatedAllocation = await tx.assetAllocation.update({
        where: { id },
        data: {
          status: AllocationStatus.RETURNED,
          actualReturnDate: new Date(),
          conditionAtReturn: body.conditionAtReturn || allocation.asset.condition,
          returnNotes: body.returnNotes,
        }
      });

      // A return must not take an approved repair out of maintenance.
      await tx.asset.update({
        where: { id: allocation.assetId },
        data: {
          status: currentAsset.status === AssetStatus.UNDER_MAINTENANCE
            ? AssetStatus.UNDER_MAINTENANCE
            : AssetStatus.AVAILABLE,
          condition: body.conditionAtReturn || currentAsset.condition
        }
      });

      // Log action
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          action: 'ASSET_RETURN',
          entityType: 'AssetAllocation',
          entityId: updatedAllocation.id,
          metadata: { assetId: allocation.assetId, tag: allocation.asset.assetTag }
        }
      });

      return updatedAllocation;
    });

    res.json(returned);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Return asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/transfers (All authenticated users can request)
router.post('/transfers', authenticateJWT, async (req, res) => {
  try {
    const body = transferSchema.parse(req.body);
    const actor = (req as any).user;

    // Validate inputs
    const hasEmployee = !!body.toEmployeeId;
    const hasDept = !!body.toDepartmentId;
    if ((hasEmployee && hasDept) || (!hasEmployee && !hasDept)) {
      return res.status(400).json({ error: 'Must transfer to exactly one Employee OR one Department' });
    }

    // Find active allocation for this asset
    const activeAllocation = await prisma.assetAllocation.findFirst({
      where: {
        assetId: body.assetId,
        status: AllocationStatus.ACTIVE
      },
      include: { employee: { select: { departmentId: true } } }
    });

    if (!activeAllocation) {
      return res.status(400).json({ error: 'Cannot request transfer. The asset is not currently allocated.' });
    }

    const isManager = actor.role === Role.ADMIN || actor.role === Role.ASSET_MANAGER;
    const isCurrentHolder = activeAllocation.employeeId === actor.id;
    const isDepartmentHeadForHolder = actor.role === Role.DEPARTMENT_HEAD && actor.departmentId && (
      activeAllocation.departmentId === actor.departmentId
      || activeAllocation.employee?.departmentId === actor.departmentId
    );
    if (!isManager && !isCurrentHolder && !isDepartmentHeadForHolder) {
      return res.status(403).json({ error: 'You can only request a transfer for an asset held by you or your department.' });
    }

    // Cannot transfer to yourself if you already hold it
    if (body.toEmployeeId && activeAllocation.employeeId === body.toEmployeeId) {
      return res.status(400).json({ error: 'Recipient employee is already the current holder.' });
    }
    if (body.toDepartmentId && activeAllocation.departmentId === body.toDepartmentId) {
      return res.status(400).json({ error: 'Recipient department is already the current holder.' });
    }

    // Create the transfer request
    const transfer = await prisma.transferRequest.create({
      data: {
        assetId: body.assetId,
        fromAllocationId: activeAllocation.id,
        requestedById: actor.id,
        toEmployeeId: body.toEmployeeId || null,
        toDepartmentId: body.toDepartmentId || null,
        status: TransferStatus.REQUESTED
      },
      include: {
        asset: { select: { id: true, name: true, assetTag: true } }
      }
    });

    // Create alert/notification for Asset Managers
    const managers = await prisma.employee.findMany({
      where: { role: Role.ASSET_MANAGER }
    });
    for (const m of managers) {
      await prisma.notification.create({
        data: {
          employeeId: m.id,
          type: NotificationType.TRANSFER_REQUESTED,
          message: `Transfer requested for asset ${transfer.asset.name} (${transfer.asset.assetTag}) by ${actor.email}.`,
          relatedEntityType: 'TransferRequest',
          relatedEntityId: transfer.id
        }
      });
    }

    // Log action
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'TRANSFER_REQUEST',
        entityType: 'TransferRequest',
        entityId: transfer.id
      }
    });

    res.status(201).json(transfer);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Request transfer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/transfers (authenticated read)
router.get('/transfers', authenticateJWT, async (req, res) => {
  try {
    const actor = (req as any).user;
    
    // Scope filters by role: Employees see their requested transfers or incoming transfers.
    // Dept heads see transfers within their department.
    // Admin/Asset Manager see all.
    const where: any = {};
    if (actor.role === Role.EMPLOYEE) {
      where.OR = [
        { requestedById: actor.id },
        { toEmployeeId: actor.id }
      ];
    } else if (actor.role === Role.DEPARTMENT_HEAD) {
      where.OR = [
        { requestedById: actor.id },
        { toEmployeeId: actor.id },
        { toDepartmentId: actor.departmentId },
        { toEmployee: { departmentId: actor.departmentId } }
      ];
    }

    const transfers = await prisma.transferRequest.findMany({
      where,
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        toEmployee: { select: { id: true, name: true, departmentId: true } },
        toDepartment: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        fromAllocation: {
          include: {
            employee: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(transfers);
  } catch (error) {
    console.error('Fetch transfers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/transfers/:id/approve (Asset Manager, or destination Dept Head)
router.patch('/transfers/:id/approve', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid transfer ID' });
    }

    const transfer = await prisma.transferRequest.findUnique({
      where: { id },
      include: {
        asset: true,
        toEmployee: true,
        toDepartment: true
      }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    if (transfer.status !== TransferStatus.REQUESTED) {
      return res.status(400).json({ error: 'Transfer request is not active' });
    }

    // Role check:
    // - Asset Managers or Admins can approve any
    // - Department Head can only approve if transfer destination is inside their own department
    const isManager = actor.role === Role.ASSET_MANAGER || actor.role === Role.ADMIN;
    let isDestinationHead = false;

    if (actor.role === Role.DEPARTMENT_HEAD && actor.departmentId) {
      if (transfer.toDepartmentId === actor.departmentId) {
        isDestinationHead = true;
      } else if (transfer.toEmployee && transfer.toEmployee.departmentId === actor.departmentId) {
        isDestinationHead = true;
      }
    }

    if (!isManager && !isDestinationHead) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to approve this transfer.' });
    }

    // Lock the asset to prevent concurrent return, allocation, or approval changes.
    const result = await prisma.$transaction(async (tx) => {
      if (!await lockAssetForWorkflow(tx, transfer.assetId)) {
        throw { status: 404, message: 'Asset not found' };
      }

      const lockedTransfer = await tx.transferRequest.findUnique({ where: { id } });
      if (!lockedTransfer || lockedTransfer.status !== TransferStatus.REQUESTED) {
        throw { status: 409, message: 'Transfer request was already processed' };
      }

      const lockedAsset = await tx.asset.findUnique({ where: { id: transfer.assetId } });
      if (!lockedAsset || lockedAsset.status !== AssetStatus.ALLOCATED) {
        throw { status: 409, message: 'Only currently allocated assets can be transferred' };
      }

      // 1. Mark old allocation returned / transferred
      if (transfer.fromAllocationId) {
        await tx.assetAllocation.update({
          where: { id: transfer.fromAllocationId },
          data: {
            status: AllocationStatus.TRANSFERRED,
            actualReturnDate: new Date(),
            conditionAtReturn: transfer.asset.condition
          }
        });
      }

      // 2. Create new allocation
      const newAllocation = await tx.assetAllocation.create({
        data: {
          assetId: transfer.assetId,
          employeeId: transfer.toEmployeeId,
          departmentId: transfer.toDepartmentId,
          allocatedDate: new Date(),
          status: AllocationStatus.ACTIVE,
          conditionAtAllocation: transfer.asset.condition
        }
      });

      // 3. Keep Asset.status = ALLOCATED (ensure it remains Allocated)
      await tx.asset.update({
        where: { id: transfer.assetId },
        data: { status: AssetStatus.ALLOCATED }
      });

      // 4. Set transfer status to APPROVED
      const updatedTransfer = await tx.transferRequest.update({
        where: { id },
        data: {
          status: TransferStatus.APPROVED,
          approvedById: actor.id,
          approvedAt: new Date()
        }
      });

      // 5. Fire notifications
      // Recipient
      if (transfer.toEmployeeId) {
        await tx.notification.create({
          data: {
            employeeId: transfer.toEmployeeId,
            type: NotificationType.TRANSFER_APPROVED,
            message: `Transfer approved! Asset ${transfer.asset.name} has been assigned to you.`,
            relatedEntityType: 'Asset',
            relatedEntityId: transfer.assetId
          }
        });
      }

      // Requester
      await tx.notification.create({
        data: {
          employeeId: transfer.requestedById,
          type: NotificationType.TRANSFER_APPROVED,
          message: `Your transfer request for asset ${transfer.asset.name} has been approved.`,
          relatedEntityType: 'TransferRequest',
          relatedEntityId: transfer.id
        }
      });

      // Log action
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          action: 'TRANSFER_APPROVE',
          entityType: 'TransferRequest',
          entityId: transfer.id,
          metadata: { assetId: transfer.assetId, tag: transfer.asset.assetTag }
        }
      });

      return updatedTransfer;
    });

    res.json(result);
  } catch (error) {
    console.error('Approve transfer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/transfers/:id/reject (Asset Manager, or destination Dept Head)
router.patch('/transfers/:id/reject', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actor = (req as any).user;
    const { reason } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid transfer ID' });
    }

    const transfer = await prisma.transferRequest.findUnique({
      where: { id },
      include: {
        asset: true,
        toEmployee: true
      }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer request not found' });
    }

    if (transfer.status !== TransferStatus.REQUESTED) {
      return res.status(400).json({ error: 'Transfer request is not active' });
    }

    // Role check: Same as approve
    const isManager = actor.role === Role.ASSET_MANAGER || actor.role === Role.ADMIN;
    let isDestinationHead = false;

    if (actor.role === Role.DEPARTMENT_HEAD && actor.departmentId) {
      if (transfer.toDepartmentId === actor.departmentId) {
        isDestinationHead = true;
      } else if (transfer.toEmployee && transfer.toEmployee.departmentId === actor.departmentId) {
        isDestinationHead = true;
      }
    }

    if (!isManager && !isDestinationHead) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to reject this transfer.' });
    }

    const rejected = await prisma.transferRequest.update({
      where: { id },
      data: {
        status: TransferStatus.REJECTED,
        rejectionReason: reason || 'Rejected by administrator'
      }
    });

    // Notify requester
    await prisma.notification.create({
      data: {
        employeeId: transfer.requestedById,
        type: NotificationType.TRANSFER_REJECTED,
        message: `Your transfer request for asset ${transfer.asset.name} was rejected. Reason: ${reason || 'None provided'}`,
        relatedEntityType: 'TransferRequest',
        relatedEntityId: transfer.id
      }
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'TRANSFER_REJECT',
        entityType: 'TransferRequest',
        entityId: transfer.id,
        metadata: { assetId: transfer.assetId, reason }
      }
    });

    res.json(rejected);
  } catch (error) {
    console.error('Reject transfer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
