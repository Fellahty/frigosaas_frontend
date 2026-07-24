import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, where, doc, getDoc, setDoc } from '@/lib/db';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';

interface ClientLite {
  reservedCrates?: number;
  requiresEmptyCrates?: boolean;
}

export const StockAndLocations: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  // Editable stock settings fetched from Firestore
  const { data: settings } = useQuery({
    queryKey: ['stock-settings', tenantId],
    queryFn: async (): Promise<{ totalCrates: number; locations: string[] }> => {
      const ref = doc(db, 'stock_settings', tenantId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return { totalCrates: 0, locations: [] };
      }
      const d = snap.data() as any;
      return {
        totalCrates: typeof d.totalCrates === 'number' ? d.totalCrates : 0,
        locations: Array.isArray(d.locations) ? d.locations.filter(Boolean) : [],
      };
    },
  });

  const [form, setForm] = React.useState<{ totalCrates: number; locations: string[]; newLocation: string }>(
    { totalCrates: 0, locations: [], newLocation: '' }
  );

  React.useEffect(() => {
    if (settings) {
      setForm((f) => ({ ...f, totalCrates: settings.totalCrates, locations: settings.locations }));
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async (payload: { totalCrates: number; locations: string[] }) => {
      const ref = doc(db, 'stock_settings', tenantId);
      await setDoc(ref, { ...payload, tenantId }, { merge: true });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['stock-settings', tenantId] });
    }
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-locations', tenantId],
    queryFn: async (): Promise<{ totalReserved: number; totalCrates: number }> => {
      const q = query(collection(db, 'clients'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      const clients: ClientLite[] = snap.docs.map((d) => d.data() as ClientLite);
      const totalReserved = clients.reduce((sum, c) => sum + (typeof c.reservedCrates === 'number' ? c.reservedCrates : 0), 0);
      return { totalReserved, totalCrates: settings?.totalCrates || 0 };
    }
  });

  return (
    <Card title={t('dashboard.stockAndLocations.title', 'Stock & Emplacements')}>
      {isLoading ? (
        <div className="text-gray-600">{t('common.loading')}</div>
      ) : error ? (
        <div className="text-red-600">{t('common.error')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm md:text-base">
          <div className="p-4 rounded-lg border bg-white">
            <div className="text-sm text-gray-600">{t('dashboard.stockAndLocations.totalCrates', 'Total caisses disponibles')}</div>
            <div className="mt-1 text-3xl font-bold text-blue-600">{data?.totalCrates ?? 0}</div>
          </div>
          <div className="p-4 rounded-lg border bg-white">
            <div className="text-sm text-gray-600">{t('dashboard.stockAndLocations.totalReserved', 'Caisses réservées')}</div>
            <div className="mt-1 text-3xl font-bold text-purple-600">{data?.totalReserved ?? 0}</div>
          </div>
        </div>
      )}

      {/* Editable settings */}
      <div className="mt-6 border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.stockAndLocations.manageTitle', 'Gérer les informations')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.stockAndLocations.totalCrates', 'Nombre total de caisses')}</label>
            <input
              type="number"
              min={0}
              value={form.totalCrates}
              onChange={(e) => setForm((f) => ({ ...f, totalCrates: Number(e.target.value) }))}
              className="w-full border rounded-md px-3 py-2"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.stockAndLocations.addLocation', 'Ajouter un emplacement')}</label>
            <div className="flex gap-2">
              <input
                value={form.newLocation}
                onChange={(e) => setForm((f) => ({ ...f, newLocation: e.target.value }))}
                className="flex-1 border rounded-md px-3 py-2"
                placeholder={t('dashboard.stockAndLocations.locationPlaceholder', 'Ex: Zone A, Allée 3') as string}
              />
              <button
                onClick={() => {
                  if (form.newLocation.trim()) {
                    setForm((f) => ({ ...f, locations: [...f.locations, f.newLocation.trim()], newLocation: '' }));
                  }
                }}
                className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                {t('dashboard.stockAndLocations.add', 'Ajouter')}
              </button>
            </div>
          </div>
        </div>

        {form.locations.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">{t('dashboard.stockAndLocations.locationsList', 'Liste des emplacements')}</div>
            <div className="flex flex-wrap gap-2">
              {form.locations.map((loc, idx) => (
                <span key={`${loc}-${idx}`} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-700 border">
                  {loc}
                  <button
                    onClick={() => setForm((f) => ({ ...f, locations: f.locations.filter((_, i) => i !== idx) }))}
                    className="text-red-600 hover:text-red-700"
                    aria-label={t('common.delete') as string}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={() => saveSettings.mutate({ totalCrates: form.totalCrates, locations: form.locations })}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            disabled={saveSettings.isLoading}
          >
            {saveSettings.isLoading ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </Card>
  );
};


