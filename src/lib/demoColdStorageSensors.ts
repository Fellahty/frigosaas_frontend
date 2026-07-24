/**
 * Simulated cold-storage telemetry for the DEMO tenant.
 * Norms for apple (pommier) long-term storage:
 *   temperature ≈ −0.5 … 2.5 °C (target ~0.5–1.5 °C)
 *   humidity    ≈ 88 … 95 % RH
 * Values drift slowly per room so the UI feels live without jumping.
 */

const DEMO_TENANT_IDS = new Set(['DEMO', 'demo']);

export function isDemoTenant(tenantId: string | null | undefined): boolean {
  return !!tenantId && DEMO_TENANT_IDS.has(tenantId);
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export interface DemoSensorReading {
  temperature: number;
  humidity: number;
  battery: number;
  magnet: number;
  beacons: null;
  timestamp: Date;
  localTime: string;
}

/** Stable, slowly drifting reading for a chamber name (e.g. "Chambre 1"). */
export function getDemoColdStorageReading(
  roomName: string,
  nowMs: number = Date.now()
): DemoSensorReading {
  const seed = hashString(roomName);
  const roomBias = seededUnit(seed, 1); // 0..1

  // Per-room base set points within apple CA norms
  const baseTemp = -0.2 + roomBias * 1.8; // −0.2 … 1.6 °C
  const baseHum = 90 + roomBias * 4; // 90 … 94 %

  // Slow sine drift (~12–18 min period) + tiny tick noise
  const tMin = nowMs / 60_000;
  const period = 12 + seededUnit(seed, 2) * 6;
  const phase = seededUnit(seed, 3) * Math.PI * 2;
  const drift = Math.sin((tMin / period) * Math.PI * 2 + phase);

  // Refresh every ~30s bucket so UI doesn't flicker every render
  const tick = Math.floor(nowMs / 30_000);
  const noiseT = (seededUnit(seed, tick) - 0.5) * 0.25;
  const noiseH = (seededUnit(seed, tick + 99) - 0.5) * 1.2;

  let temperature = baseTemp + drift * 0.6 + noiseT;
  let humidity = baseHum + drift * 1.5 + noiseH;

  // Clamp to safe apple-storage band
  temperature = Math.max(-0.8, Math.min(2.8, temperature));
  humidity = Math.max(87, Math.min(96, humidity));

  // Age reading 15–90s so "il y a Xs" looks realistic
  const ageSec = 15 + Math.floor(seededUnit(seed, tick + 7) * 75);
  const timestamp = new Date(nowMs - ageSec * 1000);

  return {
    temperature: Math.round(temperature * 10) / 10,
    humidity: Math.round(humidity),
    battery: 85 + Math.floor(seededUnit(seed, 5) * 12),
    magnet: seededUnit(seed, tick + 3) > 0.92 ? 1 : 0,
    beacons: null,
    timestamp,
    localTime: timestamp.toLocaleString('fr-FR'),
  };
}

/** Synthetic history series for SensorChart (DEMO). */
export function getDemoColdStorageHistory(
  roomName: string,
  start: Date,
  end: Date,
  stepMinutes = 15
): Array<{ temperature: number; humidity: number; magnet: boolean; epoch: number }> {
  const points: Array<{
    temperature: number;
    humidity: number;
    magnet: boolean;
    epoch: number;
  }> = [];
  const stepMs = stepMinutes * 60_000;
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    const r = getDemoColdStorageReading(roomName, t);
    points.push({
      temperature: r.temperature,
      humidity: r.humidity,
      magnet: r.magnet === 1,
      epoch: Math.floor(t / 1000),
    });
  }
  return points;
}
