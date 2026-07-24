import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformApiRequest } from '../../lib/platformAuth';
import type { DashboardData } from './types';
import { StatCard } from './components/StatCard';
import { StatusBadge } from './components/StatusBadge';
import { AdminPageHeader } from './components/AdminPageHeader';
import { AdminLoading } from './components/AdminLoading';
import { AdminAlertsPanel } from './components/AdminAlertsPanel';
import { PlatformTrendChart } from './components/UsageCharts';
import {
  AdminButton,
  AdminLinkButton,
  AdminCard,
  AdminPageShell,
  AdminTableShell,
  AdminTableHead,
  AdminTh,
  AdminTableBody,
  AdminEmptyState,
  OrgAvatar,
} from './components/admin-ui';

export const AdminDashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    platformApiRequest<DashboardData>('/admin/dashboard')
      .then(setData)
      .catch(() => setError('Impossible de charger le tableau de bord'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <AdminPageShell>
        <AdminLoading />
      </AdminPageShell>
    );
  }

  if (!data) {
    return (
      <AdminPageShell>
        <AdminCard className="border-red-200 bg-red-50 text-red-700">{error}</AdminCard>
      </AdminPageShell>
    );
  }

  const { stats, usage, alerts = [], trend = [] } = data;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de votre plateforme multi-tenant"
        badge={
          <>
            <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-800 ring-1 ring-cyan-700/20">
              {stats.totalFrigos} client{stats.totalFrigos > 1 ? 's' : ''}
            </span>
            {(stats.criticalAlerts ?? 0) > 0 && (
              <Link
                to="/admin/alerts"
                className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200"
              >
                {stats.criticalAlerts} alerte{(stats.criticalAlerts ?? 0) > 1 ? 's' : ''}
              </Link>
            )}
          </>
        }
        actions={
          <>
            <AdminButton variant="secondary" onClick={() => load(true)} disabled={refreshing}>
              <svg
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Actualiser
            </AdminButton>
            <AdminLinkButton to="/admin/organizations" variant="primary">
              + Nouveau client
            </AdminLinkButton>
          </>
        }
      />

      {/* Status overview strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Actifs', value: stats.active, color: 'bg-emerald-500' },
          { label: 'En essai', value: stats.trial, color: 'bg-amber-500' },
          { label: 'Suspendus', value: stats.suspended, color: 'bg-red-500' },
          { label: 'Total', value: stats.totalFrigos, color: 'bg-cyan-500' },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
          >
            <span className={`h-2 w-2 rounded-full ${s.color}`} />
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-lg font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <AdminCard className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">À traiter</h2>
              <p className="text-xs text-slate-500">
                {alerts.length} alerte{alerts.length > 1 ? 's' : ''} sur la plateforme
              </p>
            </div>
            <Link to="/admin/alerts" className="text-sm font-medium text-cyan-700 hover:underline">
              Tout voir →
            </Link>
          </div>
          <AdminAlertsPanel alerts={alerts} compact />
        </AdminCard>
      )}

      {trend.length > 0 && (
        <AdminCard className="mb-8">
          <div className="mb-2">
            <h2 className="font-semibold text-slate-900">Activité plateforme (30 jours)</h2>
            <p className="text-xs text-slate-500">Réceptions et réservations tous clients confondus</p>
          </div>
          <PlatformTrendChart data={trend} />
        </AdminCard>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Clients frigo"
          value={stats.totalFrigos}
          hint={`${stats.active} actifs · ${stats.trial} en essai`}
          accent="cyan"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
            </svg>
          }
        />
        <StatCard
          label="MRR estimé"
          value={`${(stats.mrr ?? 0).toLocaleString('fr-FR')}`}
          hint="MAD / mois · abonnements actifs"
          accent="emerald"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Clients finaux"
          value={stats.totalClients.toLocaleString('fr-FR')}
          hint="Agriculteurs & grossistes"
          accent="blue"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
            </svg>
          }
        />
        <StatCard
          label="Chambres froid"
          value={stats.totalRooms.toLocaleString('fr-FR')}
          hint="Capacité totale gérée"
          accent="amber"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
      </div>

      <AdminCard padding={false}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Usage par client</h2>
            <p className="text-xs text-slate-500">Métriques live depuis chaque base tenant</p>
          </div>
          <Link
            to="/admin/organizations"
            className="text-sm font-medium text-cyan-700 hover:text-cyan-500"
          >
            Voir tout →
          </Link>
        </div>

        {usage.length === 0 ? (
          <AdminEmptyState
            title="Aucun client enregistré"
            description="Créez votre premier frigo pour démarrer la plateforme."
            action={
              <AdminLinkButton to="/admin/organizations" variant="primary">
                Créer un client
              </AdminLinkButton>
            }
            icon={
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
              </svg>
            }
          />
        ) : (
          <AdminTableShell minWidth="860px">
            <AdminTableHead>
              <AdminTh>Client</AdminTh>
              <AdminTh>Plan</AdminTh>
              <AdminTh>Statut</AdminTh>
              <AdminTh align="right">Clients</AdminTh>
              <AdminTh align="right">Chambres</AdminTh>
              <AdminTh align="right">Users</AdminTh>
              <AdminTh align="right">Réceptions</AdminTh>
              <AdminTh align="right" />
            </AdminTableHead>
            <AdminTableBody>
              {usage.map((u) => (
                <tr key={u.organizationId} className="transition hover:bg-cyan-50/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <OrgAvatar name={u.organizationName} size="sm" />
                      <div>
                        <p className="font-medium text-slate-900">{u.organizationName}</p>
                        <p className="font-mono text-[11px] text-slate-400">{u.legacyId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={u.plan} type="plan" />
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums font-medium text-slate-700">
                    {u.clientsCount}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-600">{u.roomsCount}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-600">{u.usersCount}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-600">
                    {u.receptionsCount}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/admin/organizations/${u.organizationId}`}
                      className="inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-cyan-700 hover:text-white"
                    >
                      Gérer
                    </Link>
                  </td>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableShell>
        )}
      </AdminCard>
    </AdminPageShell>
  );
};
