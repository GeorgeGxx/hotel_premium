import React, { useState } from 'react';
import {
  StayDetails,
  Room,
  StayStatus,
  CurrentUser,
  CreateStayDTO,
  UpdateStayDTO,
} from '../types/hotel';
import {
  Calendar,
  Clock,
  Mail,
  Plus,
  Edit2,
  Trash2,
  LogOut,
  X,
  FileText,
  Search,
  Sparkles,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface ReservationsManagerProps {
  stays: StayDetails[];
  rooms: Room[];
  currentUser: CurrentUser;
  onRefreshStays: () => void;
  onCreateStay: (dto: CreateStayDTO) => Promise<void>;
  onUpdateStay: (id: string, dto: UpdateStayDTO) => Promise<void>;
  onCancelStay: (id: string) => Promise<void>;
  onCheckOutStay: (id: string) => Promise<void>;
  showToast: (msg: string) => void;
}

export const ReservationsManager: React.FC<ReservationsManagerProps> = ({
  stays,
  rooms,
  currentUser,
  onCreateStay,
  onUpdateStay,
  onCancelStay,
  onCheckOutStay,
  showToast,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingStay, setEditingStay] = useState<StayDetails | null>(null);

  // Form states for creation
  const [createRoomId, setCreateRoomId] = useState<string>(rooms[0]?.id || '');
  const [createGuestName, setCreateGuestName] = useState<string>('');
  const [createGuestEmail, setCreateGuestEmail] = useState<string>('');
  const [createGuestPhone, setCreateGuestPhone] = useState<string>('');
  const [createDocType, setCreateDocType] = useState<string>('PASSPORT');
  const [createDocNumber, setCreateDocNumber] = useState<string>('');
  const [createCheckIn, setCreateCheckIn] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [createNights, setCreateNights] = useState<number>(3);
  const [createDeposit, setCreateDeposit] = useState<number>(100);
  const [createNotes, setCreateNotes] = useState<string>('');
  const [createStatus, setCreateStatus] = useState<StayStatus>('RESERVED');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form states for edit
  const [editNights, setEditNights] = useState<number>(1);
  const [editRate, setEditRate] = useState<number>(0);
  const [editDeposit, setEditDeposit] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');

  const selectedRoomForCreate = rooms.find((r) => r.id === createRoomId);
  const currentRate = selectedRoomForCreate?.base_price || 95.0;
  const createTotalAmount = currentRate * createNights;

  // Filtering
  const filteredStays = stays.filter((s) => {
    const matchesFilter = filterStatus === 'ALL' || s.status === filterStatus;
    const matchesSearch =
      s.guest_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.document_number?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleOpenEdit = (stay: StayDetails) => {
    setEditingStay(stay);
    setEditNights(stay.total_nights);
    setEditRate(stay.nightly_rate);
    setEditDeposit(stay.deposit_amount);
    setEditNotes(stay.notes || '');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createRoomId || !createGuestName || !createGuestEmail) {
      alert('Please fill in room, guest name, and email.');
      return;
    }

    const checkInDate = new Date(createCheckIn);
    const checkOutDate = new Date(checkInDate.getTime() + createNights * 86400000);

    const dto: CreateStayDTO = {
      room_id: createRoomId,
      guest_name: createGuestName,
      guest_email: createGuestEmail,
      guest_phone: createGuestPhone,
      document_type: createDocType,
      document_number: createDocNumber || `DOC-${Math.floor(100000 + Math.random() * 900000)}`,
      check_in_date: checkInDate.toISOString(),
      check_out_date: checkOutDate.toISOString(),
      total_nights: createNights,
      nightly_rate: currentRate,
      deposit_amount: createDeposit,
      notes: createNotes,
      status: createStatus,
    };

    try {
      setIsSubmitting(true);
      await onCreateStay(dto);
      setIsCreateModalOpen(false);
      // Reset form
      setCreateGuestName('');
      setCreateGuestEmail('');
      setCreateGuestPhone('');
      setCreateDocNumber('');
      setCreateNotes('');
      showToast('New reservation created successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStay) return;

    const checkInDate = new Date(editingStay.check_in_date);
    const checkOutDate = new Date(checkInDate.getTime() + editNights * 86400000);

    const dto: UpdateStayDTO = {
      check_out_date: checkOutDate.toISOString(),
      total_nights: editNights,
      nightly_rate: editRate,
      deposit_amount: editDeposit,
      notes: editNotes,
    };

    try {
      setIsSubmitting(true);
      await onUpdateStay(editingStay.id, dto);
      setEditingStay(null);
      showToast('Reservation updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelClick = async (stay: StayDetails) => {
    const ok = window.confirm(
      `Cancel reservation for ${stay.guest_name} in Room ${stay.room_number}?`
    );
    if (!ok) return;

    try {
      await onCancelStay(stay.id);
      showToast(`Reservation for Room ${stay.room_number} cancelled.`);
    } catch {
      alert('Could not cancel reservation.');
    }
  };

  const handleCheckOutClick = async (stay: StayDetails) => {
    const ok = window.confirm(
      `Process check-out for Room ${stay.room_number}? Room will transition to DIRTY.`
    );
    if (!ok) return;

    try {
      await onCheckOutStay(stay.id);
      showToast(`Guest checked out. Room ${stay.room_number} scheduled for housekeeping.`);
    } catch {
      alert('Check-out failed.');
    }
  };

  const getStatusBadge = (status: StayStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active Guest
          </span>
        );
      case 'RESERVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            Reserved
          </span>
        );
      case 'CHECKED_OUT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
            Checked Out
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Stats */}
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-serif-luxury text-2xl font-bold tracking-tight text-white">
              Reservations &amp; Folios Management
            </h2>
            <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Live Synchronized
            </span>
            <span className="bg-slate-800 text-slate-300 text-xs font-mono font-bold px-2 py-0.5 rounded border border-slate-700">
              {currentUser.role}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise stay records, real-time GiST double-booking exclusion, and asynchronous event streaming.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all text-xs"
        >
          <Plus className="w-4 h-4 text-slate-950" />
          <span>New Reservation</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-4 border border-slate-800 shadow-xl flex flex-col sm:flex-row gap-3 justify-between items-center">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'ACTIVE', 'RESERVED', 'CHECKED_OUT', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterStatus === st
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st === 'ALL' ? 'All Stays' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search guest, room, doc..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
          />
        </div>
      </div>

      {/* Reservations Table / Cards */}
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
        {filteredStays.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No reservations found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              There are no reservations matching your current filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold tracking-wider">
                  <th className="py-3.5 px-4">Guest Details</th>
                  <th className="py-3.5 px-4">Suite / Room</th>
                  <th className="py-3.5 px-4">Stay Dates</th>
                  <th className="py-3.5 px-4">Rate &amp; Deposit</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStays.map((stay) => {
                  const checkIn = new Date(stay.check_in_date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const checkOut = new Date(stay.check_out_date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <tr key={stay.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">{stay.guest_name}</div>
                        <div className="flex items-center gap-3 text-slate-400 text-[11px] mt-0.5">
                          {stay.guest_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-amber-400" />
                              {stay.guest_email}
                            </span>
                          )}
                          {stay.document_number && (
                            <span className="flex items-center gap-1 font-mono text-slate-400">
                              <FileText className="w-3 h-3 text-slate-500" />
                              {stay.document_number}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">Room {stay.room_number}</div>
                        <div className="text-[11px] text-amber-400 font-medium">
                          {stay.category_name} (Floor {stay.room_floor})
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{checkIn} &rarr; {checkOut}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {stay.total_nights} Night{stay.total_nights > 1 ? 's' : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">
                          ${stay.total_amount?.toFixed(2)} USD
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>Deposit: ${stay.deposit_amount?.toFixed(2)}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              stay.payment_status === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {stay.payment_status}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">{getStatusBadge(stay.status)}</td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit available for basic_user and admin_user if not finished */}
                          {stay.status !== 'CHECKED_OUT' && stay.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleOpenEdit(stay)}
                              title="Edit Stay Details"
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Check-Out available for Active Stays */}
                          {stay.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleCheckOutClick(stay)}
                              title="Check-Out Guest"
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                            </button>
                          )}

                          {/* Cancel available for Reserved/Active Stays */}
                          {stay.status !== 'CHECKED_OUT' && stay.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleCancelClick(stay)}
                              title="Cancel Reservation"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* ================= CREATE RESERVATION MODAL ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif-luxury font-bold text-white text-lg">Create New VIP Reservation</h3>
                  <p className="text-xs text-slate-400">
                    Direct booking with conflict prevention in PostgreSQL 18
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-5 text-xs">
              {/* Room Selector */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Select Suite / Room</label>
                <select
                  value={createRoomId}
                  onChange={(e) => setCreateRoomId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id} className="bg-slate-900">
                      Room {r.number} - {r.category_name} (${r.base_price} USD/night) - Status: {r.status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Guest Information */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Guest Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lady Vivienne Westwood"
                    value={createGuestName}
                    onChange={(e) => setCreateGuestName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Guest Email</label>
                  <input
                    type="email"
                    required
                    placeholder="guest@domain.com"
                    value={createGuestEmail}
                    onChange={(e) => setCreateGuestEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 019-2831"
                    value={createGuestPhone}
                    onChange={(e) => setCreateGuestPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Document (Type &amp; Number)</label>
                  <div className="flex gap-2">
                    <select
                      value={createDocType}
                      onChange={(e) => setCreateDocType(e.target.value)}
                      className="w-1/3 px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="PASSPORT" className="bg-slate-900">Passport</option>
                      <option value="NATIONAL_ID" className="bg-slate-900">National ID</option>
                      <option value="DRIVERS_LICENSE" className="bg-slate-900">Driver's Lic.</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Doc number"
                      value={createDocNumber}
                      onChange={(e) => setCreateDocNumber(e.target.value)}
                      className="w-2/3 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dates & Nights */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Check-in Date</label>
                  <input
                    type="date"
                    required
                    value={createCheckIn}
                    onChange={(e) => setCreateCheckIn(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Total Nights</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={createNights}
                    onChange={(e) => setCreateNights(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Deposit (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={createDeposit}
                    onChange={(e) => setCreateDeposit(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Status Option */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Initial Status</label>
                  <select
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value as StayStatus)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="RESERVED" className="bg-slate-900">RESERVED (Upcoming)</option>
                    <option value="ACTIVE" className="bg-slate-900">ACTIVE (Immediate Check-in)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Special Requests</label>
                  <input
                    type="text"
                    placeholder="Late arrival, high floor, etc."
                    value={createNotes}
                    onChange={(e) => setCreateNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Total Calculation */}
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-slate-400 text-[11px]">Calculated Total Amount</span>
                  <div className="font-bold text-white text-base">
                    ${createTotalAmount.toFixed(2)} USD
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[11px]">Remaining Balance</span>
                  <div className="font-bold text-amber-400 text-base">
                    ${Math.max(0, createTotalAmount - createDeposit).toFixed(2)} USD
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all"
                >
                  {isSubmitting ? 'Creating...' : 'Confirm Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT RESERVATION MODAL ================= */}
      {editingStay && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif-luxury font-bold text-white text-base">
                    Edit Reservation: Room {editingStay.room_number}
                  </h3>
                  <p className="text-xs text-slate-400">{editingStay.guest_name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingStay(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 mt-5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Total Nights</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={editNights}
                    onChange={(e) => setEditNights(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Nightly Rate (USD)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={editRate}
                    onChange={(e) => setEditRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Deposit Paid (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editDeposit}
                  onChange={(e) => setEditDeposit(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Notes &amp; Requests</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStay(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
