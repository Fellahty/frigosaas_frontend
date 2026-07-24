/**
 * Backfill firebaseId on all migrated documents and sync settings subdocs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { ImportedRecord } from '../src/models/ImportedRecord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const TENANT_ID = process.env.TENANT_ID || env.defaultTenantId;

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'frigosaas',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

function collectionNameFromImported(name: string): string {
  return name.startsWith('tenants/') ? name.replace('tenants/', '') : name;
}

async function backfillFromImported() {
  const records = await ImportedRecord.find({ tenantId: TENANT_ID });
  console.log(`📦 Backfilling firebaseId on ${records.length} records...`);

  for (const record of records) {
    const raw = record.toObject() as Record<string, unknown>;
    const sourceName = (raw.collectionName || raw.collection) as string | undefined;
    if (!sourceName || typeof sourceName !== 'string') continue;

    const colName = collectionNameFromImported(sourceName);
    const col = mongoose.connection.collection(colName);

    await col.updateOne(
      { firebaseId: record.firebaseId, tenantId: TENANT_ID },
      { $set: { ...record.data, tenantId: TENANT_ID, firebaseId: record.firebaseId } },
      { upsert: true }
    );
  }

  console.log('  ✅ firebaseId backfill complete');
}

async function migrateSettingsDocs(firestore: ReturnType<typeof getFirestore>) {
  console.log('\n📦 Migrating settings subdocs...');
  const settingsCol = mongoose.connection.collection('tenant_settings_docs');
  const keys = ['site', 'app', 'pricing', 'pool'];

  for (const key of keys) {
    const snap = await getDoc(doc(firestore, 'tenants', TENANT_ID, 'settings', key));
    if (snap.exists()) {
      await settingsCol.updateOne(
        { tenantId: TENANT_ID, settingsKey: key },
        { $set: { ...snap.data(), tenantId: TENANT_ID, settingsKey: key, firebaseId: key } },
        { upsert: true }
      );
      console.log(`  ✅ settings/${key}`);
    } else {
      console.log(`  ⚠️  settings/${key} not found in Firebase`);
    }
  }
}

async function migrateTenantDocs(firestore: ReturnType<typeof getFirestore>) {
  console.log('\n📦 Migrating tenant docs (counters, metrics, etc.)...');
  const docTypes = ['tenant_settings', 'stock_settings', 'metrics_today', 'counters'];

  for (const docType of docTypes) {
    const snap = await getDoc(doc(firestore, docType, TENANT_ID));
    if (snap.exists()) {
      const col = mongoose.connection.collection(docType);
      await col.updateOne(
        { tenantId: TENANT_ID, firebaseId: TENANT_ID },
        { $set: { ...snap.data(), tenantId: TENANT_ID, firebaseId: TENANT_ID } },
        { upsert: true }
      );
      console.log(`  ✅ ${docType}/${TENANT_ID}`);
    }
  }
}

async function migrateClientsFromFirebase(firestore: ReturnType<typeof getFirestore>) {
  console.log('\n📦 Syncing clients with Firebase IDs...');
  const snap = await getDocs(collection(firestore, 'tenants', TENANT_ID, 'clients'));
  const col = mongoose.connection.collection('clients');

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    await col.updateOne(
      { firebaseId: docSnap.id },
      { $set: { ...data, tenantId: TENANT_ID, firebaseId: docSnap.id } },
      { upsert: true }
    );
  }
  console.log(`  ✅ ${snap.docs.length} clients synced`);
}

async function migrateRoomsFromFirebase(firestore: ReturnType<typeof getFirestore>) {
  console.log('\n📦 Syncing rooms with Firebase IDs...');
  const snap = await getDocs(collection(firestore, 'rooms'));
  const col = mongoose.connection.collection('rooms');

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.tenantId !== TENANT_ID && data.tenantId) continue;
    await col.updateOne(
      { firebaseId: docSnap.id },
      { $set: { ...data, tenantId: data.tenantId || TENANT_ID, firebaseId: docSnap.id } },
      { upsert: true }
    );
  }
  console.log(`  ✅ rooms synced`);
}

async function deduplicateCollection(collectionName: string, matchField = 'name') {
  const col = mongoose.connection.collection(collectionName);
  const docs = await col.find({ tenantId: TENANT_ID }).toArray();
  let removed = 0;

  for (const doc of docs) {
    if (doc.firebaseId) continue;
    const dupe = await col.findOne({
      tenantId: TENANT_ID,
      [matchField]: doc[matchField],
      firebaseId: { $exists: true, $ne: null },
    });
    if (dupe) {
      await col.deleteOne({ _id: doc._id });
      removed++;
    }
  }

  if (removed > 0) console.log(`  🧹 ${collectionName}: removed ${removed} duplicates without firebaseId`);
}

async function run() {
  await connectDatabase();
  await backfillFromImported();

  if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    await migrateClientsFromFirebase(firestore);
    await migrateRoomsFromFirebase(firestore);
    await migrateSettingsDocs(firestore);
    await migrateTenantDocs(firestore);
  } else {
    console.log('⚠️  Firebase config missing — skipping Firebase sync');
  }

  await deduplicateCollection('clients');
  await deduplicateCollection('rooms', 'room');

  console.log('\n📊 Sample ID check:');
  const client = await mongoose.connection.collection('clients').findOne({ name: /AbdelhaK/i });
  const reception = await mongoose.connection.collection('receptions').findOne({ clientName: /AbdelhaK/i });
  console.log('  client firebaseId:', client?.firebaseId);
  console.log('  reception clientId:', reception?.clientId);
  console.log('  match:', client?.firebaseId === reception?.clientId);

  await disconnectDatabase();
  console.log('\n🎉 Fix complete! Restart backend.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
