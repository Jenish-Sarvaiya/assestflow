import { Router } from 'express';
import { PrismaClient, BookingStatus, NotificationType, AssetStatus } from '@prisma/client';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const bookingSchema = z.object({
  assetId: z.coerce.number(),
  startTime: z.string().transform(val => new Date(val)),
  endTime: z.string().transform(val => new Date(val)),
  purpose: z.string().optional().nullable(),
  departmentId: z.coerce.number().nullable().optional(),
});

const rescheduleSchema = z.object({
  startTime: z.string().transform(val => new Date(val)),
  endTime: z.string().transform(val => new Date(val)),
});

// Helper to calculate derived status
export function getDerivedBookingStatus(booking: { status: BookingStatus; startTime: Date; endTime: Date }) {
  if (booking.status === BookingStatus.CANCELLED) {
    return 'CANCELLED';
  }
  const now = new Date();
  if (now >= booking.startTime && now <= booking.endTime) {
    return 'ONGOING';
  }
  if (now > booking.endTime) {
    return 'COMPLETED';
  }
  return 'UPCOMING';
}

// GET /api/bookings (authenticated read)
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { assetId, from, to } = req.query;

    const where: any = {};
    if (assetId) where.assetId = parseInt(assetId as string);

    if (from || to) {
      where.startTime = {};
      if (from) where.startTime.gte = new Date(from as string);
      if (to) where.startTime.lte = new Date(to as string);
    }

    const bookings = await prisma.resourceBooking.findMany({
      where,
      include: {
        asset: { select: { id: true, assetTag: true, name: true, isBookable: true } },
        bookedBy: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } }
      },
      orderBy: { startTime: 'asc' }
    });

    const result = bookings.map(b => ({
      ...b,
      derivedStatus: getDerivedBookingStatus(b)
    }));

    res.json(result);
  } catch (error) {
    console.error('Fetch bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bookings (create booking with overlap check)
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const body = bookingSchema.parse(req.body);
    const actor = (req as any).user;

    const now = new Date();
    if (body.startTime < now) {
      return res.status(400).json({ error: 'Booking start time must be in the future' });
    }
    if (body.endTime <= body.startTime) {
      return res.status(400).json({ error: 'Booking end time must be after start time' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify asset is bookable
      const asset = await tx.asset.findUnique({
        where: { id: body.assetId }
      });

      if (!asset) {
        throw { status: 404, message: 'Asset not found' };
      }

      if (!asset.isBookable) {
        throw { status: 400, message: 'Asset is not registered as a bookable shared resource' };
      }

      // Block booking if asset is retired/lost/disposed
      if (asset.status === AssetStatus.LOST || asset.status === AssetStatus.RETIRED || asset.status === AssetStatus.DISPOSED) {
        throw { status: 400, message: `Cannot book asset. Current status is obsolete: ${asset.status}` };
      }

      // 2. Perform half-open interval overlap check
      // (existingStart < newEnd) AND (existingEnd > newStart)
      const conflictingBooking = await tx.resourceBooking.findFirst({
        where: {
          assetId: body.assetId,
          status: BookingStatus.UPCOMING,
          startTime: { lt: body.endTime },
          endTime: { gt: body.startTime }
        },
        include: {
          bookedBy: { select: { name: true } }
        }
      });

      if (conflictingBooking) {
        throw {
          status: 409,
          message: `Booking slot overlap: Conflicts with an existing booking by ${conflictingBooking.bookedBy.name}.`
        };
      }

      // 3. Create the booking
      const newBooking = await tx.resourceBooking.create({
        data: {
          assetId: body.assetId,
          bookedById: actor.id,
          departmentId: body.departmentId || actor.departmentId || null,
          startTime: body.startTime,
          endTime: body.endTime,
          purpose: body.purpose || null,
          status: BookingStatus.UPCOMING
        }
      });

      // 4. Create confirmation notification
      await tx.notification.create({
        data: {
          employeeId: actor.id,
          type: NotificationType.BOOKING_CONFIRMED,
          message: `Your booking for ${asset.name} (${asset.assetTag}) is confirmed for ${body.startTime.toLocaleString()}.`,
          relatedEntityType: 'ResourceBooking',
          relatedEntityId: newBooking.id
        }
      });

      // Log action
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          action: 'BOOKING_CREATE',
          entityType: 'ResourceBooking',
          entityId: newBooking.id,
          metadata: { assetId: asset.id, tag: asset.assetTag, startTime: body.startTime, endTime: body.endTime }
        }
      });

      return newBooking;
    });

    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/bookings/:id/cancel
