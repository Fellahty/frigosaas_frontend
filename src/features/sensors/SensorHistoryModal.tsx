import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, orderBy, limit } from '@/lib/db';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { useTranslation } from 'react-i18next';

interface Sensor {
  id: string;
  name: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'motion' | 'light';
  status: 'online' | 'offline' | 'error';
  lastReading?: {
    value: number;
    unit: string;
    timestamp: Date;
  };
  roomId: string;
}

interface SensorReading {
  id: string;
  sensorId: string;
  value: number;
  unit: string;
  timestamp: Date;
}

interface SensorHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sensor: Sensor;
}

export const SensorHistoryModal: React.FC<SensorHistoryModalProps> = ({ isOpen, onClose, sensor }) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Mock data for demonstration
  const generateMockData = (sensorType: string, hours: number) => {
    const data: SensorReading[] = [];
    const now = new Date();
    const baseValue = sensor.lastReading?.value || 20;
    
    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      let value = baseValue;
      
      // Generate realistic data based on sensor type
      switch (sensorType) {
        case 'temperature':
          value = baseValue + (Math.sin(i / 4) * 2) + (Math.random() - 0.5) * 0.5;
          break;
        case 'humidity':
          value = baseValue + (Math.sin(i / 6) * 10) + (Math.random() - 0.5) * 5;
          break;
        case 'pressure':
          value = baseValue + (Math.sin(i / 8) * 5) + (Math.random() - 0.5) * 2;
          break;
        case 'motion':
          value = Math.random() > 0.8 ? 1 : 0;
          break;
        case 'light':
          value = Math.max(0, baseValue + (Math.sin(i / 12) * 50) + (Math.random() - 0.5) * 20);
          break;
      }
      
      data.push({
        id: `reading-${i}`,
        sensorId: sensor.id,
        value: Math.round(value * 100) / 100,
        unit: sensor.lastReading?.unit || 'unit',
        timestamp
      });
    }
    
    return data;
  };

  const mockData = generateMockData(sensor.type, timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720);

  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'temperature':
        return '🌡️';
      case 'humidity':
        return '💧';
      case 'pressure':
        return '📊';
      case 'motion':
        return '👁️';
      case 'light':
        return '💡';
      default:
        return '📡';
    }
  };

  const getSensorTypeLabel = (type: string) => {
    switch (type) {
      case 'temperature':
        return t('sensors.temperature');
      case 'humidity':
        return t('sensors.humidity');
      case 'pressure':
        return t('sensors.pressure');
      case 'motion':
        return t('sensors.motion');
      case 'light':
        return t('sensors.light');
      default:
        return 'Inconnu';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600 bg-green-100';
      case 'offline':
        return 'text-gray-600 bg-gray-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online':
        return t('sensors.online');
      case 'offline':
        return t('sensors.offline');
      case 'error':
        return t('sensors.error');
      default:
        return 'Inconnu';
    }
  };

  const getMinMaxValues = () => {
    const values = mockData.map(d => d.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length
    };
  };

  const stats = getMinMaxValues();

  // Simple chart component
  const SimpleChart = () => {
    const width = typeof window !== 'undefined' ? Math.min(window.innerWidth - 100, 400) : 400;
    const height = 200;
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const minValue = stats.min;
    const maxValue = stats.max;
    const valueRange = maxValue - minValue || 1;

    const points = mockData.map((point, index) => {
      const x = padding + (index / (mockData.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="w-full">
        <svg width={width} height={height} className="w-full h-48">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={padding}
              y1={padding + ratio * chartHeight}
              x2={width - padding}
              y2={padding + ratio * chartHeight}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}
          
          {/* Chart line */}
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={points}
          />
          
          {/* Data points */}
          {mockData.map((point, index) => {
            const x = padding + (index / (mockData.length - 1)) * chartWidth;
            const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
            return (
              <circle
                key={point.id}
                cx={x}
                cy={y}
                r="3"
                fill="#3b82f6"
                className="hover:r-4 transition-all"
              />
            );
          })}
        </svg>
        
        {/* Y-axis labels */}
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{maxValue.toFixed(1)} {sensor.lastReading?.unit}</span>
          <span>{minValue.toFixed(1)} {sensor.lastReading?.unit}</span>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 w-full max-w-4xl max-h-[98vh] sm:max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100/50 flex-shrink-0">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-xl sm:text-2xl">{getSensorIcon(sensor.type)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight truncate">{sensor.name}</h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">{getSensorTypeLabel(sensor.type)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Reload Button */}
            <button
              onClick={() => window.location.reload()}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition-colors"
              title="Actualiser"
            >
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              title="Fermer"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto min-h-0">
          {/* Compact Status and Current Reading - Mobile Optimized */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
              <div className="text-xs text-gray-600 mb-1">{t('sensors.status')}</div>
              <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sensor.status)}`}>
                {getStatusLabel(sensor.status)}
              </div>
            </div>
            
            {sensor.lastReading && (
              <>
                <div className="bg-blue-50 rounded-lg p-2 sm:p-3">
                  <div className="text-xs text-blue-600 mb-1">{t('sensors.lastReading')}</div>
                  <div className="text-lg sm:text-xl font-bold text-blue-900">
                    {sensor.lastReading.value} {sensor.lastReading.unit}
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-2 sm:p-3 col-span-2 sm:col-span-1">
                  <div className="text-xs text-gray-600 mb-1">{t('sensors.time')}</div>
                  <div className="text-sm sm:text-base font-semibold text-gray-900">
                    {sensor.lastReading.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Compact Time Range Selector - Mobile Optimized */}
          <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
            {(['1h', '24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === '1h' ? '1h' : 
                 range === '24h' ? '24h' : 
                 range === '7d' ? '7j' : '30j'}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{t('sensors.history')}</h3>
            <SimpleChart />
          </div>

          {/* Compact Statistics - Mobile Optimized */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-green-50 rounded-lg p-2 sm:p-3">
              <div className="text-xs text-green-600 mb-1">{t('sensors.minValue')}</div>
              <div className="text-lg sm:text-xl font-bold text-green-900">
                {stats.min.toFixed(1)} {sensor.lastReading?.unit}
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-2 sm:p-3">
              <div className="text-xs text-blue-600 mb-1">{t('sensors.avgValue')}</div>
              <div className="text-lg sm:text-xl font-bold text-blue-900">
                {stats.avg.toFixed(1)} {sensor.lastReading?.unit}
              </div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-2 sm:p-3">
              <div className="text-xs text-red-600 mb-1">{t('sensors.maxValue')}</div>
              <div className="text-lg sm:text-xl font-bold text-red-900">
                {stats.max.toFixed(1)} {sensor.lastReading?.unit}
              </div>
            </div>
          </div>

          {/* Recent Readings Table */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">{t('sensors.recentReadings')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-xs sm:text-sm font-medium text-gray-600">{t('sensors.time')}</th>
                    <th className="text-left py-2 text-xs sm:text-sm font-medium text-gray-600">{t('sensors.value')}</th>
                    <th className="text-left py-2 text-xs sm:text-sm font-medium text-gray-600">{t('sensors.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {mockData.slice(-10).reverse().map((reading) => (
                    <tr key={reading.id} className="border-b border-gray-100">
                      <td className="py-2 text-xs sm:text-sm text-gray-900">
                        {reading.timestamp.toLocaleString()}
                      </td>
                      <td className="py-2 text-xs sm:text-sm font-medium text-gray-900">
                        {reading.value} {reading.unit}
                      </td>
                      <td className="py-2">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {t('sensors.statusOk')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
