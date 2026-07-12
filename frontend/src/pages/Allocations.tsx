import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  Shuffle,
  Plus,
  ArrowRightCircle,
  Undo2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Building2,
  User,
  Clock,
  ChevronRight,
  HelpCircle,
  X,
  FileText,
  RefreshCw
} from 'lucide-react';

interface Allocation {
  id: number;
  assetId: number;
  employeeId: number | null;
  departmentId: number | null;
  allocatedDate: string;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  status: 'ACTIVE' | 'RETURNED' | 'TRANSFERRED';
  conditionAtAllocation: string | null;
  conditionAtReturn: string | null;
  returnNotes: string | null;
  asset: { id: number; assetTag: string; name: string; status: string };
  employee?: { id: number; name: string; email: string } | null;
  department?: { id: number; name: string } | null;
}

interface TransferRequest {
  id: number;
  assetId: number;
  fromAllocationId: number | null;
  requestedById: number;
  toEmployeeId: number | null;
  toDepartmentId: number | null;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
  asset: { id: number; assetTag: string; name: string };
  requestedBy: { id: number; name: string; email: string };
  toEmployee?: { id: number; name: string; departmentId: number | null } | null;
  toDepartment?: { id: number; name: string } | null;
  approvedBy?: { id: number; name: string } | null;
  fromAllocation?: {
    employee?: { id: number; name: string } | null;
    department?: { id: number; name: string } | null;
  } | null;
}

