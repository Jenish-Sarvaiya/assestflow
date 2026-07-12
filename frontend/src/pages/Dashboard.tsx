import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  Box,
  Shuffle,
  CalendarDays,
  Wrench,
  Clock,
  UserCheck,
  Building,
  TrendingUp,
  AlertOctagon,
  Bell,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FolderTree
} from 'lucide-react';

interface DashboardData {
  role: string;
  departmentName?: string;
  stats: any;
  categoryDistribution?: { name: string; count: number }[];
  recentActivity?: any[];
}

export const Dashboard: React.FC = () => {
  const { employee } = useAuthStore();

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats'),
    refetchInterval: 20000, // Refresh stats every 20 seconds
  });

  if (isLoading || !dashboardData) {
    return (
      <div className="flex justify-center items-center py-24 text-slate-400 text-sm space-x-2">
        <RefreshCw className="w-6 h-6 animate-spin text-primary-400" />
        <span>Loading stats dashboard...</span>
      </div>
    );
  }

  const { stats, categoryDistribution = [], recentActivity = [] } = dashboardData;
  const role = employee?.role || 'EMPLOYEE';

  return (
    <div className="space-y-8 text-white">
      {/* WELCOME BANNER */}
      <div className="relative glass rounded-3xl p-6 md:p-8 overflow-hidden border border-slate-800/80 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-indigo-600/5 pointer-events-none"></div>
        <div className="space-y-2 relative z-10">
          <div className="flex items-center space-x-2 text-sky-400">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Access Level: {role.replace('_', ' ')}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Welcome back, {employee?.name}!
          </h2>
          <p className="text-slate-400 text-sm max-w-xl">
            {role === 'ADMIN' && 'System configurations, database audits, and security directory controls are ready.'}
            {role === 'ASSET_MANAGER' && 'Lifecycle registers, allocations conflict routing, and maintenance orders are active.'}
            {role === 'DEPARTMENT_HEAD' && `Reviewing resource pools and transfer queues for the ${dashboardData.departmentName || 'department'}.`}
            {role === 'EMPLOYEE' && 'Request hardware allocations, book shared resources, and log maintenance tickets.'}
          </p>
        </div>

        {/* Dynamic mini-widget */}
        {role === 'EMPLOYEE' && (
          <div className="glass bg-slate-950/40 p-4 rounded-2xl border border-slate-850/80 text-center min-w-[140px]">
            <span className="text-[10px] uppercase font-bold text-slate-550 block">Unread Alerts</span>
            <span className="text-3xl font-black text-amber-400 mt-1 block">
              {stats.unreadNotifications || 0}
            </span>
          </div>
        )}
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Render cards based on role */}
        {(role === 'ADMIN' || role === 'ASSET_MANAGER') && (
          <>
            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <Box className="w-5 h-5 text-sky-400 absolute right-5 top-5 opacity-60 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Active Assets</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.totalAssets || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-400 border-t border-slate-850 pt-3">
                <span className="text-emerald-400 font-bold">{stats.availableAssets || 0} Available</span>
                <span>{stats.allocatedAssets || 0} Allocated</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <Shuffle className="w-5 h-5 text-primary-400 absolute right-5 top-5 opacity-60 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Allocations</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.activeAllocations || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-500 border-t border-slate-850 pt-3">
                <span>Direct user assigns</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <Wrench className="w-5 h-5 text-amber-400 absolute right-5 top-5 opacity-60 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pending Maintenance</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.pendingMaintenance || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-400 border-t border-slate-850 pt-3">
                <span className="text-red-400 font-bold">{stats.lostAssets || 0} Reported Lost</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <CalendarDays className="w-5 h-5 text-indigo-400 absolute right-5 top-5 opacity-60 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ongoing Bookings</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.ongoingBookings || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-500 border-t border-slate-850 pt-3">
                <span>Shared resources in use</span>
              </div>
            </div>
          </>
        )}

        {role === 'DEPARTMENT_HEAD' && (
          <>
            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <Building className="w-5 h-5 text-sky-400 absolute right-5 top-5 opacity-60" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Dept Equipment Pool</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.totalAssets || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-500 border-t border-slate-850 pt-3">
                <span>Allocated to team/dept</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <Shuffle className="w-5 h-5 text-primary-400 absolute right-5 top-5 opacity-60" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pending Transfers</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.pendingTransfers || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-500 border-t border-slate-850 pt-3">
                <span>Requires head authorization</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <Wrench className="w-5 h-5 text-amber-400 absolute right-5 top-5 opacity-60" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Repair Orders</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.pendingMaintenance || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-500 border-t border-slate-850 pt-3">
                <span>Flipped under maintenance</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <CalendarDays className="w-5 h-5 text-indigo-400 absolute right-5 top-5 opacity-60" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Dept Bookings Running</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.ongoingBookings || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-500 border-t border-slate-850 pt-3">
                <span>Resource slots active</span>
              </div>
            </div>
          </>
        )}

        {role === 'EMPLOYEE' && (
          <>
            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <UserCheck className="w-5 h-5 text-sky-400 absolute right-5 top-5 opacity-60" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">My Assigned Devices</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.myAllocations || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-500 border-t border-slate-850 pt-3">
                <span>Active allocations</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <CalendarDays className="w-5 h-5 text-indigo-400 absolute right-5 top-5 opacity-60" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">My Active Reservations</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.myBookings || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-500 border-t border-slate-850 pt-3">
                <span>Upcoming scheduled slots</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <Wrench className="w-5 h-5 text-amber-400 absolute right-5 top-5 opacity-60" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">My Service Tickets</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.myMaintenance || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-500 border-t border-slate-850 pt-3">
                <span>Active repairs filed by you</span>
              </div>
            </div>

            <div className="glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700/80 transition shadow relative overflow-hidden group">
              <Bell className="w-5 h-5 text-primary-400 absolute right-5 top-5 opacity-60" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Unread Alerts</span>
              <p className="text-3xl font-extrabold text-white mt-2">{stats.unreadNotifications || 0}</p>
              <div className="mt-4 flex gap-3 text-[10px] text-slate-500 border-t border-slate-850 pt-3">
                <span>Check header dropdown</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRAPHICAL CATEGORY CHART PANEL (Admins/Managers) */}
        {(role === 'ADMIN' || role === 'ASSET_MANAGER') && categoryDistribution.length > 0 ? (
          <div className="lg:col-span-1 glass rounded-2xl p-6 border border-slate-800/80 space-y-6">
            <div className="flex items-center space-x-2">
              <FolderTree className="w-5 h-5 text-primary-400" />
              <h3 className="font-bold text-white text-base">Category Distributions</h3>
            </div>
            
            <div className="space-y-4">
              {categoryDistribution.map((cat, idx) => {
                const total = categoryDistribution.reduce((acc, curr) => acc + curr.count, 0);
                const percent = total > 0 ? Math.round((cat.count / total) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300">{cat.name}</span>
                      <span className="text-slate-400">{cat.count} units ({percent}%)</span>
                    </div>
                    {/* CUSTOM CSS GAUGE BAR */}
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-1 glass rounded-2xl p-6 border border-slate-800/80 text-center text-slate-450 text-xs py-12">
            No categorization distributions found. Put categories and assets to generate stock charts.
          </div>
        )}

        {/* RECENT ACTIVITY TICKER (Admins/Managers only) */}
        {(role === 'ADMIN' || role === 'ASSET_MANAGER') ? (
          <div className="lg:col-span-2 glass rounded-2xl p-6 border border-slate-800/80 space-y-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-primary-400" />
              <h3 className="font-bold text-white text-base">Recent Audited Actions</h3>
            </div>
            
            {recentActivity.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs italic">
                No audited log events recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-850">
                {recentActivity.map((log, index) => (
                  <div key={log.id} className="py-3 first:pt-0 last:pb-0 flex justify-between items-start gap-4 text-xs">
                    <div className="space-y-1 pr-2">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-sky-400 text-[10px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded">
                          {log.action.replace('_', ' ')}
                        </span>
                        <span className="text-slate-450 text-[10px]">
                          by {log.actor.name}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-snug">
                        Modified {log.entityType}
                        {log.metadata?.tag ? ` (${log.metadata.tag})` : ''}
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-550 flex-shrink-0">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* QUICK OPTIONS CONSOLE FOR EMPLOYEES */
          <div className="lg:col-span-2 glass rounded-2xl p-6 border border-slate-800/80 space-y-4">
            <h3 className="font-bold text-white text-base">Quick Access Options</h3>
            <p className="text-slate-450 text-xs">Quick shortcuts to request transfers, book equipment, or report defects.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-4 bg-slate-950/60 hover:bg-slate-950/90 rounded-xl border border-slate-850 hover:border-slate-800 transition cursor-pointer flex justify-between items-center group">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-xs block">Book Room / Projector</span>
                  <span className="text-[10px] text-slate-500 block">Reserve shared spaces</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
              </div>

              <div className="p-4 bg-slate-950/60 hover:bg-slate-950/90 rounded-xl border border-slate-850 hover:border-slate-800 transition cursor-pointer flex justify-between items-center group">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-xs block">Report Damage</span>
                  <span className="text-[10px] text-slate-500 block">File repair service request</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default Dashboard;
