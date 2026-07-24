import { Schema, Document, Model } from 'mongoose';
import { getPlatformConnection } from '../../config/platformDatabase.js';

export type PlatformRole = 'super_admin' | 'support' | 'billing';

export interface IPlatformUser extends Document {
  name: string;
  email: string;
  password: string;
  role: PlatformRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const platformUserSchema = new Schema<IPlatformUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['super_admin', 'support', 'billing'], default: 'support' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export function PlatformUserModel(): Model<IPlatformUser> {
  const conn = getPlatformConnection();
  return conn.models.PlatformUser || conn.model<IPlatformUser>('PlatformUser', platformUserSchema);
}
