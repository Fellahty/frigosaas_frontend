import { z } from 'zod';

// General Settings Schema
export const generalSettingsSchema = z.object({
  name: z.string().min(1, 'Le nom du frigo est requis'),
  currency: z.string().default('MAD'),
  locale: z.enum(['fr', 'ar']).default('fr'),
  capacity_unit: z.enum(['caisses', 'palettes']).default('caisses'),
  ratio_caisses_par_palette: z.number().positive().optional(),
  baseUrl: z.string().url().optional(),
  initial_cash_balance: z.number().min(0, 'Le solde initial doit être positif').default(0),
  season: z.object({
    from: z.string().optional().default(''),
    to: z.string().optional().default(''),
  }).optional(),
});

// Room Schema
export const roomSchema = z.object({
  room: z.string().min(1, 'Nom de la chambre requis'),
  capacity: z.number().min(0, 'La capacité doit être positive'),
  sensorId: z.string().optional().default(''),
  active: z.boolean().default(true),
  capteurInstalled: z.boolean().default(false), // Whether sensor is installed in the room
  athGroupNumber: z.number().min(1, 'Le numéro de groupe ATH doit être positif').optional(), // ATH group number for the chamber
  boitieSensorId: z.string().optional(), // ID sensor of boitie (box sensor)
  polygon: z.array(z.object({
    lat: z.number(),
    lng: z.number()
  })).optional(), // GeoJSON polygon coordinates for map display
}).refine(
  (data) => !data.capteurInstalled || Boolean(data.sensorId?.trim()),
  { message: 'ID du capteur requis si le capteur est installé', path: ['sensorId'] }
);

// Pool Settings Schema
export const poolSettingsSchema = z.object({
  pool_vides_total: z.number().min(0, 'Le total doit être positif'),
});

// Payment Terms Schema
export const paymentTermsSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('due_on_exit'),
  }),
  z.object({
    mode: z.literal('net_days'),
    days: z.number().min(1, 'Le nombre de jours doit être positif'),
  }),
]);

// Pricing Settings Schema
export const pricingSettingsSchema = z.object({
  tarif_caisse_saison: z.number().min(0, 'Le tarif doit être positif'),
  caution_par_caisse: z.number().min(0, 'La caution doit être positive'),
});

// TypeScript Types
export type GeneralSettings = z.infer<typeof generalSettingsSchema>;
export type Room = z.infer<typeof roomSchema>;
export type PoolSettings = z.infer<typeof poolSettingsSchema>;
export type PaymentTerms = z.infer<typeof paymentTermsSchema>;
export type PricingSettings = z.infer<typeof pricingSettingsSchema>;

// Firestore Document Types
export interface SiteSettingsDoc {
  name: string;
  currency: string;
  locale: 'fr' | 'ar';
  season: {
    from: string;
    to: string;
  };
  capacity_unit: 'caisses' | 'palettes';
  ratio_caisses_par_palette?: number;
  baseUrl?: string;
  initial_cash_balance?: number;
}

export interface RoomDoc {
  tenantId: string;
  room: string;
  capacity: number;
  capacityCrates?: number;
  capacityPallets?: number;
  sensorId: string;
  active: boolean;
  capteurInstalled: boolean; // Whether sensor is installed in the room
  athGroupNumber?: number; // ATH group number for the chamber
  boitieSensorId?: string; // ID sensor of boitie (box sensor)
  polygon?: Array<{ lat: number; lng: number }>; // GeoJSON polygon coordinates for map display
}

export interface PoolSettingsDoc {
  pool_vides_total: number;
}

export interface PricingSettingsDoc {
  tarif_caisse_saison: number;
  caution_par_caisse: number;
}
