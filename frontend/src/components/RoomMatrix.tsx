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
  { label: string; badgeClass: string; cardBorder: string; bgAccent: string }
> = {
  AVAILABLE: {
    label: 'Available',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cardBorder: 'hover:border-emerald-400',
    bgAccent: 'from-emerald-500/10 to-transparent',
  },
  OCCUPIED: {
    label: 'Occupied',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    cardBorder: 'hover:border-indigo-400',
    bgAccent: 'from-indigo-500/10 to-transparent',
  },
  DIRTY: {
    label: 'Dirty / Clean Req.',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    cardBorder: 'hover:border-amber-400',
    bgAccent: 'from-amber-500/10 to-transparent',
  },
  CLEANING: {
    label: 'In Cleaning',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    cardBorder: 'hover:border-amber-400',
    bgAccent: 'from-amber-500/10 to-transparent',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    cardBorder: 'hover:border-rose-400',
    bgAccent: 'from-rose-500/10 to-transparent',
  },
  BLOCKED: {
    label: 'Blocked',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    cardBorder: 'hover:border-slate-400',
    bgAccent: 'from-slate-500/10 to-transparent',
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 mb-8">
      {/* Filters & Search Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-5 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Front Desk Room Matrix</span>
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {filteredRooms.length} of {rooms.length} rooms
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Real-time room occupancy and housekeeping control</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Room or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-indigo-600 focus:border-indigo-600"
            />
          </div>

          {/* Floor filter */}
          <select
            value={filterFloor}
            onChange={(e) =>
              setFilterFloor(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
            }
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-indigo-600"
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
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-indigo-600"
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
        <div className="text-center py-12 text-slate-500 text-sm">
          No rooms match the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room) => {
            const config = statusConfig[room.status] || statusConfig.AVAILABLE;
            return (
              <div
                key={room.id}
                className={`group relative bg-white rounded-xl border border-slate-200 transition-all duration-200 shadow-xs hover:shadow-md ${config.cardBorder} flex flex-col justify-between overflow-hidden`}
              >
                {/* Photo Header Strip */}
                <div className="h-24 w-full relative overflow-hidden bg-slate-900">
                  <img
                    src={getRoomImageUrl(room)}
                    alt={`Room ${room.number}`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20" />
                  <span
                    className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border shadow-xs backdrop-blur-xs ${config.badgeClass}`}
                  >
                    {config.label}
                  </span>
                  <span className="absolute bottom-1.5 left-2.5 text-[11px] font-bold text-white drop-shadow-xs">
                    Floor {room.floor}
                  </span>
                </div>

                <div className="p-3.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xl font-bold tracking-tight text-slate-900">
                        {room.number}
                      </span>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {room.category_name}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        ${room.base_price.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-slate-400">/ night</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{room.capacity} Guests</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BedDouble className="w-3.5 h-3.5 text-slate-400" />
                      <span>Floor {room.floor}</span>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
                  {room.status === 'AVAILABLE' && (
                    <button
                      type="button"
                      onClick={() => onCheckInClick(room)}
                      className="w-full inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                      Check-In
                    </button>
                  )}

                  {room.status === 'OCCUPIED' && (
                    <button
                      type="button"
                      onClick={() => onCheckOutClick(room)}
                      className="w-full inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-xs"
                    >
                      <LogOut className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                      Folio & Check-Out
                    </button>
                  )}

                  {(room.status === 'DIRTY' || room.status === 'CLEANING') && (
                    <button
                      type="button"
                      onClick={() => onMarkCleanedClick(room)}
                      className="w-full inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Mark Cleaned
                    </button>
                  )}

                  {room.status === 'MAINTENANCE' && (
                    <button
                      type="button"
                      onClick={() => onMarkCleanedClick(room)}
                      className="w-full inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors"
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
