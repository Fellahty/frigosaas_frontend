import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/hooks/useAuth';
import { useTenantDisplayName } from '../lib/hooks/useTenantDisplayName';
import { LangSwitcher } from '../components/LangSwitcher';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { SeasonProvider } from '../lib/seasons/SeasonProvider';
import { SeasonSelector } from '../components/SeasonSelector';

type NavAccent = 'primary' | 'amber' | 'emerald';

const navItemBaseClass = 'relative group flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-300 border border-transparent backdrop-blur-sm';
const navItemInactiveClass = 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:border-slate-200/80 hover:shadow-sm';
const navAccentActive: Record<NavAccent, string> = {
  primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/20 border-blue-500/40',
  amber: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xl shadow-amber-500/20 border-amber-400/40',
  emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/20 border-emerald-400/40',
};
const navAccentIndicator: Record<NavAccent, string> = {
  primary: 'bg-blue-100/90',
  amber: 'bg-amber-100/90',
  emerald: 'bg-emerald-100/90',
};

const nestedNavAccentActive: Record<NavAccent, string> = {
  primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/15',
  amber: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/15',
  emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/15',
};

const buildNavClass = (active: boolean, accent: NavAccent = 'primary') =>
  `${navItemBaseClass} ${active ? navAccentActive[accent] : navItemInactiveClass}`;

const buildIndicatorClass = (active: boolean, accent: NavAccent = 'primary', offset: string = 'left-2') =>
  `absolute ${offset} top-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ${
    active
      ? `h-8 w-1 ${navAccentIndicator[accent]}`
      : 'h-8 w-0 group-hover:w-1 group-hover:bg-slate-200/80'
  }`;

const buildIconWrapperClass = (active: boolean) =>
  `flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
    active
      ? 'bg-white/20 text-white'
      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
  }`;

const nestedNavItemBaseClass = 'relative group flex items-center gap-3 pl-10 pr-4 py-2.5 text-sm font-medium rounded-2xl transition-all duration-300 border border-transparent backdrop-blur-sm';
const nestedNavInactiveClass = 'text-slate-600 hover:text-slate-900 hover:bg-white/80 hover:border-slate-200/80 hover:shadow-sm';
const buildNestedNavClass = (active: boolean, accent: NavAccent = 'primary') =>
  `${nestedNavItemBaseClass} ${active ? nestedNavAccentActive[accent] : nestedNavInactiveClass}`;

const buildNestedIconWrapperClass = (active: boolean) =>
  `flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
    active
      ? 'bg-white/20 text-white'
      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
  }`;

const buildChevronClass = (active: boolean) =>
  `transition-transform ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`;

const sectionToggleBaseClass = 'relative group flex w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] transition-all duration-200';
const sectionToggleInactiveClass = 'border-slate-200/80 bg-white/70 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-700';
const sectionToggleActive: Record<NavAccent, string> = {
  primary: 'border-blue-200/80 bg-blue-50/80 text-blue-700 shadow-sm shadow-blue-200/40',
  amber: 'border-amber-200/80 bg-amber-50/80 text-amber-600 shadow-sm shadow-amber-200/40',
  emerald: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-600 shadow-sm shadow-emerald-200/40',
};

const buildSectionToggleClass = (active: boolean, accent: NavAccent = 'primary') =>
  `${sectionToggleBaseClass} ${active ? sectionToggleActive[accent] : sectionToggleInactiveClass}`;

