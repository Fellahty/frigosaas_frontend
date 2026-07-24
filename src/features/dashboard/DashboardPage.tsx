import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, orderBy, limit } from '@/lib/db';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { MetricsToday, Kpis, RoomSummary, AlertItem, TopClient, MoveItem } from '../../types/metrics';
import { deduplicateFacilityRooms } from '../../lib/facilityGroups';
import { KpiCards } from './KpiCards';
import FacilityMap from './FacilityMap';
import { Spinner } from '../../components/Spinner';

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['dashboard-metrics', tenantId],
    queryFn: async (): Promise<MetricsToday> => {
      if (!tenantId) {
        throw new Error('No tenant ID available');
      }

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

        // Process clients data
        const clients = clientsResult.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Process rooms data (drop legacy CHN duplicates when Chambre N exists)
        const rooms = deduplicateFacilityRooms(
          roomsResult.docs.map(doc => ({
            id: doc.id,
            name: (doc.data().room as string) || doc.id,
            ...doc.data(),
          }))
        );

        // Process receptions data and sort by creation date
        const receptions = receptionsResult.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || new Date(),
            arrivalTime: doc.data().arrivalTime?.toDate?.() || new Date()
          }))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 100); // Limit to last 100 receptions

        // Process empty crate loans
        const emptyCrateLoans = emptyCrateLoansResult.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Process reservations
        const reservations = reservationsResult.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }));

        console.log('Data loaded:', {
          clients: clients.length,
          rooms: rooms.length,
          receptions: receptions.length,
          emptyCrateLoans: emptyCrateLoans.length,
          reservations: reservations.length
        });

        // Calculate KPIs
        const kpis: Kpis = {
          totalRooms: rooms.length,
          totalClients: clients.length,
          averageTemperature: 0, // Not used anymore
          averageHumidity: 0, // Not used anymore
          alertsCount: 0 // Not displayed anymore
        };

        // Create room summaries with real occupancy data
        const roomSummaries: RoomSummary[] = rooms.map(room => {
          // Calculate current occupancy based on receptions
          const roomReceptions = receptions.filter(r => r.roomId === room.id);
          const currentOccupancy = roomReceptions.reduce((sum, r) => sum + (r.totalCrates || 0), 0);
          const roomName = room.room || room.name || `Room ${room.id}`;

          return {
            id: room.id,
            name: roomName,
            capacity: room.capacityCrates || room.capacity || 0,
            currentOccupancy: Math.min(currentOccupancy, room.capacityCrates || room.capacity || 0),
            temperature: room.temperature || 22 + Math.random() * 4, // Simulate sensor data
            humidity: room.humidity || 45 + Math.random() * 10 // Simulate sensor data
          };
        });

        // Generate alerts based on room conditions (not displayed anymore)
        const alerts: AlertItem[] = [];

        // Calculate top clients based on reception history
        const clientUsage = new Map<string, { name: string; totalCrates: number; lastVisit: Date }>();
        
        receptions.forEach(reception => {
          const clientId = reception.clientId;
          const clientName = reception.clientName;
          const crates = reception.totalCrates || 0;
          const visitDate = reception.arrivalTime || reception.createdAt;
          
          if (clientUsage.has(clientId)) {
            const existing = clientUsage.get(clientId)!;
            existing.totalCrates += crates;
            if (visitDate > existing.lastVisit) {
              existing.lastVisit = visitDate;
            }
          } else {
            clientUsage.set(clientId, {
              name: clientName,
              totalCrates: crates,
              lastVisit: visitDate
            });
          }
        });

        const topClients: TopClient[] = Array.from(clientUsage.entries())
          .map(([id, data]) => ({
            id,
            name: data.name,
            usage: data.totalCrates,
            lastVisit: data.lastVisit
          }))
          .sort((a, b) => b.usage - a.usage)
          .slice(0, 5);

        // Create recent moves from reception data
        const recentMoves: MoveItem[] = receptions
          .filter(r => r.roomName) // Only receptions with room assignments
          .slice(0, 10) // Last 10 moves
          .map((reception, index) => ({
            id: `move-${reception.id}`,
            clientId: reception.clientId,
            clientName: reception.clientName,
            fromRoom: 'Entrance', // All receptions come from entrance
            toRoom: reception.roomName || 'Unassigned',
            timestamp: reception.arrivalTime || reception.createdAt,
            reason: 'New reception'
          }));

        const metrics: MetricsToday = {
          tenantId,
          date: new Date().toISOString().split('T')[0],
          kpis,
          rooms: roomSummaries,
          alerts,
          topClients,
          recentMoves,
          lastUpdated: new Date(),
          // Add additional data for FacilityMap
          receptions,
          clients
        };

        console.log('Dashboard metrics calculated:', {
          totalRooms: metrics.kpis.totalRooms,
          totalClients: metrics.kpis.totalClients,
          topClientsCount: metrics.topClients.length,
          recentMovesCount: metrics.recentMoves.length
        });

        return metrics;

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        throw error;
      }
    },
    refetchInterval: 60000, // Refetch every minute
    enabled: !!tenantId
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
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-800">Error loading dashboard data</h3>
            <p className="text-red-600">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-yellow-800">No metrics data available</h3>
            <p className="text-yellow-600">No metrics data available for tenant: {tenantId}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('dashboard.title')}</h1>
          <p className="text-gray-600">{t('dashboard.subtitle')}</p>
        </div>

        {/* KPI Cards */}
        <KpiCards kpis={metrics.kpis} />
        
        {/* Facility Map - Full Width */}
        <FacilityMap 
          rooms={metrics.rooms} 
          receptions={metrics.receptions || []}
          clients={metrics.clients || []}
        />
      </div>
    </div>
  );
};
