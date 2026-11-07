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
      {/* Editorial Hero Section (Compact & Stylized) */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-slate-900/90 via-slate-950/80 to-amber-950/30 text-white p-5 sm:px-8 sm:py-6 shadow-xl border border-slate-800/80 backdrop-blur-md">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 text-[11px] font-semibold tracking-wider border border-amber-500/20">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Exquisite Luxury Stays &bull; Waterfront Sanctuary</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-serif-luxury">
              Refined Elegance,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
                Unrivaled Hospitality.
              </span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm font-light leading-snug">
              Master-crafted suites with panoramic vistas and 24/7 private concierge. Transparent rates in USD with zero hidden fees.
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-col items-start gap-2 text-[11px] text-slate-300 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-3 lg:pt-0 lg:pl-6">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Best Rate Guarantee (USD)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              <span>Complimentary Gourmet Breakfast</span>
            </div>
            <div className="flex items-center space-x-2">
              <Wifi className="w-3.5 h-3.5 text-amber-300" />
              <span>Ultra-Fast Wi-Fi 7</span>
            </div>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* Floating Filter & Search Bar */}
      <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-800 -mt-6 mx-2 sm:mx-6 relative z-20">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat === 'ALL' ? 'All Suites & Rooms' : cat}
              </button>
            ))}
          </div>

          {/* Controls: Capacity & Sort */}
          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={guestCountFilter}
                onChange={(e) => setGuestCountFilter(Number(e.target.value))}
                className="bg-transparent text-slate-300 text-xs font-semibold focus:outline-none"
              >
                <option value={0} className="bg-slate-900">Any Guests</option>
                <option value={1} className="bg-slate-900">1+ Guest</option>
                <option value={2} className="bg-slate-900">2+ Guests</option>
                <option value={4} className="bg-slate-900">4+ Guests (Suites)</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5 text-xs text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-slate-300 text-xs font-semibold focus:outline-none"
              >
                <option value="RECOMMENDED" className="bg-slate-900">Featured First</option>
                <option value="PRICE_ASC" className="bg-slate-900">Price: Low to High ($)</option>
                <option value="PRICE_DESC" className="bg-slate-900">Price: High to Low ($)</option>
                <option value="RATING" className="bg-slate-900">Highest Guest Rating</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Comparison Tray */}
      {selectedForCompare.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-xl text-white px-5 py-3 rounded-2xl shadow-2xl border border-amber-500/30 flex items-center space-x-4 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-xs font-medium">
            <span className="font-bold text-amber-400">{selectedForCompare.length}</span> suites selected for comparison
          </span>
          <button
            type="button"
            onClick={handleLaunchCompare}
            disabled={selectedForCompare.length < 2}
            className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/20"
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
              className="bg-slate-950/70 rounded-3xl border border-slate-800 overflow-hidden shadow-xl hover:border-amber-500/40 hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-300 flex flex-col group"
            >
              {/* Card Photography with Ambient Gradient Overlay */}
              <div className="h-60 relative overflow-hidden text-white bg-slate-900">
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
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-black/30 pointer-events-none" />

                <div className="absolute inset-0 p-4 flex flex-col justify-between pointer-events-none">
                  {/* Top Badges */}
                  <div className="flex justify-between items-start">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-amber-300">
                      Floor {room.floor} &bull; Room {room.number}
                    </span>

                    <div className="flex items-center space-x-1 bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full text-[11px] font-black shadow-lg shadow-amber-500/20">
                      <Star className="w-3 h-3 fill-slate-950 text-slate-950" />
                      <span>{room.rating?.toFixed(1) || '4.9'}</span>
                      <span className="text-[10px] font-medium text-slate-900">
                        ({room.review_count || 50})
                      </span>
                    </div>
                  </div>

                  {/* Bottom View / Category */}
                  <div>
                    <p className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider flex items-center drop-shadow-md">
                      <Compass className="w-3 h-3 mr-1 text-amber-400" />
                      {room.view_type || 'Scenic City Skyline'}
                    </p>
                    <h3 className="font-serif-luxury text-2xl font-bold tracking-tight text-white mt-0.5 drop-shadow-md group-hover:text-amber-300 transition-colors">
                      {room.category_name}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                {/* Specs Row */}
                <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-800 text-[11px] text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>{room.capacity} Guests</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{room.size_sqft || 420} sq ft</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Bed className="w-3.5 h-3.5 text-amber-400" />
                    <span className="truncate">{room.bed_type || 'King Bed'}</span>
                  </div>
                </div>

                {/* Amenities Badges */}
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    Included Luxury Amenities
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(room.amenities || ['Wi-Fi 7', 'Minibar', 'Smart TV']).map((amenity, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-800"
                      >
                        <Check className="w-2.5 h-2.5 text-amber-400 mr-1" />
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="pt-1">
                  {isAvailable ? (
                    <span className="inline-flex items-center text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                      Available for Instant Reservation
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-semibold text-slate-400 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
                      <span className="w-2 h-2 rounded-full bg-slate-500 mr-2" />
                      Currently Occupied ({room.status})
                    </span>
                  )}
                </div>

                {/* Pricing & Booking Footer */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500">Starting from</span>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-2xl font-black text-white tracking-tight">
                        ${room.base_price.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">USD / night</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => toggleCompare(room.id)}
                      className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                        isComparing
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                      title="Compare Suite"
                    >
                      {isComparing ? 'Comparing' : 'Compare'}
                    </button>

                    <button
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => onBookRoom(room)}
                      className={`inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                        isAvailable
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:brightness-110 shadow-amber-500/20'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
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
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 sm:p-10 border border-slate-800 mt-12 shadow-2xl">
        <h3 className="font-serif-luxury text-2xl font-bold text-white text-center">
          The Hotel Premium Signature Experience
        </h3>
        <p className="text-xs text-slate-400 text-center mt-1">
          Every reservation includes our white-glove hospitality standards
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 text-center space-y-2 hover:border-amber-500/30 transition-all">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <Car className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Mercedes Limousine</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Airport and city chauffeuring upon request in executive vehicles.
            </p>
          </div>

          <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 text-center space-y-2 hover:border-amber-500/30 transition-all">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Michelin In-Room Dining</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              24-hour gourmet culinary offerings served directly to your suite.
            </p>
          </div>

          <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 text-center space-y-2 hover:border-amber-500/30 transition-all">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Nordic Thermal Spa</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Complimentary access to steam rooms, cold plunge, and relaxation lounge.
            </p>
          </div>

          <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 text-center space-y-2 hover:border-amber-500/30 transition-all">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Encrypted Fast Checkout</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Secured with Keycloak 26.8 OAuth2 and high-speed Redis 8 caching.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
