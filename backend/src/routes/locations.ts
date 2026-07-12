import { Router } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();
const prisma = new PrismaClient();

const locationSchema = z.object({
  name: z.string().min(2, 'Location name is required'),
});

// GET /api/locations (authenticated read)
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(locations);
  } catch (error) {
    console.error('Fetch locations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/locations (Admin & Asset Manager write)
router.post('/', authenticateJWT, requireRole([Role.ADMIN, Role.ASSET_MANAGER]), async (req, res) => {
  try {
    const body = locationSchema.parse(req.body);
    const actor = (req as any).user;

    const newLocation = await prisma.location.create({
      data: {
        name: body.name,
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'LOCATION_CREATE',
        entityType: 'Location',
        entityId: newLocation.id,
        metadata: { name: newLocation.name }
      }
    });

    res.status(201).json(newLocation);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Location name already exists' });
    }
    console.error('Create location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
