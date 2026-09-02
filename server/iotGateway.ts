import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { db, CampusDevice, DeviceTelemetry, DeviceStatus } from './db.js';

export interface DeviceEventLog {
  id: string;
  type: 'DEVICE_CONNECTED' | 'DEVICE_DISCONNECTED' | 'TELEMETRY_RECEIVED' | 'SENSOR_WARNING' | 'HEARTBEAT' | 'CORRELATION_WARNING' | 'DEVICE_REGISTERED';
  device_id: string;
  device_name: string;
  classroom: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  data?: any;
}

// In-memory event ring buffer (last 100 authentic events)
const deviceEventsBuffer: DeviceEventLog[] = [];
const MAX_EVENTS = 100;

export function recordDeviceEvent(event: Omit<DeviceEventLog, 'id' | 'timestamp'>) {
  const fullEvent: DeviceEventLog = {
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  deviceEventsBuffer.unshift(fullEvent);
  if (deviceEventsBuffer.length > MAX_EVENTS) {
    deviceEventsBuffer.pop();
  }

  // Broadcast to all dashboard clients
  broadcastToDashboards({
    type: 'DEVICE_EVENT',
    event: fullEvent,
  });

  return fullEvent;
}

export function getDeviceEvents(): DeviceEventLog[] {
  return [...deviceEventsBuffer];
}

interface DashboardClient {
  ws: WebSocket;
  filter?: {
    classroom?: string;
    department?: string;
  };
}

interface HardwareClient {
  ws: WebSocket;
  deviceId: string;
  classroom: string;
  deviceToken: string;
  authenticated: boolean;
  connectedAt: string;
}

const dashboardClients: Set<DashboardClient> = new Set();
const hardwareClients: Map<WebSocket, HardwareClient> = new Map();

let iotWssInstance: WebSocketServer | null = null;

export function broadcastToDashboards(message: any, filterMatch?: { classroom?: string; department?: string }) {
  const payload = JSON.stringify(message);
  for (const client of dashboardClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (filterMatch && client.filter) {
        if (client.filter.classroom && client.filter.classroom !== 'ALL' && client.filter.classroom !== filterMatch.classroom) {
          continue;
        }
        if (client.filter.department && client.filter.department !== 'ALL' && client.filter.department !== filterMatch.department) {
          continue;
        }
      }
      try {
        client.ws.send(payload);
      } catch (e) {
        console.error('[IoT Gateway] Broadcast error to dashboard client:', e);
      }
    }
  }
}

export function notifyDeviceTelemetry(device: CampusDevice, telemetry: DeviceTelemetry) {
  broadcastToDashboards(
    {
      type: 'DEVICE_TELEMETRY',
      device_id: device.id,
      classroom: device.classroom,
      device: {
        id: device.id,
        name: device.name,
        category: device.category,
        classroom: device.classroom,
        status: device.status,
        telemetry: device.telemetry,
        last_heartbeat: device.last_heartbeat,
      },
      telemetry,
      timestamp: new Date().toISOString(),
    },
    { classroom: device.classroom, department: device.department }
  );

  // Check for environmental thresholds / warnings
  if (telemetry.temperature_c !== undefined && (telemetry.temperature_c > 35 || telemetry.temperature_c < 16)) {
    recordDeviceEvent({
      type: 'SENSOR_WARNING',
      device_id: device.id,
      device_name: device.name,
      classroom: device.classroom,
      message: `Abnormal classroom temperature recorded: ${telemetry.temperature_c.toFixed(1)}°C in ${device.classroom}.`,
      severity: 'warning',
      data: { temperature_c: telemetry.temperature_c },
    });
  }

  if (telemetry.co2_ppm !== undefined && telemetry.co2_ppm > 1200) {
    recordDeviceEvent({
      type: 'SENSOR_WARNING',
      device_id: device.id,
      device_name: device.name,
      classroom: device.classroom,
      message: `Elevated CO₂ concentration detected: ${telemetry.co2_ppm} ppm in ${device.classroom}. Ventilation recommended.`,
      severity: 'warning',
      data: { co2_ppm: telemetry.co2_ppm },
    });
  }
}

export function notifyDeviceStatus(deviceId: string, status: DeviceStatus, classroom?: string, department?: string) {
  broadcastToDashboards(
    {
      type: 'DEVICE_STATUS_CHANGED',
      device_id: deviceId,
      status,
      last_seen: new Date().toISOString(),
    },
    classroom ? { classroom, department } : undefined
  );
}

