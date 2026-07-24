import mongoose, { Schema, Document, Model } from 'mongoose';
import { getPlatformConnection } from '../../config/platformDatabase.js';

export type OrgStatus = 'active' | 'suspended' | 'trial' | 'cancelled';
export type OrgPlan = 'starter' | 'pro' | 'enterprise';

export interface IOrganization extends Document {
  slug: string;
  legacyId: string;
  name: string;
  dbName: string;
  status: OrgStatus;
  plan: OrgPlan;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  country: string;
  maxRooms: number;
  maxUsers: number;
  maxClients: number;
  sensorApiEnabled: boolean;
  trialEndsAt?: Date;
  lastLoginAt?: Date;
  loginCount: number;
  facilityGroups?: Array<{
    id: string;
    label: string;
    subtitle?: string;
    chFrom: number;
    chTo: number;
    couloirNumbers: number[];
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    legacyId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    dbName: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['active', 'suspended', 'trial', 'cancelled'],
      default: 'trial',
    },
    plan: { type: String, enum: ['starter', 'pro', 'enterprise'], default: 'starter' },
    contactEmail: { type: String, lowercase: true },
    contactPhone: { type: String },
    address: { type: String },
    city: { type: String },
    country: { type: String, default: 'MA' },
    maxRooms: { type: Number, default: 10 },
    maxUsers: { type: Number, default: 5 },
    maxClients: { type: Number, default: 100 },
    sensorApiEnabled: { type: Boolean, default: true },
    trialEndsAt: { type: Date },
    lastLoginAt: { type: Date },
    loginCount: { type: Number, default: 0 },
    facilityGroups: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        subtitle: { type: String },
        chFrom: { type: Number, default: 1 },
        chTo: { type: Number, default: 99 },
        couloirNumbers: { type: [Number], default: [] },
      },
    ],
  },
  { timestamps: true }
);

organizationSchema.index({ status: 1, plan: 1 });
organizationSchema.index({ createdAt: -1 });

export function OrganizationModel(): Model<IOrganization> {
  const conn = getPlatformConnection();
  return conn.models.Organization || conn.model<IOrganization>('Organization', organizationSchema);
}

export function slugToDbName(slug: string): string {
  return `frigo_${slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}
