import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/hooks/useAuth';
import { useTenantDisplayName } from '../lib/hooks/useTenantDisplayName';
import { LangSwitcher } from '../components/LangSwitcher';

type NavAccent = 'primary';

const navItemBaseClass = 'relative group flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-300 border border-transparent backdrop-blur-sm';
const navItemInactiveClass = 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:border-slate-200/80 hover:-translate-y-0.5 hover:shadow-sm';
const navAccentActive: Record<NavAccent, string> = {
  primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/20 border-blue-500/40',
};
const navAccentIndicator: Record<NavAccent, string> = {
  primary: 'bg-blue-100/90',
};

const buildNavClass = (active: boolean, accent: NavAccent = 'primary') =>
  `${navItemBaseClass} ${active ? navAccentActive[accent] : navItemInactiveClass}`;

const buildIndicatorClass = (active: boolean, accent: NavAccent = 'primary') =>
  `absolute left-2 top-1/2 h-8 w-1 rounded-full -translate-y-1/2 transition-all duration-300 ${
    active ? navAccentIndicator[accent] : 'bg-transparent group-hover:bg-slate-200/80'
  }`;

const buildIconWrapperClass = (active: boolean) =>
  `flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
    active
      ? 'bg-white/20 text-white'
      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
  }`;

interface ClientLayoutProps {
  children: React.ReactNode;
}

export const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const { logout, user } = useAuth();
  const tenantDisplayName = useTenantDisplayName();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const isRtl = typeof document !== 'undefined' && document.documentElement.getAttribute('dir') === 'rtl';

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      navigate('/login');
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200">
      {/* Mobile Top Bar */}
      <div className="md:hidden sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            aria-label="Toggle menu"
            onClick={() => setIsSidebarOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/80 text-slate-600 transition-all duration-200 hover:border-slate-300 hover:text-slate-900 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-sm font-semibold text-slate-900">{tenantDisplayName}</h1>
            {user && (
              <p className="text-xs text-slate-500">{user.name} • {t('roles.client', 'Client')}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 shadow-sm">
              <LangSwitcher />
            </div>
            {user && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-medium uppercase text-blue-700">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed top-0 bottom-0 ${
          isRtl ? 'right-0 md:rounded-l-3xl md:top-6 md:bottom-6' : 'left-0 md:rounded-r-3xl md:top-6 md:bottom-6'
        } w-72 border border-slate-200/60 bg-white/90 backdrop-blur-xl shadow-xl shadow-slate-900/10 z-50 transition-transform duration-300 md:translate-x-0 ${
          isSidebarOpen
            ? 'translate-x-0'
            : isRtl
              ? 'translate-x-full md:translate-x-0'
              : '-translate-x-full md:translate-x-0'
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="hidden md:flex items-center justify-between px-6 pb-6 pt-8">
            <div className="space-y-1">
              <p className="text-sm font-light tracking-wide text-slate-500">{t('roles.client', 'Client')}</p>
              <p className="text-2xl font-semibold text-slate-900">{tenantDisplayName}</p>
            </div>
            <div className="rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 shadow-sm">
              <LangSwitcher />
            </div>
          </div>

          {/* Navigation */}
          <nav className="relative flex-1 overflow-y-auto px-5 pt-4 pb-8 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            <ul className="space-y-2 pb-10">
              {/* Dashboard */}
              <li>
                <Link
                  to="/dashboard"
                  className={buildNavClass(isActive('/dashboard'))}
                >
                  <span className={buildIndicatorClass(isActive('/dashboard'))} aria-hidden />
                  <span className={buildIconWrapperClass(isActive('/dashboard'))}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">{t('common.dashboard', 'Tableau de bord')}</span>
                </Link>
              </li>

              {/* Réservations */}
              <li>
                <Link
                  to="/reservations"
                  className={buildNavClass(isActive('/reservations'))}
                >
                  <span className={buildIndicatorClass(isActive('/reservations'))} aria-hidden />
                  <span className={buildIconWrapperClass(isActive('/reservations'))}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 012-2h4a2 2 0 012 2v0M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">{t('sidebar.reservations', 'Mes Réservations')}</span>
                </Link>
              </li>

              {/* Opérations */}
              <li>
                <Link
                  to="/operations"
                  className={buildNavClass(isActive('/operations'))}
                >
                  <span className={buildIndicatorClass(isActive('/operations'))} aria-hidden />
                  <span className={buildIconWrapperClass(isActive('/operations'))}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">{t('sidebar.operations', 'Mes Opérations')}</span>
                </Link>
              </li>

              {/* Capteurs */}
              <li>
                <Link
                  to="/client-sensors"
                  className={buildNavClass(isActive('/client-sensors'))}
                >
                  <span className={buildIndicatorClass(isActive('/client-sensors'))} aria-hidden />
                  <span className={buildIconWrapperClass(isActive('/client-sensors'))}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">{t('sidebar.clientSensors', 'Mes Capteurs')}</span>
                </Link>
              </li>
            </ul>
          </nav>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-slate-200/70 bg-white/85 px-6 pb-8 pt-6 backdrop-blur">
            {/* User Info */}
            {user && (
              <div className="mb-4 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm shadow-slate-900/5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-sm font-semibold uppercase text-blue-600">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                    <p className="text-xs text-blue-600">{t('roles.client', 'Client')}</p>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={handleLogout}
              className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-600 transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-red-100 group-hover:text-red-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </span>
              <span className="flex-1 text-left">{t('common.logout', 'Déconnexion')}</span>
              <svg className="h-4 w-4 text-slate-400 transition-colors group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className={`${isRtl ? 'md:mr-72' : 'md:ml-72'} p-4 md:p-8`}>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
