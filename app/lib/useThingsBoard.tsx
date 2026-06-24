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
  zone1: '',
  zone2: '',
  zone3: '',
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
  runControlAction: (zone: string, action: string, payload: unknown) => Promise<void>;
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
              if (!entry.data) return;
              const deviceId = entry.entityId || entry.deviceId;
              const zone = deviceZoneMap[deviceId];
              
              Object.entries(entry.data).forEach(([label, dataPoint]: any) => {
                const value = Array.isArray(dataPoint) ? dataPoint[0]?.value ?? null : dataPoint?.value ?? null;
                if (value === null || !zone) return;
                
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

  const runControlAction = async (zone: string, action: string, payload: unknown) => {
    if (isMock) {
      // Mock telemetry updates handled locally
      return;
    }

    // Map zone to device ID (zone1 -> zone1a/zone1b, etc.)
    let deviceId = config.deviceMap[zone as keyof typeof config.deviceMap];
    if (!deviceId) {
      throw new Error('Device ID is required for RPC control when connected live.');
    }

    let method = action;
    await sendRpc(config.host, jwtToken, deviceId, method, payload);
  };

  const deviceZoneMap = useMemo(() => {
    return Object.entries(config.deviceMap).reduce<Record<string, string>>((acc, [zone, deviceId]) => {
      if (deviceId) {
        acc[deviceId] = zone;
      }
      return acc;
    }, {});
  }, [config.deviceMap]);

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

// Helper function to parse telemetry updates for 6-node model
function parseTelemetryUpdate(
  previous: DashboardTelemetry,
  zone: string,
  label: string,
  value: any,
): DashboardTelemetry {
  const lowerLabel = label.toLowerCase();

  if (zone === 'zone1') {
    // Zone 1a - Crop Health
    if (lowerLabel.includes('soil') || lowerLabel.includes('moisture')) {
      return { ...previous, zone1a: { ...previous.zone1a, soilMoisture: Number(value) } };
    }
    if (lowerLabel.includes('temperature')) {
      return { ...previous, zone1a: { ...previous.zone1a, temperature: Number(value) } };
    }
    if (lowerLabel.includes('humidity')) {
      return { ...previous, zone1a: { ...previous.zone1a, humidity: Number(value) } };
    }
    if (lowerLabel.includes('pump')) {
      return { ...previous, zone1a: { ...previous.zone1a, pumpActive: Boolean(value) } };
    }
    if (lowerLabel.includes('pumpspeed')) {
      return { ...previous, zone1a: { ...previous.zone1a, pumpSpeed: Number(value) } };
    }
  }

  if (zone === 'zone2') {
    // Zone 2a - Cattle Monitor
    if (lowerLabel.includes('temperature')) {
      return { ...previous, zone2a: { ...previous.zone2a, temperature: Number(value) } };
    }
    if (lowerLabel.includes('humidity')) {
      return { ...previous, zone2a: { ...previous.zone2a, humidity: Number(value) } };
    }
    if (lowerLabel.includes('water') || lowerLabel.includes('trough') || lowerLabel.includes('distance')) {
      return { ...previous, zone2b: { ...previous.zone2b, waterTroughLevel: Number(value) } };
    }
    if (lowerLabel.includes('feed') || lowerLabel.includes('weight')) {
      return { ...previous, zone2b: { ...previous.zone2b, feedWeight: Number(value) } };
    }
    if (lowerLabel.includes('lux') || lowerLabel.includes('ldr')) {
      return { ...previous, zone2b: { ...previous.zone2b, lux: Number(value) } };
    }
    if (lowerLabel.includes('fan')) {
      return { ...previous, zone2b: { ...previous.zone2b, fanSpeed: Number(value) } };
    }
  }

  if (zone === 'zone3') {
    // Zone 3a - Water Management
    if (lowerLabel.includes('waterlevel') || lowerLabel.includes('level')) {
      return { ...previous, zone3a: { ...previous.zone3a, waterLevel: Number(value) } };
    }
    if (lowerLabel.includes('tds')) {
      return { ...previous, zone3a: { ...previous.zone3a, tds: Number(value) } };
    }
    if (lowerLabel.includes('pump')) {
      return { ...previous, zone3a: { ...previous.zone3a, pumpActive: Boolean(value) } };
    }
    if (lowerLabel.includes('valve')) {
      return { ...previous, zone3a: { ...previous.zone3a, valveOpen: Boolean(value) } };
    }
    // Zone 3b - Water Safety
    if (lowerLabel.includes('temperature') || lowerLabel.includes('temp')) {
      return { ...previous, zone3b: { ...previous.zone3b, waterTemperature: Number(value) } };
    }
    if (lowerLabel.includes('alert') || lowerLabel.includes('led')) {
      return { ...previous, zone3b: { ...previous.zone3b, alertLed: Boolean(value) } };
    }
  }

  return previous;
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
              if (!entry.data) return;
              const zoneFromDevice = deviceZoneMap[entry.entityId || entry.deviceId] as 'zone1' | 'zone2' | 'zone3' | undefined;
              Object.entries(entry.data).forEach(([label, dataPoint]: any) => {
                const value = Array.isArray(dataPoint) ? dataPoint[0]?.value ?? null : dataPoint?.value ?? null;
                if (value === null) return;
                setTelemetry((previous) => {
                  const zone = zoneFromDevice || (label.includes('2') ? 'zone2' : label.includes('energy') || label.includes('voltage') || label.includes('tds') ? 'zone3' : 'zone1');
                  if (zone === 'zone1') {
                    if (label.includes('soil') || label.includes('moisture')) {
                      return {
                        ...previous,
                        zone1: {
                          ...previous.zone1,
                          soil: Number(value),
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
                    if (label.includes('humidity')) {
                      return {
                        ...previous,
                        zone1: {
                          ...previous.zone1,
                          humidity: Number(value),
                        },
                      };
                    }
                    if (label.includes('canopy')) {
                      return {
                        ...previous,
                        zone1: {
                          ...previous.zone1,
                          canopyOpen: Boolean(value),
                        },
                      };
                    }
                  }
                  if (zone === 'zone2') {
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
                    if (label.includes('temperature')) {
                      return {
                        ...previous,
                        zone2: {
                          ...previous.zone2,
                          temperature: Number(value),
                        },
                      };
                    }
                    if (label.includes('humidity')) {
                      return {
                        ...previous,
                        zone2: {
                          ...previous.zone2,
                          humidity: Number(value),
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
                    if (label.includes('servoAngle')) {
                      return {
                        ...previous,
                        zone2: {
                          ...previous.zone2,
                          servoAngle: Number(value),
                        },
                      };
                    }
                    if (label.includes('fanSpeed')) {
                      return {
                        ...previous,
                        zone2: {
                          ...previous.zone2,
                          fanSpeed: Number(value),
                        },
                      };
                    }
                    if (label.includes('lights')) {
                      return {
                        ...previous,
                        zone2: {
                          ...previous.zone2,
                          lightsOn: Boolean(value),
                        },
                      };
                    }
                  }
                  if (zone === 'zone3') {
                    if (label.includes('tds')) {
                      return {
                        ...previous,
                        zone3: {
                          ...previous.zone3,
                          tds: Number(value),
                        },
                      };
                    }
                    if (label.includes('temperature') || label.includes('temp')) {
                      return {
                        ...previous,
                        zone3: {
                          ...previous.zone3,
                          temperature: Number(value),
                        },
                      };
                    }
                    if (label.includes('waterLevel') || label.includes('level') || label.includes('water')) {
                      return {
                        ...previous,
                        zone3: {
                          ...previous.zone3,
                          waterLevel: Number(value),
                        },
                      };
                    }
                    if (label.includes('waterOk') || label.includes('water_ok') || label.includes('optical') || label.includes('flow')) {
                      return {
                        ...previous,
                        zone3: {
                          ...previous.zone3,
                          waterOk: Boolean(value),
                        },
                      };
                    }
                    if (label.includes('pump')) {
                      return {
                        ...previous,
                        zone3: {
                          ...previous.zone3,
                          pumpRunning: Boolean(value),
                        },
                      };
                    }
                    if (label.includes('valve')) {
                      return {
                        ...previous,
                        zone3: {
                          ...previous.zone3,
                          valveAngle: Number(value),
                        },
                      };
                    }
                    if (label.includes('ldr1')) {
                      return {
                        ...previous,
                        zone3: {
                          ...previous.zone3,
                          ldr1: Number(value),
                        },
                      };
                    }
                    if (label.includes('ldr2')) {
                      return {
                        ...previous,
                        zone3: {
                          ...previous.zone3,
                          ldr2: Number(value),
                        },
                      };
                    }
                    if (label.includes('alert') || label.includes('led')) {
                      return {
                        ...previous,
                        zone3: {
                          ...previous.zone3,
                          alertLed: Boolean(value),
                        },
                      };
                    }
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
        case 'zone3:setPump':
          return {
            ...previous,
            zone3: { ...previous.zone3, pumpRunning: Boolean(payload) },
          };
        case 'zone3:setValve':
          return {
            ...previous,
            zone3: { ...previous.zone3, valveAngle: Number(payload) },
          };
        case 'zone3:resetPumpCutoff':
          return {
            ...previous,
            zone3: { ...previous.zone3, alertLed: false },
          };
        default:
          return previous;
      }
    };

    if (isMock) {
      setTelemetry((previous) => updateMockState(previous));
      return;
    }

    const deviceId = config.deviceMap[zone];
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
      if (action === 'setPump') {
        method = 'water.setPump';
      }
      if (action === 'setValve') {
        method = 'water.setValve';
      }
      if (action === 'resetPumpCutoff') {
        method = 'safety.resetPumpCutoff';
      }
    }

    await sendRpc(config.host, jwtToken, deviceId, method, params);
  };

  const deviceZoneMap = useMemo(() => {
    return Object.entries(config.deviceMap).reduce<Record<string, 'zone1' | 'zone2' | 'zone3'>>((acc, [zone, deviceId]) => {
      if (deviceId) {
        acc[deviceId] = zone as 'zone1' | 'zone2' | 'zone3';
      }
      return acc;
    }, {});
  }, [config.deviceMap]);

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
