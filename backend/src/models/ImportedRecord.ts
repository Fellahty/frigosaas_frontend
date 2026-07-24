import mongoose, { Schema, Document } from 'mongoose';

export interface IImportedRecord extends Document {
  tenantId: string;
  collectionName: string;
  firebaseId: string;
  data: Record<string, unknown>;
  migratedAt: Date;
}

const importedRecordSchema = new Schema<IImportedRecord>(
  {
    tenantId: { type: String, required: true, index: true },
    collectionName: { type: String, required: true, index: true },
    firebaseId: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    migratedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

importedRecordSchema.index({ tenantId: 1, collectionName: 1, firebaseId: 1 }, { unique: true });

export const ImportedRecord = mongoose.model<IImportedRecord>('ImportedRecord', importedRecordSchema);
