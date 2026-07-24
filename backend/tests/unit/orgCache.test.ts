import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedOrganization,
  setCachedOrganization,
  invalidateOrgCache,
  getOrgCacheStats,
} from '../../src/platform/services/orgCache.js';
import type { IOrganization } from '../../src/platform/models/Organization.js';

function mockOrg(overrides: Partial<IOrganization> = {}): IOrganization {
  return {
    _id: 'org123',
    slug: 'yazami',
    legacyId: 'YAZAMI',
    name: 'Yazami Test',
    dbName: 'frigo_yazami',
    status: 'active',
    plan: 'pro',
    country: 'MA',
    maxRooms: 10,
    maxUsers: 5,
    maxClients: 100,
    sensorApiEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as IOrganization;
}

describe('orgCache', () => {
  beforeEach(() => {
    invalidateOrgCache();
  });

  it('stores and retrieves organization by tenant id', () => {
    const org = mockOrg();
    setCachedOrganization('YAZAMI', org);

    expect(getCachedOrganization('YAZAMI')).toEqual(org);
    expect(getCachedOrganization('yazami')).toEqual(org);
  });

  it('returns null for unknown tenant', () => {
    expect(getCachedOrganization('UNKNOWN')).toBeNull();
  });

  it('clears cache on invalidate', () => {
    setCachedOrganization('YAZAMI', mockOrg());
    invalidateOrgCache('YAZAMI');
    expect(getCachedOrganization('YAZAMI')).toBeNull();
  });

  it('clears all cache when invalidate called without arg', () => {
    setCachedOrganization('YAZAMI', mockOrg());
    setCachedOrganization('OTHER', mockOrg({ legacyId: 'OTHER', slug: 'other' }));
    invalidateOrgCache();
    expect(getOrgCacheStats().size).toBe(0);
  });

  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    try {
      setCachedOrganization('YAZAMI', mockOrg());
      expect(getCachedOrganization('YAZAMI')).not.toBeNull();
      vi.advanceTimersByTime(61_000);
      expect(getCachedOrganization('YAZAMI')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
