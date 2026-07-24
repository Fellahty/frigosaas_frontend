import { OrganizationModel } from '../models/Organization.js';
import { SubscriptionModel } from '../models/Subscription.js';
import { UsageMetricModel } from '../models/UsageMetric.js';
import type { TenantUsageSnapshot } from './usage.service.js';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType =
  | 'trial_expiring'
  | 'trial_expired'
  | 'quota_near_limit'
  | 'quota_exceeded'
  | 'inactive_tenant'
  | 'suspended'
  | 'past_due';

export interface PlatformAlert {
  type: AlertType;
  severity: AlertSeverity;
  organizationId: string;
  organizationName: string;
  legacyId: string;
  slug: string;
  message: string;
  metadata?: Record<string, unknown>;
}

const INACTIVE_DAYS = 14;
const TRIAL_WARNING_DAYS = 7;
const QUOTA_WARNING_RATIO = 0.8;

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

export async function computePlatformAlerts(
  usageSnapshots: TenantUsageSnapshot[]
): Promise<PlatformAlert[]> {
  const Org = OrganizationModel();
  const Sub = SubscriptionModel();
  const Usage = UsageMetricModel();

  const orgs = await Org.find().lean();
  const subs = await Sub.find({ status: 'past_due' }).lean();
  const pastDueOrgIds = new Set(subs.map((s) => s.organizationId));

  const usageByOrgId = new Map(usageSnapshots.map((u) => [u.organizationId, u]));
  const alerts: PlatformAlert[] = [];
  const inactiveCutoff = new Date();
  inactiveCutoff.setDate(inactiveCutoff.getDate() - INACTIVE_DAYS);
  const inactiveCutoffStr = inactiveCutoff.toISOString().slice(0, 10);

  for (const org of orgs) {
    const orgId = org._id.toString();
    const usage = usageByOrgId.get(orgId);
    const base = {
      organizationId: orgId,
      organizationName: org.name,
      legacyId: org.legacyId,
      slug: org.slug,
    };

    if (org.status === 'suspended' || org.status === 'cancelled') {
      alerts.push({
        ...base,
        type: 'suspended',
        severity: 'critical',
        message: `Client ${org.status === 'suspended' ? 'suspendu' : 'annulé'} — accès coupé`,
      });
      continue;
    }

    if (pastDueOrgIds.has(orgId)) {
      alerts.push({
        ...base,
        type: 'past_due',
        severity: 'critical',
        message: 'Abonnement impayé — action requise',
      });
    }

    if (org.status === 'trial' && org.trialEndsAt) {
      const days = daysUntil(new Date(org.trialEndsAt));
      if (days < 0) {
        alerts.push({
          ...base,
          type: 'trial_expired',
          severity: 'critical',
          message: `Essai expiré depuis ${Math.abs(days)} jour(s)`,
          metadata: { trialEndsAt: org.trialEndsAt },
        });
      } else if (days <= TRIAL_WARNING_DAYS) {
        alerts.push({
          ...base,
          type: 'trial_expiring',
          severity: days <= 3 ? 'warning' : 'info',
          message: `Essai expire dans ${days} jour(s)`,
          metadata: { trialEndsAt: org.trialEndsAt, daysLeft: days },
        });
      }
    }

    if (usage) {
      const quotaChecks = [
        { label: 'chambres', current: usage.roomsCount, max: org.maxRooms },
        { label: 'utilisateurs', current: usage.usersCount, max: org.maxUsers },
        { label: 'clients finaux', current: usage.clientsCount, max: org.maxClients },
      ];

      for (const q of quotaChecks) {
        if (q.max <= 0 || q.max >= 999999) continue;
        const ratio = q.current / q.max;
        if (ratio >= 1) {
          alerts.push({
            ...base,
            type: 'quota_exceeded',
            severity: 'critical',
            message: `Quota ${q.label} dépassé (${q.current}/${q.max})`,
            metadata: { resource: q.label, current: q.current, max: q.max },
          });
        } else if (ratio >= QUOTA_WARNING_RATIO) {
          alerts.push({
            ...base,
            type: 'quota_near_limit',
            severity: 'warning',
            message: `Quota ${q.label} à ${Math.round(ratio * 100)}% (${q.current}/${q.max})`,
            metadata: { resource: q.label, current: q.current, max: q.max },
          });
        }
      }

      const lastLogin = org.lastLoginAt ? new Date(org.lastLoginAt) : null;
      const inactiveByLogin = !lastLogin || lastLogin < inactiveCutoff;

      const oldMetric = await Usage.findOne({
        organizationId: orgId,
        date: { $lte: inactiveCutoffStr },
      })
        .sort({ date: -1 })
        .lean();

      const receptionsDelta = oldMetric
        ? usage.receptionsCount - (oldMetric.receptionsCount ?? 0)
        : usage.receptionsCount;

      if (
        (org.status === 'active' || org.status === 'trial') &&
        inactiveByLogin &&
        receptionsDelta === 0
      ) {
        alerts.push({
          ...base,
          type: 'inactive_tenant',
          severity: 'warning',
          message: lastLogin
            ? `Aucune activité depuis ${daysSince(lastLogin)} jour(s)`
            : 'Jamais connecté — adoption à suivre',
          metadata: {
            lastLoginAt: org.lastLoginAt,
            receptionsCount: usage.receptionsCount,
          },
        });
      }
    }
  }

  const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
