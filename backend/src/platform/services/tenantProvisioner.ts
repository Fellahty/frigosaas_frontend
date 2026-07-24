import { OrganizationModel, slugToDbName, type IOrganization } from '../models/Organization.js';
import { SubscriptionModel } from '../models/Subscription.js';
import { createTenantDatabase } from '../../config/tenantDatabase.js';
import { hashPassword } from '../../utils/password.js';
import { User } from '../../models/User.js';
import { ensureTenantIndexes } from './tenantIndexes.js';
import { invalidateOrgCache } from './orgCache.js';
import { isValidOrgSlug } from '../../config/mongoOptions.js';
import { quotasForPlan, YAZAMI_PRO_QUOTAS } from '../constants/planLimits.js';

export interface ProvisionTenantInput {
  slug: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  plan?: 'starter' | 'pro' | 'enterprise';
  adminEmail: string;
  adminPassword: string;
  adminName?: string;
}

export async function provisionTenant(input: ProvisionTenantInput): Promise<IOrganization> {
  const Org = OrganizationModel();
  const slug = input.slug.toLowerCase().trim();
  if (!isValidOrgSlug(slug)) {
    throw new Error('Slug invalide (2-32 caractères, lettres/chiffres/tirets)');
  }
  const legacyId = slug.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const dbName = slugToDbName(slug);

  const existing = await Org.findOne({ $or: [{ slug }, { dbName }, { legacyId }] });
  if (existing) {
    throw new Error(`Un frigo avec le slug "${slug}" existe déjà`);
  }

  const conn = await createTenantDatabase(dbName);
  await ensureTenantIndexes(conn);

  const plan = input.plan || 'starter';
  const quotas = quotasForPlan(plan);

  const org = await Org.create({
    slug,
    legacyId,
    name: input.name,
    dbName,
    status: 'trial',
    plan,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...quotas,
  });

  const Sub = SubscriptionModel();
  await Sub.create({
    organizationId: org._id.toString(),
    plan: input.plan || 'starter',
    status: 'trialing',
    startDate: new Date(),
  });

  // Seed admin user in tenant DB
  const TenantUser = conn.models.User || conn.model('User', User.schema);

  await TenantUser.create({
    tenantId: legacyId,
    name: input.adminName || 'Administrateur',
    email: input.adminEmail.toLowerCase(),
    password: await hashPassword(input.adminPassword),
    role: 'admin',
    isActive: true,
  });

  invalidateOrgCache();
  return org;
}

export async function registerLegacyTenant(
  legacyId: string,
  name: string,
  dbName: string
): Promise<IOrganization> {
  const Org = OrganizationModel();
  const slug = legacyId.toLowerCase();

  const existing = await Org.findOne({ legacyId: legacyId.toUpperCase() });
  if (existing) return existing;

  const quotas = legacyId.toUpperCase() === 'YAZAMI' ? YAZAMI_PRO_QUOTAS : quotasForPlan('pro');

  return Org.create({
    slug,
    legacyId: legacyId.toUpperCase(),
    name,
    dbName,
    status: 'active',
    plan: 'pro',
    ...quotas,
  });
}
