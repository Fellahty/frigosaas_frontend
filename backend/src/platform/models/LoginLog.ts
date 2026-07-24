import { Schema, Document, Model } from 'mongoose';
import { getPlatformConnection } from '../../config/platformDatabase.js';

export type LoginScope = 'tenant' | 'platform';

export interface ILoginLog extends Document {
  scope: LoginScope;
  organizationId?: string;
  organizationName?: string;
  legacyId?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userType?: 'manager' | 'client' | 'platform';
  role?: string;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const loginLogSchema = new Schema<ILoginLog>(
  {
    scope: { type: String, enum: ['tenant', 'platform'], required: true, index: true },
    organizationId: { type: String, index: true },
    organizationName: { type: String },
    legacyId: { type: String, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String },
    userType: { type: String, enum: ['manager', 'client', 'platform'] },
    role: { type: String },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

loginLogSchema.index({ createdAt: -1 });
loginLogSchema.index({ organizationId: 1, createdAt: -1 });

export function LoginLogModel(): Model<ILoginLog> {
  const conn = getPlatformConnection();
  return conn.models.LoginLog || conn.model<ILoginLog>('LoginLog', loginLogSchema);
}
