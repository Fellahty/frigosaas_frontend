import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import jsPDF from 'jspdf';
import * as SunCalc from 'suncalc';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

// Utility function to calculate time ago
const getTimeAgo = (timestamp: Date): string => {
  // Validate that timestamp is a valid Date object
  if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
    return '-'; // Return dash for invalid dates
  }
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `il y a ${diffInSeconds} seconde${diffInSeconds > 1 ? 's' : ''}`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `il y a ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''}`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `il y a ${diffInHours} heure${diffInHours > 1 ? 's' : ''}`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `il y a ${diffInWeeks} semaine${diffInWeeks > 1 ? 's' : ''}`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  return `il y a ${diffInMonths} mois`;
};

interface SensorData {
  timestamp: number;
  temperature: number;
  humidity: number;
  battery: number;
  magnet: number; // 0 = open, 1 = closed (magnet sensor: false=open, true=closed)
}

interface SensorChartProps {
  sensorId: string;
  sensorName: string;
  roomName?: string; // Add room name for API (used for fetching data)
  displayRoomName?: string; // Display room name (for UI display purposes)
  boitieDeviceId?: string;
  isOpen: boolean;
  onClose: () => void;
  availableChambers?: Array<{
    id: string;
    name: string;
    channelNumber: number;
    boitieDeviceId?: string;
    athGroupNumber?: number;
  }>;
}

