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
  Bell,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FolderTree
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (screen: string) => void;
}

interface DashboardData {
  role: string;
  departmentName?: string;
  stats: any;
  categoryDistribution?: { name: string; count: number }[];
  recentActivity?: any[];
}

type MetricCard = {
  label: string;
  value: number;
  detail: React.ReactNode;
  icon: React.ElementType;
  accent: string;
  iconColor: string;
};

const formatRole = (role: string) => role.replace('_', ' ');

const getRoleMessage = (role: string, departmentName?: string) => {
  if (role === 'ADMIN') return 'System configurations, database audits, and security directory controls are ready.';
  if (role === 'ASSET_MANAGER') return 'Lifecycle registers, allocation conflict routing, and maintenance orders are active.';
  if (role === 'DEPARTMENT_HEAD') return `Reviewing resource pools and transfer queues for the ${departmentName || 'department'}.`;
  return 'Request hardware allocations, book shared resources, and log maintenance tickets.';
};

const getMetricCards = (role: string, stats: any): MetricCard[] => {
  if (role === 'ADMIN' || role === 'ASSET_MANAGER') {
    return [
      {
        label: 'Total Active Assets',
        value: stats.totalAssets || 0,
        icon: Box,
        accent: 'border-l-primary-500',
        iconColor: 'text-primary-600',
        detail: (
          <span>
            <strong className="text-emerald-700">{stats.availableAssets || 0}</strong> available / {stats.allocatedAssets || 0} allocated
          </span>
        ),
      },
      {
        label: 'Active Allocations',
        value: stats.activeAllocations || 0,
        icon: Shuffle,
        accent: 'border-l-blue-600',
        iconColor: 'text-blue-600',
        detail: <span>Direct user assigns</span>,
      },
      {
        label: 'Maintenance Today',
        value: stats.maintenanceToday || 0,
        icon: Wrench,
        accent: 'border-l-amber-500',
        iconColor: 'text-amber-600',
        detail: (
          <span>
            <strong className="text-amber-700">{stats.pendingMaintenance || 0}</strong> repair orders open
          </span>
        ),
      },
      {
        label: 'Ongoing Bookings',
        value: stats.ongoingBookings || 0,
        icon: CalendarDays,
        accent: 'border-l-teal-600',
        iconColor: 'text-teal-700',
        detail: <span>Shared resources in use</span>,
      },
    ];
  }

  if (role === 'DEPARTMENT_HEAD') {
    return [
      {
        label: 'Dept Equipment Pool',
        value: stats.totalAssets || 0,
        icon: Building,
        accent: 'border-l-primary-500',
        iconColor: 'text-primary-600',
        detail: <span>Allocated to team/dept</span>,
      },
      {
        label: 'Pending Transfers',
        value: stats.pendingTransfers || 0,
        icon: Shuffle,
        accent: 'border-l-blue-600',
        iconColor: 'text-blue-600',
        detail: <span>Requires head authorization</span>,
      },
      {
        label: 'Active Repair Orders',
        value: stats.pendingMaintenance || 0,
        icon: Wrench,
        accent: 'border-l-amber-500',
        iconColor: 'text-amber-600',
        detail: <span>Flipped under maintenance</span>,
      },
      {
        label: 'Dept Bookings Running',
        value: stats.ongoingBookings || 0,
        icon: CalendarDays,
        accent: 'border-l-teal-600',
        iconColor: 'text-teal-700',
        detail: <span>Resource slots active</span>,
      },
    ];
  }

  return [
    {
      label: 'My Assigned Devices',
      value: stats.myAllocations || 0,
      icon: UserCheck,
      accent: 'border-l-primary-500',
      iconColor: 'text-primary-600',
      detail: <span>Active allocations</span>,
    },
    {
      label: 'My Active Reservations',
      value: stats.myBookings || 0,
      icon: CalendarDays,
      accent: 'border-l-blue-600',
      iconColor: 'text-blue-600',
      detail: <span>Upcoming scheduled slots</span>,
    },
    {
      label: 'My Service Tickets',
      value: stats.myMaintenance || 0,
      icon: Wrench,
      accent: 'border-l-amber-500',
      iconColor: 'text-amber-600',
      detail: <span>Active repairs filed by you</span>,
    },
    {
      label: 'Unread Alerts',
      value: stats.unreadNotifications || 0,
      icon: Bell,
      accent: 'border-l-teal-600',
      iconColor: 'text-teal-700',
      detail: <span>Check header dropdown</span>,
    },
  ];
};

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { employee } = useAuthStore();

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats'),
    refetchInterval: 20000,
  });

  if (isLoading || !dashboardData) {
    return (
      <div className="flex justify-center items-center py-24 text-slate-500 text-sm gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
        <span>Loading stats dashboard...</span>
      </div>
    );
  }

  const { stats, categoryDistribution = [], recentActivity = [] } = dashboardData;
  const role = employee?.role || 'EMPLOYEE';
  const metricCards = getMetricCards(role, stats);
  const categoryTotal = categoryDistribution.reduce((acc, curr) => acc + curr.count, 0);
  const barColors = ['bg-teal-600', 'bg-purple-500', 'bg-primary-500', 'bg-emerald-600', 'bg-amber-500'];

  return (
    <div className="space-y-6 text-slate-950">
      <section className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-teal-700">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-700"></span>
            <span className="text-xs font-bold uppercase tracking-[0.34em]">Access Level: {formatRole(role)}</span>
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 leading-tight">
              Welcome back, {employee?.name}!
            </h2>
            <p className="text-slate-600 text-sm sm:text-base max-w-3xl leading-relaxed">
              {getRoleMessage(role, dashboardData.departmentName)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`bg-white border border-slate-200 border-l-4 ${card.accent} rounded-lg p-4 shadow-sm min-h-[148px] flex flex-col justify-between`}>
              <div className="flex items-start justify-between gap-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 leading-relaxed">
                  {card.label}
                </span>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <div>
                <p className="text-4xl font-extrabold text-slate-950 tracking-tight">{card.value}</p>
                <div className="mt-3 pt-3 border-t border-slate-200 text-sm text-slate-500 leading-snug">
                  {card.detail}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {(role === 'ADMIN' || role === 'ASSET_MANAGER') && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={() => onNavigate('allocations')} className="text-left bg-primary-50 border border-primary-100 rounded-lg px-4 py-3 hover:bg-primary-100 transition">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-primary-700 font-bold">Pending transfers</span>
            <span className="block mt-1 text-2xl font-extrabold text-slate-950">{stats.pendingTransfers || 0}</span>
          </button>
          <button onClick={() => onNavigate('allocations')} className="text-left bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 hover:bg-amber-100 transition">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-amber-800 font-bold">Returns due this week</span>
            <span className="block mt-1 text-2xl font-extrabold text-slate-950">{stats.upcomingReturns || 0}</span>
          </button>
          <button onClick={() => onNavigate('reports')} className="text-left bg-red-50 border border-red-100 rounded-lg px-4 py-3 hover:bg-red-100 transition">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-red-700 font-bold">Overdue returns</span>
            <span className="block mt-1 text-2xl font-extrabold text-slate-950">{stats.overdueReturns || 0}</span>
          </button>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-950">Quick actions</h3>
            <p className="text-xs text-slate-500 mt-0.5">Move directly into the operational work that needs attention.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {role === 'ASSET_MANAGER' && <button onClick={() => onNavigate('assets')} className="px-3 py-2 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-100 rounded-lg transition">Register asset</button>}
            <button onClick={() => onNavigate('bookings')} className="px-3 py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-100 rounded-lg transition">Book resource</button>
            <button onClick={() => onNavigate('maintenance')} className="px-3 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-100 rounded-lg transition">Raise maintenance request</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {(role === 'ADMIN' || role === 'ASSET_MANAGER') && categoryDistribution.length > 0 ? (
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <FolderTree className="w-5 h-5 text-teal-700" />
              <h3 className="font-extrabold text-slate-950 text-xl leading-tight">Category distributions</h3>
            </div>

            <div className="space-y-4">
              {categoryDistribution.map((cat, idx) => {
                const percent = categoryTotal > 0 ? Math.round((cat.count / categoryTotal) * 100) : 0;
                return (
                  <div key={cat.name} className="space-y-2">
                    <div className="flex justify-between gap-4 text-sm font-semibold">
                      <span className="text-slate-950">{cat.name}</span>
                      <span className="text-slate-500 font-mono">{cat.count} units · {percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColors[idx % barColors.length]} rounded-full transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-10 shadow-sm text-center text-slate-500 text-sm">
            No categorization distributions found. Put categories and assets to generate stock charts.
          </div>
        )}

        {(role === 'ADMIN' || role === 'ASSET_MANAGER') ? (
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-teal-700" />
              <h3 className="font-extrabold text-slate-950 text-xl">Recent audited actions</h3>
            </div>

            {recentActivity.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm italic">
                No audited log events recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {recentActivity.map((log) => (
                  <div key={log.id} className="py-3 first:pt-0 last:pb-0 flex justify-between items-start gap-5 text-sm">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-teal-800 text-[11px] px-2.5 py-1 bg-teal-50 border border-teal-100 rounded-md uppercase tracking-wider">
                          {log.action.replace('_', ' ')}
                        </span>
                        <span className="text-slate-500">
                          by {log.actor?.name || 'System'}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-snug">
                        Modified {log.entityType}
                        {log.metadata?.tag ? ` (${log.metadata.tag})` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 font-mono flex-shrink-0 pt-1">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-950 text-xl">Quick access options</h3>
            <p className="text-slate-500 text-sm">Quick shortcuts to request transfers, book equipment, or report defects.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button onClick={() => onNavigate('bookings')} className="p-4 bg-slate-50 hover:bg-primary-50 rounded-lg border border-slate-200 hover:border-primary-200 transition cursor-pointer flex justify-between items-center group text-left">
                <span>
                  <span className="font-bold text-slate-950 text-sm block">Book Room / Projector</span>
                  <span className="text-xs text-slate-500 block mt-1">Reserve shared spaces</span>
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
              </button>

              <button onClick={() => onNavigate('maintenance')} className="p-4 bg-slate-50 hover:bg-primary-50 rounded-lg border border-slate-200 hover:border-primary-200 transition cursor-pointer flex justify-between items-center group text-left">
                <span>
                  <span className="font-bold text-slate-950 text-sm block">Report Damage</span>
                  <span className="text-xs text-slate-500 block mt-1">File repair service request</span>
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
export default Dashboard;
