/**
 * Promote imported Firebase records into proper MongoDB collections
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { ImportedRecord } from '../src/models/ImportedRecord.js';
import { env } from '../src/config/env.js';

dotenv.config();

const TENANT_ID = process.env.TENANT_ID || env.defaultTenantId;

function collectionFromImported(name: string): string {
  if (name.startsWith('tenants/')) {
    return name.replace('tenants/', '');
  }
  return name;
}

async function promote() {
  await connectDatabase();

  const records = await ImportedRecord.find({ tenantId: TENANT_ID });
  console.log(`📦 Promoting ${records.length} imported records...`);

  const grouped = new Map<string, typeof records>();
  for (const record of records) {
    const obj = record.toObject() as { collectionName?: string; collection?: string };
    const sourceName = obj.collectionName || obj.collection;
    if (!sourceName || typeof sourceName !== 'string') continue;
    const col = collectionFromImported(sourceName);
    if (!grouped.has(col)) grouped.set(col, []);
    grouped.get(col)!.push(record);
  }

  for (const [collectionName, docs] of grouped) {
    const col = mongoose.connection.collection(collectionName);
    let count = 0;

    for (const record of docs) {
      const data = {
        ...record.data,
        tenantId: record.tenantId,
        firebaseId: record.firebaseId,
      };

      await col.updateOne(
        { firebaseId: record.firebaseId, tenantId: record.tenantId },
        { $set: data },
        { upsert: true }
      );
      count++;
    }

    console.log(`  ✅ ${collectionName}: ${count} documents`);
  }

  // Also ensure users/clients/rooms from dedicated collections are intact
  console.log('\n📊 Collection counts:');
  for (const name of [...grouped.keys(), 'users', 'clients', 'rooms']) {
    const count = await mongoose.connection.collection(name).countDocuments();
    if (count > 0) console.log(`  ${name}: ${count}`);
  }

  await disconnectDatabase();
  console.log('\n🎉 Promotion complete!');
}

promote().catch((err) => {
  console.error(err);
  process.exit(1);
});
