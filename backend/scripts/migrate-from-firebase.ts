/**
 * Migration Firebase Firestore → MongoDB
 *
 * Usage:
 *   cd backend
 *   npm run migrate:firebase
 *
 * Options (env):
 *   TENANT_ID=YAZAMI          — tenant to migrate (default: YAZAMI)
 *   DRY_RUN=true              — preview without writing
 *   FIREBASE_PROJECT_ID       — override Firebase project
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from 'firebase/firestore';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Client } from '../src/models/Client.js';
import { Room } from '../src/models/Room.js';
import { SiteSettings } from '../src/models/SiteSettings.js';
import { Log } from '../src/models/Log.js';
import { ImportedRecord } from '../src/models/ImportedRecord.js';
import { hashPassword } from '../src/utils/password.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TENANT_ID = process.env.TENANT_ID || env.defaultTenantId;
const DRY_RUN = process.env.DRY_RUN === 'true';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'frigosaas',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
};

interface MigrationStats {
  users: number;
  clients: number;
  rooms: number;
  settings: number;
  logs: number;
  imported: number;
  errors: string[];
}

const stats: MigrationStats = {
  users: 0,
  clients: 0,
  rooms: 0,
  settings: 0,
  logs: 0,
  imported: 0,
  errors: [],
};

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const ts = value as { seconds: number };
    return new Date(ts.seconds * 1000);
  }
  if (typeof value === 'string') return new Date(value);
  return undefined;
}

function serializeFirestoreData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'toDate' in value) {
      result[key] = (value as { toDate: () => Date }).toDate().toISOString();
    } else if (value && typeof value === 'object' && 'seconds' in value) {
      result[key] = new Date((value as { seconds: number }).seconds * 1000).toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function migrateUsers(db: ReturnType<typeof getFirestore>) {
  console.log('\n📦 Migrating users...');
  const snap = await getDocs(query(collection(db, 'users'), where('tenantId', '==', TENANT_ID)));

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    try {
      const password = data.password
        ? data.password.startsWith('$2')
          ? data.password
          : await hashPassword(data.password)
        : await hashPassword('changeme123');

      const payload = {
        tenantId: data.tenantId || TENANT_ID,
        name: data.name || 'Unknown',
        phone: data.phone,
        username: data.username,
        email: data.email,
        password,
        role: data.role || 'viewer',
        isActive: data.isActive !== false,
        createdAt: toDate(data.createdAt) || new Date(),
      };

      if (DRY_RUN) {
        console.log(`  [DRY] user: ${payload.email || payload.phone}`);
      } else {
        await User.findOneAndUpdate(
          { tenantId: payload.tenantId, $or: [{ email: payload.email }, { phone: payload.phone }] },
          payload,
          { upsert: true }
        );
      }
      stats.users++;
    } catch (err) {
      stats.errors.push(`user ${docSnap.id}: ${err}`);
    }
  }
  console.log(`  ✅ ${stats.users} users`);
}

async function migrateClients(db: ReturnType<typeof getFirestore>) {
  console.log('\n📦 Migrating clients...');
  const snap = await getDocs(collection(db, 'tenants', TENANT_ID, 'clients'));

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    try {
      const password = data.password
        ? data.password.startsWith('$2')
          ? data.password
          : await hashPassword(data.password)
        : undefined;

      const payload = {
        tenantId: TENANT_ID,
        firebaseId: docSnap.id,
        name: data.name || 'Unknown',
        email: data.email,
        phone: data.phone,
        company: data.company,
        password,
        createdBy: data.createdBy,
        lastModifiedBy: data.lastModifiedBy,
        lastModifiedAt: toDate(data.lastModifiedAt),
        createdAt: toDate(data.createdAt) || new Date(),
      };

      if (DRY_RUN) {
        console.log(`  [DRY] client: ${payload.name}`);
      } else {
        await Client.findOneAndUpdate(
          { tenantId: TENANT_ID, firebaseId: docSnap.id },
          payload,
          { upsert: true }
        );
      }
      stats.clients++;
    } catch (err) {
      stats.errors.push(`client ${docSnap.id}: ${err}`);
    }
  }
  console.log(`  ✅ ${stats.clients} clients`);
}

async function migrateRooms(db: ReturnType<typeof getFirestore>) {
  console.log('\n📦 Migrating rooms...');
  const snap = await getDocs(query(collection(db, 'rooms'), where('tenantId', '==', TENANT_ID)));

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    try {
      const payload = {
        tenantId: data.tenantId || TENANT_ID,
        firebaseId: docSnap.id,
        room: data.room || data.name || docSnap.id,
        capacity: data.capacity || 0,
        capacityCrates: data.capacityCrates,
        capacityPallets: data.capacityPallets,
        sensorId: data.sensorId || '',
        active: data.active !== false,
        capteurInstalled: data.capteurInstalled || false,
        athGroupNumber: data.athGroupNumber,
        boitieSensorId: data.boitieSensorId,
        polygon: data.polygon,
        createdAt: toDate(data.createdAt) || new Date(),
      };

      if (DRY_RUN) {
        console.log(`  [DRY] room: ${payload.room}`);
      } else {
        await Room.findOneAndUpdate(
          { tenantId: payload.tenantId, firebaseId: docSnap.id },
          payload,
          { upsert: true }
        );
      }
      stats.rooms++;
    } catch (err) {
      stats.errors.push(`room ${docSnap.id}: ${err}`);
    }
  }
  console.log(`  ✅ ${stats.rooms} rooms`);
}

async function migrateSettings(db: ReturnType<typeof getFirestore>) {
  console.log('\n📦 Migrating settings...');

  const siteSnap = await getDoc(doc(db, 'tenants', TENANT_ID, 'settings', 'site'));
  const pricingSnap = await getDoc(doc(db, 'tenants', TENANT_ID, 'settings', 'pricing'));
  const poolSnap = await getDoc(doc(db, 'tenants', TENANT_ID, 'settings', 'pool'));

  const site = siteSnap.exists() ? siteSnap.data() : {};
  const pricing = pricingSnap.exists() ? pricingSnap.data() : {};
  const pool = poolSnap.exists() ? poolSnap.data() : {};

  const payload = {
    tenantId: TENANT_ID,
    name: site.name || 'Frigo',
    currency: site.currency || 'MAD',
    locale: site.locale || 'fr',
    season: site.season || { from: '', to: '' },
    capacity_unit: site.capacity_unit || 'caisses',
    ratio_caisses_par_palette: site.ratio_caisses_par_palette,
    baseUrl: site.baseUrl,
    initial_cash_balance: site.initial_cash_balance || 0,
    pool_vides_total: pool.pool_vides_total || 0,
    tarif_caisse_saison: pricing.tarif_caisse_saison || 0,
    caution_par_caisse: pricing.caution_par_caisse || 0,
  };

  if (DRY_RUN) {
    console.log(`  [DRY] settings: ${payload.name}`);
  } else if (siteSnap.exists() || pricingSnap.exists() || poolSnap.exists()) {
    await SiteSettings.findOneAndUpdate({ tenantId: TENANT_ID }, payload, { upsert: true });
    stats.settings = 1;
  }
  console.log(`  ✅ settings merged`);
}

async function migrateLogs(db: ReturnType<typeof getFirestore>) {
  console.log('\n📦 Migrating logs...');
  const snap = await getDocs(query(collection(db, 'logs'), where('tenantId', '==', TENANT_ID)));

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    try {
      const payload = {
        tenantId: data.tenantId || TENANT_ID,
        userId: data.userId || 'system',
        userName: data.userName || 'Système',
        action: data.action || 'unknown',
        resource: data.resource || 'unknown',
        resourceId: data.resourceId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        createdAt: toDate(data.timestamp) || new Date(),
      };

      if (!DRY_RUN) {
        await Log.create(payload);
      }
      stats.logs++;
    } catch (err) {
      stats.errors.push(`log ${docSnap.id}: ${err}`);
    }
  }
  console.log(`  ✅ ${stats.logs} logs`);
}

async function importCollection(
  db: ReturnType<typeof getFirestore>,
  collectionName: string,
  tenantField = 'tenantId'
) {
  console.log(`\n📦 Importing raw collection: ${collectionName}...`);
  let snap;

  try {
    if (tenantField) {
      snap = await getDocs(query(collection(db, collectionName), where(tenantField, '==', TENANT_ID)));
    } else {
      snap = await getDocs(collection(db, collectionName));
    }
  } catch {
    console.log(`  ⚠️  Collection ${collectionName} not accessible, skipping`);
    return;
  }

  let count = 0;
  for (const docSnap of snap.docs) {
    const data = serializeFirestoreData(docSnap.data() as Record<string, unknown>);
    if (tenantField && !data[tenantField]) {
      data[tenantField] = TENANT_ID;
    }

    if (!DRY_RUN) {
      await ImportedRecord.findOneAndUpdate(
        { tenantId: TENANT_ID, collectionName: collectionName, firebaseId: docSnap.id },
        { tenantId: TENANT_ID, collectionName: collectionName, firebaseId: docSnap.id, data, migratedAt: new Date() },
        { upsert: true }
      );
    }
    count++;
    stats.imported++;
  }
  console.log(`  ✅ ${count} documents imported`);
}

async function importTenantSubcollection(db: ReturnType<typeof getFirestore>, subcollection: string) {
  console.log(`\n📦 Importing tenants/${TENANT_ID}/${subcollection}...`);
  const snap = await getDocs(collection(db, 'tenants', TENANT_ID, subcollection));

  let count = 0;
  for (const docSnap of snap.docs) {
    const data = serializeFirestoreData(docSnap.data() as Record<string, unknown>);

    if (!DRY_RUN) {
      await ImportedRecord.findOneAndUpdate(
        { tenantId: TENANT_ID, collectionName: `tenants/${subcollection}`, firebaseId: docSnap.id },
        {
          tenantId: TENANT_ID,
          collectionName: `tenants/${subcollection}`,
          firebaseId: docSnap.id,
          data,
          migratedAt: new Date(),
        },
        { upsert: true }
      );
    }
    count++;
    stats.imported++;
  }
  console.log(`  ✅ ${count} documents imported`);
}

async function migrate() {
  console.log('🔄 Firebase → MongoDB Migration');
  console.log(`   Tenant: ${TENANT_ID}`);
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log(`   Firebase project: ${firebaseConfig.projectId}`);

  if (!firebaseConfig.apiKey) {
    console.error('❌ Firebase config missing. Set VITE_FIREBASE_* in .env or backend/.env');
    process.exit(1);
  }

  const firebaseApp = initializeApp(firebaseConfig);
  const firestore = getFirestore(firebaseApp);

  if (!DRY_RUN) {
    await connectDatabase();
  }

  // Structured migration (maps to MongoDB models)
  await migrateUsers(firestore);
  await migrateClients(firestore);
  await migrateRooms(firestore);
  await migrateSettings(firestore);
  await migrateLogs(firestore);

  // Raw import for collections without API yet
  const rootCollections = [
    'receptions',
    'empty_crate_loans',
    'trucks',
    'drivers',
    'products',
    'caution_records',
    'pallet-collections',
    'invoices',
    'sensors',
    'sensor_readings',
    'vehicle_control_records',
    'cleaning_control_records',
  ];

  for (const col of rootCollections) {
    await importCollection(firestore, col);
  }

  const tenantSubcollections = [
    'reservations',
    'cashMovements',
    'cautions',
    'dayClosures',
    'pendingCollections',
    'crate-types',
    'invoices',
    'operations',
  ];

  for (const sub of tenantSubcollections) {
    await importTenantSubcollection(firestore, sub);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary');
  console.log('='.repeat(50));
  console.log(`Users:     ${stats.users}`);
  console.log(`Clients:   ${stats.clients}`);
  console.log(`Rooms:     ${stats.rooms}`);
  console.log(`Settings:  ${stats.settings}`);
  console.log(`Logs:      ${stats.logs}`);
  console.log(`Imported:  ${stats.imported} (raw collections)`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
  }

  if (DRY_RUN) {
    console.log('\n💡 Dry run complete. Run without DRY_RUN=true to write to MongoDB.');
  } else {
    console.log('\n🎉 Migration complete!');
    await disconnectDatabase();
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
