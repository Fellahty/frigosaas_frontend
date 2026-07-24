import mongoose from 'mongoose';
import { User } from '../../../src/models/User.js';
import { hashPassword } from '../../../src/utils/password.js';
import { PlatformUserModel } from '../../../src/platform/models/PlatformUser.js';
import { registerLegacyTenant } from '../../../src/platform/services/tenantProvisioner.js';
import { OrganizationModel } from '../../../src/platform/models/Organization.js';
import { invalidateOrgCache } from '../../../src/platform/services/orgCache.js';

export const TENANT_YAZAMI = 'YAZAMI';
export const TENANT_OTHER = 'OTHER';

export async function ensureYazamiActive() {
  const Org = OrganizationModel();
  await Org.updateOne({ legacyId: TENANT_YAZAMI }, { status: 'active' });
  invalidateOrgCache();
}

export async function seedPlatformAdmin() {
  const PlatformUser = PlatformUserModel();
  const email = 'admin@test.frigosmart.com';
  const password = await hashPassword('superadmin123');

  const user = await PlatformUser.findOneAndUpdate(
    { email },
    {
      name: 'Test Super Admin',
      email,
      password,
      role: 'super_admin',
      isActive: true,
    },
    { upsert: true, new: true }
  );
  return user;
}

export async function seedYazamiUser() {
  return User.create({
    tenantId: TENANT_YAZAMI,
    name: 'Yazami Admin',
    email: 'yazami@test.com',
    password: await hashPassword('admin123'),
    role: 'admin',
    isActive: true,
  });
}

export async function registerOtherTenant() {
  const { OrganizationModel } = await import('../../../src/platform/models/Organization.js');
  const Org = OrganizationModel();

  let org = await Org.findOne({ legacyId: TENANT_OTHER });
  if (org) {
    if (org.dbName !== 'frigo_other_test') {
      await Org.updateOne({ _id: org._id }, { dbName: 'frigo_other_test' });
      org.dbName = 'frigo_other_test';
    }
    return org;
  }

  return registerLegacyTenant(TENANT_OTHER, 'Other Client Frigo', 'frigo_other_test');
}

export async function clearTenantDb(dbName: string) {
  const uri = `mongodb://localhost:27017/${dbName}`;
  const conn = await mongoose.createConnection(uri).asPromise();
  await conn.dropDatabase();
  await conn.close();
}

export async function clearDefaultTestDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}
