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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5" />
            <h3 className="text-base font-semibold">
              Guest Check-In &bull; Room {room.number}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <div>
              <span className="text-slate-500 font-medium">Category: </span>
              <span className="font-semibold text-slate-800">{room.category_name}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Max Capacity: </span>
              <span className="font-semibold text-slate-800">{room.capacity} Guests</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Base Rate: </span>
              <span className="font-semibold text-indigo-600">${room.base_price.toFixed(2)}/nt</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Guest Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.guestName}
                  onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-indigo-600 focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-indigo-600 focus:border-indigo-600 bg-white"
                >
                  <option value="PASSPORT">Passport</option>
                  <option value="NATIONAL_ID">National ID / DNI / INE</option>
                  <option value="DRIVERS_LICENSE">Driver's License</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Number *
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. A12345678"
                    value={formData.documentNumber}
                    onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-indigo-600 focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Contact
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    placeholder="+1 555 0192"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-indigo-600 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    placeholder="guest@domain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-indigo-600 focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-indigo-600 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rate/Night ($) *
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
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-indigo-600 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Deposit ($)
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
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-indigo-600 focus:border-indigo-600 font-semibold text-indigo-700"
                  />
                </div>
                <div className="flex gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deposit: total })}
                    className="text-[10px] bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 font-semibold px-2 py-0.5 rounded border border-slate-200 transition-colors"
                  >
                    100% Full
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deposit: Math.round((total / 2) * 100) / 100 })}
                    className="text-[10px] bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 font-semibold px-2 py-0.5 rounded border border-slate-200 transition-colors"
                  >
                    50% Dep.
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, deposit: 0 })}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-2 py-0.5 rounded border border-slate-200 transition-colors"
                  >
                    $0 Hold
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500 font-medium">Calculated Total: </span>
                <span className="text-base font-bold text-slate-900">${total.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-medium">Balance Due: </span>
                <span className="text-sm font-semibold text-slate-700">
                  ${Math.max(0, total - formData.deposit).toFixed(2)}
                </span>
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  formData.deposit >= total
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {formData.deposit >= total ? 'PAID' : 'PARTIAL'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Confirm & Check In</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
