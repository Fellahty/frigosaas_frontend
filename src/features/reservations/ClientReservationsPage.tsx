import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/hooks/useAuth';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';

interface ClientReservation {
  id: string;
  reference: string;
  clientName: string;
  reservedCrates: number;
  emptyCratesNeeded: number;
  status: 'REQUESTED' | 'APPROVED' | 'CLOSED' | 'REFUSED';
  depositRequired: number;
  depositPaid: number;
  capacityOk: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const ClientReservationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: reservations, isLoading, error } = useQuery({
    queryKey: ['client-reservations', user?.id],
    queryFn: async (): Promise<ClientReservation[]> => {
      if (!user?.id) return [];
      
      // Query reservations for this specific client
      const reservationsQuery = query(
        collection(db, 'tenants', user.tenantId, 'reservations'),
        where('clientId', '==', user.id)
      );
      
      const snapshot = await getDocs(reservationsQuery);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          reference: data.reference || '',
          clientName: data.clientName || '',
          reservedCrates: data.reservedCrates || 0,
          emptyCratesNeeded: data.emptyCratesNeeded || 0,
          status: data.status || 'REQUESTED',
          depositRequired: data.depositRequired || 0,
          depositPaid: data.depositPaid || 0,
          capacityOk: data.capacityOk || false,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as ClientReservation;
      });
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading', 'Chargement...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-medium">{t('common.errorLoading', 'Erreur de chargement')}</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800';
      case 'REFUSED':
        return 'bg-red-100 text-red-800';
      case 'REQUESTED':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return t('reservations.requested', 'En attente');
      case 'APPROVED':
        return t('reservations.approved', 'Approuvée');
      case 'CLOSED':
        return t('reservations.closed', 'Clôturée');
      case 'REFUSED':
        return t('reservations.refused', 'Refusée');
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {t('reservations.myReservations', 'Mes Réservations')}
          </h1>
          <p className="text-gray-600">
            {t('reservations.clientSubtitle', 'Consultez et gérez vos réservations')}
          </p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHead>
              <TableRow className="bg-gray-50">
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('reservations.reference', 'Référence')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('reservations.date', 'Date')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('reservations.status', 'Statut')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('reservations.reservedCrates', 'Caisses réservées')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('reservations.emptyCratesNeeded', 'Caisses vides')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('reservations.depositRequired', 'Montant requis')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('reservations.depositPaid', 'Montant payé')}
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {reservations && reservations.length > 0 ? (
                reservations.map((reservation) => (
                  <TableRow key={reservation.id} className="hover:bg-gray-50">
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 font-mono">
                        {reservation.reference}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reservation.createdAt.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
                        {getStatusText(reservation.status)}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {reservation.reservedCrates}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {reservation.emptyCratesNeeded}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reservation.depositRequired > 0 ? `${reservation.depositRequired.toFixed(2)} MAD` : '-'}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reservation.depositPaid > 0 ? `${reservation.depositPaid.toFixed(2)} MAD` : '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 012-2h4a2 2 0 012 2v0M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
                      </svg>
                      <p className="text-lg font-medium text-gray-900 mb-2">
                        {t('reservations.noReservations', 'Aucune réservation')}
                      </p>
                      <p className="text-gray-500">
                        {t('reservations.noReservationsDescription', 'Vous n\'avez pas encore de réservations')}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
