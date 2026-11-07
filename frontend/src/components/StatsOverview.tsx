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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
      {/* Total Rooms */}
      <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-lg flex items-center justify-between hover:border-slate-700 transition-all">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Rooms</p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">{total}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Across all floors</p>
        </div>
        <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-xl text-slate-300">
          <BedDouble className="w-5 h-5 text-amber-400" />
        </div>
      </div>

      {/* Available */}
      <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/20 to-transparent shadow-lg flex items-center justify-between hover:border-emerald-600/40 transition-all">
        <div>
          <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Available</p>
          <p className="text-2xl font-black text-emerald-300 mt-1 tracking-tight">{available}</p>
          <p className="text-[11px] text-emerald-500 mt-0.5">Ready for guests</p>
        </div>
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/50 rounded-xl text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      {/* Occupied */}
      <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-indigo-900/40 bg-gradient-to-br from-indigo-950/20 to-transparent shadow-lg flex items-center justify-between hover:border-indigo-600/40 transition-all">
        <div>
          <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Occupied</p>
          <p className="text-2xl font-black text-indigo-300 mt-1 tracking-tight">{occupied}</p>
          <p className="text-[11px] text-indigo-400 mt-0.5">{occupancyRate}% occupancy</p>
        </div>
        <div className="p-3 bg-indigo-950/60 border border-indigo-800/50 rounded-xl text-indigo-400">
          <BedDouble className="w-5 h-5" />
        </div>
      </div>

      {/* Housekeeping */}
      <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-amber-900/40 bg-gradient-to-br from-amber-950/20 to-transparent shadow-lg flex items-center justify-between hover:border-amber-600/40 transition-all">
        <div>
          <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Housekeeping</p>
          <p className="text-2xl font-black text-amber-300 mt-1 tracking-tight">{dirty}</p>
          <p className="text-[11px] text-amber-500 mt-0.5">Cleaning required</p>
        </div>
        <div className="p-3 bg-amber-950/60 border border-amber-800/50 rounded-xl text-amber-400">
          <Sparkles className="w-5 h-5" />
        </div>
      </div>

      {/* Maintenance */}
      <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-rose-900/40 bg-gradient-to-br from-rose-950/20 to-transparent shadow-lg flex items-center justify-between col-span-2 sm:col-span-1 hover:border-rose-600/40 transition-all">
        <div>
          <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Maintenance</p>
          <p className="text-2xl font-black text-rose-300 mt-1 tracking-tight">{maintenance}</p>
          <p className="text-[11px] text-rose-500 mt-0.5">Out of service</p>
        </div>
        <div className="p-3 bg-rose-950/60 border border-rose-800/50 rounded-xl text-rose-400">
          {maintenance > 0 ? <AlertTriangle className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
        </div>
      </div>
    </div>
  );
};
