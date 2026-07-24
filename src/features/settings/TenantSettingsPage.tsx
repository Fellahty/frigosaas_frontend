import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc } from '@/lib/db';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';

export const TenantSettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings', tenantId],
    queryFn: async (): Promise<{ seasonYear: number; pricePerUnit: number; language: string }> => {
      const ref = doc(db, 'tenant_settings', tenantId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return { seasonYear: new Date().getFullYear(), pricePerUnit: 0, language: i18n.language || 'fr' };
      }
      const d = snap.data() as any;
      return {
        seasonYear: typeof d.seasonYear === 'number' ? d.seasonYear : (typeof d.season === 'number' ? d.season : new Date().getFullYear()),
        pricePerUnit: typeof d.pricePerUnit === 'number' ? d.pricePerUnit : 0,
        language: d.language || i18n.language || 'fr',
      };
    },
  });

  const [form, setForm] = React.useState({ seasonYear: new Date().getFullYear(), pricePerUnit: 0, language: 'fr' });

  React.useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const save = useMutation({
    mutationFn: async (payload: typeof form) => {
      const ref = doc(db, 'tenant_settings', tenantId);
      await setDoc(ref, { ...payload, tenantId }, { merge: true });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant-settings', tenantId] });
      // optionally switch app language
      if (form.language) i18n.changeLanguage(form.language);
    },
  });

  return (
    <div className="space-y-6 text-sm md:text-base">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{t('settings.title', 'Paramètres')}</h1>
        <p className="text-gray-600">{t('settings.subtitle', 'Configurer la saison, le prix et la langue')}</p>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.seasonYear', 'Saison (année)')}</label>
            <input
              type="number"
              min={2000}
              max={3000}
              value={form.seasonYear}
              onChange={(e) => setForm((f) => ({ ...f, seasonYear: Number(e.target.value) }))}
              className="w-full border rounded-md px-3 py-2"
              placeholder={String(new Date().getFullYear())}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.pricePerUnit', 'Prix par unité')}</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.pricePerUnit}
              onChange={(e) => setForm((f) => ({ ...f, pricePerUnit: Number(e.target.value) }))}
              className="w-full border rounded-md px-3 py-2"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.language', 'Langue')}</label>
            <select
              value={form.language}
              onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
              className="w-full border rounded-md px-3 py-2"
            >
              <option value="fr">{t('settings.app.languageFrench', 'Français')}</option>
              <option value="ar">{t('settings.app.languageArabic', 'العربية')}</option>
              <option value="en">{t('settings.app.languageEnglish', 'English')}</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => save.mutate(form)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            {t('common.save')}
          </button>
        </div>
      </Card>
    </div>
  );
};
