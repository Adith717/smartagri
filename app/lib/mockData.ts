export interface Zone1ATelemetry {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  pumpSpeed: number;
  pumpActive: boolean;
  redAlert: boolean;
  greenIdleActive: boolean;
  blueIrrigationActive: boolean;
  online: boolean;
}

export interface Zone1BTelemetry {
  touchDetected: boolean;
  pirMotionDetected: boolean;
  rainLevel: number;
  roofServoAngle: number;
  roofOpen: boolean;
  online: boolean;
}

export interface Zone2ATelemetry {
  temperature: number;
  humidity: number;
  rfidScans: Array<{ uid: string; ts: number }>;
  buzzerActive: boolean;
  led1Alert: boolean;
  led2Alert: boolean;
  rtcTime: string;
  online: boolean;
}

export interface Zone2BTelemetry {
  waterTroughLevel: number;
  feedWeight: number;
  lux: number;
  fanSpeed: number;
  autoLightingActive: boolean;
  feedServoAngle: number;
  feedDispensed: boolean;
  online: boolean;
}

export interface Zone3ATelemetry {
  waterLevel: number;
  waterLevelSecondary: number;
  tds: number;
  pumpSpeed: number;
  pumpActive: boolean;
  valveServoAngle: number;
  valveOpen: boolean;
  statusLed: boolean;
  online: boolean;
}

export interface Zone3BTelemetry {
  waterTemperature: number;
  waterPresent: boolean;
  alertLed: boolean;
  buzzerActive: boolean;
  online: boolean;
}

export interface SystemStatus {
  gatewayOnline: boolean;
  lagMs: number;
  activeAlerts: number;
  lastUpdated: number;
  zone1aOnline: boolean;
  zone1bOnline: boolean;
  zone2aOnline: boolean;
  zone2bOnline: boolean;
  zone3aOnline: boolean;
  zone3bOnline: boolean;
}

export interface DashboardTelemetry {
  zone1a: Zone1ATelemetry;
  zone1b: Zone1BTelemetry;
  zone2a: Zone2ATelemetry;
  zone2b: Zone2BTelemetry;
  zone3a: Zone3ATelemetry;
  zone3b: Zone3BTelemetry;
  system: SystemStatus;
}

const now = Date.now();

export const initialMockTelemetry: DashboardTelemetry = {
  zone1a: {
    temperature: 27,
    humidity: 62,
    soilMoisture: 45,
    pumpSpeed: 0,
    pumpActive: false,
    redAlert: false,
    greenIdleActive: true,
    blueIrrigationActive: false,
    online: true,
  },
  zone1b: {
    touchDetected: false,
    pirMotionDetected: false,
    rainLevel: 0,
    roofServoAngle: 0,
    roofOpen: false,
    online: true,
  },
  zone2a: {
    temperature: 24,
    humidity: 58,
    rfidScans: [{ uid: 'RFID-001', ts: now - 3600000 }],
    buzzerActive: false,
    led1Alert: false,
    led2Alert: false,
    rtcTime: new Date().toLocaleTimeString(),
    online: true,
  },
  zone2b: {
    waterTroughLevel: 32,
    feedWeight: 28,
    lux: 720,
    fanSpeed: 45,
    autoLightingActive: true,
    feedServoAngle: 45,
    feedDispensed: false,
    online: true,
  },
  zone3a: {
    waterLevel: 65,
    waterLevelSecondary: 60,
    tds: 110,
    pumpSpeed: 0,
    pumpActive: false,
    valveServoAngle: 0,
    valveOpen: false,
    statusLed: false,
    online: true,
  },
  zone3b: {
    waterTemperature: 22,
    waterPresent: true,
    alertLed: false,
    buzzerActive: false,
    online: true,
  },
  system: {
    gatewayOnline: true,
    lagMs: 120,
    activeAlerts: 0,
    lastUpdated: now,
    zone1aOnline: true,
    zone1bOnline: true,
    zone2aOnline: true,
    zone2bOnline: true,
    zone3aOnline: true,
    zone3bOnline: true,
  },
};

