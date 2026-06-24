export interface DeviceMap {
  zone1a: string;
  zone1b: string;
  zone2a: string;
  zone2b: string;
  zone3a: string;
  zone3b: string;
}

export interface ThingsBoardConfig {
  host: string;
  customerEmail: string;
  customerPassword: string;
  deviceMap: DeviceMap;
}

function normalizeHost(host: string): string {
  const trimmed = host.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '');
  }
  return `https://${trimmed.replace(/\/+$/, '')}`;
}

export function buildApiBase(host: string): string {
  return normalizeHost(host);
}

export async function loginCustomer(host: string, email: string, password: string): Promise<string> {
  const base = buildApiBase(host);
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password }),
  });

  if (!response.ok) {
    throw new Error(`ThingsBoard authentication failed (${response.status})`);
  }

  const payload = await response.json();
  return payload.token || payload.jwt || '';
}

export async function fetchLatestTelemetry(host: string, jwt: string, deviceId: string, keys: string): Promise<any> {
  const base = buildApiBase(host);
  const url = `${base}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${encodeURIComponent(keys)}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${jwt}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Telemetry request failed (${response.status})`);
  }

  return response.json();
}

export async function sendRpc(host: string, jwt: string, deviceId: string, method: string, params: unknown): Promise<any> {
  const base = buildApiBase(host);
  const response = await fetch(`${base}/api/plugins/rpc/oneway/${deviceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify({ method, params }),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed (${response.status})`);
  }

  return response.json();
}

export function buildTelemetryWebSocketUrl(host: string, jwt: string): string {
  const base = normalizeHost(host);
  const wsHost = base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  return `${wsHost}/api/ws/plugins/telemetry?token=${encodeURIComponent(jwt)}`;
}

export function buildTelemetrySubscribeMessage(deviceId: string, cmdId = 1, keys = '') {
  return {
    tsSubCmds: [
      {
        entityType: 'DEVICE',
        entityId: deviceId,
        scope: 'LATEST_TELEMETRY',
        cmdId,
        type: 'SUBSCRIBE_TELEMETRY',
        keys,
      },
    ],
  };
}
