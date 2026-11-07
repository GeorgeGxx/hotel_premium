import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  Calendar,
  Sparkles,
  CreditCard,
  AlertTriangle,
  UserCheck,
  LogOut,
  X,
} from 'lucide-react';
import { AppNotification, NotificationCategory } from '../types/hotel';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onDismissNotification: (id: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAllAsRead,
  onClearAll,
  onDismissNotification,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [filter, setFilter] = useState<'ALL' | NotificationCategory>('ALL');
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'ALL') return true;
    return n.category === filter;
  });

  const getCategoryIcon = (cat: NotificationCategory) => {
    switch (cat) {
      case 'RESERVATION':
        return <Calendar className="w-4 h-4 text-amber-400" />;
      case 'CHECK_IN':
        return <UserCheck className="w-4 h-4 text-emerald-400" />;
      case 'CHECK_OUT':
        return <LogOut className="w-4 h-4 text-blue-400" />;
      case 'HOUSEKEEPING':
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case 'FOLIO':
        return <CreditCard className="w-4 h-4 text-indigo-400" />;
      case 'SYSTEM':
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  const getCategoryBadgeClass = (cat: NotificationCategory) => {
    switch (cat) {
      case 'RESERVATION':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      case 'CHECK_IN':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'CHECK_OUT':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      case 'HOUSEKEEPING':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
      case 'FOLIO':
        return 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
      case 'SYSTEM':
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
    }
  };

  const formatTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open Notifications Center"
        className={`relative inline-flex items-center px-3 py-1.5 border shadow-xs text-xs font-semibold rounded-xl transition-all ${
          isOpen
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            : 'border-slate-800 bg-slate-950/70 hover:bg-slate-800 text-slate-300 hover:text-white'
        }`}
        title="Live Operations & Notification Center"
      >
        <Bell className={`w-3.5 h-3.5 sm:mr-1.5 ${unreadCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
        <span className="hidden sm:inline">Feed</span>
        {unreadCount > 0 && (
          <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full shadow-xs shadow-amber-500/50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Panel / Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[32rem] bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl shadow-black/80 z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-xs">Live Operations Feed</h4>
                <p className="text-[10px] text-slate-400">Real-time PMS &amp; Guest events</p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 text-xs">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-lg transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800/60 rounded-lg transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
            {(['ALL', 'RESERVATION', 'CHECK_IN', 'CHECK_OUT', 'HOUSEKEEPING', 'FOLIO'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 ${
                  filter === cat
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800'
                }`}
              >
                {cat === 'ALL' ? 'All' : cat.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 p-2 space-y-1">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <Bell className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="font-semibold text-slate-400">No operational alerts yet</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Live events will stream here automatically.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-2xl transition-all relative flex items-start space-x-3 text-xs ${
                    notif.read ? 'bg-slate-950/30 hover:bg-slate-800/40' : 'bg-slate-800/50 hover:bg-slate-800/70 border border-amber-500/20'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                    {getCategoryIcon(notif.category)}
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getCategoryBadgeClass(notif.category)}`}>
                        {notif.category}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formatTime(notif.timestamp)}
                      </span>
                    </div>

                    <p className="font-bold text-white text-xs mt-1 truncate">
                      {notif.title}
                    </p>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed break-words">
                      {notif.message}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDismissNotification(notif.id)}
                    className="absolute top-2.5 right-2 text-slate-500 hover:text-slate-300 p-1 rounded-md"
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer Status */}
          <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real-Time Stream Active</span>
            </span>
            <span>Zero-Delay WebSocket/SSE</span>
          </div>
        </div>
      )}
    </div>
  );
};
