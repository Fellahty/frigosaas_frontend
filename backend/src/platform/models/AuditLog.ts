import { Schema, Document, Model } from 'mongoose';
import { getPlatformConnection } from '../../config/platformDatabase.js';

export type AuditAction =
  | 'org.create'
  | 'org.update'
  | 'org.suspend'
  | 'org.activate'
  | 'access.user.block'
  | 'access.user.unblock'
  | 'access.user.password'
  | 'access.client.block'
  | 'access.client.unblock'
  | 'access.client.password'
  | 'subscription.create'
  | 'subscription.update';

export interface IAuditLog extends Document {
  actorId: string;
  actorEmail: string;
  actorName: string;
  action: AuditAction;
  organizationId?: string;
  organizationName?: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: String, required: true, index: true },
    actorEmail: { type: String, required: true },
    actorName: { type: String, required: true },
    action: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    organizationName: { type: String },
    targetType: { type: String },
    targetId: { type: String },
    targetLabel: { type: String },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

export function AuditLogModel(): Model<IAuditLog> {
  const conn = getPlatformConnection();
  return conn.models.AuditLog || conn.model<IAuditLog>('AuditLog', auditLogSchema);
}
