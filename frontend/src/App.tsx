import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, ActiveAppView } from './components/Navbar';
import { StatsOverview } from './components/StatsOverview';
import { RoomMatrix } from './components/RoomMatrix';
import { QuickCheckInModal } from './components/QuickCheckInModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { GuestShowcase } from './components/GuestShowcase';
import { GuestBookingModal } from './components/GuestBookingModal';
import { GuestComparisonModal } from './components/GuestComparisonModal';
import { ReservationsManager } from './components/ReservationsManager';
import {
  Room,
  RoomStatus,
  CheckInFormData,
  CurrentUser,
  GuestBookingRequest,
  StayDetails,
  CreateStayDTO,
  UpdateStayDTO,
} from './types/hotel';
import {
  fetchRooms,
  fetchStays,
  createStay,
  updateStay,
  cancelStay,
  checkOutStay,
  updateRoomStatus,
  updateRoomPrice,
  subscribeToLiveEvents,
} from './services/api';
import { CheckCircle2, DollarSign, ExternalLink, ShieldCheck } from 'lucide-react';

const ADMIN_USER: CurrentUser = {
  username: 'admin_user',
  fullName: 'Administrator',
  role: 'ADMIN',
  email: 'admin@hotelpremium.com',
};

const BASIC_USER: CurrentUser = {
  username: 'basic_user',
  fullName: 'Front Desk Operator',
  role: 'USER',
  email: 'reception@hotelpremium.com',
};

