import { getTenantConnection } from '../../config/tenantDatabase.js';
import { UsageMetricModel } from '../models/UsageMetric.js';
import { OrganizationModel } from '../models/Organization.js';

export interface UsageHistoryPoint {
  date: string;
  roomsCount: number;
  clientsCount: number;
  usersCount: number;
  receptionsCount: number;
  reservationsCount: number;
}

export interface PlatformTrendPoint {
  date: string;
  receptionsCount: number;
  reservationsCount: number;
  activeTenants: number;
}

export interface TenantUsageSnapshot {
  organizationId: string;
  organizationName: string;
  slug: string;
  legacyId: string;
  status: string;
  plan: string;
  roomsCount: number;
  clientsCount: number;
  usersCount: number;
  receptionsCount: number;
  reservationsCount: number;
  lastUpdated: string;
}

async function countInTenantDb(dbName: string, collection: string): Promise<number> {
  try {
    const conn = await getTenantConnection(dbName);
    if (!conn.db) return 0;
    return conn.db.collection(collection).countDocuments();
  } catch {
    return 0;
  }
}

export async function collectTenantUsage(organizationId: string): Promise<TenantUsageSnapshot | null> {
  const Org = OrganizationModel();
  const org = await Org.findById(organizationId);
  if (!org) return null;

  const [rooms, clients, users, receptions, reservations] = await Promise.all([
    countInTenantDb(org.dbName, 'rooms'),
    countInTenantDb(org.dbName, 'clients'),
    countInTenantDb(org.dbName, 'users'),
    countInTenantDb(org.dbName, 'receptions'),
    countInTenantDb(org.dbName, 'reservations'),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const Usage = UsageMetricModel();
  await Usage.findOneAndUpdate(
    { organizationId, date: today },
    {
      organizationId,
      date: today,
      roomsCount: rooms,
      clientsCount: clients,
      usersCount: users,
      receptionsCount: receptions,
      reservationsCount: reservations,
    },
    { upsert: true, new: true }
  );

  return {
    organizationId: org._id.toString(),
    organizationName: org.name,
    slug: org.slug,
    legacyId: org.legacyId,
    status: org.status,
    plan: org.plan,
    roomsCount: rooms,
    clientsCount: clients,
    usersCount: users,
    receptionsCount: receptions,
    reservationsCount: reservations,
    lastUpdated: new Date().toISOString(),
  };
}

export async function collectAllTenantsUsage(): Promise<TenantUsageSnapshot[]> {
  const Org = OrganizationModel();
  const orgs = await Org.find().sort({ createdAt: -1 });
  const results: TenantUsageSnapshot[] = [];

  for (const org of orgs) {
    const usage = await collectTenantUsage(org._id.toString());
    if (usage) results.push(usage);
  }

  return results;
}

export async function getUsageHistory(
  organizationId: string,
  days = 30
): Promise<UsageHistoryPoint[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startStr = start.toISOString().slice(0, 10);

  const Usage = UsageMetricModel();
  const metrics = await Usage.find({
    organizationId,
    date: { $gte: startStr },
  })
    .sort({ date: 1 })
    .lean();

  return metrics.map((m) => ({
    date: m.date,
    roomsCount: m.roomsCount,
    clientsCount: m.clientsCount,
    usersCount: m.usersCount,
    receptionsCount: m.receptionsCount,
    reservationsCount: m.reservationsCount,
  }));
}

export async function getPlatformUsageTrend(days = 30): Promise<PlatformTrendPoint[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startStr = start.toISOString().slice(0, 10);

  const Usage = UsageMetricModel();
  const metrics = await Usage.find({ date: { $gte: startStr } }).sort({ date: 1 }).lean();

  const byDate = new Map<string, PlatformTrendPoint>();
  for (const m of metrics) {
    const existing = byDate.get(m.date) ?? {
      date: m.date,
      receptionsCount: 0,
      reservationsCount: 0,
      activeTenants: 0,
    };
    existing.receptionsCount += m.receptionsCount;
    existing.reservationsCount += m.reservationsCount;
    if (m.receptionsCount > 0 || m.reservationsCount > 0) {
      existing.activeTenants += 1;
    }
    byDate.set(m.date, existing);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
