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
  CreditCard,
  QrCode,
  Building2,
  DollarSign,
  Receipt,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';

interface ReservationsManagerProps {
  stays: StayDetails[];
  rooms: Room[];
  currentUser: CurrentUser;
  onRefreshStays?: () => void;
  onCreateStay: (dto: CreateStayDTO) => Promise<void>;
  onUpdateStay: (id: string, dto: UpdateStayDTO) => Promise<void>;
  onCancelStay: (id: string) => Promise<void>;
  onCheckOutStay: (
    id: string,
    settlement?: { deposit_amount: number; payment_status: 'PAID'; notes?: string }
  ) => Promise<void>;
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

  // Folio Settlement & Zero-Balance Departure state
  const [settlementStay, setSettlementStay] = useState<StayDetails | null>(null);
  const [settlementTender, setSettlementTender] = useState<
    'CARD_ON_FILE' | 'DIGITAL_LINK' | 'CITY_LEDGER' | 'CASH'
  >('CARD_ON_FILE');
  const [corporateAccountRef, setCorporateAccountRef] = useState<string>(
    'Tech Horizon Global Corp • PO-8921'
  );
  const [isCopiedLink, setIsCopiedLink] = useState<boolean>(false);
  const [isSettlingFolio, setIsSettlingFolio] = useState<boolean>(false);

  const getBalanceDue = (stay: StayDetails): number => {
    const total = stay.total_amount || stay.total_nights * stay.nightly_rate;
    const deposit = stay.deposit_amount || 0;
    return Math.max(0, total - deposit);
  };

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
    const balance = getBalanceDue(stay);
    if (balance > 0.01 && stay.payment_status !== 'PAID') {
      // Zero-Balance departure protection: intercept with Folio Settlement!
      setSettlementStay(stay);
      setSettlementTender('CARD_ON_FILE');
      return;
    }

    const ok = window.confirm(
      `Confirm check-out for Room ${stay.room_number}? Folio is 100% settled ($0.00 balance). Room will transition to DIRTY.`
    );
    if (!ok) return;

