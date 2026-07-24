import type { IOrganization } from '../platform/models/Organization.js';
import { tenantPoolLimits } from '../../config/mongoOptions.js';

interface CacheEntry {
  org: IOrganization;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(tenantIdOrSlug: string): string {
  return tenantIdOrSlug.trim().toLowerCase();
}

export function getCachedOrganization(tenantIdOrSlug: string): IOrganization | null {
  const key = cacheKey(tenantIdOrSlug);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.org;
}

export function setCachedOrganization(tenantIdOrSlug: string, org: IOrganization): void {
  const key = cacheKey(tenantIdOrSlug);
  cache.set(key, {
    org,
    expiresAt: Date.now() + tenantPoolLimits.orgCacheTtlMs,
  });
  // Also cache by legacyId and slug
  cache.set(org.legacyId.toLowerCase(), { org, expiresAt: Date.now() + tenantPoolLimits.orgCacheTtlMs });
  cache.set(org.slug.toLowerCase(), { org, expiresAt: Date.now() + tenantPoolLimits.orgCacheTtlMs });
}

export function invalidateOrgCache(tenantIdOrSlug?: string): void {
  if (!tenantIdOrSlug) {
    cache.clear();
    return;
  }
  cache.delete(cacheKey(tenantIdOrSlug));
}

export function getOrgCacheStats() {
  return { size: cache.size, ttlMs: tenantPoolLimits.orgCacheTtlMs };
}