export function createIoTGatewayServer(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  iotWssInstance = wss;

  console.log('[IoT Gateway] Real-Time IoT Hardware Gateway Server initialized');

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const clientType = url.searchParams.get('client_type') || 'dashboard'; // 'hardware' or 'dashboard'
    const deviceIdParam = url.searchParams.get('device_id');
    const tokenParam = url.searchParams.get('token');

    if (clientType === 'hardware' || deviceIdParam) {
      // Hardware Device Connection Flow (ESP32 / Raspberry Pi / BLE Gateway)
      const hwClient: HardwareClient = {
        ws,
        deviceId: deviceIdParam || '',
        classroom: '',
        deviceToken: tokenParam || '',
        authenticated: false,
        connectedAt: new Date().toISOString(),
      };
      hardwareClients.set(ws, hwClient);

      // If token and device ID in query param, attempt immediate authentication
      if (hwClient.deviceId && hwClient.deviceToken) {
        authenticateHardware(ws, hwClient.deviceId, hwClient.deviceToken);
      } else {
        ws.send(JSON.stringify({
          type: 'AUTH_REQUIRED',
          message: 'Please send authentication payload { type: "AUTH", deviceId: "...", token: "..." }',
        }));
      }
    } else {
      // Dashboard Client Connection Flow
      const dashClient: DashboardClient = {
        ws,
        filter: {
          classroom: url.searchParams.get('classroom') || 'ALL',
          department: url.searchParams.get('department') || 'ALL',
        },
      };
      dashboardClients.add(dashClient);

      // Send initial handshake confirmation
      ws.send(JSON.stringify({
        type: 'DASHBOARD_CONNECTED',
        message: 'Subscribed to real-time campus IoT device stream & events',
        active_devices_count: db.getCampusDevices({ status: 'ONLINE' }).length,
        timestamp: new Date().toISOString(),
      }));
    }

    ws.on('message', (dataRaw: string) => {
      try {
        const message = JSON.parse(dataRaw.toString());
        const { type } = message;

        // Check if this is a hardware client
        const hwClient = hardwareClients.get(ws);
        if (hwClient) {
          handleHardwareMessage(ws, hwClient, message);
          return;
        }

        // Dashboard Client Messages
        switch (type) {
          case 'SUBSCRIBE': {
            const client = Array.from(dashboardClients).find((c) => c.ws === ws);
            if (client && message.filter) {
              client.filter = {
                classroom: message.filter.classroom || 'ALL',
                department: message.filter.department || 'ALL',
              };
              ws.send(JSON.stringify({
                type: 'SUBSCRIPTION_UPDATED',
                filter: client.filter,
              }));
            }
            break;
          }
          case 'PING': {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
            break;
          }
          default:
            break;
        }
      } catch (err: any) {
        console.error('[IoT Gateway] Message processing error:', err);
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Malformed JSON payload.' }));
      }
    });

    ws.on('close', () => {
      // Clean up dashboard clients
      for (const client of dashboardClients) {
        if (client.ws === ws) {
          dashboardClients.delete(client);
          break;
        }
      }

      // Clean up hardware clients
      const hwClient = hardwareClients.get(ws);
      if (hwClient) {
        hardwareClients.delete(ws);
        if (hwClient.authenticated && hwClient.deviceId) {
          db.updateDeviceHeartbeat(hwClient.deviceId, 'OFFLINE');
          notifyDeviceStatus(hwClient.deviceId, 'OFFLINE', hwClient.classroom);
          recordDeviceEvent({
            type: 'DEVICE_DISCONNECTED',
            device_id: hwClient.deviceId,
            device_name: hwClient.deviceId,
            classroom: hwClient.classroom || 'Unknown',
            message: `Hardware device ${hwClient.deviceId} disconnected from WebSocket gateway.`,
            severity: 'warning',
          });
        }
      }
    });

    ws.on('error', (err) => {
      console.error('[IoT Gateway] WebSocket error:', err);
    });
  });

  // Watchdog Timer: Checks device heartbeats every 15 seconds
  // Automatically marks devices OFFLINE if no heartbeat/telemetry received within 60s
  setInterval(() => {
    try {
      const allDevices = db.getCampusDevices();
      const now = Date.now();
      const TIMEOUT_MS = 60000; // 60 seconds threshold for physical devices

      for (const dev of allDevices) {
        if (dev.status === 'ONLINE' && dev.last_heartbeat) {
          const lastTime = new Date(dev.last_heartbeat).getTime();
          if (now - lastTime > TIMEOUT_MS) {
            // Heartbeat expired -> Transition to OFFLINE
            db.updateDeviceHeartbeat(dev.id, 'OFFLINE');
            notifyDeviceStatus(dev.id, 'OFFLINE', dev.classroom, dev.department);
            recordDeviceEvent({
              type: 'DEVICE_DISCONNECTED',
              device_id: dev.id,
              device_name: dev.name,
              classroom: dev.classroom,
              message: `Hardware node ${dev.name} missed heartbeat window (>60s). Status changed to OFFLINE.`,
              severity: 'warning',
            });
          }
        }
      }
    } catch (e) {
      console.error('[IoT Gateway] Watchdog heartbeat scan error:', e);
    }
  }, 15000);

  return wss;
}

