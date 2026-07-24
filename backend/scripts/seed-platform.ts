/**
 * Seed FrigoSmart platform DB + register legacy YAZAMI tenant
 *
 * Usage: npm run seed:platform
 */
import { connectDatabase } from '../src/config/database.js';
import { connectPlatformDatabase, disconnectPlatformDatabase } from '../src/config/platformDatabase.js';
import { PlatformUserModel } from '../src/platform/models/PlatformUser.js';
import { registerLegacyTenant } from '../src/platform/services/tenantProvisioner.js';
import { SubscriptionModel } from '../src/platform/models/Subscription.js';
import { OrganizationModel } from '../src/platform/models/Organization.js';
import { YAZAMI_PRO_QUOTAS } from '../src/platform/constants/planLimits.js';
import { invalidateOrgCache } from '../src/platform/services/orgCache.js';
import { hashPassword } from '../src/utils/password.js';
import { env } from '../src/config/env.js';

async function main() {
  await connectDatabase();
  await connectPlatformDatabase();

  const PlatformUser = PlatformUserModel();

  const existing = await PlatformUser.findOne({ email: 'superadmin@frigosmart.com' });
  if (!existing) {
    await PlatformUser.create({
      name: 'Super Admin FrigoSmart',
      email: 'superadmin@frigosmart.com',
      password: await hashPassword('superadmin123'),
      role: 'super_admin',
      isActive: true,
    });
    console.log('✅ Super admin créé: superadmin@frigosmart.com / superadmin123');
  } else {
    console.log('ℹ️  Super admin existe déjà');
  }

  // Register existing YAZAMI data (frigosaas DB)
  const dbName = env.mongodbUri.split('/').pop() || 'frigosaas';
  const org = await registerLegacyTenant('YAZAMI', 'Domaine LYAZAMI', dbName);
  console.log(`✅ Frigo enregistré: ${org.name} (${org.legacyId}) → DB: ${org.dbName}`);

  // Align YAZAMI quotas with Pro plan (legacy DB has ~19 rooms, default schema was 10)
  const Org = OrganizationModel();
  await Org.updateOne(
    { legacyId: 'YAZAMI' },
    {
      plan: 'pro',
      status: 'active',
      ...YAZAMI_PRO_QUOTAS,
    }
  );
  invalidateOrgCache('YAZAMI');
  console.log(
    `✅ Quotas YAZAMI: ${YAZAMI_PRO_QUOTAS.maxRooms} chambres, ${YAZAMI_PRO_QUOTAS.maxUsers} users, ${YAZAMI_PRO_QUOTAS.maxClients} clients`
  );

  const Sub = SubscriptionModel();
  const subExists = await Sub.findOne({ organizationId: org._id.toString() });
  if (!subExists) {
    await Sub.create({
      organizationId: org._id.toString(),
      plan: 'pro',
      status: 'active',
      priceMonthly: 0,
      startDate: new Date(),
    });
    console.log('✅ Abonnement YAZAMI créé (pro / active)');
  }

  await disconnectPlatformDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
