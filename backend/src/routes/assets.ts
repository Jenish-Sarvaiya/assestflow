import { Router } from 'express';
import { PrismaClient, Role, AssetStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { upload } from '../middleware/upload';

const router = Router();
const prisma = new PrismaClient();

const assetSchema = z.object({
  name: z.string().min(2, 'Asset name is required'),
  categoryId: z.coerce.number().min(1, 'Category is required'),
  serialNumber: z.string().optional().nullable(),
  acquisitionDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
  acquisitionCost: z.coerce.number().optional().nullable(),
  condition: z.string().default('Good'),
  locationId: z.coerce.number().optional().nullable(),
  isBookable: z.string().optional().transform(val => val === 'true').or(z.boolean()).default(false),
  customFieldValues: z.string().optional().transform(val => val ? JSON.parse(val) : {}).or(z.any()).nullable(),
  nextMaintenanceDueDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
});

// GET /api/assets (authenticated read)
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { tag, serial, qr, categoryId, status, departmentId, locationId, bookable } = req.query;

    const where: any = {};

    if (tag) {
      where.assetTag = { contains: tag as string };
    }
    if (serial) {
      where.serialNumber = { contains: serial as string };
    }
    if (qr) {
      where.qrCodeValue = qr as string;
    }
    if (categoryId) {
      where.categoryId = parseInt(categoryId as string);
    }
    if (status) {
      where.status = status as AssetStatus;
    }
    if (locationId) {
      where.locationId = parseInt(locationId as string);
    }
    if (bookable !== undefined) {
      where.isBookable = bookable === 'true';
    }

    if (departmentId) {
      // Filter by assets currently allocated to the department OR allocated to an employee in that department
      where.allocations = {
        some: {
          status: 'ACTIVE',
          OR: [
            { departmentId: parseInt(departmentId as string) },
            { employee: { departmentId: parseInt(departmentId as string) } }
          ]
        }
      };
    }

    const assets = await prisma.asset.findMany({
      where,
      include: {
        category: true,
        location: true,
        allocations: {
          where: { status: 'ACTIVE' },
          include: {
            employee: { select: { id: true, name: true, email: true } },
            department: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(assets);
  } catch (error) {
    console.error('Fetch assets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assets/:id (authenticated read)
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        category: true,
        location: true,
        registeredBy: { select: { id: true, name: true } },
        allocations: {
          include: {
            employee: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        maintenanceRequests: {
          include: {
            raisedBy: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        bookings: {
          include: {
            bookedBy: { select: { id: true, name: true } }
          },
          orderBy: { startTime: 'desc' }
        },
        attachments: true
      }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json(asset);
  } catch (error) {
    console.error('Get asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assets/:id/history (authenticated read)
router.get('/:id/history', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const allocations = await prisma.assetAllocation.findMany({
      where: { assetId: id },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const maintenanceRequests = await prisma.maintenanceRequest.findMany({
      where: { assetId: id },
      include: {
        raisedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ allocations, maintenanceRequests });
  } catch (error) {
    console.error('Get asset history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assets (Asset Manager write only - support single file upload)
router.post('/', authenticateJWT, requireRole([Role.ASSET_MANAGER]), upload.single('photo'), async (req, res) => {
  try {
    const actor = (req as any).user;
    const body = assetSchema.parse(req.body);

    // Create inside a single transaction to guarantee unique serial/tag auto-generation
    const newAsset = await prisma.$transaction(async (tx) => {
      // 1. Generate incremental asset tag (e.g. AF-0001, AF-0002)
      const lastAsset = await tx.asset.findFirst({
        orderBy: { assetTag: 'desc' },
        select: { assetTag: true }
      });

      let nextNum = 1;
      if (lastAsset) {
        const match = lastAsset.assetTag.match(/^AF-(\d+)$/);
        if (match) {
          nextNum = parseInt(match[1]) + 1;
        }
      }

      const assetTag = `AF-${nextNum.toString().padStart(4, '0')}`;

      // 2. Create the asset
      const asset = await tx.asset.create({
        data: {
          assetTag,
          name: body.name,
          categoryId: body.categoryId,
          serialNumber: body.serialNumber || null,
          acquisitionDate: body.acquisitionDate,
          acquisitionCost: body.acquisitionCost,
          condition: body.condition,
          locationId: body.locationId,
          status: AssetStatus.AVAILABLE,
          isBookable: body.isBookable,
          qrCodeValue: assetTag, // Set QR code value equal to tag
          customFieldValues: body.customFieldValues,
          nextMaintenanceDueDate: body.nextMaintenanceDueDate,
          registeredById: actor.id,
        }
      });

      return asset;
    });

    // 3. Handle upload attachment if present
    if (req.file) {
      await prisma.attachment.create({
        data: {
          assetId: newAsset.id,
          fileUrl: `/uploads/${req.file.filename}`,
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
        }
      });
    }

    // Log action
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'ASSET_REGISTER',
        entityType: 'Asset',
        entityId: newAsset.id,
        metadata: { tag: newAsset.assetTag, name: newAsset.name }
      }
    });

    res.status(201).json(newAsset);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/assets/:id (Asset Manager write only - support single file upload)
router.patch('/:id', authenticateJWT, requireRole([Role.ASSET_MANAGER]), upload.single('photo'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actor = (req as any).user;
    const body = assetSchema.parse(req.body);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid asset ID' });
    }

    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: {
        name: body.name,
        categoryId: body.categoryId,
        serialNumber: body.serialNumber !== undefined ? body.serialNumber : undefined,
        acquisitionDate: body.acquisitionDate !== undefined ? body.acquisitionDate : undefined,
        acquisitionCost: body.acquisitionCost !== undefined ? body.acquisitionCost : undefined,
        condition: body.condition,
        locationId: body.locationId !== undefined ? body.locationId : undefined,
        isBookable: body.isBookable,
        customFieldValues: body.customFieldValues !== undefined ? body.customFieldValues : undefined,
        nextMaintenanceDueDate: body.nextMaintenanceDueDate !== undefined ? body.nextMaintenanceDueDate : undefined,
      }
    });

    if (req.file) {
      await prisma.attachment.create({
        data: {
          assetId: updatedAsset.id,
          fileUrl: `/uploads/${req.file.filename}`,
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
        }
      });
    }

    // Log action
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'ASSET_UPDATE',
        entityType: 'Asset',
        entityId: updatedAsset.id,
        metadata: { tag: updatedAsset.assetTag, name: updatedAsset.name }
      }
    });

    res.json(updatedAsset);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
