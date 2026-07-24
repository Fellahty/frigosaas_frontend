import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from '@/lib/db';
import { db } from '../firebase';
import { useTenantId } from './useTenantId';

export interface AppSettings {
  // Date settings
  defaultEntryDate: string; // Format: YYYY-MM-DD
  defaultExitDate: string; // Format: YYYY-MM-DD
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  
  // Business settings
  companyName: string;
  currency: string;
  currencySymbol: string;
  
  // Platform settings
  baseUrl?: string; // Base URL for QR codes and external links
  
  // Notification settings
  emailNotifications: boolean;
  smsNotifications: boolean;
  
  // UI settings
  theme: 'light' | 'dark' | 'auto';
  language: 'fr' | 'ar' | 'en';
  
  // Business rules
  maxReservationDays: number;
  minDepositPercentage: number;
  autoApproveReservations: boolean;
  
  // Storage settings
  maxFileSize: number; // in MB
  allowedFileTypes: string[];
}

const defaultSettings: AppSettings = {
  defaultEntryDate: new Date().toISOString().split('T')[0],
  defaultExitDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
  dateFormat: 'DD/MM/YYYY',
  companyName: 'Frigo SaaS',
  currency: 'MAD',
  currencySymbol: 'د.م',
  baseUrl: 'https://lyazami.frigosmart.com',
  emailNotifications: true,
  smsNotifications: false,
  theme: 'light',
  language: 'fr',
  maxReservationDays: 365,
  minDepositPercentage: 10,
  autoApproveReservations: false,
  maxFileSize: 10,
  allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
};

export const useAppSettings = () => {
  const tenantId = useTenantId();

  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['app-settings', tenantId],
    queryFn: async (): Promise<AppSettings> => {
      if (!tenantId) {
        console.warn('No tenant ID available, returning default settings');
        return defaultSettings;
      }
      
      try {
        const docRef = doc(db, 'tenants', tenantId, 'settings', 'app');
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          console.log('No app settings found, returning default settings');
          return defaultSettings;
        }
        
        const data = docSnap.data();
        const mergedSettings = {
          ...defaultSettings,
          ...data,
        } as AppSettings;
        
        console.log('App settings loaded:', mergedSettings);
        return mergedSettings;
      } catch (error) {
        console.error('Error loading app settings:', error);
        return defaultSettings;
      }
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: 1000,
  });

  return {
    settings: settings || defaultSettings,
    isLoading,
    error,
    isDefault: !settings || settings === defaultSettings,
    refetch,
  };
};

// Helper functions for common operations
export const useDateSettings = () => {
  const { settings } = useAppSettings();
  
  const formatDate = (date: string | Date, format?: string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const actualFormat = format || settings.dateFormat;
    
    switch (actualFormat) {
      case 'DD/MM/YYYY':
        return dateObj.toLocaleDateString('fr-FR');
      case 'MM/DD/YYYY':
        return dateObj.toLocaleDateString('en-US');
      case 'YYYY-MM-DD':
        return dateObj.toISOString().split('T')[0];
      default:
        return dateObj.toLocaleDateString('fr-FR');
    }
  };
  
  const getDefaultEntryDate = () => settings.defaultEntryDate;
  const getDefaultExitDate = () => settings.defaultExitDate;
  
  return {
    formatDate,
    getDefaultEntryDate,
    getDefaultExitDate,
    dateFormat: settings.dateFormat,
  };
};

export const useBusinessSettings = () => {
  const { settings } = useAppSettings();
  
  return {
    companyName: settings.companyName,
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    maxReservationDays: settings.maxReservationDays,
    minDepositPercentage: settings.minDepositPercentage,
    autoApproveReservations: settings.autoApproveReservations,
  };
};

// Pool Settings Hook
export interface PoolSettings {
  pool_vides_total: number;
}

const defaultPoolSettings: PoolSettings = {
  pool_vides_total: 0,
};

export const usePoolSettings = () => {
  const tenantId = useTenantId();

  const { data: poolSettings, isLoading, error, refetch } = useQuery({
    queryKey: ['pool-settings', tenantId],
    queryFn: async (): Promise<PoolSettings> => {
      if (!tenantId) {
        console.warn('No tenant ID available, returning default pool settings');
        return defaultPoolSettings;
      }
      
      try {
        const docRef = doc(db, 'tenants', tenantId, 'settings', 'pool');
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          console.log('No pool settings found, returning default pool settings');
          return defaultPoolSettings;
        }
        
        const data = docSnap.data();
        const mergedSettings = {
          ...defaultPoolSettings,
          ...data,
        } as PoolSettings;
        
        console.log('Pool settings loaded:', mergedSettings);
        return mergedSettings;
      } catch (error) {
        console.error('Error loading pool settings:', error);
        return defaultPoolSettings;
      }
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    retryDelay: 1000,
  });

  return {
    poolSettings: poolSettings || defaultPoolSettings,
    isLoading,
    error,
    isDefault: !poolSettings || poolSettings === defaultPoolSettings,
    refetch,
  };
};
