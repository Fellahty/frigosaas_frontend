import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/hooks/useAuth';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';

interface ClientStats {
  totalReservations: number;
  activeReservations: number;
  totalOperations: number;
  pendingOperations: number;
}

interface RecentReservation {
  id: string;
  reference: string;
  clientName: string;
  reservedCrates: number;
  status: 'REQUESTED' | 'APPROVED' | 'CLOSED' | 'REFUSED';
  depositRequired: number;
  depositPaid: number;
  createdAt: Date;
}

interface RecentOperation {
  id: string;
  type: string;
  date: Date;
  status: string;
}

export const ClientDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['client-stats', user?.id],
    queryFn: async (): Promise<ClientStats> => {
      if (!user?.id) {
        return {
          totalReservations: 0,
          activeReservations: 0,
          totalOperations: 0,
          pendingOperations: 0
        };
      }

      // Query reservations for this client
      const reservationsQuery = query(
        collection(db, 'tenants', user.tenantId, 'reservations'),
        where('clientId', '==', user.id)
      );
      const reservationsSnapshot = await getDocs(reservationsQuery);
      
      // Query operations for this client
      const operationsQuery = query(
        collection(db, 'tenants', user.tenantId, 'operations'),
        where('clientId', '==', user.id)
      );
      const operationsSnapshot = await getDocs(operationsQuery);

      const totalReservations = reservationsSnapshot.docs.length;
      const activeReservations = reservationsSnapshot.docs.filter(doc => 
        doc.data().status === 'APPROVED'
      ).length;
      
      const totalOperations = operationsSnapshot.docs.length;
      const pendingOperations = operationsSnapshot.docs.filter(doc => 
        doc.data().status === 'pending'
      ).length;

      return {
        totalReservations,
        activeReservations,
        totalOperations,
        pendingOperations
      };
    },
    enabled: !!user?.id,
  });

  const { data: recentReservations, isLoading: reservationsLoading } = useQuery({
    queryKey: ['client-recent-reservations', user?.id],
    queryFn: async (): Promise<RecentReservation[]> => {
      if (!user?.id) return [];
      
      const reservationsQuery = query(
        collection(db, 'tenants', user.tenantId, 'reservations'),
        where('clientId', '==', user.id)
      );
      const snapshot = await getDocs(reservationsQuery);
      
      return snapshot.docs
        .slice(0, 5) // Get only the 5 most recent
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            reference: data.reference || '',
            clientName: data.clientName || '',
            reservedCrates: data.reservedCrates || 0,
            status: data.status || 'REQUESTED',
            depositRequired: data.depositRequired || 0,
            depositPaid: data.depositPaid || 0,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as RecentReservation;
        });
    },
    enabled: !!user?.id,
  });

  const { data: recentOperations, isLoading: operationsLoading } = useQuery({
    queryKey: ['client-recent-operations', user?.id],
    queryFn: async (): Promise<RecentOperation[]> => {
      if (!user?.id) return [];
      
      const operationsQuery = query(
        collection(db, 'tenants', user.tenantId, 'operations'),
        where('clientId', '==', user.id)
      );
      const snapshot = await getDocs(operationsQuery);
      
      return snapshot.docs
        .slice(0, 5) // Get only the 5 most recent
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            date: data.date?.toDate?.() || new Date(),
            type: data.type || 'unknown',
            status: data.status || 'pending',
            ...data
          } as RecentOperation;
        });
    },
    enabled: !!user?.id,
  });

  if (statsLoading || reservationsLoading || operationsLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading', 'Chargement...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {t('dashboard.welcome', 'Bienvenue')}, {user?.name}!
          </h1>
          <p className="text-gray-600">
            {t('dashboard.clientSubtitle', 'Consultez vos réservations et opérations')}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 012-2h4a2 2 0 012 2v0M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  {t('dashboard.totalReservations', 'Total Réservations')}
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats?.totalReservations || 0}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  {t('dashboard.activeReservations', 'Réservations Actives')}
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats?.activeReservations || 0}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  {t('dashboard.totalOperations', 'Total Opérations')}
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats?.totalOperations || 0}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  {t('dashboard.pendingOperations', 'Opérations En Attente')}
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats?.pendingOperations || 0}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Reservations */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('dashboard.recentReservations', 'Réservations Récentes')}
            </h3>
            {recentReservations && recentReservations.length > 0 ? (
              <div className="space-y-3">
                {recentReservations.map((reservation) => (
                  <div key={reservation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 font-mono">{reservation.reference}</p>
                      <p className="text-xs text-gray-500">{reservation.createdAt?.toLocaleDateString('fr-FR') || 'Date non disponible'}</p>
                      <p className="text-xs text-gray-600">{reservation.reservedCrates} caisses • {reservation.depositRequired > 0 ? `${reservation.depositRequired.toFixed(2)} MAD` : 'Gratuit'}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      reservation.status === 'APPROVED' 
                        ? 'bg-green-100 text-green-800'
                        : reservation.status === 'REFUSED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {reservation.status === 'REQUESTED' ? 'En attente' : 
                       reservation.status === 'APPROVED' ? 'Approuvée' :
                       reservation.status === 'CLOSED' ? 'Clôturée' :
                       reservation.status === 'REFUSED' ? 'Refusée' : reservation.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                {t('dashboard.noRecentReservations', 'Aucune réservation récente')}
              </p>
            )}
          </div>
        </Card>

        {/* Recent Operations */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('dashboard.recentOperations', 'Opérations Récentes')}
            </h3>
            {recentOperations && recentOperations.length > 0 ? (
              <div className="space-y-3">
                {recentOperations.map((operation) => (
                  <div key={operation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{operation.type || 'Opération'}</p>
                      <p className="text-xs text-gray-500">{operation.date?.toLocaleDateString('fr-FR') || 'Date non disponible'}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      operation.status === 'completed' 
                        ? 'bg-green-100 text-green-800'
                        : operation.status === 'active'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {operation.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                {t('dashboard.noRecentOperations', 'Aucune opération récente')}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
