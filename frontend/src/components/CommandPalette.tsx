import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  BedDouble,
  User,
  Calendar,
  Sparkles,
  ArrowRight,
  PlusCircle,
  Bell,
} from 'lucide-react';
import { Room, StayDetails } from '../types/hotel';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  stays: StayDetails[];
  onSelectRoom: (room: Room) => void;
  onSelectStay: (stay: StayDetails) => void;
  onOpenQuickCheckIn: () => void;
  onOpenNotifications: () => void;
  onNavigateTab: (tab: 'matrix' | 'reservations' | 'showcase') => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  rooms,
  stays,
  onSelectRoom,
  onSelectStay,
  onOpenQuickCheckIn,
  onOpenNotifications,
  onNavigateTab,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global Ctrl+K / Cmd+K and Esc listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          setQuery('');
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Filtered Results
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();

    // Default suggestions when query is empty
    if (!q) {
      return [
        {
          type: 'ACTION' as const,
          id: 'act-checkin',
          title: 'Guest Quick Check-In',
          subtitle: 'Open fast check-in modal with deposit options',
          icon: PlusCircle,
          action: () => {
            onOpenQuickCheckIn();
            onClose();
          },
        },
        {
          type: 'ACTION' as const,
          id: 'act-matrix',
          title: 'Switch to Live Room Matrix',
          subtitle: 'View all operational room statuses and housekeeping',
          icon: BedDouble,
          action: () => {
            onNavigateTab('matrix');
            onClose();
          },
        },
        {
          type: 'ACTION' as const,
          id: 'act-reservations',
          title: 'Manage Reservations & Folios',
          subtitle: 'Inspect guest stays, payments, and departures',
          icon: Calendar,
          action: () => {
            onNavigateTab('reservations');
            onClose();
          },
        },
        {
          type: 'ACTION' as const,
          id: 'act-notifs',
          title: 'Open Live Notifications Hub',
          subtitle: 'View real-time SSE operational events',
          icon: Bell,
          action: () => {
            onOpenNotifications();
            onClose();
          },
        },
      ];
    }

    const matchedActions = [
      {
        type: 'ACTION' as const,
        id: 'act-checkin',
        title: 'Guest Quick Check-In',
        subtitle: 'New check-in registration',
        icon: PlusCircle,
        action: () => {
          onOpenQuickCheckIn();
          onClose();
        },
      },
      {
        type: 'ACTION' as const,
        id: 'act-matrix',
        title: 'Live Room Matrix',
        subtitle: 'Room status and occupancy grid',
        icon: BedDouble,
        action: () => {
          onNavigateTab('matrix');
          onClose();
        },
      },
      {
        type: 'ACTION' as const,
        id: 'act-reservations',
        title: 'Reservations Manager',
        subtitle: 'Folios, check-outs, and billing',
        icon: Calendar,
        action: () => {
          onNavigateTab('reservations');
          onClose();
        },
      },
    ].filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
    );

    const matchedRooms = rooms
      .filter(
        (r) =>
          r.number.toLowerCase().includes(q) ||
          r.category_name.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          `floor ${r.floor}`.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map((r) => ({
        type: 'ROOM' as const,
        id: r.id,
        title: `Room ${r.number} • ${r.category_name}`,
        subtitle: `Floor ${r.floor} • Status: ${r.status} • $${r.base_price}/night`,
        icon: BedDouble,
        action: () => {
          onSelectRoom(r);
          onClose();
        },
      }));

    const matchedStays = stays
      .filter(
        (s) =>
          (s.guest_name && s.guest_name.toLowerCase().includes(q)) ||
          s.room_number.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.status.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map((s) => ({
        type: 'STAY' as const,
        id: s.id,
        title: `${s.guest_name || 'Guest'} (Room ${s.room_number})`,
        subtitle: `${s.check_in_date} → ${s.check_out_date} • ${s.status} • Balance: $${(
          (s.total_amount || 0) - (s.deposit_amount || 0)
        ).toFixed(2)}`,
        icon: User,
        action: () => {
          onSelectStay(s);
          onClose();
        },
      }));

    return [...matchedActions, ...matchedRooms, ...matchedStays];
  }, [
    query,
    rooms,
    stays,
    onOpenQuickCheckIn,
    onNavigateTab,
    onOpenNotifications,
    onSelectRoom,
    onSelectStay,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 gap-3 bg-slate-900/90">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % results.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
              } else if (e.key === 'Enter' && results[selectedIndex]) {
                e.preventDefault();
                results[selectedIndex].action();
              }
            }}
            placeholder="Type a command, guest name, or room number..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No matching rooms, guests, or commands found for "{query}".
            </div>
          ) : (
            results.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                    isSelected
                      ? 'bg-amber-500/15 border border-amber-500/30 text-white'
                      : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg ${
                        item.type === 'ACTION'
                          ? 'bg-amber-500/10 text-amber-400'
                          : item.type === 'ROOM'
                          ? 'bg-cyan-500/10 text-cyan-400'
                          : 'bg-purple-500/10 text-purple-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-white">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {item.type}
                    </span>
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-[10px] text-slate-300">
                &uarr; &darr;
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-[10px] text-slate-300">
                &crarr;
              </kbd>{' '}
              Select
            </span>
          </div>
          <div className="flex items-center gap-1 text-amber-400/80 font-medium text-[10px]">
            <Sparkles className="w-3 h-3" />
            <span>Hotel Premium PMS Navigator</span>
          </div>
        </div>
      </div>
    </div>
  );
};
