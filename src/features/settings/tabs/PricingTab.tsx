import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { FormCard } from '../../../components/FormCard';
import { pricingSettingsSchema, type PricingSettings } from '../../../types/settings';
import { useTenantId } from '../../../lib/hooks/useTenantId';
import { doc, getDoc, setDoc } from '@/lib/db';
import { db } from '../../../lib/firebase';
import { toast } from 'react-hot-toast';

interface PricingTabProps {
  onDirtyChange: (dirty: boolean) => void;
  onValidChange: (valid: boolean) => void;
}

export const PricingTab = forwardRef<{ save: () => Promise<void> }, PricingTabProps>(({ onDirtyChange, onValidChange }, ref) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [formData, setFormData] = useState<PricingSettings>({
    tarif_caisse_saison: 0,
    caution_par_caisse: 0,
  });
  const [originalData, setOriginalData] = useState<PricingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize with default values immediately
    const defaultData: PricingSettings = {
      tarif_caisse_saison: 0,
      caution_par_caisse: 0,
    };
    setFormData(defaultData);
    setOriginalData(defaultData);
    
    // Then try to load from Firestore
    loadSettings();
  }, [tenantId]);

  useEffect(() => {
    const validation = pricingSettingsSchema.safeParse(formData);
    onValidChange(validation.success);
    
    const isDirty = originalData ? JSON.stringify(formData) !== JSON.stringify(originalData) : false;
    onDirtyChange(isDirty);
  }, [formData, originalData, onDirtyChange, onValidChange]);

  const loadSettings = async () => {
    if (!tenantId) return;
    
    try {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'pricing');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as PricingSettings;
        setFormData(data);
        setOriginalData(data);
      }
    } catch (error) {
      console.error('Error loading pricing settings:', error);
      // Don't show error toast, just use defaults
    }
  };

  const handleSave = async () => {
    if (!tenantId) {
      console.error('No tenantId available for pricing settings');
      toast.error('No tenant ID available');
      return;
    }
    
    try {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'pricing');
      console.log('Saving pricing settings:', { tenantId, formData, docPath: docRef.path });
      await setDoc(docRef, formData);
      console.log('Pricing settings saved successfully');
      setOriginalData(formData);
      onDirtyChange(false);
      toast.success(t('common.success'));
    } catch (error) {
      console.error('Error saving pricing settings:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      toast.error(`Error: ${error.message || t('common.error')}`);
    }
  };

  const handleInputChange = (field: keyof PricingSettings, value: number) => {
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
        title={t('settings.pricing.title', 'Tarifs & paiements')}
        description={t('settings.pricing.description', 'Configurez les tarifs par défaut et les conditions de paiement')}
      >
        <div className="space-y-6">
          {/* Pricing Section */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">
              {t('settings.pricing.pricing', 'Tarification')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.pricing.seasonRate', 'Tarif caisse saison (DH)')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tarif_caisse_saison}
                  onChange={(e) => handleInputChange('tarif_caisse_saison', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="25.00"
                />
                <p className="mt-1 text-sm text-gray-500">
                  {t('settings.pricing.rateHelp', 'Prix par caisse pour la saison')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('settings.pricing.depositPerCrate', 'Caution par caisse (DH)')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.caution_par_caisse}
                  onChange={(e) => handleInputChange('caution_par_caisse', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10.00"
                />
                <p className="mt-1 text-sm text-gray-500">
                  {t('settings.pricing.depositHelp', 'Montant de caution par caisse')}
                </p>
              </div>
            </div>
          </div>

        </div>
      </FormCard>
    </div>
  );
});
