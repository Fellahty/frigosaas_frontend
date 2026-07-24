import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/hooks/useAuth';
import { Card } from '../../components/Card';
import { Spinner } from '../../components/Spinner';

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

export const ClientSensorsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Fetch receptions to get client's rooms
  const { data: receptions, isLoading: receptionsLoading } = useQuery({
    queryKey: ['client-receptions-for-sensors', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      try {
        console.log('🔍 Fetching receptions for client sensors:', user.id, 'tenant:', user.tenantId);
        
        const receptionsQuery = query(
          collection(db, 'receptions'),
          where('tenantId', '==', user.tenantId),
          where('clientId', '==', user.id)
        );
        
        const snapshot = await getDocs(receptionsQuery);
        console.log('📦 Found receptions for sensors:', snapshot.docs.length);
        
        const receptions = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('📋 Reception data for sensors:', data);
          console.log('🏠 Room ID:', data.roomId);
          console.log('🏠 Room Name:', data.roomName);
          return {
            id: doc.id,
            roomId: data.roomId || '',
            roomName: data.roomName || '',
            productName: data.productName || '',
            totalCrates: data.totalCrates || 0,
            arrivalTime: data.arrivalTime?.toDate?.() || new Date(),
          };
        });
        
        console.log('✅ Processed receptions for sensors:', receptions);
        return receptions;
      } catch (error) {
        console.error('Error fetching receptions for sensors:', error);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // Create demo sensors based on client's rooms
  const { data: roomSensors, isLoading: sensorsLoading } = useQuery({
    queryKey: ['client-demo-sensors', user?.id, receptions],
    queryFn: async (): Promise<RoomWithSensors[]> => {
      console.log('🚀 Creating demo sensors for client rooms');
      
      if (!user?.id || !receptions || receptions.length === 0) {
        console.log('❌ No receptions found, returning empty array');
        return [];
      }
      
      try {
        // Get unique rooms from receptions
        const receptionsWithRooms = receptions.filter(reception => reception.roomId && reception.roomName);
        const uniqueRooms = [...new Map(
          receptionsWithRooms.map(r => [r.roomId, { roomId: r.roomId, roomName: r.roomName }])
        ).values()];
        
        console.log('🏠 Client rooms found:', uniqueRooms);
        
        // Create demo sensors for each room
        const roomsWithSensors: RoomWithSensors[] = uniqueRooms.map(room => {
          // Create demo sensors with room name (only temperature and humidity)
          const demoSensors: Sensor[] = [
            {
              id: `demo-temp-${room.roomId}`,
              roomId: room.roomId,
              roomName: room.roomName,
              type: 'temperature',
              status: 'online',
              lastReading: {
                value: Math.round((4.0 + Math.random() * 2) * 10) / 10, // 4.0-6.0°C
                timestamp: new Date()
              }
            },
            {
              id: `demo-humidity-${room.roomId}`,
              roomId: room.roomId,
              roomName: room.roomName,
              type: 'humidity',
              status: 'online',
              lastReading: {
                value: Math.round((60 + Math.random() * 20) * 10) / 10, // 60-80%
                timestamp: new Date()
              }
            }
          ];
          
          console.log(`✅ Created ${demoSensors.length} demo sensors for room ${room.roomName}`);
          
          return {
            roomId: room.roomId,
            roomName: room.roomName,
            sensors: demoSensors
          };
        });
        
        console.log('🎉 Demo sensors created successfully:', roomsWithSensors);
        return roomsWithSensors;
        
      } catch (error) {
        console.error('Error creating demo sensors:', error);
        return [];
      }
    },
    enabled: !!user?.id && !!receptions && receptions.length > 0,
  });

  const isLoading = receptionsLoading || sensorsLoading;

  // Debug logs
  console.log('🔍 ClientSensorsPage Debug:');
  console.log('- receptionsLoading:', receptionsLoading);
  console.log('- sensorsLoading:', sensorsLoading);
  console.log('- isLoading:', isLoading);
  console.log('- receptions:', receptions);
  console.log('- roomSensors:', roomSensors);
  console.log('- user:', user);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 rounded-2xl p-4 sm:p-6 border border-white/50 shadow-lg shadow-gray-200/50 mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-green-600/5 to-blue-600/5"></div>
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                  📊 {t('clientSensors.clientTitle', 'Mes Capteurs')}
                </h1>
                <p className="text-gray-600 text-sm sm:text-base">
                  {t('clientSensors.clientSubtitle', 'Surveillance en temps réel de vos chambres de stockage')}
                </p>
              </div>
              <div className="hidden sm:block">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Room Sensors */}
        {roomSensors && roomSensors.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {roomSensors.map((room, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {t('clientSensors.room', 'Chambre')} {room.roomName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {room.sensors.length} {t('clientSensors.sensors', 'capteurs')}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-green-600 font-medium">
                        {t('clientSensors.active', 'Actif')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {room.sensors.map((sensor, sensorIndex) => (
                      <div key={sensorIndex} className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-3 ${
                              sensor.status === 'online' ? 'bg-green-500' : 
                              sensor.status === 'offline' ? 'bg-gray-400' : 'bg-red-500'
                            }`}></div>
                            <span className="text-sm font-medium text-gray-900">
                              {room.roomName} - {t(`clientSensors.${sensor.type}`, sensor.type)}
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            sensor.status === 'online' ? 'bg-green-100 text-green-800' : 
                            sensor.status === 'offline' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-800'
                          }`}>
                            {t(`clientSensors.${sensor.status}`, sensor.status)}
                          </span>
                        </div>
                        
                        {sensor.lastReading ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-2xl font-bold text-gray-900">
                                {sensor.lastReading.value.toFixed(1)}
                                <span className="text-sm text-gray-500 ml-1">
                                  {sensor.type === 'temperature' ? '°C' : 
                                   sensor.type === 'humidity' ? '%' : 
                                   sensor.type === 'pressure' ? 'hPa' : ''}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-400">
                                  {t('sensors.lastUpdate', 'Dernière mise à jour')}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {sensor.lastReading.timestamp.toLocaleDateString('fr-FR', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              </div>
                            </div>
                            
                            {/* Status indicator */}
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">
                                {t('sensors.status', 'Statut')}:
                              </span>
                              <span className={`font-medium ${
                                sensor.status === 'online' ? 'text-green-600' : 
                                sensor.status === 'offline' ? 'text-gray-500' : 'text-red-600'
                              }`}>
                                {sensor.status === 'online' ? t('sensors.online', 'En ligne') :
                                 sensor.status === 'offline' ? t('sensors.offline', 'Hors ligne') :
                                 t('sensors.error', 'Erreur')}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <div className="text-sm text-gray-400 italic">
                              {t('sensors.noData', 'Aucune donnée disponible')}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('clientSensors.noSensors', 'Aucun capteur trouvé')}
              </h3>
              <p className="text-gray-500">
                {t('clientSensors.noSensorsDescription', 'Vous n\'avez pas encore de produits stockés dans des chambres avec des capteurs')}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClientSensorsPage;
