import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Sparkles,
  Calendar,
  CreditCard,
  UserCheck,
  LogOut,
  X,
} from 'lucide-react';
import { AppNotification, NotificationCategory } from '../types/hotel';

interface LateralNotificationToastProps {
  notification: AppNotification | null;
  onDismiss: () => void;
  durationMs?: number;
}

export const LateralNotificationToast: React.FC<LateralNotificationToastProps> = ({
  notification,
  onDismiss,
  durationMs = 5000,
}) => {
  const [isPaused, setIsPaused] = useState<boolean>(false);

  useEffect(() => {
    if (!notification || isPaused) return;
    // Safety fallback timer matching the countdown bar duration
    const timer = setTimeout(() => {
      onDismiss();
    }, durationMs + 200);
    return () => clearTimeout(timer);
  }, [notification, onDismiss, durationMs, isPaused]);

  if (!notification) return null;

  const getIcon = (cat: NotificationCategory) => {
    switch (cat) {
      case 'RESERVATION':
        return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      case 'CHECK_IN':
        return <UserCheck className="w-3.5 h-3.5 text-emerald-400" />;
      case 'CHECK_OUT':
        return <LogOut className="w-3.5 h-3.5 text-blue-400" />;
      case 'HOUSEKEEPING':
        return <Sparkles className="w-3.5 h-3.5 text-cyan-400" />;
      case 'FOLIO':
        return <CreditCard className="w-3.5 h-3.5 text-indigo-400" />;
      case 'SYSTEM':
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const getIconBg = (cat: NotificationCategory) => {
    switch (cat) {
      case 'RESERVATION':
        return 'bg-amber-500/15 border-amber-500/30';
      case 'CHECK_IN':
        return 'bg-emerald-500/15 border-emerald-500/30';
      case 'CHECK_OUT':
        return 'bg-blue-500/15 border-blue-500/30';
      case 'HOUSEKEEPING':
        return 'bg-cyan-500/15 border-cyan-500/30';
      case 'FOLIO':
        return 'bg-indigo-500/15 border-indigo-500/30';
      case 'SYSTEM':
      default:
        return 'bg-slate-800/70 border-slate-700/60';
    }
  };

  const getCardBorder = (cat: NotificationCategory) => {
    switch (cat) {
      case 'RESERVATION':
        return 'border-amber-500/30 hover:border-amber-500/50 shadow-amber-500/5';
      case 'CHECK_IN':
        return 'border-emerald-500/30 hover:border-emerald-500/50 shadow-emerald-500/5';
      case 'CHECK_OUT':
        return 'border-blue-500/30 hover:border-blue-500/50 shadow-blue-500/5';
      case 'HOUSEKEEPING':
        return 'border-cyan-500/30 hover:border-cyan-500/50 shadow-cyan-500/5';
      case 'FOLIO':
        return 'border-indigo-500/30 hover:border-indigo-500/50 shadow-indigo-500/5';
      case 'SYSTEM':
      default:
        return 'border-slate-800 hover:border-slate-700';
    }
  };

  return (
    <div
      className="fixed top-20 right-3 sm:right-6 z-[9999] w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] pointer-events-auto animate-in slide-in-from-right-6 fade-in duration-200"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={`bg-slate-900/95 backdrop-blur-xl rounded-2xl border px-3.5 py-2.5 shadow-2xl shadow-black/80 text-slate-100 flex items-start space-x-2.5 relative overflow-hidden group transition-all ${getCardBorder(
          notification.category
        )}`}
      >
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute -top-6 -right-6 w-16 h-16 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

        {/* Compact Icon Badge */}
        <div
          className={`w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${getIconBg(
            notification.category
          )}`}
        >
          {getIcon(notification.category)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-bold tracking-wider uppercase text-amber-400 truncate">
              {notification.category}
            </span>
            <span className="text-[9px] text-slate-500 shrink-0">
              {isPaused ? 'Paused' : 'Just now'}
            </span>
          </div>
          <h5 className="font-semibold text-white text-xs leading-snug truncate mt-0.5">
            {notification.title}
          </h5>
          <p className="text-slate-300 text-[11px] leading-tight line-clamp-2 mt-0.5">
            {notification.message}
          </p>
        </div>

        {/* Minimalist Close Action */}
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          title="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Gradual Inverse Progress Countdown Line (Decreasing from 100% to 0%) */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-800/80 overflow-hidden">
          <div
            key={notification.id}
            onAnimationEnd={onDismiss}
            style={{
              animation: `toastCountdown ${durationMs}ms linear forwards`,
              animationPlayState: isPaused ? 'paused' : 'running',
            }}
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 shadow-xs shadow-amber-400/50"
          />
        </div>
      </div>
    </div>
  );
};
