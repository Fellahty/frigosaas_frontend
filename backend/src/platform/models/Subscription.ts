import { Schema, Document, Model } from 'mongoose';
import { getPlatformConnection } from '../../config/platformDatabase.js';

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

export interface ISubscription extends Document {
  organizationId: string;
  plan: 'starter' | 'pro' | 'enterprise';
  status: SubscriptionStatus;
  priceMonthly: number;
  currency: string;
  startDate: Date;
  endDate?: Date;
  billingCycle: 'monthly' | 'yearly';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    organizationId: { type: String, required: true, index: true },
    plan: { type: String, enum: ['starter', 'pro', 'enterprise'], required: true },
    status: {
      type: String,
      enum: ['active', 'past_due', 'cancelled', 'trialing'],
      default: 'trialing',
    },
    priceMonthly: { type: Number, default: 0 },
    currency: { type: String, default: 'MAD' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    notes: { type: String },
  },
  { timestamps: true }
);

export function SubscriptionModel(): Model<ISubscription> {
  const conn = getPlatformConnection();
  return conn.models.Subscription || conn.model<ISubscription>('Subscription', subscriptionSchema);
}
