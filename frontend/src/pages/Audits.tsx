import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  ClipboardCheck,
  Plus,
  X,
  User,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  MapPin,
  RefreshCw,
  TrendingDown
} from 'lucide-react';

interface AuditCycle {
  id: number;
  name: string;
  scopeDepartmentId: number | null;
  scopeLocationId: number | null;
  startDate: string;
  endDate: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'CLOSED';
  closedAt: string | null;
  scopeDepartment?: { id: number; name: string } | null;
  scopeLocation?: { id: number; name: string } | null;
  createdBy: { id: number; name: string };
  auditors: { employee: { id: number; name: string; email: string } }[];
  summary?: { pending: number; verified: number; missing: number; damaged: number };
  items?: any[];
}

export const Audits: React.FC = () => {
  const queryClient = useQueryClient();
  const { employee } = useAuthStore();
  const isAdmin = employee?.role === 'ADMIN';

  // Navigation States
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);

  // Form: Create Cycle
  const [name, setName] = useState('');
  const [scopeDeptId, setScopeDeptId] = useState('');
  const [scopeLocId, setScopeLocId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [assignedAuditorIds, setAssignedAuditorIds] = useState<number[]>([]);

  // Form: Verify Item
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyingItemId, setVerifyingItemId] = useState<number | null>(null);
  const [verifyResult, setVerifyResult] = useState<'VERIFIED' | 'MISSING' | 'DAMAGED'>('VERIFIED');
  const [verifyNotes, setVerifyNotes] = useState('');

  // Tab state within Detail
  const [checklistTab, setChecklistTab] = useState<'all' | 'discrepancies'>('all');

  // Queries
  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<AuditCycle[]>({
    queryKey: ['audit-cycles'],
    queryFn: () => api.get('/audit-cycles'),
  });

  const { data: cycleDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ['audit-cycle', selectedCycleId],
    queryFn: () => api.get(`/audit-cycles/${selectedCycleId}`),
    enabled: selectedCycleId !== null,
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees'),
  });

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ['locations'],
    queryFn: () => api.get('/locations'),
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });

  // Mutations
  const createCycleMutation = useMutation({
    mutationFn: (data: any) => api.post('/audit-cycles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-cycles'] });
      setViewMode('list');
      resetCreateForm();
      alert('Audit cycle created and checklist populated!');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to create audit cycle');
    }
  });

  const verifyItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/audit-items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-cycle', selectedCycleId] });
      setVerifyModalOpen(false);
      setVerifyingItemId(null);
      setVerifyNotes('');
      alert('Item verification logged successfully.');
    },
    onError: (err: any) => {
      alert(err.message || 'Verification failed');
    }
  });

  const closeCycleMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/audit-cycles/${id}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-cycle', selectedCycleId] });
      queryClient.invalidateQueries({ queryKey: ['audit-cycles'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      alert('Audit cycle locked and closed! Missing assets marked as LOST.');
    },
    onError: (err: any) => {
      alert(err.message || 'Closure failed');
    }
  });

  const resetCreateForm = () => {
    setName('');
    setScopeDeptId('');
    setScopeLocId('');
    setStartDate('');
    setEndDate('');
    setAssignedAuditorIds([]);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (assignedAuditorIds.length === 0) {
      alert('Please assign at least one auditor');
      return;
    }
    const payload = {
      name,
      scopeDepartmentId: scopeDeptId ? parseInt(scopeDeptId) : null,
      scopeLocationId: scopeLocId ? parseInt(scopeLocId) : null,
      startDate,
      endDate,
      auditorIds: assignedAuditorIds
    };
    createCycleMutation.mutate(payload);
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyingItemId === null) return;
    verifyItemMutation.mutate({
      id: verifyingItemId,
      data: {
        result: verifyResult,
        notes: verifyNotes
      }
    });
  };

  const toggleAuditorSelection = (empId: number) => {
    if (assignedAuditorIds.includes(empId)) {
      setAssignedAuditorIds(assignedAuditorIds.filter(id => id !== empId));
    } else {
      setAssignedAuditorIds([...assignedAuditorIds, empId]);
    }
  };

  const isAssignedAuditor = (cycle: AuditCycle | null) => {
    if (!cycle) return false;
    return cycle.auditors.some(a => a.employee.id === employee?.id);
  };

  const itemResultColors = {
    PENDING: 'bg-slate-550/10 text-slate-400 border border-slate-700/20',
    VERIFIED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    MISSING: 'bg-red-500/10 text-red-400 border border-red-500/20 font-semibold',
    DAMAGED: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold',
  };

  return (
    <div className="space-y-6 text-white">
      {/* HEADER SECTION */}
      {viewMode === 'list' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">Asset Audits</h2>
            <p className="text-slate-400 text-sm mt-1">Schedule regular stock audits, assign auditors, and reconcile discrepancies.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setViewMode('create')}
              className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Audit Cycle</span>
            </button>
          )}
        </div>
      )}

      {/* VIEW MODES */}

      {/* 1. CYCLES LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {cyclesLoading ? (
            <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
              <span>Loading audit schedules...</span>
            </div>
          ) : cycles.length === 0 ? (
            <div className="glass p-16 rounded-2xl text-center text-slate-400 text-sm border border-slate-800/60">
              <ClipboardCheck className="w-12 h-12 text-slate-650 mx-auto mb-4" />
              <p>No audit cycles recorded.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cycles.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCycleId(c.id);
                    setViewMode('detail');
                    setChecklistTab('all');
                  }}
                  className="glass rounded-xl p-5 border border-slate-800 hover:border-slate-750 transition cursor-pointer space-y-4 group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-slate-800 group-hover:bg-primary-500 transition-colors"></div>
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-lg">{c.name}</h4>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Created by {c.createdBy.name}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      c.status === 'CLOSED' ? 'bg-slate-700/30 text-slate-400 border border-slate-700/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-450 border-t border-slate-850 pt-3">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-550" />
                      <span>{new Date(c.startDate).toLocaleDateString()} — {new Date(c.endDate).toLocaleDateString()}</span>
                    </div>
                    {c.scopeLocation && (
                      <div className="flex items-center space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-550" />
                        <span>Location: {c.scopeLocation.name}</span>
                      </div>
                    )}
                    {c.scopeDepartment && (
                      <div className="flex items-center space-x-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-550" />
                        <span>Department: {c.scopeDepartment.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-850 pt-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-550 block">Auditors</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {c.auditors.map((a, index) => (
                        <span key={index} className="text-[10px] px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-slate-350">
                          {a.employee.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. CREATE CYCLE FORM */}
      {viewMode === 'create' && (
        <div className="glass-card max-w-xl mx-auto rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
          
          <div className="flex justify-between items-center mb-6 border-b border-slate-800/80 pb-4">
            <h3 className="text-lg font-bold text-white">Plan Audit Cycle</h3>
            <button
              onClick={() => {
                setViewMode('list');
                resetCreateForm();
              }}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition outline-none cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Cycle Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Q3 Hardware Reconciliation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Scope Location</label>
                <select
                  value={scopeLocId}
                  onChange={(e) => setScopeLocId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="">Any Location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Scope Department</label>
                <select
                  value={scopeDeptId}
                  onChange={(e) => setScopeDeptId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="">Any Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Start Date *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">End Date *</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>
            </div>

            {/* AUDITORS SELECTOR (CHECKBOX LIST) */}
            <div className="space-y-2 border-t border-slate-850 pt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Assign Auditor Checklist *</span>
              <div className="bg-slate-950 rounded-xl border border-slate-800 max-h-40 overflow-y-auto p-3 divide-y divide-slate-900">
                {employees.map((emp) => (
                  <label key={emp.id} className="flex items-center space-x-3 py-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={assignedAuditorIds.includes(emp.id)}
                      onChange={() => toggleAuditorSelection(emp.id)}
                      className="rounded bg-slate-900 border-slate-800 text-primary-500 focus:ring-0 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">{emp.name}</span>
                      <span className="text-[10px] text-slate-500">{emp.email} — {emp.role.replace('_', ' ')}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-3 bg-primary-500/10 border border-primary-500/20 text-primary-400 rounded-xl text-[11px] leading-relaxed flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                On creation, the database will automatically query active matching equipment items and populate individual verification checklist sheets.
              </span>
            </div>

            <button
              type="submit"
              disabled={createCycleMutation.isPending}
              className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
            >
              {createCycleMutation.isPending ? 'Populating sheets...' : 'Generate Audit checklist'}
            </button>
          </form>
        </div>
      )}

      {/* 3. DETAILED CHECKLIST & DISCREPANCY VIEWER */}
      {viewMode === 'detail' && (
        <div className="space-y-6">
          {/* Detailed headers */}
          <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setViewMode('list');
                  setSelectedCycleId(null);
                }}
                className="px-3 py-1.5 bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:text-white text-slate-400 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Back to Cycles
              </button>
              {cycleDetail && <h3 className="text-lg font-bold text-white">{cycleDetail.name}</h3>}
            </div>
            {cycleDetail && cycleDetail.status !== 'CLOSED' && isAdmin && (
              <button
                onClick={() => {
                  if (confirm('Lock this audit cycle? This will lock item statuses and automatically flip MISSING assets to LOST status.')) {
                    closeCycleMutation.mutate(cycleDetail.id);
                  }
                }}
                disabled={closeCycleMutation.isPending}
                className="px-4 py-2 bg-red-650 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow cursor-pointer outline-none"
              >
                {closeCycleMutation.isPending ? 'Locking...' : 'Lock and Close Cycle'}
              </button>
            )}
          </div>

          {detailLoading || !cycleDetail ? (
            <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
              <span>Fetching checklist records...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SUMMARY COUNTS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="glass rounded-xl p-4 border border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Checked Verified</span>
                  <p className="text-3xl font-extrabold text-emerald-400 mt-1">{cycleDetail.summary?.verified || 0}</p>
                </div>
                <div className="glass rounded-xl p-4 border border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Flagged Damaged</span>
                  <p className="text-3xl font-extrabold text-amber-400 mt-1">{cycleDetail.summary?.damaged || 0}</p>
                </div>
                <div className="glass rounded-xl p-4 border border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Reported Missing</span>
                  <p className="text-3xl font-extrabold text-red-400 mt-1">{cycleDetail.summary?.missing || 0}</p>
                </div>
                <div className="glass rounded-xl p-4 border border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Pending Checks</span>
                  <p className="text-3xl font-extrabold text-slate-400 mt-1">{cycleDetail.summary?.pending || 0}</p>
                </div>
              </div>

              {/* TABS ROW */}
              <div className="flex border-b border-slate-800 bg-slate-900/40 rounded-xl p-1 max-w-sm">
                <button
                  onClick={() => setChecklistTab('all')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition outline-none cursor-pointer text-center ${
                    checklistTab === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Sheet Items ({cycleDetail.items?.length || 0})
                </button>
                <button
                  onClick={() => setChecklistTab('discrepancies')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition outline-none cursor-pointer text-center ${
                    checklistTab === 'discrepancies' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Discrepancy View ({cycleDetail.items?.filter((i: any) => i.result === 'MISSING' || i.result === 'DAMAGED').length || 0})
                </button>
              </div>

              {/* CHECKLIST LIST TABLE */}
              {(() => {
                const itemsToRender = checklistTab === 'all'
                  ? cycleDetail.items || []
                  : (cycleDetail.items || []).filter((i: any) => i.result === 'MISSING' || i.result === 'DAMAGED');
                
                const isAuditor = isAssignedAuditor(cycleDetail);
                const isClosed = cycleDetail.status === 'CLOSED';

                return itemsToRender.length === 0 ? (
                  <div className="glass p-12 rounded-2xl text-center text-slate-400 text-sm">
                    No items in this checklist category.
                  </div>
                ) : (
                  <div className="glass rounded-xl overflow-hidden border border-slate-800/60">
                    <table className="w-full text-left text-sm text-slate-350">
                      <thead className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
                        <tr>
                          <th className="px-6 py-4">Asset Code</th>
                          <th className="px-6 py-4">Asset Name</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4">Verification State</th>
                          <th className="px-6 py-4">Checked By</th>
                          <th className="px-6 py-4">Audit Notes</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {itemsToRender.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-850/10 transition-colors">
                            <td className="px-6 py-4 font-bold text-sky-400 text-xs">{item.asset.assetTag}</td>
                            <td className="px-6 py-4 font-semibold text-white">{item.asset.name}</td>
                            <td className="px-6 py-4 text-xs text-slate-450">{item.asset.category.name}</td>
                            <td className="px-6 py-4">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                itemResultColors[item.result]
                              }`}>
                                {item.result}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-400">
                              {item.checkedBy ? (
                                <div className="space-y-0.5">
                                  <p className="text-slate-200 font-semibold">{item.checkedBy.name}</p>
                                  {item.checkedAt && (
                                    <span className="text-[10px] text-slate-500 block">
                                      {new Date(item.checkedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-650 italic">Pending</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-450 max-w-[200px] truncate" title={item.notes}>
                              {item.notes || <span className="text-slate-650 italic">None</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {!isClosed && isAuditor && (
                                <button
                                  onClick={() => {
                                    setVerifyingItemId(item.id);
                                    setVerifyResult(item.result === 'PENDING' ? 'VERIFIED' : item.result);
                                    setVerifyNotes(item.notes || '');
                                    setVerifyModalOpen(true);
                                  }}
                                  className="text-xs font-semibold px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg transition outline-none cursor-pointer"
                                >
                                  Verify
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* VERIFY CHECKLIST ITEM MODAL */}
      {verifyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Verify Equipment Status</h3>
              <button onClick={() => setVerifyModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Verification Result *</label>
                <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-850">
                  <button
                    type="button"
                    onClick={() => setVerifyResult('VERIFIED')}
                    className={`py-2 text-[10px] font-bold uppercase rounded-lg transition outline-none cursor-pointer ${
                      verifyResult === 'VERIFIED' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Verified
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyResult('DAMAGED')}
                    className={`py-2 text-[10px] font-bold uppercase rounded-lg transition outline-none cursor-pointer ${
                      verifyResult === 'DAMAGED' ? 'bg-amber-500 text-white shadow' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Damaged
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyResult('MISSING')}
                    className={`py-2 text-[10px] font-bold uppercase rounded-lg transition outline-none cursor-pointer ${
                      verifyResult === 'MISSING' ? 'bg-red-500 text-white shadow' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Missing
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Notes / Status Logs</label>
                <textarea
                  placeholder="Note down damage details or missing tag remarks..."
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              {verifyResult === 'MISSING' && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10px] leading-relaxed flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Warning: Marking an item as MISSING will trigger a high-priority discrepancy alert for Asset Managers immediately.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifyItemMutation.isPending}
                className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {verifyItemMutation.isPending ? 'Logging check...' : 'Submit Verification'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Audits;
