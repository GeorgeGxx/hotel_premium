import React, { useEffect, useState } from 'react';
import {
  X,
  Printer,
  Building2,
  Calendar,
  CheckCircle2,
  Receipt,
  PlusCircle,
} from 'lucide-react';
import { StayDetails, StayCharge, AddStayChargeDTO } from '../types/hotel';
import { fetchStayCharges, addStayCharge } from '../services/api';

interface LuxuryInvoiceModalProps {
  stay: StayDetails | null;
  onClose: () => void;
  onChargeAdded?: () => void;
}

export const LuxuryInvoiceModal: React.FC<LuxuryInvoiceModalProps> = ({
  stay,
  onClose,
  onChargeAdded,
}) => {
  const [charges, setCharges] = useState<StayCharge[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddCharge, setShowAddCharge] = useState<boolean>(false);
  const [newDesc, setNewDesc] = useState<string>('Grand Cru Minibar Selection');
  const [newAmount, setNewAmount] = useState<number>(45.0);
  const [isPosting, setIsPosting] = useState<boolean>(false);

  useEffect(() => {
    if (!stay) return;
    let mounted = true;
    setLoading(true);
    fetchStayCharges(stay.id)
      .then((data) => {
        if (mounted) {
          setCharges(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [stay]);

  if (!stay) return null;

  const roomSubtotal = stay.total_amount || (stay.total_nights * stay.nightly_rate);
  const addOnSubtotal = charges.reduce((acc, c) => acc + c.total_price, 0);
  const grandTotal = roomSubtotal + addOnSubtotal;
  const depositPaid = stay.deposit_amount || 0;
  const balanceDue = Math.max(0, grandTotal - depositPaid);
  const isSettled = balanceDue <= 0.01;

  const invoiceNumber = `INV-${stay.id.slice(0, 8).toUpperCase()}-${new Date().getFullYear()}`;
  const issueDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handlePostCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc || newAmount <= 0) return;
    setIsPosting(true);
    try {
      const dto: AddStayChargeDTO = {
        stay_id: stay.id,
        description: newDesc,
        quantity: 1,
        unit_price: Number(newAmount),
      };
      const created = await addStayCharge(dto);
      setCharges((prev) => [...prev, created]);
      setShowAddCharge(false);
      setNewDesc('In-Room Dining: Caviar & Champagne');
      setNewAmount(95.0);
      if (onChargeAdded) onChargeAdded();
    } catch (err) {
      console.error('Failed to post charge:', err);
    } finally {
      setIsPosting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl text-slate-100 flex flex-col print:m-0 print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Header Actions (hidden during print) */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-amber-400" />
            <h2 id="invoice-modal-title" className="text-base font-bold text-white tracking-wide">
              Official Folio & Guest Statement
            </h2>
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                isSettled
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {isSettled ? 'Zero Balance Settled' : `Due: $${balanceDue.toFixed(2)} USD`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddCharge(!showAddCharge)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Post Charge</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              <Printer className="w-3.5 h-3.5 text-slate-950" />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form to Post New Charge (collapsible) */}
        {showAddCharge && (
          <form
            onSubmit={handlePostCharge}
            className="mx-6 mt-4 p-4 bg-slate-950/70 border border-amber-500/30 rounded-2xl flex flex-wrap items-center gap-3 print:hidden"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Charge Description / POS Item
              </label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g. Sommelier Wine, Spa, Valet Parking"
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div className="w-28">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Amount (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={newAmount}
                onChange={(e) => setNewAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div className="flex items-end gap-2 pt-5">
              <button
                type="submit"
                disabled={isPosting}
                className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors disabled:opacity-50"
              >
                {isPosting ? 'Posting...' : 'Confirm Charge'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddCharge(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Printable Folio Invoice Body */}
        <div className="p-6 sm:p-8 space-y-6 print:text-black">
          {/* Hotel Brand Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800 print:border-gray-300">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-amber-400 print:text-black" />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wider print:text-black">
                  HOTEL PREMIUM
                </h1>
              </div>
              <p className="text-xs text-amber-400 font-medium tracking-widest uppercase mt-0.5 print:text-gray-700">
                Luxury Hospitality &amp; Residences
              </p>
              <p className="text-[11px] text-slate-400 print:text-gray-600 mt-1">
                742 Evergreen Avenue, Oceanfront Boulevard • Tel: +1 (800) 555-LUXE
              </p>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Statement / Folio ID
              </span>
              <p className="text-sm font-mono font-bold text-white print:text-black">{invoiceNumber}</p>
              <p className="text-xs text-slate-400 print:text-gray-600">Date: {issueDate}</p>
            </div>
          </div>

          {/* Guest & Room Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 print:bg-gray-50 print:border-gray-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Guest Information
              </span>
              <p className="text-sm font-bold text-white print:text-black">
                {stay.guest_name || 'Valued Guest'}
              </p>
              <p className="text-xs text-slate-400 print:text-gray-600">
                ID / Passport: {stay.document_number || 'ENC-PII-PROTECTED'}
              </p>
              {stay.guest_email && (
                <p className="text-xs text-slate-400 print:text-gray-600">{stay.guest_email}</p>
              )}
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                Stay Details
              </span>
              <p className="text-sm font-bold text-white print:text-black">
                Suite {stay.room_number} • {stay.category_name}
              </p>
              <p className="text-xs text-slate-400 print:text-gray-600 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400 print:text-black" />
                <span>
                  {stay.check_in_date} &rarr; {stay.check_out_date} ({stay.total_nights} Nights)
                </span>
              </p>
            </div>
          </div>

          {/* Itemized Charges Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 print:text-gray-800">
              Itemized Folio Transactions
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 print:border-gray-300 print:text-gray-600">
                    <th className="py-2.5 font-semibold">Description</th>
                    <th className="py-2.5 font-semibold text-center w-16">Qty</th>
                    <th className="py-2.5 font-semibold text-right w-24">Rate (USD)</th>
                    <th className="py-2.5 font-semibold text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-gray-200">
                  {/* Room Nights Charge */}
                  <tr>
                    <td className="py-3">
                      <p className="font-semibold text-white print:text-black">
                        Suite {stay.room_number} Accommodation
                      </p>
                      <p className="text-[11px] text-slate-400 print:text-gray-600">
                        {stay.category_name} ({stay.total_nights} nights @ ${stay.nightly_rate.toFixed(2)}/night)
                      </p>
                    </td>
                    <td className="py-3 text-center text-slate-300 print:text-black">{stay.total_nights}</td>
                    <td className="py-3 text-right text-slate-300 print:text-black">
                      ${stay.nightly_rate.toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-bold text-white print:text-black">
                      ${roomSubtotal.toFixed(2)}
                    </td>
                  </tr>

                  {/* Add-on Incidentals */}
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-slate-400">
                        Loading incidentals...
                      </td>
                    </tr>
                  ) : charges.length > 0 ? (
                    charges.map((chg) => (
                      <tr key={chg.id}>
                        <td className="py-2.5">
                          <p className="font-medium text-slate-200 print:text-black">{chg.description}</p>
                          <p className="text-[10px] text-slate-400 print:text-gray-500">
                            Posted: {new Date(chg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td className="py-2.5 text-center text-slate-300 print:text-black">{chg.quantity}</td>
                        <td className="py-2.5 text-right text-slate-300 print:text-black">
                          ${chg.unit_price.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-amber-400 print:text-black">
                          ${chg.total_price.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statement Summary & Payments */}
          <div className="pt-4 border-t border-slate-800 print:border-gray-300 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div className="text-xs text-slate-400 print:text-gray-600 max-w-sm">
              <p className="font-semibold text-slate-300 print:text-black mb-1">Payment &amp; Terms Policy</p>
              <p className="text-[11px] leading-relaxed">
                Thank you for staying at Hotel Premium. All incidentals and room charges are billed to the registered card on file.
                Compliant with PCI-DSS &amp; EU GDPR.
              </p>
            </div>

            <div className="w-full sm:w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400 print:text-gray-600">
                <span>Room Charges:</span>
                <span className="font-mono">${roomSubtotal.toFixed(2)}</span>
              </div>
              {addOnSubtotal > 0 && (
                <div className="flex justify-between text-slate-400 print:text-gray-600">
                  <span>Incidental Charges:</span>
                  <span className="font-mono text-amber-400 print:text-black">
                    +${addOnSubtotal.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-400 print:text-gray-600">
                <span>Gross Total:</span>
                <span className="font-mono font-bold text-white print:text-black">
                  ${grandTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-400 font-semibold print:text-gray-800">
                <span>Payments / Deposits Applied:</span>
                <span className="font-mono">-${depositPaid.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 print:border-gray-400 flex justify-between items-center text-sm">
                <span className="font-bold text-white print:text-black">Net Balance Due:</span>
                <span
                  className={`font-mono font-extrabold ${
                    isSettled ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  ${balanceDue.toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          {/* Digital Stamp of Settlement */}
          <div className="pt-4 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60 print:border-gray-200">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 print:text-black" />
              <span>
                {isSettled
                  ? 'Official Zero-Balance Departure Verified. Guest account is cleared.'
                  : 'Pending final folio settlement prior to key return.'}
              </span>
            </div>
            <span className="font-mono text-[10px]">AUTH-DIGEST: {stay.id.slice(0, 12)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
