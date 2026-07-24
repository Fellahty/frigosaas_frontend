import type mongoose from 'mongoose';
import { getActiveConnection } from '../middleware/tenantContext.js';
import { User } from '../models/User.js';
import { Client } from '../models/Client.js';
import { Room } from '../models/Room.js';
import { SiteSettings } from '../models/SiteSettings.js';

function modelOn<T>(conn: mongoose.Connection, name: string, schema: mongoose.Schema) {
  return (conn.models[name] || conn.model(name, schema)) as mongoose.Model<T>;
}

export function getTenantUserModel() {
  const conn = getActiveConnection();
  return modelOn(conn, 'User', User.schema);
}

export function getTenantClientModel() {
  const conn = getActiveConnection();
  return modelOn(conn, 'Client', Client.schema);
}

export function getTenantRoomModel() {
  const conn = getActiveConnection();
  return modelOn(conn, 'Room', Room.schema);
}

export function getTenantSettingsModel() {
  const conn = getActiveConnection();
  return modelOn(conn, 'SiteSettings', SiteSettings.schema);
}