const buildSectionChevronClass = (active: boolean) =>
  `transition-transform ${active ? 'text-current' : 'text-slate-400 group-hover:text-slate-600'}`;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const { logout, user } = useAuth();
  const tenantDisplayName = useTenantDisplayName();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    operations: true,
    finance: false,
  });
  const isRtl = typeof document !== 'undefined' && document.documentElement.getAttribute('dir') === 'rtl';
  const inlineEndClass = isRtl ? 'mr-auto' : 'ml-auto';

  const handleLogout = async () => {
    const slug = localStorage.getItem('tenantSlug');
    const result = await logout();
    if (result.success) {
      navigate(slug ? `/login/${slug}` : '/login');
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isSectionActive = (paths: string[]) => {
    return paths.some(path => location.pathname === path);
  };

  const operationsPaths = ['/loans', '/reception', '/operations-overview', '/caution-management', '/pallet-scanner'];
  const operationsActive = isSectionActive(operationsPaths);
  const financePaths = ['/billing', '/caisse'];
  const financeActive = isSectionActive(financePaths);

  return (
    <SeasonProvider>
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200">
      {/* Mobile Top Bar - Compact */}
      <div className="md:hidden sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur shadow-sm">
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
            <div className="flex flex-col items-center justify-center">
              <h1 className="text-xs font-light tracking-wide text-slate-500">{t('common.domain')}</h1>
              <h2 className="text-base font-semibold text-slate-900">{tenantDisplayName}</h2>
            </div>
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
              <p className="text-sm font-light tracking-wide text-slate-500">{t('common.domain')}</p>
              <p className="text-2xl font-semibold text-slate-900">{tenantDisplayName}</p>
            </div>
            <div className="rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 shadow-sm">
              <LangSwitcher />
            </div>
          </div>

          {/* Navigation - Scrollable */}
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
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">{t('common.dashboard', 'Tableau de bord')}</span>
                </Link>
              </li>

              {/* Clients */}
              <li>
                <Link
                  to="/clients"
                  className={buildNavClass(isActive('/clients'))}
                >
                  <span className={buildIndicatorClass(isActive('/clients'))} aria-hidden />
                  <span className={buildIconWrapperClass(isActive('/clients'))}>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">{t('common.clients')}</span>
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
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 012-2h4a2 2 0 012 2v0M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">{t('sidebar.reservations', 'Réservations')}</span>
                </Link>
              </li>

              {/* Capteurs */}
              <li>
                <Link
                  to="/sensors"
                  className={buildNavClass(isActive('/sensors'))}
                >
                  <span className={buildIndicatorClass(isActive('/sensors'))} aria-hidden />
                  <span className={buildIconWrapperClass(isActive('/sensors'))}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">{t('sidebar.sensors', 'Capteurs')}</span>
                </Link>
              </li>

              {/* Opérations */}
              <li>
                <button
                  onClick={() => toggleSection('operations')}
                  className={buildSectionToggleClass(operationsActive, 'primary')}
                  type="button"
                >
                  <span className="flex-1 text-left">{t('sidebar.operations', 'Opérations')}</span>
                  <span className={`${inlineEndClass} ${buildSectionChevronClass(operationsActive)} ${expandedSections.operations ? 'rotate-180' : ''}`}>
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {expandedSections.operations && (
                  <ul className="mt-3 space-y-1.5 ps-1">
                    <li>
                      <Link
                        to="/operations-overview"
                        className={buildNestedNavClass(isActive('/operations-overview'))}
                      >
                        <span className={buildNestedIconWrapperClass(isActive('/operations-overview'))}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </span>
                        <span className="flex-1 text-left">{t('sidebar.operationsOverview', "Vue d'ensemble")}</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/loans"
                        className={buildNestedNavClass(isActive('/loans'))}
                      >
                        <span className={buildNestedIconWrapperClass(isActive('/loans'))}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h14a2 2 0 012 2v8a2 2 0 01-2 2H3V7zm4-4h10a2 2 0 012 2v2H7V3z" />
                          </svg>
                        </span>
                        <span className="flex-1 text-left">{t('loans.title', 'Prêt caisses vides')}</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/reception"
                        className={buildNestedNavClass(isActive('/reception'))}
                      >
                        <span className={buildNestedIconWrapperClass(isActive('/reception'))}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </span>
                        <span className="flex-1 text-left">{t('sidebar.receptionFull', 'Réception pleines')}</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/caution-management"
                        className={buildNestedNavClass(isActive('/caution-management'), 'amber')}
                      >
                        <span className={buildNestedIconWrapperClass(isActive('/caution-management'))}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                        </span>
                        <span className="flex-1 text-left">{t('sidebar.deposits', 'Cautions')}</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/pallet-scanner"
                        className={buildNestedNavClass(isActive('/pallet-scanner'), 'emerald')}
                      >
                        <span className={buildNestedIconWrapperClass(isActive('/pallet-scanner'))}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                        </span>
                        <span className="flex-1 text-left">{t('sidebar.palletScanner', 'Scanner Palette')}</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/operator"
                        className={buildNestedNavClass(isActive('/operator'), 'cyan')}
                      >
                        <span className={buildNestedIconWrapperClass(isActive('/operator'))}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </span>
                        <span className="flex-1 text-left">{t('sidebar.operatorMode', 'Mode opérateur')}</span>
                      </Link>
                    </li>
                  </ul>
                )}
              </li>

              {/* Finance */}
              <li>
                <button
                  onClick={() => toggleSection('finance')}
                  className={buildSectionToggleClass(financeActive, 'amber')}
                  type="button"
                >
                  <span className="flex-1 text-left">{t('sidebar.finance', 'Finance')}</span>
                  <span className={`${inlineEndClass} ${buildSectionChevronClass(financeActive)} ${expandedSections.finance ? 'rotate-180' : ''}`}>
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {expandedSections.finance && (
                  <ul className="mt-3 space-y-1.5 ps-1">
                    <li>
                      <Link
                        to="/billing"
                        className={buildNestedNavClass(isActive('/billing'))}
                      >
                        <span className={buildNestedIconWrapperClass(isActive('/billing'))}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2-2 4 4m0 0l4-4m-4 4V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2h8z" />
                          </svg>
                        </span>
                        <span className="flex-1 text-left">{t('sidebar.invoicesPayments', 'Factures & Paiements')}</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/caisse"
                        className={buildNestedNavClass(isActive('/caisse'))}
                      >
                        <span className={buildNestedIconWrapperClass(isActive('/caisse'))}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                          </svg>
                        </span>
                        <span className="flex-1 text-left">{t('sidebar.cashRegister', 'Caisse')}</span>
                      </Link>
                    </li>
                  </ul>
                )}
              </li>

              {/* Hygiène */}
              <li>
                <Link
                  to="/hygiene"
                  className={buildNavClass(isActive('/hygiene'))}
                >
                  <span className={buildIndicatorClass(isActive('/hygiene'))} aria-hidden />
                  <span className={buildIconWrapperClass(isActive('/hygiene'))}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">{t('sidebar.hygiene', 'Hygiène')}</span>
                </Link>
              </li>

              {/* Paramètres */}
              <li>
                <Link
                  to="/settings"
                  className={buildNavClass(isActive('/settings'))}
                >
                  <span className={buildIndicatorClass(isActive('/settings'))} aria-hidden />
                  <span className={buildIconWrapperClass(isActive('/settings'))}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">{t('sidebar.frigoSettings', 'Paramètres')}</span>
                </Link>
              </li>

              {/* Utilisateurs */}
              <li>
                <Link
                  to="/users"
                  className={buildNavClass(isActive('/users'))}
                >
                  <span className={buildIndicatorClass(isActive('/users'))} aria-hidden />
                  <span className={buildIconWrapperClass(isActive('/users'))}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left">{t('usersRoles.title', 'Utilisateurs')}</span>
                </Link>
              </li>

            </ul>
          </nav>

          {/* Footer - Fixed at bottom */}
          <div className="flex-shrink-0 border-t border-slate-200/70 bg-white/85 px-6 pb-8 pt-6 backdrop-blur">
            {/* User Info with Sync Status */}
            {user && (
              <div className="mb-4 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm shadow-slate-900/5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-sm font-semibold uppercase text-blue-600">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{t(`roles.${user.role}`, user.role)}</p>
                  </div>
                  <SyncStatusIndicator showDetails={false} />
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
              <span className="flex-1 text-left">{t('common.logout')}</span>
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
      <div className={`${isRtl ? 'md:mr-72' : 'md:ml-72'} p-2 md:p-8`}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <SeasonSelector />
          </div>
          {children}
        </div>
      </div>
    </div>
    </SeasonProvider>
  );
};
