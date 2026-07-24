import React, { useEffect, useState } from 'react';
import { platformApiRequest } from '../../lib/platformAuth';
import type { PlatformAlert } from '../types';
import { AdminPageHeader } from './components/AdminPageHeader';
import { AdminAlertsPanel } from './components/AdminAlertsPanel';
import { AdminLoading } from './components/AdminLoading';
import { AdminCard, AdminPageShell } from './components/admin-ui';

export const AdminAlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<PlatformAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformApiRequest<PlatformAlert[]>('/admin/alerts')
      .then(setAlerts)
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, []);

  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const warning = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Alertes plateforme"
        subtitle="Essais expirés, quotas, inactivité et impayés"
        badge={
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
            {critical} critique{critical > 1 ? 's' : ''} · {warning} attention
          </span>
        }
      />

      <AdminCard>
        {loading ? <AdminLoading /> : <AdminAlertsPanel alerts={alerts} />}
      </AdminCard>
    </AdminPageShell>
  );
};
