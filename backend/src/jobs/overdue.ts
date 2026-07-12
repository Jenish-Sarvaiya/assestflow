import cron from 'node-cron';
import { PrismaClient, AllocationStatus, BookingStatus, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

// Dynamic function to execute the sweeps manually or via cron
export async function runBackgroundSweeps() {
  const now = new Date();
  console.log(`[Background Jobs] Starting sweeps at ${now.toISOString()}`);

  try {
    // 1. Scan for Overdue Allocations
    const overdueAllocations = await prisma.assetAllocation.findMany({
      where: {
        status: AllocationStatus.ACTIVE,
        expectedReturnDate: {
          lt: now
        }
      },
      include: {
        asset: { select: { name: true, assetTag: true } }
      }
    });

    for (const alloc of overdueAllocations) {
      // Determine target employee
      const targetEmployeeId = alloc.employeeId;
      if (!targetEmployeeId) continue; // Skip department-level allocations for individual overdue alerts

      // Check if alert already sent in the last 24 hours
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentAlert = await prisma.notification.findFirst({
        where: {
          employeeId: targetEmployeeId,
          type: NotificationType.OVERDUE_RETURN_ALERT,
          relatedEntityType: 'AssetAllocation',
          relatedEntityId: alloc.id,
          createdAt: {
            gte: oneDayAgo
          }
        }
      });

      if (!recentAlert) {
        await prisma.notification.create({
          data: {
            employeeId: targetEmployeeId,
            type: NotificationType.OVERDUE_RETURN_ALERT,
            message: `Overdue Alert: The asset ${alloc.asset.name} (${alloc.asset.assetTag}) was expected back on ${alloc.expectedReturnDate?.toLocaleDateString()}. Please return it or contact an Asset Manager.`,
            relatedEntityType: 'AssetAllocation',
            relatedEntityId: alloc.id
          }
        });
        console.log(`[Background Jobs] Fired overdue alert for Allocation ${alloc.id} to Employee ${targetEmployeeId}`);
      }
    }

    // 2. Scan for Upcoming Bookings starting in the next 15 minutes
    const fifteenMinsFromNow = new Date(now.getTime() + 15 * 60 * 1000);
    const imminentBookings = await prisma.resourceBooking.findMany({
      where: {
        status: BookingStatus.UPCOMING,
        startTime: {
          gte: now,
          lte: fifteenMinsFromNow
        }
      },
      include: {
        asset: { select: { name: true, assetTag: true } }
      }
    });

    for (const booking of imminentBookings) {
      // Check if we already sent a reminder for this booking
      const existingReminder = await prisma.notification.findFirst({
        where: {
          employeeId: booking.bookedById,
          message: {
            startsWith: 'Reminder:'
          },
          relatedEntityType: 'ResourceBooking',
          relatedEntityId: booking.id
        }
      });

      if (!existingReminder) {
        await prisma.notification.create({
          data: {
            employeeId: booking.bookedById,
            type: NotificationType.BOOKING_CONFIRMED,
            message: `Reminder: Your reservation for shared resource ${booking.asset.name} (${booking.asset.assetTag}) begins in less than 15 minutes.`,
            relatedEntityType: 'ResourceBooking',
            relatedEntityId: booking.id
          }
        });
        console.log(`[Background Jobs] Fired booking reminder for Booking ${booking.id} to Employee ${booking.bookedById}`);
      }
    }

  } catch (error) {
    console.error('[Background Jobs] Error executing sweeps:', error);
  }
}

// Register cron schedule: Every 5 minutes (hackathon-friendly frequency)
export function startCronJobs() {
  console.log('[Background Jobs] Initializing cron schedules (interval: 5 minutes)...');
  
  // Run once immediately on start for developer ease
  runBackgroundSweeps();

  cron.schedule('*/5 * * * *', () => {
    runBackgroundSweeps();
  });
}
