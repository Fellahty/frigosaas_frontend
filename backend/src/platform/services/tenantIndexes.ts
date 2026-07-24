import type mongoose from 'mongoose';

/**
 * Standard indexes applied to every new tenant database.
 * Keeps queries fast as client data grows.
 */
export async function ensureTenantIndexes(conn: mongoose.Connection): Promise<void> {
  if (!conn.db) return;

  const db = conn.db;

  await Promise.all([
    db.collection('users').createIndexes([
      { key: { tenantId: 1, email: 1 }, sparse: true },
      { key: { tenantId: 1, phone: 1 }, sparse: true },
      { key: { tenantId: 1, isActive: 1 } },
    ]),
    db.collection('clients').createIndexes([
      { key: { tenantId: 1, email: 1 }, sparse: true },
      { key: { tenantId: 1, phone: 1 }, sparse: true },
      { key: { tenantId: 1, name: 1 } },
    ]),
    db.collection('rooms').createIndexes([
      { key: { tenantId: 1, room: 1 }, unique: true },
      { key: { tenantId: 1, active: 1 } },
    ]),
    db.collection('receptions').createIndexes([
      { key: { tenantId: 1, createdAt: -1 } },
      { key: { tenantId: 1, clientId: 1 } },
      { key: { tenantId: 1, serial: 1 }, sparse: true },
    ]),
    db.collection('reservations').createIndexes([
      { key: { tenantId: 1, createdAt: -1 } },
      { key: { tenantId: 1, clientId: 1 } },
    ]),
    db.collection('sitesettings').createIndexes([{ key: { tenantId: 1 }, unique: true }]),
    db.collection('empty_crate_loans').createIndexes([
      { key: { tenantId: 1, createdAt: -1 } },
      { key: { tenantId: 1, clientId: 1 } },
    ]),
  ]);
}
