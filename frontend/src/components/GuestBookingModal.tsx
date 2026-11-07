import React, { useState } from 'react';
import { Room, GuestBookingRequest } from '../types/hotel';
import { CONCIERGE_ADDONS, getRoomImageUrl } from '../services/api';
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
  const [paymentPolicy, setPaymentPolicy] = useState<'DEPOSIT_50' | 'FULL' | 'PAY_AT_HOTEL'>('DEPOSIT_50');
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

  // Deposit calculation based on selected policy
  const depositUSD =
    paymentPolicy === 'FULL'
      ? grandTotalUSD
      : paymentPolicy === 'DEPOSIT_50'
      ? Math.round(grandTotalUSD * 0.5 * 100) / 100
      : 0;
  const balanceDueUSD = Math.max(0, grandTotalUSD - depositUSD);

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
      depositUSD,
      paymentPolicy,
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
        {/* Header with High-Resolution Room Photo Banner */}
        <div className="relative h-44 sm:h-52 overflow-hidden text-white bg-slate-900">
          <img
            src={getRoomImageUrl(room)}
            alt={`${room.category_name} - Suite ${room.number}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-black/40" />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex items-center space-x-2 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Guaranteed Luxury Reservation</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
              Suite {room.number} &mdash; {room.category_name}
            </h2>
            <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-200">
              <span className="flex items-center">
                <Compass className="w-3.5 h-3.5 mr-1 text-amber-300" />
                {room.view_type || 'Scenic Horizon View'}
              </span>
              <span className="flex items-center">
                <Bed className="w-3.5 h-3.5 mr-1 text-amber-300" />
                {room.bed_type || 'Luxury King Bed'}
              </span>
              <span className="font-semibold text-emerald-400 text-sm">
                ${room.base_price.toFixed(2)} USD / night
              </span>
            </div>
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
                <span className="text-slate-500">Total Stay Valuation</span>
                <span className="font-bold text-slate-900">
                  ${confirmedBooking.grandTotalUSD.toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Deposit Paid Now</span>
                <span className="font-bold text-emerald-600 text-sm">
                  ${(confirmedBooking.depositUSD ?? confirmedBooking.grandTotalUSD).toFixed(2)} USD
                </span>
              </div>
              {Math.max(0, confirmedBooking.grandTotalUSD - (confirmedBooking.depositUSD ?? confirmedBooking.grandTotalUSD)) > 0.01 && (
                <div className="flex justify-between border-b pb-2 bg-amber-50/60 -mx-2 px-2 py-1 rounded-lg">
                  <span className="text-amber-800 font-medium">Balance Due at Departure</span>
                  <span className="font-bold text-amber-700 text-sm">
                    ${(confirmedBooking.grandTotalUSD - (confirmedBooking.depositUSD ?? confirmedBooking.grandTotalUSD)).toFixed(2)} USD
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Payment Policy</span>
                <span className="font-semibold text-indigo-600">
                  {confirmedBooking.paymentPolicy === 'DEPOSIT_50'
                    ? '50% Guarantee Deposit'
                    : confirmedBooking.paymentPolicy === 'PAY_AT_HOTEL'
                    ? 'Credit Card Guarantee (Pay at Hotel)'
                    : '100% Full Payment Upfront'}
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
                  <span className="text-sm font-bold text-slate-900">Total Guaranteed Valuation</span>
                  <p className="text-[10px] text-slate-500">All prices denominated strictly in USD</p>
                </div>
                <span className="text-lg font-black text-slate-900">
                  ${grandTotalUSD.toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-slate-200 text-xs">
                <span className="font-bold text-indigo-950">Deposit Payable Today:</span>
                <span className="text-base font-black text-indigo-600">${depositUSD.toFixed(2)} USD</span>
              </div>
              {balanceDueUSD > 0.01 && (
                <div className="flex justify-between items-center text-[11px] text-amber-700 bg-amber-50/70 -mx-2 px-2 py-1 rounded-md">
                  <span>Remaining Folio Balance (Due at Departure):</span>
                  <span className="font-bold">${balanceDueUSD.toFixed(2)} USD</span>
                </div>
              )}
            </div>

            {/* Payment Guarantee & Deposit Policy Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center">
                <CreditCard className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                Select Payment &amp; Guarantee Policy
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 50% Deposit */}
                <div
                  onClick={() => setPaymentPolicy('DEPOSIT_50')}
                  className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                    paymentPolicy === 'DEPOSIT_50'
                      ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">50% Deposit</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                      Standard
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Pay 50% now, balance settled at check-out
                  </p>
                  <p className="text-xs font-bold text-indigo-700 mt-2">
                    ${(grandTotalUSD * 0.5).toFixed(2)} USD now
                  </p>
                </div>

                {/* 100% Full */}
                <div
                  onClick={() => setPaymentPolicy('FULL')}
                  className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                    paymentPolicy === 'FULL'
                      ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">100% Full Payment</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">
                      Zero Balance
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Fully settled now for instant departure
                  </p>
                  <p className="text-xs font-bold text-emerald-700 mt-2">
                    ${grandTotalUSD.toFixed(2)} USD now
                  </p>
                </div>

                {/* Pay at Hotel */}
                <div
                  onClick={() => setPaymentPolicy('PAY_AT_HOTEL')}
                  className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                    paymentPolicy === 'PAY_AT_HOTEL'
                      ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Card Guarantee</span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                      Pay Later
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Hold with card; pay full sum at check-out
                  </p>
                  <p className="text-xs font-bold text-slate-700 mt-2">
                    $0.00 USD today
                  </p>
                </div>
              </div>
            </div>

            {/* Trust & Guarantee Banner */}
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 bg-slate-100 p-2.5 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Free cancellation up to 48 hours prior to arrival. Zero-Balance policy enforced at departure.
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
                {isSubmitting
                  ? 'Confirming Reservation...'
                  : paymentPolicy === 'PAY_AT_HOTEL'
                  ? 'Guarantee Suite ($0.00 Today)'
                  : `Confirm & Pay $${depositUSD.toFixed(2)} USD`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
