import { describe, expect, it } from 'vitest';
import { assertTenantPathAccess } from '../../src/middleware/dataPathGuard.js';
import type { AuthRequest } from '../../src/middleware/auth.js';

function mockReq(tenantId?: string): AuthRequest {
  return {
    user: tenantId
      ? {
          id: '1',
          tenantId,
          name: 'Test',
          role: 'admin',
          userType: 'manager',
        }
      : undefined,
  } as AuthRequest;
}

describe('dataPathGuard', () => {
  describe('assertTenantPathAccess', () => {
    it('allows access when path tenant matches JWT tenant', () => {
      const req = mockReq('YAZAMI');
      expect(assertTenantPathAccess(req, ['tenants', 'YAZAMI', 'clients'])).toBe(true);
      expect(assertTenantPathAccess(req, ['tenants', 'yazami', 'rooms'])).toBe(true);
    });

    it('blocks access when path tenant differs from JWT tenant', () => {
      const req = mockReq('YAZAMI');
      expect(assertTenantPathAccess(req, ['tenants', 'OTHER', 'clients'])).toBe(false);
      expect(assertTenantPathAccess(req, ['tenants', 'CASA', 'users'])).toBe(false);
    });

    it('allows non-tenant paths', () => {
      const req = mockReq('YAZAMI');
      expect(assertTenantPathAccess(req, ['settings', 'app'])).toBe(true);
      expect(assertTenantPathAccess(req, ['logs'])).toBe(true);
    });

    it('allows when no user (unauthenticated paths handled elsewhere)', () => {
      const req = mockReq();
      expect(assertTenantPathAccess(req, ['tenants', 'YAZAMI', 'clients'])).toBe(true);
    });
  });
});
