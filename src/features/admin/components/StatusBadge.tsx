import React from 'react';
import type { OrgStatus, SubStatus } from '../types';

const ORG_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  trial: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  suspended: 'bg-red-50 text-red-700 ring-red-600/20',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

const ORG_LABELS: Record<string, string> = {
  active: 'Actif',
  trial: 'Essai',
  suspended: 'Suspendu',
  cancelled: 'Annulé',
};

const SUB_LABELS: Record<string, string> = {
  active: 'Payé',
  trialing: 'Essai',
  past_due: 'Impayé',
  cancelled: 'Annulé',
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

interface StatusBadgeProps {
  status: OrgStatus | SubStatus | string;
  type?: 'org' | 'sub' | 'plan';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'org' }) => {
  const labels = type === 'sub' ? SUB_LABELS : type === 'plan' ? PLAN_LABELS : ORG_LABELS;
  const styles = type === 'plan'
    ? 'bg-cyan-50 text-cyan-800 ring-cyan-700/20'
    : ORG_STYLES[status] || ORG_STYLES.trial;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}>
      {labels[status] || status}
    </span>
  );
};
