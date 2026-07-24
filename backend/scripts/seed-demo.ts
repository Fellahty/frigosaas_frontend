/**
 * Seed a full DEMO fridge for public / sales demos.
 *
 * - Organization slug: demo → DB frigo_demo
 * - Rooms named "Chambre N" to match live sensor API (api.frigosmart.com)
 * - Clients, receptions, reservations so dashboard & map look populated
 *
 * Usage: npm run seed:demo
 *
 * Login:
 *   http://localhost:3000/login/demo
 *   Gestionnaire: manager@demo.frigosmart.com / demo1234
 *   Client:       0611000001 / client123
 */
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { connectPlatformDatabase, disconnectPlatformDatabase } from '../src/config/platformDatabase.js';
import { getTenantConnection } from '../src/config/tenantDatabase.js';
import { provisionTenant } from '../src/platform/services/tenantProvisioner.js';
import { OrganizationModel } from '../src/platform/models/Organization.js';
import { SubscriptionModel } from '../src/platform/models/Subscription.js';
import { DEFAULT_FACILITY_GROUPS } from '../src/platform/constants/facilityGroups.js';
import { Room } from '../src/models/Room.js';
import { Client } from '../src/models/Client.js';
import { User } from '../src/models/User.js';
import { SiteSettings } from '../src/models/SiteSettings.js';
import { hashPassword } from '../src/utils/password.js';
import { invalidateOrgCache } from '../src/platform/services/orgCache.js';
import { ensureTenantIndexes } from '../src/platform/services/tenantIndexes.js';

dotenv.config();

const SLUG = 'demo';
const LEGACY_ID = 'DEMO';
const DB_NAME = 'frigo_demo';
const BOITIE_ID = '6925665'; // Flespi device used by api.frigosmart.com

/** Exact names from GET https://api.frigosmart.com/rooms/latest */
const SENSOR_ROOMS = [
  { room: 'Chambre 1', capacity: 12550, athGroupNumber: 1 },
  { room: 'Chambre 2', capacity: 12550, athGroupNumber: 1 },
  { room: 'Chambre 3', capacity: 12550, athGroupNumber: 1 },
  { room: 'Chambre 4', capacity: 12550, athGroupNumber: 1 },
  { room: 'Chambre 5', capacity: 12550, athGroupNumber: 1 },
  { room: 'Chambre 6', capacity: 12550, athGroupNumber: 1 },
  { room: 'Chambre 7', capacity: 13100, athGroupNumber: 2 },
  { room: 'Chambre 8', capacity: 13100, athGroupNumber: 2 },
  { room: 'Chambre 9', capacity: 13100, athGroupNumber: 2 },
  { room: 'Chambre 10', capacity: 13100, athGroupNumber: 2 },
  { room: 'Chambre 11', capacity: 13100, athGroupNumber: 2 },
  { room: 'Chambre 12', capacity: 13100, athGroupNumber: 2 },
];

const COULOIRS = [
  { room: 'Couloir 1', capacity: 10000, athGroupNumber: 1 },
  { room: 'Couloir 2', capacity: 10000, athGroupNumber: 2 },
];

async function ensureOrg() {
  const Org = OrganizationModel();
  let org = await Org.findOne({ slug: SLUG });

  if (!org) {
    org = await provisionTenant({
      slug: SLUG,
      name: 'Frigo Démo',
      contactEmail: 'demo@frigosmart.com',
      plan: 'pro',
      adminEmail: 'manager@demo.frigosmart.com',
      adminPassword: 'demo1234',
      adminName: 'Manager Démo',
    });
    console.log('✅ Organisation DEMO créée');
  } else {
    console.log('ℹ️  Organisation DEMO existe déjà');
  }

  await Org.updateOne(
    { slug: SLUG },
    {
      status: 'active',
      plan: 'pro',
      sensorApiEnabled: true,
      maxRooms: 20,
      maxUsers: 10,
      maxClients: 200,
      name: 'Frigo Démo',
      facilityGroups: DEFAULT_FACILITY_GROUPS,
    }
  );

  const Sub = SubscriptionModel();
  const sub = await Sub.findOne({ organizationId: org._id.toString() });
  if (sub) {
    await Sub.updateOne({ _id: sub._id }, { status: 'active', plan: 'pro' });
  }

  invalidateOrgCache(SLUG);
  invalidateOrgCache(LEGACY_ID);
  return org;
}

