import React, { useState } from 'react';
import { Room, RoomStatus } from '../types/hotel';
import { getRoomImageUrl } from '../services/api';
import {
  BedDouble,
  UserPlus,
  LogOut,
  Sparkles,
  Users,
  Search,
  CheckCircle,
  SlidersHorizontal,
  Wrench,
  ShieldAlert,
  Clock,
  AlertTriangle,
  X,
  ChevronRight,
} from 'lucide-react';

interface RoomMatrixProps {
  rooms: Room[];
  onCheckInClick: (room: Room) => void;
  onCheckOutClick: (room: Room) => void;
  onMarkCleanedClick: (room: Room) => void;
  onUpdateStatus?: (room: Room, newStatus: RoomStatus, reason?: string) => Promise<void> | void;
}

const statusConfig: Record<
  RoomStatus,
  { label: string; badgeClass: string; cardBorder: string; pulseColor: string }
> = {
  AVAILABLE: {
    label: 'Available',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    cardBorder: 'hover:border-emerald-500/40',
    pulseColor: 'bg-emerald-400',
  },
  OCCUPIED: {
    label: 'Occupied',
    badgeClass: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    cardBorder: 'hover:border-indigo-500/40',
    pulseColor: 'bg-indigo-400',
  },
  DIRTY: {
    label: 'Dirty / Clean Req.',
    badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    cardBorder: 'hover:border-amber-500/40',
    pulseColor: 'bg-amber-400',
  },
  CLEANING: {
    label: 'In Cleaning',
    badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    cardBorder: 'hover:border-cyan-500/40',
    pulseColor: 'bg-cyan-400',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    cardBorder: 'hover:border-rose-500/40',
    pulseColor: 'bg-rose-400',
  },
  BLOCKED: {
    label: 'Blocked / OOS',
    badgeClass: 'bg-slate-700/40 text-slate-300 border-slate-600',
    cardBorder: 'hover:border-slate-500',
    pulseColor: 'bg-slate-400',
  },
};

const STATUS_OPTIONS: {
  status: RoomStatus;
  label: string;
  category: string;
  description: string;
  colorClass: string;
}[] = [
  {
    status: 'AVAILABLE',
    label: 'Available for Guests',
    category: 'Operational',
    description: 'Cleaned, inspected and ready for immediate check-in.',
    colorClass: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  },
  {
    status: 'CLEANING',
    label: 'Turnover in Progress (Housekeeping)',
    category: 'Housekeeping',
    description: 'Housekeeper is actively servicing and preparing the suite.',
    colorClass: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
  },
  {
    status: 'DIRTY',
    label: 'Dirty / Clean Required',
    category: 'Housekeeping',
    description: 'Guest departed or daily turnover needed; queued for cleaning.',
    colorClass: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  },
  {
    status: 'MAINTENANCE',
    label: 'Maintenance (Out of Order - OOO)',
    category: 'Engineering',
    description: 'Physical defect/damage identified; deducted from sales inventory.',
    colorClass: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
  },
  {
    status: 'BLOCKED',
    label: 'Blocked / Out of Service (OOS)',
    category: 'Front Desk',
    description: 'Administrative hold for VIP arrival, deep ozonation or staging.',
    colorClass: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
  },
];

const PRESET_REASONS: Record<RoomStatus, string[]> = {
  MAINTENANCE: [
    'AC & Climate control malfunction',
    'Plumbing / Jacuzzi water leak',
    'Electrical / Smart TV acoustic issue',
    'Balcony door lock mechanism repair',
    'Curtain motorization defect',
  ],
  BLOCKED: [
    'VIP Diplomat Arrival Hold & Gift Setup',
    'Deep Medical-Grade Ozone Sanitization',
    'Annual Quality Inspection Audit',
    'Private Event Suite Reservation',
  ],
  DIRTY: [
    'Guest check-out completed',
    'Scheduled daily linen turnover',
    'Post-maintenance cleanup required',
  ],
  CLEANING: [
    'Housekeeping team assigned and on-site',
    'Express priority turnover for early arrival',
  ],
  AVAILABLE: [
    'Supervised inspection passed (100% Quality Score)',
    'Maintenance work order verified and closed',
  ],
  OCCUPIED: [],
};

const getTurnoverMinutes = (updatedAt?: string): number => {
  if (!updatedAt) return 0;
  const elapsedMs = Math.max(0, Date.now() - new Date(updatedAt).getTime());
  return Math.floor(elapsedMs / (60 * 1000));
};

