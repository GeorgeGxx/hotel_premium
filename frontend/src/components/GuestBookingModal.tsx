import React, { useState } from 'react';
import { Room, GuestBookingRequest } from '../types/hotel';
import { CONCIERGE_ADDONS } from '../services/api';
import {
  X,
  Calendar,
  Users,
  Check,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Download,
  CheckCircle2,
  Bed,
  Compass,
} from 'lucide-react';

interface GuestBookingModalProps {
  room: Room;
  onClose: () => void;
  onConfirmBooking: (req: GuestBookingRequest) => Promise<void>;
}

export const GuestBookingModal: React.FC<GuestBookingModalProps> = ({
  room,
  onClose,
  onConfirmBooking,
}) => {
  const [nights, setNights] = useState<number>(3);
  const [adults, setAdults] = useState<number>(Math.min(2, room.capacity));
  const [children, setChildren] = useState<number>(0);
  const [guestName, setGuestName] = useState<string>('');
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<GuestBookingRequest | null>(null);

  // Financial Calculations strictly in USD
  const roomSubtotal = room.base_price * nights;
  const addonsSubtotal = selectedAddons.reduce((acc, addonId) => {
    const addon = CONCIERGE_ADDONS.find((a) => a.id === addonId);
    if (!addon) return acc;
    if (addon.perGuest) {
      return acc + addon.priceUSD * (adults + children) * nights;
    }
    return acc + addon.priceUSD;
  }, 0);

  const taxesUSD = (roomSubtotal + addonsSubtotal) * 0.1; // 10% Luxury Hospitality & Tourism Tax
  const grandTotalUSD = roomSubtotal + addonsSubtotal + taxesUSD;

  const toggleAddon = (addonId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName || !guestEmail) {
      alert('Please enter your full name and contact email.');
      return;
    }

    setIsSubmitting(true);
    const bookingReq: GuestBookingRequest = {
      roomId: room.id,
      guestName,
      guestEmail,
      guestPhone,
      checkInDate: new Date().toISOString().split('T')[0],
      checkOutDate: new Date(Date.now() + nights * 86400000).toISOString().split('T')[0],
      adultsCount: adults,
      childrenCount: children,
      selectedAddonIds: selectedAddons,
      specialRequests,
      totalNights: nights,
      roomSubtotalUSD: roomSubtotal,
      addonsSubtotalUSD: addonsSubtotal,
      taxesUSD,
      grandTotalUSD,
    };

    try {
      await onConfirmBooking(bookingReq);
      setConfirmedBooking(bookingReq);
    } catch {
      alert('Failed to complete booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden transform transition-all my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Guaranteed Luxury Reservation</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Suite {room.number} &mdash; {room.category_name}
          </h2>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-300">
            <span className="flex items-center">
              <Compass className="w-3.5 h-3.5 mr-1 text-indigo-400" />
              {room.view_type || 'Scenic Horizon View'}
            </span>
            <span className="flex items-center">
              <Bed className="w-3.5 h-3.5 mr-1 text-indigo-400" />
              {room.bed_type || 'Luxury King Bed'}
            </span>
            <span className="font-semibold text-emerald-400 text-sm">
              ${room.base_price.toFixed(2)} USD / night
            </span>
          </div>
        </div>

        {confirmedBooking ? (
          /* Confirmation & Voucher View */
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                Reservation Confirmed & Guaranteed!
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Your luxury itinerary has been reserved under confirmation code{' '}
                <span className="font-mono font-bold text-indigo-600">
                  HP-VOUCHER-{room.number}-{Date.now().toString().slice(-4)}
                </span>
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 text-left space-y-3 text-xs">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Primary Guest</span>
                <span className="font-semibold text-slate-800">{confirmedBooking.guestName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Stay Duration</span>
                <span className="font-semibold text-slate-800">
                  {confirmedBooking.totalNights} Nights ({confirmedBooking.checkInDate} to{' '}
                  {confirmedBooking.checkOutDate})
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Guests</span>
                <span className="font-semibold text-slate-800">
                  {confirmedBooking.adultsCount} Adults, {confirmedBooking.childrenCount} Children
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Room Tier</span>
                <span className="font-semibold text-slate-800">
                  Suite {room.number} ({room.category_name})
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Total Paid (USD)</span>
                <span className="font-bold text-emerald-600 text-sm">
                  ${confirmedBooking.grandTotalUSD.toFixed(2)} USD
                </span>
              </div>
              <div className="pt-2 text-slate-500 text-[11px]">
                A formal digital key and concierge itinerary have been dispatched to{' '}
                <span className="font-semibold text-slate-700">{confirmedBooking.guestEmail}</span>.
              </div>
            </div>

            <div className="flex justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
              >
                <Download className="w-4 h-4 mr-2 text-slate-500" />
                Print Confirmation Voucher
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Interactive Booking Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Stay Dates & Guests Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Duration of Stay
                </label>
                <select
                  value={nights}
                  onChange={(e) => setNights(Number(e.target.value))}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={1}>1 Night</option>
                  <option value={2}>2 Nights (Weekend Escape)</option>
                  <option value={3}>3 Nights (Long Stay)</option>
                  <option value={5}>5 Nights (Vacation)</option>
                  <option value={7}>7 Nights (Luxury Retreat)</option>
                  <option value={14}>14 Nights (Extended Suite Stay)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Adult Guests
                </label>
                <select
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {[...Array(room.capacity)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} {i === 0 ? 'Adult' : 'Adults'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Children / Minors
                </label>
                <select
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value))}
                  className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>0 Children</option>
                  <option value={1}>1 Child</option>
                  <option value={2}>2 Children</option>
                </select>
              </div>
            </div>

            {/* Guest Contact Information */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Guest Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elizabeth Morgan"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="elizabeth@example.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile / WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 345-6789"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Curated Concierge Add-Ons */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                Curated Concierge & VIP Enhancements
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CONCIERGE_ADDONS.map((addon) => {
                  const isSelected = selectedAddons.includes(addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="pr-2">
                          <p className="text-xs font-bold text-slate-900">{addon.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{addon.description}</p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                      <div className="mt-2 text-xs font-semibold text-indigo-700">
                        +${addon.priceUSD.toFixed(2)} USD {addon.perGuest ? '/ guest / night' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Special Preferences */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Special Requests or Dietary Requirements
              </label>
              <textarea
                rows={2}
                placeholder="High floor preferred, extra hypoallergenic pillows, late arrival..."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Real-time Financial Breakdown (Strictly USD) */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>
                  Room Base Rate ({nights} nights &times; ${room.base_price.toFixed(2)} USD)
                </span>
                <span className="font-medium text-slate-900">${roomSubtotal.toFixed(2)} USD</span>
              </div>
              {addonsSubtotal > 0 && (
                <div className="flex justify-between text-indigo-700">
                  <span>Selected Concierge Add-Ons</span>
                  <span className="font-semibold">+${addonsSubtotal.toFixed(2)} USD</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Taxes & Hospitality Surcharge (10%)</span>
                <span>+${taxesUSD.toFixed(2)} USD</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline">
                <div>
                  <span className="text-sm font-bold text-slate-900">Total Guaranteed Amount</span>
                  <p className="text-[10px] text-slate-500">All prices denominated strictly in USD</p>
                </div>
                <span className="text-xl font-black text-indigo-950">
                  ${grandTotalUSD.toFixed(2)} USD
                </span>
              </div>
            </div>

            {/* Trust & Guarantee Banner */}
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 bg-slate-100 p-2.5 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Free cancellation up to 48 hours prior to arrival. Encrypted via Keycloak OAuth2 & Kong Gateway.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Confirming Reservation...' : 'Confirm & Guarantee Suite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
