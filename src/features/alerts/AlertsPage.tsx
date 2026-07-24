import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from '@/lib/db';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { AlertItem, MetricsToday } from '../../types/metrics';
import { Card } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
import { AlertList } from '../dashboard/AlertList';

export const AlertsPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();

  const { data, isLoading, error } = useQuery({
    queryKey: ['alerts', tenantId],
    queryFn: async (): Promise<AlertItem[]> => {
      const ref = doc(db, 'metrics_today', tenantId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return [];
      const mt = snap.data() as MetricsToday & any;
      const alerts = (mt.alerts || []).map((a: any) => ({
        ...a,
        timestamp: a.timestamp?.toDate ? a.timestamp.toDate() : new Date(),
      }));
      return alerts;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-medium">{t('alerts.error', 'Erreur de chargement')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm md:text-base">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{t('dashboard.alerts')}</h1>
        <p className="text-gray-600">{t('alerts.subtitle', 'Toutes les alertes récentes')}</p>
      </div>

      <Card>
        <AlertList alerts={data || []} />
      </Card>
    </div>
  );
};


