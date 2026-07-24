import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';
import { Spinner } from '../../components/Spinner';

interface Reception {
  id: string;
  serial: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientCompany?: string;
  truckId: string;
  truckNumber: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  productId: string;
  productName: string;
  productVariety: string;
  totalCrates: number;
  arrivalTime: Date;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  createdAt: Date;
}

export const ReceptionViewPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const { serial: serialFromPath } = useParams<{ serial: string }>();
  const [serial, setSerial] = React.useState<string>('');

  // Extract serial from URL parameters or path
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const serialParam = urlParams.get('serial');
    
    const finalSerial = serialParam || serialFromPath;
    if (finalSerial) {
      setSerial(finalSerial);
    }
  }, [serialFromPath]);

  // Query to find reception by serial
  const { data: reception, isLoading, error } = useQuery({
    queryKey: ['reception-by-serial', tenantId, serial],
    queryFn: async (): Promise<Reception | null> => {
      if (!tenantId || !serial) {
        return null;
      }
      
      try {
        const receptionsRef = collection(db, 'receptions');
        const q = query(receptionsRef, where('tenantId', '==', tenantId), where('serial', '==', serial));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          return null;
        }
        
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        
        return {
          id: doc.id,
          serial: data.serial || '',
          clientId: data.clientId || '',
          clientName: data.clientName || '',
          clientPhone: data.clientPhone || '',
          clientCompany: data.clientCompany || '',
          truckId: data.truckId || '',
          truckNumber: data.truckNumber || '',
          driverId: data.driverId || '',
          driverName: data.driverName || '',
          driverPhone: data.driverPhone || '',
          productId: data.productId || '',
          productName: data.productName || '',
          productVariety: data.productVariety || '',
          totalCrates: data.totalCrates || 0,
          arrivalTime: data.arrivalTime?.toDate?.() || new Date(),
          status: data.status || 'pending',
          notes: data.notes || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
        };
      } catch (error) {
        console.error('Error fetching reception:', error);
        throw error;
      }
    },
    enabled: !!tenantId && !!serial,
  });

  if (!serial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full p-6 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {t('reception.notFound.title', 'Numéro de série manquant')}
          </h1>
          <p className="text-gray-600">
            {t('reception.notFound.message', 'Aucun numéro de série fourni dans l\'URL.')}
          </p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full p-6 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {t('reception.error.title', 'Erreur')}
          </h1>
          <p className="text-gray-600">
            {t('reception.error.message', 'Une erreur s\'est produite lors du chargement de la réception.')}
          </p>
        </Card>
      </div>
    );
  }

  if (!reception) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full p-6 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {t('reception.notFound.title', 'Réception non trouvée')}
          </h1>
          <p className="text-gray-600 mb-4">
            {t('reception.notFound.message', 'Aucune réception trouvée avec le numéro de série:')} <strong>{serial}</strong>
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            {t('common.back', 'Retour')}
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('reception.details.title', 'Détails de la réception')}
          </h1>
          <p className="mt-2 text-gray-600">
            {t('reception.details.subtitle', 'Numéro de série')}: <span className="font-mono font-bold">{reception.serial}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('reception.client.title', 'Informations client')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('reception.client.name', 'Nom')}
                </label>
                <p className="mt-1 text-sm text-gray-900">{reception.clientName}</p>
              </div>
              {reception.clientPhone && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('reception.client.phone', 'Téléphone')}
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{reception.clientPhone}</p>
                </div>
              )}
              {reception.clientCompany && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('reception.client.company', 'Entreprise')}
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{reception.clientCompany}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Driver Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('reception.driver.title', 'Informations chauffeur')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('reception.driver.name', 'Nom')}
                </label>
                <p className="mt-1 text-sm text-gray-900">{reception.driverName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('reception.driver.phone', 'Téléphone')}
                </label>
                <p className="mt-1 text-sm text-gray-900">{reception.driverPhone}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('reception.driver.truck', 'Numéro de camion')}
                </label>
                <p className="mt-1 text-sm text-gray-900 font-mono">{reception.truckNumber}</p>
              </div>
            </div>
          </Card>

          {/* Product Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('reception.product.title', 'Informations produit')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('reception.product.name', 'Type de produit')}
                </label>
                <p className="mt-1 text-sm text-gray-900">{reception.productName}</p>
              </div>
              {reception.productVariety && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('reception.product.variety', 'Variété')}
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{reception.productVariety}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('reception.product.crates', 'Nombre de caisses')}
                </label>
                <p className="mt-1 text-2xl font-bold text-blue-600">{reception.totalCrates}</p>
              </div>
            </div>
          </Card>

          {/* Reception Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {t('reception.details.title', 'Détails de la réception')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('reception.details.date', 'Date d\'arrivée')}
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {reception.arrivalTime.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('reception.details.status', 'Statut')}
                </label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  reception.status === 'completed' 
                    ? 'bg-green-100 text-green-800'
                    : reception.status === 'cancelled'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {t(`reception.status.${reception.status}`, reception.status)}
                </span>
              </div>
              {reception.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('reception.details.notes', 'Notes')}
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{reception.notes}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => window.history.back()}
            className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 transition-colors mr-4"
          >
            {t('common.back', 'Retour')}
          </button>
          <button
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            {t('common.print', 'Imprimer')}
          </button>
        </div>
      </div>
    </div>
  );
};
