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
} from 'lucide-react';

interface RoomMatrixProps {
  rooms: Room[];
  onCheckInClick: (room: Room) => void;
  onCheckOutClick: (room: Room) => void;
  onMarkCleanedClick: (room: Room) => void;
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
    badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    cardBorder: 'hover:border-amber-500/40',
    pulseColor: 'bg-amber-400',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    cardBorder: 'hover:border-rose-500/40',
    pulseColor: 'bg-rose-400',
  },
  BLOCKED: {
    label: 'Blocked',
    badgeClass: 'bg-slate-700/40 text-slate-300 border-slate-600',
    cardBorder: 'hover:border-slate-500',
    pulseColor: 'bg-slate-400',
  },
};

export const RoomMatrix: React.FC<RoomMatrixProps> = ({
  rooms,
  onCheckInClick,
  onCheckOutClick,
  onMarkCleanedClick,
}) => {
  const [filterFloor, setFilterFloor] = useState<number | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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
          <p className="text-xs text-slate-400 mt-1">Real-time room occupancy and housekeeping control</p>
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
            <option value="DIRTY">Dirty / Cleaning</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>
      </div>

      {/* Grid of Room Cards */}
      {filteredRooms.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          No rooms match the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room) => {
            const config = statusConfig[room.status] || statusConfig.AVAILABLE;
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

                {/* Action Footer */}
                <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-end space-x-2">
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
