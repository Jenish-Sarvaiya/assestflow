import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { FileText, Search, Clock, Info, ShieldAlert, RefreshCw } from 'lucide-react';

interface ActivityLog {
  id: number;
  actorId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  metadata: any;
  createdAt: string;
  actor: { id: number; name: string; email: string; role: string };
}

export const ActivityLogs: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('');

  // Fetch Activity Logs
  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ['activity-logs'],
    queryFn: () => api.get('/activity-logs'),
    refetchInterval: 15000, // Refresh every 15 seconds for live auditing
  });

  // Extract unique actions for filter dropdown
  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));

  // Filter logs based on search term and selected action type
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.actor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = selectedAction === '' || log.action === selectedAction;

    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6 text-white">
      {/* HEADER SECTION */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2">
          <FileText className="w-8 h-8 text-sky-400" />
          <span>Activity Audit Logs</span>
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Review system-wide event trails, security promotions, category schema locks, and allocation logs.
        </p>
      </div>

      {/* FILTER CONTROLS */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search logs by actor name, email, action or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
          />
        </div>
        <div className="w-full md:w-60">
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
          >
            <option value="">All Action Types</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* LOGS LIST */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
          <span>Loading activity logs...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="glass p-16 rounded-2xl text-center text-slate-450 text-sm border border-slate-800/60">
          <ShieldAlert className="w-12 h-12 text-slate-650 mx-auto mb-4" />
          <p>No activity logs found matching the filter criteria.</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden border border-slate-800/60">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Target Entity</th>
                <th className="px-6 py-4">Metadata Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-850/10 transition-colors">
                  <td className="px-6 py-4 text-xs text-slate-450">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-600" />
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-200 font-semibold">{log.actor.name}</div>
                    <div className="text-[10px] text-slate-550">{log.actor.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 border border-slate-700/30 text-sky-400 rounded uppercase tracking-wider">
                      {log.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-200">{log.entityType}</div>
                    {log.entityId && (
                      <span className="text-[10px] text-slate-550 font-mono">ID: {log.entityId}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-400 max-w-[300px] truncate">
                    {log.metadata ? (
                      <span title={JSON.stringify(log.metadata, null, 2)}>
                        {JSON.stringify(log.metadata)}
                      </span>
                    ) : (
                      <span className="text-slate-650 italic">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
export default ActivityLogs;
