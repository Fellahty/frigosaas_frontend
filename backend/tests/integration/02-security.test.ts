import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { signToken } from '../../src/middleware/auth.js';
import { signPlatformToken } from '../../src/middleware/platformAuth.js';
import {
  ensureYazamiActive,
  clearDefaultTestDb,
  registerOtherTenant,
  seedPlatformAdmin,
  seedYazamiUser,
  TENANT_OTHER,
  TENANT_YAZAMI,
} from './helpers/fixtures.js';
import { invalidateOrgCache } from '../../src/platform/services/orgCache.js';

let app: ReturnType<typeof createApp>;

function getApp() {
  if (!app) app = createApp();
  return app;
}

async function loginTenant(email: string, password: string, tenantId = TENANT_YAZAMI) {
  const res = await request(getApp())
    .post('/api/auth/login')
    .send({ loginField: email, password, tenantId, userType: 'manager' });
  return res.body.data?.token as string | undefined;
}

async function loginPlatform() {
  const res = await request(getApp())
    .post('/api/platform/auth/login')
    .send({ email: 'admin@test.frigosmart.com', password: 'superadmin123' });
  return res.body.data?.token as string | undefined;
}

beforeEach(async () => {
  await ensureYazamiActive();
  await clearDefaultTestDb();
  await seedPlatformAdmin();
  await registerOtherTenant();
});

afterAll(async () => {
  await ensureYazamiActive();
});

describe('Security — tenant isolation', () => {
  it('blocks access to another tenant URL', async () => {
    await seedYazamiUser();
    const token = await loginTenant('yazami@test.com', 'admin123');
    expect(token).toBeDefined();

    const res = await request(getApp())
      .get(`/api/tenants/${TENANT_OTHER}/users`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('allows access to own tenant URL', async () => {
    await seedYazamiUser();
    const token = await loginTenant('yazami@test.com', 'admin123');

    const res = await request(getApp())
      .get(`/api/tenants/${TENANT_YAZAMI}/users`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('blocks data query on another tenant path', async () => {
    await seedYazamiUser();
    const token = await loginTenant('yazami@test.com', 'admin123');

    const res = await request(getApp())
      .post('/api/data/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: ['tenants', TENANT_OTHER, 'clients'] });

    expect(res.status).toBe(403);
  });

  it('allows data query on own tenant path', async () => {
    await seedYazamiUser();
    const token = await loginTenant('yazami@test.com', 'admin123');

    const res = await request(getApp())
      .post('/api/data/query')
      .set('Authorization', `Bearer ${token}`)
      .send({ path: ['tenants', TENANT_YAZAMI, 'clients'] });

    expect(res.status).toBe(200);
  });
});

describe('Security — JWT separation', () => {
  it('rejects platform token on tenant API', async () => {
    await seedPlatformAdmin();
    const platformToken = await loginPlatform();

    const res = await request(getApp())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${platformToken}`);

    expect(res.status).toBe(401);
  });

  it('rejects tenant token on admin API', async () => {
    await seedYazamiUser();
    const tenantToken = await loginTenant('yazami@test.com', 'admin123');

    const res = await request(getApp())
      .get('/api/admin/organizations')
      .set('Authorization', `Bearer ${tenantToken}`);

    expect(res.status).toBe(401);
  });

  it('tenant token includes scope tenant', async () => {
    await seedYazamiUser();
    const token = await loginTenant('yazami@test.com', 'admin123');
    const decoded = jwt.verify(token!, env.jwtSecret) as { scope?: string; tenantId: string };

    expect(decoded.scope).toBe('tenant');
    expect(decoded.tenantId).toBe(TENANT_YAZAMI);
  });

  it('platform token cannot be verified with tenant secret', () => {
    const platformToken = signPlatformToken({
      id: '1',
      name: 'Admin',
      email: 'a@test.com',
      role: 'super_admin',
      scope: 'platform',
    });

    expect(() => jwt.verify(platformToken, env.jwtSecret)).toThrow();
  });

  it('tenant token cannot be verified with platform secret', () => {
    const tenantToken = signToken({
      id: '1',
      tenantId: TENANT_YAZAMI,
      name: 'User',
      role: 'admin',
      userType: 'manager',
    });

    expect(() => jwt.verify(tenantToken, env.platformJwtSecret)).toThrow();
  });
});

describe('Security — suspended tenant', () => {
  it('blocks login and API access when tenant is suspended', async () => {
    await seedYazamiUser();
    const platformToken = await loginPlatform();
    expect(platformToken).toBeDefined();

    const orgs = await request(getApp())
      .get('/api/admin/organizations')
      .set('Authorization', `Bearer ${platformToken}`);
    const yazami = orgs.body.data.find((o: { legacyId: string }) => o.legacyId === TENANT_YAZAMI);
    expect(yazami).toBeDefined();

    const tenantToken = await loginTenant('yazami@test.com', 'admin123');
    expect(tenantToken).toBeDefined();

    try {
      await request(getApp())
        .patch(`/api/admin/organizations/${yazami._id}`)
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ status: 'suspended' });
      invalidateOrgCache();

      const loginRes = await request(getApp())
        .post('/api/auth/login')
        .send({
          loginField: 'yazami@test.com',
          password: 'admin123',
          tenantId: TENANT_YAZAMI,
          userType: 'manager',
        });
      expect(loginRes.status).toBe(403);

      const res = await request(getApp())
        .get(`/api/tenants/${TENANT_YAZAMI}/users`)
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(res.status).toBe(403);
    } finally {
      await request(getApp())
        .patch(`/api/admin/organizations/${yazami._id}`)
        .set('Authorization', `Bearer ${platformToken}`)
        .send({ status: 'active' });
      invalidateOrgCache();
    }
  });
});

describe('Security — authentication hardening', () => {
  it('returns 401 without token on protected routes', async () => {
    const res = await request(getApp()).get(`/api/tenants/${TENANT_YAZAMI}/users`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for malformed token', async () => {
    const res = await request(getApp())
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-valid-jwt');

    expect(res.status).toBe(401);
  });

  it('platform login rejects wrong password', async () => {
    const res = await request(getApp())
      .post('/api/platform/auth/login')
      .send({ email: 'admin@test.frigosmart.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });
});
