import { CampusDevice, DeviceTelemetry, DeviceStatus, DeviceEventLog } from '../types';

export type IoTGatewayConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export interface IoTTelemetryEvent {
  deviceId: string;
  classroom: string;
  device: CampusDevice;
  telemetry: DeviceTelemetry;
  timestamp: string;
}

export interface IoTStatusEvent {
  deviceId: string;
  status: DeviceStatus;
  lastSeen?: string;
}

type TelemetryListener = (event: IoTTelemetryEvent) => void;
type StatusListener = (event: IoTStatusEvent) => void;
type DeviceEventListener = (event: DeviceEventLog) => void;
type StateListener = (state: IoTGatewayConnectionState) => void;
type BeaconListener = (data: { gatewayId: string; classroom: string; beacons: any[]; timestamp: string }) => void;

class IoTGatewayClient {
  private ws: WebSocket | null = null;
  private connectionState: IoTGatewayConnectionState = 'DISCONNECTED';
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private baseReconnectDelay = 1500;
  private isIntentionallyClosed = false;

  private telemetryListeners: Set<TelemetryListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private eventListeners: Set<DeviceEventListener> = new Set();
  private stateListeners: Set<StateListener> = new Set();
  private beaconListeners: Set<BeaconListener> = new Set();

  private filter: { classroom?: string; department?: string } = {
    classroom: 'ALL',
    department: 'ALL',
  };

  constructor() {
    // Auto-connect in browser context
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isIntentionallyClosed = false;
    this.setConnectionState(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/devices/ws?client_type=dashboard&classroom=${encodeURIComponent(
        this.filter.classroom || 'ALL'
      )}&department=${encodeURIComponent(this.filter.department || 'ALL')}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[IoT Gateway Client] Connected to Campus IoT Real-Time Stream');
        this.reconnectAttempts = 0;
        this.setConnectionState('CONNECTED');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.error('[IoT Gateway Client] Message parse error:', err);
        }
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        this.setConnectionState('DISCONNECTED');
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[IoT Gateway Client] WebSocket warning/error:', err);
      };
    } catch (err) {
      console.error('[IoT Gateway Client] Connection creation error:', err);
      this.setConnectionState('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState('DISCONNECTED');
  }

  public setFilter(classroom?: string, department?: string) {
    this.filter = { classroom: classroom || 'ALL', department: department || 'ALL' };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'SUBSCRIBE',
          filter: this.filter,
        })
      );
    }
  }

  public getState(): IoTGatewayConnectionState {
    return this.connectionState;
  }

  public onTelemetry(cb: TelemetryListener): () => void {
    this.telemetryListeners.add(cb);
    return () => this.telemetryListeners.delete(cb);
  }

  public onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  public onEvent(cb: DeviceEventListener): () => void {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  public onState(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    cb(this.connectionState);
    return () => this.stateListeners.delete(cb);
  }

  public onBeacons(cb: BeaconListener): () => void {
    this.beaconListeners.add(cb);
    return () => this.beaconListeners.delete(cb);
  }

  private handleMessage(data: any) {
    const { type } = data;

    switch (type) {
      case 'DEVICE_TELEMETRY': {
        const payload: IoTTelemetryEvent = {
          deviceId: data.device_id,
          classroom: data.classroom,
          device: data.device,
          telemetry: data.telemetry,
          timestamp: data.timestamp || new Date().toISOString(),
        };
        for (const listener of this.telemetryListeners) {
          try {
            listener(payload);
          } catch (e) {
            console.error('[IoT Gateway Client] Error in telemetry listener:', e);
          }
        }
        break;
      }

      case 'DEVICE_STATUS_CHANGED': {
        const payload: IoTStatusEvent = {
          deviceId: data.device_id,
          status: data.status,
          lastSeen: data.last_seen,
        };
        for (const listener of this.statusListeners) {
          try {
            listener(payload);
          } catch (e) {
            console.error('[IoT Gateway Client] Error in status listener:', e);
          }
        }
        break;
      }

      case 'DEVICE_EVENT': {
        if (data.event) {
          for (const listener of this.eventListeners) {
            try {
              listener(data.event);
            } catch (e) {
              console.error('[IoT Gateway Client] Error in event listener:', e);
            }
          }
        }
        break;
      }

      case 'BLE_GATEWAY_BEACONS': {
        for (const listener of this.beaconListeners) {
          try {
            listener({
              gatewayId: data.gateway_id,
              classroom: data.classroom,
              beacons: data.beacons || [],
              timestamp: data.timestamp || new Date().toISOString(),
            });
          } catch (e) {
            console.error('[IoT Gateway Client] Error in beacon listener:', e);
          }
        }
        break;
      }

      default:
        break;
    }
  }

  private setConnectionState(state: IoTGatewayConnectionState) {
    this.connectionState = state;
    for (const listener of this.stateListeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[IoT Gateway Client] Error in state listener:', e);
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[IoT Gateway Client] Max reconnect attempts reached. Waiting for user interaction or reload.');
      return;
    }

    const delay = Math.min(this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const iotGatewayClient = new IoTGatewayClient();
