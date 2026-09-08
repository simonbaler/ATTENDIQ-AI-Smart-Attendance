import { EventEmitter } from 'events';
import crypto from 'crypto';

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

class CampusEventBus extends EventEmitter {
  private recentEvents: CampusEvent[] = [];
  private maxBufferSize = 250;

  constructor() {
    super();
    this.setMaxListeners(200);
  }

  public publish(
    type: CampusEventType,
    data: {
      source: string;
      classroom?: string;
      sessionId?: string;
      payload: Record<string, any>;
    }
  ): CampusEvent {
    const event: CampusEvent = {
      eventId: `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      type,
      timestamp: new Date().toISOString(),
      source: data.source,
      classroom: data.classroom,
      sessionId: data.sessionId,
      payload: data.payload,
    };

    // Store in circular buffer
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxBufferSize) {
      this.recentEvents.shift();
    }

    // Emit typed and general event
    this.emit('campus_event', event);
    this.emit(type, event);

    return event;
  }

  public getRecentEvents(limit = 50, filterType?: CampusEventType): CampusEvent[] {
    let list = [...this.recentEvents];
    if (filterType) {
      list = list.filter((e) => e.type === filterType);
    }
    return list.slice(-limit).reverse();
  }
}

export const eventBus = new CampusEventBus();
