import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformApiRequest } from '../../lib/platformAuth';
import type { AuditLogEntry, AuditLogResponse } from './types';
import { AdminPageHeader } from './components/AdminPageHeader';
import { AdminLoading } from './components/AdminLoading';
import {
  AdminCard,
  AdminFilterPills,
  AdminPageShell,
  AdminTableBody,
  AdminTableHead,
  AdminTableShell,
  AdminTh,
  AdminEmptyState,
} from './components/admin-ui';

const ADMIN_ACTION_LABELS: Record<string, string> = {
  'org.create': 'Création client',
  'org.update': 'Modification client',
  'org.suspend': 'Suspension client',
  'org.activate': 'Activation client',
  'access.user.block': 'Blocage utilisateur',
  'access.user.unblock': 'Déblocage utilisateur',
  'access.user.password': 'Reset mot de passe (équipe)',
  'access.client.block': 'Blocage client final',
  'access.client.unblock': 'Déblocage client final',
  'access.client.password': 'Reset mot de passe (client)',
  'subscription.create': 'Création abonnement',
  'subscription.update': 'Modification abonnement',
};

const INTERACTION_LABELS: Record<string, string> = {
  'auth.login': 'Connexion',
  'clients.create': 'Création client',
  'clients.update': 'Modification client',
  'users.create': 'Création utilisateur',
  'receptions.create': 'Nouvelle réception',
  'reservations.create': 'Nouvelle réservation',
};

interface LoginLog {
  id: string;
  organizationName?: string;
  legacyId?: string;
  userName: string;
  userEmail?: string;
  userType?: string;
  scope: string;
  createdAt: string;
}

interface InteractionLog {
  id: string;
  organizationName?: string;
  legacyId: string;
  organizationId: string;
  userName: string;
  action: string;
  summary?: string;
  createdAt: string;
}

type Tab = 'admin' | 'logins' | 'interactions';

export const AdminAuditLogPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('admin');
  const [auditData, setAuditData] = useState<AuditLogResponse | null>(null);
  const [loginData, setLoginData] = useState<{ logs: LoginLog[]; total: number } | null>(null);
  const [interactionData, setInteractionData] = useState<{ logs: InteractionLog[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      platformApiRequest<AuditLogResponse>('/admin/audit-logs?limit=100'),
      platformApiRequest<{ logs: LoginLog[]; total: number }>('/admin/login-logs?limit=100'),
      platformApiRequest<{ logs: InteractionLog[]; total: number }>('/admin/interactions?limit=150'),
    ])
      .then(([audit, logins, interactions]) => {
        setAuditData(audit);
        setLoginData(logins);
        setInteractionData(interactions);
      })
      .catch(() => {
        setAuditData(null);
        setLoginData(null);
        setInteractionData(null);
      })
      .finally(() => setLoading(false));
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

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Journal d'activité"
        subtitle="Actions admin, connexions et interactions sur la plateforme"
      />

      <div className="mb-6">
        <AdminFilterPills
          options={[
            { key: 'admin', label: 'Actions admin', count: auditData?.total },
            { key: 'logins', label: 'Connexions', count: loginData?.total },
            { key: 'interactions', label: 'Interactions clients', count: interactionData?.total },
          ]}
          value={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </div>

      <AdminCard padding={false}>
        {tab === 'admin' && (
          <>
            {(auditData?.logs ?? []).length === 0 ? (
              <AdminEmptyState title="Aucune action admin enregistrée" />
            ) : (
              <AdminTableShell minWidth="900px">
                <AdminTableHead>
                  <AdminTh>Date</AdminTh>
                  <AdminTh>Acteur</AdminTh>
                  <AdminTh>Action</AdminTh>
                  <AdminTh>Client</AdminTh>
                  <AdminTh>Cible</AdminTh>
                </AdminTableHead>
                <AdminTableBody>
                  {(auditData?.logs ?? []).map((log: AuditLogEntry) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-slate-900">{log.actorName}</p>
                        <p className="text-xs text-slate-400">{log.actorEmail}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-800">
                          {ADMIN_ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {log.organizationId ? (
                          <Link
                            to={`/admin/organizations/${log.organizationId}`}
                            className="text-cyan-700 hover:underline"
                          >
                            {log.organizationName || log.organizationId}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">{log.targetLabel || '—'}</td>
                    </tr>
                  ))}
                </AdminTableBody>
              </AdminTableShell>
            )}
          </>
        )}

        {tab === 'logins' && (
          <>
            {(loginData?.logs ?? []).length === 0 ? (
              <AdminEmptyState title="Aucune connexion enregistrée" />
            ) : (
              <AdminTableShell minWidth="800px">
                <AdminTableHead>
                  <AdminTh>Date</AdminTh>
                  <AdminTh>Utilisateur</AdminTh>
                  <AdminTh>Client / Scope</AdminTh>
                  <AdminTh>Type</AdminTh>
                </AdminTableHead>
                <AdminTableBody>
                  {(loginData?.logs ?? []).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-900">{log.userName}</p>
                        {log.userEmail && <p className="text-xs text-slate-400">{log.userEmail}</p>}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600">
                        {log.scope === 'platform'
                          ? 'Admin FrigoSmart'
                          : log.organizationName || log.legacyId || '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {log.scope === 'platform' ? 'Admin' : log.userType === 'client' ? 'Client final' : 'Équipe'}
                      </td>
                    </tr>
                  ))}
                </AdminTableBody>
              </AdminTableShell>
            )}
          </>
        )}

        {tab === 'interactions' && (
          <>
            {(interactionData?.logs ?? []).length === 0 ? (
              <AdminEmptyState title="Aucune interaction enregistrée" />
            ) : (
              <AdminTableShell minWidth="800px">
                <AdminTableHead>
                  <AdminTh>Date</AdminTh>
                  <AdminTh>Client frigo</AdminTh>
                  <AdminTh>Utilisateur</AdminTh>
                  <AdminTh>Action</AdminTh>
                  <AdminTh>Détail</AdminTh>
                </AdminTableHead>
                <AdminTableBody>
                  {(interactionData?.logs ?? []).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <Link
                          to={`/admin/organizations/${log.organizationId}`}
                          className="text-cyan-700 hover:underline"
                        >
                          {log.organizationName || log.legacyId}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{log.userName}</td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        {INTERACTION_LABELS[log.action] || log.action}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">{log.summary || '—'}</td>
                    </tr>
                  ))}
                </AdminTableBody>
              </AdminTableShell>
            )}
          </>
        )}
      </AdminCard>
    </AdminPageShell>
  );
};

export const OrganizationAuditPanel: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformApiRequest<AuditLogResponse>(`/admin/audit-logs?organizationId=${orgId}&limit=20`)
      .then((r) => setLogs(r.logs))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading) return <p className="text-sm text-slate-400">Chargement du journal...</p>;
  if (logs.length === 0) return <p className="text-sm text-slate-400">Aucune action admin sur ce client.</p>;

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
        >
          <div>
            <p className="text-sm text-slate-800">{ADMIN_ACTION_LABELS[log.action] || log.action}</p>
            <p className="text-xs text-slate-400">
              {log.actorName} · {log.targetLabel || ''}
            </p>
          </div>
          <span className="shrink-0 text-xs text-slate-400">
            {new Date(log.createdAt).toLocaleDateString('fr-FR')}
          </span>
        </div>
      ))}
      <Link to="/admin/activity" className="text-xs font-medium text-cyan-700 hover:underline">
        Voir tout le journal →
      </Link>
    </div>
  );
};
