import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, orderBy } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/hooks/useAuth';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';

interface EmptyCrateLoan {
  id: string;
  clientId: string;
  crates: number;
  status: 'open' | 'closed';
  createdAt: Date;
  closedAt?: Date;
  depositMad: number;
  depositType: 'cash' | 'check';
  depositReference: string;
}

interface Reception {
  id: string;
  serial: string;
  clientId: string;
  clientName: string;
  truckId: string;
  truckNumber: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  productId: string;
  productName: string;
  productVariety: string;
  roomId?: string;
  roomName?: string;
  totalCrates: number;
  arrivalTime: Date;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  createdAt: Date;
}

interface ClientOperation {
  id: string;
  type: 'empty_crate_loan' | 'reception';
  status: string;
  date: Date;
  description: string;
  quantity: number;
  details: any;
}

interface Sensor {
  id: string;
  roomId: string;
  roomName: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'motion' | 'light';
  status: 'online' | 'offline' | 'error';
  lastReading?: {
    value: number;
    timestamp: Date;
  };
}

interface RoomWithSensors {
  roomId: string;
  roomName: string;
  sensors: Sensor[];
}

export const ClientOperationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Fetch empty crate loans for this client
  const { data: emptyCrateLoans, isLoading: loansLoading } = useQuery({
    queryKey: ['client-empty-crate-loans', user?.id],
    queryFn: async (): Promise<EmptyCrateLoan[]> => {
      if (!user?.id) return [];
      
      console.log('🔍 Fetching empty crate loans for client:', user.id, 'tenant:', user.tenantId);
      
      const loansQuery = query(
        collection(db, 'empty_crate_loans'),
        where('tenantId', '==', user.tenantId),
        where('clientId', '==', user.id)
      );
      
      const snapshot = await getDocs(loansQuery);
      console.log('📦 Found empty crate loans:', snapshot.docs.length);
      
      const loans = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📋 Loan data:', data);
        return {
          id: doc.id,
          clientId: data.clientId || '',
          crates: data.crates || 0,
          status: data.status || 'open',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          closedAt: data.closedAt?.toDate?.(),
          depositMad: data.depositMad || 0,
          depositType: data.depositType || 'cash',
          depositReference: data.depositReference || '',
        } as EmptyCrateLoan;
      });
      
      console.log('✅ Processed empty crate loans:', loans);
      return loans;
    },
    enabled: !!user?.id,
  });

  // Fetch receptions for this client
  const { data: receptions, isLoading: receptionsLoading } = useQuery({
    queryKey: ['client-receptions', user?.id],
    queryFn: async (): Promise<Reception[]> => {
      if (!user?.id) return [];
      
      console.log('🔍 Fetching receptions for client:', user.id, 'tenant:', user.tenantId);
      
      const receptionsQuery = query(
        collection(db, 'receptions'),
        where('tenantId', '==', user.tenantId),
        where('clientId', '==', user.id)
      );
      
      const snapshot = await getDocs(receptionsQuery);
      console.log('📦 Found receptions:', snapshot.docs.length);
      
      const receptions = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📋 Reception data:', data);
        return {
          id: doc.id,
          serial: data.serial || '',
          clientId: data.clientId || '',
          clientName: data.clientName || '',
          truckId: data.truckId || '',
          truckNumber: data.truckNumber || '',
          driverId: data.driverId || '',
          driverName: data.driverName || '',
          driverPhone: data.driverPhone || '',
          productId: data.productId || '',
          productName: data.productName || '',
          productVariety: data.productVariety || '',
          roomId: data.roomId || '',
          roomName: data.roomName || '',
          totalCrates: data.totalCrates || 0,
          arrivalTime: data.arrivalTime?.toDate?.() || new Date(),
          status: data.status || 'pending',
          notes: data.notes || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as Reception;
      });
      
      console.log('✅ Processed receptions:', receptions);
      return receptions;
    },
    enabled: !!user?.id,
  });

  // Fetch sensors for rooms where client has products
  const { data: roomSensors, isLoading: sensorsLoading } = useQuery({
    queryKey: ['room-sensors-client', user?.id, receptions],
    queryFn: async (): Promise<RoomWithSensors[]> => {
      if (!user?.id || !receptions || receptions.length === 0) {
        return [];
      }
      
      try {
        // Get unique room IDs from receptions that have roomId and roomName
        const roomIds = [...new Set(
          receptions
            .filter(reception => reception.roomId && reception.roomName)
            .map(reception => reception.roomId)
        )];
        
        console.log('Fetching sensors for client rooms:', roomIds);
        
        const roomsWithSensors: RoomWithSensors[] = [];
        
        for (const roomId of roomIds) {
          // Get room name from receptions
          const roomName = receptions.find(r => r.roomId === roomId)?.roomName || 'Unknown';
          
          // Fetch sensors for this room
          const sensorsQuery = query(
            collection(db, 'sensors'),
            where('roomId', '==', roomId)
          );
          
          const sensorsSnapshot = await getDocs(sensorsQuery);
          const sensors: Sensor[] = [];
          
          for (const sensorDoc of sensorsSnapshot.docs) {
            const sensorData = sensorDoc.data();
            
            // Get latest reading for this sensor
            const readingsQuery = query(
              collection(db, 'sensor_readings'),
              where('sensorId', '==', sensorDoc.id),
              orderBy('timestamp', 'desc')
            );
            
            const readingsSnapshot = await getDocs(readingsQuery);
            let lastReading = undefined;
            
            if (!readingsSnapshot.empty) {
              const readingData = readingsSnapshot.docs[0].data();
              lastReading = {
                value: Math.round(readingData.value * 10) / 10, // One decimal place
                timestamp: readingData.timestamp?.toDate?.() || new Date()
              };
            }
            
            sensors.push({
              id: sensorDoc.id,
              roomId: sensorData.roomId || roomId,
              roomName: sensorData.roomName || roomName,
              type: sensorData.type || 'temperature',
              status: lastReading ? 'online' : 'offline',
              lastReading
            });
          }
          
          if (sensors.length > 0) {
            roomsWithSensors.push({
              roomId,
              roomName,
              sensors
            });
          }
        }
        
        console.log('✅ Processed room sensors:', roomsWithSensors);
        return roomsWithSensors;
      } catch (error) {
        console.error('Error fetching room sensors:', error);
        return [];
      }
    },
    enabled: !!user?.id && !!receptions && receptions.length > 0,
  });

  // Combine and sort all operations
  const operations: ClientOperation[] = React.useMemo(() => {
    const allOperations: ClientOperation[] = [];
    
    // Add empty crate loans
    emptyCrateLoans?.forEach(loan => {
      allOperations.push({
        id: loan.id,
        type: 'empty_crate_loan',
        status: loan.status,
        date: loan.createdAt,
        description: `Prêt de ${loan.crates} caisses vides`,
        quantity: loan.crates,
        details: loan
      });
    });
    
    // Add receptions
    receptions?.forEach(reception => {
      allOperations.push({
        id: reception.id,
        type: 'reception',
        status: reception.status,
        date: reception.createdAt,
        description: `Réception de ${reception.totalCrates} caisses pleines - ${reception.productName}`,
        quantity: reception.totalCrates,
        details: reception
      });
    });
    
    // Sort by date (most recent first)
    return allOperations.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [emptyCrateLoans, receptions]);

  // Calculate products by room
  const productsByRoom = React.useMemo(() => {
    if (!receptions) return [];
    
    const roomMap = new Map<string, { roomName: string; products: any[] }>();
    
    receptions.forEach(reception => {
      if (reception.roomId && reception.roomName) {
        if (!roomMap.has(reception.roomId)) {
          roomMap.set(reception.roomId, {
            roomName: reception.roomName,
            products: []
          });
        }
        
        const room = roomMap.get(reception.roomId)!;
        const existingProduct = room.products.find(p => 
          p.productId === reception.productId && p.productVariety === reception.productVariety
        );
        
        if (existingProduct) {
          existingProduct.totalCrates += reception.totalCrates;
        } else {
          room.products.push({
            productName: reception.productName,
            productVariety: reception.productVariety,
            totalCrates: reception.totalCrates,
            lastArrival: reception.arrivalTime
          });
        }
      }
    });
    
    return Array.from(roomMap.values()).sort((a, b) => a.roomName.localeCompare(b.roomName));
  }, [receptions]);

  const isLoading = loansLoading || receptionsLoading || sensorsLoading;

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

  // Calculate summary statistics
  const totalEmptyCratesLoaned = emptyCrateLoans?.filter(loan => loan.status === 'open').reduce((sum, loan) => sum + loan.crates, 0) || 0;
  const totalEmptyCratesReturned = emptyCrateLoans?.filter(loan => loan.status === 'closed').reduce((sum, loan) => sum + loan.crates, 0) || 0;
  const totalFullCratesReceived = receptions?.reduce((sum, reception) => sum + reception.totalCrates, 0) || 0;

  // Debug logging
  console.log('📊 Summary statistics:');
  console.log('Empty crate loans:', emptyCrateLoans);
  console.log('Receptions:', receptions);
  console.log('Total empty crates loaned:', totalEmptyCratesLoaned);
  console.log('Total empty crates returned:', totalEmptyCratesReturned);
  console.log('Total full crates received:', totalFullCratesReceived);
  console.log('Products by room:', productsByRoom);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {t('operations.title', 'Mes Opérations')}
          </h1>
          <p className="text-gray-600">
            {t('operations.subtitle', 'Consultez l\'historique de vos opérations de caisses')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  {t('operations.emptyCratesLoaned', 'Caisses vides prêtées')}
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {totalEmptyCratesLoaned}
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
                  {t('operations.emptyCratesReturned', 'Caisses vides rendues')}
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {totalEmptyCratesReturned}
                </p>
              </div>
            </div>
          </div>
        </Card>


        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  {t('operations.fullCratesReceived', 'Caisses pleines reçues')}
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {totalFullCratesReceived}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Products by Room Section */}
      {productsByRoom.length > 0 && (
        <Card>
          <div className="p-6">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('operations.productsByRoom', 'Produits par chambre')}
                </h2>
                <p className="text-sm text-gray-500">
                  {t('operations.productsByRoomSubtitle', 'Voir où sont stockés vos produits')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productsByRoom.map((room, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">
                      {t('operations.room', 'Chambre')} {room.roomName}
                    </h3>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {room.products.length} {t('operations.products', 'produits')}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {room.products.map((product, productIndex) => (
                      <div key={productIndex} className="flex justify-between items-center text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {product.productName}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {product.productVariety}
                          </div>
                        </div>
                        <div className="ml-2 text-right">
                          <div className="font-medium text-gray-900">
                            {product.totalCrates} {t('operations.crates', 'caisses')}
                          </div>
                          <div className="text-gray-400 text-xs">
                            {product.lastArrival.toLocaleDateString('fr-FR', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Room Sensors Section */}
      {roomSensors && roomSensors.length > 0 && (
        <Card>
          <div className="p-6">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('operations.roomSensors', 'Capteurs des chambres')}
                </h2>
                <p className="text-sm text-gray-500">
                  {t('operations.roomSensorsSubtitle', 'Surveillance en temps réel de vos chambres')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roomSensors.map((room, index) => (
                <div key={index} className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">
                      {t('operations.room', 'Chambre')} {room.roomName}
                    </h3>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      {room.sensors.length} {t('operations.sensors', 'capteurs')}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {room.sensors.map((sensor, sensorIndex) => (
                      <div key={sensorIndex} className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                              sensor.status === 'online' ? 'bg-green-500' : 
                              sensor.status === 'offline' ? 'bg-gray-400' : 'bg-red-500'
                            }`}></div>
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {t(`sensors.${sensor.type}`, sensor.type)}
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            sensor.status === 'online' ? 'bg-green-100 text-green-800' : 
                            sensor.status === 'offline' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-800'
                          }`}>
                            {t(`sensors.${sensor.status}`, sensor.status)}
                          </span>
                        </div>
                        
                        {sensor.lastReading && (
                          <div className="flex items-center justify-between">
                            <div className="text-lg font-bold text-gray-900">
                              {sensor.lastReading.value.toFixed(1)}
                              <span className="text-sm text-gray-500 ml-1">
                                {sensor.type === 'temperature' ? '°C' : 
                                 sensor.type === 'humidity' ? '%' : 
                                 sensor.type === 'pressure' ? 'hPa' : ''}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400">
                              {sensor.lastReading.timestamp.toLocaleDateString('fr-FR', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        )}
                        
                        {!sensor.lastReading && (
                          <div className="text-sm text-gray-400 italic">
                            {t('sensors.noData', 'Aucune donnée')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHead>
              <TableRow className="bg-gray-50">
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('operations.type', 'Type')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('operations.description', 'Description')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('operations.status', 'Statut')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('operations.date', 'Date')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('operations.quantity', 'Quantité')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('operations.details', 'Détails')}
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {operations && operations.length > 0 ? (
                operations.map((operation) => (
                  <TableRow key={operation.id} className="hover:bg-gray-50">
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        operation.type === 'empty_crate_loan' 
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {operation.type === 'empty_crate_loan' 
                          ? t('operations.emptyCrateLoan', 'Prêt caisses vides')
                          : t('operations.reception', 'Réception caisses pleines')
                        }
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {operation.description}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        operation.status === 'completed' || operation.status === 'closed'
                          ? 'bg-green-100 text-green-800'
                          : operation.status === 'open' || operation.status === 'active'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {operation.status === 'completed' || operation.status === 'closed'
                          ? t('operations.completed', 'Terminé')
                          : operation.status === 'open' || operation.status === 'active'
                          ? t('operations.active', 'En cours')
                          : t('operations.pending', 'En attente')
                        }
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {operation.date.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                      {operation.quantity}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {operation.type === 'empty_crate_loan' ? (
                        <div className="space-y-1">
                          <div className="text-xs">
                            <span className="font-medium">Caution:</span> {operation.details.depositMad} MAD
                          </div>
                          <div className="text-xs">
                            <span className="font-medium">Type:</span> {operation.details.depositType === 'cash' ? 'Espèces' : 'Chèque'}
                          </div>
                          {operation.details.depositReference && (
                            <div className="text-xs font-mono">
                              <span className="font-medium">Ref:</span> {operation.details.depositReference}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-xs">
                            <span className="font-medium">Produit:</span> {operation.details.productName}
                          </div>
                          <div className="text-xs">
                            <span className="font-medium">Variété:</span> {operation.details.productVariety}
                          </div>
                          <div className="text-xs">
                            <span className="font-medium">Camion:</span> {operation.details.truckNumber}
                          </div>
                          <div className="text-xs">
                            <span className="font-medium">Chauffeur:</span> {operation.details.driverName}
                          </div>
                          {operation.details.roomName && (
                            <div className="text-xs">
                              <span className="font-medium">Salle:</span> {operation.details.roomName}
                            </div>
                          )}
                          {operation.details.notes && (
                            <div className="text-xs text-gray-400 truncate max-w-32">
                              {operation.details.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <p className="text-lg font-medium text-gray-900 mb-2">
                        {t('operations.noOperations', 'Aucune opération trouvée')}
                      </p>
                      <p className="text-gray-500">
                        {t('operations.noOperationsDescription', 'Vous n\'avez pas encore d\'opérations de caisses')}
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
