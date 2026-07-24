import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Client } from '../../src/models/Client.js';
import { Room } from '../../src/models/Room.js';
import { SiteSettings } from '../../src/models/SiteSettings.js';
import { hashPassword } from '../../src/utils/password.js';
import { ensureYazamiActive } from './helpers/fixtures.js';

let app: ReturnType<typeof createApp>;

function getApp() {
  if (!app) app = createApp();
  return app;
}

const TENANT = 'YAZAMI';

async function seedTestData() {
  const admin = await User.create({
    tenantId: TENANT,
    name: 'Admin Test',
    email: 'admin@test.com',
    phone: '+212600000001',
    username: 'admin',
    password: await hashPassword('admin123'),
    role: 'admin',
    isActive: true,
  });

  await User.create({
    tenantId: TENANT,
    name: 'Viewer Test',
    email: 'viewer@test.com',
    password: await hashPassword('viewer123'),
    role: 'viewer',
    isActive: true,
  });

  await Client.create({
    tenantId: TENANT,
    name: 'Client Test',
    email: 'client@test.com',
    phone: '+212611111111',
    password: await hashPassword('client123'),
  });

  await Room.create({
    tenantId: TENANT,
    room: 'CH1',
    capacity: 5000,
    sensorId: 'S-CH1',
    active: true,
    capteurInstalled: true,
  });

  await SiteSettings.create({
    tenantId: TENANT,
    name: 'Frigo Test',
    currency: 'MAD',
    locale: 'fr',
    season: { from: '2025-06-01', to: '2025-10-31' },
    capacity_unit: 'caisses',
    initial_cash_balance: 1000,
  });

  return admin;
}

async function login(email: string, password: string) {
  const res = await request(getApp())
    .post('/api/auth/login')
    .send({ loginField: email, password, tenantId: TENANT, userType: 'manager' });
  return res.body.data.token as string;
}

