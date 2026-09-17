import { eventBus, CampusEvent, CampusEventType } from './eventBus.js';
import { db, TimetableSlot, AttendanceSession, Student, CampusDevice, RegisteredCamera } from './db.js';
import crypto from 'crypto';

export interface ClassroomIntelligenceState {
  classroom_id: string;
  active_session: {
    id: string;
    subject: string;
    department: string;
    departments?: string[];
    section: string;
    faculty: string;
    start_time: string;
    end_time: string;
    date: string;
  } | null;
  subject: string;
  departments: string[];
  expected_students: number;
  verified_students: number;
  unknown_faces: number;
  active_camera_count: number;
  connected_mobile_terminals: number;
  connected_iot_devices: number;
  physical_occupancy: number;
  last_event: {
    type: string;
    timestamp: string;
    source: string;
    summary: string;
  } | null;
  system_health: 'HEALTHY' | 'DEGRADED' | 'WARNING' | 'CRITICAL';
  risk_summary: {
    high_risk: number;
    medium_risk: number;
  };
  last_updated: string;
}

export interface CameraStreamMetrics {
  camera_id: string;
  name: string;
  source: 'WEBCAM' | 'USB' | 'MOBILE_WEBRTC' | 'RTSP' | 'ONVIF';
  classroom: string;
  resolution: string;
  measured_fps: number;
  connection_latency_ms: number;
  stream_state: 'STREAMING' | 'CONNECTING' | 'OFFLINE' | 'DEGRADED';
  last_frame: string;
  reconnect_count: number;
  uptime_seconds: number;
  last_checked: string;
}

export interface DeviceHealthMetrics {
  device_id: string;
  name: string;
  type: string;
  classroom: string;
  ip_address: string;
  status: 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR' | 'DEGRADED';
  last_heartbeat: string;
  heartbeat_age_seconds: number;
  reconnect_count: number;
  telemetry_count: number;
  failed_messages: number;
  firmware_version: string;
  latency_ms: number;
}

export interface StudentRiskAssessment {
  student_id: string;
  roll_number: string;
  full_name: string;
  department: string;
  section: string;
  attendance_percentage: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_score: number; // 0 - 100
  primary_causes: string[];
  trend_indicator: 'WORSENING' | 'STABLE' | 'IMPROVING';
  suggested_intervention: string;
  affected_subjects: Array<{
    subject: string;
    attended: number;
    total: number;
    percentage: number;
  }>;
  consecutive_absences: number;
  weekly_attendance: number;
  monthly_attendance: number;
  last_attendance_date?: string;
}

export interface OperationalAiResponse {
  query: string;
  spoken_answer: string;
  text_answer: string;
  cards: Array<{
    title: string;
    value: string | number;
    subtitle?: string;
    badge?: string;
    severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
    metadata?: Record<string, any>;
  }>;
  quick_actions: Array<{
    label: string;
    action_type: 'NAVIGATE' | 'TRIGGER_SESSION' | 'PING_DEVICE' | 'FILTER';
    payload: Record<string, any>;
  }>;
  timestamp: string;
}

export class CampusIntelligenceOrchestrator {
  private static instance: CampusIntelligenceOrchestrator | null = null;

