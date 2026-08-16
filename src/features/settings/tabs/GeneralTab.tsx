import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { FormCard } from '../../../components/FormCard';
import { generalSettingsSchema, type GeneralSettings } from '../../../types/settings';
import { useTenantId } from '../../../lib/hooks/useTenantId';
import { useTenantOptional } from '../../../app/TenantProvider';
import { getStoredTenantName } from '../../../lib/tenantBranding';
import { doc, getDoc, setDoc } from '@/lib/db';
import { db } from '../../../lib/firebase';
import { toast } from 'react-hot-toast';

interface GeneralTabProps {
  onDirtyChange: (dirty: boolean) => void;
  onValidChange: (valid: boolean) => void;
}

export const GeneralTab = forwardRef<{ save: () => Promise<void> }, GeneralTabProps>(({ onDirtyChange, onValidChange }, ref) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const tenant = useTenantOptional();
  const fridgeName = tenant?.name || getStoredTenantName() || '';
  const [formData, setFormData] = useState<GeneralSettings>({
    name: fridgeName,
    currency: 'MAD',
    locale: 'fr',
    capacity_unit: 'caisses',
    initial_cash_balance: 0,
    season: {
      from: '',
      to: '',
    },
  });
  const [originalData, setOriginalData] = useState<GeneralSettings | null>(() => ({
    name: fridgeName,
    currency: 'MAD',
    locale: 'fr',
    capacity_unit: 'caisses',
    initial_cash_balance: 0,
    season: {
      from: '',
      to: '',
    },
  }));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [tenantId]);

  useEffect(() => {
    if (!fridgeName) return;
    setFormData((prev) => (prev.name?.trim() ? prev : { ...prev, name: fridgeName }));
    setOriginalData((prev) => {
      if (!prev || prev.name?.trim()) return prev;
      return { ...prev, name: fridgeName };
    });
  }, [fridgeName]);

  useEffect(() => {
    const validation = generalSettingsSchema.safeParse(formData);
    onValidChange(validation.success);
    
    const isDirty = originalData ? JSON.stringify(formData) !== JSON.stringify(originalData) : false;
    onDirtyChange(isDirty);
  }, [formData, originalData, onDirtyChange, onValidChange]);

  const loadSettings = async () => {
    if (!tenantId) return;
    
    try {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'site');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as GeneralSettings;
        const resolved: GeneralSettings = {
          ...data,
          name: data.name?.trim() || fridgeName,
        };
        setFormData(resolved);
        setOriginalData(resolved);
      } else {
        setFormData((prev) => {
          const next = { ...prev, name: prev.name?.trim() || fridgeName };
          setOriginalData(next);
          return next;
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Don't show error toast, just use defaults
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    
    try {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'site');
      await setDoc(docRef, formData);
      setOriginalData(formData);
      onDirtyChange(false);
      toast.success(t('common.success'));
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('common.error'));
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Expose save function to parent
  useImperativeHandle(ref, () => ({
    save: handleSave
  }), [formData, tenantId]);

  if (isLoading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <FormCard
        title={t('settings.general.title', 'Paramètres généraux')}
        description={t('settings.general.description', 'Configurez les informations de base de votre installation') as string}
        icon={
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.general.fridgeName', 'Nom du frigo')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder={t('settings.general.fridgeNamePlaceholder', "Nom de votre installation") as string}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.general.currency', 'Devise')}
            </label>
            <div className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-600">
              MAD 
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t('settings.general.currencyFixed', 'La devise est fixée en MAD') as string}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.general.locale', 'Langue par défaut')}
            </label>
            <select
              value={formData.locale}
              onChange={(e) => handleInputChange('locale', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="fr">Français</option>
              <option value="ar">العربية</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.general.initialCashBalance', 'Solde initial de la caisse')}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.initial_cash_balance}
                onChange={(e) => handleInputChange('initial_cash_balance', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="0.00"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-sm">MAD</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t('settings.general.initialCashBalanceHelp', 'Montant de départ de la caisse en trésorerie') as string}
            </p>
          </div>

        </div>
      </FormCard>
    </div>
  );
});