export function createMockTelemetry(previous: DashboardTelemetry): DashboardTelemetry {
  const nextMoisture = Math.max(20, Math.min(80, previous.zone1a.soilMoisture + (Math.random() * 4 - 2)));
  const nextTemp1a = Math.max(18, Math.min(40, previous.zone1a.temperature + (Math.random() * 1 - 0.5)));
  const nextHum1a = Math.max(35, Math.min(90, previous.zone1a.humidity + (Math.random() * 2 - 1)));
  const nextRainLevel = Math.max(0, Math.min(100, previous.zone1b.rainLevel + (Math.random() * 10 - 5)));

  const nextTemp2a = Math.max(18, Math.min(34, previous.zone2a.temperature + (Math.random() * 1 - 0.5)));
  const nextHum2a = Math.max(35, Math.min(90, previous.zone2a.humidity + (Math.random() * 2 - 1)));
  const nextWaterTrough = Math.max(10, Math.min(50, previous.zone2b.waterTroughLevel + (Math.random() * 2 - 1)));
  const nextFeedWeight = Math.max(5, Math.min(60, previous.zone2b.feedWeight + (Math.random() * 1 - 0.5)));
  const nextLux = Math.max(100, Math.min(1000, previous.zone2b.lux + (Math.random() * 40 - 20)));

  const nextWaterLevel = Math.max(20, Math.min(100, previous.zone3a.waterLevel + (Math.random() * 2 - 1)));
  const nextWaterLevel2 = Math.max(15, Math.min(95, previous.zone3a.waterLevelSecondary + (Math.random() * 2 - 1)));
  const nextTds = Math.max(80, Math.min(150, previous.zone3a.tds + (Math.random() * 4 - 2)));
  const nextWaterTemp = Math.max(15, Math.min(35, previous.zone3b.waterTemperature + (Math.random() * 1 - 0.5)));
  const nextWaterPresent = Math.random() > 0.05;

  // Auto-control thresholds
  const shouldActivatePump1a = nextMoisture < 30;
  const shouldOpenRoof = nextRainLevel > 70;
  const shouldActivateFan = nextTemp2a > 28;
  const shouldAutoLight = nextLux < 300;
  const shouldActivateWaterPump = nextWaterLevel < 40;
  const shouldOpenValve = shouldActivateWaterPump;
  const shouldAlertTds = nextTds > 130;
  const shouldAlert = shouldAlertTds || nextWaterLevel < 30 || !nextWaterPresent;

  return {
    zone1a: {
      ...previous.zone1a,
      temperature: Number(nextTemp1a.toFixed(1)),
      humidity: Number(nextHum1a.toFixed(0)),
      soilMoisture: Number(nextMoisture.toFixed(0)),
      pumpActive: shouldActivatePump1a,
      pumpSpeed: shouldActivatePump1a ? 80 : 0,
      redAlert: shouldActivatePump1a,
      greenIdleActive: !shouldActivatePump1a,
      blueIrrigationActive: shouldActivatePump1a,
    },
    zone1b: {
      ...previous.zone1b,
      rainLevel: Number(nextRainLevel.toFixed(0)),
      roofOpen: !shouldOpenRoof,
      roofServoAngle: shouldOpenRoof ? 90 : 0,
    },
    zone2a: {
      ...previous.zone2a,
      temperature: Number(nextTemp2a.toFixed(1)),
      humidity: Number(nextHum2a.toFixed(0)),
      rtcTime: new Date().toLocaleTimeString(),
    },
    zone2b: {
      ...previous.zone2b,
      waterTroughLevel: Number(nextWaterTrough.toFixed(0)),
      feedWeight: Number(nextFeedWeight.toFixed(1)),
      lux: Number(nextLux.toFixed(0)),
      fanSpeed: shouldActivateFan ? 75 : 30,
      autoLightingActive: shouldAutoLight,
    },
    zone3a: {
      ...previous.zone3a,
      waterLevel: Number(nextWaterLevel.toFixed(0)),
      waterLevelSecondary: Number(nextWaterLevel2.toFixed(0)),
      tds: Number(nextTds.toFixed(0)),
      pumpActive: shouldActivateWaterPump,
      pumpSpeed: shouldActivateWaterPump ? 90 : 0,
      valveOpen: shouldOpenValve,
      valveServoAngle: shouldOpenValve ? 90 : 0,
      statusLed: shouldActivateWaterPump || shouldAlertTds,
    },
    zone3b: {
      ...previous.zone3b,
      waterTemperature: Number(nextWaterTemp.toFixed(1)),
      waterPresent: nextWaterPresent,
      alertLed: shouldAlert,
      buzzerActive: shouldAlert,
    },
    system: {
      ...previous.system,
      activeAlerts: (shouldActivatePump1a ? 1 : 0) + (shouldAlert ? 1 : 0),
      lastUpdated: Date.now(),
    },
  };
}
