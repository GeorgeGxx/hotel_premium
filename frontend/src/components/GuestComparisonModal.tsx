import React from 'react';
import { Room } from '../types/hotel';
import { getRoomImageUrl } from '../services/api';
import { X, Check, Bed, Maximize2, Compass, Users } from 'lucide-react';

interface GuestComparisonModalProps {
  rooms: Room[];
  onClose: () => void;
  onSelectRoom: (room: Room) => void;
}

export const GuestComparisonModal: React.FC<GuestComparisonModalProps> = ({
  rooms,
  onClose,
  onSelectRoom,
}) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden transform transition-all my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Suite Tier Comparison</h2>
            <p className="text-xs text-slate-400 mt-1">
              Evaluate suites side-by-side to find the ultimate match for your stay
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Table */}
        <div className="p-6 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 px-4 font-bold text-slate-400 uppercase tracking-wider w-1/4">
                  Suite Preview
                </th>
                {rooms.map((room) => (
                  <th key={room.id} className="py-3 px-4 text-center">
                    <div className="w-full h-28 rounded-xl overflow-hidden mb-2 shadow-xs border border-slate-200 bg-slate-900">
                      <img
                        src={getRoomImageUrl(room)}
                        alt={`Suite ${room.number}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="block text-sm font-bold text-indigo-900">
                      Suite {room.number}
                    </span>
                    <span className="text-slate-500 font-normal">{room.category_name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Price Row */}
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-700">Nightly Rate (USD)</td>
                {rooms.map((room) => (
                  <td key={room.id} className="py-3 px-4 text-center">
                    <span className="text-base font-extrabold text-indigo-600">
                      ${room.base_price.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">USD / night</span>
                  </td>
                ))}
              </tr>

              {/* Guest Capacity */}
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-700 flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  Capacity
                </td>
                {rooms.map((room) => (
                  <td key={room.id} className="py-3 px-4 text-center font-medium text-slate-800">
                    Up to {room.capacity} Guests
                  </td>
                ))}
              </tr>

              {/* Suite Size */}
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-700 flex items-center">
                  <Maximize2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  Living Area
                </td>
                {rooms.map((room) => (
                  <td key={room.id} className="py-3 px-4 text-center font-medium text-slate-800">
                    {room.size_sqft || 420} sq ft ({Math.round((room.size_sqft || 420) * 0.0929)} m&sup2;)
                  </td>
                ))}
              </tr>

              {/* Bed Configuration */}
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-700 flex items-center">
                  <Bed className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  Bed Setup
                </td>
                {rooms.map((room) => (
                  <td key={room.id} className="py-3 px-4 text-center font-medium text-slate-800">
                    {room.bed_type || 'King Bed'}
                  </td>
                ))}
              </tr>

              {/* View */}
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-700 flex items-center">
                  <Compass className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  Signature View
                </td>
                {rooms.map((room) => (
                  <td key={room.id} className="py-3 px-4 text-center font-medium text-slate-800">
                    {room.view_type || 'Scenic City View'}
                  </td>
                ))}
              </tr>

              {/* Amenities List */}
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-700 align-top">
                  Key Amenities
                </td>
                {rooms.map((room) => (
                  <td key={room.id} className="py-3 px-4 text-left align-top">
                    <ul className="space-y-1">
                      {(room.amenities || ['Free Wi-Fi', 'Room Service']).map((amenity, idx) => (
                        <li key={idx} className="flex items-center text-[11px] text-slate-600">
                          <Check className="w-3 h-3 text-emerald-500 mr-1 shrink-0" />
                          <span>{amenity}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>

              {/* Direct Booking Action */}
              <tr>
                <td className="py-4 px-4 font-semibold text-slate-700">Action</td>
                {rooms.map((room) => (
                  <td key={room.id} className="py-4 px-4 text-center">
                    <button
                      type="button"
                      disabled={room.status !== 'AVAILABLE'}
                      onClick={() => {
                        onSelectRoom(room);
                        onClose();
                      }}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-all shadow-xs ${
                        room.status === 'AVAILABLE'
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {room.status === 'AVAILABLE' ? 'Book This Suite' : 'Unavailable'}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
