import React, { useState } from 'react';
import { Room, CheckInFormData } from '../types/hotel';
import { X, UserPlus, CreditCard, Calendar, User, Phone, Mail, FileText } from 'lucide-react';

interface QuickCheckInModalProps {
  room: Room;
  onClose: () => void;
  onSubmit: (formData: CheckInFormData) => void;
}

export const QuickCheckInModal: React.FC<QuickCheckInModalProps> = ({
  room,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<CheckInFormData>({
    roomId: room.id,
    guestName: '',
    documentType: 'PASSPORT',
    documentNumber: '',
    email: '',
    phone: '',
    nights: 1,
    nightlyRate: room.base_price,
    deposit: room.base_price,
    notes: '',
  });

  const total = formData.nights * formData.nightlyRate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guestName.trim() || !formData.documentNumber.trim()) {
      alert('Please fill in guest name and identification document number.');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
        {/* Luxury Header */}
        <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-luxury font-bold text-white text-lg">
                Guest Check-In &bull; Suite {room.number}
              </h3>
              <p className="text-xs text-slate-400">Front desk instant registration &amp; key issuance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Room Specs Header */}
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
            <div>
              <span className="text-slate-500 font-medium">Category: </span>
              <span className="font-semibold text-white">{room.category_name}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Max Capacity: </span>
              <span className="font-semibold text-white">{room.capacity} Guests</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Base Rate: </span>
              <span className="font-bold text-amber-400">${room.base_price.toFixed(2)} USD/nt</span>
            </div>
          </div>

          <div className="space-y-3.5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Guest Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Lady Vivienne Westwood"
                  value={formData.guestName}
                  onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* Document Type & Number */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Document Type *
                </label>
                <select
                  value={formData.documentType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      documentType: e.target.value as CheckInFormData['documentType'],
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="PASSPORT" className="bg-slate-900 text-white">Passport</option>
                  <option value="NATIONAL_ID" className="bg-slate-900 text-white">National ID / DNI / INE</option>
                  <option value="DRIVERS_LICENSE" className="bg-slate-900 text-white">Driver's License</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Document Number *
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. P12345678"
                    value={formData.documentNumber}
                    onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Phone Contact
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    placeholder="+1 555 0192"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    placeholder="guest@domain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Stay Nights, Rate, and Deposit */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Stay Nights *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={formData.nights}
                    onChange={(e) => {
                      const nights = Math.max(1, parseInt(e.target.value) || 1);
                      setFormData({
                        ...formData,
                        nights,
                        deposit: nights * formData.nightlyRate,
                      });
                    }}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Rate/Night (USD) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formData.nightlyRate}
                  onChange={(e) => {
                    const nightlyRate = parseFloat(e.target.value) || 0;
                    setFormData({
                      ...formData,
                      nightlyRate,
                      deposit: formData.nights * nightlyRate,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Initial Deposit (USD)
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.deposit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        deposit: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-amber-400 font-bold focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                {/* Deposit Presets */}
                <div className="flex gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deposit: total })}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium px-2 py-0.5 rounded transition-colors"
                  >
                    100% Full
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deposit: Math.round((total / 2) * 100) / 100 })}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium px-2 py-0.5 rounded transition-colors"
                  >
                    50% Dep.
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deposit: 0 })}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 font-medium px-2 py-0.5 rounded transition-colors"
                  >
                    $0 Hold
                  </button>
                </div>
              </div>
            </div>

            {/* Total and Balance Calculation */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-400 text-[11px]">Calculated Stay Total: </span>
                <div className="text-base font-bold text-white">${total.toFixed(2)} USD</div>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[11px]">Departure Balance Due: </span>
                <div className="text-base font-bold text-amber-400">
                  ${Math.max(0, total - formData.deposit).toFixed(2)} USD
                </div>
                <div className="mt-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    formData.deposit >= total
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {formData.deposit >= total ? 'Folio: PAID (Zero Balance)' : 'Folio: PARTIAL (Settlement at Check-Out)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Confirm &amp; Check In</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
