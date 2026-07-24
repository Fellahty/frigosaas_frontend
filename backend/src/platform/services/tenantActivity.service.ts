import type { Request } from 'express';
import { LoginLogModel } from '../models/LoginLog.js';
import { InteractionLogModel } from '../models/InteractionLog.js';
import { OrganizationModel } from '../models/Organization.js';
import { resolveOrganization } from '../../middleware/tenantDb.js';
import { withTenantDb } from '../../middleware/tenantDb.js';
import { getActiveConnection } from '../../middleware/tenantContext.js';
import { User } from '../../models/User.js';
import { Client } from '../../models/Client.js';
import type { AuthUser } from '../../middleware/auth.js';
import type { PlatformAuthUser } from '../../middleware/platformAuth.js';

export function getRequestMeta(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim()
      : req.socket.remoteAddress || undefined;
  const userAgent = req.headers['user-agent'];
  return { ip, userAgent };
}

function safeSummary(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  const name = record.name || record.title || record.room || record.label;
  if (typeof name === 'string' && name.length > 0) return name.slice(0, 120);
  return undefined;
}

export function inferInteractionAction(method: string, path: string): {
  action: string;
  resourceType?: string;
  resourceId?: string;
} {
  const normalized = path.replace(/^\/api\//, '').replace(/\/$/, '');
  const parts = normalized.split('/').filter(Boolean);

  let resourceType: string | undefined;
  let resourceId: string | undefined;

  const tenantsIdx = parts.indexOf('tenants');
  if (tenantsIdx >= 0 && parts[tenantsIdx + 2]) {
    resourceType = parts[tenantsIdx + 2];
    resourceId = parts[tenantsIdx + 3];
  } else if (parts[0] === 'data' && parts[1]) {
    resourceType = parts[1];
    resourceId = parts[2];
  } else if (parts[0] === 'uploads') {
    resourceType = 'upload';
  } else if (parts[0] === 'settings') {
    resourceType = 'settings';
  }

  const verb =
    method === 'POST'
      ? 'create'
      : method === 'PATCH' || method === 'PUT'
        ? 'update'
        : method === 'DELETE'
          ? 'delete'
          : 'action';

  const action = resourceType ? `${resourceType}.${verb}` : `api.${verb}`;
  return { action, resourceType, resourceId };
}

export async function recordTenantLogin(
  req: Request,
  tenantId: string,
  user: AuthUser,
  userType: 'manager' | 'client'
) {
  const org = await resolveOrganization(tenantId);
  const meta = getRequestMeta(req);

  if (org) {
    await OrganizationModel().updateOne(
      { _id: org._id },
      { $set: { lastLoginAt: new Date() }, $inc: { loginCount: 1 } }
    );
  }

  await withTenantDb(tenantId, async () => {
    const conn = getActiveConnection();
    if (userType === 'manager') {
      const UserModel = conn.models.User || conn.model('User', User.schema);
      await UserModel.updateOne({ _id: user.id }, { lastLoginAt: new Date() });
    } else {
      const ClientModel = conn.models.Client || conn.model('Client', Client.schema);
      await ClientModel.updateOne({ _id: user.id }, { lastLoginAt: new Date() });
    }
  });

  const Login = LoginLogModel();
  await Login.create({
    scope: 'tenant',
    organizationId: org?._id.toString(),
    organizationName: org?.name,
    legacyId: org?.legacyId || user.tenantId,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userType,
    role: user.role,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  if (org) {
    const Interaction = InteractionLogModel();
    await Interaction.create({
      organizationId: org._id.toString(),
      organizationName: org.name,
      legacyId: org.legacyId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      userType,
      action: 'auth.login',
      method: 'POST',
      path: '/api/auth/login',
      resourceType: 'auth',
      summary: `Connexion ${userType === 'manager' ? 'équipe' : 'client final'}`,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}

export async function recordPlatformLogin(req: Request, user: PlatformAuthUser) {
  const meta = getRequestMeta(req);
  const Login = LoginLogModel();
  await Login.create({
    scope: 'platform',
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userType: 'platform',
    role: user.role,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

export async function recordTenantInteraction(
  req: Request,
  user: AuthUser,
  statusCode: number
) {
  if (statusCode >= 400) return;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;

  const path = req.originalUrl.split('?')[0] || req.path;
  if (path.includes('/data/query')) return;

  const org = await resolveOrganization(user.tenantId);
  if (!org) return;

  const { action, resourceType, resourceId } = inferInteractionAction(req.method, path);
  const meta = getRequestMeta(req);

  const Interaction = InteractionLogModel();
  await Interaction.create({
    organizationId: org._id.toString(),
    organizationName: org.name,
    legacyId: org.legacyId,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
    userType: user.userType,
    action,
    method: req.method,
    path,
    resourceType,
    resourceId,
    summary: safeSummary(req.body),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

export async function listLoginLogs(options: {
  organizationId?: string;
  scope?: 'tenant' | 'platform';
  limit?: number;
  skip?: number;
}) {
  const Login = LoginLogModel();
  const filter: Record<string, string> = {};
  if (options.organizationId) filter.organizationId = options.organizationId;
  if (options.scope) filter.scope = options.scope;

  const [logs, total] = await Promise.all([
    Login.find(filter).sort({ createdAt: -1 }).skip(options.skip ?? 0).limit(options.limit ?? 50).lean(),
    Login.countDocuments(filter),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l._id.toString(),
      scope: l.scope,
      organizationId: l.organizationId,
      organizationName: l.organizationName,
      legacyId: l.legacyId,
      userId: l.userId,
      userName: l.userName,
      userEmail: l.userEmail,
      userType: l.userType,
      role: l.role,
      ip: l.ip,
      userAgent: l.userAgent,
      createdAt: l.createdAt,
    })),
    total,
  };
}

export async function listInteractionLogs(options: {
  organizationId?: string;
  userId?: string;
  limit?: number;
  skip?: number;
}) {
  const Interaction = InteractionLogModel();
  const filter: Record<string, string> = {};
  if (options.organizationId) filter.organizationId = options.organizationId;
  if (options.userId) filter.userId = options.userId;

  const [logs, total] = await Promise.all([
    Interaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(options.skip ?? 0)
      .limit(options.limit ?? 100)
      .lean(),
    Interaction.countDocuments(filter),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l._id.toString(),
      organizationId: l.organizationId,
      organizationName: l.organizationName,
      legacyId: l.legacyId,
      userId: l.userId,
      userName: l.userName,
      userEmail: l.userEmail,
      userRole: l.userRole,
      userType: l.userType,
      action: l.action,
      method: l.method,
      path: l.path,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      summary: l.summary,
      ip: l.ip,
      createdAt: l.createdAt,
    })),
    total,
  };
}
