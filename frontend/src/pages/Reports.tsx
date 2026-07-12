import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Download,
  PieChart as PieChartIcon,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';

interface UtilizationStat {
  id: number;
  tag: string;
  name: string;
  frequency: number;
  totalMinutes: number;
}

interface MaintenanceStat {
  id: number;
  tag: string;
  name: string;
  totalTickets: number;
  resolvedCount: number;
  pendingCount: number;
}

interface DueAlertsReport {
  overdue: Array<{
    id: number;
    expectedReturnDate: string;
    asset: { assetTag: string; name: string };
    employee?: { name: string } | null;
    department?: { name: string } | null;
  }>;
  upcomingMaintenance: Array<{
    id: number;
    assetTag: string;
    name: string;
    nextMaintenanceDueDate: string;
    category: { name: string };
  }>;
}

interface HeatmapReport {
  days: { dayName: string; count: number }[];
  hours: { timeSlot: string; count: number }[];
}

interface AssetStatusStat {
  status: string;
  count: number;
}

interface DepartmentAllocationStat {
  department: string;
  count: number;
}

type ReportTab = 'overview' | 'utilization' | 'maintenance' | 'demand' | 'alerts';

const chartColors = ['#ff5a1f', '#0f9e9a', '#2563eb', '#f59e0b', '#7c3aed', '#dc2626', '#64748b'];
const tooltipStyle = {
  border: '1px solid #dbe3eb',
  borderRadius: '6px',
  background: '#ffffff',
  color: '#0f172a',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
};

const formatStatus = (value: string) => value
  .replaceAll('_', ' ')
  .toLowerCase()
  .replace(/\b\w/g, char => char.toUpperCase());

const formatHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const csv = [headers.join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const LoadingState = () => (
  <div className="flex items-center justify-center py-16 text-sm text-slate-500 gap-2">
    <RefreshCw className="w-5 h-5 animate-spin text-primary-500" />
    Preparing report data...
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="border border-dashed border-slate-300 bg-slate-50 rounded-lg p-10 text-center text-sm text-slate-500">
    {message}
  </div>
);

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');

  const { data: utilization = [], isLoading: utilizationLoading } = useQuery<UtilizationStat[]>({
    queryKey: ['report-utilization'],
    queryFn: () => api.get('/reports/utilization'),
  });
  const { data: maintenance = [], isLoading: maintenanceLoading } = useQuery<MaintenanceStat[]>({
    queryKey: ['report-maintenance'],
    queryFn: () => api.get('/reports/maintenance'),
  });
  const { data: alerts, isLoading: alertsLoading } = useQuery<DueAlertsReport>({
    queryKey: ['report-alerts'],
    queryFn: () => api.get('/reports/overdue-due'),
  });
  const { data: heatmap, isLoading: demandLoading } = useQuery<HeatmapReport>({
    queryKey: ['report-heatmap'],
    queryFn: () => api.get('/reports/bookings-heatmap'),
  });
  const { data: assetStatus = [], isLoading: statusLoading } = useQuery<AssetStatusStat[]>({
    queryKey: ['report-asset-status'],
    queryFn: () => api.get('/reports/asset-status-summary'),
  });
  const { data: allocationsByDepartment = [], isLoading: allocationsLoading } = useQuery<DepartmentAllocationStat[]>({
    queryKey: ['report-allocations-by-department'],
    queryFn: () => api.get('/reports/allocations-by-department'),
  });

  const utilizationChart = useMemo(
    () => utilization.slice(0, 6).map(item => ({
      name: item.tag,
      hours: formatHours(item.totalMinutes),
      bookings: item.frequency,
    })),
    [utilization]
  );
  const maintenanceChart = useMemo(
    () => maintenance.slice(0, 6).map(item => ({
      name: item.tag,
      resolved: item.resolvedCount,
      open: item.pendingCount,
    })),
    [maintenance]
  );
  const activeAssetCount = useMemo(
    () => assetStatus
      .filter(item => !['RETIRED', 'DISPOSED'].includes(item.status))
      .reduce((total, item) => total + item.count, 0),
    [assetStatus]
  );
  const openRepairs = useMemo(
    () => maintenance.reduce((total, item) => total + item.pendingCount, 0),
    [maintenance]
  );
  const totalBookings = useMemo(
    () => utilization.reduce((total, item) => total + item.frequency, 0),
    [utilization]
  );

  const exportCurrentView = () => {
    if (activeTab === 'utilization') {
      exportCsv('asset-utilization.csv', utilization.map(item => ({
        tag: item.tag,
        asset: item.name,
        bookings: item.frequency,
        hours: formatHours(item.totalMinutes),
      })));
      return;
    }
    if (activeTab === 'maintenance') {
      exportCsv('maintenance-frequency.csv', maintenance.map(item => ({
        tag: item.tag,
        asset: item.name,
        tickets: item.totalTickets,
        resolved: item.resolvedCount,
        open: item.pendingCount,
      })));
      return;
    }
    if (activeTab === 'demand') {
      exportCsv('booking-demand.csv', [
        ...(heatmap?.days || []).map(item => ({ dimension: item.dayName, bookings: item.count })),
        ...(heatmap?.hours || []).map(item => ({ dimension: item.timeSlot, bookings: item.count })),
      ]);
      return;
    }
    if (activeTab === 'alerts') {
      exportCsv('overdue-allocations.csv', (alerts?.overdue || []).map(item => ({
        tag: item.asset.assetTag,
        asset: item.asset.name,
        holder: item.employee?.name || item.department?.name || 'Unassigned',
        expectedReturn: new Date(item.expectedReturnDate).toLocaleDateString(),
      })));
      return;
    }
    exportCsv('assetflow-overview.csv', [
      ...assetStatus.map(item => ({ group: 'Asset status', label: formatStatus(item.status), value: item.count })),
      ...allocationsByDepartment.map(item => ({ group: 'Department allocation', label: item.department, value: item.count })),
    ]);
  };

  const tabItems: Array<{ id: ReportTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'utilization', label: 'Utilization' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'demand', label: 'Booking demand' },
    { id: 'alerts', label: 'Exceptions' },
  ];

  return (
    <div className="space-y-6 text-slate-950">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-700 text-xs font-bold uppercase tracking-[0.2em]">
            <BarChart3 className="w-4 h-4" />
            Analytics workspace
          </div>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Operational insights</h2>
          <p className="mt-1 text-sm text-slate-600">Track capacity, repair risk, ownership, and booking demand from live records.</p>
        </div>
        <button onClick={exportCurrentView} className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-primary-200 hover:bg-primary-50 rounded-lg transition">
          <Download className="w-4 h-4" />
          Export current view
        </button>
      </section>

      <nav className="flex gap-1 overflow-x-auto bg-white border border-slate-200 p-1 rounded-lg" aria-label="Analytics report tabs">
        {tabItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={'shrink-0 px-3 py-2 text-xs font-bold rounded-md transition ' + (activeTab === item.id ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950')}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <div className="space-y-5">
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Active assets', value: activeAssetCount, color: 'text-primary-700 bg-primary-50 border-primary-100' },
              { label: 'Open repairs', value: openRepairs, color: 'text-amber-800 bg-amber-50 border-amber-100' },
              { label: 'Recorded bookings', value: totalBookings, color: 'text-teal-800 bg-teal-50 border-teal-100' },
              { label: 'Overdue returns', value: alerts?.overdue.length || 0, color: 'text-red-700 bg-red-50 border-red-100' },
            ].map(card => (
              <div key={card.label} className={'border rounded-lg p-4 ' + card.color}>
                <p className="text-[10px] uppercase tracking-[0.16em] font-bold">{card.label}</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-950">{card.value}</p>
              </div>
            ))}
          </section>

          {(statusLoading || allocationsLoading) ? <LoadingState /> : (
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="bg-white border border-slate-200 rounded-lg p-5 min-h-[340px]">
                <div className="flex items-center gap-2 mb-4">
                  <PieChartIcon className="w-5 h-5 text-primary-600" />
                  <div>
                    <h3 className="font-bold">Asset lifecycle distribution</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Inventory grouped by current lifecycle state.</p>
                  </div>
                </div>
                {assetStatus.length === 0 ? <EmptyState message="Register assets to see lifecycle distribution." /> : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={assetStatus} dataKey="count" nameKey="status" innerRadius={62} outerRadius={94} paddingAngle={3}>
                        {assetStatus.map((item, index) => <Cell key={item.status} fill={chartColors[index % chartColors.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value, formatStatus(name)]} />
                      <Legend formatter={(value: string) => formatStatus(value)} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 min-h-[340px]">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-teal-700" />
                  <div>
                    <h3 className="font-bold">Allocated equipment by department</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Current equipment ownership across teams.</p>
                  </div>
                </div>
                {allocationsByDepartment.length === 0 ? <EmptyState message="Active allocations will appear here." /> : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={allocationsByDepartment.slice(0, 8)} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="department" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Allocated assets" fill="#0f9e9a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === 'utilization' && (
        <div className="space-y-5">
          {utilizationLoading ? <LoadingState /> : utilization.length === 0 ? <EmptyState message="Booking history will create utilization rankings." /> : (
            <>
              <section className="bg-white border border-slate-200 rounded-lg p-5">
                <h3 className="font-bold">Most-used shared resources</h3>
                <p className="text-xs text-slate-500 mt-1">Total booked hours across completed and upcoming reservations.</p>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={utilizationChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="hours" name="Booked hours" fill="#ff5a1f" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bookings" name="Reservations" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <DataTable
                headers={['Asset', 'Reservations', 'Booked hours']}
                rows={utilization.map(item => [
                  <span key={item.id} className="font-mono font-bold text-primary-700">{item.tag} <span className="font-sans font-semibold text-slate-950">{item.name}</span></span>,
                  String(item.frequency) + ' slots',
                  String(formatHours(item.totalMinutes)) + ' hrs',
                ])}
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="space-y-5">
          {maintenanceLoading ? <LoadingState /> : maintenance.length === 0 ? <EmptyState message="Maintenance requests will reveal repair frequency and repeat failures." /> : (
            <>
              <section className="bg-white border border-slate-200 rounded-lg p-5">
                <div className="flex items-center gap-2"><Wrench className="w-5 h-5 text-amber-600" /><h3 className="font-bold">Repair workload by asset</h3></div>
                <p className="text-xs text-slate-500 mt-1">Compare resolved work against open repair orders.</p>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={maintenanceChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="resolved" name="Resolved" stackId="repairs" fill="#0f9e9a" />
                      <Bar dataKey="open" name="Open" stackId="repairs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <DataTable
                headers={['Asset', 'Tickets', 'Resolved', 'Open']}
                rows={maintenance.map(item => [
                  <span key={item.id} className="font-mono font-bold text-primary-700">{item.tag} <span className="font-sans font-semibold text-slate-950">{item.name}</span></span>,
                  item.totalTickets,
                  <span key="resolved" className="font-semibold text-teal-700">{item.resolvedCount}</span>,
                  <span key="open" className={item.pendingCount ? 'font-semibold text-amber-700' : 'text-slate-500'}>{item.pendingCount}</span>,
                ])}
              />
            </>
          )}
        </div>
      )}

      {activeTab === 'demand' && (
        <div className="space-y-5">
          {demandLoading ? <LoadingState /> : !heatmap ? <EmptyState message="Booking data is not available yet." /> : (
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <DemandChart title="Booking demand by day" description="Find the days that need more resource capacity." data={heatmap.days} color="#2563eb" />
              <DemandChart title="Booking demand by time window" description="Understand when shared assets see peak demand." data={heatmap.hours} color="#7c3aed" />
            </section>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-5">
          {alertsLoading ? <LoadingState /> : (
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
                <div className="p-5 border-b border-red-100 bg-red-50">
                  <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /><h3 className="font-bold text-red-900">Overdue returns</h3></div>
                  <p className="text-xs text-red-700 mt-1">Assets past their expected return date need follow-up.</p>
                </div>
                {(alerts?.overdue.length || 0) === 0 ? <EmptyState message="No overdue assets right now." /> : (
                  <DataTable compact headers={['Asset', 'Holder', 'Expected return']} rows={(alerts?.overdue || []).map(item => [
                    <span key={item.id} className="font-semibold">{item.asset.assetTag} <span className="text-slate-500">{item.asset.name}</span></span>,
                    item.employee?.name || item.department?.name || 'Unassigned',
                    new Date(item.expectedReturnDate).toLocaleDateString(),
                  ])} />
                )}
              </div>
              <div className="bg-white border border-amber-100 rounded-lg overflow-hidden">
                <div className="p-5 border-b border-amber-100 bg-amber-50">
                  <div className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-amber-700" /><h3 className="font-bold text-amber-950">Maintenance due soon</h3></div>
                  <p className="text-xs text-amber-800 mt-1">Preventive work scheduled in the next 30 days.</p>
                </div>
                {(alerts?.upcomingMaintenance.length || 0) === 0 ? <EmptyState message="No scheduled maintenance is due in the next 30 days." /> : (
                  <DataTable compact headers={['Asset', 'Category', 'Due date']} rows={(alerts?.upcomingMaintenance || []).map(item => [
                    <span key={item.id} className="font-semibold">{item.assetTag} <span className="text-slate-500">{item.name}</span></span>,
                    item.category.name,
                    new Date(item.nextMaintenanceDueDate).toLocaleDateString(),
                  ])} />
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

const DemandChart: React.FC<{
  title: string;
  description: string;
  data: { dayName?: string; timeSlot?: string; count: number }[];
  color: string;
}> = ({ title, description, data, color }) => (
  <div className="bg-white border border-slate-200 rounded-lg p-5 min-h-[340px]">
    <h3 className="font-bold">{title}</h3>
    <p className="text-xs text-slate-500 mt-1">{description}</p>
    {data.length === 0 ? <div className="mt-5"><EmptyState message="No booking activity recorded." /></div> : (
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.map(item => ({ label: item.dayName || item.timeSlot || '', count: item.count }))} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" name="Bookings" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

const DataTable: React.FC<{ headers: string[]; rows: React.ReactNode[][]; compact?: boolean }> = ({ headers, rows, compact = false }) => (
  <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-[0.14em] text-slate-500">
        <tr>{headers.map(header => <th key={header} className="px-4 py-3 font-bold whitespace-nowrap">{header}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-slate-700">
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="hover:bg-slate-50">
            {row.map((cell, cellIndex) => <td key={cellIndex} className={(compact ? 'px-4 py-3' : 'px-4 py-4') + ' whitespace-nowrap'}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default Reports;
