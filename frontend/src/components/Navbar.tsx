import React from 'react';
import {
  UserCircle,
  RefreshCw,
  Settings,
  Sparkles,
  LayoutGrid,
  Calendar,
} from 'lucide-react';
import { CurrentUser } from '../types/hotel';

export type ActiveAppView = 'STAFF_PMS' | 'GUEST_PORTAL' | 'RESERVATIONS';

interface NavbarProps {
  onRefresh: () => void;
  isLoading: boolean;
  currentUser: CurrentUser;
  onToggleRole: () => void;
  onOpenAdminPanel: () => void;
  activeView: ActiveAppView;
  onViewChange: (view: ActiveAppView) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onRefresh,
  isLoading,
  currentUser,
  onToggleRole,
  onOpenAdminPanel,
  activeView,
  onViewChange,
}) => {
  return (
    <header className="sticky top-3 z-40 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full transition-all">
      <div className="bg-slate-900/85 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl px-4 py-3 flex items-center justify-between">
        {/* Brand & Monogram */}
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-600 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 text-lg tracking-wider shrink-0 select-none">
            HP
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-serif-luxury font-bold text-lg tracking-tight text-white">Hotel Premium</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Kong 3.9.4 &bull; Kafka 8.3 &bull; Keycloak 26.8 &bull; Postgres 18
            </p>
          </div>
        </div>

        {/* Central Experience Switcher */}
        <div className="hidden md:flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onViewChange('GUEST_PORTAL')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              activeView === 'GUEST_PORTAL'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeView === 'GUEST_PORTAL' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>Guest Portal</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('STAFF_PMS')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              activeView === 'STAFF_PMS'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Room Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('RESERVATIONS')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              activeView === 'RESERVATIONS'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Calendar className={`w-3.5 h-3.5 ${activeView === 'RESERVATIONS' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>Reservations</span>
          </button>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Refresh button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-1.5 border border-slate-700/80 shadow-xs text-xs font-semibold rounded-lg text-slate-200 bg-slate-800/70 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
            title="Refresh Room Matrix & Stays"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:mr-1.5 ${isLoading ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Admin Panel button (Only for ADMIN role) */}
          {currentUser.role === 'ADMIN' ? (
            <button
              type="button"
              onClick={onOpenAdminPanel}
              className="inline-flex items-center px-3 py-1.5 border border-amber-500/30 shadow-xs text-xs font-semibold rounded-lg text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-all"
            >
              <Settings className="w-3.5 h-3.5 sm:mr-1.5 text-amber-400" />
              <span className="hidden sm:inline">Admin Panel</span>
            </button>
          ) : (
            <span className="text-[11px] font-medium text-slate-400 px-2 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 hidden lg:inline-block">
              Basic User
            </span>
          )}

          {/* Role Toggle Switcher */}
          <button
            type="button"
            onClick={onToggleRole}
            className="flex items-center space-x-2 pl-2 pr-3 py-1.5 border border-slate-800 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 transition-all text-left"
            title="Click to toggle user role"
          >
            <UserCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="hidden sm:block">
              <p className="text-xs font-bold leading-none text-slate-200">{currentUser.fullName}</p>
              <div className="flex items-center space-x-1.5 mt-1">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    currentUser.role === 'ADMIN' ? 'bg-amber-400 shadow-xs shadow-amber-400/50' : 'bg-emerald-400 shadow-xs shadow-emerald-400/50'
                  }`}
                />
                <span className="text-[10px] font-semibold text-slate-400 leading-none">
                  {currentUser.role === 'ADMIN' ? 'admin_user' : 'basic_user'}
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Experience Switcher (Row 2 for small screens) */}
      <div className="flex md:hidden items-center justify-between bg-slate-900/90 backdrop-blur-xl p-1 mt-2 rounded-xl border border-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => onViewChange('GUEST_PORTAL')}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeView === 'GUEST_PORTAL'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Guest Portal
        </button>
        <button
          type="button"
          onClick={() => onViewChange('STAFF_PMS')}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeView === 'STAFF_PMS'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Room Matrix
        </button>
        <button
          type="button"
          onClick={() => onViewChange('RESERVATIONS')}
          className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
            activeView === 'RESERVATIONS'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Reservations
        </button>
      </div>
    </header>
  );
};