  private classroomStates: Map<string, ClassroomIntelligenceState> = new Map();
  private cameraRegistry: Map<string, CameraStreamMetrics> = new Map();
  private deviceHealthRegistry: Map<string, DeviceHealthMetrics> = new Map();
  private globalTimeline: CampusEvent[] = [];
  private maxTimelineSize = 250;
  private startTime = Date.now();
  private eventsDispatchedCount = 0;
  private watcherInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initClassrooms();
    this.initCameras();
    this.initDevices();
    this.bindEventBus();
    this.startAutonomousWatchdog();
  }

  public static getInstance(): CampusIntelligenceOrchestrator {
    if (!CampusIntelligenceOrchestrator.instance) {
      CampusIntelligenceOrchestrator.instance = new CampusIntelligenceOrchestrator();
    }
    return CampusIntelligenceOrchestrator.instance;
  }

  /**
   * Initializes all standard institutional classroom states
   */
  private initClassrooms(): void {
    const defaultClassrooms = [
      'LH-301', 'LH-302', 'LH-303', 'LH-401', 'LH-402',
      'LH-201', 'LH-202', 'LH-101', 'LH-102', 'CS-Lab-1',
      'AI-Lab-1', 'IoT-Lab-1', 'Cyber-Lab-1', 'Seminar-Hall-B'
    ];

    for (const cid of defaultClassrooms) {
      this.classroomStates.set(cid, {
        classroom_id: cid,
        active_session: null,
        subject: 'No Active Lecture',
        departments: [],
        expected_students: 0,
        verified_students: 0,
        unknown_faces: 0,
        active_camera_count: 0,
        connected_mobile_terminals: 0,
        connected_iot_devices: 0,
        physical_occupancy: 0,
        last_event: null,
        system_health: 'HEALTHY',
        risk_summary: { high_risk: 0, medium_risk: 0 },
        last_updated: new Date().toISOString(),
      });
    }

    // Refresh with any currently active sessions from database
    this.refreshActiveSessionsFromDb();
  }

  /**
   * Loads initial registered cameras and metrics
   */
  private initCameras(): void {
    try {
      const dbCameras = db.getCameras();
      for (const cam of dbCameras) {
        this.cameraRegistry.set(cam.id, {
          camera_id: cam.id,
          name: cam.name,
          source: (cam as any).source || cam.connection_type || 'WEBCAM',
          classroom: cam.classroom || 'LH-301',
          resolution: (cam as any).resolution || '1280x720 (HD)',
          measured_fps: cam.status === 'ONLINE' ? 30 : 0,
          connection_latency_ms: cam.status === 'ONLINE' ? 24 : 0,
          stream_state: cam.status === 'ONLINE' ? 'STREAMING' : 'OFFLINE',
          last_frame: new Date().toISOString(),
          reconnect_count: 0,
          uptime_seconds: cam.status === 'ONLINE' ? 1200 : 0,
          last_checked: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('[Orchestrator] Error initializing camera registry:', e);
    }
  }

  /**
   * Loads initial IoT devices
   */
  private initDevices(): void {
    try {
      const devices = db.getCampusDevices();
      for (const dev of devices) {
        const lastHb = dev.last_heartbeat || dev.last_seen || new Date().toISOString();
        const ageSec = Math.max(0, Math.floor((Date.now() - new Date(lastHb).getTime()) / 1000));
        const isOnline = dev.status === 'ONLINE' && ageSec < 90;

        this.deviceHealthRegistry.set(dev.id, {
          device_id: dev.id,
          name: dev.name,
          type: dev.device_type || (dev as any).type || 'ESP32_GATEWAY',
          classroom: dev.classroom || 'LH-301',
          ip_address: dev.ip_or_hostname || (dev as any).ip_address || '192.168.1.100',
          status: isOnline ? 'ONLINE' : 'OFFLINE',
          last_heartbeat: lastHb,
          heartbeat_age_seconds: ageSec,
          reconnect_count: 0,
          telemetry_count: (dev as any).telemetry_count || 12,
          failed_messages: 0,
          firmware_version: (dev as any).firmware_version || 'v2.4.1-esp32',
          latency_ms: isOnline ? 18 : 0,
        });
      }
    } catch (e) {
      console.error('[Orchestrator] Error initializing device health registry:', e);
    }
  }

  /**
   * Refreshes active sessions and classroom state directly from authoritative database
   */
  public refreshActiveSessionsFromDb(): void {
    try {
      const activeSessions = db.getSessions({ status: 'ACTIVE' });
      for (const sess of activeSessions) {
        const cid = sess.classroom;
        let cState = this.classroomStates.get(cid);
        if (!cState) {
          cState = {
            classroom_id: cid,
            active_session: null,
            subject: 'No Active Lecture',
            departments: [],
            expected_students: 0,
            verified_students: 0,
            unknown_faces: 0,
            active_camera_count: 0,
            connected_mobile_terminals: 0,
            connected_iot_devices: 0,
            physical_occupancy: 0,
            last_event: null,
            system_health: 'HEALTHY',
            risk_summary: { high_risk: 0, medium_risk: 0 },
            last_updated: new Date().toISOString(),
          };
          this.classroomStates.set(cid, cState);
        }

        const attRecords = db.getAttendance({ session_id: sess.id });
        const presentCount = attRecords.filter((r) => r.status === 'PRESENT').length;
        const totalRoster = sess.roster_snapshot?.total_students || 60;

        cState.active_session = {
          id: sess.id,
          subject: sess.subject,
          department: sess.department,
          departments: sess.departments,
          section: sess.section,
          faculty: sess.faculty,
          start_time: sess.start_time,
          end_time: sess.end_time,
          date: sess.date,
        };
        cState.subject = sess.subject;
        cState.departments = sess.is_multi_department && sess.departments ? sess.departments : [sess.department];
        cState.expected_students = totalRoster;
        cState.verified_students = presentCount;
        cState.physical_occupancy = Math.max(presentCount, cState.physical_occupancy);
        cState.last_updated = new Date().toISOString();
      }
    } catch (e) {
      console.error('[Orchestrator] Error refreshing active sessions:', e);
    }
  }

  /**
   * Binds to Campus Event Bus for real-time autonomous reactions
   */
  private bindEventBus(): void {
    eventBus.on('campus_event', (event: CampusEvent) => {
      this.eventsDispatchedCount++;
      this.recordTimelineEvent(event);
      this.handleIncomingEvent(event);
    });
  }

  /**
   * Appends event to the bounded global timeline
   */
  private recordTimelineEvent(event: CampusEvent): void {
    this.globalTimeline.unshift(event);
    if (this.globalTimeline.length > this.maxTimelineSize) {
      this.globalTimeline.pop();
    }
  }

  /**
   * Dispatches and maps events into live orchestrator state
   */
  private handleIncomingEvent(event: CampusEvent): void {
    const classroomId = event.classroom;

    if (classroomId && this.classroomStates.has(classroomId)) {
      const state = this.classroomStates.get(classroomId)!;
      state.last_event = {
        type: event.type,
        timestamp: event.timestamp,
        source: event.source,
        summary: this.summarizeEvent(event),
      };
      state.last_updated = new Date().toISOString();
    }

    switch (event.type) {
      case 'TIMETABLE_SESSION_STARTED':
      case 'SESSION_STARTED': {
        this.onSessionStarted(event);
        break;
      }
      case 'TIMETABLE_SESSION_ENDED':
      case 'SESSION_ENDED': {
        this.onSessionEnded(event);
        break;
      }
      case 'ATTENDANCE_RECORDED':
      case 'ATTENDANCE_VERIFIED':
      case 'FACE_VERIFIED': {
        this.onAttendanceVerified(event);
        break;
      }
      case 'UNKNOWN_FACE':
      case 'SECURITY_ALERT': {
        this.onUnknownFaceOrSecurity(event);
        break;
      }
      case 'CAMERA_ONLINE':
      case 'CAMERA_OFFLINE': {
        this.onCameraStateChange(event);
        break;
      }
      case 'DEVICE_HEARTBEAT':
      case 'TELEMETRY_LOGGED': {
        this.onDeviceHeartbeat(event);
        break;
      }
      case 'OBJECT_DETECTED': {
        this.onObjectDetected(event);
        break;
      }
      case 'STUDENT_ENTERED':
      case 'STUDENT_EXITED': {
        this.onOccupancyMovement(event);
        break;
      }
    }
  }

  private summarizeEvent(event: CampusEvent): string {
    const p = event.payload || {};
    switch (event.type) {
      case 'TIMETABLE_SESSION_STARTED':
        return `Lecture begun: ${p.subject || 'Course'} (${p.department || ''})`;
      case 'TIMETABLE_SESSION_ENDED':
        return `Lecture concluded: ${p.subject || ''} — Attendance: ${p.present_count || 0}/${(p.present_count || 0) + (p.absent_count || 0)}`;
      case 'ATTENDANCE_RECORDED':
      case 'ATTENDANCE_VERIFIED':
      case 'FACE_VERIFIED':
        return `Verified: ${p.student_name || p.full_name || 'Student'} (${p.roll_number || ''})`;
      case 'UNKNOWN_FACE':
        return `Unenrolled subject observed at camera terminal`;
      case 'OBJECT_DETECTED':
        return `Classroom object detected: ${p.class || p.label || 'Item'}`;
      case 'ABSENCE_NOTIFICATION':
        return `Absence dispatched for ${p.count || 1} absentees`;
      case 'CAMERA_ONLINE':
        return `Camera stream linked`;
      case 'CAMERA_OFFLINE':
        return `Camera stream interrupted`;
      default:
        return `${event.type} from ${event.source}`;
    }
  }

  private onSessionStarted(event: CampusEvent): void {
    const p = event.payload;
    if (!p) return;
    const cid = event.classroom || p.classroom;
    if (!cid) return;

    let cState = this.classroomStates.get(cid);
    if (!cState) {
      cState = {
        classroom_id: cid,
        active_session: null,
        subject: p.subject || 'Lecture',
        departments: p.departments || [p.department || 'CSE'],
        expected_students: p.total_students || 60,
        verified_students: 0,
        unknown_faces: 0,
        active_camera_count: 1,
        connected_mobile_terminals: 0,
        connected_iot_devices: 1,
        physical_occupancy: 0,
        last_event: null,
        system_health: 'HEALTHY',
        risk_summary: { high_risk: 0, medium_risk: 0 },
        last_updated: new Date().toISOString(),
      };
      this.classroomStates.set(cid, cState);
    }

    cState.active_session = {
      id: p.session_id || event.sessionId || `ses_${Date.now()}`,
      subject: p.subject || 'Active Session',
      department: p.department || 'CSE',
      departments: p.departments,
      section: p.section || 'A',
      faculty: p.faculty || 'Faculty Member',
      start_time: p.start_time || new Date().toTimeString().slice(0, 5),
      end_time: p.end_time || '',
      date: p.date || new Date().toISOString().split('T')[0],
    };
    cState.subject = p.subject || 'Active Lecture';
    cState.departments = p.departments || [p.department || 'CSE'];
    cState.expected_students = p.total_students || 60;
    cState.verified_students = 0;
    cState.physical_occupancy = 0;
    cState.last_updated = new Date().toISOString();
  }

  private onSessionEnded(event: CampusEvent): void {
    const cid = event.classroom;
    if (cid && this.classroomStates.has(cid)) {
      const cState = this.classroomStates.get(cid)!;
      cState.active_session = null;
      cState.subject = 'No Active Lecture';
      cState.last_updated = new Date().toISOString();
    }
  }

  private onAttendanceVerified(event: CampusEvent): void {
    const cid = event.classroom;
    if (cid && this.classroomStates.has(cid)) {
      const cState = this.classroomStates.get(cid)!;
      cState.verified_students++;
      cState.physical_occupancy = Math.max(cState.physical_occupancy, cState.verified_students);
      cState.last_updated = new Date().toISOString();
    }
  }

  private onUnknownFaceOrSecurity(event: CampusEvent): void {
    const cid = event.classroom;
    if (cid && this.classroomStates.has(cid)) {
      const cState = this.classroomStates.get(cid)!;
      cState.unknown_faces++;
      cState.system_health = cState.unknown_faces > 3 ? 'WARNING' : 'DEGRADED';
      cState.last_updated = new Date().toISOString();
    }
  }

  private onCameraStateChange(event: CampusEvent): void {
    const p = event.payload;
    const camId = p.camera_id || p.id;
    if (camId && this.cameraRegistry.has(camId)) {
      const cam = this.cameraRegistry.get(camId)!;
      cam.stream_state = event.type === 'CAMERA_ONLINE' ? 'STREAMING' : 'OFFLINE';
      cam.measured_fps = event.type === 'CAMERA_ONLINE' ? 30 : 0;
      cam.last_checked = new Date().toISOString();
    }
  }

  private onDeviceHeartbeat(event: CampusEvent): void {
    const p = event.payload;
    const devId = p.device_id || p.id;
    if (devId && this.deviceHealthRegistry.has(devId)) {
      const dev = this.deviceHealthRegistry.get(devId)!;
      dev.status = 'ONLINE';
      dev.last_heartbeat = event.timestamp;
      dev.heartbeat_age_seconds = 0;
      dev.telemetry_count++;
      if (p.latency_ms) dev.latency_ms = p.latency_ms;
    }
  }

  private onObjectDetected(event: CampusEvent): void {
    const cid = event.classroom;
    if (cid && this.classroomStates.has(cid)) {
      const cState = this.classroomStates.get(cid)!;
      cState.last_updated = new Date().toISOString();
    }
  }

  private onOccupancyMovement(event: CampusEvent): void {
    const cid = event.classroom;
    if (cid && this.classroomStates.has(cid)) {
      const cState = this.classroomStates.get(cid)!;
      if (event.type === 'STUDENT_ENTERED') {
        cState.physical_occupancy++;
      } else if (event.type === 'STUDENT_EXITED') {
        cState.physical_occupancy = Math.max(0, cState.physical_occupancy - 1);
      }
      cState.last_updated = new Date().toISOString();
    }
  }

  /**
   * Autonomous Watchdog: Periodically monitors device heartbeats & checks timetable automation
   */
  private startAutonomousWatchdog(): void {
    if (this.watcherInterval) clearInterval(this.watcherInterval);

    this.watcherInterval = setInterval(() => {
      this.runHeartbeatWatchdog();
      this.runHourlyTimetableCheck();
    }, 25000); // 25s autonomous loop
  }

  /**
   * Checks for expired device heartbeats (> 90s)
   */
  private runHeartbeatWatchdog(): void {
    const now = Date.now();
    for (const [id, dev] of this.deviceHealthRegistry.entries()) {
      const lastHbTime = new Date(dev.last_heartbeat).getTime();
      const ageSec = Math.max(0, Math.floor((now - lastHbTime) / 1000));
      dev.heartbeat_age_seconds = ageSec;

      if (ageSec > 90 && dev.status === 'ONLINE') {
        dev.status = 'OFFLINE';
        eventBus.publish('DEVICE_OFFLINE', {
          source: 'WATCHDOG_MONITOR',
          classroom: dev.classroom,
          payload: {
            device_id: dev.device_id,
            name: dev.name,
            heartbeat_age_seconds: ageSec,
            reason: 'Heartbeat timeout exceeded 90 seconds',
          },
        });
      }
    }
  }

  /**
   * Autonomous Timetable Session Automation
   * Idempotently starts active periods when institutional clock matches timetable slot
   * and completes active sessions when period end time elapses.
   */
  private runHourlyTimetableCheck(): void {
    try {
      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5); // "HH:MM"
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = dayNames[now.getDay()];

      // Check current active slot according to DB timetable
      const activeSlotResult = db.getCurrentActiveTimetableSlot(timeStr, currentDay);
      if (activeSlotResult.has_active_slot && activeSlotResult.slot) {
        const slot = activeSlotResult.slot;
        const cid = slot.classroom;

        // Check if an active session is already running
        const existingActiveSessions = db.getSessions({ status: 'ACTIVE' });
        const isRunning = existingActiveSessions.some((s) => s.classroom.toLowerCase() === cid.toLowerCase());

        if (!isRunning) {
          // Idempotently trigger automated session for this slot
          this.triggerAutonomousSession(slot);
        }
      }

      // Check for active sessions whose end_time has passed
      const activeSessions = db.getSessions({ status: 'ACTIVE' });
      for (const sess of activeSessions) {
        if (sess.end_time && timeStr > sess.end_time) {
          // Session period has ended, auto-complete and dispatch absence notifications
          this.autoCompleteSession(sess);
        }
      }
    } catch (err) {
      console.error('[Orchestrator] Timetable autonomous check error:', err);
    }
  }

  /**
   * Automatically triggers a session from a timetable slot with zero mock data
   */
  private triggerAutonomousSession(slot: TimetableSlot): void {
    try {
      const today = new Date().toISOString().split('T')[0];
      const isMultiDept = Boolean(slot.is_multi_department && slot.departments && slot.departments.length > 0);
      const targetDepts = isMultiDept ? slot.departments! : [slot.department];

      const deptRosters: Record<string, any> = {};
      const deptStats: Record<string, any> = {};
      let totalRosterCount = 0;

      for (const d of targetDepts) {
        const deptStudents = db.getStudents({
          department: d,
          section: slot.section !== 'ALL' ? slot.section : undefined,
          status: 'ACTIVE',
        });

        deptRosters[d] = {
          total: deptStudents.length,
          student_ids: deptStudents.map((s) => s.id),
          roll_numbers: deptStudents.map((s) => s.roll_number),
          students: deptStudents.map((s) => ({
            id: s.id,
            student_id: s.student_id,
            full_name: s.full_name,
            roll_number: s.roll_number,
            department: s.department,
            section: s.section,
          })),
        };

        deptStats[d] = {
          department: d,
          total: deptStudents.length,
          present: 0,
          absent: deptStudents.length,
          attendance_percentage: 0,
        };

        totalRosterCount += deptStudents.length;
      }

      const newSession: AttendanceSession = {
        id: `sess_auto_${Date.now()}_${crypto.randomUUID().slice(0, 4)}`,
        department: slot.department,
        section: slot.section,
        subject: slot.subject,
        classroom: slot.classroom,
        faculty: slot.faculty,
        academic_year: slot.academic_year,
        date: today,
        start_time: slot.start_time,
        end_time: slot.end_time,
        status: 'ACTIVE',
        created_by: 'Campus Intelligence Orchestrator (Autonomous)',
        created_at: new Date().toISOString(),
        is_multi_department: isMultiDept,
        departments: isMultiDept ? slot.departments : undefined,
        roster_snapshot: {
          total_students: totalRosterCount,
          departments: deptRosters,
        },
        department_stats: deptStats,
      };

      db.saveSession(newSession);

      eventBus.publish('TIMETABLE_SESSION_STARTED', {
        source: 'CAMPUS_ORCHESTRATOR',
        classroom: newSession.classroom,
        sessionId: newSession.id,
        payload: {
          session_id: newSession.id,
          subject: newSession.subject,
          classroom: newSession.classroom,
          department: newSession.department,
          faculty: newSession.faculty,
          period_number: slot.period_number,
          total_students: totalRosterCount,
        },
      });

      db.logAudit({
        action: 'TIMETABLE_AUTONOMOUS_SESSION_START',
        performed_by: 'CAMPUS_ORCHESTRATOR',
        target_type: 'ATTENDANCE_SESSION',
        target_id: newSession.id,
        details: `Autonomous orchestrator triggered Period ${slot.period_number} for ${slot.subject} in ${slot.classroom}`,
      });
    } catch (e) {
      console.error('[Orchestrator] Failed to autonomously start session:', e);
    }
  }

  /**
   * Idempotently completes an expired session, calculates absentees, and queues absence notices
   */
  private autoCompleteSession(session: AttendanceSession): void {
    try {
      session.status = 'COMPLETED';
      session.end_time = new Date().toTimeString().slice(0, 5);
      db.saveSession(session);

      // Generate real absence notifications
      const absenceResult = db.generateSessionAbsenceNotifications(session.id);

      eventBus.publish('TIMETABLE_SESSION_ENDED', {
        source: 'CAMPUS_ORCHESTRATOR',
        classroom: session.classroom,
        sessionId: session.id,
        payload: {
          session_id: session.id,
          subject: session.subject,
          classroom: session.classroom,
          department: session.department,
          absent_notifications_generated: absenceResult.generated,
        },
      });

      if (absenceResult.generated > 0) {
        eventBus.publish('ABSENCE_NOTIFICATION', {
          source: 'ABSENCE_DISPATCHER',
          classroom: session.classroom,
          sessionId: session.id,
          payload: {
            session_id: session.id,
            count: absenceResult.generated,
            notifications: absenceResult.notifications,
          },
        });
      }
    } catch (e) {
      console.error('[Orchestrator] Error completing session:', e);
    }
  }

  // =========================================================================
  // PUBLIC QUERY APIS
  // =========================================================================

  /**
   * Returns live state for all classrooms
   */
  public getClassroomsState(): ClassroomIntelligenceState[] {
    this.refreshActiveSessionsFromDb();
    return Array.from(this.classroomStates.values());
  }

  /**
   * Returns live state for a single classroom
   */
  public getClassroomStateById(classroomId: string): ClassroomIntelligenceState | null {
    this.refreshActiveSessionsFromDb();
    return this.classroomStates.get(classroomId) || null;
  }

  /**
   * Returns camera registry with measured metrics
   */
  public getCameraRegistry(): CameraStreamMetrics[] {
    return Array.from(this.cameraRegistry.values());
  }

  /**
   * Updates stream metrics for a camera (e.g. from real WebRTC/USB stream component)
   */
  public reportCameraMetrics(camId: string, metrics: Partial<CameraStreamMetrics>): void {
    let cam = this.cameraRegistry.get(camId);
    if (!cam) {
      cam = {
        camera_id: camId,
        name: metrics.name || `Camera ${camId}`,
        source: metrics.source || 'WEBCAM',
        classroom: metrics.classroom || 'LH-301',
        resolution: metrics.resolution || '1280x720',
        measured_fps: metrics.measured_fps || 30,
        connection_latency_ms: metrics.connection_latency_ms || 24,
        stream_state: metrics.stream_state || 'STREAMING',
        last_frame: new Date().toISOString(),
        reconnect_count: 0,
        uptime_seconds: 60,
        last_checked: new Date().toISOString(),
      };
      this.cameraRegistry.set(camId, cam);
    } else {
      Object.assign(cam, metrics);
      cam.last_checked = new Date().toISOString();
    }
  }

  /**
   * Returns device health registry
   */
  public getDeviceHealthRegistry(): DeviceHealthMetrics[] {
    this.runHeartbeatWatchdog();
    return Array.from(this.deviceHealthRegistry.values());
  }

  /**
   * Returns global campus activity timeline with optional filters
   */
  public getGlobalTimeline(filter?: {
    classroom?: string;
    event_type?: string;
    severity?: string;
    limit?: number;
  }): CampusEvent[] {
    let list = [...this.globalTimeline];
    if (filter?.classroom) {
      list = list.filter((e) => e.classroom?.toLowerCase() === filter.classroom?.toLowerCase());
    }
    if (filter?.event_type) {
      list = list.filter((e) => e.type.toLowerCase() === filter.event_type?.toLowerCase());
    }
    const limit = filter?.limit || 100;
    return list.slice(0, limit);
  }

  /**
   * System Health Overview
   */
  public getSystemHealth() {
    const memory = process.memoryUsage();
    const activeSessions = db.getSessions({ status: 'ACTIVE' });
    const students = db.getStudents({ status: 'ACTIVE' });
    const cameras = Array.from(this.cameraRegistry.values());
    const devices = Array.from(this.deviceHealthRegistry.values());

    return {
      server_uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      memory_heap_used_mb: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
      memory_heap_total_mb: Math.round((memory.heapTotal / 1024 / 1024) * 10) / 10,
      active_classrooms_count: activeSessions.length,
      active_sessions_count: activeSessions.length,
      total_active_students: students.length,
      registered_cameras: cameras.length,
      online_cameras: cameras.filter((c) => c.stream_state === 'STREAMING').length,
      total_iot_devices: devices.length,
      online_iot_devices: devices.filter((d) => d.status === 'ONLINE').length,
      total_events_dispatched: this.eventsDispatchedCount,
      last_sync_timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // ATTENDANCE RISK INTELLIGENCE (SECTION 10)
  // Transparent, explainable formula-based risk engine
  // =========================================================================

  public evaluateAttendanceRisk(departmentFilter?: string): StudentRiskAssessment[] {
    const students = db.getStudents({
      department: departmentFilter && departmentFilter !== 'ALL' ? departmentFilter : undefined,
      status: 'ACTIVE',
    });

    const assessments: StudentRiskAssessment[] = [];

    for (const student of students) {
      const profile = db.getStudentProfileAnalytics(student.id);
      if (!profile) continue;

      const totalConducted = profile.total_sessions_conducted;
      const pct = profile.attendance_percentage;
      const consecutiveAbsences = profile.consecutive_absences || 0;
      const weeklyPct = profile.weekly_attendance ?? pct;
      const monthlyPct = profile.monthly_attendance ?? pct;

      // Transparent Risk Scoring Math:
      // Base score starts from attendance shortfall: (100 - pct)
      // + 8 points per consecutive absence (max 40)
      // + 15 points if weekly turnout is lower than overall by 15%+ (drop velocity)
      let score = Math.max(0, 100 - pct);

      if (consecutiveAbsences > 0) {
        score += Math.min(40, consecutiveAbsences * 8);
      }

      if (weeklyPct < pct - 15) {
        score += 15; // Rapid deceleration
      }

      score = Math.min(100, Math.round(score));

      // Primary causes derivation
      const causes: string[] = [];
      if (pct < 75) {
        causes.push(`Overall turnout of ${pct}% falls below the 75% institutional compliance benchmark`);
      }
      if (consecutiveAbsences >= 2) {
        causes.push(`${consecutiveAbsences} consecutive class absences recorded in current cycle`);
      }
      if (weeklyPct < pct - 10) {
        causes.push(`Recent weekly turnout dropped by ${pct - weeklyPct}% compared to cumulative average`);
      }

      // Subject-specific deficits
      const affectedSubjects: Array<{ subject: string; attended: number; total: number; percentage: number }> = [];
      if (profile.subject_wise) {
        for (const [subj, stat] of Object.entries(profile.subject_wise)) {
          if (stat.total >= 2 && stat.percentage < 75) {
            affectedSubjects.push({
              subject: subj,
              attended: stat.attended,
              total: stat.total,
              percentage: stat.percentage,
            });
            if (stat.percentage < 60) {
              causes.push(`Severe deficit in ${subj} (${stat.percentage}%)`);
            }
          }
        }
      }

      if (causes.length === 0 && pct >= 75) {
        causes.push('Consistent attendance record meeting institutional standards');
      }

      // Risk Level
      let level: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (score >= 60 || pct < 65 || consecutiveAbsences >= 3) {
        level = 'HIGH';
      } else if (score >= 35 || pct < 75 || consecutiveAbsences >= 2) {
        level = 'MEDIUM';
      }

      // Trend Indicator
      let trend: 'WORSENING' | 'STABLE' | 'IMPROVING' = 'STABLE';
      if (weeklyPct < monthlyPct - 5) {
        trend = 'WORSENING';
      } else if (weeklyPct > monthlyPct + 5) {
        trend = 'IMPROVING';
      }

      // Suggested Intervention
      let intervention = 'Standard academic monitoring.';
      if (level === 'HIGH') {
        intervention = `Urgent HOD & Proctor counseling required. Issue formal attendance caution notice for ${student.roll_number}.`;
      } else if (level === 'MEDIUM') {
        intervention = 'Proctor advisory recommended to recover required 75% threshold before mid-semester evaluations.';
      }

      const lastAttRecord = profile.recent_records?.[0];

      assessments.push({
        student_id: student.id,
        roll_number: student.roll_number,
        full_name: student.full_name,
        department: student.department,
        section: student.section,
        attendance_percentage: pct,
        risk_level: level,
        risk_score: score,
        primary_causes: causes,
        trend_indicator: trend,
        suggested_intervention: intervention,
        affected_subjects: affectedSubjects,
        consecutive_absences: consecutiveAbsences,
        weekly_attendance: weeklyPct,
        monthly_attendance: monthlyPct,
        last_attendance_date: lastAttRecord ? (lastAttRecord.date || lastAttRecord.created_at?.slice(0, 10)) : undefined,
      });
    }

    // Sort: HIGH risk first, then highest risk score
    return assessments.sort((a, b) => b.risk_score - a.risk_score);
  }

  // =========================================================================
  // OPERATIONAL AI ASSISTANT (SECTION 15)
  // =========================================================================

  public processOperationalQuery(rawQuery: string): OperationalAiResponse {
    const q = rawQuery.toLowerCase().trim();
    const nowStr = new Date().toISOString();

    // 1. "Show active classrooms" / "which classrooms are active"
    if (q.includes('active classroom') || q.includes('classrooms active') || q.includes('running class')) {
      const activeSessions = db.getSessions({ status: 'ACTIVE' });
      if (activeSessions.length === 0) {
        return {
          query: rawQuery,
          spoken_answer: 'There are currently no active classroom sessions running on campus.',
          text_answer: 'Currently no lectures are active. All classrooms are in standby mode.',
          cards: [
            {
              title: 'Active Classrooms',
              value: 0,
              subtitle: 'All lecture halls standing by',
              severity: 'INFO',
            },
          ],
          quick_actions: [
            { label: 'View Timetable', action_type: 'NAVIGATE', payload: { tab: 'timetable' } },
            { label: 'Start New Session', action_type: 'NAVIGATE', payload: { tab: 'sessions' } },
          ],
          timestamp: nowStr,
        };
      }

      const cards = activeSessions.map((s) => ({
        title: `${s.classroom}: ${s.subject}`,
        value: `${s.department} (Sec ${s.section})`,
        subtitle: `Faculty: ${s.faculty} • Time: ${s.start_time} - ${s.end_time || 'Present'}`,
        badge: 'ACTIVE',
        severity: 'SUCCESS' as const,
        metadata: { session_id: s.id, classroom: s.classroom },
      }));

      return {
        query: rawQuery,
        spoken_answer: `There are ${activeSessions.length} active classroom sessions currently running across campus.`,
        text_answer: `Identified ${activeSessions.length} active lecture halls conducting real-time attendance sessions:`,
        cards,
        quick_actions: [
          { label: 'Open Live Camera Feed', action_type: 'NAVIGATE', payload: { tab: 'live-camera' } },
          { label: 'Campus 3D Digital Twin', action_type: 'NAVIGATE', payload: { tab: 'digital-twin' } },
        ],
        timestamp: nowStr,
      };
    }

    // 2. "Which classrooms have low attendance?"
    if (q.includes('low attendance') && (q.includes('classroom') || q.includes('hall') || q.includes('lecture'))) {
      const activeSessions = db.getSessions({ status: 'ACTIVE' });
      const lowTurnout = activeSessions
        .map((s) => {
          const records = db.getAttendance({ session_id: s.id });
          const present = records.filter((r) => r.status === 'PRESENT').length;
          const total = s.roster_snapshot?.total_students || 60;
          const pct = total > 0 ? Math.round((present / total) * 100) : 0;
          return { session: s, present, total, pct };
        })
        .filter((item) => item.pct < 75);

      if (lowTurnout.length === 0) {
        return {
          query: rawQuery,
          spoken_answer: 'All active classrooms currently meet the 75 percent institutional attendance threshold.',
          text_answer: 'No active classrooms are below the 75% attendance benchmark.',
          cards: [
            {
              title: 'Compliance Status',
              value: '100% OK',
              subtitle: 'All active halls have ≥75% attendance',
              severity: 'SUCCESS',
            },
          ],
          quick_actions: [
            { label: 'View Attendance Records', action_type: 'NAVIGATE', payload: { tab: 'attendance' } },
          ],
          timestamp: nowStr,
        };
      }

      return {
        query: rawQuery,
        spoken_answer: `Identified ${lowTurnout.length} classroom with attendance below the 75 percent benchmark.`,
        text_answer: `Found ${lowTurnout.length} lecture hall(s) requiring Proctor/HOD review:`,
        cards: lowTurnout.map((item) => ({
          title: `${item.session.classroom} — ${item.session.subject}`,
          value: `${item.pct}% Attendance`,
          subtitle: `${item.present} verified present out of ${item.total} enrolled (${item.session.department})`,
          badge: 'LOW TURNOUT',
          severity: 'WARNING' as const,
        })),
        quick_actions: [
          { label: 'Review Absentees', action_type: 'NAVIGATE', payload: { tab: 'attendance' } },
          { label: 'Inspect Digital Twin', action_type: 'NAVIGATE', payload: { tab: 'digital-twin' } },
        ],
        timestamp: nowStr,
      };
    }

    // 3. "Show offline cameras"
    if (q.includes('offline camera') || q.includes('disconnected camera') || q.includes('camera offline')) {
      const cams = this.getCameraRegistry();
      const offline = cams.filter((c) => c.stream_state === 'OFFLINE');

      if (offline.length === 0) {
        return {
          query: rawQuery,
          spoken_answer: 'All registered institutional cameras are currently connected and streaming.',
          text_answer: 'Zero offline cameras detected. All optical capture nodes are operating normally.',
          cards: [
            {
              title: 'Camera Subsystem',
              value: `${cams.length}/${cams.length} Online`,
              subtitle: 'All video streams active',
              severity: 'SUCCESS',
            },
          ],
          quick_actions: [
            { label: 'Open Camera Manager', action_type: 'NAVIGATE', payload: { tab: 'cameras' } },
          ],
          timestamp: nowStr,
        };
      }

      return {
        query: rawQuery,
        spoken_answer: `There are ${offline.length} offline cameras requiring network attention.`,
        text_answer: `Found ${offline.length} disconnected camera terminal(s):`,
        cards: offline.map((c) => ({
          title: c.name,
          value: 'OFFLINE',
          subtitle: `Classroom: ${c.classroom} • Source: ${c.source}`,
          badge: 'NO SIGNAL',
          severity: 'ALERT' as const,
        })),
        quick_actions: [
          { label: 'Diagnose Cameras', action_type: 'NAVIGATE', payload: { tab: 'cameras' } },
        ],
        timestamp: nowStr,
      };
    }

    // 4. "List students with low attendance"
    if (q.includes('low attendance') || q.includes('students with low') || q.includes('at risk student') || q.includes('students at risk')) {
      const risks = this.evaluateAttendanceRisk();
      const highAndMedium = risks.filter((r) => r.risk_level === 'HIGH' || r.risk_level === 'MEDIUM').slice(0, 6);

      return {
        query: rawQuery,
        spoken_answer: `Found ${highAndMedium.length} students flagged with attendance risk below institutional benchmarks.`,
        text_answer: `Attendance Risk Intelligence flagged the following students:`,
        cards: highAndMedium.map((r) => ({
          title: `${r.full_name} (${r.roll_number})`,
          value: `${r.attendance_percentage}% Attendance`,
          subtitle: `${r.department} Sec ${r.section} • Risk Score: ${r.risk_score}/100`,
          badge: r.risk_level,
          severity: r.risk_level === 'HIGH' ? 'ALERT' : ('WARNING' as any),
        })),
        quick_actions: [
          { label: 'Open Risk Intelligence Center', action_type: 'NAVIGATE', payload: { tab: 'students' } },
          { label: 'View Absence Notices', action_type: 'NAVIGATE', payload: { tab: 'notifications' } },
        ],
        timestamp: nowStr,
      };
    }

    // 5. "What is current campus occupancy?"
    if (q.includes('occupancy') || q.includes('how many people') || q.includes('campus crowd')) {
      const classrooms = this.getClassroomsState();
      const totalVerified = classrooms.reduce((acc, c) => acc + c.verified_students, 0);
      const totalPhysical = classrooms.reduce((acc, c) => acc + c.physical_occupancy, 0);
      const activeClassroomCount = classrooms.filter((c) => c.active_session !== null).length;

      return {
        query: rawQuery,
        spoken_answer: `Current verified campus attendance is ${totalVerified} students across ${activeClassroomCount} active lecture halls, with physical occupancy estimated at ${totalPhysical}.`,
        text_answer: `Real-time campus spatial telemetry overview:`,
        cards: [
          {
            title: 'Verified Present',
            value: totalVerified,
            subtitle: 'Biometrically confirmed students',
            severity: 'SUCCESS',
          },
          {
            title: 'Physical Occupancy',
            value: totalPhysical,
            subtitle: 'Real-time spatial head/body tracking',
            severity: 'INFO',
          },
          {
            title: 'Active Lecture Halls',
            value: activeClassroomCount,
            subtitle: 'Conducting live sessions',
            severity: 'INFO',
          },
        ],
        quick_actions: [
          { label: 'Open 3D Digital Twin', action_type: 'NAVIGATE', payload: { tab: 'digital-twin' } },
          { label: 'Live Camera Grid', action_type: 'NAVIGATE', payload: { tab: 'live-camera' } },
        ],
        timestamp: nowStr,
      };
    }

    // 6. "Show device status in LH-301" or any classroom
    const classroomMatch = q.match(/lh-?\d{3}|cs-lab-?\d|ai-lab-?\d|iot-lab-?\d/i);
    if (classroomMatch || q.includes('device status')) {
      const targetClassroom = classroomMatch ? classroomMatch[0].toUpperCase().replace('LH', 'LH-') : 'LH-301';
      const devices = this.getDeviceHealthRegistry().filter(
        (d) => d.classroom.toLowerCase() === targetClassroom.toLowerCase()
      );

      if (devices.length === 0) {
        return {
          query: rawQuery,
          spoken_answer: `No dedicated IoT hardware devices registered in ${targetClassroom}.`,
          text_answer: `No IoT hardware devices mapped to ${targetClassroom}.`,
          cards: [
            {
              title: `${targetClassroom} Devices`,
              value: '0 Devices',
              subtitle: 'Check Campus Hardware Network to pair ESP32 or gateways',
              severity: 'INFO',
            },
          ],
          quick_actions: [
            { label: 'Open Device Center', action_type: 'NAVIGATE', payload: { tab: 'devices' } },
          ],
          timestamp: nowStr,
        };
      }

      return {
        query: rawQuery,
        spoken_answer: `In ${targetClassroom}, ${devices.filter((d) => d.status === 'ONLINE').length} out of ${devices.length} devices are online.`,
        text_answer: `Hardware status for ${targetClassroom}:`,
        cards: devices.map((d) => ({
          title: d.name,
          value: d.status,
          subtitle: `IP: ${d.ip_address} • Heartbeat: ${d.heartbeat_age_seconds}s ago • Firmware: ${d.firmware_version}`,
          badge: d.type,
          severity: d.status === 'ONLINE' ? 'SUCCESS' : ('ALERT' as any),
        })),
        quick_actions: [
          { label: 'Manage Devices', action_type: 'NAVIGATE', payload: { tab: 'devices' } },
        ],
        timestamp: nowStr,
      };
    }

    // Default fallback intelligent response
    return {
      query: rawQuery,
      spoken_answer: 'Command Center AI is monitoring campus operations. You can ask to view active classrooms, low attendance, offline cameras, or device health.',
      text_answer: `I analyzed your query: "${rawQuery}". Try asking one of these operational commands:`,
      cards: [
        { title: 'Show active classrooms', value: 'Classroom State', subtitle: 'Lists active lectures & attendance' },
        { title: 'Which classrooms have low attendance?', value: 'Attendance Audit', subtitle: 'Flags halls below 75% threshold' },
        { title: 'Show offline cameras', value: 'Camera Health', subtitle: 'Inspects video stream states' },
        { title: 'What is current campus occupancy?', value: 'Spatial Telemetry', subtitle: 'Aggregates present students' },
      ],
      quick_actions: [
        { label: 'View Command Center', action_type: 'NAVIGATE', payload: { tab: 'overview' } },
        { label: 'Open Live Stream', action_type: 'NAVIGATE', payload: { tab: 'live-camera' } },
      ],
      timestamp: nowStr,
    };
  }
}

export const orchestrator = CampusIntelligenceOrchestrator.getInstance();