function authenticateHardware(ws: WebSocket, deviceId: string, token: string) {
  const device = db.getCampusDeviceById(deviceId);
  if (!device) {
    ws.send(JSON.stringify({ type: 'AUTH_FAILED', message: 'Device ID not found in institutional registry.' }));
    return false;
  }

  if (device.device_token && device.device_token !== token) {
    ws.send(JSON.stringify({ type: 'AUTH_FAILED', message: 'Invalid device credentials / token.' }));
    return false;
  }

  const hwClient = hardwareClients.get(ws);
  if (hwClient) {
    hwClient.authenticated = true;
    hwClient.deviceId = device.id;
    hwClient.classroom = device.classroom;
    hwClient.deviceToken = token;
  }

  db.updateDeviceHeartbeat(device.id, 'ONLINE');
  notifyDeviceStatus(device.id, 'ONLINE', device.classroom, device.department);

  recordDeviceEvent({
    type: 'DEVICE_CONNECTED',
    device_id: device.id,
    device_name: device.name,
    classroom: device.classroom,
    message: `Physical device ${device.name} authenticated and connected via WebSocket.`,
    severity: 'success',
  });

  ws.send(JSON.stringify({
    type: 'AUTH_SUCCESS',
    device_id: device.id,
    name: device.name,
    classroom: device.classroom,
    capabilities: device.capabilities,
    heartbeat_interval_s: 30,
    timestamp: new Date().toISOString(),
  }));

  return true;
}

function handleHardwareMessage(ws: WebSocket, client: HardwareClient, message: any) {
  const { type, deviceId, token } = message;

  if (type === 'AUTH') {
    authenticateHardware(ws, deviceId || client.deviceId, token || client.deviceToken);
    return;
  }

  if (!client.authenticated) {
    // If not authenticated yet, check if token provided in this message
    if (deviceId && token) {
      const ok = authenticateHardware(ws, deviceId, token);
      if (!ok) return;
    } else {
      ws.send(JSON.stringify({ type: 'UNAUTHORIZED', message: 'Hardware client must authenticate before sending telemetry.' }));
      return;
    }
  }

  const targetDeviceId = client.deviceId;

  switch (type) {
    case 'TELEMETRY': {
      const { sensors, temperature_c, humidity_pct, co2_ppm, pm25, pm10, voc_ppb, noise_db, occupancy_count, battery_pct, rssi_dbm, raw_payload } = message;

      const sensorData = sensors || {
        temperature_c,
        humidity_pct,
        co2_ppm,
        pm25,
        pm10,
        voc_ppb,
        noise_db,
        occupancy_count,
        battery_pct,
        rssi_dbm,
        raw_payload,
      };

      const recordRes = db.recordDeviceTelemetry(targetDeviceId, sensorData);
      if (recordRes.success && recordRes.device) {
        notifyDeviceTelemetry(recordRes.device, recordRes.device.telemetry!);

        ws.send(JSON.stringify({
          type: 'TELEMETRY_ACK',
          device_id: targetDeviceId,
          recorded_at: new Date().toISOString(),
        }));

        recordDeviceEvent({
          type: 'TELEMETRY_RECEIVED',
          device_id: recordRes.device.id,
          device_name: recordRes.device.name,
          classroom: recordRes.device.classroom,
          message: `Live telemetry ingested: ${
            sensorData.temperature_c !== undefined ? `${sensorData.temperature_c.toFixed(1)}°C, ` : ''
          }${sensorData.humidity_pct !== undefined ? `${sensorData.humidity_pct}% RH, ` : ''}${
            sensorData.occupancy_count !== undefined ? `${sensorData.occupancy_count} occupants, ` : ''
          }${sensorData.co2_ppm !== undefined ? `${sensorData.co2_ppm} ppm CO₂` : ''}`,
          severity: 'info',
          data: sensorData,
        });
      } else {
        ws.send(JSON.stringify({ type: 'ERROR', message: recordRes.error || 'Failed to record telemetry.' }));
      }
      break;
    }

    case 'HEARTBEAT': {
      db.updateDeviceHeartbeat(targetDeviceId, 'ONLINE');
      ws.send(JSON.stringify({
        type: 'HEARTBEAT_ACK',
        device_id: targetDeviceId,
        timestamp: new Date().toISOString(),
      }));
      break;
    }

    case 'BLE_SCAN_REPORT': {
      // ESP32 or Raspberry Pi BLE Gateway bridge report
      const { beacons } = message;
      const device = db.getCampusDeviceById(targetDeviceId);
      if (Array.isArray(beacons) && beacons.length > 0 && device) {
        recordDeviceEvent({
          type: 'TELEMETRY_RECEIVED',
          device_id: targetDeviceId,
          device_name: device.name,
          classroom: device.classroom,
          message: `BLE Gateway bridged ${beacons.length} nearby Bluetooth peripheral beacons.`,
          severity: 'info',
          data: { beacons_count: beacons.length },
        });

        // Forward beacon telemetry
        broadcastToDashboards({
          type: 'BLE_GATEWAY_BEACONS',
          gateway_id: targetDeviceId,
          classroom: device.classroom,
          beacons,
          timestamp: new Date().toISOString(),
        });
      }
      break;
    }

    default:
      ws.send(JSON.stringify({ type: 'UNKNOWN_MESSAGE_TYPE', received: type }));
      break;
  }
}
