import React, { useState } from 'react';
import { X, Settings, ShieldAlert, DollarSign, Database, UserCheck, CheckCircle } from 'lucide-react';
import { Room } from '../types/hotel';

interface AdminPanelModalProps {
  rooms: Room[];
  onClose: () => void;
  onUpdateBasePrice: (roomId: string, newPrice: number) => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  rooms,
  onClose,
  onUpdateBasePrice,
}) => {
  const [activeTab, setActiveTab] = useState<'rates' | 'cash' | 'security'>('rates');
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handlePriceChange = (roomId: string, price: number) => {
    setEditingPrices((prev) => ({ ...prev, [roomId]: price }));
  };

  const handleSavePrices = (roomId: string) => {
    const newPrice = editingPrices[roomId];
    if (newPrice !== undefined && newPrice > 0) {
      onUpdateBasePrice(roomId, newPrice);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900/95 backdrop-blur-2xl rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-amber-500/25 ring-1 ring-amber-500/20 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/50 px-6 py-4 flex items-center justify-between text-white border-b border-amber-500/20">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-400 shadow-inner">
              <Settings className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-100 tracking-wide font-serif-luxury">
                Hotel Administration Panel
              </h3>
              <p className="text-[11px] text-amber-200/60 font-light">
                Restricted to <span className="text-amber-300 font-semibold">admin_user</span> & Keycloak Realm Admins
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 p-2 rounded-xl transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 px-6 pt-3 space-x-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('rates')}
            className={`pb-3 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'rates'
                ? 'border-amber-400 text-amber-300 shadow-[0_2px_12px_rgba(245,158,11,0.25)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Room Rates Management</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cash')}
            className={`pb-3 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'cash'
                ? 'border-amber-400 text-amber-300 shadow-[0_2px_12px_rgba(245,158,11,0.25)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Cash Shift Controls</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-3 border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'security'
                ? 'border-amber-400 text-amber-300 shadow-[0_2px_12px_rgba(245,158,11,0.25)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Keycloak Roles & Access</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 bg-slate-950/60">
          {savedSuccess && (
            <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs flex items-center space-x-2.5 backdrop-blur-md shadow-inner animate-in fade-in duration-200">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Base rate updated successfully in PostgreSQL 18 & Redis cache.</span>
            </div>
          )}

          {activeTab === 'rates' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                Override suite base rates dynamically in USD. Changes immediately propagate across real-time check-in and booking calculations.
              </p>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md divide-y divide-slate-800/80">
                {rooms.map((room) => (
                  <div key={room.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-800/40 transition-colors">
                    <div>
                      <span className="font-bold text-amber-100 text-sm tracking-wide">Room {room.number}</span>
                      <span className="ml-2 text-slate-400">({room.category_name} &bull; Floor {room.floor})</span>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1.5 text-amber-400 font-semibold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={room.base_price}
                          onChange={(e) => handlePriceChange(room.id, parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-1.5 bg-slate-950 border border-amber-500/30 rounded-lg text-xs font-semibold text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 transition-colors"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSavePrices(room.id)}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg shadow-md transition-all active:scale-95"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'cash' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-900/70 rounded-xl border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Active Shift Status:</span>
                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    OPEN
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Opening Balance:</span>
                  <span className="font-bold text-amber-200">$250.00 USD</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Daily Folio Collections:</span>
                  <span className="font-bold text-emerald-400">+$820.00 USD</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Only <span className="font-semibold text-amber-300">admin_user</span> can trigger blind cash reconciliation and finalize end-of-shift audits.
              </p>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/30 flex items-start space-x-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-200">Keycloak 26 Identity Integration</p>
                  <p className="text-amber-200/70 text-[11px] mt-0.5">
                    User permissions are governed through Keycloak realm{' '}
                    <code className="bg-slate-950/80 border border-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded font-mono text-[11px]">
                      hotel-realm
                    </code>.
                  </p>
                </div>
              </div>
              <div className="border border-slate-800 rounded-xl divide-y divide-slate-800/80 bg-slate-900/50 overflow-hidden">
                <div className="p-3.5 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-amber-100">admin_user</p>
                    <p className="text-[11px] text-slate-400">Roles: ADMIN, USER &bull; Unrestricted Management</p>
                  </div>
                  <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 text-[10px] font-bold">
                    Active Session
                  </span>
                </div>
                <div className="p-3.5 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-amber-100">basic_user</p>
                    <p className="text-[11px] text-slate-400">Roles: USER &bull; Reservations & Front Desk Only</p>
                  </div>
                  <span className="text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700/60 text-[10px] font-bold">
                    Standby
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/90 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