export const RoomMatrix: React.FC<RoomMatrixProps> = ({
  rooms,
  onCheckInClick,
  onCheckOutClick,
  onMarkCleanedClick,
  onUpdateStatus,
}) => {
  const [filterFloor, setFilterFloor] = useState<number | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Operational Status Transition Modal state
  const [statusModalRoom, setStatusModalRoom] = useState<Room | null>(null);
  const [selectedTargetStatus, setSelectedTargetStatus] = useState<RoomStatus>('MAINTENANCE');
  const [statusReason, setStatusReason] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);

  const filteredRooms = rooms.filter((r) => {
    if (filterFloor !== 'ALL' && r.floor !== filterFloor) return false;
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        r.number.toLowerCase().includes(q) ||
        r.category_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleOpenStatusModal = (room: Room) => {
    setStatusModalRoom(room);
    if (room.status === 'DIRTY' || room.status === 'CLEANING') {
      setSelectedTargetStatus('MAINTENANCE');
    } else if (room.status === 'MAINTENANCE') {
      setSelectedTargetStatus('DIRTY');
    } else if (room.status === 'AVAILABLE') {
      setSelectedTargetStatus('MAINTENANCE');
    } else {
      setSelectedTargetStatus('BLOCKED');
    }
    setStatusReason(room.notes || '');
  };

  const handleApplyStatusTransition = async () => {
    if (!statusModalRoom || !onUpdateStatus) return;
    if (statusModalRoom.status === 'OCCUPIED') {
      const confirmOverride = window.confirm(
        `Suite ${statusModalRoom.number} is currently OCCUPIED by an active guest. Are you sure you want to override the operational room status?`
      );
      if (!confirmOverride) return;
    }

    setIsUpdatingStatus(true);
    try {
      await onUpdateStatus(
        statusModalRoom,
        selectedTargetStatus,
        statusReason.trim() || undefined
      );
      setStatusModalRoom(null);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-8 mb-8">
      {/* Filters & Search Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <span className="font-serif-luxury">Front Desk Room Matrix</span>
            <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              {filteredRooms.length} of {rooms.length} rooms
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time room occupancy, housekeeping SLA control & maintenance escalation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search box */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Room or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Floor filter */}
          <select
            value={filterFloor}
            onChange={(e) =>
              setFilterFloor(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
            }
            className="px-3 py-1.5 text-xs border border-slate-800 rounded-xl bg-slate-950/80 text-slate-300 focus:outline-none focus:border-amber-500 transition-colors"
          >
            <option value="ALL">All Floors</option>
            {floors.map((f) => (
              <option key={f} value={f}>
                Floor {f}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as RoomStatus | 'ALL')}
            className="px-3 py-1.5 text-xs border border-slate-800 rounded-xl bg-slate-950/80 text-slate-300 focus:outline-none focus:border-amber-500 transition-colors"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="DIRTY">Dirty / Housekeeping Req.</option>
            <option value="CLEANING">In Cleaning</option>
            <option value="MAINTENANCE">Maintenance (OOO)</option>
            <option value="BLOCKED">Blocked (OOS)</option>
          </select>
        </div>
      </div>

      {/* Grid of Room Cards */}
      {filteredRooms.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          No rooms match the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          {filteredRooms.map((room) => {
            const config = statusConfig[room.status] || statusConfig.AVAILABLE;
            const turnoverMin = getTurnoverMinutes(room.updated_at);
            return (
              <div
                key={room.id}
                className={`group relative bg-slate-950/70 rounded-2xl border border-slate-800/90 transition-all duration-300 shadow-lg hover:shadow-2xl ${config.cardBorder} flex flex-col justify-between overflow-hidden`}
              >
                {/* Photo Header Strip */}
                <div className="h-28 w-full relative overflow-hidden bg-slate-900">
                  <img
                    src={getRoomImageUrl(room)}
                    alt={`Room ${room.number}`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-black/30" />

                  {/* Status Badge with Pulse */}
                  <span
                    className={`absolute top-2.5 right-2.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-md backdrop-blur-md flex items-center space-x-1.5 ${config.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${config.pulseColor} animate-pulse`} />
                    <span>{config.label}</span>
                  </span>

                  <span className="absolute bottom-2 left-3 text-[11px] font-bold text-amber-300 drop-shadow-md bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800">
                    Floor {room.floor}
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-serif-luxury text-2xl font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors">
                        {room.number}
                      </span>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {room.category_name}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-base font-bold text-white tracking-tight">
                        ${room.base_price.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-slate-400">/ night</p>
                    </div>
                  </div>

                  {/* Operational Indicators: Housekeeping SLA & Notes */}
                  {(room.status === 'DIRTY' || room.status === 'CLEANING') && (
                    <div className="flex items-center space-x-1.5 text-[10px] font-semibold text-slate-400 mt-2.5 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800">
                      <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Turnover: {turnoverMin}m</span>
                      {turnoverMin > 45 && (
                        <span className="text-rose-400 font-bold ml-auto flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" /> SLA Breach
                        </span>
                      )}
                    </div>
                  )}

                  {room.status === 'MAINTENANCE' && room.notes && (
                    <div className="flex items-center space-x-1.5 text-[10px] font-medium text-rose-300 mt-2.5 bg-rose-950/30 px-2 py-1 rounded-lg border border-rose-900/40 truncate">
                      <Wrench className="w-3 h-3 text-rose-400 shrink-0" />
                      <span className="truncate">{room.notes}</span>
                    </div>
                  )}

                  {room.status === 'BLOCKED' && room.notes && (
                    <div className="flex items-center space-x-1.5 text-[10px] font-medium text-purple-300 mt-2.5 bg-purple-950/30 px-2 py-1 rounded-lg border border-purple-900/40 truncate">
                      <ShieldAlert className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="truncate">{room.notes}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-4 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>{room.capacity} Guests</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <BedDouble className="w-3.5 h-3.5 text-amber-400" />
                      <span>Floor {room.floor}</span>
                    </div>
                  </div>
                </div>

                {/* Action Footer: Primary Action + Contextual Status Sliders Menu */}
                <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex-1">
                    {room.status === 'AVAILABLE' && (
                      <button
                        type="button"
                        onClick={() => onCheckInClick(room)}
                        className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-bold rounded-xl text-slate-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 transition-all shadow-md shadow-amber-500/20"
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1.5 text-slate-950" />
                        Check-In
                      </button>
                    )}

                    {room.status === 'OCCUPIED' && (
                      <button
                        type="button"
                        onClick={() => onCheckOutClick(room)}
                        className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-xl text-slate-200 bg-slate-800/80 border border-slate-700/80 hover:bg-slate-800 hover:text-white transition-all shadow-xs"
                      >
                        <LogOut className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        Folio & Check-Out
                      </button>
                    )}

                    {(room.status === 'DIRTY' || room.status === 'CLEANING') && (
                      <button
                        type="button"
                        onClick={() => onMarkCleanedClick(room)}
                        className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-bold rounded-xl text-emerald-300 bg-emerald-950/50 border border-emerald-500/40 hover:bg-emerald-900/50 transition-all shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                        Mark Cleaned
                      </button>
                    )}

                    {room.status === 'MAINTENANCE' && (
                      <button
                        type="button"
                        onClick={() => onMarkCleanedClick(room)}
                        className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all"
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        Finish Maintenance
                      </button>
                    )}

                    {room.status === 'BLOCKED' && (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus?.(room, 'AVAILABLE', 'Unblocked from Room Matrix')}
                        className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-xl text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all shadow-xs"
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                        Unblock Suite
                      </button>
                    )}
                  </div>

                  {/* Operational Override Menu Button */}
                  {onUpdateStatus && (
                    <button
                      type="button"
                      aria-label={`Change Status for Room ${room.number}`}
                      onClick={() => handleOpenStatusModal(room)}
                      className="p-2 text-slate-400 hover:text-amber-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-xl transition-all shadow-xs"
                      title="Override Operational Status (Maintenance / Cleaning / Blocked)"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Operational Status Transition Modal */}
      {statusModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Change Suite Status
                  </h3>
                  <p className="text-xs text-slate-400">
                    Suite {statusModalRoom.number} &bull; {statusModalRoom.category_name} (Floor {statusModalRoom.floor})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStatusModalRoom(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Status Pill */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 mb-4 text-xs">
              <span className="text-slate-400">Current Status:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                  statusConfig[statusModalRoom.status].badgeClass
                }`}
              >
                {statusConfig[statusModalRoom.status].label}
              </span>
            </div>

            {/* Warning if Occupied */}
            {statusModalRoom.status === 'OCCUPIED' && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Active Guest Alert:</strong> Suite {statusModalRoom.number} is occupied. Changing status directly will override PMS occupancy. Standard procedure is completing Check-Out in Reservations.
                </span>
              </div>
            )}

            {/* Target Status Selection */}
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Select New Operational Status
            </label>
            <div className="space-y-2 mb-4">
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = selectedTargetStatus === opt.status;
                const isCurrent = statusModalRoom.status === opt.status;
                return (
                  <button
                    key={opt.status}
                    type="button"
                    onClick={() => {
                      setSelectedTargetStatus(opt.status);
                      if (PRESET_REASONS[opt.status].length > 0) {
                        setStatusReason(PRESET_REASONS[opt.status][0]);
                      }
                    }}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start justify-between ${
                      isSelected
                        ? `${opt.colorClass} border-amber-500 shadow-md`
                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold">{opt.label}</span>
                        {isCurrent && (
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{opt.description}</p>
                    </div>
                    {isSelected && <ChevronRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>

            {/* Preset Reasons (if Maintenance, Blocked, or Dirty) */}
            {PRESET_REASONS[selectedTargetStatus].length > 0 && (
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Preset Operational Reasons (Click to assign)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_REASONS[selectedTargetStatus].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStatusReason(preset)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
                        statusReason === preset
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reason / Work Order Input */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Work Order / Transition Notes
              </label>
              <input
                type="text"
                placeholder="Optional reason for change (e.g. AC malfunction, deep cleaning)..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStatusModalRoom(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white bg-slate-800/80 border border-slate-700/80 hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={handleApplyStatusTransition}
                className="px-5 py-2 text-xs font-bold rounded-xl text-slate-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                {isUpdatingStatus ? 'Updating Status...' : 'Confirm Status Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