    try {
      await onCheckOutStay(stay.id);
      showToast(`Guest checked out. Room ${stay.room_number} scheduled for housekeeping.`);
    } catch {
      alert('Check-out failed.');
    }
  };

  const handleConfirmSettlement = async () => {
    if (!settlementStay) return;
    setIsSettlingFolio(true);
    const balance = getBalanceDue(settlementStay);
    const totalAmount =
      settlementStay.total_amount ||
      settlementStay.total_nights * settlementStay.nightly_rate;
    const tenderLabel =
      settlementTender === 'CARD_ON_FILE'
        ? 'Pre-Auth Visa •••• 4242'
        : settlementTender === 'DIGITAL_LINK'
        ? 'Digital Mobile Pay Link (Apple Pay / QR)'
        : settlementTender === 'CITY_LEDGER'
        ? `City Ledger AR (${corporateAccountRef || 'Corporate'})`
        : 'Cash Reception Drawer';

    try {
      // 1. Update stay deposit in backend/memory
      await onUpdateStay(settlementStay.id, {
        deposit_amount: totalAmount,
        notes: `${settlementStay.notes || ''} [Folio Settled: $${balance.toFixed(2)} USD via ${tenderLabel}]`.trim(),
      });

      // 2. Complete check-out with settlement metadata
      await onCheckOutStay(settlementStay.id, {
        deposit_amount: totalAmount,
        payment_status: 'PAID',
        notes: `Folio Settled: $${balance.toFixed(2)} USD via ${tenderLabel}`,
      });

      showToast(
        `Folio settled ($${balance.toFixed(2)} USD via ${tenderLabel}). Room ${settlementStay.room_number} marked DIRTY.`
      );
      setSettlementStay(null);
    } catch {
      alert('Settlement failed. Please try again.');
    } finally {
      setIsSettlingFolio(false);
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
                        {getBalanceDue(stay) > 0.01 && stay.status !== 'CHECKED_OUT' && stay.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSettlementStay(stay);
                              setSettlementTender('CARD_ON_FILE');
                            }}
                            className="mt-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                            title="Click to settle outstanding folio balance"
                          >
                            <CreditCard className="w-3 h-3 text-amber-400" />
                            Due: ${getBalanceDue(stay).toFixed(2)} &bull; Settle
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-4">{getStatusBadge(stay.status)}</td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Settle Folio Quick Action for stays with balance due */}
                          {getBalanceDue(stay) > 0.01 && stay.status !== 'CHECKED_OUT' && stay.status !== 'CANCELLED' && (
                            <button
                              onClick={() => {
                                setSettlementStay(stay);
                                setSettlementTender('CARD_ON_FILE');
                              }}
                              title="Settle Folio Balance ($ Due)"
                              className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          )}

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

      {/* Folio Settlement & Zero-Balance Departure Modal */}
      {settlementStay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl relative text-left">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      Folio Settlement &amp; Billing
                    </h3>
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      Zero-Balance Policy
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Room {settlementStay.room_number} &bull; {settlementStay.guest_name} &bull; {settlementStay.category_name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSettlementStay(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Statement Card */}
            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 mb-5">
              <div className="grid grid-cols-3 gap-3 text-center pb-3 border-b border-slate-800/80">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Stay</span>
                  <p className="text-base font-bold text-white mt-0.5">
                    ${(settlementStay.total_amount || settlementStay.total_nights * settlementStay.nightly_rate).toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Deposits Paid</span>
                  <p className="text-base font-bold text-emerald-400 mt-0.5">
                    -${(settlementStay.deposit_amount || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-amber-500/10 rounded-xl p-1.5 border border-amber-500/20">
                  <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider">Outstanding Due</span>
                  <p className="text-lg font-black text-amber-400 mt-0.5">
                    ${getBalanceDue(settlementStay).toFixed(2)} USD
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                Departure requires settling all outstanding room charges in full. Choose payment tender below:
              </p>
            </div>

            {/* Tender Options */}
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select Payment Tender (Alternative Payment Methods)
            </label>

            <div className="space-y-2.5 mb-5 max-h-[300px] overflow-y-auto pr-1">
              {/* Option 1: Pre-Auth Card on file */}
              <button
                type="button"
                onClick={() => setSettlementTender('CARD_ON_FILE')}
                className={`w-full text-left p-3.5 rounded-2xl border text-xs transition-all flex items-start justify-between ${
                  settlementTender === 'CARD_ON_FILE'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-md'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-amber-400 mt-0.5">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">Pre-Authorized Card on File</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-emerald-500/30">
                        Visa &bull;&bull;&bull;&bull; 4242 (Hold Active)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Instant capture against tokenized card registered at check-in (PCI-DSS compliant).
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-400 mt-1 shrink-0">
                  ${getBalanceDue(settlementStay).toFixed(2)}
                </span>
              </button>

              {/* Option 2: Digital Payment Link / QR */}
              <button
                type="button"
                onClick={() => setSettlementTender('DIGITAL_LINK')}
                className={`w-full text-left p-3.5 rounded-2xl border text-xs transition-all flex items-start justify-between ${
                  settlementTender === 'DIGITAL_LINK'
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-md'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-cyan-400 mt-0.5">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">Digital Payment Link &amp; Mobile QR</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                        Apple Pay &bull; Google Pay &bull; Webhook
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Guest scans on mobile device or receives link via SMS/WhatsApp for instant authorization.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-cyan-400 mt-1 shrink-0">
                  ${getBalanceDue(settlementStay).toFixed(2)}
                </span>
              </button>

              {/* Drawer for Digital Link */}
              {settlementTender === 'DIGITAL_LINK' && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-cyan-500/30 text-xs space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">Generated Secure Checkout URL:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          `https://pay.hotelpremium.io/folio/${settlementStay.id}?due=${getBalanceDue(settlementStay)}`
                        );
                        setIsCopiedLink(true);
                        setTimeout(() => setIsCopiedLink(false), 2500);
                      }}
                      className="text-[10px] font-bold text-cyan-300 hover:text-white flex items-center gap-1 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-500/40 transition-colors"
                    >
                      {isCopiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {isCopiedLink ? 'Copied to Clipboard!' : 'Copy Payment Link'}
                    </button>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl font-mono text-[11px] text-slate-300 border border-slate-800 break-all select-all">
                    https://pay.hotelpremium.io/folio/{settlementStay.id}?due={getBalanceDue(settlementStay)}
                  </div>
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-400">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Direct SMS &amp; WhatsApp notification ready for {settlementStay.guest_phone || '+1 415 555 2671'}</span>
                  </div>
                </div>
              )}

              {/* Option 3: Corporate Account / City Ledger */}
              <button
                type="button"
                onClick={() => setSettlementTender('CITY_LEDGER')}
                className={`w-full text-left p-3.5 rounded-2xl border text-xs transition-all flex items-start justify-between ${
                  settlementTender === 'CITY_LEDGER'
                    ? 'bg-purple-500/10 border-purple-500 text-purple-300 shadow-md'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-purple-400 mt-0.5">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">Corporate City Ledger (Direct Billing)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30">
                        AR 30-Day Term Invoice
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Transfer outstanding folio to registered company corporate master account with B2B terms.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-purple-400 mt-1 shrink-0">
                  ${getBalanceDue(settlementStay).toFixed(2)}
                </span>
              </button>

              {settlementTender === 'CITY_LEDGER' && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-purple-500/30 text-xs space-y-1.5 animate-fade-in">
                  <label className="block text-[11px] font-semibold text-purple-300">
                    Corporate Master Account &bull; Client PO Reference:
                  </label>
                  <input
                    type="text"
                    value={corporateAccountRef}
                    onChange={(e) => setCorporateAccountRef(e.target.value)}
                    placeholder="e.g. Tech Horizon Global Corp • PO-8921"
                    className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* Option 4: Cash Reception Settlement */}
              <button
                type="button"
                onClick={() => setSettlementTender('CASH')}
                className={`w-full text-left p-3.5 rounded-2xl border text-xs transition-all flex items-start justify-between ${
                  settlementTender === 'CASH'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 shadow-md'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 mt-0.5">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white">Cash Reception Settlement</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                        Front Desk Cashier
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Guest provides physical cash currency at front desk; registered in daily cash shift.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400 mt-1 shrink-0">
                  ${getBalanceDue(settlementStay).toFixed(2)}
                </span>
              </button>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSettlementStay(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all"
              >
                Cancel Departure
              </button>

              <button
                type="button"
                disabled={isSettlingFolio}
                onClick={handleConfirmSettlement}
                className="px-5 py-2.5 text-xs font-bold rounded-xl text-slate-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4 text-slate-950" />
                <span>
                  {isSettlingFolio
                    ? 'Settling & Authorizing...'
                    : `Settle Folio ($${getBalanceDue(settlementStay).toFixed(2)}) & Check-Out`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
