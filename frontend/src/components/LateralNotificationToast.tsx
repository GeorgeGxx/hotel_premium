import React, { useEffect } from 'react';
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
}

export const LateralNotificationToast: React.FC<LateralNotificationToastProps> = ({
  notification,
  onDismiss,
}) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 5500);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const getIcon = (cat: NotificationCategory) => {
    switch (cat) {
      case 'RESERVATION':
        return <Calendar className="w-5 h-5 text-amber-400" />;
      case 'CHECK_IN':
        return <UserCheck className="w-5 h-5 text-emerald-400" />;
      case 'CHECK_OUT':
        return <LogOut className="w-5 h-5 text-blue-400" />;
      case 'HOUSEKEEPING':
        return <Sparkles className="w-5 h-5 text-cyan-400" />;
      case 'FOLIO':
        return <CreditCard className="w-5 h-5 text-indigo-400" />;
      case 'SYSTEM':
      default:
        return <CheckCircle2 className="w-5 h-5 text-amber-400" />;
    }
  };

  const getBorderColor = (cat: NotificationCategory) => {
    switch (cat) {
      case 'RESERVATION':
        return 'border-amber-500/50 shadow-amber-500/10';
      case 'CHECK_IN':
        return 'border-emerald-500/50 shadow-emerald-500/10';
      case 'CHECK_OUT':
        return 'border-blue-500/50 shadow-blue-500/10';
      case 'HOUSEKEEPING':
        return 'border-cyan-500/50 shadow-cyan-500/10';
      case 'FOLIO':
        return 'border-indigo-500/50 shadow-indigo-500/10';
      case 'SYSTEM':
      default:
        return 'border-slate-700 shadow-slate-900/50';
    }
  };

  return (
    <div className="fixed top-20 right-3 sm:right-6 left-3 sm:left-auto z-[9999] max-w-sm w-auto sm:w-full pointer-events-auto animate-in slide-in-from-right-8 fade-in duration-300">
      <div
        className={`bg-slate-900/95 backdrop-blur-xl rounded-2xl border p-4 shadow-2xl ${getBorderColor(
          notification.category
        )} text-slate-100 flex items-start space-x-3 relative overflow-hidden`}
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
          {getIcon(notification.category)}
        </div>

        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              {notification.category}
            </span>
            <span className="text-[10px] text-slate-500">&bull; Just now</span>
          </div>
          <h5 className="font-bold text-white text-xs mt-0.5">{notification.title}</h5>
          <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed break-words">
            {notification.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          title="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
