import { withTenantDb } from '../../middleware/tenantDb.js';
import { getActiveConnection } from '../../middleware/tenantContext.js';
import { User } from '../../models/User.js';
import { Client } from '../../models/Client.js';
import { hashPassword } from '../../utils/password.js';
import { OrganizationModel } from '../models/Organization.js';

export interface TenantAccessUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface TenantAccessClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  isActive: boolean;
  hasPassword: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

async function resolveOrg(orgId: string) {
  const org = await OrganizationModel().findById(orgId);
  if (!org) return null;
  return org;
}

export async function listTenantAccess(orgId: string) {
  const org = await resolveOrg(orgId);
  if (!org) return null;

  return withTenantDb(org.legacyId, async () => {
    const conn = getActiveConnection();
    const UserModel = conn.models.User || conn.model('User', User.schema);
    const ClientModel = conn.models.Client || conn.model('Client', Client.schema);
    const tenantId = org.legacyId;

    const [users, clients] = await Promise.all([
      UserModel.find({ tenantId }).select('-password').sort({ createdAt: -1 }).lean(),
      ClientModel.find({ tenantId }).select('+password').sort({ createdAt: -1 }).lean(),
    ]);

    return {
      users: users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive !== false,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })) satisfies TenantAccessUser[],
      clients: clients.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        isActive: c.isActive !== false,
        hasPassword: !!c.password,
        lastLoginAt: c.lastLoginAt,
        createdAt: c.createdAt,
      })) satisfies TenantAccessClient[],
    };
  });
}

export async function updateTenantUser(
  orgId: string,
  userId: string,
  updates: { isActive?: boolean; password?: string }
) {
  const org = await resolveOrg(orgId);
  if (!org) return null;

  return withTenantDb(org.legacyId, async () => {
    const conn = getActiveConnection();
    const UserModel = conn.models.User || conn.model('User', User.schema);

    const patch: Record<string, unknown> = {};
    if (updates.isActive !== undefined) patch.isActive = updates.isActive;
    if (updates.password) patch.password = await hashPassword(updates.password);

    const user = await UserModel.findOneAndUpdate(
      { _id: userId, tenantId: org.legacyId },
      patch,
      { new: true }
    ).select('-password');

    if (!user) return undefined;

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive !== false,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    } satisfies TenantAccessUser;
  });
}

export async function updateTenantClient(
  orgId: string,
  clientId: string,
  updates: { isActive?: boolean; password?: string }
) {
  const org = await resolveOrg(orgId);
  if (!org) return null;

  return withTenantDb(org.legacyId, async () => {
    const conn = getActiveConnection();
    const ClientModel = conn.models.Client || conn.model('Client', Client.schema);

    const patch: Record<string, unknown> = {};
    if (updates.isActive !== undefined) patch.isActive = updates.isActive;
    if (updates.password) patch.password = await hashPassword(updates.password);

    const client = await ClientModel.findOneAndUpdate(
      { _id: clientId, tenantId: org.legacyId },
      patch,
      { new: true }
    ).select('+password');

    if (!client) return undefined;

    return {
      id: client._id.toString(),
      name: client.name,
      email: client.email,
      phone: client.phone,
      company: client.company,
      isActive: client.isActive !== false,
      hasPassword: !!client.password,
      lastLoginAt: client.lastLoginAt,
      createdAt: client.createdAt,
    } satisfies TenantAccessClient;
  });
}
