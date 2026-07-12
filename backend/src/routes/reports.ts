import { Router } from 'express';
import { PrismaClient, Role, AssetStatus, AllocationStatus, MaintenanceStatus, BookingStatus } from '@prisma/client';
import { authenticateJWT } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();
const prisma = new PrismaClient();

// Enforce route-level blocks so only Admin, Asset Manager, and Dept Heads can read analytics
router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN, Role.ASSET_MANAGER, Role.DEPARTMENT_HEAD]));

// GET /api/reports/utilization (Rank bookable assets by booking duration and frequency)
router.get('/utilization', async (req, res) => {
  try {
    const bookings = await prisma.resourceBooking.findMany({
      where: {
        status: { not: BookingStatus.CANCELLED }
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } }
      }
    });

    // Map utilization stats per asset
    const statsMap: Record<number, { id: number; tag: string; name: string; frequency: number; totalMinutes: number }> = {};

    for (const b of bookings) {
      if (!statsMap[b.assetId]) {
        statsMap[b.assetId] = {
          id: b.assetId,
          tag: b.asset.assetTag,
          name: b.asset.name,
          frequency: 0,
          totalMinutes: 0
        };
      }

      const diffMs = b.endTime.getTime() - b.startTime.getTime();
      const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));

      statsMap[b.assetId].frequency += 1;
      statsMap[b.assetId].totalMinutes += diffMins;
    }

    const ranking = Object.values(statsMap).sort((a, b) => b.totalMinutes - a.totalMinutes);

    res.json(ranking);
  } catch (error) {
    console.error('Fetch utilization report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/maintenance (Recurring ticket logs and failure counts)
router.get('/maintenance', async (req, res) => {
  try {
    const maintenanceRequests = await prisma.maintenanceRequest.findMany({
      include: {
        asset: { select: { id: true, assetTag: true, name: true } }
      }
    });

    const statsMap: Record<number, { id: number; tag: string; name: string; totalTickets: number; resolvedCount: number; pendingCount: number }> = {};

    for (const r of maintenanceRequests) {
      if (!statsMap[r.assetId]) {
        statsMap[r.assetId] = {
          id: r.assetId,
          tag: r.asset.assetTag,
          name: r.asset.name,
          totalTickets: 0,
          resolvedCount: 0,
          pendingCount: 0
        };
      }

      statsMap[r.assetId].totalTickets += 1;
      if (r.status === MaintenanceStatus.RESOLVED) {
        statsMap[r.assetId].resolvedCount += 1;
      } else if (r.status !== MaintenanceStatus.REJECTED) {
        statsMap[r.assetId].pendingCount += 1;
      }
    }

    const report = Object.values(statsMap).sort((a, b) => b.totalTickets - a.totalTickets);

    res.json(report);
  } catch (error) {
    console.error('Fetch maintenance report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/overdue-due (Overdue returns and upcoming maintenance schedule)
router.get('/overdue-due', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Overdue allocations
    const overdue = await prisma.assetAllocation.findMany({
      where: {
        status: AllocationStatus.ACTIVE,
        expectedReturnDate: { lt: now }
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        employee: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } }
      }
    });

    // Upcoming maintenance due (next 30 days)
    const upcomingMaintenance = await prisma.asset.findMany({
      where: {
        status: { notIn: [AssetStatus.RETIRED, AssetStatus.DISPOSED] },
        nextMaintenanceDueDate: {
          gte: now,
          lte: thirtyDaysFromNow
        }
      },
      include: {
        location: { select: { name: true } },
        category: { select: { name: true } }
      },
      orderBy: { nextMaintenanceDueDate: 'asc' }
    });

    res.json({
      overdue,
      upcomingMaintenance
    });
  } catch (error) {
    console.error('Fetch overdue and maintenance schedule report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/bookings-heatmap (Booking distribution density map)
router.get('/bookings-heatmap', async (req, res) => {
  try {
    const bookings = await prisma.resourceBooking.findMany({
      where: { status: { not: BookingStatus.CANCELLED } }
    });

    // Heatmap data structure: dayOfWeek (0-6) -> count
    const dayStats: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    // Hour slots: Morning (6-12), Afternoon (12-18), Evening (18-24), Night (0-6)
    const hourStats: Record<string, number> = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };

    for (const b of bookings) {
      const day = b.startTime.getDay();
      const hour = b.startTime.getHours();

      dayStats[day] = (dayStats[day] || 0) + 1;

      if (hour >= 6 && hour < 12) {
        hourStats.Morning += 1;
      } else if (hour >= 12 && hour < 18) {
        hourStats.Afternoon += 1;
      } else if (hour >= 18 && hour < 24) {
        hourStats.Evening += 1;
      } else {
        hourStats.Night += 1;
      }
    }

    res.json({
      days: Object.keys(dayStats).map(day => ({
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(day)],
        count: dayStats[parseInt(day)]
      })),
      hours: Object.keys(hourStats).map(slot => ({
        timeSlot: slot,
        count: hourStats[slot]
      }))
    });
  } catch (error) {
    console.error('Fetch bookings heatmap error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// GET /api/reports/asset-status-summary (Current lifecycle distribution)
router.get('/asset-status-summary', async (_req, res) => {
  try {
    const summary = await prisma.asset.groupBy({
      by: ['status'],
      _count: { _all: true }
    });

    res.json(summary.map(item => ({ status: item.status, count: item._count._all })));
  } catch (error) {
    console.error('Fetch asset status summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/allocations-by-department (Current equipment ownership mix)
router.get('/allocations-by-department', async (_req, res) => {
  try {
    const allocations = await prisma.assetAllocation.findMany({
      where: { status: AllocationStatus.ACTIVE },
      include: {
        department: { select: { name: true } },
        employee: { include: { department: { select: { name: true } } } }
      }
    });

    const totals = new Map<string, number>();
    for (const allocation of allocations) {
      const name = allocation.department?.name || allocation.employee?.department?.name || 'Unassigned';
      totals.set(name, (totals.get(name) || 0) + 1);
    }

    res.json(Array.from(totals, ([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count));
  } catch (error) {
    console.error('Fetch allocation summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
