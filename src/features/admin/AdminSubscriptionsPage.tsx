import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformApiRequest } from '../../lib/platformAuth';
import type { Organization, Subscription } from './types';
import { StatusBadge } from './components/StatusBadge';
import { StatCard } from './components/StatCard';
import { AdminPageHeader } from './components/AdminPageHeader';
import { AdminLoading } from './components/AdminLoading';
import {
  AdminCard,
  AdminPageShell,
  AdminTableShell,
  AdminTableHead,
  AdminTh,
  AdminTableBody,
  AdminEmptyState,
  OrgAvatar,
} from './components/admin-ui';

export const AdminSubscriptionsPage: React.FC = () => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      platformApiRequest<Subscription[]>('/admin/subscriptions'),
      platformApiRequest<Organization[]>('/admin/organizations'),
    ])
      .then(([s, o]) => {
        setSubs(s);
        setOrgs(o);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const orgMap = useMemo(() => new Map(orgs.map((o) => [o._id, o])), [orgs]);
  const mrr = subs
    .filter((s) => s.status === 'active' || s.status === 'trialing')
    .reduce((sum, s) => sum + (s.priceMonthly || 0), 0);

  if (loading) {
    return (
      <AdminPageShell>
        <AdminLoading />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Abonnements"
        subtitle="Suivi des revenus récurrents et statuts de paiement"
        badge={
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
            MRR {mrr.toLocaleString('fr-FR')} MAD
          </span>
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Actifs / essai"
          value={subs.filter((s) => s.status === 'active' || s.status === 'trialing').length}
          accent="emerald"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatCard
          label="Impayés"
          value={subs.filter((s) => s.status === 'past_due').length}
          accent="amber"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
            </svg>
          }
        />
        <StatCard
          label="Annulés"
          value={subs.filter((s) => s.status === 'cancelled').length}
          accent="red"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          }
        />
      </div>

      <AdminCard padding={false}>
        {subs.length === 0 ? (
          <AdminEmptyState
            title="Aucun abonnement"
            description="Les abonnements apparaissent lors de la configuration d'un client."
          />
        ) : (
          <AdminTableShell>
            <AdminTableHead>
              <AdminTh>Client</AdminTh>
              <AdminTh>Plan</AdminTh>
              <AdminTh>Statut</AdminTh>
              <AdminTh align="right">Prix/mois</AdminTh>
              <AdminTh>Cycle</AdminTh>
              <AdminTh>Début</AdminTh>
              <AdminTh align="right" />
            </AdminTableHead>
            <AdminTableBody>
              {subs.map((s) => {
                const org = orgMap.get(s.organizationId);
                return (
                  <tr key={s._id} className="transition hover:bg-cyan-50/30">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {org && <OrgAvatar name={org.name} size="sm" />}
                        <span className="font-medium text-slate-900">{org?.name || s.organizationId}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={s.plan} type="plan" />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={s.status} type="sub" />
                    </td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-900">
                      {(s.priceMonthly || 0).toLocaleString('fr-FR')}{' '}
                      <span className="text-xs font-normal text-slate-400">{s.currency || 'MAD'}</span>
                    </td>
                    <td className="px-5 py-4 capitalize text-slate-600">{s.billingCycle || 'monthly'}</td>
                    <td className="px-5 py-4 text-slate-500">
                      {s.startDate ? new Date(s.startDate).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {org && (
                        <Link
                          to={`/admin/organizations/${org._id}`}
                          className="text-xs font-semibold text-cyan-700 hover:text-cyan-500"
                        >
                          Gérer →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </AdminTableBody>
          </AdminTableShell>
        )}
      </AdminCard>
    </AdminPageShell>
  );
};
