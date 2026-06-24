export interface DeviceMap {
  zone1a: string;
  zone1b: string;
  zone2a: string;
  zone2b: string;
  zone3a: string;
  zone3b: string;
}

export interface Zone1Telemetry {
  soil: number;
  temperature: number;
  humidity: number;
  canopyOpen: boolean;
  rainDetected: boolean;
  pumpOn: boolean;
  history: Array<{ time: number; soil: number; temperature: number; humidity: number }>;
}

export interface Zone2Telemetry {
  waterLevel: number;
  feedWeight: number;
  temperature: number;
  humidity: number;
  lux: number;
  servoAngle: number;
  fanSpeed: number;
  lightsOn: boolean;
  attendance: Array<{ uid: string; ts: number }>;
  history: Array<{ time: number; waterLevel: number; feedWeight: number; temperature: number; humidity: number }>;
}

export interface Zone3Telemetry {
  solarVoltage: number;
  solarCurrent: number;
  energyGenerated: number;
  tds: number;
  flowOk: boolean;
  autoTracking: boolean;
  pumpCutoff: boolean;
  history: Array<{ time: number; solarVoltage: number; solarCurrent: number; energyGenerated: number }>;
}

export interface SystemStatus {
  gatewayOnline: boolean;
  lagMs: number;
  activeAlerts: number;
  lastUpdated: number;
}

export interface DashboardTelemetry {
  zone1: Zone1Telemetry;
  zone2: Zone2Telemetry;
  zone3: Zone3Telemetry;
  system: SystemStatus;
}

const now = Date.now();

export const initialMockTelemetry: DashboardTelemetry = {
  zone1: {
    soil: 43,
    temperature: 27,
    humidity: 62,
    canopyOpen: false,
    rainDetected: false,
    pumpOn: false,
    history: Array.from({ length: 10 }).map((_, index) => ({
      time: now - (9 - index) * 180000,
      soil: 40 + index * 2,
      temperature: 24 + index * 0.5,
      humidity: 55 + index,
    })),
  },
  zone2: {
    waterLevel: 32,
    feedWeight: 28,
    temperature: 24,
    humidity: 58,
    lux: 720,
    servoAngle: 90,
    fanSpeed: 45,
    lightsOn: true,
    attendance: [
      { uid: 'RFID-540A', ts: now - 360000 },
      { uid: 'RFID-8F21', ts: now - 540000 },
      { uid: 'RFID-2C73', ts: now - 900000 },
    ],
    history: Array.from({ length: 10 }).map((_, index) => ({
      time: now - (9 - index) * 180000,
      waterLevel: 28 + index * 0.8,
      feedWeight: 24 + index * 0.9,
      temperature: 22 + index * 0.3,
      humidity: 52 + index * 0.7,
    })),
  },
  zone3: {
    solarVoltage: 32.4,
    solarCurrent: 4.8,
    energyGenerated: 12.8,
    tds: 110,
    flowOk: true,
    autoTracking: true,
    pumpCutoff: false,
    history: Array.from({ length: 10 }).map((_, index) => ({
      time: now - (9 - index) * 180000,
      solarVoltage: 28.5 + index * 0.35,
      solarCurrent: 3.6 + index * 0.14,
      energyGenerated: 9.2 + index * 0.45,
    })),
  },
  system: {
    gatewayOnline: true,
    lagMs: 120,
    activeAlerts: 0,
    lastUpdated: now,
  },
};

export function createMockTelemetry(previous: DashboardTelemetry): DashboardTelemetry {
  const nextSoil = Math.max(18, Math.min(78, previous.zone1.soil + (Math.random() * 6 - 3)));
  const nextTemp1 = Math.max(18, Math.min(36, previous.zone1.temperature + (Math.random() * 2 - 1)));
  const nextHum1 = Math.max(35, Math.min(78, previous.zone1.humidity + (Math.random() * 2.5 - 1.2)));
  const nextWater = Math.max(12, Math.min(45, previous.zone2.waterLevel + (Math.random() * 2 - 1)));
  const nextFeed = Math.max(10, Math.min(58, previous.zone2.feedWeight + (Math.random() * 1.2 - 0.6)));
  const nextTemp2 = Math.max(18, Math.min(34, previous.zone2.temperature + (Math.random() * 2 - 1)));
  const nextHum2 = Math.max(38, Math.min(78, previous.zone2.humidity + (Math.random() * 2.5 - 1.2)));
  const nextVolt = Math.max(21, Math.min(37, previous.zone3.solarVoltage + (Math.random() * 0.8 - 0.4)));
  const nextAmp = Math.max(2.8, Math.min(6.6, previous.zone3.solarCurrent + (Math.random() * 0.3 - 0.15)));
  const nextEnergy = Math.max(8, Math.min(18, previous.zone3.energyGenerated + (Math.random() * 0.5 - 0.15)));

  return {
    zone1: {
      ...previous.zone1,
      soil: Number(nextSoil.toFixed(0)),
      temperature: Number(nextTemp1.toFixed(1)),
      humidity: Number(nextHum1.toFixed(0)),
      history: [
        ...previous.zone1.history.slice(1),
        { time: Date.now(), soil: Number(nextSoil.toFixed(0)), temperature: Number(nextTemp1.toFixed(1)), humidity: Number(nextHum1.toFixed(0)) },
      ],
    },
    zone2: {
      ...previous.zone2,
      waterLevel: Number(nextWater.toFixed(0)),
      feedWeight: Number(nextFeed.toFixed(1)),
      temperature: Number(nextTemp2.toFixed(1)),
      humidity: Number(nextHum2.toFixed(0)),
      lux: Math.max(320, Math.min(980, previous.zone2.lux + (Math.random() * 40 - 20))),
      attendance: [
        ...previous.zone2.attendance.slice(-4),
        { uid: `RFID-${Math.floor(1000 + Math.random() * 9000)}`, ts: Date.now() },
      ],
      history: [
        ...previous.zone2.history.slice(1),
        { time: Date.now(), waterLevel: Number(nextWater.toFixed(0)), feedWeight: Number(nextFeed.toFixed(1)), temperature: Number(nextTemp2.toFixed(1)), humidity: Number(nextHum2.toFixed(0)) },
      ],
    },
    zone3: {
      ...previous.zone3,
      solarVoltage: Number(nextVolt.toFixed(1)),
      solarCurrent: Number(nextAmp.toFixed(1)),
      energyGenerated: Number(nextEnergy.toFixed(1)),
      tds: Math.max(95, Math.min(145, previous.zone3.tds + (Math.random() * 4 - 2))),
      flowOk: Math.random() > 0.06,
      history: [
        ...previous.zone3.history.slice(1),
        { time: Date.now(), solarVoltage: Number(nextVolt.toFixed(1)), solarCurrent: Number(nextAmp.toFixed(1)), energyGenerated: Number(nextEnergy.toFixed(1)) },
      ],
    },
    system: {
      gatewayOnline: Math.random() > 0.08,
      lagMs: Math.max(60, Math.min(260, previous.system.lagMs + Math.floor(Math.random() * 20 - 8))),
      activeAlerts: Math.max(0, Math.min(3, previous.system.activeAlerts + (Math.random() > 0.7 ? 1 : -1))),
      lastUpdated: Date.now(),
    },
  };
}
