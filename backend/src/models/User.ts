import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'admin' | 'manager' | 'viewer' | 'client';

export interface IUser extends Document {
  tenantId: string;
  name: string;
  phone?: string;
  username?: string;
  email?: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String },
    username: { type: String },
    email: { type: String, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['admin', 'manager', 'viewer', 'client'],
      default: 'viewer',
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ tenantId: 1, email: 1 });
userSchema.index({ tenantId: 1, phone: 1 });
userSchema.index({ tenantId: 1, username: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