export const Allocations: React.FC = () => {
  const queryClient = useQueryClient();
  const { employee } = useAuthStore();
  const isManager = employee?.role === 'ASSET_MANAGER' || employee?.role === 'ADMIN';

  // Modal / Form States
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  // Form Fields: Allocation
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [recipientType, setRecipientType] = useState<'employee' | 'department'>('employee');
  const [recipientId, setRecipientId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [allocationCondition, setAllocationCondition] = useState('Good');

  // Conflict Interceptor State
  const [conflictData, setConflictData] = useState<any>(null);

  // Form Fields: Return
  const [returningAllocationId, setReturningAllocationId] = useState<number | null>(null);
  const [returnCondition, setReturnCondition] = useState('Good');
  const [returnNotes, setReturnNotes] = useState('');

  // Form Fields: Reject
  const [rejectTransferId, setRejectTransferId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Queries
  const { data: allocations = [], isLoading: allocationsLoading } = useQuery<Allocation[]>({
    queryKey: ['allocations'],
    queryFn: () => api.get('/allocations'),
  });

  const { data: transfers = [], isLoading: transfersLoading } = useQuery<TransferRequest[]>({
    queryKey: ['transfers'],
    queryFn: () => api.get('/allocations/transfers'),
  });

  const { data: availableAssets = [] } = useQuery<any[]>({
    queryKey: ['assets', 'available'],
    queryFn: () => api.get('/assets?status=AVAILABLE'),
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees'),
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });

  // Mutations
  const allocateMutation = useMutation({
    mutationFn: (data: any) => api.post('/allocations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setAllocateModalOpen(false);
      resetAllocateForm();
    },
    onError: (err: any) => {
      // Intercept 409 conflict error (Priya / Raj case)
      if (err.status === 409 && err.details) {
        setConflictData(err.details);
        setAllocateModalOpen(false);
        setConflictModalOpen(true);
      } else {
        alert(err.message || 'Allocation failed');
      }
    }
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.post(`/allocations/${id}/return`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setReturnModalOpen(false);
      setReturningAllocationId(null);
      setReturnNotes('');
    },
    onError: (err: any) => {
      alert(err.message || 'Return failed');
    }
  });

  const requestTransferMutation = useMutation({
    mutationFn: (data: any) => api.post('/allocations/transfers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      setConflictModalOpen(false);
      setConflictData(null);
      resetAllocateForm();
      alert('Transfer request successfully raised!');
    },
    onError: (err: any) => {
      alert(err.message || 'Transfer request failed');
    }
  });

  const approveTransferMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/allocations/transfers/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      alert('Transfer approved!');
    },
    onError: (err: any) => {
      alert(err.message || 'Approval failed');
    }
  });

  const rejectTransferMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => 
      api.patch(`/allocations/transfers/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      setRejectModalOpen(false);
      setRejectTransferId(null);
      setRejectionReason('');
      alert('Transfer request rejected.');
    },
    onError: (err: any) => {
      alert(err.message || 'Rejection failed');
    }
  });

  const resetAllocateForm = () => {
    setSelectedAssetId('');
    setRecipientId('');
    setExpectedReturnDate('');
    setAllocationCondition('Good');
  };

  const handleAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      assetId: parseInt(selectedAssetId),
      employeeId: recipientType === 'employee' ? parseInt(recipientId) : null,
      departmentId: recipientType === 'department' ? parseInt(recipientId) : null,
      expectedReturnDate: expectedReturnDate || null,
      conditionAtAllocation: allocationCondition
    };
    allocateMutation.mutate(payload);
  };

  const handleConfirmTransferRequest = () => {
    if (!conflictData) return;
    const payload = {
      assetId: conflictData.assetId || conflictData.details?.assetId || parseInt(selectedAssetId),
      toEmployeeId: recipientType === 'employee' ? parseInt(recipientId) : null,
      toDepartmentId: recipientType === 'department' ? parseInt(recipientId) : null,
    };
    requestTransferMutation.mutate(payload);
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (returningAllocationId === null) return;
    returnMutation.mutate({
      id: returningAllocationId,
      data: {
        conditionAtReturn: returnCondition,
        returnNotes: returnNotes
      }
    });
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectTransferId === null) return;
    rejectTransferMutation.mutate({
      id: rejectTransferId,
      reason: rejectionReason
    });
  };

  const canApproveTransfer = (t: TransferRequest) => {
    if (isManager) return true;
    if (employee?.role === 'DEPARTMENT_HEAD' && employee.departmentId) {
      if (t.toDepartmentId === employee.departmentId) return true;
      if (t.toEmployee && t.toEmployee.departmentId === employee.departmentId) return true;
    }
    return false;
  };

  return (
    <div className="space-y-6 text-white">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Allocations & Transfers</h2>
          <p className="text-slate-400 text-sm mt-1">Assign organization equipment, track current holders, and approve department transfers.</p>
        </div>
        {isManager && (
          <button
            onClick={() => setAllocateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Allocation</span>
          </button>
        )}
      </div>

      {/* ACTIVE ALLOCATIONS LIST */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-200">Active Asset Allocations</h3>
        {allocationsLoading ? (
          <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
            <span>Loading allocations records...</span>
          </div>
        ) : allocations.filter(a => a.status === 'ACTIVE').length === 0 ? (
          <div className="glass p-12 rounded-2xl text-center text-slate-400 text-sm">
            No active allocations found. Check out available items to assign assets.
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden border border-slate-800/60">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Asset Tag</th>
                  <th className="px-6 py-4">Asset Name</th>
                  <th className="px-6 py-4">Allocated To</th>
                  <th className="px-6 py-4">Allocated Date</th>
                  <th className="px-6 py-4">Expected Return</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allocations.filter(a => a.status === 'ACTIVE').map((a) => (
                  <tr key={a.id} className="hover:bg-slate-850/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-sky-400 text-xs">{a.asset.assetTag}</td>
                    <td className="px-6 py-4 font-semibold text-white">{a.asset.name}</td>
                    <td className="px-6 py-4">
                      {a.employee ? (
                        <div className="flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>{a.employee.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{a.department?.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">{new Date(a.allocatedDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-xs text-slate-450">
                      {a.expectedReturnDate ? (
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{new Date(a.expectedReturnDate).toLocaleDateString()}</span>
                        </span>
                      ) : (
                        <span className="text-slate-650 italic">Indefinite</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* Anyone allocated can return, or Asset Managers */}
                      {(isManager || a.employeeId === employee?.id) && (
                        <button
                          onClick={() => {
                            setReturningAllocationId(a.id);
                            setReturnCondition(a.asset.status === 'UNDER_MAINTENANCE' ? 'Poor' : 'Good');
                            setReturnModalOpen(true);
                          }}
                          className="text-xs font-semibold px-3 py-1.5 bg-slate-900 hover:bg-red-500/10 text-slate-350 hover:text-red-400 border border-slate-800 hover:border-red-500/20 rounded-lg transition outline-none cursor-pointer"
                        >
                          Return Asset
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TRANSFER REQUESTS QUEUE */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-bold text-slate-200">Transfer & Relocation Requests</h3>
        {transfersLoading ? (
          <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
            <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
            <span>Loading transfer queues...</span>
          </div>
        ) : transfers.length === 0 ? (
          <div className="glass p-12 rounded-2xl text-center text-slate-400 text-sm">
            No transfer requests currently in queue.
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden border border-slate-800/60">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-900/80 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Asset</th>
                  <th className="px-6 py-4">Current Holder</th>
                  <th className="px-6 py-4">Requested By</th>
                  <th className="px-6 py-4">Transfer Recipient</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transfers.map((t) => {
                  const currentHolder = t.fromAllocation
                    ? t.fromAllocation.employee
                      ? t.fromAllocation.employee.name
                      : t.fromAllocation.department?.name || 'Department'
                    : 'N/A';
                  
                  const targetRecipient = t.toEmployee
                    ? `${t.toEmployee.name} (Employee)`
                    : `${t.toDepartment?.name} (Dept)`;

                  return (
                    <tr key={t.id} className="hover:bg-slate-850/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-sky-400 text-xs">{t.asset.assetTag}</div>
                        <div className="text-white font-semibold text-xs mt-0.5">{t.asset.name}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{currentHolder}</td>
                      <td className="px-6 py-4 text-slate-400">
                        <div className="text-xs text-slate-300">{t.requestedBy.name}</div>
                        <div className="text-[10px] text-slate-550">{t.requestedBy.email}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-200 font-semibold">{targetRecipient}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          t.status === 'REQUESTED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          t.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {t.status}
                        </span>
                        {t.status === 'REJECTED' && t.rejectionReason && (
                          <div className="text-[10px] text-red-400 mt-1 max-w-[150px] truncate" title={t.rejectionReason}>
                            Reason: {t.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {t.status === 'REQUESTED' && (
                          <div className="flex justify-end space-x-2">
                            {canApproveTransfer(t) ? (
                              <>
                                <button
                                  onClick={() => approveTransferMutation.mutate(t.id)}
                                  disabled={approveTransferMutation.isPending}
                                  className="text-xs font-semibold px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 hover:border-emerald-500/30 text-emerald-400 rounded-lg transition outline-none cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectTransferId(t.id);
                                    setRejectModalOpen(true);
                                  }}
                                  className="text-xs font-semibold px-2 py-1 bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/30 text-red-400 rounded-lg transition outline-none cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-550 italic">Pending authorization</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ALLOCATE MODAL */}
      {allocateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Allocate Equipment</h3>
              <button onClick={() => setAllocateModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAllocateSubmit} className="space-y-4">
              {/* Asset Select */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Select Asset *</label>
                <select
                  required
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="">Select available asset...</option>
                  {availableAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.assetTag} — {asset.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipient Type */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Allocate Recipient Type</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setRecipientType('employee');
                      setRecipientId('');
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition outline-none cursor-pointer ${
                      recipientType === 'employee' ? 'bg-primary-500 text-white shadow' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Employee
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecipientType('department');
                      setRecipientId('');
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition outline-none cursor-pointer ${
                      recipientType === 'department' ? 'bg-primary-500 text-white shadow' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Department
                  </button>
                </div>
              </div>

              {/* Recipient Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">
                  Select {recipientType === 'employee' ? 'Employee' : 'Department'} *
                </label>
                <select
                  required
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="">Choose recipient...</option>
                  {recipientType === 'employee'
                    ? employees.map((e) => (
                        <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
                      ))
                    : departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))
                  }
                </select>
              </div>

              {/* Expected Return Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Expected Return Date</label>
                <input
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <button
                type="submit"
                disabled={allocateMutation.isPending}
                className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {allocateMutation.isPending ? 'Allocating...' : 'Allocate Asset'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONFLICT RESOLUTION / REQUEST TRANSFER MODAL */}
      {conflictModalOpen && conflictData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-red-500/10">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500 animate-pulse"></div>
            
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-lg font-bold text-white">Allocation Conflict</h3>
              </div>
              <button onClick={() => setConflictModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Asset <span className="text-sky-400 font-mono font-bold">{conflictData.assetTag}</span> is currently held by{' '}
                <span className="text-white font-semibold">{conflictData.currentHolder.name}</span>.
              </p>

              <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl text-xs text-slate-400 leading-relaxed">
                You cannot force allocate an already-assigned asset. However, you can submit a **Transfer Request** to routing. If approved, the asset will automatically re-allocate to your chosen recipient.
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleConfirmTransferRequest}
                  disabled={requestTransferMutation.isPending}
                  className="flex-1 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow cursor-pointer text-center"
                >
                  {requestTransferMutation.isPending ? 'Requesting...' : 'Request Transfer'}
                </button>
                <button
                  type="button"
                  onClick={() => setConflictModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RETURN ASSET MODAL */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Log Asset Return</h3>
              <button onClick={() => setReturnModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Condition on Return</label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                  <option value="Obsolete">Obsolete</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Return Notes</label>
                <textarea
                  placeholder="Describe status of the returned asset (damage, upgrades, accessories missing)..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <button
                type="submit"
                disabled={returnMutation.isPending}
                className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {returnMutation.isPending ? 'Logging Return...' : 'Complete Return'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* REJECT TRANSFER MODAL */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-red-500/10">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Reject Transfer Request</h3>
              <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Rejection Reason *</label>
                <textarea
                  required
                  placeholder="Provide details on why this transfer request is rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <button
                type="submit"
                disabled={rejectTransferMutation.isPending}
                className="w-full py-2.5 bg-red-650 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {rejectTransferMutation.isPending ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Allocations;
