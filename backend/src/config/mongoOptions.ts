/**
 * Shared MongoDB connection options for platform + tenant pools.
 * Tuned for multi-tenant SaaS with many client databases.
 */
export const mongoPoolOptions = {
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '10', 10),
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45_000,
  connectTimeoutMS: 10_000,
  maxIdleTimeMS: 60_000,
};

export const tenantPoolLimits = {
  maxCachedConnections: parseInt(process.env.TENANT_MAX_CONNECTIONS || '40', 10),
  idleEvictMs: parseInt(process.env.TENANT_CONNECTION_IDLE_MS || '600000', 10), // 10 min
  orgCacheTtlMs: parseInt(process.env.ORG_CACHE_TTL_MS || '60000', 10), // 1 min
};

/** Only DB names from our registry pattern (or legacy migration names). */
const LEGACY_DB_NAMES = new Set(['frigosaas', 'frigosaas_test']);

export function isAllowedTenantDbName(dbName: string): boolean {
  if (LEGACY_DB_NAMES.has(dbName)) return true;
  return /^frigo_[a-z0-9_]{2,48}$/.test(dbName);
}

export function isValidOrgSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/.test(slug);
}
