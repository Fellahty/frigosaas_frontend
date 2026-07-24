import React, { useCallback, useEffect, useState } from 'react';
import { platformApiRequest } from '../../lib/platformAuth';
import type { SystemInfo } from './types';
import { AdminPageHeader } from './components/AdminPageHeader';
import { AdminLoading } from './components/AdminLoading';
import { AdminButton, AdminCard, AdminCardHeader, AdminPageShell } from './components/admin-ui';

export const AdminSystemPage: React.FC = () => {
  const [data, setData] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    platformApiRequest<SystemInfo>('/admin/system')
      .then(setData)
      .catch(() => setError('Accès refusé ou erreur serveur'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <AdminPageShell>
        <AdminLoading label="Analyse système..." />
      </AdminPageShell>
    );
  }

  const poolPct = data
    ? Math.round((data.tenantConnections.active / data.tenantConnections.max) * 100)
    : 0;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Système"
        subtitle="Infrastructure multi-tenant & performance"
        actions={
          <AdminButton variant="secondary" onClick={load}>
            Actualiser
          </AdminButton>
        }
      />

      {error && (
        <AdminCard className="mb-6 border-red-200 bg-red-50 text-red-700">{error}</AdminCard>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <AdminCard>
            <AdminCardHeader
              title="Connexions tenant"
              description="Pool LRU MongoDB"
            />
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-slate-900">{data.tenantConnections.active}</span>
              <span className="mb-1 text-lg text-slate-400">/ {data.tenantConnections.max}</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  poolPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${poolPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">{poolPct}% du pool utilisé</p>
            {data.tenantConnections.databases.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {data.tenantConnections.databases.map((db) => (
                  <span
                    key={db}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-600"
                  >
                    {db}
                  </span>
                ))}
              </div>
            )}
          </AdminCard>

          <AdminCard>
            <AdminCardHeader title="Cache organisations" description="Résolution slug / legacyId" />
            <p className="text-4xl font-bold text-slate-900">{data.orgCache.size}</p>
            <p className="mt-1 text-sm text-slate-500">
              entrées en cache · TTL {(data.orgCache.ttlMs / 1000).toFixed(0)}s
            </p>
            <div className="mt-4 rounded-xl bg-cyan-50 p-4 text-xs text-cyan-800">
              Le cache accélère la résolution des tenants à chaque requête API.
            </div>
          </AdminCard>

          <AdminCard className="lg:col-span-2">
            <AdminCardHeader title="Architecture plateforme" />
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: 'Registry',
                  desc: 'frigosmart_platform',
                  detail: 'Organizations, Subscriptions, PlatformUsers',
                  color: 'from-cyan-500 to-teal-600',
                },
                {
                  title: 'Tenant DB',
                  desc: 'frigo_{slug}',
                  detail: 'Données isolées par client frigo',
                  color: 'from-cyan-500 to-blue-600',
                },
                {
                  title: 'Authentification',
                  desc: 'Dual JWT',
                  detail: 'scope: platform ≠ scope: tenant',
                  color: 'from-emerald-500 to-teal-600',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className={`mb-3 inline-flex rounded-lg bg-gradient-to-br ${item.color} px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white`}>
                    {item.title}
                  </div>
                  <p className="font-mono text-sm font-semibold text-slate-900">{item.desc}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      )}
    </AdminPageShell>
  );
};
