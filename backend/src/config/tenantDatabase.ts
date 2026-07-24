import mongoose from 'mongoose';
import { env } from './env.js';
import { mongoPoolOptions, tenantPoolLimits, isAllowedTenantDbName } from './mongoOptions.js';

interface CachedConnection {
  connection: mongoose.Connection;
  lastUsed: number;
}

const tenantConnections = new Map<string, CachedConnection>();

export function buildTenantDbUri(dbName: string): string {
  const base = (process.env.MONGODB_BASE_URI || env.mongodbBaseUri).replace(/\/$/, '');
  return `${base}/${dbName}`;
}

function touchCache(dbName: string, entry: CachedConnection): void {
  entry.lastUsed = Date.now();
  tenantConnections.set(dbName, entry);
}

async function evictIdleConnections(): Promise<void> {
  const now = Date.now();
  for (const [dbName, entry] of tenantConnections) {
    if (now - entry.lastUsed > tenantPoolLimits.idleEvictMs) {
      await entry.connection.close().catch(() => {});
      tenantConnections.delete(dbName);
    }
  }
}

async function evictOldestIfOverLimit(): Promise<void> {
  if (tenantConnections.size < tenantPoolLimits.maxCachedConnections) return;

  const sorted = [...tenantConnections.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  const toEvict = sorted.slice(0, sorted.length - tenantPoolLimits.maxCachedConnections + 1);

  for (const [dbName, entry] of toEvict) {
    await entry.connection.close().catch(() => {});
    tenantConnections.delete(dbName);
  }
}

export async function getTenantConnection(dbName: string): Promise<mongoose.Connection> {
  if (!isAllowedTenantDbName(dbName)) {
    throw new Error('Nom de base de données non autorisé');
  }

  const existing = tenantConnections.get(dbName);
  if (existing?.connection.readyState === 1) {
    touchCache(dbName, existing);
    return existing.connection;
  }

  if (existing) {
    tenantConnections.delete(dbName);
  }

  await evictIdleConnections();
  await evictOldestIfOverLimit();

  const uri = buildTenantDbUri(dbName);
  const conn = mongoose.createConnection(uri, mongoPoolOptions);
  await conn.asPromise();

  const entry: CachedConnection = { connection: conn, lastUsed: Date.now() };
  tenantConnections.set(dbName, entry);
  return conn;
}

export async function createTenantDatabase(dbName: string): Promise<mongoose.Connection> {
  const conn = await getTenantConnection(dbName);
  if (!conn.db) throw new Error('Failed to create tenant database');
  await conn.db.admin().ping();
  return conn;
}

export function getTenantConnectionStats() {
  return {
    active: tenantConnections.size,
    max: tenantPoolLimits.maxCachedConnections,
    databases: [...tenantConnections.keys()],
  };
}

export async function disconnectAllTenants(): Promise<void> {
  for (const [, entry] of tenantConnections) {
    await entry.connection.close().catch(() => {});
  }
  tenantConnections.clear();
}
