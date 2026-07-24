import mongoose, { Schema, Document } from 'mongoose';

export interface IClient extends Document {
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  password?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdBy?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new Schema<IClient>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String },
    company: { type: String },
    password: { type: String, select: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    createdBy: { type: String },
    lastModifiedBy: { type: String },
    lastModifiedAt: { type: Date },
  },
  { timestamps: true }
);

clientSchema.index({ tenantId: 1, email: 1 });
clientSchema.index({ tenantId: 1, phone: 1 });

export const Client = mongoose.model<IClient>('Client', clientSchema);
