import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  CalendarDays,
  Plus,
  X,
  Clock,
  User,
  Building2,
  Trash2,
  CalendarCheck,
  AlertTriangle,
  RefreshCw,
  Edit3
} from 'lucide-react';

interface Booking {
  id: number;
  assetId: number;
  bookedById: number;
  departmentId: number | null;
  startTime: string;
  endTime: string;
  purpose: string | null;
  status: 'UPCOMING' | 'CANCELLED';
  derivedStatus: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  asset: { id: number; assetTag: string; name: string };
  bookedBy: { id: number; name: string; email: string };
  department?: { id: number; name: string } | null;
}

export const Bookings: React.FC = () => {
  const queryClient = useQueryClient();
  const { employee } = useAuthStore();
  const isManager = employee?.role === 'ASSET_MANAGER' || employee?.role === 'ADMIN';

  // Navigation / Selection States
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  
  // Modals & Panels
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);

  // Form Fields: Create Booking
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [deptId, setDeptId] = useState('');

  // Form Fields: Reschedule
  const [rescheduleBookingId, setRescheduleBookingId] = useState<number | null>(null);
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');

  // Queries
  const { data: bookableAssets = [] } = useQuery<any[]>({
    queryKey: ['assets', 'bookable'],
    queryFn: () => api.get('/assets?bookable=true'),
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['bookings', selectedAssetId],
    queryFn: () => api.get(`/bookings${selectedAssetId ? `?assetId=${selectedAssetId}` : ''}`),
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });

  // Mutations
  const bookMutation = useMutation({
    mutationFn: (data: any) => api.post('/bookings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setBookModalOpen(false);
      resetBookForm();
      alert('Resource booked successfully!');
    },
    onError: (err: any) => {
      alert(err.message || 'Booking failed');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/bookings/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      alert('Booking cancelled successfully.');
    },
    onError: (err: any) => {
      alert(err.message || 'Cancellation failed');
    }
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/bookings/${id}/reschedule`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setRescheduleModalOpen(false);
      setRescheduleBookingId(null);
      alert('Booking rescheduled successfully!');
    },
    onError: (err: any) => {
      alert(err.message || 'Rescheduling failed');
    }
  });

  const resetBookForm = () => {
    setStartTime('');
    setEndTime('');
    setPurpose('');
    setDeptId('');
  };

  const handleBookSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      alert('Please select an asset first');
      return;
    }
    const payload = {
      assetId: parseInt(selectedAssetId),
      startTime,
      endTime,
      purpose,
      departmentId: deptId ? parseInt(deptId) : null,
    };
    bookMutation.mutate(payload);
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rescheduleBookingId === null) return;
    rescheduleMutation.mutate({
      id: rescheduleBookingId,
      data: {
        startTime: rescheduleStart,
        endTime: rescheduleEnd
      }
    });
  };

  const statusColors = {
    UPCOMING: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    ONGOING: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    COMPLETED: 'bg-slate-500/10 text-slate-400 border border-slate-700/20',
    CANCELLED: 'bg-red-500/10 text-red-400 border border-red-500/20',
  };

  const activeAssetObj = bookableAssets.find(a => a.id === parseInt(selectedAssetId));

  return (
    <div className="space-y-6 text-white">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Shared Resource Bookings</h2>
          <p className="text-slate-400 text-sm mt-1">Reserve shared hardware resources, schedule timelines, and avoid slot conflicts.</p>
        </div>
        {selectedAssetId && (
          <button
            onClick={() => setBookModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Book Slot</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left column: Bookable Assets list selector */}
        <div className="space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Shared Resources</span>
          <div className="space-y-2">
            <button
              onClick={() => setSelectedAssetId('')}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold tracking-wide transition outline-none ${
                selectedAssetId === ''
                  ? 'bg-primary-500/10 border-primary-500/30 text-primary-400'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
              }`}
            >
              All Shared Resources
            </button>
            
            {bookableAssets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => setSelectedAssetId(asset.id.toString())}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold tracking-wide transition outline-none ${
                  selectedAssetId === asset.id.toString()
                    ? 'bg-primary-500/10 border-primary-500/30 text-primary-400'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850/40'
                }`}
              >
                <div className="font-bold text-sky-400 text-xs">{asset.assetTag}</div>
                <div className="font-semibold text-white mt-0.5 truncate">{asset.name}</div>
                <span className="text-[10px] text-slate-550 block mt-1">Loc: {asset.location ? asset.location.name : 'hq'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right column: Bookings Calendar & List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {activeAssetObj ? `Schedule: ${activeAssetObj.name}` : 'All Bookings'}
            </span>
          </div>

          {bookingsLoading ? (
            <div className="flex justify-center items-center py-12 text-slate-400 text-sm space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-400" />
              <span>Loading schedules...</span>
            </div>
          ) : bookings.length === 0 ? (
            <div className="glass p-16 rounded-2xl text-center text-slate-400 text-sm border border-slate-800/60">
              <CalendarDays className="w-12 h-12 text-slate-650 mx-auto mb-4" />
              <p>No reservations logged for this resource.</p>
              {selectedAssetId && (
                <button
                  onClick={() => setBookModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-700 transition cursor-pointer"
                >
                  Book first slot
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => {
                const isCreator = booking.bookedById === employee?.id;
                const canEdit = booking.derivedStatus === 'UPCOMING' && (isCreator || isManager);
                return (
                  <div
                    key={booking.id}
                    className="glass rounded-xl p-5 border border-slate-800/85 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-750 transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-sky-400">{booking.asset.assetTag}</span>
                        <span className="text-white font-bold text-sm">{booking.asset.name}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          statusColors[booking.derivedStatus]
                        }`}>
                          {booking.derivedStatus}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-slate-400">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {new Date(booking.startTime).toLocaleString()} — {new Date(booking.endTime).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>Booked by: {booking.bookedBy.name}</span>
                        </div>
                        {booking.department && (
                          <div className="flex items-center space-x-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Dept: {booking.department.name}</span>
                          </div>
                        )}
                      </div>

                      {booking.purpose && (
                        <p className="text-xs text-slate-500 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-850 inline-block">
                          Purpose: {booking.purpose}
                        </p>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex space-x-2 w-full md:w-auto justify-end">
                        <button
                          onClick={() => {
                            setRescheduleBookingId(booking.id);
                            setRescheduleStart(booking.startTime.substring(0, 16));
                            setRescheduleEnd(booking.endTime.substring(0, 16));
                            setRescheduleModalOpen(true);
                          }}
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-semibold transition outline-none cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Reschedule</span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Cancel this upcoming reservation?')) {
                              cancelMutation.mutate(booking.id);
                            }
                          }}
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-red-500/10 text-slate-350 hover:text-red-400 border border-slate-800 hover:border-red-500/20 rounded-lg text-xs font-semibold transition outline-none cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* BOOK SLOT MODAL */}
      {bookModalOpen && activeAssetObj && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Book Shared Resource</h3>
                <p className="text-xs text-slate-450 mt-0.5">{activeAssetObj.name}</p>
              </div>
              <button onClick={() => setBookModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookSubmit} className="space-y-4">
              {/* Start Date Time */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Start Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              {/* End Date Time */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">End Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              {/* Department Option */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Associate Department</label>
                <select
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                >
                  <option value="">User personal booking</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Purpose */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Purpose / Booking Notes</label>
                <textarea
                  placeholder="Describe slot purpose (e.g., Client meeting, Project design run)..."
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <div className="p-3 bg-primary-500/10 border border-primary-500/20 text-primary-400 rounded-xl text-[11px] leading-relaxed flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Booking checks support half-open intervals. Conflicting slots will block booking automatically via server-side validation.
                </span>
              </div>

              <button
                type="submit"
                disabled={bookMutation.isPending}
                className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {bookMutation.isPending ? 'Confirming booking...' : 'Book Resource'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full rounded-2xl p-6 relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary-500"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Reschedule Booking</h3>
              <button onClick={() => setRescheduleModalOpen(false)} className="text-slate-400 hover:text-white transition outline-none cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">New Start Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={rescheduleStart}
                  onChange={(e) => setRescheduleStart(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">New End Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={rescheduleEnd}
                  onChange={(e) => setRescheduleEnd(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 rounded-xl text-white outline-none text-sm transition"
                />
              </div>

              <button
                type="submit"
                disabled={rescheduleMutation.isPending}
                className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow active:scale-[0.98] outline-none mt-6 cursor-pointer"
              >
                {rescheduleMutation.isPending ? 'Updating schedule...' : 'Reschedule Booking'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Bookings;
