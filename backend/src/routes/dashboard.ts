import { Router } from 'express';
import { PrismaClient, Role, AssetStatus, AllocationStatus, MaintenanceStatus, BookingStatus } from '@prisma/client';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/dashboard/stats (authenticated role-aware KPI aggregator)
router.get('/stats', authenticateJWT, async (req, res) => {
  try {
    const actor = (req as any).user;
    const now = new Date();

    // 1. ADMIN / ASSET MANAGER: Org-wide Metrics
    if (actor.role === Role.ADMIN || actor.role === Role.ASSET_MANAGER) {
      const [
        totalAssets,
        availableAssets,
        allocatedAssets,
        maintenanceAssets,
        lostAssets,
        activeAllocations,
        pendingMaintenance,
        ongoingBookings
      ] = await Promise.all([
        prisma.asset.count({ where: { status: { notIn: [AssetStatus.RETIRED, AssetStatus.DISPOSED] } } }),
        prisma.asset.count({ where: { status: AssetStatus.AVAILABLE } }),
        prisma.asset.count({ where: { status: AssetStatus.ALLOCATED } }),
        prisma.asset.count({ where: { status: AssetStatus.UNDER_MAINTENANCE } }),
        prisma.asset.count({ where: { status: AssetStatus.LOST } }),
        prisma.assetAllocation.count({ where: { status: AllocationStatus.ACTIVE } }),
        prisma.maintenanceRequest.count({
          where: {
            status: { in: [MaintenanceStatus.PENDING, MaintenanceStatus.APPROVED, MaintenanceStatus.TECHNICIAN_ASSIGNED, MaintenanceStatus.IN_PROGRESS] }
          }
        }),
        prisma.resourceBooking.count({
          where: {
            status: BookingStatus.UPCOMING,
            startTime: { lte: now },
            endTime: { gte: now }
          }
        })
      ]);

      // Categories breakdown
      const categories = await prisma.assetCategory.findMany({
        include: {
          _count: {
            select: { assets: { where: { status: { notIn: [AssetStatus.RETIRED, AssetStatus.DISPOSED] } } } }
          }
        }
      });

      // Recent 5 logs
      const logs = await prisma.activityLog.findMany({
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      return res.json({
        role: actor.role,
        stats: {
          totalAssets,
          availableAssets,
          allocatedAssets,
          maintenanceAssets,
          lostAssets,
          activeAllocations,
          pendingMaintenance,
          ongoingBookings
        },
        categoryDistribution: categories.map(c => ({ name: c.name, count: c._count.assets })),
        recentActivity: logs
      });
    }

    // 2. DEPARTMENT HEAD: Department-wide Metrics
    if (actor.role === Role.DEPARTMENT_HEAD && actor.departmentId) {
      const deptId = actor.departmentId;

      // Count total assets currently allocated to the department or its employees
      const deptAllocations = await prisma.assetAllocation.findMany({
        where: {
          status: AllocationStatus.ACTIVE,
          OR: [
            { departmentId: deptId },
            { employee: { departmentId: deptId } }
          ]
        },
        select: { assetId: true }
      });
      const uniqueAssetIds = Array.from(new Set(deptAllocations.map(a => a.assetId)));

      const totalDeptAssets = uniqueAssetIds.length;

      // Pending incoming transfers
      const pendingTransfers = await prisma.transferRequest.count({
        where: {
          status: 'REQUESTED',
          OR: [
            { toDepartmentId: deptId },
            { toEmployee: { departmentId: deptId } }
          ]
        }
      });

      // Active Maintenance requests for department assets
      const pendingMaintenance = await prisma.maintenanceRequest.count({
        where: {
          assetId: { in: uniqueAssetIds },
          status: { in: [MaintenanceStatus.PENDING, MaintenanceStatus.APPROVED, MaintenanceStatus.TECHNICIAN_ASSIGNED, MaintenanceStatus.IN_PROGRESS] }
        }
      });

      // Ongoing bookings made by department employees
      const ongoingBookings = await prisma.resourceBooking.count({
        where: {
          status: BookingStatus.UPCOMING,
          startTime: { lte: now },
          endTime: { gte: now },
          OR: [
            { departmentId: deptId },
            { bookedBy: { departmentId: deptId } }
          ]
        }
      });

      const departmentInfo = await prisma.department.findUnique({
        where: { id: deptId },
        select: { name: true }
      });

      return res.json({
        role: actor.role,
        departmentName: departmentInfo?.name || 'Department',
        stats: {
          totalAssets: totalDeptAssets,
          pendingTransfers,
          pendingMaintenance,
          ongoingBookings
        }
      });
    }

    // 3. EMPLOYEE: Personal Metrics
    const [
      myAllocations,
      myBookings,
      myMaintenance,
      unreadNotifications
    ] = await Promise.all([
      prisma.assetAllocation.count({
        where: {
          employeeId: actor.id,
          status: AllocationStatus.ACTIVE
        }
      }),
      prisma.resourceBooking.count({
        where: {
          bookedById: actor.id,
          status: BookingStatus.UPCOMING,
          endTime: { gte: now }
        }
      }),
      prisma.maintenanceRequest.count({
        where: {
          raisedById: actor.id,
          status: { in: [MaintenanceStatus.PENDING, MaintenanceStatus.APPROVED, MaintenanceStatus.TECHNICIAN_ASSIGNED, MaintenanceStatus.IN_PROGRESS] }
        }
      }),
      prisma.notification.count({
        where: {
          employeeId: actor.id,
          isRead: false
        }
      })
    ]);

    return res.json({
      role: actor.role,
      stats: {
        myAllocations,
        myBookings,
        myMaintenance,
        unreadNotifications
      }
    });

  } catch (error) {
    console.error('Fetch dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
