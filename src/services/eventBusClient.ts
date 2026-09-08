export type CampusEventType =
  | 'FACE_DETECTED'
  | 'FACE_VERIFIED'
  | 'ATTENDANCE_RECORDED'
  | 'ATTENDANCE_DUPLICATE'
  | 'UNKNOWN_FACE'
  | 'OBJECT_DETECTED'
  | 'CAMERA_CONNECTED'
  | 'CAMERA_DISCONNECTED'
  | 'MOBILE_CONNECTED'
  | 'MOBILE_DISCONNECTED'
  | 'IOT_CONNECTED'
  | 'IOT_DISCONNECTED'
  | 'SENSOR_TELEMETRY'
  | 'TIMETABLE_SESSION_STARTED'
  | 'TIMETABLE_SESSION_ENDED'
  | 'ABSENCE_NOTIFICATION'
  | 'SYSTEM_WARNING';

export interface CampusEvent {
  eventId: string;
  type: CampusEventType;
  timestamp: string;
  source: string;
  classroom?: string;
  sessionId?: string;
  payload: Record<string, any>;
}

type EventListener = (event: CampusEvent) => void;

class CampusEventBusClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private reconnectTimeout: any = null;
  private isConnected = false;

  public connect(): void {
    if (this.eventSource) return;

    try {
      this.eventSource = new EventSource('/api/events/stream');

      this.eventSource.onopen = () => {
        this.isConnected = true;
      };

      this.eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          this.dispatch('*', data);
          if (data.type) {
            this.dispatch(data.type, data);
          }
        } catch {
          // ignore non-json
        }
      };

      // Listen to specific named events
      const knownEvents: CampusEventType[] = [
        'FACE_DETECTED',
        'FACE_VERIFIED',
        'ATTENDANCE_RECORDED',
        'ATTENDANCE_DUPLICATE',
        'UNKNOWN_FACE',
        'OBJECT_DETECTED',
        'CAMERA_CONNECTED',
        'CAMERA_DISCONNECTED',
        'MOBILE_CONNECTED',
        'MOBILE_DISCONNECTED',
        'IOT_CONNECTED',
        'IOT_DISCONNECTED',
        'SENSOR_TELEMETRY',
        'TIMETABLE_SESSION_STARTED',
        'TIMETABLE_SESSION_ENDED',
        'ABSENCE_NOTIFICATION',
        'SYSTEM_WARNING',
      ];

      for (const evtName of knownEvents) {
        this.eventSource.addEventListener(evtName, (e: any) => {
          try {
            const data = JSON.parse(e.data);
            this.dispatch(evtName, data);
            this.dispatch('*', data);
          } catch {
            // ignore
          }
        });
      }

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.disconnect();
        // Exponential backoff reconnect
        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, 4000);
        }
      };
    } catch {
      this.isConnected = false;
    }
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isConnected = false;
  }

  public subscribe(eventType: CampusEventType | '*', listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    if (!this.eventSource) {
      this.connect();
    }

    return () => {
      this.unsubscribe(eventType, listener);
    };
  }

  public unsubscribe(eventType: CampusEventType | '*', listener: EventListener): void {
    const set = this.listeners.get(eventType);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  private dispatch(eventType: string, event: CampusEvent): void {
    const targets = this.listeners.get(eventType);
    if (targets) {
      targets.forEach((cb) => {
        try {
          cb(event);
        } catch {
          // suppress callback errors
        }
      });
    }
  }

  public getStatus(): boolean {
    return this.isConnected;
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const campusEventBus = new CampusEventBusClient();
export const eventBusClient = campusEventBus;