async function seedTenantData() {
  const conn = await getTenantConnection(DB_NAME);
  await ensureTenantIndexes(conn);

  const RoomModel = conn.models.Room || conn.model('Room', Room.schema);
  const ClientModel = conn.models.Client || conn.model('Client', Client.schema);
  const UserModel = conn.models.User || conn.model('User', User.schema);
  const SiteModel = conn.models.SiteSettings || conn.model('SiteSettings', SiteSettings.schema);

  // Manager (idempotent)
  const managerEmail = 'manager@demo.frigosmart.com';
  let manager = await UserModel.findOne({ tenantId: LEGACY_ID, email: managerEmail });
  if (!manager) {
    manager = await UserModel.create({
      tenantId: LEGACY_ID,
      name: 'Manager Démo',
      email: managerEmail,
      phone: '0600000001',
      password: await hashPassword('demo1234'),
      role: 'admin',
      isActive: true,
    });
    console.log('✅ Manager: manager@demo.frigosmart.com / demo1234');
  } else {
    console.log('ℹ️  Manager déjà présent');
  }

  await SiteModel.findOneAndUpdate(
    { tenantId: LEGACY_ID },
    {
      tenantId: LEGACY_ID,
      name: 'Frigo Démo',
      currency: 'MAD',
      locale: 'fr',
      season: { from: '2026-06-01', to: '2026-10-31' },
      capacity_unit: 'caisses',
      ratio_caisses_par_palette: 20,
      initial_cash_balance: 15000,
      pool_vides_total: 8000,
      tarif_caisse_saison: 2.5,
      caution_par_caisse: 50,
      paymentTerms: { mode: 'due_on_exit' },
    },
    { upsert: true }
  );
  console.log('✅ Paramètres site');

  // Rooms with sensors (names MUST match api.frigosmart.com)
  const roomDocs: Array<{ id: string; room: string }> = [];
  for (const [i, r] of [...SENSOR_ROOMS, ...COULOIRS].entries()) {
    const n = r.room.match(/\d+/)?.[0] ?? String(i + 1);
    const isCouloir = r.room.startsWith('Couloir');
    const doc = await RoomModel.findOneAndUpdate(
      { tenantId: LEGACY_ID, room: r.room },
      {
        tenantId: LEGACY_ID,
        room: r.room,
        capacity: r.capacity,
        capacityCrates: r.capacity,
        capacityPallets: Math.round(r.capacity / 20),
        sensorId: isCouloir ? `S-COU${n}` : `S-CH${n}`,
        active: true,
        capteurInstalled: !isCouloir,
        athGroupNumber: r.athGroupNumber,
        boitieSensorId: BOITIE_ID,
      },
      { upsert: true, new: true }
    );
    roomDocs.push({ id: doc._id.toString(), room: r.room });
  }
  console.log(`✅ ${roomDocs.length} chambres (capteurs sur Chambre 1–12 ↔ API live)`);

  // Clients
  const clientsSeed = [
    {
      name: 'Coopérative Atlas',
      email: 'atlas@demo.com',
      phone: '0611000001',
      company: 'Atlas Fruits',
    },
    {
      name: 'Domaine Al Amal',
      email: 'alamal@demo.com',
      phone: '0611000002',
      company: 'Al Amal SARL',
    },
    {
      name: 'Station Nordine',
      email: 'nordine@demo.com',
      phone: '0611000003',
      company: 'Nordine Export',
    },
  ];

  const clientDocs: Array<{ id: string; name: string; phone: string }> = [];
  for (const c of clientsSeed) {
    let client = await ClientModel.findOne({ tenantId: LEGACY_ID, phone: c.phone });
    if (!client) {
      client = await ClientModel.create({
        ...c,
        tenantId: LEGACY_ID,
        password: await hashPassword('client123'),
        isActive: true,
        createdBy: 'seed:demo',
      });
    }
    clientDocs.push({ id: client._id.toString(), name: c.name, phone: c.phone });
  }
  console.log('✅ 3 clients (mdp client123) — ex. 0611000001');

  // Ops scaffolding + receptions / reservations via native collections
  const db = conn.db!;
  const trucks = db.collection('trucks');
  const drivers = db.collection('drivers');
  const products = db.collection('products');
  const receptions = db.collection('receptions');
  const reservations = db.collection('reservations');
  const crateTypes = db.collection('crate-types');

  await trucks.updateOne(
    { tenantId: LEGACY_ID, number: '12654-A-12' },
    {
      $set: {
        tenantId: LEGACY_ID,
        number: '12654-A-12',
        color: 'Blanc',
        isActive: true,
      },
    },
    { upsert: true }
  );
  await drivers.updateOne(
    { tenantId: LEGACY_ID, phone: '0622000001' },
    {
      $set: {
        tenantId: LEGACY_ID,
        name: 'Hassan Benali',
        phone: '0622000001',
        licenseNumber: 'MA-123456',
        isActive: true,
      },
    },
    { upsert: true }
  );
  await products.updateOne(
    { tenantId: LEGACY_ID, name: 'Pommier', variety: 'GOLDEN' },
    {
      $set: {
        tenantId: LEGACY_ID,
        name: 'Pommier',
        variety: 'GOLDEN',
        isActive: true,
      },
    },
    { upsert: true }
  );
  await products.updateOne(
    { tenantId: LEGACY_ID, name: 'Pommier', variety: 'GALA' },
    {
      $set: {
        tenantId: LEGACY_ID,
        name: 'Pommier',
        variety: 'GALA',
        isActive: true,
      },
    },
    { upsert: true }
  );
  await crateTypes.updateOne(
    { tenantId: LEGACY_ID, name: 'Bois 18kg' },
    { $set: { tenantId: LEGACY_ID, name: 'Bois 18kg', isActive: true } },
    { upsert: true }
  );

  const truck = await trucks.findOne({ tenantId: LEGACY_ID, number: '12654-A-12' });
  const driver = await drivers.findOne({ tenantId: LEGACY_ID, phone: '0622000001' });
  const product = await products.findOne({ tenantId: LEGACY_ID, variety: 'GOLDEN' });

  // Fresh demo receptions (last 5 days) — clear previous seed:demo markers
  await receptions.deleteMany({ tenantId: LEGACY_ID, source: 'seed:demo' });
  await reservations.deleteMany({ tenantId: LEGACY_ID, notes: 'seed:demo' });

  const now = Date.now();
  const receptionPayloads = [
    { roomIdx: 0, clientIdx: 0, crates: 1200, daysAgo: 1 },
    { roomIdx: 1, clientIdx: 1, crates: 800, daysAgo: 2 },
    { roomIdx: 2, clientIdx: 0, crates: 1500, daysAgo: 3 },
    { roomIdx: 6, clientIdx: 2, crates: 2000, daysAgo: 1 },
    { roomIdx: 7, clientIdx: 1, crates: 950, daysAgo: 4 },
    { roomIdx: 3, clientIdx: 2, crates: 600, daysAgo: 0 },
  ];

  for (const [i, p] of receptionPayloads.entries()) {
    const room = roomDocs[p.roomIdx];
    const client = clientDocs[p.clientIdx];
    const createdAt = new Date(now - p.daysAgo * 24 * 60 * 60 * 1000 - i * 3600_000);
    await receptions.insertOne({
      tenantId: LEGACY_ID,
      serial: `RCP-DEMO-${String(i + 1).padStart(4, '0')}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      truckId: truck?._id?.toString() || '',
      truckNumber: '12654-A-12',
      driverId: driver?._id?.toString() || '',
      driverName: 'Hassan Benali',
      driverPhone: '0622000001',
      productId: product?._id?.toString() || '',
      productName: 'Pommier',
      productVariety: 'GOLDEN',
      roomId: room.id,
      roomName: room.room,
      totalCrates: p.crates,
      crateType: 'Bois 18kg',
      status: 'completed',
      notes: 'Données de démonstration',
      source: 'seed:demo',
      arrivalTime: createdAt,
      createdAt,
      updatedAt: createdAt,
    });
  }
  console.log(`✅ ${receptionPayloads.length} réceptions demo`);

  const resRoomsA = [roomDocs[0].id, roomDocs[1].id];
  const resRoomsB = [roomDocs[6].id, roomDocs[7].id];

  await reservations.insertMany([
    {
      tenantId: LEGACY_ID,
      reference: 'RES-DEMO-ATLAS',
      clientId: clientDocs[0].id,
      clientName: clientDocs[0].name,
      reservedCrates: 2500,
      emptyCratesNeeded: 500,
      selectedRooms: resRoomsA,
      status: 'APPROVED',
      capacityOk: true,
      notes: 'seed:demo',
      createdAt: new Date(now - 2 * 86400_000),
      updatedAt: new Date(),
    },
    {
      tenantId: LEGACY_ID,
      reference: 'RES-DEMO-AMAL',
      clientId: clientDocs[1].id,
      clientName: clientDocs[1].name,
      reservedCrates: 1800,
      emptyCratesNeeded: 300,
      selectedRooms: resRoomsB,
      status: 'APPROVED',
      capacityOk: true,
      notes: 'seed:demo',
      createdAt: new Date(now - 1 * 86400_000),
      updatedAt: new Date(),
    },
    {
      tenantId: LEGACY_ID,
      reference: 'RES-DEMO-NORD',
      clientId: clientDocs[2].id,
      clientName: clientDocs[2].name,
      reservedCrates: 900,
      emptyCratesNeeded: 200,
      selectedRooms: [roomDocs[4].id],
      status: 'REQUESTED',
      capacityOk: true,
      notes: 'seed:demo',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  console.log('✅ 3 réservations demo');
}

async function main() {
  console.log('🌱 Seed DEMO — Frigo showcase\n');
  await connectDatabase();
  await connectPlatformDatabase();

  await ensureOrg();
  await seedTenantData();

  console.log(`
🎉 Demo prête

  URL gestionnaire : http://localhost:3000/login/demo
  Email            : manager@demo.frigosmart.com
  Mot de passe     : demo1234

  URL client       : même page, type « Client »
  Téléphone        : 0611000001
  Mot de passe     : client123

  Capteurs         : page Capteurs — temps réel via api.frigosmart.com
                     (Chambre 1–12, device ${BOITIE_ID})
`);

  await disconnectPlatformDatabase();
  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
