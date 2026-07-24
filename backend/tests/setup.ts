import { beforeAll } from 'vitest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectPlatformDatabase } from '../src/config/platformDatabase.js';
import { registerLegacyTenant } from '../src/platform/services/tenantProvisioner.js';
import { OrganizationModel } from '../src/platform/models/Organization.js';
import { invalidateOrgCache } from '../src/platform/services/orgCache.js';

dotenv.config();

declare global {
  // eslint-disable-next-line no-var
  var __FRIGO_TEST_DB_READY__: boolean | undefined;
}

const testDbUri =
  process.env.MONGODB_TEST_URI ||
  'mongodb://localhost:27017/frigosaas_test';

const platformTestUri =
  process.env.PLATFORM_MONGODB_TEST_URI ||
  'mongodb://localhost:27017/frigosmart_platform_test';

beforeAll(async () => {
  if (globalThis.__FRIGO_TEST_DB_READY__) return;

  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
  process.env.MONGODB_URI = testDbUri;
  process.env.PLATFORM_MONGODB_URI = platformTestUri;
  process.env.MONGODB_BASE_URI = 'mongodb://localhost:27017';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tenant-tokens';
  process.env.PLATFORM_JWT_SECRET =
    process.env.PLATFORM_JWT_SECRET || 'test-platform-jwt-secret-different';

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testDbUri);
  }

  await connectPlatformDatabase();
  await registerLegacyTenant('YAZAMI', 'Test Frigo', 'frigosaas_test');

  const Org = OrganizationModel();
  await Org.updateOne({ legacyId: 'YAZAMI' }, { status: 'active', plan: 'pro' });
  invalidateOrgCache();

  globalThis.__FRIGO_TEST_DB_READY__ = true;
}, 60_000);
