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

export interface ThingsBoardContextValue {
  config: ThingsBoardConfig;
  setConfig: React.Dispatch<React.SetStateAction<ThingsBoardConfig>>;
  connected: boolean;
  statusMessage: string;
  telemetry: DashboardTelemetry;
  isMock: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  runControlAction: (zone: 'zone1' | 'zone2' | 'zone3', action: string, payload: unknown) => Promise<void>;
  resetToMock: () => void;
}

export function useThingsBoard(): ThingsBoardContextValue {
  const [config, setConfig] = useState<ThingsBoardConfig>(() => {
    if (typeof window === 'undefined') {
      return defaultConfig;
    }
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as ThingsBoardConfig;
      }
    } catch {
      // ignore invalid storage
    }
    return defaultConfig;
  });
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
        Object.values(config.deviceMap).forEach((deviceId, index) => {
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
              if (!entry.data) return;
              Object.entries(entry.data).forEach(([label, dataPoint]: any) => {
                const value = Array.isArray(dataPoint) ? dataPoint[0]?.value ?? null : dataPoint?.value ?? null;
                if (value === null) return;
                setTelemetry((previous) => {
                  if (label.includes('soil') || label.includes('moisture')) {
                    return {
                      ...previous,
                      zone1: {
                        ...previous.zone1,
                        soil: Number(value),
                      },
                    };
                  }
                  if (label.includes('temperature') && label.includes('2')) {
                    return {
                      ...previous,
                      zone2: {
                        ...previous.zone2,
                        temperature: Number(value),
                      },
                    };
                  }
                  if (label.includes('temperature')) {
                    return {
                      ...previous,
                      zone1: {
                        ...previous.zone1,
                        temperature: Number(value),
                      },
                    };
                  }
                  if (label.includes('humidity') && label.includes('2')) {
                    return {
                      ...previous,
                      zone2: {
                        ...previous.zone2,
                        humidity: Number(value),
                      },
                    };
                  }
                  if (label.includes('humidity')) {
                    return {
                      ...previous,
                      zone1: {
                        ...previous.zone1,
                        humidity: Number(value),
                      },
                    };
                  }
                  if (label.includes('waterLevel') || label.includes('distance')) {
                    return {
                      ...previous,
                      zone2: {
                        ...previous.zone2,
                        waterLevel: Number(value),
                      },
                    };
                  }
                  if (label.includes('feedWeight') || label.includes('weight')) {
                    return {
                      ...previous,
                      zone2: {
                        ...previous.zone2,
                        feedWeight: Number(value),
                      },
                    };
                  }
                  if (label.includes('lux') || label.includes('ldr')) {
                    return {
                      ...previous,
                      zone2: {
                        ...previous.zone2,
                        lux: Number(value),
                      },
                    };
                  }
                  if (label.includes('voltage')) {
                    return {
                      ...previous,
                      zone3: {
                        ...previous.zone3,
                        solarVoltage: Number(value),
                      },
                    };
                  }
                  if (label.includes('current') || label.includes('amp')) {
                    return {
                      ...previous,
                      zone3: {
                        ...previous.zone3,
                        solarCurrent: Number(value),
                      },
                    };
                  }
                  if (label.includes('energy')) {
                    return {
                      ...previous,
                      zone3: {
                        ...previous.zone3,
                        energyGenerated: Number(value),
                      },
                    };
                  }
                  if (label.includes('tds')) {
                    return {
                      ...previous,
                      zone3: {
                        ...previous.zone3,
                        tds: Number(value),
                      },
                    };
                  }
                  return previous;
                });
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

  const runControlAction = async (zone: 'zone1' | 'zone2' | 'zone3', action: string, payload: unknown) => {
    const updateMockState = (previous: DashboardTelemetry): DashboardTelemetry => {
      switch (`${zone}:${action}`) {
        case 'zone1:setAutoMode':
          return {
            ...previous,
            zone1: { ...previous.zone1, pumpOn: false },
            system: { ...previous.system, activeAlerts: previous.system.activeAlerts },
          };
        case 'zone1:setCanopy':
          return {
            ...previous,
            zone1: { ...previous.zone1, canopyOpen: Boolean(payload) },
          };
        case 'zone1:setPump':
          return {
            ...previous,
            zone1: { ...previous.zone1, pumpOn: Boolean(payload) },
          };
        case 'zone2:setServo':
          return {
            ...previous,
            zone2: { ...previous.zone2, servoAngle: Number(payload) },
          };
        case 'zone2:setFanSpeed':
          return {
            ...previous,
            zone2: { ...previous.zone2, fanSpeed: Number(payload) },
          };
        case 'zone2:setLights':
          return {
            ...previous,
            zone2: { ...previous.zone2, lightsOn: Boolean(payload) },
          };
        case 'zone3:setTracker':
          return {
            ...previous,
            zone3: { ...previous.zone3, autoTracking: Boolean(payload) },
          };
        case 'zone3:resetPumpCutoff':
          return {
            ...previous,
            zone3: { ...previous.zone3, pumpCutoff: false },
          };
        default:
          return previous;
      }
    };

    if (isMock) {
      setTelemetry((previous) => updateMockState(previous));
      return;
    }

    const deviceId = config.deviceMap[`${zone}a` as keyof DeviceMap] || config.deviceMap[`${zone}b` as keyof DeviceMap];
    if (!deviceId) {
      throw new Error('A device ID is required for RPC control when connected live.');
    }

    let method = action;
    let params = payload;

    if (zone === 'zone1') {
      if (action === 'setAutoMode') {
        method = 'irrigation.setMode';
      }
      if (action === 'setCanopy') {
        method = 'irrigation.setCanopy';
      }
      if (action === 'setPump') {
        method = 'irrigation.setPump';
      }
    }
    if (zone === 'zone2') {
      if (action === 'setServo') {
        method = 'feeding.setServo';
      }
      if (action === 'setFanSpeed') {
        method = 'climate.setFanSpeed';
      }
      if (action === 'setLights') {
        method = 'lighting.setState';
      }
    }
    if (zone === 'zone3') {
      if (action === 'setTracker') {
        method = 'energy.setTrackerMode';
      }
      if (action === 'resetPumpCutoff') {
        method = 'safety.resetPumpCutoff';
      }
    }

    await sendRpc(config.host, jwtToken, deviceId, method, params);
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
