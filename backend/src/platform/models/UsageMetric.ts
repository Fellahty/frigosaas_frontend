import { Schema, Document, Model } from 'mongoose';
import { getPlatformConnection } from '../../config/platformDatabase.js';

export interface IUsageMetric extends Document {
  organizationId: string;
  date: string;
  roomsCount: number;
  clientsCount: number;
  usersCount: number;
  receptionsCount: number;
  reservationsCount: number;
  storageUsedMb: number;
  createdAt: Date;
}

const usageMetricSchema = new Schema<IUsageMetric>(
  {
    organizationId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    roomsCount: { type: Number, default: 0 },
    clientsCount: { type: Number, default: 0 },
    usersCount: { type: Number, default: 0 },
    receptionsCount: { type: Number, default: 0 },
    reservationsCount: { type: Number, default: 0 },
    storageUsedMb: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

usageMetricSchema.index({ organizationId: 1, date: 1 }, { unique: true });

export function UsageMetricModel(): Model<IUsageMetric> {
  const conn = getPlatformConnection();
  return conn.models.UsageMetric || conn.model<IUsageMetric>('UsageMetric', usageMetricSchema);
}
