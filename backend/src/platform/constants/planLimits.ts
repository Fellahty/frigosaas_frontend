import type { OrgPlan } from '../models/Organization.js';

export interface PlanQuotaDefaults {
  maxRooms: number;
  maxUsers: number;
  maxClients: number;
}

export const PLAN_QUOTA_DEFAULTS: Record<OrgPlan, PlanQuotaDefaults> = {
  starter: { maxRooms: 10, maxUsers: 5, maxClients: 100 },
  pro: { maxRooms: 50, maxUsers: 20, maxClients: 500 },
  enterprise: { maxRooms: 9999, maxUsers: 9999, maxClients: 99999 },
};

export function quotasForPlan(plan: OrgPlan): PlanQuotaDefaults {
  return PLAN_QUOTA_DEFAULTS[plan];
}

/** Legacy production tenant — real data exceeds starter defaults. */
export const YAZAMI_PRO_QUOTAS: PlanQuotaDefaults = PLAN_QUOTA_DEFAULTS.pro;
