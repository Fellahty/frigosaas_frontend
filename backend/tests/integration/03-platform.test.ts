import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { getTenantConnection, getTenantConnectionStats } from '../../src/config/tenantDatabase.js';
import { OrganizationModel } from '../../src/platform/models/Organization.js';
import { clearDefaultTestDb, seedPlatformAdmin, TENANT_YAZAMI, ensureYazamiActive } from './helpers/fixtures.js';
import { User } from '../../src/models/User.js';
import { Client } from '../../src/models/Client.js';
import { hashPassword } from '../../src/utils/password.js';

let app: ReturnType<typeof createApp>;

function getApp() {
  if (!app) app = createApp();
  return app;
}

async function loginPlatform() {
  const res = await request(getApp())
    .post('/api/platform/auth/login')
    .send({ email: 'admin@test.frigosmart.com', password: 'superadmin123' });
  return res.body.data?.token as string;
}

beforeEach(async () => {
  await ensureYazamiActive();
  await clearDefaultTestDb();
  await seedPlatformAdmin();
});

afterAll(async () => {
  await ensureYazamiActive();
  const { disconnectAllTenants } = await import('../../src/config/tenantDatabase.js');
  await disconnectAllTenants();
});

describe('Platform Admin API', () => {
  it('lists registered clients including YAZAMI', async () => {
    const token = await loginPlatform();

    const res = await request(getApp())
      .get('/api/admin/organizations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((o: { legacyId: string }) => o.legacyId === TENANT_YAZAMI)).toBe(true);
  });

  it('returns dashboard stats', async () => {
    const token = await loginPlatform();

    const res = await request(getApp())
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.stats).toBeDefined();
    expect(res.body.data.stats.totalFrigos).toBeGreaterThanOrEqual(1);
  });

  it('creates a new client with isolated database', async () => {
    const token = await loginPlatform();
    const slug = `test${Date.now().toString(36)}`;

    const res = await request(getApp())
      .post('/api/admin/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug,
        name: 'Frigo Test Provision',
        adminEmail: `admin-${slug}@test.com`,
        adminPassword: 'password123',
        plan: 'starter',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.dbName).toBe(`frigo_${slug}`);
    expect(res.body.data.legacyId).toBeDefined();

    const conn = await getTenantConnection(res.body.data.dbName);
    expect(conn.readyState).toBe(1);

    const Org = OrganizationModel();
    const org = await Org.findById(res.body.data._id);
    expect(org?.status).toBe('trial');
  });

  it('rejects duplicate slug', async () => {
    const token = await loginPlatform();
    const slug = `dup${Date.now().toString(36)}`;

    const payload = {
      slug,
      name: 'First',
      adminEmail: `a-${slug}@test.com`,
      adminPassword: 'password123',
    };

    const first = await request(getApp())
      .post('/api/admin/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(first.status).toBe(201);

    const res = await request(getApp())
      .post('/api/admin/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payload, name: 'Second', adminEmail: `b-${slug}@test.com` });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('updates client configuration', async () => {
    const token = await loginPlatform();
    const orgs = await request(getApp())
      .get('/api/admin/organizations')
      .set('Authorization', `Bearer ${token}`);
    const yazami = orgs.body.data.find((o: { legacyId: string }) => o.legacyId === TENANT_YAZAMI);

    const res = await request(getApp())
      .patch(`/api/admin/organizations/${yazami._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maxRooms: 25, plan: 'enterprise' });

    expect(res.status).toBe(200);
    expect(res.body.data.maxRooms).toBe(25);
    expect(res.body.data.plan).toBe('enterprise');
  });

  it('lists and manages tenant user and client access', async () => {
    const tenantUser = await User.create({
      tenantId: TENANT_YAZAMI,
      name: 'Access Test User',
      email: 'access@test.com',
      password: await hashPassword('oldpass123'),
      role: 'manager',
      isActive: true,
    });

    const tenantClient = await Client.create({
      tenantId: TENANT_YAZAMI,
      name: 'Access Test Client',
      email: 'client-access@test.com',
      password: await hashPassword('clientold123'),
      isActive: true,
    });

    const token = await loginPlatform();
    const orgs = await request(getApp())
      .get('/api/admin/organizations')
      .set('Authorization', `Bearer ${token}`);
    const yazami = orgs.body.data.find((o: { legacyId: string }) => o.legacyId === TENANT_YAZAMI);

    const list = await request(getApp())
      .get(`/api/admin/organizations/${yazami._id}/access`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.users.some((u: { email: string }) => u.email === 'access@test.com')).toBe(true);
    expect(list.body.data.clients.some((c: { email: string }) => c.email === 'client-access@test.com')).toBe(true);

    const block = await request(getApp())
      .patch(`/api/admin/organizations/${yazami._id}/access/users/${tenantUser._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(block.status).toBe(200);
    expect(block.body.data.isActive).toBe(false);

    const loginBlocked = await request(getApp())
      .post('/api/auth/login')
      .send({
        loginField: 'access@test.com',
        password: 'oldpass123',
        tenantId: TENANT_YAZAMI,
        userType: 'manager',
      });
    expect(loginBlocked.status).toBe(401);

    const resetPw = await request(getApp())
      .patch(`/api/admin/organizations/${yazami._id}/access/clients/${tenantClient._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'newpass456' });
    expect(resetPw.status).toBe(200);
    expect(resetPw.body.data.hasPassword).toBe(true);

    const loginNew = await request(getApp())
      .post('/api/auth/login')
      .send({
        loginField: 'client-access@test.com',
        password: 'newpass456',
        tenantId: TENANT_YAZAMI,
        userType: 'client',
      });
    expect(loginNew.status).toBe(200);
  });

  it('returns dashboard with alerts and usage trend', async () => {
    const token = await loginPlatform();
    const res = await request(getApp())
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.alerts)).toBe(true);
    expect(Array.isArray(res.body.data.trend)).toBe(true);
    expect(res.body.data.stats.alertsCount).toBeGreaterThanOrEqual(0);
  });

  it('lists alerts and audit logs', async () => {
    const token = await loginPlatform();
    const orgs = await request(getApp())
      .get('/api/admin/organizations')
      .set('Authorization', `Bearer ${token}`);
    const yazami = orgs.body.data.find((o: { legacyId: string }) => o.legacyId === TENANT_YAZAMI);

    await request(getApp())
      .patch(`/api/admin/organizations/${yazami._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ maxRooms: 30 });

    const alerts = await request(getApp())
      .get('/api/admin/alerts')
      .set('Authorization', `Bearer ${token}`);
    expect(alerts.status).toBe(200);
    expect(Array.isArray(alerts.body.data)).toBe(true);

    const logs = await request(getApp())
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);
    expect(logs.status).toBe(200);
    expect(logs.body.data.logs.length).toBeGreaterThan(0);
    expect(logs.body.data.logs.some((l: { action: string }) => l.action === 'org.update')).toBe(true);

    const history = await request(getApp())
      .get(`/api/admin/organizations/${yazami._id}/usage/history?days=30`)
      .set('Authorization', `Bearer ${token}`);
    expect(history.status).toBe(200);
    expect(Array.isArray(history.body.data.history)).toBe(true);
  });

  it('records tenant last login on auth', async () => {
    await User.create({
      tenantId: TENANT_YAZAMI,
      name: 'Login Track User',
      email: 'logintrack@test.com',
      password: await hashPassword('track123'),
      role: 'manager',
      isActive: true,
    });

    const login = await request(getApp())
      .post('/api/auth/login')
      .send({
        loginField: 'logintrack@test.com',
        password: 'track123',
        tenantId: TENANT_YAZAMI,
        userType: 'manager',
      });
    expect(login.status).toBe(200);

    const token = await loginPlatform();
    const orgs = await request(getApp())
      .get('/api/admin/organizations')
      .set('Authorization', `Bearer ${token}`);
    const yazami = orgs.body.data.find((o: { legacyId: string }) => o.legacyId === TENANT_YAZAMI);
    expect(yazami.lastLoginAt).toBeTruthy();
    expect(yazami.loginCount).toBeGreaterThan(0);
  });

  it('persists login and interaction logs', async () => {
    const tenantUser = await User.create({
      tenantId: TENANT_YAZAMI,
      name: 'Log Test User',
      email: 'logtest@test.com',
      password: await hashPassword('logtest123'),
      role: 'admin',
      isActive: true,
    });

    const login = await request(getApp())
      .post('/api/auth/login')
      .send({
        loginField: 'logtest@test.com',
        password: 'logtest123',
        tenantId: TENANT_YAZAMI,
        userType: 'manager',
      });
    expect(login.status).toBe(200);
    const token = login.body.data.token;

    await request(getApp())
      .post(`/api/tenants/${TENANT_YAZAMI}/clients`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Logged Client', email: 'logged-client@test.com' });

    const platformToken = await loginPlatform();
    const orgs = await request(getApp())
      .get('/api/admin/organizations')
      .set('Authorization', `Bearer ${platformToken}`);
    const yazami = orgs.body.data.find((o: { legacyId: string }) => o.legacyId === TENANT_YAZAMI);

    const loginLogs = await request(getApp())
      .get(`/api/admin/organizations/${yazami._id}/login-logs`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(loginLogs.status).toBe(200);
    expect(loginLogs.body.data.logs.some((l: { userEmail: string }) => l.userEmail === 'logtest@test.com')).toBe(
      true
    );

    const interactions = await request(getApp())
      .get(`/api/admin/organizations/${yazami._id}/interactions`)
      .set('Authorization', `Bearer ${platformToken}`);
    expect(interactions.status).toBe(200);
    expect(interactions.body.data.logs.some((l: { action: string }) => l.action === 'auth.login')).toBe(true);
    expect(interactions.body.data.logs.some((l: { action: string }) => l.action === 'clients.create')).toBe(true);

    void tenantUser;
  });

  it('returns system stats for super_admin', async () => {
    const token = await loginPlatform();

    const res = await request(getApp())
      .get('/api/admin/system')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tenantConnections).toBeDefined();
    expect(res.body.data.orgCache).toBeDefined();
  });

  it('rejects unauthenticated admin access', async () => {
    const res = await request(getApp()).get('/api/admin/organizations');
    expect(res.status).toBe(401);
  });
});

describe('Tenant connection pool', () => {
  it('rejects invalid database names', async () => {
    await expect(getTenantConnection('malicious_db')).rejects.toThrow('non autorisé');
  });

  it('tracks cached connections', async () => {
    await getTenantConnection('frigosaas_test');
    const stats = getTenantConnectionStats();
    expect(stats.active).toBeGreaterThanOrEqual(1);
    expect(stats.databases).toContain('frigosaas_test');
  });
});
