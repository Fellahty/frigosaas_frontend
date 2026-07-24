import React, { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearPlatformAuth, getPlatformUser } from '../../lib/platformAuth';
import { FrigoSmartLogo } from './components/FrigoSmartLogo';

const navItems = [
  {
    to: '/admin',
    end: true,
    label: 'Tableau de bord',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    to: '/admin/organizations',
    label: 'Clients frigo',
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    to: '/admin/alerts',
    label: 'Alertes',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    to: '/admin/activity',
    label: 'Journal',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    to: '/admin/subscriptions',
    label: 'Abonnements',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    to: '/admin/system',
    label: 'Système',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
  },
];

function usePageTitle(): string {
  const { pathname } = useLocation();
  return useMemo(() => {
    if (pathname === '/admin') return 'Tableau de bord';
    if (pathname.startsWith('/admin/organizations/')) return 'Détail client';
    if (pathname === '/admin/organizations') return 'Clients frigo';
    if (pathname === '/admin/alerts') return 'Alertes';
    if (pathname === '/admin/activity') return 'Journal';
    if (pathname === '/admin/subscriptions') return 'Abonnements';
    if (pathname === '/admin/system') return 'Système';
    return 'Administration';
  }, [pathname]);
}

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitle = usePageTitle();
  const user = getPlatformUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logout = () => {
    clearPlatformAuth();
    navigate('/admin/login');
  };

  const sidebar = (
    <>
      <div className="border-b border-slate-200/80 px-5 py-5">
        <FrigoSmartLogo />
        <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-700/70">
          Console plateforme
        </p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Navigation
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-cyan-50 text-cyan-900 shadow-sm ring-1 ring-cyan-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    isActive
                      ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/25'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/80'
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200/80 p-4">
        {user && (
          <div className="mb-3 rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600 text-sm font-semibold text-white shadow-sm shadow-cyan-600/20">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="truncate text-[11px] text-slate-500">{user.email}</p>
              </div>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Déconnexion
        </button>
        <Link
          to="/login/demo"
          className="mt-1 flex items-center gap-2 px-3 py-2 text-[11px] text-slate-400 transition hover:text-cyan-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Voir le frigo démo
        </Link>
      </div>
    </>
  );

  return (
    <div className="admin-shell min-h-screen">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm"
          aria-label="Menu"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-slate-900">{pageTitle}</span>
        <FrigoSmartLogo variant="icon" className="h-8 w-8" />
      </header>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/25 backdrop-blur-[3px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fermer"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[16.5rem] flex-col border-r border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-300/40 backdrop-blur-xl transition-transform duration-300 ease-out lg:translate-x-0 lg:bg-white lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      <div className="lg:pl-[16.5rem]">
        <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-slate-200/70 bg-white/75 px-8 py-3.5 backdrop-blur-xl lg:flex">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700/60">
              FrigoSmart Admin
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-medium text-emerald-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Plateforme active
            </span>
            {user && (
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-xs font-bold text-white">
                  {user.name.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold leading-tight text-slate-900">
                    {user.name.split(' ')[0]}
                  </p>
                  <p className="text-[10px] capitalize text-slate-400">
                    {user.role.replace('_', ' ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)]">
          <Outlet key={location.pathname} />
        </main>
      </div>
    </div>
  );
};
