import { User } from '../models/User.js';
import { Client } from '../models/Client.js';
import { comparePassword } from '../utils/password.js';
import { withTenantDb } from '../middleware/tenantDb.js';
import { getActiveConnection, getTenantContext } from '../middleware/tenantContext.js';
import type { AuthUser } from '../middleware/auth.js';

async function authenticateInContext(
  loginField: string,
  password: string,
  tenantId: string,
  userType: 'manager' | 'client'
): Promise<AuthUser | null> {
  const conn = getActiveConnection();
  const UserModel = conn.models.User || conn.model('User', User.schema);
  const ClientModel = conn.models.Client || conn.model('Client', Client.schema);

  if (userType === 'manager') {
    const user = await UserModel.findOne({
      tenantId,
      isActive: { $ne: false },
      $or: [{ email: loginField }, { phone: loginField }],
    }).select('+password');

    if (!user || !(await comparePassword(password, user.password))) {
      return null;
    }

    return {
      id: user._id.toString(),
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      username: user.username,
      role: user.role,
      userType: 'manager',
    };
  }

  const client = await ClientModel.findOne({
    tenantId,
    isActive: { $ne: false },
    $or: [{ email: loginField }, { phone: loginField }],
  }).select('+password');

  if (!client?.password || !(await comparePassword(password, client.password))) {
    return null;
  }

  return {
    id: client._id.toString(),
    tenantId: client.tenantId,
    name: client.name,
    email: client.email,
    phone: client.phone,
    role: 'client',
    userType: 'client',
  };
}

export async function authenticate(
  loginField: string,
  password: string,
  tenantId: string,
  userType: 'manager' | 'client' = 'manager'
): Promise<AuthUser | null> {
  return withTenantDb(tenantId, () => {
    const ctx = getTenantContext();
    const effectiveTenantId = ctx?.legacyId || tenantId.trim().toUpperCase();
    return authenticateInContext(loginField, password, effectiveTenantId, userType);
  });
}