const SensorChart: React.FC<SensorChartProps> = ({ sensorId, sensorName, roomName, displayRoomName, boitieDeviceId, isOpen, onClose, availableChambers = [] }) => {
  const [data, setData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
  // Comparison mode state
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedChambers, setSelectedChambers] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<{ [chamberId: string]: SensorData[] }>({});
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [collapsedFrigos, setCollapsedFrigos] = useState<Set<number>>(new Set());
  
  // Cache for storing sensor data
  const [cache, setCache] = useState<Map<string, { data: SensorData[], timestamp: number }>>(new Map());
  
  // Date range state - default to last 30 minutes
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: new Date(now.getTime() - 30 * 60 * 1000).toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      type: '30min'
    };
  });

  const [chartKey, setChartKey] = useState(0); // For forcing chart re-render on resize
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showOutdoorData, setShowOutdoorData] = useState(false);
  const [outdoorData, setOutdoorData] = useState<SensorData[]>([]);
  const [outdoorLoading, setOutdoorLoading] = useState(false);
  
  // Refs for chart containers (for PDF export)
  const temperatureChartRef = useRef<HTMLDivElement>(null);
  const humidityChartRef = useRef<HTMLDivElement>(null);

  // Cache duration constant
  const CACHE_DURATION = 30000; // 30 seconds cache
  
  // Function to fetch outdoor weather data (historical)
  const fetchOutdoorWeatherData = useCallback(async () => {
    setOutdoorLoading(true);
    try {
      // Midelt, Morocco coordinates
      const lat = 32.6852;
      const lng = -4.7371;
      
      // Calculate time range based on dateRange
      let start: Date, end: Date;
      
      if (dateRange.type === '30min') {
        end = new Date();
        start = new Date(end.getTime() - 30 * 60 * 1000);
      } else if (dateRange.type === '1h') {
        end = new Date();
        start = new Date(end.getTime() - 60 * 60 * 1000);
      } else if (dateRange.type === '6h') {
        end = new Date();
        start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
      } else if (dateRange.type === '12h') {
        end = new Date();
        start = new Date(end.getTime() - 12 * 60 * 60 * 1000);
      } else if (dateRange.type === '24h') {
        end = new Date();
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      } else if (dateRange.type === '7d') {
        end = new Date();
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange.type === '30d') {
        end = new Date();
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        start = new Date(dateRange.start);
        start.setHours(0, 0, 0, 0);
        end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
      }
      
      // Format dates for Open-Meteo API (YYYY-MM-DD)
      const startDate = start.toISOString().split('T')[0];
      const endDate = end.toISOString().split('T')[0];
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      console.log(`🌤️ [SensorChart] Fetching outdoor weather data`);
      console.log(`📅 Start: ${startDate}, End: ${endDate}, Today: ${today}`);
      console.log(`⏰ Time Range Type: ${dateRange.type}`);
      
      // Calculate days back from today
      const daysBack = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const daysForward = Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`📊 Days back: ${daysBack}, Days forward: ${daysForward}`);
      
      let apiUrl: string;
      
      // Open-Meteo Archive API only has data up to 2 days ago
      // Forecast API has past 92 days + 16 days forecast
      const needsArchive = daysBack > 92;
      
      if (needsArchive) {
        // Use archive API for data older than 92 days
        apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relative_humidity_2m&timezone=auto`;
        console.log(`📚 [SensorChart] Using ARCHIVE API (data > 92 days old)`);
      } else {
        // Use forecast API which includes past 92 days + 16 days forecast
        const pastDays = Math.max(daysBack + 1, 7); // Ensure we get enough past data
        const forecastDays = Math.max(daysForward + 1, 7); // Include forecast if showing future dates
        
        apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m&past_days=${pastDays}&forecast_days=${forecastDays}&timezone=auto`;
        console.log(`📊 [SensorChart] Using FORECAST API with past_days=${pastDays}, forecast_days=${forecastDays}`);
      }
      
      console.log(`🌐 [SensorChart] Weather API URL:`, apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error: ${response.status}`, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const weatherData = await response.json();
      console.log(`✅ [SensorChart] Weather API Response:`, weatherData);
      
      if (!weatherData.hourly || !weatherData.hourly.time) {
        console.warn('⚠️ [SensorChart] No outdoor weather data available in response');
        alert('Pas de données météo disponibles pour cette période');
        return;
      }
      
      console.log(`📊 [SensorChart] Received ${weatherData.hourly.time.length} weather data points`);
      
      // Convert to SensorData format
      const outdoorSensorData: SensorData[] = weatherData.hourly.time.map((time: string, index: number) => ({
        timestamp: new Date(time).getTime(),
        temperature: weatherData.hourly.temperature_2m[index] || 0,
        humidity: weatherData.hourly.relative_humidity_2m[index] || 0,
        battery: 0,
        magnet: 1 // Default closed for outdoor data
      }));
      
      console.log(`📊 [SensorChart] Converted ${outdoorSensorData.length} raw weather data points`);
      
      // For short time ranges, expand the window to show more context
      // For longer ranges, use exact time range
      let filterStart = start.getTime();
      let filterEnd = end.getTime();
      let expandedWindow = false;
      
      if (dateRange.type === '30min' || dateRange.type === '1h') {
        // For very short ranges, include ±6 hours of data
        filterStart = start.getTime() - (6 * 60 * 60 * 1000);
        filterEnd = end.getTime() + (6 * 60 * 60 * 1000);
        expandedWindow = true;
        console.log(`📊 [SensorChart] Expanding filter window for short range (±6 hours)`);
      } else if (dateRange.type === '6h' || dateRange.type === '12h') {
        // For medium ranges, include ±3 hours for context
        filterStart = start.getTime() - (3 * 60 * 60 * 1000);
        filterEnd = end.getTime() + (3 * 60 * 60 * 1000);
        expandedWindow = true;
        console.log(`📊 [SensorChart] Expanding filter window for medium range (±3 hours)`);
      } else {
        // For long ranges (24h, 7d, 30d), use exact range
        console.log(`📊 [SensorChart] Using exact time range for long period`);
      }
      
      // Filter data based on time range
      const filteredData = outdoorSensorData.filter(d => 
        d.timestamp >= filterStart && d.timestamp <= filterEnd
      );
      
      console.log(`✅ [SensorChart] Filtered to ${filteredData.length} outdoor weather data points for chart`);
      console.log(`📊 [SensorChart] Original range: ${new Date(start).toLocaleString()} to ${new Date(end).toLocaleString()}`);
      if (expandedWindow) {
        console.log(`📊 [SensorChart] Expanded range: ${new Date(filterStart).toLocaleString()} to ${new Date(filterEnd).toLocaleString()}`);
      }
      
      if (filteredData.length === 0) {
        console.warn('⚠️ [SensorChart] No outdoor data in selected time range');
        alert('Aucune donnée météo trouvée pour cette période');
        return;
      }
      
      setOutdoorData(filteredData);
      setShowOutdoorData(true);
      
      console.log(`✅ [SensorChart] Successfully loaded outdoor weather data`);
      console.log(`🌡️ Temperature range: ${Math.min(...filteredData.map(d => d.temperature)).toFixed(1)}°C - ${Math.max(...filteredData.map(d => d.temperature)).toFixed(1)}°C`);
      console.log(`💧 Humidity range: ${Math.min(...filteredData.map(d => d.humidity)).toFixed(0)}% - ${Math.max(...filteredData.map(d => d.humidity)).toFixed(0)}%`);
      
    } catch (error) {
      console.error('❌ [SensorChart] Error fetching outdoor weather:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      alert(`Erreur lors du chargement des données météo extérieures: ${errorMessage}`);
    } finally {
      setOutdoorLoading(false);
    }
  }, [dateRange]);
  
  // Function to fetch data for a specific chamber
  const fetchChamberData = useCallback(async (chamber: { id: string; name: string; channelNumber: number; boitieDeviceId?: string; athGroupNumber?: number }) => {
    console.log(`🔄 [SensorChart] Fetching data for chamber: ${chamber.name}`);
    
    try {
    // Check if this is the current sensor - if so, reuse the existing data
    const isCurrentSensor = chamber.name === sensorName || chamber.id === sensorId;
    
    if (isCurrentSensor && data.length > 0) {
      console.log(`📦 [SensorChart] Reusing existing data for current chamber: ${chamber.name}`);
        return data;
      }
      
      // Check cache first
      const cacheKey = `${chamber.id}-${dateRange.start}-${dateRange.end}-${dateRange.type}`;
      const cached = cache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp < CACHE_DURATION)) {
        console.log(`📦 [SensorChart] Using cached data for ${chamber.name}`);
        return cached.data;
      }
      
      // Fetch from API
      const deviceId = chamber.boitieDeviceId || boitieDeviceId;
      if (!deviceId) {
        console.error(`❌ [SensorChart] No device ID for chamber ${chamber.name}`);
        return [];
      }
      
      // Calculate time range
      let start: Date, end: Date;
      
      if (dateRange.type === '30min') {
        end = new Date();
        start = new Date(end.getTime() - 30 * 60 * 1000);
      } else if (dateRange.type === '1h') {
        end = new Date();
        start = new Date(end.getTime() - 60 * 60 * 1000);
      } else if (dateRange.type === '6h') {
        end = new Date();
        start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
      } else if (dateRange.type === '12h') {
        end = new Date();
        start = new Date(end.getTime() - 12 * 60 * 60 * 1000);
      } else if (dateRange.type === '24h') {
        end = new Date();
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      } else if (dateRange.type === '7d') {
        end = new Date();
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        start = new Date(dateRange.start);
        start.setHours(0, 0, 0, 0);
        end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
      }
      
      // Format dates for API
      const formatDate = (date: Date) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
      };
      
      const startStr = encodeURIComponent(formatDate(start));
      const endStr = encodeURIComponent(formatDate(end));
      const roomStr = encodeURIComponent(chamber.name);
      
      const apiUrl = `https://api.frigosmart.com/rooms/history?device_id=${deviceId}&room=${roomStr}&start=${startStr}&end=${endStr}`;
      
      console.log(`🌐 [SensorChart] Fetching data for ${chamber.name} from API`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const rawData = await response.json();
      
      if (!rawData.data || rawData.data.length === 0) {
        console.warn(`⚠️ [SensorChart] No data for chamber ${chamber.name}`);
        return [];
      }
      
      // Convert API response to SensorData format (raw data)
      const processedData: SensorData[] = rawData.data.map((item: any) => {
        const rawTemp = parseFloat(item.temperature) || 0;
        const rawHum = parseFloat(item.humidity) || 0;
        
        // Use raw data without calibration
        return {
          timestamp: item.epoch * 1000,
          temperature: rawTemp,
          humidity: rawHum,
          battery: 0,
          magnet: item.magnet === true ? 1 : 0
        };
      });
      
      // Sort by timestamp
      processedData.sort((a, b) => a.timestamp - b.timestamp);
      
      // Cache the result
      cache.set(cacheKey, { data: processedData, timestamp: now });
      
      console.log(`✅ [SensorChart] Fetched ${processedData.length} points for ${chamber.name}`);
      return processedData;
      
    } catch (error) {
      console.error(`❌ [SensorChart] Error fetching data for ${chamber.name}:`, error);
      return [];
    }
  }, [data, sensorName, sensorId, dateRange, cache, CACHE_DURATION, boitieDeviceId]);
  
  // Function to toggle chamber selection
  const toggleChamberSelection = useCallback(async (chamber: { id: string; name: string; channelNumber: number; boitieDeviceId?: string; athGroupNumber?: number }) => {
    const isSelected = selectedChambers.includes(chamber.id);
    
    if (isSelected) {
      // Remove chamber from selection
      console.log(`➖ [SensorChart] Removing chamber from comparison: ${chamber.name}`);
      setSelectedChambers(prev => prev.filter(id => id !== chamber.id));
      setComparisonData(prev => {
        const newData = { ...prev };
        delete newData[chamber.id];
        return newData;
      });
    } else {
      // Add chamber to selection
      console.log(`➕ [SensorChart] Adding chamber to comparison: ${chamber.name}`);
      setSelectedChambers(prev => [...prev, chamber.id]);
      setComparisonLoading(true);
      
      try {
        const chamberData = await fetchChamberData(chamber);
      setComparisonData(prev => ({
        ...prev,
          [chamber.id]: chamberData
        }));
      } finally {
        setComparisonLoading(false);
      }
    }
  }, [selectedChambers, fetchChamberData]);
  
  // Function to toggle FRIGO group collapse/expand
  const toggleFrigoCollapse = useCallback((frigoNumber: number) => {
    setCollapsedFrigos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(frigoNumber)) {
        newSet.delete(frigoNumber);
    } else {
        newSet.add(frigoNumber);
      }
      return newSet;
    });
  }, []);
  
  // Function to export data to Excel
  const exportToExcel = useCallback(() => {
    try {
      const dataToExport = comparisonMode && Object.keys(comparisonData).length > 0 
        ? comparisonData 
        : { [sensorName]: data };
      
      const workbook = XLSX.utils.book_new();
      
      // Add a summary sheet
      const summaryData = [
        ['Rapport de Données des Capteurs'],
        ['Date d\'export:', new Date().toLocaleString('fr-FR')],
        ['Période:', `${dateRange.start} - ${dateRange.end}`],
        ['Type:', dateRange.type],
        [],
        ['Chambre', 'Points de données', 'Température Moy.', 'Température Min', 'Température Max', 'Humidité Moy.']
      ];
      
      Object.entries(dataToExport).forEach(([chamberId, chamberData]) => {
        const chamber = availableChambers.find(c => c.id === chamberId);
        const chamberName = chamber?.name || chamberId;
        
        if (chamberData.length > 0) {
          const avgTemp = chamberData.reduce((sum, d) => sum + d.temperature, 0) / chamberData.length;
          const minTemp = Math.min(...chamberData.map(d => d.temperature));
          const maxTemp = Math.max(...chamberData.map(d => d.temperature));
          const avgHum = chamberData.reduce((sum, d) => sum + d.humidity, 0) / chamberData.length;
          
          summaryData.push([
            chamberName,
            chamberData.length.toString(),
            avgTemp.toFixed(1) + '°C',
            minTemp.toFixed(1) + '°C',
            maxTemp.toFixed(1) + '°C',
            avgHum.toFixed(1) + '%'
          ]);
        }
      });
      
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWs, 'Résumé');
      
      // Add detailed data sheets for each chamber
      Object.entries(dataToExport).forEach(([chamberId, chamberData]) => {
        const chamber = availableChambers.find(c => c.id === chamberId);
        const chamberName = chamber?.name || chamberId;
        
        const detailedData = [
          ['Date/Heure', 'Température (°C)', 'Humidité (%)', 'Batterie (V)'],
          ...chamberData.map(d => [
            new Date(d.timestamp).toLocaleString('fr-FR'),
            d.temperature.toFixed(1),
            d.humidity.toFixed(1),
            d.battery > 0 ? d.battery.toFixed(1) : 'N/A'
          ])
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(detailedData);
        const sheetName = chamberName.substring(0, 31); // Excel sheet name limit
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
      });
      
      // Generate filename
      const filename = `donnees_capteurs_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Save file
      XLSX.writeFile(workbook, filename);
      
      console.log('✅ [SensorChart] Excel file exported successfully');
    } catch (error) {
      console.error('❌ [SensorChart] Error exporting to Excel:', error);
      alert('Erreur lors de l\'export Excel');
    }
  }, [comparisonMode, comparisonData, data, sensorName, dateRange, availableChambers]);
  
  // Function to export data to PDF with chart screenshots
  const exportToPDF = useCallback(async () => {
    try {
      const pdf = new jsPDF();
      const dataToExport = comparisonMode && Object.keys(comparisonData).length > 0 
        ? comparisonData 
        : { [sensorName]: data };
      
      let yPos = 15;
      
      // Title - compact
      pdf.setFontSize(14);
      pdf.text('Rapport de Données des Capteurs', 105, yPos, { align: 'center' });
      yPos += 8;
      
      // Metadata - very compact
      pdf.setFontSize(8);
      pdf.text(`Export: ${new Date().toLocaleDateString('fr-FR')} | Période: ${dateRange.start} - ${dateRange.end} | Type: ${dateRange.type}`, 20, yPos);
      yPos += 8;
      
      // Summary for each chamber - compact format
      pdf.setFontSize(9);
      Object.entries(dataToExport).forEach(([chamberId, chamberData]) => {
        const chamber = availableChambers.find(c => c.id === chamberId);
        const chamberName = chamber?.name || chamberId;
        
        if (chamberData.length > 0) {
          const avgTemp = chamberData.reduce((sum, d) => sum + d.temperature, 0) / chamberData.length;
          const minTemp = Math.min(...chamberData.map(d => d.temperature));
          const maxTemp = Math.max(...chamberData.map(d => d.temperature));
          const avgHum = chamberData.reduce((sum, d) => sum + d.humidity, 0) / chamberData.length;
          
          // Compact single-line format
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(chamberName, 20, yPos);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          yPos += 4;
          pdf.text(`${chamberData.length} pts | Temp: ${avgTemp.toFixed(1)}°C (${minTemp.toFixed(1)}-${maxTemp.toFixed(1)}°C) | Hum: ${avgHum.toFixed(1)}%`, 20, yPos);
          yPos += 6;
        }
      });
      
      yPos += 5;
      
      // Add charts title - compact
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Graphiques', 105, yPos, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      yPos += 6;
      
      // Capture and add temperature chart - very compact
      if (temperatureChartRef.current) {
        try {
          const tempCanvas = await html2canvas(temperatureChartRef.current, {
            scale: 1,
            backgroundColor: '#ffffff',
            logging: false
          });
          const tempImgData = tempCanvas.toDataURL('image/png');
          
          // Add temperature chart - very compact
          pdf.setFontSize(9);
          pdf.text('Température', 20, yPos);
          yPos += 4;
          
          const imgWidth = 170; // PDF width minus margins
          const maxImgHeight = 70; // Reduced height for compact layout
          let imgHeight = (tempCanvas.height * imgWidth) / tempCanvas.width;
          
          // If calculated height is too large, scale down to max height
          if (imgHeight > maxImgHeight) {
            imgHeight = maxImgHeight;
          }
          
          pdf.addImage(tempImgData, 'PNG', 20, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 5;
          
          console.log('✅ [SensorChart] Temperature chart captured');
        } catch (error) {
          console.error('❌ [SensorChart] Error capturing temperature chart:', error);
        }
      }
      
      // Capture and add humidity chart - very compact
      if (humidityChartRef.current) {
        try {
          const humCanvas = await html2canvas(humidityChartRef.current, {
            scale: 1,
            backgroundColor: '#ffffff',
            logging: false
          });
          const humImgData = humCanvas.toDataURL('image/png');
          
          // Add humidity chart - very compact
          pdf.setFontSize(9);
          pdf.text('Humidité', 20, yPos);
          yPos += 4;
          
          const imgWidth = 170;
          const maxImgHeight = 70; // Reduced height for compact layout
          let imgHeight = (humCanvas.height * imgWidth) / humCanvas.width;
          
          // If calculated height is too large, scale down to max height
          if (imgHeight > maxImgHeight) {
            imgHeight = maxImgHeight;
          }
          
          pdf.addImage(humImgData, 'PNG', 20, yPos, imgWidth, imgHeight);
          
          console.log('✅ [SensorChart] Humidity chart captured');
        } catch (error) {
          console.error('❌ [SensorChart] Error capturing humidity chart:', error);
        }
      }
      
      // Generate filename
      const filename = `donnees_capteurs_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Save PDF
      pdf.save(filename);
      
      console.log('✅ [SensorChart] PDF with charts exported successfully');
    } catch (error) {
      console.error('❌ [SensorChart] Error exporting to PDF:', error);
      alert('Erreur lors de l\'export PDF');
    }
  }, [comparisonMode, comparisonData, data, sensorName, dateRange, availableChambers]);
  
  // Function to share via WhatsApp
  const shareViaWhatsApp = useCallback((format: 'text' | 'excel' | 'pdf') => {
    const dataToExport = comparisonMode && Object.keys(comparisonData).length > 0 
      ? comparisonData 
      : { [sensorName]: data };
    
    if (format === 'text') {
      // Create text summary
      let message = `📊 *Rapport de Données des Capteurs*\n\n`;
      message += `📅 Date: ${new Date().toLocaleString('fr-FR')}\n`;
      message += `📆 Période: ${dateRange.start} - ${dateRange.end}\n\n`;
      
      Object.entries(dataToExport).forEach(([chamberId, chamberData]) => {
        const chamber = availableChambers.find(c => c.id === chamberId);
        const chamberName = chamber?.name || chamberId;
        
        if (chamberData.length > 0) {
          const avgTemp = chamberData.reduce((sum, d) => sum + d.temperature, 0) / chamberData.length;
          const avgHum = chamberData.reduce((sum, d) => sum + d.humidity, 0) / chamberData.length;
          
          message += `🏠 *${chamberName}*\n`;
          message += `   🌡️ Température: ${avgTemp.toFixed(1)}°C\n`;
          message += `   💧 Humidité: ${avgHum.toFixed(1)}%\n`;
          message += `   📊 Points: ${chamberData.length}\n\n`;
        }
      });
      
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    } else if (format === 'excel') {
      exportToExcel();
      // Note: WhatsApp web doesn't support file sharing directly
      alert('Fichier Excel téléchargé. Vous pouvez maintenant le partager via WhatsApp.');
    } else if (format === 'pdf') {
      exportToPDF();
      alert('Fichier PDF téléchargé. Vous pouvez maintenant le partager via WhatsApp.');
    }
  }, [comparisonMode, comparisonData, data, sensorName, dateRange, availableChambers, exportToExcel, exportToPDF]);
  
  // Update comparison data when main data changes (for current sensor)
  useEffect(() => {
    if (comparisonMode && data.length > 0) {
      const currentChamber = availableChambers.find(c => c.name === sensorName);
      if (currentChamber && selectedChambers.includes(currentChamber.id)) {
        console.log(`📦 [SensorChart] Updating comparison data for current chamber with new data`);
        setComparisonData(prev => ({
          ...prev,
          [currentChamber.id]: data
        }));
      }
    }
  }, [data, comparisonMode, sensorName, availableChambers, selectedChambers]);

  // Extract channel number from sensor ID
  const extractChannelNumber = (sensorId: string): number | null => {
    console.log(`🔍 [SensorChart] extractChannelNumber called with sensorId: "${sensorId}", sensorName: "${sensorName}"`);
    
    // Try to extract from sensor name first (if available)
    if (sensorName && sensorName.includes('CH')) {
      console.log(`🔍 [SensorChart] Sensor name contains 'CH', attempting to extract channel number`);
      const nameMatch = sensorName.match(/CH\s*(\d+)/i);
      console.log(`🔍 [SensorChart] Name match result:`, nameMatch);
      if (nameMatch) {
        const channel = parseInt(nameMatch[1]);
        console.log(`🏠 [SensorChart] Channel extraction (from name): "${sensorName}" -> channel ${channel}`);
        return channel;
      }
    } else {
      console.log(`🔍 [SensorChart] Sensor name check failed: sensorName="${sensorName}", includes CH: ${sensorName?.includes('CH')}`);
    }
    
    // Try standard patterns
    let match = sensorId.match(/-ch(\d+)/i);
    if (match) {
      const channel = parseInt(match[1]);
      console.log(`🏠 [SensorChart] Channel extraction (pattern -ch): "${sensorId}" -> channel ${channel}`);
      return channel;
    }
    
    match = sensorId.match(/uT(\d+)R/);
    if (match) {
      const channel = parseInt(match[1]);
      console.log(`🏠 [SensorChart] Channel extraction (unified pattern): "${sensorId}" -> channel ${channel}`);
      return channel;
    }
    
    // For unified sensor IDs without clear channel info, try to map to available channels
    if (sensorId.includes('unified')) {
      // Try to extract any number and map it to channels 1-8
      match = sensorId.match(/(\d+)/);
      if (match) {
        let channel = parseInt(match[1]);
        // Map large numbers to channels 1-8
        if (channel > 8) {
          channel = ((channel - 1) % 8) + 1;
        }
        console.log(`🏠 [SensorChart] Channel extraction (unified mapping): "${sensorId}" -> channel ${channel}`);
        return channel;
      }
    }
    
    // Fallback: try to extract any number
    match = sensorId.match(/(\d+)/);
    if (match) {
      let channel = parseInt(match[1]);
      // Ensure channel is within 1-8 range
      if (channel > 8) {
        channel = ((channel - 1) % 8) + 1;
      }
      console.log(`🏠 [SensorChart] Channel extraction (fallback): "${sensorId}" -> channel ${channel}`);
      return channel;
    }
    
    console.log(`🏠 [SensorChart] Channel extraction failed: "${sensorId}" -> no channel found`);
    return 1; // Default to channel 1
  };
  
  const channelNumber = extractChannelNumber(sensorId);
  console.log(`🏠 [SensorChart] Final channel ${channelNumber} from sensorId: ${sensorId}`);

  // Function to initialize comparison mode with current chamber
  const fetchAllChambersData = useCallback(async () => {
    if (availableChambers.length <= 1) return;
    
    setComparisonLoading(true);
    console.log(`🔄 [SensorChart] Initializing comparison mode with current chamber`);
    
    try {
      // Add current chamber data to comparison
      const currentChamber = availableChambers.find(c => c.name === sensorName || c.id === sensorId);
      if (currentChamber && data.length > 0) {
        setComparisonData({
          [currentChamber.id]: data
        });
        setSelectedChambers([currentChamber.id]);
        
        // Keep the current FRIGO group expanded, collapse others
        const currentFrigoGroup = currentChamber.athGroupNumber || 1;
        const allFrigoGroups = new Set(availableChambers.map(c => c.athGroupNumber || 1));
        const collapsed = new Set<number>();
        allFrigoGroups.forEach(group => {
          if (group !== currentFrigoGroup) {
            collapsed.add(group);
          }
        });
        setCollapsedFrigos(collapsed);
        
        console.log(`✅ [SensorChart] Initialized comparison with current chamber: ${currentChamber.name} (${data.length} points)`);
        console.log(`✅ [SensorChart] Expanded FRIGO ${currentFrigoGroup}, collapsed others`);
      }
    } catch (error) {
      console.error(`❌ [SensorChart] Error initializing comparison mode:`, error);
    } finally {
      setComparisonLoading(false);
    }
  }, [availableChambers, sensorId, sensorName, data]);

  // Simple function to process chamber data
  const processChamberData = useCallback((messages: any[], channelNumber: number): SensorData[] => {
    console.log(`🔧 [SensorChart] Processing ${messages?.length || 0} messages for channel ${channelNumber}`);
    
    // Don't filter by date range - just use all messages from the API
    // The API already limits to the most recent messages
    const filteredMessages = messages;
    
    console.log(`📊 [SensorChart] Processing ${filteredMessages.length} messages`);
    
    const processedData: SensorData[] = [];
    
    for (const message of filteredMessages) {
      let sensorData: SensorData | null = null;
      
      // Log message keys to see what data is available
      if (filteredMessages.indexOf(message) === 0) {
        console.log(`📊 [SensorChart] Processing first message, available keys:`, Object.keys(message));
      }
      
      // Check if this message has beacon data
      if (message['ble.beacons'] && Array.isArray(message['ble.beacons'])) {
        const beaconArray = message['ble.beacons'];
        
        // Log all beacon IDs found in this message (only for first few messages)
        if (filteredMessages.indexOf(message) < 3) {
          console.log(`📡 [SensorChart] Found beacon data in message, looking for channel ${channelNumber}`);
          console.log(`📡 [SensorChart] All beacons in this message:`, beaconArray.map((b: any) => b.id));
        }
        
        const chamberBeacon = beaconArray.find((beacon: any) => {
          if (!beacon.id) return false;
          const beaconId = beacon.id.toLowerCase();
          
          // Only log detailed matching for first few messages to avoid spam
          if (filteredMessages.indexOf(message) < 3) {
            console.log(`🔍 [SensorChart] Checking beacon ID: "${beaconId}" for channel ${channelNumber}`);
          }
          
          const searchPatterns = [
            `chambre${channelNumber}`, `chambre ${channelNumber}`, `ch${channelNumber}`,
            `room${channelNumber}`, `room ${channelNumber}`, `c${channelNumber}`, `${channelNumber}`
          ];
          
          if (filteredMessages.indexOf(message) < 3) {
            console.log(`🔍 [SensorChart] Testing patterns:`, searchPatterns);
          }
          
          const matches = searchPatterns.some(pattern => {
            const matches = beaconId.includes(pattern);
            if (matches && filteredMessages.indexOf(message) < 3) {
              console.log(`✅ [SensorChart] Beacon "${beaconId}" matches pattern "${pattern}"`);
            }
            return matches;
          });
          
          if (!matches && filteredMessages.indexOf(message) < 3) {
            console.log(`❌ [SensorChart] Beacon "${beaconId}" does not match any pattern for channel ${channelNumber}`);
          }
          
          return matches;
        });
        
        if (chamberBeacon) {
          const magnetValue = chamberBeacon.magnet === true ? 1 : 0;
          if (filteredMessages.indexOf(message) < 3) {
            console.log(`🚪 [SensorChart] Beacon magnet value: ${chamberBeacon.magnet} -> ${magnetValue}`);
          }
          sensorData = {
            timestamp: message.timestamp * 1000,
            temperature: parseFloat(chamberBeacon.temperature) || 0,
            humidity: parseFloat(chamberBeacon.humidity) || 0,
            battery: parseFloat(chamberBeacon['battery.voltage']) || 0,
            magnet: magnetValue
          };
        }
          } else {
        // Handle regular sensor data
        const tempKey = `ble.sensor.temperature.${channelNumber}`;
        const humKey = `ble.sensor.humidity.${channelNumber}`;
        const tempValue = message[tempKey];
        const humidityValue = message[humKey];
        
        if (filteredMessages.indexOf(message) === 0) {
          console.log(`🔧 [SensorChart] Looking for keys: ${tempKey}, ${humKey}`);
          console.log(`🔧 [SensorChart] Found values: temp=${tempValue}, humidity=${humidityValue}`);
        }
        
        if (tempValue !== undefined && humidityValue !== undefined) {
          const magnetKey = `ble.sensor.magnet.status.${channelNumber}`;
          const magnetRawValue = message[magnetKey];
          const magnetValue = magnetRawValue === true ? 1 : 0;
          
          if (filteredMessages.indexOf(message) < 3) {
            console.log(`🚪 [SensorChart] Regular sensor magnet key: ${magnetKey}, raw value: ${magnetRawValue}, converted: ${magnetValue}`);
          }
          
          sensorData = {
            timestamp: message.timestamp * 1000,
            temperature: parseFloat(tempValue) || 0,
            humidity: parseFloat(humidityValue) || 0,
            battery: parseFloat(message[`ble.sensor.battery.voltage.${channelNumber}`]) || 0,
            magnet: magnetValue
          };
        }
      }
      
      if (sensorData) {
        processedData.push(sensorData);
      }
    }
    
    processedData.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`✅ [SensorChart] Processing complete:`);
    console.log(`   - Input messages: ${filteredMessages.length}`);
    console.log(`   - Processed data points: ${processedData.length}`);
    console.log(`   - Channel: ${channelNumber}`);
    console.log(`   - Returning: ${Math.min(processedData.length, 30)} points`);
    
    // Log first few data points with magnet values
    if (processedData.length > 0) {
      console.log(`🚪 [SensorChart] First 3 processed data points with magnet values:`, 
        processedData.slice(0, 3).map(d => ({
          temp: d.temperature,
          hum: d.humidity,
          magnet: d.magnet,
          time: new Date(d.timestamp).toLocaleTimeString()
        }))
      );
      
      // Count magnet states
      const magnetStats = processedData.reduce((acc, d) => {
        acc[d.magnet] = (acc[d.magnet] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      console.log(`🚪 [SensorChart] Magnet stats:`, magnetStats);
    }
    
    return processedData.slice(-30); // Limit to 30 points
    
  }, [dateRange]);

  // Main sensor data fetching function (simplified)
  const fetchSensorData = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    const cacheKey = `${sensorId}-${dateRange.start}-${dateRange.end}-${dateRange.type}`;
    
    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log('📦 [SensorChart] Using cached data:', cached.data.length, 'items');
        setData(cached.data);
        return;
      }
    }

    setLoading(true);
    setError(null);
    
    try {
      const deviceId = boitieDeviceId || '6925665';
      const room = roomName || sensorName;
      
      // Calculate time range based on selected dateRange type
      const end = new Date();
      let start = new Date();
      
      // Calculate start time based on dateRange.type
      switch (dateRange.type) {
        case '30min':
          start = new Date(end.getTime() - 30 * 60 * 1000);
          break;
        case '1h':
          start = new Date(end.getTime() - 60 * 60 * 1000);
          break;
        case '6h':
          start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
          break;
        case '12h':
          start = new Date(end.getTime() - 12 * 60 * 60 * 1000);
          break;
        case '24h':
        case '1d':
          start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          // Default to 30 minutes
          start = new Date(end.getTime() - 30 * 60 * 1000);
      }
      
      // Format dates for API (YYYY-MM-DD HH:MM)
      const formatDate = (date: Date) => {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
      };
      
      const startStr = encodeURIComponent(formatDate(start));
      const endStr = encodeURIComponent(formatDate(end));
      const roomStr = encodeURIComponent(room);
      
      // Use new history API endpoint
      const apiUrl = `https://api.frigosmart.com/rooms/history?device_id=${deviceId}&room=${roomStr}&start=${startStr}&end=${endStr}`;
      
      console.log(`🌐 [SensorChart] Fetching history from new API:`, apiUrl);
      console.log(`📊 [SensorChart] Room: ${room}, Device: ${deviceId}`);
      console.log(`📊 [SensorChart] Time Range Type: ${dateRange.type}`);
      console.log(`📊 [SensorChart] Range: ${formatDate(start)} to ${formatDate(end)}`);
      
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [SensorChart] API Error ${response.status}:`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const rawData = await response.json();
      console.log(`📊 [SensorChart] API Response:`, rawData);
      console.log(`📊 [SensorChart] Received ${rawData.count || 0} data points`);
      
      if (!rawData.data || rawData.data.length === 0) {
        console.warn('⚠️ [SensorChart] No data in API response!');
        setData([]);
        setLoading(false);
        return;
      }
      
      console.log(`📊 [SensorChart] First data sample:`, rawData.data[0]);
      console.log(`📊 [SensorChart] Normal data processing for room="${room}"`);
      
      // Convert API response to SensorData format (raw data)
      const processedData: SensorData[] = rawData.data.map((item: any) => {
        const rawTemp = parseFloat(item.temperature) || 0;
        const rawHum = parseFloat(item.humidity) || 0;
        
        // Use raw data without calibration
        return {
          timestamp: item.epoch * 1000, // Convert to milliseconds
          temperature: rawTemp,
          humidity: rawHum,
          battery: 0, // Not provided by new API
          magnet: item.magnet === true ? 1 : 0 // true = closed (1), false = open (0)
        };
      });
      
      // Sort by timestamp
      processedData.sort((a, b) => a.timestamp - b.timestamp);
      
      setData(processedData);
      console.log(`✅ [SensorChart] Processed ${processedData.length} data points`);
      if (processedData.length > 0) {
        console.log(`📊 [SensorChart] First data point:`, processedData[0]);
        console.log(`📊 [SensorChart] Last data point:`, processedData[processedData.length - 1]);
        console.log(`🔍 [SensorChart] Chart data:`);
        console.log(`   - Time range: ${new Date(processedData[0].timestamp).toLocaleString()} to ${new Date(processedData[processedData.length - 1].timestamp).toLocaleString()}`);
        console.log(`   - Temperature: ${processedData[0].temperature}°C`);
        console.log(`   - Humidity: ${processedData[0].humidity}%`);
        console.log(`   - Door: ${processedData[0].magnet === 1 ? 'CLOSED' : 'OPEN'}`);
      }

      // Cache the result
      cache.set(cacheKey, { data: processedData, timestamp: now });
      
        } catch (error) {
      console.error(`❌ [SensorChart] Error fetching sensor data:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors du chargement des données';
      setError(`Échec du chargement des données: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [sensorId, dateRange, boitieDeviceId, channelNumber, cache, processChamberData]);

  // Quick date range functions
  const setQuickRange = (days: number, type: string) => {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    setDateRange({
      start: startDate.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      type: type
      });
    };

  const setLast30Minutes = () => {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    setDateRange({
      start: thirtyMinutesAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      type: '30min'
    });
  };

  const isRangeSelected = (type: string) => dateRange.type === type;

  // Calculate KPIs from data
  const calculateKPIs = useCallback(() => {
    // Use validData for KPI calculations (filters out 0 values)
    const validDataForKPI = data.filter(d => d.temperature !== 0 && d.humidity !== 0);
    
    if (validDataForKPI.length === 0) return null;

    const temps = validDataForKPI.map(d => d.temperature);
    const humidities = validDataForKPI.map(d => d.humidity);

    // Average Temperature
    const avgTemp = temps.reduce((sum, t) => sum + t, 0) / temps.length;

    // Temperature Stability (Standard Deviation)
    const tempVariance = temps.reduce((sum, t) => sum + Math.pow(t - avgTemp, 2), 0) / temps.length;
    const tempStability = Math.sqrt(tempVariance);

    // Average Humidity
    const avgHumidity = humidities.reduce((sum, h) => sum + h, 0) / humidities.length;

    // Humidity Stability (Standard Deviation)
    const humVariance = humidities.reduce((sum, h) => sum + Math.pow(h - avgHumidity, 2), 0) / humidities.length;
    const humStability = Math.sqrt(humVariance);

    // Temperature in safe range (0-4°C)
    const tempInRange = temps.filter(t => t >= 0 && t <= 4).length;
    const tempRangePercent = (tempInRange / temps.length) * 100;

    // Humidity in optimal range (90-95%)
    const humInRange = humidities.filter(h => h >= 90 && h <= 95).length;
    const humRangePercent = (humInRange / humidities.length) * 100;

    // Min/Max values
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const minHum = Math.min(...humidities);
    const maxHum = Math.max(...humidities);

    return {
      avgTemp,
      tempStability,
      avgHumidity,
      humStability,
      tempRangePercent,
      humRangePercent,
      minTemp,
      maxTemp,
      minHum,
      maxHum,
      dataPoints: validDataForKPI.length
    };
  }, [data]);

  const kpis = calculateKPIs();

  // Calculate responsive chart dimensions and font sizes
  const getResponsiveConfig = () => {
    if (typeof window !== 'undefined') {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      // Mobile Portrait (< 640px)
      if (vw < 640) {
        return {
          height: '300px', // Fixed height for consistency
          fontSize: { base: 10, label: 8, title: 10, legend: 9 },
          symbolSize: 2,
          padding: { chart: '2', gap: '2' },
          grid: {
            left: '12%',
            right: '18%',
            bottom: '18%',
            top: '18%'
          },
          toolbox: { right: 5, top: 5, itemSize: 12 }
        };
      }
      // Tablet (640px - 1024px)
      if (vw < 1024) {
        return {
          height: Math.min(vh * 0.40, 360) + 'px',
          fontSize: { base: 11, label: 10, title: 12, legend: 11 },
          symbolSize: 3,
          padding: { chart: '3', gap: '3' },
          grid: {
            left: '10%',
            right: '16%',
            bottom: '20%',
            top: '16%'
          },
          toolbox: { right: 10, top: 10, itemSize: 14 }
        };
      }
      // Desktop (1024px - 1280px)
      if (vw < 1280) {
        return {
          height: Math.min(vh * 0.45, 400) + 'px',
          fontSize: { base: 12, label: 11, title: 13, legend: 12 },
          symbolSize: 4,
          padding: { chart: '4', gap: '4' },
          grid: {
            left: '8%',
            right: '15%',
            bottom: '22%',
            top: '15%'
          },
          toolbox: { right: 15, top: 15, itemSize: 15 }
        };
      }
      // Large desktop (> 1280px)
      return {
        height: Math.min(vh * 0.50, 450) + 'px',
        fontSize: { base: 13, label: 12, title: 14, legend: 13 },
        symbolSize: 5,
        padding: { chart: '5', gap: '5' },
        grid: {
          left: '8%',
          right: '15%',
          bottom: '22%',
          top: '15%'
        },
        toolbox: { right: 20, top: 15, itemSize: 16 }
      };
    }
    return {
      height: '360px',
      fontSize: { base: 12, label: 11, title: 13, legend: 12 },
      symbolSize: 4,
      padding: { chart: '4', gap: '4' },
      grid: {
        left: '8%',
        right: '15%',
        bottom: '22%',
        top: '15%'
      },
      toolbox: { right: 15, top: 15, itemSize: 15 }
    };
  };
  
  const responsiveConfig = getResponsiveConfig();

  // Chart colors for comparison
  const chamberColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  // Helper function to filter invalid sensor data
  const filterValidData = useCallback((chartData: SensorData[]) => {
    if (!chartData || chartData.length === 0) return chartData;
    
    const filtered = chartData.filter(point => {
      // Remove points where temperature or humidity is 0 (sensor error)
      const isValid = point.temperature !== 0 && point.humidity !== 0;
      return isValid;
    });
    
    const removed = chartData.length - filtered.length;
    if (removed > 0) {
      console.log(`🧹 [SensorChart] Filtered out ${removed} invalid data points (temp=0 or humidity=0)`);
    }
    
    return filtered;
  }, []);

  // Helper function to aggregate/downsample data for better visualization
  const aggregateData = useCallback((chartData: SensorData[], intervalMinutes: number) => {
    if (!chartData || chartData.length === 0) return chartData;
    
    // If data is already small, no need to aggregate
    if (chartData.length <= 100) return chartData;
    
    const intervalMs = intervalMinutes * 60 * 1000;
    const aggregated: SensorData[] = [];
    const groups: { [key: number]: SensorData[] } = {};
    
    // Group data by time intervals
    chartData.forEach(point => {
      const bucketTime = Math.floor(point.timestamp / intervalMs) * intervalMs;
      if (!groups[bucketTime]) {
        groups[bucketTime] = [];
      }
      groups[bucketTime].push(point);
    });
    
    // Calculate averages for each bucket
    Object.keys(groups).sort((a, b) => Number(a) - Number(b)).forEach(bucketTime => {
      const bucket = groups[Number(bucketTime)];
      
      // Filter valid values only for averaging
      const validTemps = bucket.filter(p => p.temperature !== 0).map(p => p.temperature);
      const validHums = bucket.filter(p => p.humidity !== 0).map(p => p.humidity);
      
      // Skip bucket if no valid data
      if (validTemps.length === 0 || validHums.length === 0) return;
      
      const avgTemp = validTemps.reduce((sum, t) => sum + t, 0) / validTemps.length;
      const avgHum = validHums.reduce((sum, h) => sum + h, 0) / validHums.length;
      const avgBattery = bucket.reduce((sum, p) => sum + p.battery, 0) / bucket.length;
      
      // For magnet, use the most common value in the bucket (mode)
      const magnetCounts = bucket.reduce((acc, p) => {
        acc[p.magnet] = (acc[p.magnet] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      const magnetMode = Object.entries(magnetCounts).sort((a, b) => b[1] - a[1])[0][0];
      
      aggregated.push({
        timestamp: Number(bucketTime),
        temperature: Number(avgTemp.toFixed(2)),
        humidity: Number(avgHum.toFixed(1)),
        battery: Number(avgBattery.toFixed(2)),
        magnet: Number(magnetMode)
      });
    });
    
    console.log(`📊 [SensorChart] Aggregated ${chartData.length} points to ${aggregated.length} points (${intervalMinutes}min intervals)`);
    return aggregated;
  }, []);

  // Determine aggregation interval based on date range
  const getAggregationInterval = (rangeType: string) => {
    switch (rangeType) {
      case '30min':
      case '1h':
        return 0; // No aggregation
      case '6h':
        return 5; // 5 min intervals
      case '12h':
        return 10; // 10 min intervals
      case '24h':
      case '1d':
        return 10; // 10 min intervals
      case '7d':
        return 60; // 1 hour intervals
      case '30d':
        return 240; // 4 hour intervals
      default:
        return 0;
    }
  };

  // Filter invalid data first, then apply aggregation
  const validData = filterValidData(data);
  const aggregationInterval = getAggregationInterval(dateRange.type);
  const processedData = aggregationInterval > 0 ? aggregateData(validData, aggregationInterval) : validData;

  // Helper function to create door state markAreas
  const createDoorMarkAreas = (chartData: SensorData[]) => {
    if (!chartData || chartData.length === 0) return [];
    
    const markAreas: any[] = [];
    let openStart: number | null = null;
    
    for (let i = 0; i < chartData.length; i++) {
      const current = chartData[i];
      const isOpen = current.magnet === 0; // 0 = open
      
      if (isOpen && openStart === null) {
        // Start of open period
        openStart = current.timestamp;
      } else if (!isOpen && openStart !== null) {
        // End of open period
        markAreas.push({
          xAxis: openStart,
          xAxisEnd: current.timestamp
        });
        openStart = null;
      }
    }
    
    // Handle case where door is still open at the end
    if (openStart !== null && chartData.length > 0) {
      markAreas.push({
        xAxis: openStart,
        xAxisEnd: chartData[chartData.length - 1].timestamp
      });
    }
    
    return markAreas;
  };

  // Helper function to create door state change markLines
  const createDoorMarkLines = (chartData: SensorData[]) => {
    if (!chartData || chartData.length <= 1) return [];
    
    const markLines: any[] = [];
    
    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1];
      const current = chartData[i];
      
      // Detect state change
      if (prev.magnet !== current.magnet) {
        const isOpening = current.magnet === 0;
        markLines.push({
          xAxis: current.timestamp,
          lineStyle: {
            color: isOpening ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)',
            width: 1,
            type: 'dashed'
          },
          label: {
            show: false
          }
        });
      }
    }
    
    return markLines;
  };

  // Helper function to create day/night visualization using SunCalc
  const createDayNightMarkAreas = (chartData: SensorData[]) => {
    if (!chartData || chartData.length === 0) return [];
    
    const markAreas: any[] = [];
    const startTime = chartData[0].timestamp;
    const endTime = chartData[chartData.length - 1].timestamp;
    
    // Only show day/night for ranges > 6h
    const timeRange = endTime - startTime;
    const hours = timeRange / (1000 * 60 * 60);
    if (hours < 6) return [];
    
    // Midelt, Morocco coordinates
    const MIDELT_LAT = 32.6852;
    const MIDELT_LNG = -4.7371;
    
    // Start from the beginning of the first day
    let currentTime = new Date(startTime);
    currentTime.setHours(0, 0, 0, 0);
    
    while (currentTime.getTime() < endTime) {
      const times = SunCalc.getTimes(currentTime, MIDELT_LAT, MIDELT_LNG);
      const sunset = times.sunset;
      
      // Calculate next day's sunrise
      const nextDay = new Date(currentTime);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextTimes = SunCalc.getTimes(nextDay, MIDELT_LAT, MIDELT_LNG);
      const nextSunrise = nextTimes.sunrise;
      
      // Add night period (sunset to next sunrise)
      if (sunset.getTime() >= startTime && sunset.getTime() <= endTime) {
        markAreas.push({
          xAxis: sunset.getTime(),
          xAxisEnd: Math.min(nextSunrise.getTime(), endTime)
        });
      }
      
      currentTime = nextDay;
    }
    
    console.log(`🌞🌙 [SensorChart] Created ${markAreas.length} day/night periods for Midelt, Morocco`);
    
    return markAreas;
  };

  // Helper function to create day/night transition markLines (sunrise/sunset) using SunCalc
  const createDayNightMarkLines = (chartData: SensorData[]) => {
    if (!chartData || chartData.length === 0) return [];
    
    const startTime = chartData[0].timestamp;
    const endTime = chartData[chartData.length - 1].timestamp;
    
    // Only show for ranges > 6h
    const timeRange = endTime - startTime;
    const hours = timeRange / (1000 * 60 * 60);
    if (hours < 6) return [];
    
    // Midelt, Morocco coordinates
    const MIDELT_LAT = 32.6852;
    const MIDELT_LNG = -4.7371;
    
    const markLines: any[] = [];
    let currentTime = new Date(startTime);
    currentTime.setHours(0, 0, 0, 0);
    
    while (currentTime.getTime() < endTime) {
      const times = SunCalc.getTimes(currentTime, MIDELT_LAT, MIDELT_LNG);
      const sunrise = times.sunrise;
      const sunset = times.sunset;
      
      // Add sunrise line
      if (sunrise.getTime() >= startTime && sunrise.getTime() <= endTime) {
        markLines.push({
          xAxis: sunrise.getTime(),
          lineStyle: {
            color: 'rgba(251, 191, 36, 0.25)', // Amber for sunrise
            width: 1,
            type: 'dotted'
          },
          label: {
            show: false
          }
        });
      }
      
      // Add sunset line
      if (sunset.getTime() >= startTime && sunset.getTime() <= endTime) {
        markLines.push({
          xAxis: sunset.getTime(),
          lineStyle: {
            color: 'rgba(99, 102, 241, 0.25)', // Indigo for sunset
            width: 1,
            type: 'dotted'
          },
          label: {
            show: false
          }
        });
      }
      
      currentTime.setDate(currentTime.getDate() + 1);
    }
    
    console.log(`🌅🌆 [SensorChart] Added ${markLines.length} sunrise/sunset transitions for Midelt`);
    
    return markLines;
  };

  // Create comparison chart option
  const createComparisonChartOption = (dataKey: 'temperature' | 'humidity') => {
    const series: any[] = [];
    const legendData: string[] = [];
    
    console.log(`📊 [SensorChart] Creating comparison chart for ${dataKey}`);
    console.log(`📊 [SensorChart] Main data length: ${data.length}`);
    console.log(`📊 [SensorChart] Comparison data:`, Object.keys(comparisonData).map(id => ({
      id,
      name: availableChambers.find(c => c.id === id)?.name,
      dataLength: comparisonData[id]?.length || 0
    })));
    
    // Add main sensor data
    if (processedData.length > 0) {
      series.push({
        name: sensorName,
        type: 'line',
        data: processedData.map(d => [d.timestamp, d[dataKey]]),
        smooth: true,
        lineStyle: { width: 3, color: chamberColors[0] },
        itemStyle: { color: chamberColors[0] },
        symbol: 'circle',
        symbolSize: responsiveConfig.symbolSize
      });
      legendData.push(sensorName);
      console.log(`✅ [SensorChart] Added main sensor: ${sensorName}`);
    }
    
    // Add comparison chamber data
    Object.entries(comparisonData).forEach(([chamberId, chamberData], index) => {
      if (chamberData && chamberData.length > 0) {
        const chamber = availableChambers.find(c => c.id === chamberId);
        const chamberName = chamber ? chamber.name : `Chamber ${chamberId}`;
        const colorIndex = (index + 1) % chamberColors.length;
        
        series.push({
          name: chamberName,
          type: 'line',
          data: chamberData.map(d => [d.timestamp, d[dataKey]]),
          smooth: true,
          lineStyle: { width: 2, color: chamberColors[colorIndex], type: 'dashed' },
          itemStyle: { color: chamberColors[colorIndex] },
          symbol: 'circle',
          symbolSize: responsiveConfig.symbolSize - 1,
        });
        legendData.push(chamberName);
        console.log(`✅ [SensorChart] Added comparison chamber: ${chamberName} (${chamberData.length} points)`);
      }
    });
    
    // Add outdoor weather data if enabled
    if (showOutdoorData && outdoorData.length > 0) {
      const now = Date.now();
      
      // Split data into historical (past) and forecast (future)
      const historicalData = outdoorData.filter(d => d.timestamp <= now);
      const forecastData = outdoorData.filter(d => d.timestamp > now);
      
      console.log(`🌤️ [SensorChart] Adding outdoor data to ${dataKey} chart`);
      console.log(`🌤️ [SensorChart] Total outdoor points: ${outdoorData.length} (Historical: ${historicalData.length}, Forecast: ${forecastData.length})`);
      console.log(`🌤️ [SensorChart] First point:`, {
        timestamp: new Date(outdoorData[0].timestamp).toLocaleString(),
        [dataKey]: outdoorData[0][dataKey]
      });
      console.log(`🌤️ [SensorChart] Last point:`, {
        timestamp: new Date(outdoorData[outdoorData.length - 1].timestamp).toLocaleString(),
        [dataKey]: outdoorData[outdoorData.length - 1][dataKey]
      });
      
      // Use different visualization based on data points count
      if (outdoorData.length <= 5) {
        // For sparse data (≤5 points), use scatter plot with large markers
        console.log(`🌤️ [SensorChart] Using SCATTER visualization (sparse data: ${outdoorData.length} points)`);
        series.push({
          name: '🌤️ Extérieur',
          type: 'scatter',
          data: outdoorData.map(d => [d.timestamp, d[dataKey]]),
          itemStyle: { 
            color: '#f97316',
            borderWidth: 3,
            borderColor: '#fff',
            shadowColor: 'rgba(249, 115, 22, 0.5)',
            shadowBlur: 8
          },
          symbol: 'diamond',
          symbolSize: responsiveConfig.symbolSize + 8,
          z: 10,
          label: {
            show: true,
            position: 'top',
            formatter: function(params: any) {
              return `${params.value[1].toFixed(1)}${dataKey === 'temperature' ? '°C' : '%'}`;
            },
            fontSize: 11,
            fontWeight: 'bold',
            color: '#f97316',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderColor: '#f97316',
            borderWidth: 1,
            borderRadius: 4,
            padding: [4, 8]
          }
        });
        legendData.push('🌤️ Extérieur');
      } else {
        // For adequate data (>5 points), use line chart with split historical/forecast
        console.log(`🌤️ [SensorChart] Using LINE visualization (adequate data: ${outdoorData.length} points)`);
        
        // Add historical data (solid line)
        if (historicalData.length > 0) {
          series.push({
            name: '🌤️ Extérieur',
            type: 'line',
            data: historicalData.map(d => [d.timestamp, d[dataKey]]),
            smooth: true,
            lineStyle: { width: 3, color: '#f97316', type: 'solid' }, // Solid for historical
            itemStyle: { color: '#f97316', borderWidth: 2, borderColor: '#fff' },
            symbol: 'diamond',
            symbolSize: responsiveConfig.symbolSize + 2,
            z: 10
          });
          legendData.push('🌤️ Extérieur');
        }
        
        // Add forecast data (dashed line)
        if (forecastData.length > 0) {
          series.push({
            name: '🔮 Prévisions',
            type: 'line',
            data: forecastData.map(d => [d.timestamp, d[dataKey]]),
            smooth: true,
            lineStyle: { width: 2.5, color: '#f97316', type: 'dashed' }, // Dashed for forecast
            itemStyle: { color: '#f97316', borderWidth: 2, borderColor: '#fff' },
            symbol: 'circle',
            symbolSize: responsiveConfig.symbolSize,
            z: 10
          });
          legendData.push('🔮 Prévisions');
        }
      }
      
      console.log(`✅ [SensorChart] Successfully added outdoor weather data to series`);
    }
    
    console.log(`📊 [SensorChart] Total series: ${series.length}, Legend: ${legendData.join(', ')}`);
    console.log(`📊 [SensorChart] Series names:`, series.map(s => s.name));
    
 
  
    
    return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
    animationEasing: 'cubicOut',
    toolbox: {
      right: responsiveConfig.toolbox.right,
      top: responsiveConfig.toolbox.top,
      itemSize: responsiveConfig.toolbox.itemSize,
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Zoom',
            back: 'Retour'
          }
        },
        restore: {
          title: 'Reset'
        },
        saveAsImage: {
          title: 'Save',
          pixelRatio: 2
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: responsiveConfig.toolbox.itemSize + 8,
        bottom: 10,
        show: true,
        showDetail: false,
        showDataShadow: false,
        realtime: true,
        borderColor: 'transparent',
        backgroundColor: 'rgba(241, 245, 249, 0.8)',
        fillerColor: 'rgba(59, 130, 246, 0.2)',
        dataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0 
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        selectedDataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        handleIcon: 'path://M512,512m-448,0a448,448,0,1,0,896,0a448,448,0,1,0,-896,0Z',
        handleSize: '120%',
        handleStyle: {
          color: '#3B82F6',
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 4,
          shadowColor: 'rgba(59, 130, 246, 0.4)',
          shadowOffsetX: 0,
          shadowOffsetY: 2
        },
        moveHandleSize: 0,
        moveHandleStyle: {
          opacity: 0
        },
        textStyle: {
          color: 'transparent',
          fontSize: 0
        },
        labelFormatter: '',
        brushSelect: false,
        borderRadius: 10,
        emphasis: {
          handleStyle: {
            shadowBlur: 6,
            shadowColor: 'rgba(59, 130, 246, 0.5)'
          }
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { 
        type: 'cross',
        label: {
          backgroundColor: '#6B7280'
        }
      },
      position: function (point: any, _params: any, _dom: any, _rect: any, size: any) {
        // Smart positioning for mobile and desktop
        const isMobile = window.innerWidth < 640;
        const x = point[0] - size.contentSize[0] / 2;
        const y = isMobile ? '5%' : '10%';
        return [x, y];
      },
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: {
        color: '#1F2937',
        fontSize: responsiveConfig.fontSize.base
      },
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-radius: 8px; backdrop-filter: blur(8px);',
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';
        
        let tooltipHtml = '<div>';
        
        // Time at the top
        const date = new Date(params[0].data[0]);
        const time = date.toLocaleString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit',
          day: '2-digit',
          month: 'short'
        });
        tooltipHtml += `<div style="font-weight: 600; margin-bottom: 8px; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px;">${time}</div>`;
        
        params.forEach((param: any) => {
          // Skip door status series in tooltip
          if (param.seriesName === 'État Porte') return;
          
          const value = param.data[1].toFixed(dataKey === 'temperature' ? 1 : 0);
          const unit = dataKey === 'temperature' ? '°C' : '%';
          
          tooltipHtml += `
            <div style="margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; min-width: 180px;">
              <div style="display: flex; align-items: center;">
                <span style="display: inline-block; width: 8px; height: 8px; background-color: ${param.color}; border-radius: 50%; margin-right: 8px;"></span>
                <span style="color: #6B7280; font-size: 12px;">${param.seriesName}</span>
              </div>
              <strong style="margin-left: 12px; color: #111827;">${value}${unit}</strong>
            </div>
          `;
        });
        
        tooltipHtml += '</div>';
        return tooltipHtml;
      }
    },
      legend: {
        data: legendData,
        top: 10,
        textStyle: { fontSize: responsiveConfig.fontSize.legend }
      },
    grid: [
      {
        left: responsiveConfig.grid.left,
        right: responsiveConfig.grid.right,
        bottom: responsiveConfig.grid.bottom,
        top: '20%',
        containLabel: true
      },
      {
        left: responsiveConfig.grid.left,
        right: responsiveConfig.grid.right,
        bottom: '5%',
        top: '88%',
        containLabel: true
      }
    ],
    xAxis: [
      {
        type: 'time',
        gridIndex: 0,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: responsiveConfig.fontSize.label,
          rotate: 45,
          interval: 'auto',
          formatter: function(value: number) {
            const date = new Date(value);
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          }
        },
      },
      {
        type: 'time',
        gridIndex: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: { show: false }
      }
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: dataKey === 'temperature' ? 'Température (°C)' : 'Humidité (%)',
        nameTextStyle: { 
          color: dataKey === 'temperature' ? '#EF4444' : '#3B82F6',
          fontSize: responsiveConfig.fontSize.title
        },
        axisLine: { lineStyle: { color: dataKey === 'temperature' ? '#EF4444' : '#3B82F6' } },
        axisLabel: {
          color: dataKey === 'temperature' ? '#EF4444' : '#3B82F6',
          fontSize: responsiveConfig.fontSize.label,
          formatter: dataKey === 'temperature' ? '{value}°C' : '{value}%'
        },
        splitLine: { lineStyle: { color: dataKey === 'temperature' ? '#FEE2E2' : '#DBEAFE' } }
      },
      {
        type: 'value',
        gridIndex: 1, 
        nameTextStyle: { 
          color: '#6B7280', 
          fontSize: responsiveConfig.fontSize.label 
        },
        min: 0,
        max: 1,
        interval: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: responsiveConfig.fontSize.label,
          formatter: function(value: number) {
            return value === 1 ? '🔒' : ' ';
          }
        },
        splitLine: { show: false }
      }
    ],
      series: series
    };
  };

  // Temperature chart configuration
  console.log(`📊 [SensorChart] Creating temperature chart with ${processedData.length} data points (original: ${data.length})`);
  if (processedData.length > 0) {
    console.log(`🚪 [SensorChart] Door status data for chart:`, processedData.slice(0, 5).map(d => ({
      time: new Date(d.timestamp).toLocaleTimeString(),
      magnet: d.magnet
    })));
  }
  
  console.log(`📊 [SensorChart] Building temperatureChartOption - comparisonMode: ${comparisonMode}, showOutdoorData: ${showOutdoorData}, outdoorData.length: ${outdoorData.length}`);
  
  const temperatureChartOption = (comparisonMode || showOutdoorData) ? createComparisonChartOption('temperature') : {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
    toolbox: {
      right: responsiveConfig.toolbox.right,
      top: responsiveConfig.toolbox.top,
      itemSize: responsiveConfig.toolbox.itemSize,
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Zoom',
            back: 'Retour'
          }
        },
        restore: {
          title: 'Reset'
        },
        saveAsImage: {
          title: 'Save',
          pixelRatio: 2
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: responsiveConfig.toolbox.itemSize + 8,
        bottom: 10,
        show: true,
        showDetail: false,
        showDataShadow: false,
        realtime: true,
        borderColor: 'transparent',
        backgroundColor: 'rgba(254, 226, 226, 0.6)',
        fillerColor: 'rgba(239, 68, 68, 0.25)',
        dataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0 
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        selectedDataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        handleIcon: 'path://M512,512m-448,0a448,448,0,1,0,896,0a448,448,0,1,0,-896,0Z',
        handleSize: '120%',
        handleStyle: {
          color: '#EF4444',
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 4,
          shadowColor: 'rgba(239, 68, 68, 0.4)',
          shadowOffsetX: 0,
          shadowOffsetY: 2
        },
        moveHandleSize: 0,
        moveHandleStyle: {
          opacity: 0
        },
        textStyle: {
          color: 'transparent',
          fontSize: 0
        },
        labelFormatter: '',
        brushSelect: false,
        borderRadius: 10,
        emphasis: {
          handleStyle: {
            shadowBlur: 6,
            shadowColor: 'rgba(239, 68, 68, 0.5)'
          }
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { 
        type: 'cross',
        label: {
          backgroundColor: '#6B7280'
        }
      },
      position: function (point: any, _params: any, _dom: any, _rect: any, size: any) {
        // Position tooltip at top for better visibility
        return [point[0] - size.contentSize[0] / 2, '10%'];
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: {
        color: '#1F2937',
        fontSize: 13
      },
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-radius: 8px;',
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';
        const point = params[0];
        const date = new Date(point.data[0]);
        const time = date.toLocaleString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit',
          day: '2-digit',
          month: 'short'
        });
        const value = point.data[1].toFixed(1);
        
        return `
          <div>
            <div style="font-weight: 600; margin-bottom: 8px; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px;">${time}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; min-width: 180px; margin-bottom: 6px;">
              <div style="display: flex; align-items: center;">
                <span style="display: inline-block; width: 8px; height: 8px; background-color: #EF4444; border-radius: 50%; margin-right: 8px;"></span>
                <span style="color: #6B7280; font-size: 12px;">Température</span>
              </div>
              <strong style="margin-left: 12px; color: #111827;">${value}°C</strong>
            </div>
          </div>
        `;
      }
    },
    grid: [
      { 
        left: responsiveConfig.grid.left, 
        right: responsiveConfig.grid.right, 
        bottom: responsiveConfig.grid.bottom, 
        top: responsiveConfig.grid.top, 
        containLabel: true 
      },
      { 
        left: responsiveConfig.grid.left, 
        right: responsiveConfig.grid.right, 
        bottom: '5%', 
        top: '88%', 
        containLabel: true 
      }
    ],
    xAxis: [
      {
        type: 'time',
        gridIndex: 0,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: responsiveConfig.fontSize.label,
          rotate: 45,
          interval: 'auto',
          formatter: function(value: number) {
            const date = new Date(value);
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          }
        },
      },
      {
        type: 'time',
        gridIndex: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: { show: false }
      }
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: 'Température (°C)',
        nameTextStyle: { 
          color: '#EF4444',
          fontSize: responsiveConfig.fontSize.title
        },
        axisLine: { lineStyle: { color: '#EF4444' } },
        axisLabel: { 
          color: '#EF4444', 
          fontSize: responsiveConfig.fontSize.label,
          formatter: '{value}°C' 
        },
        splitLine: { lineStyle: { color: '#FEE2E2' } }
      },
      {
        type: 'value',
        gridIndex: 1,  
        interval: 1, 
      },
      {
        type: 'value',
        gridIndex: 0,
        name: 'Porte',
        nameTextStyle: { 
          color: '#8B5CF6',
          fontSize: responsiveConfig.fontSize.label
        },
        position: 'right',
        min: 0,
        max: 1,
        interval: 0.5,
        axisLine: { lineStyle: { color: '#8B5CF6' } },
        axisLabel: {
          color: '#8B5CF6',
          fontSize: responsiveConfig.fontSize.label,
          formatter: function(value: number) {
            return value === 1 ? 'Fermé' : value === 0 ? 'Ouvert' : '';
          }
        },
        splitLine: { show: false }
      }
    ],
    series: [
      // Day/Night background layer (first layer, behind everything)
      {
        name: 'Nuit',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: [], // Empty data, just for markArea
        markArea: {
          silent: true,
          itemStyle: {
            color: 'rgba(30, 41, 59, 0.04)', // Very subtle dark blue for night
            borderWidth: 0
          },
          label: {
            show: false
          },
          data: createDayNightMarkAreas(processedData).map(area => [
            { 
              xAxis: area.xAxis,
              name: 'Nuit'
            },
            { xAxis: area.xAxisEnd }
          ])
        },
        z: -1 // Behind everything
      },
      {
        name: 'Température',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: processedData.map(d => [d.timestamp, d.temperature]),
        smooth: true,
        lineStyle: { width: 3, color: '#EF4444' },
        itemStyle: { color: '#EF4444' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.05)' }
            ]
          }
        },
        symbol: 'circle',
        symbolSize: responsiveConfig.symbolSize,
        markLine: {
          silent: true,
          symbol: 'none',
          data: createDayNightMarkLines(processedData)
        },
        z: 2
      },
      // Outdoor weather data (if enabled)
      ...(showOutdoorData && outdoorData.length > 0 ? [{
        name: '🌤️ Extérieur',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: outdoorData.map(d => [d.timestamp, d.temperature]),
        smooth: true,
        lineStyle: { 
          width: 2.5, 
          color: '#f97316',
          type: 'dotted'
        },
        itemStyle: { 
          color: '#f97316',
          borderWidth: 2,
          borderColor: '#fff'
        },
        symbol: 'diamond',
        symbolSize: responsiveConfig.symbolSize + 1,
        z: 3
      }] : [])
    ]
  };
  
  console.log(`🚪 [SensorChart] Temperature chart series count: ${temperatureChartOption.series.length}`);
  console.log(`🚪 [SensorChart] Door status series data points: ${processedData.length}`);

  // Humidity chart configuration
  console.log(`📊 [SensorChart] Building humidityChartOption - comparisonMode: ${comparisonMode}, showOutdoorData: ${showOutdoorData}, outdoorData.length: ${outdoorData.length}`);
  
  const humidityChartOption = (comparisonMode || showOutdoorData) ? createComparisonChartOption('humidity') : {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
    toolbox: {
      right: responsiveConfig.toolbox.right,
      top: responsiveConfig.toolbox.top,
      itemSize: responsiveConfig.toolbox.itemSize,
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Zoom',
            back: 'Retour'
          }
        },
        restore: {
          title: 'Reset'
        },
        saveAsImage: {
          title: 'Save',
          pixelRatio: 2
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: responsiveConfig.toolbox.itemSize + 8,
        bottom: 10,
        show: true,
        showDetail: false,
        showDataShadow: false,
        realtime: true,
        borderColor: 'transparent',
        backgroundColor: 'rgba(219, 234, 254, 0.6)',
        fillerColor: 'rgba(59, 130, 246, 0.25)',
        dataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0 
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        selectedDataBackground: {
          lineStyle: { 
            opacity: 0,
            width: 0
          },
          areaStyle: { 
            opacity: 0,
            color: 'transparent'
          }
        },
        handleIcon: 'path://M512,512m-448,0a448,448,0,1,0,896,0a448,448,0,1,0,-896,0Z',
        handleSize: '120%',
        handleStyle: {
          color: '#3B82F6',
          borderColor: '#fff',
          borderWidth: 2,
          shadowBlur: 4,
          shadowColor: 'rgba(59, 130, 246, 0.4)',
          shadowOffsetX: 0,
          shadowOffsetY: 2
        },
        moveHandleSize: 0,
        moveHandleStyle: {
          opacity: 0
        },
        textStyle: {
          color: 'transparent',
          fontSize: 0
        },
        labelFormatter: '',
        brushSelect: false,
        borderRadius: 10,
        emphasis: {
          handleStyle: {
            shadowBlur: 6,
            shadowColor: 'rgba(59, 130, 246, 0.5)'
          }
        }
      }
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { 
        type: 'cross',
        label: {
          backgroundColor: '#6B7280'
        }
      },
      position: function (point: any, _params: any, _dom: any, _rect: any, size: any) {
        // Position tooltip at top for better visibility
        return [point[0] - size.contentSize[0] / 2, '10%'];
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: {
        color: '#1F2937',
        fontSize: 13
      },
      extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-radius: 8px;',
      formatter: function(params: any) {
        if (!params || params.length === 0) return '';
        const point = params[0];
        const date = new Date(point.data[0]);
        const time = date.toLocaleString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit',
          day: '2-digit',
          month: 'short'
        });
        const value = point.data[1].toFixed(0);
        
        return `
          <div>
            <div style="font-weight: 600; margin-bottom: 8px; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px;">${time}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; min-width: 180px; margin-bottom: 6px;">
              <div style="display: flex; align-items: center;">
                <span style="display: inline-block; width: 8px; height: 8px; background-color: #3B82F6; border-radius: 50%; margin-right: 8px;"></span>
                <span style="color: #6B7280; font-size: 12px;">Humidité</span>
              </div>
              <strong style="margin-left: 12px; color: #111827;">${value}%</strong>
            </div>
          </div>
        `;
      }
    },
    grid: [
      { 
        left: responsiveConfig.grid.left, 
        right: responsiveConfig.grid.right, 
        bottom: responsiveConfig.grid.bottom, 
        top: responsiveConfig.grid.top, 
        containLabel: true 
      },
      { 
        left: responsiveConfig.grid.left, 
        right: responsiveConfig.grid.right, 
        bottom: '5%', 
        top: '88%', 
        containLabel: true 
      }
    ],
    xAxis: [
      {
        type: 'time',
        gridIndex: 0,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: {
          color: '#6B7280',
          fontSize: responsiveConfig.fontSize.label,
          rotate: 45,
          interval: 'auto',
          formatter: function(value: number) {
            const date = new Date(value);
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          }
        },
      },
      {
        type: 'time',
        gridIndex: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        axisLabel: { show: false }
      }
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: 'Humidité (%)',
        nameTextStyle: { 
          color: '#3B82F6',
          fontSize: responsiveConfig.fontSize.title
        },
        axisLine: { lineStyle: { color: '#3B82F6' } },
        axisLabel: { 
          color: '#3B82F6', 
          fontSize: responsiveConfig.fontSize.label,
          formatter: '{value}%' 
        },
        splitLine: { lineStyle: { color: '#DBEAFE' } }
      },
      {
        type: 'value',
        gridIndex: 1,
        name: 'Porte',
        nameTextStyle: { 
          color: '#6B7280', 
          fontSize: responsiveConfig.fontSize.label 
        },
        min: 0,
        max: 1,
        interval: 1,
        axisLine: { lineStyle: { color: '#E5E7EB' } },
        splitLine: { show: false }
      },
      {
        type: 'value',
        gridIndex: 0,
        name: 'Porte',
        nameTextStyle: { 
          color: '#8B5CF6',
          fontSize: responsiveConfig.fontSize.label
        },
        position: 'right',
        min: 0,
        max: 1,
        interval: 0.5,
        axisLine: { lineStyle: { color: '#8B5CF6' } },
        axisLabel: {
          color: '#8B5CF6',
          fontSize: responsiveConfig.fontSize.label,
          formatter: function(value: number) {
            return value === 1 ? 'Fermé' : value === 0 ? 'Ouvert' : '';
          }
        },
        splitLine: { show: false }
      }
    ],
    series: [
      // Day/Night background layer (first layer, behind everything)
      {
        name: 'Nuit',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: [], // Empty data, just for markArea
        markArea: {
          silent: true,
          itemStyle: {
            color: 'rgba(30, 41, 59, 0.04)', // Very subtle dark blue for night
            borderWidth: 0
          },
          label: {
            show: false
          },
          data: createDayNightMarkAreas(processedData).map(area => [
            { 
              xAxis: area.xAxis,
              name: 'Nuit'
            },
            { xAxis: area.xAxisEnd }
          ])
        },
        z: -1 // Behind everything
      },
      {
        name: 'Humidité',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: processedData.map(d => [d.timestamp, d.humidity]),
        smooth: true,
        lineStyle: { width: 3, color: '#3B82F6' },
        itemStyle: { color: '#3B82F6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
            ]
          }
        },
        symbol: 'circle',
        symbolSize: responsiveConfig.symbolSize,
        markLine: {
          silent: true,
          symbol: 'none',
          data: createDayNightMarkLines(processedData)
        },
        z: 2
      },
      // Outdoor weather data (if enabled)
      ...(showOutdoorData && outdoorData.length > 0 ? [{
        name: '🌤️ Extérieur',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: outdoorData.map(d => [d.timestamp, d.humidity]),
        smooth: true,
        lineStyle: { 
          width: 2.5, 
          color: '#f97316',
          type: 'dotted'
        },
        itemStyle: { 
          color: '#f97316',
          borderWidth: 2,
          borderColor: '#fff'
        },
        symbol: 'diamond',
        symbolSize: responsiveConfig.symbolSize + 1,
        z: 3
      }] : [])
    ]
  };

  // Effects
  useEffect(() => {
    if (isOpen) {
      console.log('🚀 [SensorChart] Modal opened, fetching data for sensor:', sensorId);
      fetchSensorData(false);
    }
  }, [isOpen, sensorId, dateRange, fetchSensorData]);
  
  // Refetch outdoor data when date range changes (if outdoor data is enabled)
  useEffect(() => {
    if (isOpen && showOutdoorData) {
      console.log('🔄 [SensorChart] Date range changed, refetching outdoor weather data');
      fetchOutdoorWeatherData();
    }
  }, [dateRange.start, dateRange.end, dateRange.type, isOpen, showOutdoorData, fetchOutdoorWeatherData]);

  // Handle window resize for responsive charts
  useEffect(() => {
    if (!isOpen) return;
    
    const handleResize = () => {
      setChartKey(prev => prev + 1);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // DON'T auto-enable comparison mode - let user enable it manually
  // This prevents extra API requests on modal open
  // Comparison mode only activates when user clicks the "Comparer" button

  console.log('🔍 [SensorChart] Render check - isOpen:', isOpen, 'sensorName:', sensorName);
  
  if (!isOpen) {
    console.log('❌ [SensorChart] Modal closed, not rendering');
    return null;
  }

  console.log('✅ [SensorChart] Modal open, rendering chart');
  
  const chartHeight = responsiveConfig.height;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center sm:items-start justify-center z-50 p-0 sm:p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-white to-gray-50/80 rounded-none sm:rounded-2xl shadow-2xl max-w-7xl w-full h-full sm:h-auto sm:min-h-0 sm:max-h-[92vh] overflow-hidden mx-0 sm:mx-auto my-0 sm:my-8 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100/60 bg-white/80 backdrop-blur-xl overflow-visible relative z-10">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 tracking-tight">Analyse des Données</h2>
              <p className="text-xs text-gray-500 font-medium truncate">
                {displayRoomName ? `Capteur ${displayRoomName}` : sensorName}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            {/* Refresh Button */}
              <button
                onClick={() => fetchSensorData(true)}
                disabled={loading}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                  loading 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-500 text-white shadow-sm hover:bg-blue-600'
                }`}
                title="Actualiser les données"
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>

            {/* Outdoor Weather Toggle - Compact Icon */}
            <button
              onClick={() => {
                if (!showOutdoorData && outdoorData.length === 0) {
                  // Fetch outdoor data
                  fetchOutdoorWeatherData();
                } else {
                  // Toggle display
                  setShowOutdoorData(!showOutdoorData);
                }
              }}
              disabled={outdoorLoading}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                showOutdoorData
                  ? 'bg-orange-500 text-white shadow-sm hover:bg-orange-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 active:scale-95'
              } ${outdoorLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={showOutdoorData ? "Masquer météo extérieure" : "Afficher météo extérieure"}
            >
              {outdoorLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              )}
            </button>

            {/* Comparison Mode Toggle */}
            {availableChambers.length > 1 && (
            <button
              onClick={() => {
                  setComparisonMode(!comparisonMode);
                  if (!comparisonMode) {
                    // Enable comparison mode
                    fetchAllChambersData();
                } else {
                    // Disable comparison mode - clear all selections
                    setComparisonData({});
                    setSelectedChambers([]);
                }
              }}
              className={`px-3 py-1.5 rounded-full flex items-center space-x-1.5 transition-all duration-200 flex-shrink-0 ${
                  comparisonMode 
                    ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
                title={comparisonMode ? "Désactiver le mode comparaison" : "Comparer avec d'autres chambres"}
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              <span className="text-xs font-medium">
                  {comparisonMode ? 'Comparaison' : 'Comparer'}
              </span>
              </button>
            )}

            {/* Share Button with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 bg-green-500 text-white shadow-sm hover:bg-green-600 active:scale-95 flex-shrink-0 relative z-20"
                title="Partager les données"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              
              {/* Share Dropdown Menu */}
              {showShareMenu && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-[9999]" 
                    onClick={() => setShowShareMenu(false)}
                  />
                  
                  {/* Menu */}
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 z-[10000] overflow-hidden">
                    <div className="p-2">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-700">Exporter & Partager</p>
                      </div>
                      
                      {/* WhatsApp Text */}
                      <button
                        onClick={() => {
                          shareViaWhatsApp('text');
                          setShowShareMenu(false);
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-green-50 rounded-lg transition-colors group"
                      >
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                          <p className="text-xs text-gray-500">Résumé texte</p>
                        </div>
                      </button>
                      
                      {/* Excel Export */}
                      <button
                        onClick={() => {
                          exportToExcel();
                          setShowShareMenu(false);
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-green-50 rounded-lg transition-colors group"
                      >
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                          <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-900">Excel (.xlsx)</p>
                          <p className="text-xs text-gray-500">Données détaillées</p>
                        </div>
                      </button>
                      
                      {/* PDF Export */}
                      <button
                        onClick={() => {
                          exportToPDF();
                          setShowShareMenu(false);
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-red-50 rounded-lg transition-colors group"
                      >
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
                          <svg className="w-5 h-5 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-900">PDF</p>
                          <p className="text-xs text-gray-500">Rapport imprimable</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100/80 hover:bg-gray-200/80 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 border border-gray-200/60"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-thin">
          {/* Date Range Selector */}
          <div className="mb-2 sm:mb-4 lg:mb-6 p-2 sm:p-3 lg:p-5 bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/20 shadow-lg shadow-black/5">
            <div className="flex flex-col items-center space-y-2 sm:space-y-3">
                  <div className="flex justify-center flex-wrap gap-1 sm:gap-1.5 w-full">
                <button
                  onClick={setLast30Minutes}
                  className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl transition-all duration-300 ${
                    isRangeSelected('30min')
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90'
                  }`}
                >
                  30min
                </button>
                <button
                  onClick={() => setQuickRange(1, '24h')}
                  className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl transition-all duration-300 ${
                    isRangeSelected('24h')
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90'
                  }`}
                >
                  24h
                </button>
                <button
                  onClick={() => setQuickRange(7, '7d')}
                  className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl transition-all duration-300 ${
                    isRangeSelected('7d')
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90'
                  }`}
                >
                  7j
                </button>
                <button
                  onClick={() => setQuickRange(30, '30d')}
                  className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl transition-all duration-300 ${
                    isRangeSelected('30d')
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/80 text-slate-700 border border-slate-200/60 hover:bg-slate-50/90'
                  }`}
                >
                  30j
                </button>
                  </div>
            </div>
          </div>

          {/* Outdoor Weather Indicator - Compact */}
          {showOutdoorData && outdoorData.length > 0 && (() => {
            const now = Date.now();
            const historicalCount = outdoorData.filter(d => d.timestamp <= now).length;
            const forecastCount = outdoorData.filter(d => d.timestamp > now).length;
            
            return (
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center space-x-2 flex-wrap">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  <span className="text-xs font-semibold text-orange-900">Météo Extérieure</span>
                  <span className="px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full text-[10px] font-medium">
                    {historicalCount} hist.
                  </span>
                  {forecastCount > 0 && (
                    <span className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full text-[10px] font-medium">
                      🔮 {forecastCount} prév.
                    </span>
                  )}
                </div>
                {outdoorData.length > 0 && (
                  <div className="flex items-center space-x-3 text-xs">
                    <div className="flex items-center space-x-1">
                      <span className="text-orange-600 font-medium">🌡️</span>
                      <span className="text-orange-900 font-semibold">
                        {(outdoorData.reduce((sum, d) => sum + d.temperature, 0) / outdoorData.length).toFixed(1)}°C
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-orange-600 font-medium">💧</span>
                      <span className="text-orange-900 font-semibold">
                        {(outdoorData.reduce((sum, d) => sum + d.humidity, 0) / outdoorData.length).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* KPI Cards - Compact Version */}
          {kpis && !comparisonMode && (
            <div className="mb-3 sm:mb-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">
                {/* Average Temperature KPI */}
                <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-red-200/60 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-semibold text-red-600/70 uppercase tracking-tight truncate">Temp. Moy</p>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <p className="text-lg sm:text-xl font-bold text-red-700">{kpis.avgTemp.toFixed(1)}</p>
                        <span className="text-[10px] text-red-600">°C</span>
                      </div>
                      <p className="text-[8px] text-red-600/60 mt-0.5">{kpis.minTemp.toFixed(1)}° – {kpis.maxTemp.toFixed(1)}°</p>
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-red-200/40">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] text-red-600/70">Zone 0-4°C</span>
                      <span className="text-[8px] font-bold text-red-700">{kpis.tempRangePercent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-red-200/30 rounded-full h-1 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          kpis.tempRangePercent >= 90 ? 'bg-green-500' : 
                          kpis.tempRangePercent >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(kpis.tempRangePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Temperature Stability KPI */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-orange-200/60 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-semibold text-orange-600/70 uppercase tracking-tight truncate">Stabilité T°</p>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <p className="text-lg sm:text-xl font-bold text-orange-700">±{kpis.tempStability.toFixed(2)}</p>
                        <span className="text-[10px] text-orange-600">°C</span>
                      </div>
                      <p className="text-[8px] text-orange-600/60 mt-0.5">Écart-type (σ)</p>
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-orange-200/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className={`w-1 h-1 rounded-full ${
                          kpis.tempStability < 0.5 ? 'bg-green-500' : 
                          kpis.tempStability < 1.0 ? 'bg-yellow-500' : 'bg-red-500'
                        } animate-pulse`}></div>
                        <span className={`text-[8px] font-medium ${
                          kpis.tempStability < 0.5 ? 'text-green-600' : 
                          kpis.tempStability < 1.0 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {kpis.tempStability < 0.5 ? 'Excellent' : kpis.tempStability < 1.0 ? 'Bon' : 'Instable'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Average Humidity KPI */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-blue-200/60 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-semibold text-blue-600/70 uppercase tracking-tight truncate">Humidité Moy</p>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <p className="text-lg sm:text-xl font-bold text-blue-700">{kpis.avgHumidity.toFixed(1)}</p>
                        <span className="text-[10px] text-blue-600">%</span>
                      </div>
                      <p className="text-[8px] text-blue-600/60 mt-0.5">{kpis.minHum.toFixed(0)}% – {kpis.maxHum.toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-blue-200/40">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] text-blue-600/70">90-95%</span>
                      <span className="text-[8px] font-bold text-blue-700">{kpis.humRangePercent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-blue-200/30 rounded-full h-1 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          kpis.humRangePercent >= 90 ? 'bg-green-500' : 
                          kpis.humRangePercent >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(kpis.humRangePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Humidity Stability KPI */}
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-cyan-200/60 shadow-sm">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-semibold text-cyan-600/70 uppercase tracking-tight truncate">Stabilité H%</p>
                      <div className="flex items-baseline gap-0.5 mt-0.5">
                        <p className="text-lg sm:text-xl font-bold text-cyan-700">±{kpis.humStability.toFixed(2)}</p>
                        <span className="text-[10px] text-cyan-600">%</span>
                      </div>
                      <p className="text-[8px] text-cyan-600/60 mt-0.5">Écart-type (σ)</p>
                    </div>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-cyan-200/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className={`w-1 h-1 rounded-full ${
                          kpis.humStability < 2.0 ? 'bg-green-500' : 
                          kpis.humStability < 4.0 ? 'bg-yellow-500' : 'bg-red-500'
                        } animate-pulse`}></div>
                        <span className={`text-[8px] font-medium ${
                          kpis.humStability < 2.0 ? 'text-green-600' : 
                          kpis.humStability < 4.0 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {kpis.humStability < 2.0 ? 'Excellent' : kpis.humStability < 4.0 ? 'Bon' : 'Instable'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comparison Mode - Chamber Selection */}
          {comparisonMode && (
            <div className="mb-3 sm:mb-6">
              {/* Mobile-Optimized Header */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-2xl sm:rounded-3xl border border-blue-200 shadow-sm overflow-hidden">
                {/* Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-blue-100/50 border-b border-blue-200/50">
                  <div className="flex items-center justify-between sm:justify-start mb-2 sm:mb-0">
                            <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                      <span className="text-xs sm:text-sm font-semibold text-blue-900">Comparaison</span>
                      <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full text-xs font-medium">
                        {selectedChambers.length}
                      </span>
                            </div>
                {comparisonLoading && (
                      <div className="flex items-center space-x-1.5 ml-2 sm:hidden">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                        <span className="text-xs text-blue-600">...</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Quick Actions - Mobile Friendly */}
                  <div className="flex items-center space-x-2">
                    {comparisonLoading && (
                      <div className="hidden sm:flex items-center space-x-2 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Chargement...</span>
                                  </div>
                                )}
                    <button
                      onClick={async () => {
                        // Select all chambers
                        setComparisonLoading(true);
                        try {
                          for (const chamber of availableChambers) {
                            if (!selectedChambers.includes(chamber.id)) {
                              const chamberData = await fetchChamberData(chamber);
                              setComparisonData(prev => ({
                                ...prev,
                                [chamber.id]: chamberData
                              }));
                              setSelectedChambers(prev => [...prev, chamber.id]);
                            }
                          }
                        } finally {
                          setComparisonLoading(false);
                        }
                      }}
                      disabled={comparisonLoading || selectedChambers.length === availableChambers.length}
                      className="px-2 sm:px-3 py-1 text-xs font-medium text-blue-700 hover:text-blue-900 bg-white/60 hover:bg-white rounded-lg border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Tout
                    </button>
                    <button
                      onClick={() => {
                        setSelectedChambers([]);
                        setComparisonData({});
                      }}
                      disabled={comparisonLoading || selectedChambers.length === 0}
                      className="px-2 sm:px-3 py-1 text-xs font-medium text-gray-700 hover:text-gray-900 bg-white/60 hover:bg-white rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Aucun
                    </button>
                              </div>
                                  </div>
                
                {/* Chamber Selection - Mobile Optimized */}
                <div className="p-3 sm:p-4">
                  <p className="text-xs text-blue-700 font-medium mb-2 sm:mb-3">
                    Touchez pour sélectionner (tous les FRIGOs):
                  </p>
                  
                  {/* Scrollable on mobile, grid on desktop */}
                  <div className="sm:hidden space-y-2">
                    {/* Group by FRIGO on mobile */}
                    {Object.entries(
                      availableChambers.reduce((acc, chamber) => {
                        const group = chamber.athGroupNumber || 1;
                        if (!acc[group]) acc[group] = [];
                        acc[group].push(chamber);
                        return acc;
                      }, {} as Record<number, typeof availableChambers>)
                    ).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([groupNum, groupChambers]) => {
                      const frigoNum = parseInt(groupNum);
                      const isCollapsed = collapsedFrigos.has(frigoNum);
                      const selectedCount = groupChambers.filter(c => selectedChambers.includes(c.id)).length;
                      
                      return (
                      <div key={groupNum} className="bg-white/40 rounded-xl border border-gray-200">
                        {/* Collapsible Header */}
                        <button
                          onClick={() => toggleFrigoCollapse(frigoNum)}
                          className="w-full flex items-center justify-between p-2.5 active:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-gray-800 bg-gradient-to-r from-gray-100 to-gray-50 px-2.5 py-1 rounded-lg border border-gray-200">
                              FRIGO {groupNum}
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">
                              {groupChambers.length} ch.
                            </span>
                            {selectedCount > 0 && (
                              <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-semibold">
                                {selectedCount}
                              </span>
                            )}
                          </div>
                          <svg 
                            className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {/* Collapsible Content */}
                        {!isCollapsed && (
                          <div className="px-2 pb-2">
                            <div className="flex-1 h-px bg-gray-200 mb-2"></div>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent">
                          {groupChambers.map((chamber) => {
                            const globalIndex = availableChambers.findIndex(c => c.id === chamber.id);
                            const isSelected = selectedChambers.includes(chamber.id);
                            const isCurrentChamber = chamber.name === sensorName || chamber.id === sensorId;
                            const chamberColors = [
                              '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                              '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
                            ];
                            const colorIndex = globalIndex % chamberColors.length;
                            const chamberColor = chamberColors[colorIndex];
                            
                            return (
                              <button
                                key={chamber.id}
                                onClick={() => toggleChamberSelection(chamber)}
                                disabled={comparisonLoading}
                                className={`flex-shrink-0 relative flex flex-col items-center justify-center min-w-[90px] h-[90px] rounded-2xl border-3 transition-all duration-200 active:scale-95 ${
                                  isSelected
                                    ? 'bg-white shadow-lg scale-105'
                                    : 'bg-white/60 border-gray-200 active:bg-white'
                                } ${comparisonLoading ? 'opacity-50' : ''}`}
                                style={{
                                  borderColor: isSelected ? chamberColor : undefined,
                                  borderWidth: isSelected ? '3px' : '2px',
                                }}
                              >
                                {/* Checkbox Circle - Larger for mobile */}
                                <div 
                                  className={`w-8 h-8 rounded-full border-3 flex items-center justify-center mb-2 transition-all ${
                                    isSelected 
                                      ? 'border-transparent scale-110' 
                                      : 'border-gray-300 bg-white'
                                  }`}
                                  style={{
                                    backgroundColor: isSelected ? chamberColor : undefined,
                                    borderWidth: '3px',
                                  }}
                                >
                                  {isSelected && (
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                
                                {/* Chamber Name */}
                                <span className={`text-xs font-semibold text-center px-1 leading-tight ${
                                  isSelected ? 'text-gray-900' : 'text-gray-600'
                                }`}>
                                  {chamber.name.replace(/Chambre\s*/i, 'Ch')}
                                </span>
                                
                                {isCurrentChamber && (
                                  <span className="text-[9px] text-blue-600 font-medium mt-0.5">actuel</span>
                                )}
                                
                                {/* Color Dot */}
                                {isSelected && (
                                  <div 
                                    className="absolute top-2 right-2 w-3 h-3 rounded-full shadow-sm"
                                    style={{ backgroundColor: chamberColor }}
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                  
                  {/* Desktop Grid - Grouped by FRIGO */}
                  <div className="hidden sm:block space-y-3">
                    {Object.entries(
                      availableChambers.reduce((acc, chamber) => {
                        const group = chamber.athGroupNumber || 1;
                        if (!acc[group]) acc[group] = [];
                        acc[group].push(chamber);
                        return acc;
                      }, {} as Record<number, typeof availableChambers>)
                    ).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([groupNum, groupChambers]) => {
                      const frigoNum = parseInt(groupNum);
                      const isCollapsed = collapsedFrigos.has(frigoNum);
                      const selectedCount = groupChambers.filter(c => selectedChambers.includes(c.id)).length;
                      
                      return (
                      <div key={groupNum} className="bg-white/40 rounded-xl border border-gray-200 overflow-hidden">
                        {/* Collapsible Header */}
                        <button
                          onClick={() => toggleFrigoCollapse(frigoNum)}
                          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-bold text-gray-800 bg-gradient-to-r from-gray-100 to-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                              FRIGO {groupNum}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                              {groupChambers.length} chambre{groupChambers.length > 1 ? 's' : ''}
                            </span>
                            {selectedCount > 0 && (
                              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-semibold">
                                {selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <svg 
                            className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {/* Collapsible Content */}
                        {!isCollapsed && (
                          <div className="px-3 pb-3">
                            <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent mb-3"></div>
                        <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                          {groupChambers.map((chamber) => {
                            const globalIndex = availableChambers.findIndex(c => c.id === chamber.id);
                            const isSelected = selectedChambers.includes(chamber.id);
                            const isCurrentChamber = chamber.name === sensorName || chamber.id === sensorId;
                            const chamberColors = [
                              '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                              '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
                            ];
                            const colorIndex = globalIndex % chamberColors.length;
                            const chamberColor = chamberColors[colorIndex];
                            
                            return (
                              <button
                                key={chamber.id}
                                onClick={() => toggleChamberSelection(chamber)}
                                disabled={comparisonLoading}
                                className={`relative flex items-center space-x-2 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 hover:scale-105 ${
                                  isSelected
                                    ? 'bg-white shadow-md'
                                    : 'bg-white/60 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                } ${comparisonLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                style={{
                                  borderColor: isSelected ? chamberColor : undefined,
                                }}
                              >
                                {/* Checkbox */}
                                <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  isSelected 
                                    ? 'border-transparent' 
                                    : 'border-gray-300 bg-white'
                                }`}
                                style={{
                                  backgroundColor: isSelected ? chamberColor : undefined,
                                }}
                                >
                                  {isSelected && (
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                
                                {/* Chamber Name */}
                                <span className={`text-xs font-medium truncate flex-1 text-left ${
                                  isSelected ? 'text-gray-900' : 'text-gray-600'
                                }`}>
                                  {chamber.name}
                                  {isCurrentChamber && (
                                    <span className="ml-1 text-[10px] text-blue-600">(actuel)</span>
                                  )}
                                </span>
                                
                                {/* Color Indicator */}
                                {isSelected && (
                                  <div 
                                    className="absolute top-1 right-1 w-2 h-2 rounded-full"
                                    style={{ backgroundColor: chamberColor }}
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
                                )}

          {/* Day/Night Legend - Compact */}
          {processedData.length > 0 && createDayNightMarkAreas(processedData).length > 0 && (() => {
            // Calculate sample sunrise/sunset times for legend
            const MIDELT_LAT = 32.6852;
            const MIDELT_LNG = -4.7371;
            const sampleDate = new Date(processedData[0].timestamp);
            const times = SunCalc.getTimes(sampleDate, MIDELT_LAT, MIDELT_LNG);
            const sunriseHour = times.sunrise.getHours();
            const sunriseMin = times.sunrise.getMinutes();
            const sunsetHour = times.sunset.getHours();
            const sunsetMin = times.sunset.getMinutes();
            const sunriseStr = `${sunriseHour}h${sunriseMin.toString().padStart(2, '0')}`;
            const sunsetStr = `${sunsetHour}h${sunsetMin.toString().padStart(2, '0')}`;
            
            return (
              <div className="mb-2 flex items-center justify-center gap-2 px-2 py-1 bg-gradient-to-r from-amber-50/80 via-white/60 to-indigo-50/80 backdrop-blur-sm rounded-lg border border-gray-200/30 shadow-sm">
                <span className="text-[9px] sm:text-[10px] text-amber-600 font-semibold">☀️{sunriseStr}-{sunsetStr}</span>
                <span className="text-gray-300">•</span>
                <span className="text-[9px] sm:text-[10px] text-indigo-600 font-semibold">🌙Nuit</span>
                <span className="text-gray-300 hidden sm:inline">•</span>
                <span className="text-[8px] text-gray-400 font-medium hidden sm:inline">Midelt</span>
              </div>
            );
          })()}

          {/* Charts */}
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-${responsiveConfig.padding.gap}`}>
            {/* Temperature Chart */}
            <div ref={temperatureChartRef} className={`bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl border border-gray-200/60 p-${responsiveConfig.padding.chart} shadow-lg hover:shadow-xl transition-all duration-300`}>
              <div className="mb-1.5 sm:mb-2 lg:mb-3 flex items-center justify-between">
             {/*    <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Température
                </h3> */}
                {processedData.length > 0 && (
                  <span className="text-xs sm:text-sm text-gray-500">
                    {processedData.length} points
                    {aggregationInterval > 0 && (
                      <span className="ml-1 text-[10px] text-gray-400">
                        ({aggregationInterval}min)
                      </span>
                    )}
                  </span>
                )}
              </div>
              <ReactECharts 
                key={`temp-${sensorId}-${dateRange.type}-${comparisonMode}-${showOutdoorData}`}
                option={temperatureChartOption} 
                style={{ height: chartHeight, width: '100%' }}
                opts={{ renderer: 'canvas', locale: 'FR' }}
                notMerge={true}
                lazyUpdate={true}
              />
            </div>

            {/* Humidity Chart */}
            <div ref={humidityChartRef} className={`bg-white/90 backdrop-blur-md rounded-xl sm:rounded-2xl border border-gray-200/60 p-${responsiveConfig.padding.chart} shadow-lg hover:shadow-xl transition-all duration-300`}>
              <div className="mb-1.5 sm:mb-2 lg:mb-3 flex items-center justify-between">
{/*                 <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Humidité
                </h3> */}
                {processedData.length > 0 && (
                  <span className="text-xs sm:text-sm text-gray-500">
                    {processedData.length} points
                    {aggregationInterval > 0 && (
                      <span className="ml-1 text-[10px] text-gray-400">
                        ({aggregationInterval}min)
                      </span>
                    )}
                  </span>
                )}
              </div>
              <ReactECharts 
                key={`hum-${sensorId}-${dateRange.type}-${comparisonMode}-${showOutdoorData}`}
                option={humidityChartOption} 
                style={{ height: chartHeight, width: '100%' }}
                opts={{ renderer: 'canvas', locale: 'FR' }}
                notMerge={true}
                lazyUpdate={true}
              />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600">Chargement des données...</span>
                </div>
              </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="text-red-500 mb-2">⚠️</div>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* No Data State */}
          {!loading && !error && data.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="text-gray-400 mb-2">📊</div>
                <p className="text-sm text-gray-600">Aucune donnée disponible</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SensorChart;