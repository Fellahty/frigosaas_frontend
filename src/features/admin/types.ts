export type OrgStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type OrgPlan = 'starter' | 'pro' | 'enterprise';
export type SubStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

export interface FacilityGroupConfig {
  id: string;
  label: string;
  subtitle?: string;
  chFrom: number;
  chTo: number;
  couloirNumbers: number[];
}

export interface Organization {
  _id: string;
  slug: string;
  legacyId: string;
  name: string;
  dbName: string;
  status: OrgStatus;
  plan: OrgPlan;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  country: string;
  maxRooms: number;
  maxUsers: number;
  maxClients: number;
  sensorApiEnabled: boolean;
  trialEndsAt?: string;
  lastLoginAt?: string;
  loginCount?: number;
  facilityGroups?: FacilityGroupConfig[];
  createdAt: string;
}

export interface Subscription {
  _id: string;
  organizationId: string;
  plan: OrgPlan;
  status: SubStatus;
  priceMonthly: number;
  currency: string;
  billingCycle: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  createdAt?: string;
}

export interface TenantUsage {
  organizationId: string;
  organizationName: string;
  legacyId: string;
  status: string;
  plan: string;
  clientsCount: number;
  roomsCount: number;
  usersCount: number;
  receptionsCount: number;
  reservationsCount?: number;
}

export interface DashboardData {
  stats: {
    totalFrigos: number;
    active: number;
    trial: number;
    suspended: number;
    totalClients: number;
    totalRooms: number;
    mrr?: number;
    alertsCount?: number;
    criticalAlerts?: number;
  };
  usage: TenantUsage[];
  alerts?: PlatformAlert[];
  trend?: PlatformTrendPoint[];
}

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

export interface PlatformTrendPoint {
  date: string;
  receptionsCount: number;
  reservationsCount: number;
  activeTenants: number;
}

export interface UsageHistoryPoint {
  date: string;
  roomsCount: number;
  clientsCount: number;
  usersCount: number;
  receptionsCount: number;
  reservationsCount: number;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  actorName: string;
  action: string;
  organizationId?: string;
  organizationName?: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogResponse {
  logs: AuditLogEntry[];
  total: number;
}

export interface SystemInfo {
  tenantConnections: { active: number; max: number; databases: string[] };
  orgCache: { size: number; ttlMs: number };
}
