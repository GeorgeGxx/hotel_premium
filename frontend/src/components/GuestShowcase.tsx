import React, { useState, useMemo } from 'react';
import { Room } from '../types/hotel';
import { getRoomImageUrl } from '../services/api';
import {
  Sparkles,
  Star,
  Users,
  Bed,
  Maximize2,
  Compass,
  Check,
  Filter,
  ArrowRight,
  ShieldCheck,
  Coffee,
  Car,
  UtensilsCrossed,
  Wifi,
} from 'lucide-react';

interface GuestShowcaseProps {
  rooms: Room[];
  onBookRoom: (room: Room) => void;
  onOpenCompare: (selectedRooms: Room[]) => void;
}

export const GuestShowcase: React.FC<GuestShowcaseProps> = ({
  rooms,
  onBookRoom,
  onOpenCompare,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [guestCountFilter, setGuestCountFilter] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'RECOMMENDED' | 'PRICE_ASC' | 'PRICE_DESC' | 'RATING'>('RECOMMENDED');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  // Unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(rooms.map((r) => r.category_name)));
    return ['ALL', ...cats];
  }, [rooms]);

  // Filtered & Sorted rooms
  const filteredRooms = useMemo(() => {
    return rooms
      .filter((room) => {
        if (selectedCategory !== 'ALL' && room.category_name !== selectedCategory) {
          return false;
        }
        if (guestCountFilter > 0 && room.capacity < guestCountFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'PRICE_ASC') return a.base_price - b.base_price;
        if (sortBy === 'PRICE_DESC') return b.base_price - a.base_price;
        if (sortBy === 'RATING') return (b.rating || 5) - (a.rating || 5);
        // Recommended: Available first, then higher tier
        if (a.status === 'AVAILABLE' && b.status !== 'AVAILABLE') return -1;
        if (b.status === 'AVAILABLE' && a.status !== 'AVAILABLE') return 1;
        return b.base_price - a.base_price;
      });
  }, [rooms, selectedCategory, guestCountFilter, sortBy]);

  const toggleCompare = (roomId: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(roomId)) {
        return prev.filter((id) => id !== roomId);
      }
      if (prev.length >= 3) {
        alert('You can compare a maximum of 3 suites simultaneously.');
        return prev;
      }
      return [...prev, roomId];
    });
  };

  const handleLaunchCompare = () => {
    const roomsToCompare = rooms.filter((r) => selectedForCompare.includes(r.id));
    if (roomsToCompare.length < 2) {
      alert('Please select at least 2 suites to initiate comparison.');
      return;
    }
    onOpenCompare(roomsToCompare);
  };

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-8 sm:p-12 shadow-2xl border border-slate-800">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-indigo-300 text-xs font-semibold uppercase tracking-wider border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            <span>Exquisite Stays &bull; Downtown Waterfront</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Refined Elegance, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-sky-200 to-amber-200">
              Unmatched Hospitality.
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
            Immerse yourself in curated residential architecture, master-crafted suites, and 24/7 dedicated butler service. Transparent pricing guaranteed strictly in USD with zero hidden resort fees.
          </p>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-300">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Best Rate Guarantee (USD)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>Complimentary Nespresso & Tea Bar</span>
            </div>
            <div className="flex items-center space-x-2">
              <Wifi className="w-4 h-4 text-sky-400" />
              <span>Ultra-Fast Wi-Fi 7</span>
            </div>
          </div>
        </div>

        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-20 w-80 h-80 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Floating Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md border border-slate-200 -mt-6 mx-2 sm:mx-6 relative z-20">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'ALL' ? 'All Suites & Rooms' : cat}
              </button>
            ))}
          </div>

          {/* Controls: Capacity & Sort */}
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-600">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={guestCountFilter}
                onChange={(e) => setGuestCountFilter(Number(e.target.value))}
                className="border border-slate-200 rounded-lg p-2 text-xs font-medium bg-slate-50 text-slate-700 focus:ring-1 focus:ring-indigo-500"
              >
                <option value={0}>Any Guests</option>
                <option value={1}>1+ Guest</option>
                <option value={2}>2+ Guests</option>
                <option value={4}>4+ Guests (Suites)</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border border-slate-200 rounded-lg p-2 text-xs font-medium bg-slate-50 text-slate-700 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="RECOMMENDED">Featured First</option>
                <option value="PRICE_ASC">Price: Low to High ($)</option>
                <option value="PRICE_DESC">Price: High to Low ($)</option>
                <option value="RATING">Highest Guest Rating</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Comparison Tray */}
      {selectedForCompare.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-4 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-xs font-medium">
            <span className="font-bold text-indigo-400">{selectedForCompare.length}</span> suites selected for comparison
          </span>
          <button
            type="button"
            onClick={handleLaunchCompare}
            disabled={selectedForCompare.length < 2}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            Compare Side-by-Side
          </button>
          <button
            type="button"
            onClick={() => setSelectedForCompare([])}
            className="text-slate-400 hover:text-white text-xs"
          >
            Clear
          </button>
        </div>
      )}

      {/* Room Showcase Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRooms.map((room) => {
          const isAvailable = room.status === 'AVAILABLE';
          const isComparing = selectedForCompare.includes(room.id);

          return (
            <div
              key={room.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group"
            >
              {/* Card Visual Header / Photography with Ambient Gradient Overlay */}
              <div className="h-52 relative overflow-hidden text-white bg-slate-900">
                <img
                  src={getRoomImageUrl(room)}
                  alt={`${room.category_name} - Suite ${room.number}`}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80';
                  }}
                />
                {/* Vignette & Contrast Overlay for WCAG readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/40 to-black/30 pointer-events-none" />

                <div className="absolute inset-0 p-4 flex flex-col justify-between pointer-events-none">
                  {/* Top Badges */}
                  <div className="flex justify-between items-start">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-950/60 backdrop-blur-md border border-white/20 text-white">
                      Floor {room.floor} &bull; Room {room.number}
                    </span>

                    <div className="flex items-center space-x-1 bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-md">
                      <Star className="w-3 h-3 fill-slate-950 text-slate-950" />
                      <span>{room.rating?.toFixed(1) || '4.9'}</span>
                      <span className="text-[10px] font-normal text-slate-800">
                        ({room.review_count || 50})
                      </span>
                    </div>
                  </div>

                  {/* Bottom View / Category */}
                  <div>
                    <p className="text-[11px] text-amber-200 font-semibold uppercase tracking-wider flex items-center drop-shadow-xs">
                      <Compass className="w-3 h-3 mr-1" />
                      {room.view_type || 'Scenic City Skyline'}
                    </p>
                    <h3 className="text-xl font-bold tracking-tight text-white mt-0.5 drop-shadow-sm">
                      {room.category_name}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                {/* Specs Row */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-[11px] text-slate-600">
                  <div className="flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{room.capacity} Guests</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{room.size_sqft || 420} sq ft</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Bed className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{room.bed_type || 'King Bed'}</span>
                  </div>
                </div>

                {/* Amenities Badges */}
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Included Luxury Amenities
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(room.amenities || ['Wi-Fi 7', 'Minibar', 'Smart TV']).map((amenity, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200"
                      >
                        <Check className="w-2.5 h-2.5 text-emerald-500 mr-1" />
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="pt-1">
                  {isAvailable ? (
                    <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                      Available for Instant Reservation
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      <span className="w-2 h-2 rounded-full bg-slate-400 mr-1.5" />
                      Currently Occupied ({room.status})
                    </span>
                  )}
                </div>

                {/* Pricing & Booking Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Starting from</span>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-2xl font-black text-slate-900">
                        ${room.base_price.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">USD / night</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => toggleCompare(room.id)}
                      className={`p-2 rounded-xl border text-xs font-medium transition-colors ${
                        isComparing
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                      title="Compare Suite"
                    >
                      {isComparing ? 'Comparing' : 'Compare'}
                    </button>

                    <button
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => onBookRoom(room)}
                      className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                        isAvailable
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <span>Book Suite</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Signature Guest Experience Perks */}
      <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 mt-12">
        <h3 className="text-xl font-bold text-slate-900 text-center">
          The Hotel Premium Signature Experience
        </h3>
        <p className="text-xs text-slate-500 text-center mt-1">
          Every reservation includes our white-glove hospitality standards
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center space-y-2">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mx-auto">
              <Car className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Mercedes Limousine</h4>
            <p className="text-[11px] text-slate-500">
              Airport and city chauffeuring upon request in executive vehicles.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center space-y-2">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mx-auto">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Michelin-Trained In-Room Dining</h4>
            <p className="text-[11px] text-slate-500">
              24-hour gourmet culinary offerings served directly to your suite.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center space-y-2">
            <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-lg flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Nordic Thermal Spa</h4>
            <p className="text-[11px] text-slate-500">
              Complimentary access to steam rooms, cold plunge, and relaxation lounge.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center space-y-2">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mx-auto">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Encrypted Instant Checkout</h4>
            <p className="text-[11px] text-slate-500">
              Secured with Keycloak 26.8 OAuth2 and high-speed Redis 8 caching.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
