import { Router } from 'express';
import { PrismaClient, Role, Prisma } from '@prisma/client';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();
const prisma = new PrismaClient();

// Dynamic JSON validation schema
const customFieldSchemaItem = z.object({
  key: z.string().min(1, 'Field key is required'),
  label: z.string().min(1, 'Field label is required'),
  type: z.enum(['string', 'number', 'boolean']),
  required: z.boolean(),
});

const categorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional().nullable(),
  customFieldsSchema: z.array(customFieldSchemaItem).nullable().optional(),
});

// GET /api/categories (authenticated read)
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const categories = await prisma.assetCategory.findMany();
    res.json(categories);
  } catch (error) {
    console.error('Fetch categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/categories (Admin write only)
router.post('/', authenticateJWT, requireRole([Role.ADMIN]), async (req, res) => {
  try {
    const body = categorySchema.parse(req.body);
    const actor = (req as any).user;

    const newCategory = await prisma.assetCategory.create({
      data: {
        name: body.name,
        description: body.description || null,
        customFieldsSchema: body.customFieldsSchema ? (body.customFieldsSchema as Prisma.InputJsonValue) : Prisma.DbNull,
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'CATEGORY_CREATE',
        entityType: 'AssetCategory',
        entityId: newCategory.id,
        metadata: { name: newCategory.name }
      }
    });

    res.status(201).json(newCategory);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    // Handle uniqueness constraint
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/categories/:id (Admin write only)
router.patch('/:id', authenticateJWT, requireRole([Role.ADMIN]), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = categorySchema.parse(req.body);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    const updatedCategory = await prisma.assetCategory.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description !== undefined ? body.description : undefined,
        customFieldsSchema: body.customFieldsSchema !== undefined 
          ? (body.customFieldsSchema === null ? Prisma.DbNull : (body.customFieldsSchema as Prisma.InputJsonValue))
          : undefined,
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'CATEGORY_UPDATE',
        entityType: 'AssetCategory',
        entityId: updatedCategory.id,
        metadata: { name: updatedCategory.name }
      }
    });

    res.json(updatedCategory);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
