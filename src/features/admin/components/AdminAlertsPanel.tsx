import React from 'react';
import { Link } from 'react-router-dom';
import type { PlatformAlert } from '../types';

const severityStyles: Record<PlatformAlert['severity'], string> = {
  critical: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

const severityDot: Record<PlatformAlert['severity'], string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
};

export const AdminAlertsPanel: React.FC<{
  alerts: PlatformAlert[];
  compact?: boolean;
}> = ({ alerts, compact = false }) => {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Aucune alerte — tout est en ordre.
      </div>
    );
  }

  const shown = compact ? alerts.slice(0, 6) : alerts;

  return (
    <div className="space-y-2">
      {shown.map((alert) => (
        <Link
          key={`${alert.organizationId}-${alert.type}-${alert.message}`}
          to={`/admin/organizations/${alert.organizationId}`}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition hover:shadow-sm ${severityStyles[alert.severity]}`}
        >
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDot[alert.severity]}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{alert.message}</p>
            <p className="mt-0.5 text-xs opacity-75">
              {alert.organizationName} · {alert.legacyId}
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium opacity-60">Voir →</span>
        </Link>
      ))}
      {compact && alerts.length > 6 && (
        <Link
          to="/admin/alerts"
          className="block text-center text-sm font-medium text-cyan-700 hover:underline"
        >
          + {alerts.length - 6} autres alertes
        </Link>
      )}
    </div>
  );
};