export const App: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stays, setStays] = useState<StayDetails[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<ActiveAppView>('RESERVATIONS');
  const [selectedRoomForCheckIn, setSelectedRoomForCheckIn] = useState<Room | null>(null);
  const [guestBookingRoom, setGuestBookingRoom] = useState<Room | null>(null);
  const [comparingRooms, setComparingRooms] = useState<Room[] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(BASIC_USER);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [roomsData, staysData] = await Promise.all([
        fetchRooms(),
        fetchStays(),
      ]);
      // Reconcile room status with active stays if needed
      const reconciledRooms = roomsData.map((room) => {
        const hasActiveStay = staysData.some(
          (s) => (s.room_id === room.id || s.room_number === room.number) && s.status === 'ACTIVE'
        );
        if (hasActiveStay && room.status === 'AVAILABLE') {
          return { ...room, status: 'OCCUPIED' as RoomStatus };
        }
        return room;
      });
      setRooms(reconciledRooms);
      setStays(staysData);
    } catch (err) {
      console.warn('Initial load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Real-Time Server-Sent Events (SSE) listener
    const unsubscribe = subscribeToLiveEvents((eventType, data) => {
      if (eventType === 'room_updated' && data?.room_id) {
        setRooms((prev) =>
          prev.map((r) => (r.id === data.room_id ? { ...r, status: data.status } : r))
        );
        showToast(`Real-time update: Room status synchronized (${data.status})`);
      } else if (eventType === 'stay_created' && data?.id) {
        setStays((prev) => [data, ...prev.filter((s) => s.id !== data.id)]);
        showToast(`Real-time update: VIP reservation confirmed for ${data.guest_name}`);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleToggleRole = () => {
    if (currentUser.role === 'ADMIN') {
      setCurrentUser(BASIC_USER);
      showToast('Switched to basic_user role (Front Desk & Reservations mode)');
    } else {
      setCurrentUser(ADMIN_USER);
      showToast('Switched to admin_user role (Full Management Access)');
    }
  };

  const handleUpdateBasePrice = async (roomId: string, newPrice: number) => {
    await updateRoomPrice(roomId, newPrice);
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, base_price: newPrice } : r))
    );
    showToast(`Base rate updated to $${newPrice.toFixed(2)} USD!`);
  };

  // Check-In from staff modal
  const handleCheckInSubmit = async (formData: CheckInFormData) => {
    const checkInDate = new Date();
    const checkOutDate = new Date(Date.now() + formData.nights * 86400000);

    const created = await createStay({
      room_id: formData.roomId,
      guest_name: formData.guestName,
      guest_email: formData.email,
      guest_phone: formData.phone,
      document_type: formData.documentType,
      document_number: formData.documentNumber,
      check_in_date: checkInDate.toISOString(),
      check_out_date: checkOutDate.toISOString(),
      total_nights: formData.nights,
      nightly_rate: formData.nightlyRate,
      deposit_amount: formData.deposit,
      notes: formData.notes,
      status: 'ACTIVE',
    });

    setStays((prev) => [created, ...prev]);
    await updateRoomStatus(formData.roomId, 'OCCUPIED');
    setRooms((prev) =>
      prev.map((r) => (r.id === formData.roomId ? { ...r, status: 'OCCUPIED' } : r))
    );

    setSelectedRoomForCheckIn(null);
    showToast(`Successfully checked in ${formData.guestName} to Suite!`);
  };

  // Guest luxury booking portal confirmation
  const handleGuestBookingConfirm = async (req: GuestBookingRequest) => {
    const created = await createStay({
      room_id: req.roomId,
      guest_name: req.guestName,
      guest_email: req.guestEmail,
      guest_phone: req.guestPhone,
      document_type: 'PASSPORT',
      document_number: `WEB-${Math.floor(100000 + Math.random() * 900000)}`,
      check_in_date: req.checkInDate,
      check_out_date: req.checkOutDate,
      total_nights: req.totalNights,
      nightly_rate: req.roomSubtotalUSD / req.totalNights,
      deposit_amount: req.grandTotalUSD,
      notes: req.specialRequests,
      status: 'RESERVED',
    });

    setStays((prev) => [created, ...prev]);
    showToast(`VIP Reservation Confirmed for ${req.guestName}! Room booked.`);
  };

  // Manual Check-Out from Matrix
  const handleCheckOut = async (room: Room) => {
    const confirm = window.confirm(
      `Confirm check-out for Room ${room.number}? Room will be marked for cleaning.`
    );
    if (!confirm) return;

    // Find active stay for this room if any
    const activeStay = stays.find(
      (s) => (s.room_id === room.id || s.room_number === room.number) && s.status === 'ACTIVE'
    );
    if (activeStay) {
      await checkOutStay(activeStay.id);
      setStays((prev) =>
        prev.map((s) => (s.id === activeStay.id ? { ...s, status: 'CHECKED_OUT' } : s))
      );
    }
    await updateRoomStatus(room.id, 'DIRTY');

    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, status: 'DIRTY' } : r))
    );
    showToast(`Room ${room.number} checked out and marked DIRTY for housekeeping.`);
  };

  // Mark room as cleaned
  const handleMarkCleaned = async (room: Room) => {
    await updateRoomStatus(room.id, 'AVAILABLE');
    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, status: 'AVAILABLE' } : r))
    );
    showToast(`Room ${room.number} cleaned and ready for guests.`);
  };

  // Arbitrary Operational Room Status Override (Maintenance, Cleaning, Blocked, etc.)
  const handleUpdateRoomStatus = async (
    room: Room,
    newStatus: RoomStatus,
    reason?: string
  ) => {
    await updateRoomStatus(room.id, newStatus);
    setRooms((prev) =>
      prev.map((r) =>
        r.id === room.id
          ? {
              ...r,
              status: newStatus,
              notes: reason ? reason : r.notes,
              updated_at: new Date().toISOString(),
            }
          : r
      )
    );
    showToast(
      `Room ${room.number} transitioned to ${newStatus}${reason ? `: ${reason}` : ''}`
    );
  };

  // Reservations Manager Handlers
  const handleCreateStayFromManager = async (dto: CreateStayDTO) => {
    const created = await createStay(dto);
    setStays((prev) => [created, ...prev]);
    if (dto.status === 'ACTIVE') {
      const matchingRoom = rooms.find(
        (r) => r.id === dto.room_id || r.number === created.room_number
      );
      if (matchingRoom) {
        await updateRoomStatus(matchingRoom.id, 'OCCUPIED');
        setRooms((prev) =>
          prev.map((r) => (r.id === matchingRoom.id ? { ...r, status: 'OCCUPIED' } : r))
        );
      }
    }
  };

  const handleUpdateStayFromManager = async (id: string, dto: UpdateStayDTO) => {
    const updated = await updateStay(id, dto);
    setStays((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const handleCancelStayFromManager = async (id: string) => {
    await cancelStay(id);
    const target = stays.find((s) => s.id === id);
    if (target && target.status === 'ACTIVE') {
      const matchingRoom = rooms.find(
        (r) => r.id === target.room_id || r.number === target.room_number
      );
      if (matchingRoom) {
        await updateRoomStatus(matchingRoom.id, 'AVAILABLE');
        setRooms((prev) =>
          prev.map((r) => (r.id === matchingRoom.id ? { ...r, status: 'AVAILABLE' } : r))
        );
      }
    }
    setStays((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'CANCELLED' } : s))
    );
  };

  const handleCheckOutStayFromManager = async (
    id: string,
    settlement?: { deposit_amount: number; payment_status: 'PAID'; notes?: string }
  ) => {
    await checkOutStay(id);
    const target = stays.find((s) => s.id === id);
    if (target) {
      const matchingRoom = rooms.find(
        (r) => r.id === target.room_id || r.number === target.room_number
      );
      if (matchingRoom) {
        await updateRoomStatus(matchingRoom.id, 'DIRTY');
        setRooms((prev) =>
          prev.map((r) => (r.id === matchingRoom.id ? { ...r, status: 'DIRTY' } : r))
        );
      }
    }
    setStays((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: 'CHECKED_OUT',
              deposit_amount: settlement?.deposit_amount ?? s.deposit_amount,
              payment_status: settlement?.payment_status ?? s.payment_status,
              notes: settlement?.notes
                ? `${s.notes || ''} [Folio Settled: ${settlement.notes}]`.trim()
                : s.notes,
            }
          : s
      )
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative antialiased selection:bg-amber-500/30 selection:text-amber-200">
      {/* Ambient Glow Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
      </div>

      <Navbar
        onRefresh={loadData}
        isLoading={isLoading}
        currentUser={currentUser}
        onToggleRole={handleToggleRole}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
        activeView={activeView}
        onViewChange={(view) => setActiveView(view)}
      />

      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 text-xs border border-amber-500/30 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'GUEST_PORTAL' ? (
          /* ================= GUEST LUXURY BOOKING VIEW ================= */
          <GuestShowcase
            rooms={rooms}
            onBookRoom={(room) => setGuestBookingRoom(room)}
            onOpenCompare={(selected) => setComparingRooms(selected)}
          />
        ) : activeView === 'RESERVATIONS' ? (
          /* ================= RESERVATIONS & BOOKINGS VIEW ================= */
          <ReservationsManager
            stays={stays}
            rooms={rooms}
            currentUser={currentUser}
            onRefreshStays={loadData}
            onCreateStay={handleCreateStayFromManager}
            onUpdateStay={handleUpdateStayFromManager}
            onCancelStay={handleCancelStayFromManager}
            onCheckOutStay={handleCheckOutStayFromManager}
            showToast={showToast}
          />
        ) : (
          /* ================= STAFF FRONT DESK (ROOM MATRIX) VIEW ================= */
          <div className="space-y-6">
            {/* Role Banner Indicator */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xl">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2.5 rounded-xl text-slate-950 font-black text-xs ${
                    currentUser.role === 'ADMIN' ? 'bg-amber-400 shadow-md shadow-amber-400/20' : 'bg-emerald-400 shadow-md shadow-emerald-400/20'
                  }`}
                >
                  {currentUser.role}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Logged in as <span className="underline decoration-amber-500 text-amber-300">{currentUser.username}</span> ({currentUser.email})
                  </p>
                  <p className="text-xs text-slate-400">
                    {currentUser.role === 'ADMIN'
                      ? 'Full administrative control: Rates, Cash register audit, User roles & Analytics'
                      : 'Front desk reception: View rooms, create new reservations, edit stays, and cancel bookings'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={handleToggleRole}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 font-semibold hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  Switch to {currentUser.role === 'ADMIN' ? 'basic_user' : 'admin_user'}
                </button>
              </div>
            </div>

            {/* Module Sub-Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white font-serif-luxury">
                  Front Desk &amp; Room Rack Operations
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time physical status &bull; Clean Architecture &bull; Kong Gateway &bull; Keycloak 26.8 &bull; Redis 8
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <a
                  href="http://localhost:3000/d/hotel-business-kpis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all shadow-xs"
                >
                  <span>Business KPIs ($ USD)</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-emerald-400" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    if (currentUser.role !== 'ADMIN') {
                      alert('Cash Shift closure is restricted to admin_user in Keycloak policy.');
                      return;
                    }
                    setIsAdminPanelOpen(true);
                  }}
                  className={`inline-flex items-center px-3.5 py-2 text-xs font-bold rounded-xl shadow-md transition-all ${
                    currentUser.role === 'ADMIN'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:brightness-110 shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <DollarSign className="w-4 h-4 mr-1.5" />
                  Cash Register (Caja)
                </button>
              </div>
            </div>

            {/* Operational Rack Status */}
            <StatsOverview rooms={rooms} />

            {/* Live Interactive Room Matrix */}
            <RoomMatrix
              rooms={rooms}
              onCheckInClick={(room) => setSelectedRoomForCheckIn(room)}
              onCheckOutClick={handleCheckOut}
              onMarkCleanedClick={handleMarkCleaned}
              onUpdateStatus={handleUpdateRoomStatus}
            />
          </div>
        )}
      </main>

      {/* Guest Booking Flow Modal */}
      {guestBookingRoom && (
        <GuestBookingModal
          room={guestBookingRoom}
          onClose={() => setGuestBookingRoom(null)}
          onConfirmBooking={handleGuestBookingConfirm}
        />
      )}

      {/* Guest Room Comparison Modal */}
      {comparingRooms && (
        <GuestComparisonModal
          rooms={comparingRooms}
          onClose={() => setComparingRooms(null)}
          onSelectRoom={(room) => {
            setComparingRooms(null);
            setGuestBookingRoom(room);
          }}
        />
      )}

      {/* Staff Quick Check-In Modal */}
      {selectedRoomForCheckIn && (
        <QuickCheckInModal
          room={selectedRoomForCheckIn}
          onClose={() => setSelectedRoomForCheckIn(null)}
          onSubmit={handleCheckInSubmit}
        />
      )}

      {/* Staff Admin Panel Modal (Restricted to ADMIN) */}
      {isAdminPanelOpen && (
        <AdminPanelModal
          rooms={rooms}
          onClose={() => setIsAdminPanelOpen(false)}
          onUpdateBasePrice={handleUpdateBasePrice}
        />
      )}

      {/* Enterprise Footer */}
      <footer className="bg-slate-900/60 border-t border-slate-800/80 py-6 text-center text-xs text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">Hotel Premium v2.0 &bull; Enterprise Hospitality Platform</span>
          </div>
          <div className="flex flex-wrap items-center justify-center space-x-3 text-[11px] text-slate-400">
            <span>Kong Gateway 3.9.4 (DB-less)</span>
            <span>&bull;</span>
            <span>Kafka 8.3.2 (KRaft)</span>
            <span>&bull;</span>
            <span>Keycloak 26.8.1</span>
            <span>&bull;</span>
            <span>Redis 8.8.1-Alpine</span>
            <span>&bull;</span>
            <span>PostgreSQL 18</span>
            <span>&bull;</span>
            <span>Grafana Alloy 1.21 (OTel)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
