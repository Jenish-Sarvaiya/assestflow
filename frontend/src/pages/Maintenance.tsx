import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  Wrench,
  Plus,
  X,
  Clock,
  User,
  AlertTriangle,
  Upload,
  CheckCircle,
  XCircle,
  Hammer,
  Play,
  FileCheck,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

interface MaintenanceRequest {
  id: number;
  assetId: number;
  raisedById: number;
  issueDescription: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'TECHNICIAN_ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED';
  rejectionReason: string | null;
  assignedTechnicianName: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  asset: { id: number; assetTag: string; name: string; status: string };
  raisedBy: { id: number; name: string; email: string };
  approvedBy?: { id: number; name: string } | null;
  attachments?: any[];
}

export const Maintenance: React.FC = () => {
  const queryClient = useQueryClient();
  const { employee } = useAuthStore();
  const isManager = employee?.role === 'ASSET_MANAGER' || employee?.role === 'ADMIN';

  // View States
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  // Form: Create Ticket
  const [assetId, setAssetId] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form: Reject Reason
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Form: Assign Technician
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [technicianName, setTechnicianName] = useState('');

  // Form: Resolve
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Queries
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<MaintenanceRequest[]>({
    queryKey: ['maintenance-requests'],
    queryFn: () => api.get('/maintenance-requests'),
  });

  const { data: assets = [] } = useQuery<any[]>({
    queryKey: ['assets'],
    queryFn: () => api.get('/assets'),
  });

  const activeTicket = tickets.find(t => t.id === selectedTicketId);

  // Mutations
  const raiseTicketMutation = useMutation({
    mutationFn: (formData: FormData) => api.post('/maintenance-requests', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      setViewMode('list');
      resetCreateForm();
      alert('Maintenance request raised!');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to raise request');
    }
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/maintenance-requests/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      alert('Request approved! Asset set to Under Maintenance.');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to approve request');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => 
      api.patch(`/maintenance-requests/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      setRejectModalOpen(false);
      setRejectionReason('');
      alert('Request rejected.');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to reject request');
    }
  });

  const assignTechMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => 
      api.patch(`/maintenance-requests/${id}/assign-technician`, { technicianName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      setAssignModalOpen(false);
      setTechnicianName('');
      alert('Technician assigned.');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to assign technician');
    }
  });

  const startProgressMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/maintenance-requests/${id}/start-progress`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      alert('Job status updated to IN PROGRESS.');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to update status');
    }
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) => 
      api.patch(`/maintenance-requests/${id}/resolve`, { resolutionNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setResolveModalOpen(false);
      setResolutionNotes('');
      alert('Maintenance completed successfully!');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to resolve request');
    }
  });

  const resetCreateForm = () => {
    setAssetId('');
    setIssueDescription('');
    setPriority('MEDIUM');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRaiseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('assetId', assetId);
    formData.append('issueDescription', issueDescription);
    formData.append('priority', priority);
    if (selectedFile) {
      formData.append('photo', selectedFile);
    }
    raiseTicketMutation.mutate(formData);
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTicketId === null) return;
    rejectMutation.mutate({ id: selectedTicketId, reason: rejectionReason });
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTicketId === null) return;
    assignTechMutation.mutate({ id: selectedTicketId, name: technicianName });
  };

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTicketId === null) return;
    resolveMutation.mutate({ id: selectedTicketId, notes: resolutionNotes });
  };

  const statusColors = {
    PENDING: 'bg-slate-500/10 text-slate-400 border border-slate-700/30',
    APPROVED: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    REJECTED: 'bg-red-500/10 text-red-400 border border-red-500/20',
    TECHNICIAN_ASSIGNED: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    IN_PROGRESS: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    RESOLVED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  };

  const priorityColors = {
    LOW: 'text-slate-400 bg-slate-800/30',
    MEDIUM: 'text-sky-400 bg-sky-500/10',
    HIGH: 'text-amber-400 bg-amber-500/10',
    URGENT: 'text-red-400 bg-red-500/10 border border-red-500/20 font-bold',
  };

  return (
    <div className="space-y-6 text-white">
      {/* HEADER SECTION */}
      {viewMode === 'list' && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">Maintenance Management</h2>
            <p className="text-slate-400 text-sm mt-1">File repair requests, assign service technicians, and log hardware resolutions.</p>
          </div>
          <button
            onClick={() => setViewMode('create')}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Raise Ticket</span>
          </button>
        </div>
      )}

      {/* VIEW MODES */}

      {/* 1. TICKETS LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {ticketsLoading ? (
            <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
              <span>Loading maintenance tickets...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="glass p-16 rounded-2xl text-center text-slate-400 text-sm border border-slate-800/60">
              <FolderOpen className="w-12 h-12 text-slate-650 mx-auto mb-4" />
              <p>No maintenance tickets found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTicketId(t.id);
                    setViewMode('detail');
                  }}
                  className="glass rounded-xl p-5 border border-slate-800 hover:border-slate-750 transition cursor-pointer space-y-4 group relative"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-sky-450">{t.asset.assetTag}</span>
                      <h4 className="font-bold text-white text-base truncate max-w-[180px] mt-0.5">{t.asset.name}</h4>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      statusColors[t.status]
                    }`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed h-8">
                    {t.issueDescription}
                  </p>

                  <div className="border-t border-slate-850 pt-3 flex items-center justify-between text-[11px]">
                    <span className={`px-2 py-0.5 rounded font-semibold ${priorityColors[t.priority]}`}>
                      {t.priority}
                    </span>
                    <span className="text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. RAISE TICKET FORM */}
      {viewMode === 'create' && (
        <div className="glass-card max-w-lg mx-auto rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
          
          <div className="flex justify-between items-center mb-6 border-b border-slate-800/80 pb-4">
            <h3 className="text-lg font-bold text-white">File Repair Request</h3>
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

          <form onSubmit={handleRaiseSubmit} className="space-y-4">
            {/* Asset Select */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Select Asset *</label>
              <select
                required
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
              >
                <option value="">Select asset to repair...</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.assetTag} — {asset.name} ({asset.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Issue Description *</label>
              <textarea
                required
                placeholder="Provide detailed logs of the defect or malfunction..."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
              />
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>

            {/* Upload attachment */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-slate-300 block">Defect Photo (Max 5MB)</label>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose Photo</span>
                </button>
                <span className="text-xs text-slate-500">
                  {selectedFile ? selectedFile.name : 'No image attached'}
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                  accept="image/*"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={raiseTicketMutation.isPending}
              className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
            >
              {raiseTicketMutation.isPending ? 'Filing ticket...' : 'Submit Repair Ticket'}
            </button>
          </form>
        </div>
      )}

      {/* 3. TICKET DETAIL & WORKFLOW MANAGER */}
      {viewMode === 'detail' && activeTicket && (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800/80 pb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setViewMode('list');
                  setSelectedTicketId(null);
                }}
                className="px-3 py-1.5 bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:text-white text-slate-400 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Back to List
              </button>
              <h3 className="text-lg font-bold text-white">Repair Case Details</h3>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
              statusColors[activeTicket.status]
            }`}>
              {activeTicket.status.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Metadata Specs */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass rounded-2xl p-6 border border-slate-800/80 space-y-6">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Asset Ref</span>
                  <h4 className="text-xl font-bold text-white mt-0.5">{activeTicket.asset.name} ({activeTicket.asset.assetTag})</h4>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Defect Logs</span>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line bg-slate-950 p-4 rounded-xl border border-slate-900">
                    {activeTicket.issueDescription}
                  </p>
                </div>

                {/* Attached Photo */}
                {activeTicket.attachments && activeTicket.attachments.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Photo Attachment</span>
                    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 max-h-80 flex justify-center items-center">
                      <img
                        src={activeTicket.attachments[0].fileUrl}
                        alt="Defect visual log"
                        className="object-contain max-h-80"
                      />
                    </div>
                  </div>
                )}

                {/* Resolution Notes block if resolved */}
                {activeTicket.status === 'RESOLVED' && activeTicket.resolutionNotes && (
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Resolution Logs</span>
                    <p className="text-slate-300 text-xs leading-relaxed">{activeTicket.resolutionNotes}</p>
                    <span className="text-[10px] text-slate-500 block">
                      Resolved on {activeTicket.resolvedAt ? new Date(activeTicket.resolvedAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                )}

                {/* Rejection block if rejected */}
                {activeTicket.status === 'REJECTED' && activeTicket.rejectionReason && (
                  <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Rejection Reason</span>
                    <p className="text-slate-300 text-xs leading-relaxed">{activeTicket.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Workflow Controller (Gated to Asset Managers) */}
            <div className="space-y-6">
              <div className="glass rounded-2xl p-6 border border-slate-800/80 space-y-6">
                <div>
                  <h5 className="font-bold text-white text-base">Service Gating Panel</h5>
                  <p className="text-slate-450 text-xs mt-1">Status changes will trigger asset state synchronizations automatically.</p>
                </div>

                <div className="space-y-4 pt-2 border-t border-slate-850">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Raised By:</span>
                    <span className="font-semibold text-slate-200">{activeTicket.raisedBy.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Priority:</span>
                    <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${priorityColors[activeTicket.priority]}`}>
                      {activeTicket.priority}
                    </span>
                  </div>
                  {activeTicket.assignedTechnicianName && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Technician:</span>
                      <span className="font-semibold text-slate-200">{activeTicket.assignedTechnicianName}</span>
                    </div>
                  )}
                </div>

                {/* WORKFLOW CONTROLS ACTIONS */}
                {isManager && (
                  <div className="space-y-3 pt-4 border-t border-slate-850">
                    {/* Action 1: Pending state -> Approve / Reject */}
                    {activeTicket.status === 'PENDING' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            if (confirm('Approve this repair request?')) {
                              approveMutation.mutate(activeTicket.id);
                            }
                          }}
                          disabled={approveMutation.isPending}
                          className="py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow cursor-pointer text-center outline-none"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectModalOpen(true)}
                          className="py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-red-400 hover:border-red-500/10 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer outline-none"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Action 2: Approved -> Assign Technician */}
                    {activeTicket.status === 'APPROVED' && (
                      <button
                        onClick={() => setAssignModalOpen(true)}
                        className="w-full flex items-center justify-center space-x-2 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition outline-none cursor-pointer"
                      >
                        <User className="w-4 h-4 text-primary-400" />
                        <span>Assign Technician</span>
                      </button>
                    )}

                    {/* Action 3: Technician Assigned -> Start Progress */}
                    {activeTicket.status === 'TECHNICIAN_ASSIGNED' && (
                      <button
                        onClick={() => startProgressMutation.mutate(activeTicket.id)}
                        disabled={startProgressMutation.isPending}
                        className="w-full flex items-center justify-center space-x-2 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow outline-none cursor-pointer"
                      >
                        <Play className="w-4 h-4 text-white" />
                        <span>Start Progress</span>
                      </button>
                    )}

                    {/* Action 4: In Progress -> Resolve */}
                    {activeTicket.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => setResolveModalOpen(true)}
                        className="w-full flex items-center justify-center space-x-2 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow outline-none cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4 text-white" />
                        <span>Mark Resolved</span>
                      </button>
                    )}

                    {/* Completed state message */}
                    {(activeTicket.status === 'RESOLVED' || activeTicket.status === 'REJECTED') && (
                      <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 text-center text-xs text-slate-500 italic">
                        Ticket is locked. Case closed.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-red-500/10">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Reject Service Ticket</h3>
              <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Rejection Reason *</label>
                <textarea
                  required
                  placeholder="Detail why the repair ticket is rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <button
                type="submit"
                disabled={rejectMutation.isPending}
                className="w-full py-2.5 bg-red-650 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {rejectMutation.isPending ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN TECHNICIAN MODAL */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-slate-850">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Assign Service Technician</h3>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Technician Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe, HP Support Center"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <button
                type="submit"
                disabled={assignTechMutation.isPending}
                className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {assignTechMutation.isPending ? 'Assigning...' : 'Assign Technician'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE MODAL */}
      {resolveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Log Repair Resolution</h3>
              <button onClick={() => setResolveModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Resolution Notes *</label>
                <textarea
                  required
                  placeholder="Detail modifications, hardware changes, or maintenance SLA updates..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <button
                type="submit"
                disabled={resolveMutation.isPending}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {resolveMutation.isPending ? 'Logging completion...' : 'Resolve Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Maintenance;
