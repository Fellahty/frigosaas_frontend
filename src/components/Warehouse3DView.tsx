import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
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
  additionalData?: {
    temperature: number;
    humidity: number;
    battery: number;
    magnet: number;
    beacons?: any;
    timestamp: Date;
    localTime?: string;
  };
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  sensorId: string;
  active: boolean;
  athGroupNumber?: number;
  boitieSensorId?: string;
  sensors: Sensor[];
  polygon?: Array<{ lat: number; lng: number }>;
}

interface Warehouse3DViewProps {
  rooms: Room[];
  selectedRoom?: Room | null;
  onRoomClick: (room: Room) => void;
}

// Individual room/chamber component
interface RoomBoxProps {
  room: Room;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
  thermalMode?: boolean;
}

const RoomBox: React.FC<RoomBoxProps> = ({ room, position, isSelected, onClick, thermalMode = false }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Animate the box slightly
  useFrame((state) => {
    if (meshRef.current && (isSelected || hovered)) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.05;
    } else if (meshRef.current) {
      meshRef.current.position.y = position[1];
    }
  });

  // Get thermal camera colors (pure temperature gradient)
  const getThermalColor = (temp: number) => {
    // Thermal imaging gradient: violet → blue → cyan → green → yellow → orange → red
    if (temp < 0) return '#8b5cf6'; // Violet - Freezing
    if (temp < 3) return '#3b82f6'; // Blue - Very cold
    if (temp < 6) return '#06b6d4'; // Cyan - Cold
    if (temp < 9) return '#10b981'; // Green - Cool
    if (temp < 12) return '#eab308'; // Yellow - Normal
    if (temp < 15) return '#f97316'; // Orange - Warm
    return '#ef4444'; // Red - Hot
  };

  // Get modern light color based on temperature
  const getColor = () => {
    const sensor = room.sensors?.[0];
    if (!sensor?.additionalData) return '#cbd5e1'; // Light gray for offline

    const temp = sensor.additionalData.temperature;

    // Thermal mode: pure temperature gradient
    if (thermalMode) {
      return getThermalColor(temp);
    }

    // Normal mode: light modern colors
    if (temp < 5) return '#7dd3fc'; // Light sky blue - Very cold
    if (temp < 10) return '#5eead4'; // Light teal - Normal cold
    if (temp < 15) return '#fcd34d'; // Light yellow - Warm
    return '#fdba74'; // Light orange - Hot
  };

  const color = getColor();
  const sensor = room.sensors?.[0];
  const temp = sensor?.additionalData?.temperature;
  const humidity = sensor?.additionalData?.humidity;

  // Larger chamber dimensions - fixed size so layout spacing stays consistent
  const width = 5.2;
  const height = 4;
  const depth = 5.8;

  return (
    <group position={position}>
      {/* Floor of the room - Light modern */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -height / 2, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Main room interior - Changes based on view mode */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        receiveShadow
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={thermalMode ? color : "#ffffff"}
          emissive={color}
          emissiveIntensity={thermalMode ? 1.2 : (isSelected ? 0.9 : hovered ? 0.7 : 0.5)}
          metalness={thermalMode ? 0.1 : 0.3}
          roughness={thermalMode ? 0.8 : 0.4}
          opacity={thermalMode ? 0.95 : 0.6}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Room walls - Hidden in thermal mode */}
      {!thermalMode && (
        <>
          {/* Back wall */}
          <mesh position={[0, 0, -depth / 2]} castShadow receiveShadow>
            <boxGeometry args={[width, height, 0.15]} />
            <meshStandardMaterial
              color="#ffffff"
              metalness={0.2}
              roughness={0.7}
              opacity={0.9}
              transparent
              emissive={color}
              emissiveIntensity={0.15}
            />
          </mesh>

          {/* Left wall */}
          <mesh position={[-width / 2, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.15, height, depth]} />
            <meshStandardMaterial
              color="#ffffff"
              metalness={0.2}
              roughness={0.7}
              opacity={0.9}
              transparent
              emissive={color}
              emissiveIntensity={0.15}
            />
          </mesh>

          {/* Right wall */}
          <mesh position={[width / 2, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.15, height, depth]} />
            <meshStandardMaterial
              color="#ffffff"
              metalness={0.2}
              roughness={0.7}
              opacity={0.9}
              transparent
              emissive={color}
              emissiveIntensity={0.15}
            />
          </mesh>

          {/* Ceiling/roof of room - Light modern panels */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, height / 2, 0]} receiveShadow>
            <planeGeometry args={[width, depth]} />
            <meshStandardMaterial
              color="#f8fafc"
              metalness={0.4}
              roughness={0.5}
              opacity={0.6}
              transparent
              emissive={color}
              emissiveIntensity={0.2}
            />
          </mesh>
        </>
      )}

      {/* Selection outline with glow */}
      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[width + 0.2, height + 0.2, depth + 0.2]} />
          <meshBasicMaterial color="#a78bfa" wireframe />
        </mesh>
      )}

      {/* Futuristic Holographic Display */}
      <Html position={[0, height / 2 + 0.5, 0]} center>
        <div className="flex flex-col items-center gap-0.5 pointer-events-none">
          {/* Holographic frame */}
          <div className="relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm border border-cyan-400/30 rounded-lg px-3 py-2">
            {/* Scanning line animation */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse"></div>
            </div>
            
            {/* Room number */}
            <div className="text-lg font-bold text-slate-700 mb-0.5" style={{ 
              textShadow: '0 0 8px rgba(255,255,255,0.8)'
            }}>
              #{room.name.replace(/[^0-9]/g, '') || room.name}
            </div>
            
            {/* Temperature with trend */}
            {temp !== undefined && !isNaN(temp) && (
              <div className="flex items-center gap-1">
                <div className="text-base font-bold" style={{
                  color: temp < 5 ? '#0891b2' : temp < 10 ? '#14b8a6' : temp < 15 ? '#ca8a04' : '#ea580c',
                  textShadow: `0 0 6px rgba(255,255,255,0.9)`
                }}>
                  {temp.toFixed(1)}°C
                </div>
                {/* Temperature status icon */}
                <span className="text-xs">
                  {temp < 5 ? '❄️' : temp < 10 ? '✅' : temp < 15 ? '⚠️' : '🔥'}
                </span>
              </div>
            )}

            {/* Humidity bar */}
            {humidity !== undefined && !isNaN(humidity) && (
              <div className="flex items-center gap-1 mt-1">
                <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                    style={{ width: `${Math.min(humidity, 100)}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-slate-600">{humidity.toFixed(0)}%</span>
              </div>
            )}

          </div>
        </div>
      </Html>

      {/* Cold air particles effect for very cold rooms */}
      {temp !== undefined && temp < 3 && (
        <mesh position={[0, height / 4, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial 
            color="#7dd3fc" 
            emissive="#7dd3fc" 
            emissiveIntensity={1.5}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}

      {/* Heat warning indicator for warm rooms */}
      {temp !== undefined && temp > 12 && (
        <mesh position={[0, height / 2 + 1.2, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial 
            color="#fbbf24" 
            emissive="#fbbf24" 
            emissiveIntensity={2}
          />
        </mesh>
      )}

      {/* Advanced Info Panel on Hover - Futuristic */}
      {hovered && sensor?.additionalData && (
        <Html position={[0, height / 2 + 1.5, 0]} center>
          <div className="bg-white/98 backdrop-blur-md rounded-xl p-3 shadow-2xl border-2 border-cyan-300 min-w-[220px]">
            {/* Header with scanning effect */}
            <div className="relative mb-2 pb-2 border-b border-cyan-200">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-100 to-transparent opacity-50 animate-pulse"></div>
              <div className="font-bold text-cyan-700 text-sm flex items-center gap-2 relative">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                {room.name}
              </div>
            </div>
            
            {/* Data Grid */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              {/* Temperature Card */}
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-2 border border-cyan-200">
                <div className="text-[9px] text-slate-600 mb-0.5">Température</div>
                <div className="text-lg font-bold text-cyan-700">
                  {temp !== undefined ? temp.toFixed(1) : '--'}°C
                </div>
                {/* Mini temperature gauge */}
                <div className="w-full h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      temp !== undefined && temp < 5 ? 'bg-cyan-500' : 
                      temp !== undefined && temp < 10 ? 'bg-teal-500' : 
                      temp !== undefined && temp < 15 ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${temp !== undefined ? Math.min((temp / 20) * 100, 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Humidity Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-2 border border-blue-200">
                <div className="text-[9px] text-slate-600 mb-0.5">Humidité</div>
                <div className="text-lg font-bold text-blue-700">
                  {humidity !== undefined ? humidity.toFixed(0) : '--'}%
                </div>
                {/* Humidity gauge */}
                <div className="w-full h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
                    style={{ width: `${humidity !== undefined ? Math.min(humidity, 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Status and Capacity */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg p-2 text-center border border-violet-200">
              <div className="text-[9px] text-slate-600">Groupe</div>
              <div className="text-xs font-bold text-violet-700">FRIGO {room.athGroupNumber || 1}</div>
            </div>

            {/* Action hint */}
            <div className="mt-2 pt-2 border-t border-cyan-200 flex items-center justify-center gap-1">
              <div className="w-1 h-1 bg-cyan-500 rounded-full"></div>
              <span className="text-[10px] text-slate-500">Cliquez pour graphiques détaillés</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

// Scanning radar effect component
const ScanningRadar: React.FC = () => {
  const radarRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (radarRef.current) {
      // Rotate and pulse
      radarRef.current.rotation.y = state.clock.elapsedTime * 0.5;
      radarRef.current.position.y = 0.1 + Math.sin(state.clock.elapsedTime) * 0.05;
    }
  });

  return (
    <mesh ref={radarRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0, 30, 64, 1, 0, Math.PI / 3]} />
      <meshStandardMaterial 
        color="#06b6d4" 
        emissive="#06b6d4" 
        emissiveIntensity={1.5}
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// Outdoor Weather Station Component - 3D Object
interface OutdoorWeatherStationProps {
  temperature: number;
  humidity: number;
  position: [number, number, number];
}

const OutdoorWeatherStation: React.FC<OutdoorWeatherStationProps> = ({ temperature, humidity, position }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Subtle breathing animation
  useFrame((state) => {
    if (meshRef.current) {
      const breathe = Math.sin(state.clock.elapsedTime * 2) * 0.05;
      meshRef.current.scale.set(1 + breathe, 1 + breathe, 1 + breathe);
    }
  });

  return (
    <group position={position}>
      {/* Ground platform - small circular base */}
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.2, 32]} />
        <meshStandardMaterial 
          color="#94a3b8" 
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      
      {/* Modern compact base - sleek pole */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 2, 12]} />
        <meshStandardMaterial 
          color="#e5e7eb" 
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Modern compact device - cube shape */}
      <mesh 
        ref={meshRef}
        position={[0, 1.8, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial 
          color={hovered ? '#ffffff' : '#f8fafc'}
          emissive={hovered ? '#fb923c' : '#f97316'}
          emissiveIntensity={hovered ? 0.3 : 0.15}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>
      
      {/* Orange accent strip */}
      <mesh position={[0, 1.8, 0.41]}>
        <boxGeometry args={[0.82, 0.2, 0.02]} />
        <meshStandardMaterial 
          color="#f97316"
          emissive="#f97316"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Small solar panel on top */}
      <mesh position={[0, 2.3, 0]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.6, 0.02, 0.4]} />
        <meshStandardMaterial 
          color="#1e293b"
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      
      {/* Green status LED */}
      <mesh position={[0.3, 2.2, 0.41]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial 
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={3}
        />
      </mesh>
      
      {/* Ambient orange glow light around the station */}
      <pointLight position={[0, 2, 0]} intensity={1.5} color="#f97316" distance={5} />

      {/* Compact Floating Info Panel - Ultra Modern */}
      <Html position={[0, 2.8, 0]} center>
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl blur-sm opacity-40 animate-pulse"></div>
          
          {/* Main compact card */}
          <div className="relative bg-gradient-to-br from-white/95 to-orange-50/95 backdrop-blur-xl rounded-xl p-2 shadow-xl border border-orange-300 min-w-[100px]">
            {/* Ultra compact header */}
            <div className="flex items-center gap-1 mb-1.5 pb-1 border-b border-orange-200/50">
              <div className="w-4 h-4 bg-gradient-to-br from-orange-500 to-amber-500 rounded flex items-center justify-center shadow">
                <span className="text-[10px]">☀️</span>
              </div>
              <div className="text-[9px] font-bold text-orange-900">Ext</div>
              <div className="flex-1"></div>
              <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            
            {/* Ultra compact data */}
            <div className="flex gap-1.5">
              <div className="flex-1 bg-gradient-to-br from-red-50 to-orange-50 rounded p-1 border border-red-200/50">
                <div className="text-center">
                  <div className="text-sm font-bold text-red-700 leading-none">
                    {temperature.toFixed(1)}°
                  </div>
                  <div className="text-[7px] text-red-600 font-semibold mt-0.5">TEMP</div>
                </div>
              </div>
              
              <div className="flex-1 bg-gradient-to-br from-blue-50 to-cyan-50 rounded p-1 border border-blue-200/50">
                <div className="text-center">
                  <div className="text-sm font-bold text-blue-700 leading-none">
                    {humidity.toFixed(0)}%
                  </div>
                  <div className="text-[7px] text-blue-600 font-semibold mt-0.5">HUM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
};

// Main warehouse scene
const Warehouse3DView: React.FC<Warehouse3DViewProps> = ({ rooms, selectedRoom, onRoomClick }) => {
  const { t } = useTranslation();
  const [internalSelectedRoom, setInternalSelectedRoom] = useState<Room | null>(selectedRoom || null);
  const [showThermalView, setShowThermalView] = useState(false);
  const [outdoorWeather, setOutdoorWeather] = useState<{ temperature: number; humidity: number; } | null>(null);
  
  // Fetch outdoor weather data
  useEffect(() => {
    const fetchOutdoorWeather = async () => {
      try {
        // Midelt, Morocco coordinates
        const lat = 32.6852;
        const lng = -4.7371;
        
        // Get current weather (today only)
        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m&timezone=auto`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Weather API error');
        
        const data = await response.json();
        
        if (data.current) {
          setOutdoorWeather({
            temperature: data.current.temperature_2m,
            humidity: data.current.relative_humidity_2m
          });
          console.log('✅ [Warehouse3D] Outdoor weather loaded:', data.current);
        }
      } catch (error) {
        console.error('❌ [Warehouse3D] Error fetching outdoor weather:', error);
      }
    };
    
    fetchOutdoorWeather();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchOutdoorWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Positions driven by chamber number + FRIGO group (not fragile array index)
  const roomPositions = useMemo(() => {
    const positions: Map<string, [number, number, number]> = new Map();

    const getChamberNumber = (name: string): number => {
      const m = name.match(/(?:chambre|ch|couloir)\s*(\d+)/i) || name.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };

    const roomWidth = 5.2;
    const roomDepth = 5.8;
    const aisleWidth = 8;
    const roomSpacing = roomDepth + 2.2; // clear gap so boxes never stack

    // Detect how groups are represented in the current view
    const groups = new Map<number, typeof rooms>();
    for (const room of rooms) {
      const chNum = getChamberNumber(room.name);
      const group =
        room.athGroupNumber ||
        (chNum > 0 && chNum <= 6 ? 1 : chNum > 6 ? 2 : 1);
      const list = groups.get(group) ?? [];
      list.push(room);
      groups.set(group, list);
    }

    const groupIds = [...groups.keys()].sort((a, b) => a - b);
    const multiGroup = groupIds.length > 1;

    for (const groupId of groupIds) {
      const groupRooms = (groups.get(groupId) ?? []).slice().sort((a, b) => {
        return getChamberNumber(a.name) - getChamberNumber(b.name);
      });

      // Multi-FRIGO (tab "Toutes"): whole FRIGO on one side of the corridor
      // Single FRIGO tab: alternate left/right facing the aisle
      groupRooms.forEach((room, index) => {
        let isLeftSide: boolean;
        let rowIndex: number;

        if (multiGroup) {
          isLeftSide = groupId === groupIds[0];
          rowIndex = index;
        } else {
          isLeftSide = index % 2 === 0;
          rowIndex = Math.floor(index / 2);
        }

        const countOnSide = multiGroup
          ? groupRooms.length
          : Math.ceil(groupRooms.length / 2);
        const z =
          rowIndex * roomSpacing -
          ((countOnSide - 1) * roomSpacing) / 2;

        const x = isLeftSide
          ? -(aisleWidth / 2 + roomWidth / 2)
          : aisleWidth / 2 + roomWidth / 2;
        const y = 2;

        const key = room.id || room.name;
        positions.set(key, [x, y, z]);
        if (room.id && room.name) {
          positions.set(room.name, [x, y, z]);
        }
      });
    }

    return positions;
  }, [rooms]);

  const handleRoomClick = (room: Room) => {
    setInternalSelectedRoom(room);
    onRoomClick(room);
  };

  React.useEffect(() => {
    if (selectedRoom) {
      setInternalSelectedRoom(selectedRoom);
    }
  }, [selectedRoom]);

  return (
    <div className="bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 rounded-2xl border border-slate-300 shadow-2xl overflow-hidden relative" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
      <Canvas
        shadows
        camera={{ position: [0, 18, 50], fov: 65 }}
        gl={{ antialias: true }}
      >
        {/* Modern light environment */}
        <ambientLight intensity={0.8} color="#ffffff" />
        <directionalLight
          position={[0, 25, 10]}
          intensity={2}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        {/* Soft accent lights - Pastel modern colors */}
        <pointLight position={[-10, 10, -10]} intensity={0.6} color="#7dd3fc" />
        <pointLight position={[10, 10, 10]} intensity={0.6} color="#a5f3fc" />
        <pointLight position={[0, 10, 0]} intensity={0.5} color="#bae6fd" />
        <pointLight position={[-10, 8, 10]} intensity={0.4} color="#5eead4" />
        <pointLight position={[10, 8, -10]} intensity={0.4} color="#99f6e4" />

        {/* Ground plane - Light modern floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.2} roughness={0.8} />
        </mesh>

        {/* Grid helper - Light modern grid */}
        <gridHelper args={[100, 50, '#cbd5e1', '#e2e8f0']} position={[0, 0.01, 0]} />

        {/* Scanning Radar Effect */}
        <ScanningRadar />

        {/* IoT Network Connections - Data flow visualization */}
        {rooms.slice(0, -1).map((room, index) => {
          const pos1 =
            roomPositions.get(room.id) ||
            roomPositions.get(room.name) ||
            [0, 2, 0];
          const nextRoom = rooms[index + 1];
          if (!nextRoom) return null;
          const pos2 =
            roomPositions.get(nextRoom.id) ||
            roomPositions.get(nextRoom.name) ||
            [0, 2, 0];
          
          const distance = Math.sqrt(
            Math.pow(pos2[0] - pos1[0], 2) + 
            Math.pow(pos2[1] - pos1[1], 2) + 
            Math.pow(pos2[2] - pos1[2], 2)
          );
          
          const midX = (pos1[0] + pos2[0]) / 2;
          const midY = (pos1[1] + pos2[1]) / 2 + 2.5;
          const midZ = (pos1[2] + pos2[2]) / 2;
          
          // Calculate rotation to point from pos1 to pos2
          const dx = pos2[0] - pos1[0];
          const dy = pos2[1] - pos1[1];
          const dz = pos2[2] - pos1[2];
          const rotationY = Math.atan2(dx, dz);
          const rotationZ = Math.atan2(Math.sqrt(dx * dx + dz * dz), dy) - Math.PI / 2;
          
          return (
            <mesh 
              key={`connection-${index}`} 
              position={[midX, midY, midZ]}
              rotation={[0, rotationY, rotationZ]}
            >
              <cylinderGeometry args={[0.015, 0.015, distance, 8]} />
              <meshStandardMaterial 
                color="#7dd3fc" 
                emissive="#06b6d4" 
                emissiveIntensity={0.9}
                transparent
                opacity={0.5}
              />
            </mesh>
          );
        })}

        {/* Central corridor - Wide polished aisle */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
          <planeGeometry args={[6, 80]} />
          <meshStandardMaterial 
            color="#f1f5f9" 
            metalness={0.5} 
            roughness={0.3}
            emissive="#bae6fd"
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* Aisle edge lines - Modern cyan markings */}
        <mesh position={[-3, 0.03, 0]}>
          <boxGeometry args={[0.15, 0.02, 80]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[3, 0.03, 0]}>
          <boxGeometry args={[0.15, 0.02, 80]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.7} />
        </mesh>

        {/* Center line - Teal guide */}
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.1, 0.01, 80]} />
          <meshStandardMaterial color="#14b8a6" emissive="#14b8a6" emissiveIntensity={0.6} />
        </mesh>

        {/* WAREHOUSE BUILDING STRUCTURE - Modern Light Glass */}
        {/* Left External Wall */}
        <mesh position={[-17, 4, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.25, 8, 80]} />
          <meshStandardMaterial 
            color="#e0f2fe" 
            metalness={0.4} 
            roughness={0.3}
            opacity={0.5}
            transparent
            emissive="#bae6fd"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Right External Wall */}
        <mesh position={[17, 4, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.25, 8, 80]} />
          <meshStandardMaterial 
            color="#e0f2fe" 
            metalness={0.4} 
            roughness={0.3}
            opacity={0.5}
            transparent
            emissive="#bae6fd"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Back Wall */}
        <mesh position={[0, 4, -40]} receiveShadow castShadow>
          <boxGeometry args={[34, 8, 0.25]} />
          <meshStandardMaterial 
            color="#e0f2fe" 
            metalness={0.4} 
            roughness={0.3}
            opacity={0.5}
            transparent
            emissive="#bae6fd"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Front Wall (with large opening) */}
        <mesh position={[-13, 4, 40]} receiveShadow castShadow>
          <boxGeometry args={[8, 8, 0.25]} />
          <meshStandardMaterial 
            color="#e0f2fe" 
            metalness={0.4} 
            roughness={0.3}
            opacity={0.5}
            transparent
            emissive="#bae6fd"
            emissiveIntensity={0.15}
          />
        </mesh>
        <mesh position={[13, 4, 40]} receiveShadow castShadow>
          <boxGeometry args={[8, 8, 0.25]} />
          <meshStandardMaterial 
            color="#e0f2fe" 
            metalness={0.4} 
            roughness={0.3}
            opacity={0.5}
            transparent
            emissive="#bae6fd"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Roof Structure - V Inversé - Modern Glass Left Side */}
        <mesh rotation={[0, 0, Math.PI / 5.5]} position={[-8.5, 10, 0]} receiveShadow castShadow>
          <boxGeometry args={[22, 0.2, 80.4]} />
          <meshStandardMaterial 
            color="#f0f9ff" 
            metalness={0.6} 
            roughness={0.2}
            opacity={0.4}
            transparent
            emissive="#7dd3fc"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Roof Structure - V Inversé - Right Side */}
        <mesh rotation={[0, 0, -Math.PI / 5.5]} position={[8.5, 10, 0]} receiveShadow castShadow>
          <boxGeometry args={[22, 0.2, 80.4]} />
          <meshStandardMaterial 
            color="#f0f9ff" 
            metalness={0.6} 
            roughness={0.2}
            opacity={0.4}
            transparent
            emissive="#7dd3fc"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Ridge beam at top - Modern metallic */}
        <mesh position={[0, 14, 0]} castShadow>
          <boxGeometry args={[0.3, 0.3, 80.4]} />
          <meshStandardMaterial 
            color="#bae6fd" 
            metalness={0.9} 
            roughness={0.1}
            emissive="#7dd3fc"
            emissiveIntensity={0.6}
          />
        </mesh>

        {/* Roof Support Beams - Modern Light Metal */}
        {[-35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35].map((z) => (
          <group key={`beam-group-${z}`}>
            {/* Left roof beam */}
            <mesh position={[-8.5, 10, z]} rotation={[0, 0, Math.PI / 5.5]} castShadow>
              <boxGeometry args={[22, 0.12, 0.2]} />
              <meshStandardMaterial 
                color="#bae6fd" 
                metalness={0.85} 
                roughness={0.15} 
                emissive="#7dd3fc" 
                emissiveIntensity={0.25}
              />
            </mesh>
            {/* Right roof beam */}
            <mesh position={[8.5, 10, z]} rotation={[0, 0, -Math.PI / 5.5]} castShadow>
              <boxGeometry args={[22, 0.12, 0.2]} />
              <meshStandardMaterial 
                color="#bae6fd" 
                metalness={0.85} 
                roughness={0.15} 
                emissive="#7dd3fc" 
                emissiveIntensity={0.25}
              />
            </mesh>
          </group>
        ))}

        {/* Support Columns - Modern Light Metal */}
        {[
          [-16.5, -38],
          [16.5, -38],
          [-16.5, -30],
          [16.5, -30],
          [-16.5, -22],
          [16.5, -22],
          [-16.5, -14],
          [16.5, -14],
          [-16.5, -6],
          [16.5, -6],
          [-16.5, 2],
          [16.5, 2],
          [-16.5, 10],
          [16.5, 10],
          [-16.5, 18],
          [16.5, 18],
          [-16.5, 26],
          [16.5, 26],
          [-16.5, 34],
          [16.5, 34],
          [-16.5, 38],
          [16.5, 38],
        ].map(([x, z], i) => (
          <mesh key={`column-${i}`} position={[x, 4, z]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 8, 12]} />
            <meshStandardMaterial 
              color="#cbd5e1" 
              metalness={0.8} 
              roughness={0.2}
              emissive="#7dd3fc"
              emissiveIntensity={0.3}
            />
          </mesh>
        ))}

        {/* Warehouse Sign - Modern light panel */}
        <mesh position={[0, 7, 40.1]} receiveShadow>
          <boxGeometry args={[20, 3, 0.15]} />
          <meshStandardMaterial 
            color="#bae6fd" 
            metalness={0.6} 
            roughness={0.3}
            emissive="#7dd3fc"
            emissiveIntensity={0.6}
          />
        </mesh>

        {/* Room boxes */}
        {rooms.map((room) => {
          const position =
            roomPositions.get(room.id) ||
            roomPositions.get(room.name) ||
            [0, 2, 0];
          return (
            <RoomBox
              key={room.id || room.name}
              room={room}
              position={position}
              isSelected={internalSelectedRoom?.id === room.id}
              onClick={() => handleRoomClick(room)}
              thermalMode={showThermalView}
            />
          );
        })}

        {/* Outdoor Weather Station - Positioned far outside warehouse */}
        {outdoorWeather && (
          <OutdoorWeatherStation
            temperature={outdoorWeather.temperature}
            humidity={outdoorWeather.humidity}
            position={[35, 0, -15]} // Far to the right and slightly back
          />
        )}

        {/* Warehouse title - Modern */}
        <Html position={[0, 12, -38]} center>
          <div className="text-3xl font-bold text-cyan-600 pointer-events-none" style={{
            textShadow: '0 0 10px #7dd3fc, 1px 1px 3px rgba(0,0,0,0.3)',
            letterSpacing: '3px'
          }}>
            {t('sensors.warehouseTitle')}
          </div>
        </Html>

        {/* Camera controls - Optimized for spacious warehouse */}
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={20}
          maxDistance={90}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 4, 0]}
          enableDamping
          dampingFactor={0.05}
        />

        {/* Fog for depth - Light modern */}
        <fog attach="fog" args={['#e0f2fe', 40, 100]} />
      </Canvas>

      {/* Legend overlay - Modern Light */}
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-white/95 backdrop-blur-md rounded-xl p-3 md:p-4 shadow-2xl border border-cyan-200 max-w-[180px] md:max-w-xs">
        <div className="text-xs md:text-sm font-bold text-cyan-600 mb-2 md:mb-3 flex items-center gap-1 md:gap-2">
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
          <span className="hidden md:inline">{t('sensors.legend')}</span>
          <span className="md:hidden">Temp</span>
        </div>
        <div className="space-y-1 md:space-y-1.5">
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-sm shadow-lg flex-shrink-0" style={{ backgroundColor: '#7dd3fc', boxShadow: '0 0 10px #7dd3fc' }}></div>
            <span className="text-[10px] md:text-xs text-cyan-700 font-medium">&lt; 5°C</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-sm shadow-lg flex-shrink-0" style={{ backgroundColor: '#5eead4', boxShadow: '0 0 10px #5eead4' }}></div>
            <span className="text-[10px] md:text-xs text-teal-700 font-medium">5-10°C</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-sm shadow-lg flex-shrink-0" style={{ backgroundColor: '#fcd34d', boxShadow: '0 0 10px #fcd34d' }}></div>
            <span className="text-[10px] md:text-xs text-yellow-700 font-medium">10-15°C</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-sm shadow-lg flex-shrink-0" style={{ backgroundColor: '#fdba74', boxShadow: '0 0 10px #fdba74' }}></div>
            <span className="text-[10px] md:text-xs text-orange-700 font-medium">&gt; 15°C</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-sm shadow-lg flex-shrink-0" style={{ backgroundColor: '#fda4af', boxShadow: '0 0 15px #fda4af' }}></div>
            <span className="text-[10px] md:text-xs font-bold text-rose-700">🚨 {t('sensors.doorOpen')}</span>
          </div>
        </div>
      </div>

      {/* Compact Control Panel - Simple & French */}
      <div className="absolute top-3 left-3 md:top-4 md:left-4 bg-white/98 backdrop-blur-xl rounded-xl p-2.5 shadow-xl border border-gray-200">
        {/* Header compact */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-bold text-gray-700">LIVE</span>
        </div>
        
        {/* Stats ultra-compact */}
        <div className="flex gap-1.5 mb-2">
          <div className="flex-1 bg-cyan-50 rounded-lg p-1.5 border border-cyan-200/50">
            <div className="text-[8px] text-gray-500 font-medium">Total</div>
            <div className="text-base font-bold text-cyan-600">{rooms.length}</div>
          </div>
          <div className="flex-1 bg-blue-50 rounded-lg p-1.5 border border-blue-200/50">
            <div className="text-[8px] text-gray-500 font-medium">T° Moy</div>
            <div className="text-base font-bold text-blue-600">
              {(rooms.reduce((sum, r) => sum + (r.sensors?.[0]?.additionalData?.temperature || 0), 0) / rooms.length).toFixed(1)}°
            </div>
          </div>
        </div>
        
        <div className="flex gap-1.5 mb-2">
          <div className="flex-1 bg-green-50 rounded-lg p-1.5 border border-green-200/50">
            <div className="text-[8px] text-gray-500 font-medium">OK</div>
            <div className="text-base font-bold text-green-600">
              {rooms.filter((r) => r.sensors?.[0]?.additionalData?.magnet !== 0 && (r.sensors?.[0]?.additionalData?.temperature || 0) < 10).length}
            </div>
          </div>
          <div className="flex-1 bg-red-50 rounded-lg p-1.5 border border-red-200/50">
            <div className="text-[8px] text-gray-500 font-medium">Alerte</div>
            <div className="text-base font-bold text-red-600">
              {rooms.filter((r) => r.sensors?.[0]?.additionalData?.magnet === 0).length}
            </div>
          </div>
        </div>

        {/* Thermal toggle compact */}
        <button
          onClick={() => setShowThermalView(!showThermalView)}
          className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all ${
            showThermalView 
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {showThermalView ? '🌡️ Thermique' : '🔍 Normal'}
        </button>
      </div>
      
      {/* Thermal View Indicator & Scale */}
      {showThermalView && (
        <div className="absolute top-3 right-3 md:top-6 md:right-6 bg-gradient-to-br from-gray-900/98 to-black/98 backdrop-blur-md rounded-xl p-3 shadow-2xl border-2 border-orange-500">
          <div className="text-xs font-bold flex items-center gap-1.5 mb-2" style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
            {t('sensors.thermal.title')}
          </div>
          
          {/* Thermal gradient scale */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-full h-2.5 rounded-sm shadow-lg" style={{ background: 'linear-gradient(to right, #a78bfa, #60a5fa, #22d3ee, #34d399, #fbbf24, #fb923c, #f87171)' }}></div>
            </div>
            <div className="flex justify-between text-[9px] font-semibold mb-1.5" style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
              <span>❄️ {t('sensors.thermal.minTemp')}</span>
              <span>🔥 {t('sensors.thermal.maxTemp')}</span>
            </div>
            <div className="space-y-0.5 text-[10px] font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-2.5 rounded-sm shadow-md border border-violet-400/30" style={{ backgroundColor: '#a78bfa' }}></div>
                <span style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{t('sensors.thermal.ranges.freezing')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-2.5 rounded-sm shadow-md border border-blue-400/30" style={{ backgroundColor: '#60a5fa' }}></div>
                <span style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{t('sensors.thermal.ranges.veryCold')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-2.5 rounded-sm shadow-md border border-cyan-400/30" style={{ backgroundColor: '#22d3ee' }}></div>
                <span style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{t('sensors.thermal.ranges.cold')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-2.5 rounded-sm shadow-md border border-emerald-400/30" style={{ backgroundColor: '#34d399' }}></div>
                <span style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{t('sensors.thermal.ranges.cool')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-2.5 rounded-sm shadow-md border border-yellow-400/30" style={{ backgroundColor: '#fbbf24' }}></div>
                <span style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{t('sensors.thermal.ranges.normal')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-2.5 rounded-sm shadow-md border border-orange-400/30" style={{ backgroundColor: '#fb923c' }}></div>
                <span style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{t('sensors.thermal.ranges.warm')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-2.5 rounded-sm shadow-md border border-red-400/30" style={{ backgroundColor: '#f87171' }}></div>
                <span style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{t('sensors.thermal.ranges.hot')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warehouse3DView;