beforeEach(async () => {
  await ensureYazamiActive();
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

describe('API Routes', () => {
  describe('GET /api/health', () => {
    it('returns ok status', async () => {
      const res = await request(getApp()).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns token for valid manager credentials', async () => {
      await seedTestData();
      const res = await request(getApp())
        .post('/api/auth/login')
        .send({ loginField: 'admin@test.com', password: 'admin123', tenantId: TENANT });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('admin');
    });

    it('returns token for valid client credentials', async () => {
      await seedTestData();
      const res = await request(getApp())
        .post('/api/auth/login')
        .send({ loginField: 'client@test.com', password: 'client123', tenantId: TENANT, userType: 'client' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('client');
      expect(res.body.data.user.userType).toBe('client');
    });

    it('returns 401 for invalid credentials', async () => {
      await seedTestData();
      const res = await request(getApp())
        .post('/api/auth/login')
        .send({ loginField: 'admin@test.com', password: 'wrong', tenantId: TENANT });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(getApp()).post('/api/auth/login').send({ loginField: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user with valid token', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      const res = await request(getApp()).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('admin@test.com');
    });

    it('returns 401 without token', async () => {
      const res = await request(getApp()).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Users /api/tenants/:tenantId/users', () => {
    it('GET lists users for admin', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      const res = await request(getApp())
        .get(`/api/tenants/${TENANT}/users`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('POST creates user (admin only)', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      const res = await request(getApp())
        .post(`/api/tenants/${TENANT}/users`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Manager', email: 'manager@test.com', password: 'manager123', role: 'manager' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Manager');
    });

    it('POST returns 403 for viewer', async () => {
      await seedTestData();
      const token = await login('viewer@test.com', 'viewer123');

      const res = await request(getApp())
        .post(`/api/tenants/${TENANT}/users`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Fail', email: 'fail@test.com', password: 'fail123', role: 'manager' });

      expect(res.status).toBe(403);
    });

    it('PATCH updates user', async () => {
      const admin = await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      const res = await request(getApp())
        .patch(`/api/tenants/${TENANT}/users/${admin._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Admin Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Admin Updated');
    });

    it('DELETE removes user', async () => {
      const admin = await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      const viewer = await User.findOne({ email: 'viewer@test.com' });

      const res = await request(getApp())
        .delete(`/api/tenants/${TENANT}/users/${viewer!._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Clients /api/tenants/:tenantId/clients', () => {
    it('GET lists clients', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      const res = await request(getApp())
        .get(`/api/tenants/${TENANT}/clients`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('POST creates client', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      const res = await request(getApp())
        .post(`/api/tenants/${TENANT}/clients`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nouveau Client', email: 'new@client.com', password: 'pass1234' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Nouveau Client');
    });

    it('GET /:id returns single client', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');
      const client = await Client.findOne({ email: 'client@test.com' });

      const res = await request(getApp())
        .get(`/api/tenants/${TENANT}/clients/${client!._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('client@test.com');
    });

    it('PATCH updates client', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');
      const client = await Client.findOne({ email: 'client@test.com' });

      const res = await request(getApp())
        .patch(`/api/tenants/${TENANT}/clients/${client!._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ company: 'Test SARL' });

      expect(res.status).toBe(200);
      expect(res.body.data.company).toBe('Test SARL');
    });

    it('DELETE removes client', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');
      const client = await Client.findOne({ email: 'client@test.com' });

      const res = await request(getApp())
        .delete(`/api/tenants/${TENANT}/clients/${client!._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Rooms /api/tenants/:tenantId/rooms', () => {
    it('GET lists rooms', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      const res = await request(getApp())
        .get(`/api/tenants/${TENANT}/rooms`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('GET filters active rooms', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      await Room.create({
        tenantId: TENANT,
        room: 'CH2',
        capacity: 3000,
        sensorId: 'S-CH2',
        active: false,
        capteurInstalled: false,
      });

      const res = await request(getApp())
        .get(`/api/tenants/${TENANT}/rooms?active=true`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((r: { active: boolean }) => r.active)).toBe(true);
    });

    it('POST creates room', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      const res = await request(getApp())
        .post(`/api/tenants/${TENANT}/rooms`)
        .set('Authorization', `Bearer ${token}`)
        .send({ room: 'CH3', capacity: 4000, sensorId: 'S-CH3' });

      expect(res.status).toBe(201);
      expect(res.body.data.room).toBe('CH3');
    });

    it('PATCH updates room', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');
      const room = await Room.findOne({ room: 'CH1' });

      const res = await request(getApp())
        .patch(`/api/tenants/${TENANT}/rooms/${room!._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ capteurInstalled: false });

      expect(res.status).toBe(200);
      expect(res.body.data.capteurInstalled).toBe(false);
    });

    it('DELETE removes room (admin only)', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');
      const room = await Room.findOne({ room: 'CH1' });

      const res = await request(getApp())
        .delete(`/api/tenants/${TENANT}/rooms/${room!._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Settings /api/tenants/:tenantId/settings', () => {
    it('GET returns site settings', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      const res = await request(getApp())
        .get(`/api/tenants/${TENANT}/settings`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Frigo Test');
    });

    it('PUT updates settings', async () => {
      await seedTestData();
      const token = await login('admin@test.com', 'admin123');

      const res = await request(getApp())
        .put(`/api/tenants/${TENANT}/settings`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tarif_caisse_saison: 3.5, caution_par_caisse: 60 });

      expect(res.status).toBe(200);
      expect(res.body.data.tarif_caisse_saison).toBe(3.5);
    });
  });

  describe('404 handler', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(getApp()).get('/api/unknown-route');
      expect(res.status).toBe(404);
    });
  });
});

describe('Route inventory', () => {
  const EXPECTED_ROUTES = [
    'GET    /api/health',
    'POST   /api/auth/login',
    'GET    /api/auth/me',
    'GET    /api/tenants/:tenantId/users',
    'POST   /api/tenants/:tenantId/users',
    'PATCH  /api/tenants/:tenantId/users/:id',
    'DELETE /api/tenants/:tenantId/users/:id',
    'GET    /api/tenants/:tenantId/clients',
    'GET    /api/tenants/:tenantId/clients/:id',
    'POST   /api/tenants/:tenantId/clients',
    'PATCH  /api/tenants/:tenantId/clients/:id',
    'DELETE /api/tenants/:tenantId/clients/:id',
    'GET    /api/tenants/:tenantId/rooms',
    'GET    /api/tenants/:tenantId/rooms/:id',
    'POST   /api/tenants/:tenantId/rooms',
    'PATCH  /api/tenants/:tenantId/rooms/:id',
    'DELETE /api/tenants/:tenantId/rooms/:id',
    'GET    /api/tenants/:tenantId/settings',
    'PUT    /api/tenants/:tenantId/settings',
  ];

  const PLANNED_ROUTES = [
    'reservations',
    'cashMovements',
    'receptions',
    'empty_crate_loans',
    'trucks',
    'drivers',
    'products',
    'invoices',
    'caution_records',
    'crate-types',
    'logs',
    'uploads',
  ];

  it('documents all implemented routes', () => {
    expect(EXPECTED_ROUTES.length).toBe(19);
  });

  it('documents planned routes not yet implemented', () => {
    expect(PLANNED_ROUTES.length).toBeGreaterThan(0);
  });
});
