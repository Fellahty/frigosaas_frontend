import React, { useCallback, useEffect, useState } from 'react';
import { platformApiRequest } from '../../../lib/platformAuth';
import {
  AdminCard,
  AdminEmptyState,
  AdminFilterPills,
  AdminTableBody,
  AdminTableHead,
  AdminTableShell,
  AdminTh,
} from './admin-ui';
import { AdminLoading } from './AdminLoading';

interface LoginLog {
  id: string;
  userName: string;
  userEmail?: string;
  userType?: string;
  role?: string;
  ip?: string;
  createdAt: string;
}

interface InteractionLog {
  id: string;
  userName: string;
  userRole: string;
  userType: string;
  action: string;
  method: string;
  path: string;
  summary?: string;
  ip?: string;
  createdAt: string;
}

interface LogsResponse<T> {
  logs: T[];
  total: number;
}

type Tab = 'logins' | 'interactions';

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Connexion',
  'clients.create': 'Création client',
  'clients.update': 'Modification client',
  'clients.delete': 'Suppression client',
  'users.create': 'Création utilisateur',
  'users.update': 'Modification utilisateur',
  'users.delete': 'Suppression utilisateur',
  'rooms.create': 'Création chambre',
  'rooms.update': 'Modification chambre',
  'rooms.delete': 'Suppression chambre',
  'receptions.create': 'Nouvelle réception',
  'receptions.update': 'Modification réception',
  'reservations.create': 'Nouvelle réservation',
  'reservations.update': 'Modification réservation',
};

function labelAction(action: string) {
  return ACTION_LABELS[action] || action.replace('.', ' · ');
}

interface Props {
  orgId: string;
}

export const OrganizationPlatformLogsPanel: React.FC<Props> = ({ orgId }) => {
  const [tab, setTab] = useState<Tab>('logins');
  const [logins, setLogins] = useState<LoginLog[]>([]);
  const [interactions, setInteractions] = useState<InteractionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loginRes, interactionRes] = await Promise.all([
        platformApiRequest<LogsResponse<LoginLog>>(`/admin/organizations/${orgId}/login-logs?limit=50`),
        platformApiRequest<LogsResponse<InteractionLog>>(
          `/admin/organizations/${orgId}/interactions?limit=100`
        ),
      ]);
      setLogins(loginRes.logs);
      setInteractions(interactionRes.logs);
    } catch {
      setLogins([]);
      setInteractions([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <AdminCard className="mt-8">
        <AdminLoading />
      </AdminCard>
    );
  }

  return (
    <AdminCard className="mt-8" padding={false}>
      <div className="border-b border-slate-100 px-6 py-5">
        <h3 className="font-semibold text-slate-900">Usage plateforme</h3>
        <p className="mt-0.5 text-xs text-slate-500">Connexions et actions des utilisateurs de ce frigo</p>
        <div className="mt-4">
          <AdminFilterPills
            options={[
              { key: 'logins', label: 'Connexions', count: logins.length },
              { key: 'interactions', label: 'Interactions', count: interactions.length },
            ]}
            value={tab}
            onChange={(k) => setTab(k as Tab)}
          />
        </div>
      </div>

      {tab === 'logins' ? (
        logins.length === 0 ? (
          <AdminEmptyState title="Aucune connexion enregistrée" />
        ) : (
          <AdminTableShell minWidth="700px">
            <AdminTableHead>
              <AdminTh>Date</AdminTh>
              <AdminTh>Utilisateur</AdminTh>
              <AdminTh>Type</AdminTh>
              <AdminTh>IP</AdminTh>
            </AdminTableHead>
            <AdminTableBody>
              {logins.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-900">{log.userName}</p>
                    {log.userEmail && <p className="text-xs text-slate-400">{log.userEmail}</p>}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {log.userType === 'client' ? 'Client final' : 'Équipe'}
                    {log.role && ` · ${log.role}`}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">{log.ip || '—'}</td>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTableShell>
        )
      ) : interactions.length === 0 ? (
        <AdminEmptyState title="Aucune interaction enregistrée" />
      ) : (
        <AdminTableShell minWidth="800px">
          <AdminTableHead>
            <AdminTh>Date</AdminTh>
            <AdminTh>Utilisateur</AdminTh>
            <AdminTh>Action</AdminTh>
            <AdminTh>Détail</AdminTh>
          </AdminTableHead>
          <AdminTableBody>
            {interactions.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/80">
                <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('fr-FR')}
                </td>
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-900">{log.userName}</p>
                  <p className="text-xs text-slate-400">{log.userRole}</p>
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {labelAction(log.action)}
                  </span>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                    {log.method} {log.path.length > 48 ? `${log.path.slice(0, 48)}…` : log.path}
                  </p>
                </td>
                <td className="px-5 py-3 text-sm text-slate-600">{log.summary || '—'}</td>
              </tr>
            ))}
          </AdminTableBody>
        </AdminTableShell>
      )}
    </AdminCard>
  );
};
