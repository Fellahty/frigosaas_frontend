import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  tenantId: string;
  room: string;
  capacity: number;
  capacityCrates?: number;
  capacityPallets?: number;
  sensorId: string;
  active: boolean;
  capteurInstalled: boolean;
  athGroupNumber?: number;
  boitieSensorId?: string;
  polygon?: Array<{ lat: number; lng: number }>;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    tenantId: { type: String, required: true, index: true },
    room: { type: String, required: true },
    capacity: { type: Number, required: true, min: 0 },
    capacityCrates: { type: Number, min: 0 },
    capacityPallets: { type: Number, min: 0 },
    sensorId: { type: String, required: true },
    active: { type: Boolean, default: true },
    capteurInstalled: { type: Boolean, default: false },
    athGroupNumber: { type: Number },
    boitieSensorId: { type: String },
    polygon: [
      {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

roomSchema.index({ tenantId: 1, room: 1 });

export const Room = mongoose.model<IRoom>('Room', roomSchema);
