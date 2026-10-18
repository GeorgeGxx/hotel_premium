import React from 'react';
import { Room } from '../types/hotel';
import { BedDouble, CheckCircle2, AlertTriangle, Sparkles, Wrench } from 'lucide-react';

interface StatsOverviewProps {
  rooms: Room[];
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ rooms }) => {
  const total = rooms.length;
  const available = rooms.filter((r) => r.status === 'AVAILABLE').length;
  const occupied = rooms.filter((r) => r.status === 'OCCUPIED').length;
  const dirty = rooms.filter((r) => r.status === 'DIRTY' || r.status === 'CLEANING').length;
  const maintenance = rooms.filter((r) => r.status === 'MAINTENANCE' || r.status === 'BLOCKED').length;

  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Rooms</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Across all floors</p>
        </div>
        <div className="p-2.5 bg-slate-100 rounded-lg text-slate-600">
          <BedDouble className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Available</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{available}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Ready for guest</p>
        </div>
        <div className="p-2.5 bg-emerald-100 rounded-lg text-emerald-700">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Occupied</p>
          <p className="text-2xl font-bold text-indigo-900 mt-1">{occupied}</p>
          <p className="text-[11px] text-indigo-600 mt-0.5">{occupancyRate}% occupancy</p>
        </div>
        <div className="p-2.5 bg-indigo-100 rounded-lg text-indigo-700">
          <BedDouble className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Housekeeping</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{dirty}</p>
          <p className="text-[11px] text-amber-600 mt-0.5">Cleaning required</p>
        </div>
        <div className="p-2.5 bg-amber-100 rounded-lg text-amber-700">
          <Sparkles className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
        <div>
          <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Maintenance</p>
          <p className="text-2xl font-bold text-rose-900 mt-1">{maintenance}</p>
          <p className="text-[11px] text-rose-600 mt-0.5">Out of service</p>
        </div>
        <div className="p-2.5 bg-rose-100 rounded-lg text-rose-700">
          {maintenance > 0 ? <AlertTriangle className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
        </div>
      </div>
    </div>
  );
};
