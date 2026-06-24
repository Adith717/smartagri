"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildTelemetrySubscribeMessage,
  buildTelemetryWebSocketUrl,
  DeviceMap,
  loginCustomer,
  sendRpc,
  ThingsBoardConfig,
} from './thingsboard';
import { createMockTelemetry, DashboardTelemetry, initialMockTelemetry } from './mockData';

const STORAGE_KEY = 'smart-agri-dashboard-settings';

const defaultDeviceMap: DeviceMap = {
  zone1a: '',
  zone1b: '',
  zone2a: '',
  zone2b: '',
  zone3a: '',
  zone3b: '',
};

const defaultConfig: ThingsBoardConfig = {
  host: '',
  customerEmail: '',
  customerPassword: '',
  deviceMap: defaultDeviceMap,
};

type DeviceZoneKey = Exclude<keyof DashboardTelemetry, 'system'>;

function loadSavedConfig(): ThingsBoardConfig {
  if (typeof window === 'undefined') {
    return defaultConfig;
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return defaultConfig;
    }
    return { ...defaultConfig, ...JSON.parse(saved) } as ThingsBoardConfig;
  } catch {
    return defaultConfig;
  }
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }
  return Boolean(value);
}

export interface ThingsBoardContextValue {
  config: ThingsBoardConfig;
  setConfig: React.Dispatch<React.SetStateAction<ThingsBoardConfig>>;
  connected: boolean;
  statusMessage: string;
  telemetry: DashboardTelemetry;
  isMock: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  runControlAction: (zone: DeviceZoneKey, action: string, payload: unknown) => Promise<void>;
  resetToMock: () => void;
}

export function useThingsBoard(): ThingsBoardContextValue {
  const [config, setConfig] = useState<ThingsBoardConfig>(loadSavedConfig);
  const [telemetry, setTelemetry] = useState<DashboardTelemetry>(initialMockTelemetry);
  const [connected, setConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready for live connection or local preview.');
  const [isMock, setIsMock] = useState(true);
  const [jwtToken, setJwtToken] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  }, [config]);

  useEffect(() => {
    if (!connected && isMock) {
      const interval = window.setInterval(() => {
        setTelemetry((previous) => createMockTelemetry(previous));
      }, 2500);
      return () => window.clearInterval(interval);
    }
    return;
  }, [connected, isMock]);

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setStatusMessage('Disconnected from ThingsBoard. Local preview active.');
    setIsMock(true);
  };

  const resetToMock = () => {
    disconnect();
    setTelemetry(initialMockTelemetry);
    setStatusMessage('Local preview enabled. Enter credentials to connect live.');
  };

  const deviceZoneMap = useMemo(
    () =>
      Object.entries(config.deviceMap).reduce<Record<string, DeviceZoneKey>>((acc, [zone, deviceId]) => {
        if (deviceId) {
          acc[deviceId] = zone as DeviceZoneKey;
        }
        return acc;
      }, {}),
    [config.deviceMap],
  );

  const connect = async () => {
    if (!config.host || !config.customerEmail || !config.customerPassword) {
      setStatusMessage('Enter ThingsBoard host, customer email, and customer password.');
      setIsMock(true);
      return;
    }

    setStatusMessage('Connecting to ThingsBoard...');
    try {
      const token = await loginCustomer(config.host, config.customerEmail, config.customerPassword);
      if (!token) {
        throw new Error('Authentication succeeded but token was not returned.');
      }

      setJwtToken(token);
      setIsMock(false);
      setConnected(true);
      setStatusMessage('Connected to ThingsBoard. Live telemetry stream active.');

      const url = buildTelemetryWebSocketUrl(config.host, token);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatusMessage('WebSocket connected. Subscribing to device telemetry.');
        Object.entries(config.deviceMap).forEach(([zone, deviceId], index) => {
          if (deviceId) {
            ws.send(JSON.stringify(buildTelemetrySubscribeMessage(deviceId, index + 1)));
          }
        });
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.data) {
            const latest = Array.isArray(payload.data) ? payload.data : [payload.data];
            latest.forEach((entry: any) => {
              if (!entry.data) {
                return;
              }

              const deviceId = entry.entityId || entry.deviceId;
              const zone = deviceZoneMap[deviceId];
              if (!zone) {
                return;
              }

              Object.entries(entry.data).forEach(([label, dataPoint]: any) => {
                const value = Array.isArray(dataPoint) ? dataPoint[0]?.value ?? null : dataPoint?.value ?? null;
                if (value === null) {
                  return;
                }
                setTelemetry((previous) => parseTelemetryUpdate(previous, zone, label, value));
              });
            });
          }
        } catch {
          // ignore invalid messages
        }
      };

      ws.onclose = () => {
        setStatusMessage('Live stream closed. Local preview is available.');
        setConnected(false);
        setIsMock(true);
      };

      ws.onerror = () => {
        setStatusMessage('WebSocket error detected. Falling back to local preview.');
        disconnect();
      };
    } catch (error) {
      setStatusMessage(`Live connection failed. Local preview available. ${error instanceof Error ? error.message : ''}`);
      setConnected(false);
      setIsMock(true);
    }
  };

  const runControlAction = async (zone: DeviceZoneKey, action: string, payload: unknown) => {
    if (isMock) {
      return;
    }

    const deviceId = config.deviceMap[zone];
    if (!deviceId) {
      throw new Error('Device ID is required for RPC control when connected live.');
    }

    await sendRpc(config.host, jwtToken, deviceId, action, payload);
  };

  const value = useMemo(
    () => ({
      config,
      setConfig,
      connected,
      statusMessage,
      telemetry,
      isMock,
      connect,
      disconnect,
      runControlAction,
      resetToMock,
    }),
    [config, connected, statusMessage, telemetry, isMock],
  );

  return value;
}

