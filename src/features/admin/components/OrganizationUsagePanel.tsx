import React, { useEffect, useState } from 'react';
import { platformApiRequest } from '../../../lib/platformAuth';
import type { UsageHistoryPoint } from '../types';
import { AdminCard, AdminCardHeader } from './admin-ui';
import { OrganizationUsageChart } from './UsageCharts';
import { AdminLoading } from './AdminLoading';

export const OrganizationUsagePanel: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [history, setHistory] = useState<UsageHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    platformApiRequest<{ history: UsageHistoryPoint[] }>(
      `/admin/organizations/${orgId}/usage/history?days=${days}`
    )
      .then((r) => setHistory(r.history))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [orgId, days]);

  return (
    <AdminCard className="mt-8">
      <AdminCardHeader
        title="Historique d'usage"
        description="Évolution sur les derniers jours"
        action={
          <select
            value={days}
            onChange={(e) => setDays(+e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          >
            <option value={30}>30 jours</option>
            <option value={60}>60 jours</option>
            <option value={90}>90 jours</option>
          </select>
        }
      />
      {loading ? <AdminLoading /> : <OrganizationUsageChart data={history} />}
    </AdminCard>
  );
};
