import { Router } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/notifications (User's own notifications)
router.get('/notifications', authenticateJWT, async (req, res) => {
  try {
    const actor = (req as any).user;

    const notifications = await prisma.notification.findMany({
      where: {
        employeeId: actor.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(notifications);
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/notifications/:id/read (Mark single as read)
router.patch('/notifications/:id/read', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.employeeId !== actor.id) {
      return res.status(403).json({ error: 'Forbidden: You cannot modify this notification' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json(updated);
  } catch (error) {
    console.error('Read notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notifications/dismiss-all (Bulk mark all as read)
router.post('/notifications/dismiss-all', authenticateJWT, async (req, res) => {
  try {
    const actor = (req as any).user;

    await prisma.notification.updateMany({
      where: {
        employeeId: actor.id,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Dismiss all notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/activity-logs (Secured audit trails)
router.get('/activity-logs', authenticateJWT, async (req, res) => {
  try {
    const actor = (req as any).user;

    const where: any = {};
    // Employees can only view logs where they are the actor
    if (actor.role === Role.EMPLOYEE) {
      where.actorId = actor.id;
    }

    const logs = await prisma.activityLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Cap at 100 entries for performance
    });

    res.json(logs);
  } catch (error) {
    console.error('Fetch activity logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
