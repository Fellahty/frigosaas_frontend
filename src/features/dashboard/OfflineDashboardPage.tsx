import React from 'react';
import { useOfflineQuery } from '../../lib/hooks/useOfflineSync';
import { collection, query, where, getDocs } from '@/lib/db';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { MetricsToday, Kpis, RoomSummary, AlertItem, TopClient, MoveItem } from '../../types/metrics';
import { KpiCards } from './KpiCards';
import FacilityMap from './FacilityMap';
import { Spinner } from '../../components/Spinner';
import { SyncStatusIndicator } from '../../components/SyncStatusIndicator';

export const OfflineDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();

  const { data: metrics, isLoading, error, isOffline, lastSync, refetch, syncStatus } = useOfflineQuery(
    ['dashboard-metrics', tenantId],
    async (): Promise<MetricsToday> => {
      if (!tenantId) throw new Error('No tenant ID available');

      console.log('Fetching real dashboard data for tenant:', tenantId);

      try {
        // Fetch all data in parallel with error handling for each query
        const [
          clientsSnapshot,
          roomsSnapshot,
          receptionsSnapshot,
          emptyCrateLoansSnapshot,
          reservationsSnapshot
        ] = await Promise.allSettled([
          // Clients
          getDocs(query(collection(db, 'tenants', tenantId, 'clients'))),
          // Rooms
          getDocs(query(collection(db, 'rooms'), where('tenantId', '==', tenantId), where('active', '==', true))),
          // Receptions - without ordering to avoid index requirement
          getDocs(query(
            collection(db, 'receptions'), 
            where('tenantId', '==', tenantId)
          )),
          // Empty crate loans
          getDocs(query(collection(db, 'empty_crate_loans'), where('tenantId', '==', tenantId))),
          // Reservations
          getDocs(query(collection(db, 'tenants', tenantId, 'reservations')))
        ]);

        // Extract successful results and handle failures
        const clientsResult = clientsSnapshot.status === 'fulfilled' ? clientsSnapshot.value : { docs: [] };
        const roomsResult = roomsSnapshot.status === 'fulfilled' ? roomsSnapshot.value : { docs: [] };
        const receptionsResult = receptionsSnapshot.status === 'fulfilled' ? receptionsSnapshot.value : { docs: [] };
        const emptyCrateLoansResult = emptyCrateLoansSnapshot.status === 'fulfilled' ? emptyCrateLoansSnapshot.value : { docs: [] };
        const reservationsResult = reservationsSnapshot.status === 'fulfilled' ? reservationsSnapshot.value : { docs: [] };

        // Log any failed queries
        if (clientsSnapshot.status === 'rejected') console.warn('Failed to fetch clients:', clientsSnapshot.reason);
        if (roomsSnapshot.status === 'rejected') console.warn('Failed to fetch rooms:', roomsSnapshot.reason);
        if (receptionsSnapshot.status === 'rejected') console.warn('Failed to fetch receptions:', receptionsSnapshot.reason);
        if (emptyCrateLoansSnapshot.status === 'rejected') console.warn('Failed to fetch empty crate loans:', emptyCrateLoansSnapshot.reason);
        if (reservationsSnapshot.status === 'rejected') console.warn('Failed to fetch reservations:', reservationsSnapshot.reason);

        // Process data
        const clients = clientsResult.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const rooms = roomsResult.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const receptions = receptionsResult.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const emptyCrateLoans = emptyCrateLoansResult.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const reservations = reservationsResult.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort receptions by creation date (client-side)
        const sortedReceptions = receptions.sort((a, b) => {
          const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
          const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
          return bDate.getTime() - aDate.getTime();
        });

        // Get recent receptions (last 100)
        const recentReceptions = sortedReceptions.slice(0, 100);

        // Calculate metrics
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayReceptions = recentReceptions.filter(r => {
          const receptionDate = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(0);
          return receptionDate >= today;
        });

        const todayReservations = reservations.filter(r => {
          const reservationDate = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(0);
          return reservationDate >= today;
        });

        // Calculate KPIs
        const kpis: Kpis = {
          totalClients: clients.length,
          activeRooms: rooms.length,
          todayReceptions: todayReceptions.length,
          todayReservations: todayReservations.length,
          totalEmptyCrateLoans: emptyCrateLoans.filter(loan => loan.status === 'open').length,
          totalEmptyCrates: emptyCrateLoans
            .filter(loan => loan.status === 'open')
            .reduce((sum, loan) => sum + (Number(loan.crates) || 0), 0),
        };

        // Room summary
        const roomSummary: RoomSummary[] = rooms.map(room => {
          const roomReceptions = recentReceptions.filter(r => r.roomId === room.id);
          const roomReservations = todayReservations.filter(r => r.roomId === room.id);
          
          return {
            id: room.id,
            name: room.name || 'Unknown Room',
            capacity: Number(room.capacity) || 0,
            currentOccupancy: roomReceptions.length,
            occupancyRate: Number(room.capacity) > 0 ? (roomReceptions.length / Number(room.capacity)) * 100 : 0,
            reservations: roomReservations.length,
            status: roomReceptions.length >= Number(room.capacity) ? 'full' : 'available'
          };
        });

        // Top clients (by number of receptions)
        const clientReceptionCounts = recentReceptions.reduce((acc, reception) => {
          const clientId = reception.clientId;
          if (clientId) {
            acc[clientId] = (acc[clientId] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const topClients: TopClient[] = Object.entries(clientReceptionCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([clientId, count]) => {
            const client = clients.find(c => c.id === clientId);
            return {
              id: clientId,
              name: client?.name || 'Unknown Client',
              receptions: count,
              lastVisit: client?.lastVisit?.toDate ? client.lastVisit.toDate() : new Date()
            };
          });

        // Recent moves
        const recentMoves: MoveItem[] = recentReceptions.slice(0, 10).map(reception => ({
          id: reception.id,
          clientName: clients.find(c => c.id === reception.clientId)?.name || 'Unknown Client',
          type: 'reception',
          timestamp: reception.createdAt?.toDate ? reception.createdAt.toDate() : new Date(),
          details: `${reception.crates || 0} crates received`
        }));

        // Alerts (mock for now)
        const alerts: AlertItem[] = [];

        const metricsData: MetricsToday = {
          kpis,
          roomSummary,
          topClients,
          recentMoves,
          alerts,
          lastUpdated: new Date()
        };

        console.log('Dashboard data loaded successfully:', metricsData);
        return metricsData;
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        throw error;
      }
    },
    undefined, // No realtime query for now
    {
      enabled: !!tenantId,
      staleTime: 2 * 60 * 1000, // 2 minutes
    }
  );

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
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t('dashboard.error', 'Error loading dashboard')}</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
          <button
            onClick={() => refetch()}
            className="ml-4 px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm font-medium transition-colors"
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with sync status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title', 'Dashboard')}</h1>
          <p className="text-gray-600 mt-1">
            {isOffline ? t('dashboard.offline', 'Working offline') : t('dashboard.online', 'Online')}
            {lastSync && ` • ${t('dashboard.lastSync', 'Last sync')}: ${lastSync.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <SyncStatusIndicator showDetails={true} />
          <button
            onClick={() => refetch()}
            disabled={syncStatus.isSyncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <svg className={`w-4 h-4 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{t('common.refresh', 'Refresh')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {metrics && <KpiCards kpis={metrics.kpis} />}

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Facility Map */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('dashboard.facilityMap', 'Facility Map')}
          </h2>
          <FacilityMap rooms={metrics?.roomSummary || []} />
        </div>

        {/* Room Capacity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('dashboard.roomCapacity', 'Room Capacity')}
          </h2>
          <div className="space-y-3">
            {metrics?.roomSummary.map(room => (
              <div key={room.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{room.name}</p>
                  <p className="text-sm text-gray-600">
                    {room.currentOccupancy} / {room.capacity} {t('dashboard.crates', 'crates')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="w-20 bg-gray-200 rounded-full h-2 mb-1">
                    <div 
                      className={`h-2 rounded-full ${
                        room.occupancyRate >= 90 ? 'bg-red-500' : 
                        room.occupancyRate >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(room.occupancyRate, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600">{room.occupancyRate.toFixed(0)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {metrics?.recentMoves && metrics.recentMoves.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('dashboard.recentActivity', 'Recent Activity')}
          </h2>
          <div className="space-y-2">
            {metrics.recentMoves.map(move => (
              <div key={move.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div>
                    <p className="font-medium text-gray-900">{move.clientName}</p>
                    <p className="text-sm text-gray-600">{move.details}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  {move.timestamp.toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
