import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteSettings extends Document {
  tenantId: string;
  name: string;
  currency: string;
  locale: 'fr' | 'ar';
  season: { from: string; to: string };
  capacity_unit: 'caisses' | 'palettes';
  ratio_caisses_par_palette?: number;
  baseUrl?: string;
  initial_cash_balance?: number;
  pool_vides_total?: number;
  tarif_caisse_saison?: number;
  caution_par_caisse?: number;
  paymentTerms?: { mode: 'due_on_exit' } | { mode: 'net_days'; days: number };
  createdAt: Date;
  updatedAt: Date;
}

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    tenantId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    currency: { type: String, default: 'MAD' },
    locale: { type: String, enum: ['fr', 'ar'], default: 'fr' },
    season: {
      from: { type: String, required: true },
      to: { type: String, required: true },
    },
    capacity_unit: { type: String, enum: ['caisses', 'palettes'], default: 'caisses' },
    ratio_caisses_par_palette: { type: Number },
    baseUrl: { type: String },
    initial_cash_balance: { type: Number, default: 0 },
    pool_vides_total: { type: Number, default: 0 },
    tarif_caisse_saison: { type: Number, default: 0 },
    caution_par_caisse: { type: Number, default: 0 },
    paymentTerms: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const SiteSettings = mongoose.model<ISiteSettings>('SiteSettings', siteSettingsSchema);