router.patch('/:id/cancel', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const booking = await prisma.resourceBooking.findUnique({
      where: { id },
      include: { asset: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const derivedStatus = getDerivedBookingStatus(booking);

    if (derivedStatus !== 'UPCOMING') {
      return res.status(400).json({
        error: `Cannot cancel booking. Current status is already ${derivedStatus.toLowerCase()}`
      });
    }

    // Role check: Only the booking creator, or an Asset Manager/Admin can cancel
    const isOwner = booking.bookedById === actor.id;
    const isManager = actor.role === 'ASSET_MANAGER' || actor.role === 'ADMIN';

    if (!isOwner && !isManager) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to cancel this booking.' });
    }

    const cancelledBooking = await prisma.resourceBooking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED }
    });

    // Notify user
    await prisma.notification.create({
      data: {
        employeeId: booking.bookedById,
        type: NotificationType.BOOKING_CANCELLED,
        message: `Booking for ${booking.asset.name} on ${booking.startTime.toLocaleString()} was cancelled.`,
        relatedEntityType: 'ResourceBooking',
        relatedEntityId: booking.id
      }
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        action: 'BOOKING_CANCEL',
        entityType: 'ResourceBooking',
        entityId: booking.id
      }
    });

    res.json(cancelledBooking);
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/bookings/:id/reschedule
router.patch('/:id/reschedule', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = rescheduleSchema.parse(req.body);
    const actor = (req as any).user;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const now = new Date();
    if (body.startTime < now) {
      return res.status(400).json({ error: 'Rescheduled start time must be in the future' });
    }
    if (body.endTime <= body.startTime) {
      return res.status(400).json({ error: 'Rescheduled end time must be after start time' });
    }

    const booking = await prisma.resourceBooking.findUnique({
      where: { id },
      include: { asset: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const derivedStatus = getDerivedBookingStatus(booking);
    if (derivedStatus !== 'UPCOMING') {
      return res.status(400).json({ error: 'Only upcoming bookings can be rescheduled.' });
    }

    const isOwner = booking.bookedById === actor.id;
    const isManager = actor.role === 'ASSET_MANAGER' || actor.role === 'ADMIN';

    if (!isOwner && !isManager) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to reschedule this booking.' });
    }

    const rescheduled = await prisma.$transaction(async (tx) => {
      // Check for overlap, excluding this current booking
      const conflictingBooking = await tx.resourceBooking.findFirst({
        where: {
          id: { not: id },
          assetId: booking.assetId,
          status: BookingStatus.UPCOMING,
          startTime: { lt: body.endTime },
          endTime: { gt: body.startTime }
        },
        include: {
          bookedBy: { select: { name: true } }
        }
      });

      if (conflictingBooking) {
        throw {
          status: 409,
          message: `Booking slot overlap: Conflicts with an existing booking by ${conflictingBooking.bookedBy.name}.`
        };
      }

      const updated = await tx.resourceBooking.update({
        where: { id },
        data: {
          startTime: body.startTime,
          endTime: body.endTime
        }
      });

      // Log action
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          action: 'BOOKING_RESCHEDULE',
          entityType: 'ResourceBooking',
          entityId: id,
          metadata: { oldStart: booking.startTime, newStart: body.startTime }
        }
      });

      return updated;
    });

    res.json(rescheduled);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Reschedule booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
