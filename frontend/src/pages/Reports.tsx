import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  BarChart3,
  Shuffle,
  Wrench,
  Clock,
  CalendarCheck,
  AlertTriangle,
  RefreshCw,
  FolderSync,
  Sparkles
} from 'lucide-react';

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
  overdue: any[];
  upcomingMaintenance: any[];
}

interface HeatmapReport {
  days: { dayName: string; count: number }[];
  hours: { timeSlot: string; count: number }[];
}

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'utilization' | 'maintenance' | 'alerts' | 'heatmap'>('utilization');

  // Queries
  const { data: utilization = [], isLoading: utilLoading } = useQuery<UtilizationStat[]>({
    queryKey: ['report-utilization'],
    queryFn: () => api.get('/reports/utilization'),
  });

  const { data: maintenance = [], isLoading: maintLoading } = useQuery<MaintenanceStat[]>({
    queryKey: ['report-maintenance'],
    queryFn: () => api.get('/reports/maintenance'),
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<DueAlertsReport>({
    queryKey: ['report-alerts'],
    queryFn: () => api.get('/reports/overdue-due'),
  });

  const { data: heatmap, isLoading: heatmapLoading } = useQuery<HeatmapReport>({
    queryKey: ['report-heatmap'],
    queryFn: () => api.get('/reports/bookings-heatmap'),
  });

  return (
    <div className="space-y-6 text-white">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2">
            <BarChart3 className="w-8 h-8 text-sky-400" />
            <span>Reports & Analytics</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">Review operational insights, utilization rankings, and preventive maintenance triggers.</p>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-slate-800 bg-slate-900/30 p-1 rounded-xl max-w-lg">
        <button
          onClick={() => setActiveTab('utilization')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all outline-none cursor-pointer text-center ${
            activeTab === 'utilization' ? 'bg-slate-800 text-white shadow border border-slate-700/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Utilization
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all outline-none cursor-pointer text-center ${
            activeTab === 'maintenance' ? 'bg-slate-800 text-white shadow border border-slate-700/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Maintenance Rates
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all outline-none cursor-pointer text-center ${
            activeTab === 'alerts' ? 'bg-slate-800 text-white shadow border border-slate-700/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Due Alerts
        </button>
        <button
          onClick={() => setActiveTab('heatmap')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all outline-none cursor-pointer text-center ${
            activeTab === 'heatmap' ? 'bg-slate-800 text-white shadow border border-slate-700/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Peak Hours
        </button>
      </div>

      {/* 1. RESOURCE UTILIZATION TAB */}
      {activeTab === 'utilization' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-200">Shared Resource Utilization Rankings</h3>
            <span className="text-[10px] text-slate-500 italic">Ranked by total hours booked</span>
          </div>

          {utilLoading ? (
            <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
              <span>Fetching utilization data...</span>
            </div>
          ) : utilization.length === 0 ? (
            <div className="glass p-12 rounded-2xl text-center text-slate-400 text-sm">
              No booking records available to display rankings.
            </div>
          ) : (
            <div className="glass rounded-xl overflow-hidden border border-slate-800/60">
              <table className="w-full text-left text-sm text-slate-350">
                <thead className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Asset Tag</th>
                    <th className="px-6 py-4">Asset Name</th>
                    <th className="px-6 py-4">Total Reservations</th>
                    <th className="px-6 py-4">Accumulated Hours</th>
                    <th className="px-6 py-4">Utilization Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {utilization.map((item, idx) => {
                    const totalHours = Math.round((item.totalMinutes / 60) * 10) / 10;
                    const maxMinutes = Math.max(...utilization.map(i => i.totalMinutes)) || 1;
                    const scorePercent = Math.min(100, Math.round((item.totalMinutes / maxMinutes) * 100));

                    return (
                      <tr key={item.id} className="hover:bg-slate-850/10 transition-colors">
                        <td className="px-6 py-4 font-bold text-sky-400 text-xs">{item.tag}</td>
                        <td className="px-6 py-4 font-semibold text-white">{item.name}</td>
                        <td className="px-6 py-4 text-slate-300 font-semibold">{item.frequency} slots</td>
                        <td className="px-6 py-4 text-slate-200">{totalHours} hrs</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-36 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                              <div
                                className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full"
                                style={{ width: `${scorePercent}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold text-sky-400">{scorePercent}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. MAINTENANCE FREQUENCY RATES TAB */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-200">Equipment Failures & Repeat Repair Rates</h3>
            <span className="text-[10px] text-slate-500 italic">Helps identify obsolete hardware in need of replacement</span>
          </div>

          {maintLoading ? (
            <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
              <span>Fetching maintenance history...</span>
            </div>
          ) : maintenance.length === 0 ? (
            <div className="glass p-12 rounded-2xl text-center text-slate-400 text-sm">
              No maintenance logs recorded.
            </div>
          ) : (
            <div className="glass rounded-xl overflow-hidden border border-slate-800/60">
              <table className="w-full text-left text-sm text-slate-355">
                <thead className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Asset Tag</th>
                    <th className="px-6 py-4">Asset Name</th>
                    <th className="px-6 py-4">Total Repair Tickets</th>
                    <th className="px-6 py-4">Resolved SLA</th>
                    <th className="px-6 py-4">Status Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {maintenance.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-850/10 transition-colors">
                      <td className="px-6 py-4 font-bold text-sky-400 text-xs">{item.tag}</td>
                      <td className="px-6 py-4 font-semibold text-white">{item.name}</td>
                      <td className="px-6 py-4 text-slate-300 font-bold">{item.totalTickets} runs</td>
                      <td className="px-6 py-4 text-emerald-400 font-semibold">{item.resolvedCount} closed</td>
                      <td className="px-6 py-4">
                        {item.totalTickets >= 3 ? (
                          <span className="flex items-center space-x-1 text-red-400 text-[10px] font-extrabold uppercase tracking-wider bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 max-w-[140px] justify-center animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Repeat Failure</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">Standard rate</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. DUE ALERTS (OVERDUE & PREVENTIVE SCHEDULE) */}
      {activeTab === 'alerts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overdue Returns Panel */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-200 flex items-center space-x-2">
              <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
              <span>Overdue Allocations Sweep</span>
            </h3>

            {alertsLoading ? (
              <div className="flex justify-center items-center py-12 text-slate-400 text-sm">
                <span>Checking overdue logs...</span>
              </div>
            ) : !alerts || alerts.overdue.length === 0 ? (
              <div className="glass p-8 rounded-2xl text-center text-slate-400 text-xs border border-slate-800/60">
                All allocations are on track! No overdue devices.
              </div>
            ) : (
              <div className="glass rounded-xl overflow-hidden border border-slate-800/60">
                <table className="w-full text-left text-xs text-slate-350">
                  <thead className="font-bold uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Tag</th>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3">Assigned To</th>
                      <th className="px-4 py-3">Expected Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {alerts.overdue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-850/15">
                        <td className="px-4 py-3 font-bold text-sky-400 font-mono">{item.asset.assetTag}</td>
                        <td className="px-4 py-3 font-semibold text-white">{item.asset.name}</td>
                        <td className="px-4 py-3">
                          {item.employee ? item.employee.name : item.department?.name || 'Dept'}
                        </td>
                        <td className="px-4 py-3 text-red-400 font-semibold">
                          {new Date(item.expectedReturnDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Upcoming Preventive Maintenance schedule */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-200 flex items-center space-x-2">
              <CalendarCheck className="w-4.5 h-4.5 text-primary-400" />
              <span>Preventive Maintenance Due (30 Days)</span>
            </h3>

            {alertsLoading ? (
              <div className="flex justify-center items-center py-12 text-slate-400 text-sm">
                <span>Checking scheduler dates...</span>
              </div>
            ) : !alerts || alerts.upcomingMaintenance.length === 0 ? (
              <div className="glass p-8 rounded-2xl text-center text-slate-400 text-xs border border-slate-800/60">
                No preventive maintenance due in the next 30 days.
              </div>
            ) : (
              <div className="glass rounded-xl overflow-hidden border border-slate-800/60">
                <table className="w-full text-left text-xs text-slate-350">
                  <thead className="font-bold uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Tag</th>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Service Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {alerts.upcomingMaintenance.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-850/15">
                        <td className="px-4 py-3 font-bold text-sky-400 font-mono">{item.assetTag}</td>
                        <td className="px-4 py-3 font-semibold text-white">{item.name}</td>
                        <td className="px-4 py-3">{item.location ? item.location.name : 'Main Office'}</td>
                        <td className="px-4 py-3 text-sky-400 font-semibold">
                          {new Date(item.nextMaintenanceDueDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. BOOKINGS HEATMAP VIEW */}
      {activeTab === 'heatmap' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-200">Peak Reservation Density Timelines</h3>
            <span className="text-[10px] text-slate-550 italic">Highlights day-of-week and hourly slot capacities</span>
          </div>

          {heatmapLoading ? (
            <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
              <span>Calculating heatmap profiles...</span>
            </div>
          ) : !heatmap ? (
            <div className="glass p-12 rounded-2xl text-center text-slate-400 text-sm">
              No booking schedules logged to calculate peak logs.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Peak Weekdays */}
              <div className="glass rounded-xl p-5 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Peak Weekdays Density</h4>
                <div className="space-y-3.5">
                  {heatmap.days.map((d, index) => {
                    const maxCount = Math.max(...heatmap.days.map(d => d.count)) || 1;
                    const percent = Math.round((d.count / maxCount) * 100);
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-300">{d.dayName}</span>
                          <span className="text-slate-450">{d.count} reservations</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Peak Time Slots */}
              <div className="glass rounded-xl p-5 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Peak Hour Slots Density</h4>
                <div className="space-y-3.5">
                  {heatmap.hours.map((h, index) => {
                    const maxCount = Math.max(...heatmap.hours.map(h => h.count)) || 1;
                    const percent = Math.round((h.count / maxCount) * 100);
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-300">
                            {h.timeSlot} {h.timeSlot === 'Morning' ? '(6am - 12pm)' : h.timeSlot === 'Afternoon' ? '(12pm - 6pm)' : h.timeSlot === 'Evening' ? '(6pm - 12am)' : '(12am - 6am)'}
                          </span>
                          <span className="text-slate-450">{h.count} slots</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                          <div
                            className="h-full bg-gradient-to-r from-primary-400 to-indigo-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default Reports;
