import { describe, expect, it } from 'vitest';
import { isAllowedTenantDbName, isValidOrgSlug } from '../../src/config/mongoOptions.js';
import { slugToDbName } from '../../src/platform/models/Organization.js';

describe('mongoOptions', () => {
  describe('isAllowedTenantDbName', () => {
    it('allows legacy frigosaas databases', () => {
      expect(isAllowedTenantDbName('frigosaas')).toBe(true);
      expect(isAllowedTenantDbName('frigosaas_test')).toBe(true);
    });

    it('allows frigo_* pattern', () => {
      expect(isAllowedTenantDbName('frigo_yazami')).toBe(true);
      expect(isAllowedTenantDbName('frigo_casa_01')).toBe(true);
    });

    it('rejects arbitrary database names', () => {
      expect(isAllowedTenantDbName('admin')).toBe(false);
      expect(isAllowedTenantDbName('other_db')).toBe(false);
      expect(isAllowedTenantDbName('frigo_')).toBe(false);
      expect(isAllowedTenantDbName('../../../etc')).toBe(false);
    });
  });

  describe('isValidOrgSlug', () => {
    it('accepts valid slugs', () => {
      expect(isValidOrgSlug('yazami')).toBe(true);
      expect(isValidOrgSlug('casa-01')).toBe(true);
      expect(isValidOrgSlug('frigo_nord')).toBe(true);
    });

    it('rejects invalid slugs', () => {
      expect(isValidOrgSlug('ab')).toBe(false);
      expect(isValidOrgSlug('-yazami')).toBe(false);
      expect(isValidOrgSlug('yazami!')).toBe(false);
      expect(isValidOrgSlug('')).toBe(false);
    });
  });

  describe('slugToDbName', () => {
    it('converts slug to safe database name', () => {
      expect(slugToDbName('yazami')).toBe('frigo_yazami');
      expect(slugToDbName('Casa-01')).toBe('frigo_casa_01');
    });
  });
});
