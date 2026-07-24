import { Schema, Document, Model } from 'mongoose';
import { getPlatformConnection } from '../../config/platformDatabase.js';

export interface IInteractionLog extends Document {
  organizationId: string;
  organizationName?: string;
  legacyId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userRole: string;
  userType: string;
  action: string;
  method: string;
  path: string;
  resourceType?: string;
  resourceId?: string;
  summary?: string;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const interactionLogSchema = new Schema<IInteractionLog>(
  {
    organizationId: { type: String, required: true, index: true },
    organizationName: { type: String },
    legacyId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String },
    userRole: { type: String, required: true },
    userType: { type: String, required: true },
    action: { type: String, required: true, index: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    resourceType: { type: String, index: true },
    resourceId: { type: String },
    summary: { type: String },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

interactionLogSchema.index({ createdAt: -1 });
interactionLogSchema.index({ organizationId: 1, createdAt: -1 });

export function InteractionLogModel(): Model<IInteractionLog> {
  const conn = getPlatformConnection();
  return conn.models.InteractionLog || conn.model<IInteractionLog>('InteractionLog', interactionLogSchema);
}