function parseTelemetryUpdate(
  previous: DashboardTelemetry,
  zone: DeviceZoneKey,
  label: string,
  value: unknown,
): DashboardTelemetry {
  const lowerLabel = label.toLowerCase();
  const numericValue = Number(value);
  const boolValue = toBoolean(value);

  switch (zone) {
    case 'zone1a': {
      if (lowerLabel.includes('soil') || lowerLabel.includes('moisture')) {
        return { ...previous, zone1a: { ...previous.zone1a, soilMoisture: numericValue } };
      }
      if (lowerLabel.includes('temperature')) {
        return { ...previous, zone1a: { ...previous.zone1a, temperature: numericValue } };
      }
      if (lowerLabel.includes('humidity')) {
        return { ...previous, zone1a: { ...previous.zone1a, humidity: numericValue } };
      }
      if (lowerLabel.includes('pump') && lowerLabel.includes('speed')) {
        return { ...previous, zone1a: { ...previous.zone1a, pumpSpeed: numericValue } };
      }
      if (lowerLabel.includes('pump')) {
        return { ...previous, zone1a: { ...previous.zone1a, pumpActive: boolValue } };
      }
      if (lowerLabel.includes('redalert') || lowerLabel.includes('red_alert') || lowerLabel.includes('red alert')) {
        return { ...previous, zone1a: { ...previous.zone1a, redAlert: boolValue } };
      }
      if (lowerLabel.includes('greenidle') || lowerLabel.includes('green_idle') || lowerLabel.includes('green idle')) {
        return { ...previous, zone1a: { ...previous.zone1a, greenIdleActive: boolValue } };
      }
      if (lowerLabel.includes('blueirrigation') || lowerLabel.includes('blue_irrigation') || lowerLabel.includes('blue irrigation')) {
        return { ...previous, zone1a: { ...previous.zone1a, blueIrrigationActive: boolValue } };
      }
      if (lowerLabel.includes('online')) {
        return { ...previous, zone1a: { ...previous.zone1a, online: boolValue } };
      }
      return previous;
    }

    case 'zone1b': {
      if (lowerLabel.includes('touch')) {
        return { ...previous, zone1b: { ...previous.zone1b, touchDetected: boolValue } };
      }
      if (lowerLabel.includes('pir') || lowerLabel.includes('motion')) {
        return { ...previous, zone1b: { ...previous.zone1b, pirMotionDetected: boolValue } };
      }
      if (lowerLabel.includes('rain')) {
        return { ...previous, zone1b: { ...previous.zone1b, rainLevel: numericValue } };
      }
      if (lowerLabel.includes('roof') && lowerLabel.includes('angle')) {
        return { ...previous, zone1b: { ...previous.zone1b, roofServoAngle: numericValue } };
      }
      if (lowerLabel.includes('roof') && (lowerLabel.includes('open') || lowerLabel.includes('status'))) {
        return { ...previous, zone1b: { ...previous.zone1b, roofOpen: boolValue } };
      }
      if (lowerLabel.includes('online')) {
        return { ...previous, zone1b: { ...previous.zone1b, online: boolValue } };
      }
      return previous;
    }

    case 'zone2a': {
      if (lowerLabel.includes('temperature')) {
        return { ...previous, zone2a: { ...previous.zone2a, temperature: numericValue } };
      }
      if (lowerLabel.includes('humidity')) {
        return { ...previous, zone2a: { ...previous.zone2a, humidity: numericValue } };
      }
      if (lowerLabel.includes('rfid')) {
        return { ...previous, zone2a: { ...previous.zone2a, lastRFID: String(value) } };
      }
      if (lowerLabel.includes('buzzer')) {
        return { ...previous, zone2a: { ...previous.zone2a, buzzerActive: boolValue } };
      }
      if (lowerLabel.includes('led1')) {
        return { ...previous, zone2a: { ...previous.zone2a, led1Alert: boolValue } };
      }
      if (lowerLabel.includes('led2')) {
        return { ...previous, zone2a: { ...previous.zone2a, led2Alert: boolValue } };
      }
      if (lowerLabel.includes('rtc') || lowerLabel.includes('time')) {
        return { ...previous, zone2a: { ...previous.zone2a, rtcTime: String(value) } };
      }
      if (lowerLabel.includes('online')) {
        return { ...previous, zone2a: { ...previous.zone2a, online: boolValue } };
      }
      return previous;
    }

    case 'zone2b': {
      if (lowerLabel.includes('water') && lowerLabel.includes('trough')) {
        return { ...previous, zone2b: { ...previous.zone2b, waterTroughLevel: numericValue } };
      }
      if (lowerLabel.includes('feed') && lowerLabel.includes('weight')) {
        return { ...previous, zone2b: { ...previous.zone2b, feedWeight: numericValue } };
      }
      if (lowerLabel.includes('lux') || lowerLabel.includes('light')) {
        return { ...previous, zone2b: { ...previous.zone2b, lux: numericValue } };
      }
      if (lowerLabel.includes('fan')) {
        return { ...previous, zone2b: { ...previous.zone2b, fanSpeed: numericValue } };
      }
      if (lowerLabel.includes('auto') && lowerLabel.includes('light')) {
        return { ...previous, zone2b: { ...previous.zone2b, autoLightingActive: boolValue } };
      }
      if (lowerLabel.includes('servo')) {
        return { ...previous, zone2b: { ...previous.zone2b, feedServoAngle: numericValue } };
      }
      if (lowerLabel.includes('dispensed')) {
        return { ...previous, zone2b: { ...previous.zone2b, feedDispensed: boolValue } };
      }
      if (lowerLabel.includes('online')) {
        return { ...previous, zone2b: { ...previous.zone2b, online: boolValue } };
      }
      return previous;
    }

    case 'zone3a': {
      if (lowerLabel.includes('waterlevel') && lowerLabel.includes('secondary')) {
        return { ...previous, zone3a: { ...previous.zone3a, waterLevelSecondary: numericValue } };
      }
      if (lowerLabel.includes('waterlevel') || lowerLabel.includes('level')) {
        return { ...previous, zone3a: { ...previous.zone3a, waterLevel: numericValue } };
      }
      if (lowerLabel.includes('tds')) {
        return { ...previous, zone3a: { ...previous.zone3a, tds: numericValue } };
      }
      if (lowerLabel.includes('pump') && lowerLabel.includes('speed')) {
        return { ...previous, zone3a: { ...previous.zone3a, pumpSpeed: numericValue } };
      }
      if (lowerLabel.includes('pump')) {
        return { ...previous, zone3a: { ...previous.zone3a, pumpActive: boolValue } };
      }
      if (lowerLabel.includes('valve') && lowerLabel.includes('angle')) {
        return { ...previous, zone3a: { ...previous.zone3a, valveServoAngle: numericValue } };
      }
      if (lowerLabel.includes('valve')) {
        return { ...previous, zone3a: { ...previous.zone3a, valveOpen: boolValue } };
      }
      if (lowerLabel.includes('status') && lowerLabel.includes('led')) {
        return { ...previous, zone3a: { ...previous.zone3a, statusLed: boolValue } };
      }
      if (lowerLabel.includes('online')) {
        return { ...previous, zone3a: { ...previous.zone3a, online: boolValue } };
      }
      return previous;
    }

    case 'zone3b': {
      if (lowerLabel.includes('temperature')) {
        return { ...previous, zone3b: { ...previous.zone3b, waterTemperature: numericValue } };
      }
      if (lowerLabel.includes('water') && lowerLabel.includes('present')) {
        return { ...previous, zone3b: { ...previous.zone3b, waterPresent: boolValue } };
      }
      if (lowerLabel.includes('alert') || lowerLabel.includes('led')) {
        return { ...previous, zone3b: { ...previous.zone3b, alertLed: boolValue } };
      }
      if (lowerLabel.includes('buzzer')) {
        return { ...previous, zone3b: { ...previous.zone3b, buzzerActive: boolValue } };
      }
      if (lowerLabel.includes('online')) {
        return { ...previous, zone3b: { ...previous.zone3b, online: boolValue } };
      }
      return previous;
    }

    default:
      return previous;
  }
}
