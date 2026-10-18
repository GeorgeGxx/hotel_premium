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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-400/30">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">Hotel Administration Panel</h3>
              <p className="text-[11px] text-slate-400">Restricted to admin_user & Keycloak Realm Admins</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 space-x-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('rates')}
            className={`pb-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'rates'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Room Rates Management</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cash')}
            className={`pb-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'cash'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Cash Shift Controls</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Keycloak Roles & Access</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {savedSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Base rate updated successfully in PostgreSQL 18 & Redis cache.</span>
            </div>
          )}

          {activeTab === 'rates' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Override room base rates dynamically. Changes immediately reflect in real-time check-in calculations.
              </p>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {rooms.map((room) => (
                  <div key={room.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">Room {room.number}</span>
                      <span className="ml-2 text-slate-500">({room.category_name} - Floor {room.floor})</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1.5 text-slate-400 font-semibold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={room.base_price}
                          onChange={(e) => handlePriceChange(room.id, parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 py-1 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-indigo-600"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSavePrices(room.id)}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-xs transition-colors"
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
            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Active Shift Status:</span>
                  <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">OPEN</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Opening Balance:</span>
                  <span className="font-bold text-slate-900">$250.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Daily Folio Collections:</span>
                  <span className="font-bold text-indigo-600">+$820.00</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Only <span className="font-semibold text-slate-700">admin_user</span> can trigger blind cash reconciliation and finalize end-of-shift audits.
              </p>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200 flex items-start space-x-2.5">
                <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-indigo-900">Keycloak 26 Identity Integration</p>
                  <p className="text-indigo-700 text-[11px] mt-0.5">
                    User permissions are governed through Keycloak realm <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono">hotel-realm</code>.
                  </p>
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                <div className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900">admin_user</p>
                    <p className="text-[11px] text-slate-500">Roles: ADMIN, USER &bull; Unrestricted Management</p>
                  </div>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px] font-bold">
                    Active Session
                  </span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900">basic_user</p>
                    <p className="text-[11px] text-slate-500">Roles: USER &bull; Reservations & Front Desk Only</p>
                  </div>
                  <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    Standby
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
