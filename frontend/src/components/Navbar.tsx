import React from 'react';
import {
  Hotel,
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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white p-2 rounded-xl shadow-md">
              <Hotel className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">Hotel Premium</span>
                <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Kong 3.14 &bull; Kafka 7.8 &bull; Keycloak 26.8 &bull; Postgres 18
              </p>
            </div>
          </div>

          {/* Central Experience Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button
              type="button"
              onClick={() => onViewChange('GUEST_PORTAL')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeView === 'GUEST_PORTAL'
                  ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Guest Portal</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange('STAFF_PMS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeView === 'STAFF_PMS'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
              <span>Room Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange('RESERVATIONS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeView === 'RESERVATIONS'
                  ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>Reservations</span>
            </button>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2.5">
            {/* Refresh button */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-1.5 border border-slate-300 shadow-xs text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
              title="Refresh Room Matrix & Stays"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>

            {/* Admin Panel button (Only for ADMIN role) */}
            {currentUser.role === 'ADMIN' ? (
              <button
                type="button"
                onClick={onOpenAdminPanel}
                className="inline-flex items-center px-3 py-1.5 border border-indigo-300 shadow-xs text-xs font-semibold rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden lg:inline">Admin Panel</span>
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-slate-500 px-2 py-1 rounded bg-slate-100 border border-slate-200 hidden sm:inline-block">
                Basic User (Reservations Mode)
              </span>
            )}

            {/* Role Toggle Switcher */}
            <button
              type="button"
              onClick={onToggleRole}
              className="flex items-center space-x-2 pl-2 pr-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Click to toggle user role"
            >
              <UserCircle className="w-5 h-5 text-indigo-600" />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold leading-none text-slate-800">{currentUser.fullName}</p>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      currentUser.role === 'ADMIN' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                  <span className="text-[10px] font-semibold text-slate-500 leading-none">
                    {currentUser.role === 'ADMIN' ? 'admin_user' : 'basic_user'}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
