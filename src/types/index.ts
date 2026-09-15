export type UserRole = 'ADMIN' | 'HOD';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
  department: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
}

export interface Student {
  id: string;
  student_id: string;
  full_name: string;
  roll_number: string;
  username?: string;
  department: string;
  section: string;
  academic_year: string;
  batch: string;
  mobile: string;
  email: string;
  face_registered: boolean;
  face_images_count: number;
  face_images?: string[];
  encodings?: number[][];
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface DepartmentRosterInfo {
  total: number;
  student_ids: string[];
  roll_numbers: string[];
  students: Array<{
    id: string;
    student_id: string;
    full_name: string;
    roll_number: string;
    department: string;
    section: string;
  }>;
}

export interface DepartmentSessionStat {
  department: string;
  total: number;
  present: number;
  absent: number;
  attendance_percentage: number;
}

export interface AttendanceSession {
  id: string;
  department: string;
  section: string;
  subject: string;
  classroom: string;
  faculty?: string;
  academic_year?: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'ACTIVE' | 'COMPLETED' | 'SCHEDULED';
  created_by: string;
  created_at: string;
  is_multi_department?: boolean;
  departments?: string[];
  roster_snapshot?: {
    total_students: number;
    departments: Record<string, DepartmentRosterInfo>;
  };
  department_stats?: Record<string, DepartmentSessionStat>;
}

export interface AttendanceVerificationEvidence {
  face_detected: boolean;
  detection_score: number;
  landmarks_valid: boolean;
  image_quality_valid: boolean;
  sharpness_score?: number;
  brightness_value?: number;
  embedding_similarity: number;
  similarity_threshold: number;
  temporal_confirmation: string;
  liveness_score?: number;
  liveness_result: string;
  server_timestamp: string;
  source_camera?: string;
  resolution?: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  roll_number: string;
  full_name: string;
  department: string;
  section: string;
  session_id: string;
  subject: string;
  classroom: string;
  date: string;
  time: string;
  status: 'PRESENT' | 'ABSENT';
  confidence: number;
  verification_method: 'FACE_RECOGNITION' | 'MANUAL_OVERRIDE';
  camera_source?: 'WEB_CAMERA' | 'MOBILE_CAMERA';
  created_at: string;
  marked_by: string;
  notes?: string;
  evidence?: AttendanceVerificationEvidence;
}

export type MobileCameraStatus = 'PAIRING' | 'CONNECTED' | 'STREAMING' | 'DEGRADED' | 'DISCONNECTED';

export interface MobileCameraSession {
  id: string;
  attendance_session_id: string;
  pairing_code: string;
  pairing_token: string;
  device_id?: string;
  device_info?: {
    userAgent?: string;
    platform?: string;
    cameraFacing?: string;
    orientation?: 'landscape' | 'portrait';
  };
  status: MobileCameraStatus;
  connected_at?: string;
  disconnected_at?: string;
  last_frame_at?: string;
  fps?: number;
  latency_ms?: number;
  total_frames_received?: number;
  total_faces_detected?: number;
  total_verified_marks?: number;
  created_at: string;
  expires_at: string;
  session_details?: {
    subject: string;
    classroom: string;
    department: string;
    section: string;
    date: string;
  };
}

export interface MobileLiveFeedFrame {
  session_id: string;
  timestamp: number;
  preview_image?: string; // base64 preview frame
  faces_count: number;
  results: RecognitionBox[];
  fps: number;
  latency_ms: number;
  orientation?: 'landscape' | 'portrait';
}

export interface AuditLog {
  id: string;
  action: string;
  performed_by: string;
  target_type: string;
  target_id: string;
  details: string;
  timestamp: string;
}

export interface SystemSettings {
  institution_name: string;
  institution_code: string;
  recognition_threshold: number;
  temporal_confirmation_frames: number;
  min_face_size_px: number;
  allow_manual_override: boolean;
  academic_session: string;
  liveness_threshold?: number;
  anti_spoofing_enabled?: boolean;
  quality_check_enabled?: boolean;
  // Camera Connectivity & Reachability Settings (Phase 10)
  app_public_url?: string;
  dev_public_origin?: string;
  dev_lan_origin?: string;
  webrtc_stun_urls?: string[];
  webrtc_turn_url?: string;
  webrtc_turn_username?: string;
  webrtc_turn_credential?: string;
}

export type CameraSourceType =
  | 'MOBILE_CAMERA'
  | 'USB_WEBCAM'
  | 'WIFI_IP_CAMERA'
  | 'CLASSROOM_CAMERA'
  | 'BLUETOOTH_DEVICE';

export interface RegisteredCamera {
  id: string;
  name: string;
  classroom: string;
  building: string;
  department: string;
  type: 'CLASSROOM_CAMERA' | 'IP_CAMERA' | 'USB_WEBCAM' | 'MOBILE_CAMERA' | 'BLUETOOTH_DEVICE';
  connection_type: 'RTSP' | 'ONVIF' | 'WEBRTC' | 'USB' | 'BLE';
  ip_address?: string;
  rtsp_url?: string;
  onvif_port?: number;
  stream_profile?: string;
  username?: string;
  password?: string;
  status: 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'AUTH_FAILED' | 'STREAM_ERROR';
  last_seen?: string;
  latency_ms?: number;
  fps?: number;
  faces_detected_count?: number;
  verified_attendance_count?: number;
  created_at: string;
}

export type DeviceCategory =
  | 'CAMERA'
  | 'BLE_SENSOR'
  | 'ESP32_GATEWAY'
  | 'ENVIRONMENTAL_SENSOR'
  | 'OCCUPANCY_SENSOR'
  | 'DOOR_BEACON'
  | 'REMOTE_SENSING';

export type DeviceProtocol = 'HTTPS_REST' | 'WEBSOCKET' | 'MQTT' | 'BLE_GATT' | 'RTSP' | 'WEBRTC' | 'OPEN_METEO_API';

export type DeviceStatus = 'ONLINE' | 'CONNECTING' | 'OFFLINE' | 'DEGRADED' | 'ERROR';

export interface DeviceTelemetry {
  temperature_c?: number;
  humidity_pct?: number;
  co2_ppm?: number;
  pm25?: number;
  pm10?: number;
  voc_ppb?: number;
  noise_db?: number;
  occupancy_count?: number;
  battery_pct?: number;
  rssi_dbm?: number;
  raw_payload?: Record<string, any>;
  received_at: string;
}

export type DeviceRole =
  | 'Attendance Camera'
  | 'Occupancy Sensor'
  | 'Environmental Sensor'
  | 'Door Sensor'
  | 'IoT Gateway'
  | 'Classroom Display'
  | string;

export interface CampusDevice {
  id: string;
  name: string;
  category: DeviceCategory;
  device_type: string;
  classroom: string;
  building: string;
  room?: string;
  department: string;
  protocol: DeviceProtocol;
  ip_or_hostname?: string;
  mac_or_uuid?: string;
  device_token?: string;
  status: DeviceStatus;
  capabilities: string[];
  telemetry?: DeviceTelemetry;
  device_role?: DeviceRole;
  last_heartbeat?: string;
  last_seen?: string;
  device_timestamp?: string;
  server_timestamp?: string;
  last_error?: string;
  created_at: string;
  registered_by: string;
}

export interface HardwareCameraDevice {
  deviceId: string;
  label: string;
  kind: 'videoinput';
  groupId?: string;
  type: 'Integrated Laptop Camera' | 'USB Webcam / External Camera' | 'Camera Device';
  resolution?: { width: number; height: number };
  fps?: number;
  facingMode?: string;
  permissionState: 'granted' | 'prompt' | 'denied';
  isConnected: boolean;
  isAttendanceSource: boolean;
}

export interface DiscoveredUsbDevice {
  device: any;
  vendorId: number;
  productId: number;
  productName: string;
  manufacturerName: string;
  serialNumber?: string;
  opened: boolean;
  assignedRole?: string;
  assignedRoom?: string;
  assignedBuilding?: string;
}

export type WebUsbCapabilityState = 'SUPPORTED' | 'UNSUPPORTED' | 'PERMISSION_REQUIRED' | 'BLOCKED_BY_IFRAME';

export interface DiscoveredBluetoothDevice {
  id: string;
  name: string;
  type:
    | 'Mobile Phone'
    | 'Camera'
    | 'Headset'
    | 'Speaker'
    | 'BLE Beacon'
    | 'Environmental Sensor'
    | 'ESP32'
    | 'Arduino-compatible BLE device'
    | 'Unknown Bluetooth Device';
  connectionState: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  rssi?: number;
  estimatedRange?: string; // e.g. "Estimated: ~2.4m" or "Range unavailable"
  battery?: number;
  services: string[];
  manufacturerInfo?: string;
  lastSeen: string;
  deviceObj?: any;
  gattServer?: any;
}

export interface ClassroomAssignment {
  deviceId: string;
  deviceName: string;
  building: string;
  room: string;
  classroom: string;
  deviceRole:
    | 'Attendance Camera'
    | 'Occupancy Sensor'
    | 'Environmental Sensor'
    | 'Door Sensor'
    | 'IoT Gateway'
    | 'Classroom Display';
}

export interface SmartClassroomCorrelation {
  classroom: string;
  session_id?: string;
  subject?: string;
  department?: string;
  attendance_face_count: number;
  physical_occupancy_count?: number;
  occupancy_source?: string;
  discrepancy: number;
  discrepancy_alert?: string;
  environmental?: {
    temperature_c?: number;
    humidity_pct?: number;
    co2_ppm?: number;
    air_quality_index?: number;
    noise_db?: number;
    telemetry_source?: string;
    telemetry_time?: string;
  };
  last_updated: string;
}

export interface RemoteSensingData {
  success: boolean;
  provider: string;
  attribution: string;
  institution_location: {
    campus: string;
    city: string;
    latitude: number;
    longitude: number;
    elevation_m: number;
  };
  acquisition_time: string;
  data_freshness: string;
  spatial_resolution: string;
  weather?: {
    temperature_c: number;
    apparent_temperature_c: number;
    relative_humidity_pct: number;
    surface_pressure_hpa: number;
    cloud_cover_pct: number;
    wind_speed_kmh: number;
    wind_direction_deg: number;
    solar_irradiance_wm2: number;
    precipitation_mm: number;
    weather_code: number;
  };
  air_quality?: {
    us_aqi: number;
    european_aqi: number;
    pm2_5_ugm3: number;
    pm10_ugm3: number;
    carbon_monoxide_ugm3: number;
    nitrogen_dioxide_ugm3: number;
    ozone_ugm3: number;
  };
}

export type BluetoothCapabilityState =
  | 'AVAILABLE'
  | 'BLOCKED_BY_BROWSER'
  | 'BLOCKED_BY_PERMISSIONS_POLICY'
  | 'UNSUPPORTED'
  | 'HTTPS_REQUIRED'
  | 'USER_PERMISSION_REQUIRED'
  | 'BLUETOOTH_SUPPORTED'
  | 'BLUETOOTH_UNSUPPORTED'
  | 'PERMISSION_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'PERMISSIONS_POLICY_BLOCKED'
  | 'INSECURE_CONTEXT'
  | 'SCANNING'
  | 'DEVICE_FOUND'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR';

export interface DeviceEventLog {
  id: string;
  type: 'DEVICE_CONNECTED' | 'DEVICE_DISCONNECTED' | 'TELEMETRY_RECEIVED' | 'SENSOR_WARNING' | 'HEARTBEAT' | 'CORRELATION_WARNING' | 'DEVICE_REGISTERED' | string;
  device_id: string;
  device_name: string;
  classroom: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  data?: any;
}

export interface ReachabilityTestResult {
  success: boolean;
  url: string;
  status_code?: number;
  latency_ms?: number;
  reachable: boolean;
  is_ai_studio_preview: boolean;
  is_localhost: boolean;
  has_google_login_redirect: boolean;
  message: string;
  diagnostics: {
    origin_tested: string;
    protocol?: string;
    host?: string;
    http_status?: number;
    response_type?: string;
    checked_at: string;
    suggested_fix?: string;
  };
}

export interface DepartmentInfo {
  code: string;
  name: string;
  sections: string[];
  subjects: string[];
  classrooms: string[];
}

export type LivenessStatus = 'CHECKING' | 'LIVE' | 'SPOOF_SUSPECTED' | 'UNCERTAIN';
export type RecognitionStatus = 'DETECTING' | 'MATCHING' | 'CONFIRMING' | 'VERIFIED' | 'UNKNOWN';

export interface FaceQualityMetrics {
  face_size_px: number;
  blur_score: number;
  brightness_score: number;
  contrast_score: number;
  is_valid: boolean;
  rejection_reason?: string;
}

export interface RecognitionBox {
  tracking_id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: 'RECOGNIZED' | 'UNKNOWN';
  state?: string;
  recognition_state?: RecognitionStatus;
  liveness?: {
    is_live?: boolean;
    spoof_suspected?: boolean;
    liveness_score?: number;
    variance?: number;
    state?: string;
  };
  liveness_status?: LivenessStatus;
  liveness_score?: number;
  quality?: FaceQualityMetrics;
  quality_valid?: boolean;
  quality_rejection?: string;
  student?: {
    id: string;
    student_id: string;
    full_name: string;
    roll_number: string;
    department: string;
    section: string;
  } | null;
  confidence: number;
  distance: number;
  second_distance?: number;
  isConfirmed: boolean;
  confirmationFrames: number;
  requiredFrames?: number;
  attendanceMarked?: boolean;
  duplicateIgnored?: boolean;
  spoofDetected?: boolean;
  crop_data_url?: string;
  camera_source?: 'WEB_CAMERA' | 'MOBILE_CAMERA';
  visual_signals?: {
    face_direction: string;
    head_pose: { yaw: number; pitch: number; roll: number };
    eye_aspect_ratio: number;
    mouth_open_ratio: number;
    gaze_estimate: string;
    objective_statement: string;
    signal_label: 'AI-estimated visual signal';
  } | null;
  motion_track?: any;
}

export interface LiveActivityEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  metadata?: Record<string, any>;
}

export interface CommandCenterData {
  live_attendance: {
    status: 'ACTIVE' | 'IDLE';
    active_sessions_count: number;
    total_markings_today: number;
    active_session_name?: string;
  };
  students_present: {
    count: number;
    percentage: number;
  };
  students_absent: {
    count: number;
    percentage: number;
  };
  unknown_people: {
    count: number;
    recent_events_count: number;
  };
  recognition_confidence: {
    average_confidence: number;
    model: string;
    dimension: string;
  };
  connected_cameras: {
    count: number;
    online_count: number;
    sources: string[];
  };
  camera_health: {
    status: 'HEALTHY' | 'WARNING' | 'STANDBY';
    avg_fps: number;
    avg_latency_ms: number;
  };
  google_sheet_health: {
    status: 'SYNCHRONIZED' | 'NEEDS_SYNC';
    total_students: number;
    biometric_ready_count: number;
    last_synced_at?: string;
  };
  ai_agent_status: {
    status: 'ONLINE';
    engine: string;
    vector_search: string;
    llm_interpreter: string;
  };
  sensor_status: {
    status: 'NO SENSOR CONNECTED';
    connected_count: number;
    gateway: string;
  };
  live_activity: LiveActivityEvent[];
}

export interface DashboardSummary {
  date: string;
  department: string;
  total_students: number;
  registered_faces: number;
  unregistered_faces: number;
  today_sessions_count: number;
  active_sessions_count: number;
  today_attendance_records: number;
  present_count: number;
  attendance_rate: number;
  open_anomalies_count?: number;
  high_risk_students_count?: number;
  security_events_count?: number;
}

// Phase 3: Attendance Anomaly Engine
export type AnomalyType =
  | 'MASS_ABSENCE'
  | 'SUDDEN_DROP'
  | 'SUDDEN_SPIKE'
  | 'REPEATED_ABSENCE'
  | 'UNUSUAL_RECOGNITION'
  | 'SPOOF_ATTEMPT';

export type AnomalySeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface AttendanceAnomaly {
  id: string;
  session_id?: string;
  student_id?: string;
  student_name?: string;
  roll_number?: string;
  department_id: string;
  section?: string;
  subject?: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  evidence: {
    expected?: number | string;
    actual?: number | string;
    difference?: number | string;
    consecutive_count?: number;
    metric_details?: Record<string, any>;
  };
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

// Phase 3: Security & Anti-Spoofing Events
export type SecurityEventType =
  | 'SPOOF_ATTEMPT'
  | 'MULTIPLE_FACE_ENROLLMENT'
  | 'UNAUTHORIZED_ACCESS'
  | 'REPEATED_FAILED_LOGIN'
  | 'UNUSUAL_RECOGNITION'
  | 'ATTENDANCE_OVERRIDE'
  | 'FACE_DATABASE_CHANGE'
  | 'INTRUSION_ATTEMPT'
  | 'SQLI_PROBE'
  | 'XSS_INJECTION'
  | 'PATH_TRAVERSAL'
  | 'COMMAND_INJECTION'
  | 'EXPLOIT_SCANNER'
  | 'BRUTE_FORCE'
  | 'TOKEN_TAMPERING'
  | 'IP_JAILED';

export interface SecurityEventLocation {
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  isp?: string;
  latitude?: number;
  longitude?: number;
  flag?: string;
}

export interface SecurityEvent {
  id: string;
  session_id?: string;
  student_id?: string;
  student_name?: string;
  department?: string;
  event_type: SecurityEventType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: string;
  timestamp: string;
  ip_address?: string;
  location?: SecurityEventLocation;
  user_agent?: string;
  target_endpoint?: string;
  attack_payload?: string;
  blocked?: boolean;
  jail_status?: 'JAILED' | 'WATCHED' | 'RELEASED' | 'BLOCKED';
}

// Phase 3: Recognition Event
export interface RecognitionEvent {
  id: string;
  session_id?: string;
  student_id?: string;
  confidence: number;
  face_distance: number;
  liveness_score: number;
  result: 'RECOGNIZED' | 'UNKNOWN' | 'SPOOF' | 'UNCERTAIN';
  timestamp: string;
}

// Phase 3: Student Attendance Risk Engine
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DECLINING';

export interface StudentRiskProfile {
  student_id: string;
  student_name: string;
  roll_number: string;
  department: string;
  section: string;
  total_sessions: number;
  attended_sessions: number;
  attendance_percentage: number;
  consecutive_absences: number;
  recent_trend: TrendDirection;
  risk_level: RiskLevel;
  reason: string;
  recommended_action: string;
  last_attended_date?: string;
}

// Phase 3: AI Smart Insights
export interface AiInsight {
  id: string;
  scope: 'INSTITUTION' | 'DEPARTMENT';
  department_id?: string;
  insight_type: 'SUMMARY' | 'RISK_ALERT' | 'PERFORMANCE' | 'SECURITY' | 'ANOMALY';
  title: string;
  description: string;
  supporting_data: {
    previous_average?: number;
    current_average?: number;
    difference?: number;
    total_samples?: number;
    affected_count?: number;
    metrics?: Record<string, any>;
  };
  severity: 'INFO' | 'WARNING' | 'HIGH';
  created_at: string;
}

// Phase 3: System Health Monitor
export interface SystemHealthStatus {
  status: 'HEALTHY' | 'WARNING' | 'DEGRADED' | 'OFFLINE';
  timestamp: string;
  uptime_seconds: number;
  backend: {
    status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
    latency_ms: number;
    api_available: boolean;
  };
  database: {
    status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
    connected: boolean;
    total_records: number;
  };
  recognition: {
    status: 'HEALTHY' | 'WARNING' | 'DEGRADED';
    total_attempts: number;
    success_rate: number;
    unknown_rate: number;
    average_confidence: number;
    average_latency_ms: number;
  };
  liveness: {
    status: 'HEALTHY' | 'WARNING';
    liveness_checks_count: number;
    spoof_detected_count: number;
    spoof_rate: number;
  };
}

// Phase 3: Real-time Event Stream Item
export interface LiveEventItem {
  id: string;
  timestamp: string;
  type:
    | 'FACE_DETECTED'
    | 'FACE_RECOGNIZED'
    | 'FACE_UNKNOWN'
    | 'LIVENESS_VERIFIED'
    | 'LIVENESS_FAILED'
    | 'ATTENDANCE_MARKED'
    | 'DUPLICATE_ATTENDANCE'
    | 'SPOOF_DETECTED'
    | 'SESSION_STARTED'
    | 'SESSION_STOPPED';
  message: string;
  tracking_id?: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
}

// Phase 4: Production Accuracy, Security & Validation Types
export interface BenchmarkThresholdEval {
  threshold: number;
  accuracy: number;
  far: number;
  frr: number;
  f1: number;
}

export interface FaceRecognitionBenchmarkResult {
  id: string;
  timestamp: string;
  total_students_evaluated: number;
  total_enrolled_faces: number;
  genuine_pairs_count: number;
  imposter_pairs_count: number;
  true_positives: number;
  false_positives: number;
  true_negatives: number;
  false_negatives: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  far: number;
  frr: number;
  genuine_distance_mean: number;
  genuine_distance_min: number;
  genuine_distance_max: number;
  genuine_distance_std: number;
  imposter_distance_mean: number;
  imposter_distance_min: number;
  imposter_distance_max: number;
  imposter_distance_std: number;
  tested_threshold: number;
  optimal_threshold: number;
  threshold_analysis: BenchmarkThresholdEval[];
}

export interface AutomatedSystemTest {
  id: string;
  category: 'UNIT' | 'INTEGRATION' | 'SECURITY_RBAC' | 'TRANSACTION' | 'RECOVERY';
  name: string;
  description: string;
  status: 'PASSED' | 'FAILED' | 'RUNNING';
  duration_ms: number;
  details: string;
}

export interface LivenessBenchmarkStats {
  genuine_acceptance_rate: number;
  spoof_rejection_rate: number;
  false_spoof_rate: number;
  average_latency_ms: number;
  total_evaluated: number;
  presentation_attacks_tested: number;
}

export interface BackupSnapshotInfo {
  filename: string;
  timestamp: string;
  size_bytes: number;
  total_students: number;
  total_attendance_records: number;
  total_sessions: number;
  total_audit_logs: number;
  sha256_checksum: string;
}

export interface TimetableSlot {
  id: string;
  department: string;
  departments?: string[];
  section: string;
  classroom: string;
  subject: string;
  faculty: string;
  start_time: string;
  end_time: string;
  days: string[];
  period_number: number;
  academic_year: string;
  semester?: string;
  attendance_frequency?: string;
  grace_period_minutes?: number;
  attendance_policy: 'IMMEDIATE_CONFIRMATION' | 'STRICT_TEMPORAL_3F' | 'ROBUST_MULTI_PASS';
  camera_ids?: string[];
  is_active: boolean;
  is_multi_department?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AbsenceNotification {
  id: string;
  notification_id: string;
  student_id: string;
  roll_number: string;
  student_name: string;
  email: string;
  session_id: string;
  subject: string;
  classroom: string;
  faculty: string;
  date: string;
  period: string;
  sent_at: string;
  delivery_status: 'DELIVERED' | 'FAILED' | 'RETRY' | 'QUEUED';
  failure_reason?: string;
  retry_count: number;
}

export interface StudentBehaviorEvent {
  id: string;
  session_id: string;
  student_id: string;
  roll_number: string;
  student_name: string;
  timestamp: string;
  event_type: 'FACE_VERIFIED' | 'HEAD_ORIENTATION_CHANGED' | 'OUTSIDE_CAMERA_VIEW' | 'OBJECT_DETECTED' | 'SESSION_CONCLUDED';
  signal_label: 'AI-estimated visual signal';
  details: string;
  metadata?: {
    camera_id?: string;
    classroom?: string;
    head_pose?: { yaw?: number; pitch?: number; roll?: number };
    gaze_direction?: string;
    detected_object?: string;
    confidence?: number;
  };
}

export interface PeriodAttendanceItem {
  period_time: string;
  subject: string;
  classroom: string;
  faculty?: string;
  status: 'PRESENT' | 'ABSENT' | 'SCHEDULED';
  session_id?: string;
  timestamp?: string;
}

export interface StudentAnalyticsProfile {
  student: Student;
  total_sessions_conducted: number;
  sessions_attended: number;
  sessions_absent: number;
  attendance_percentage: number;
  daily_attendance?: number;
  weekly_attendance?: number;
  monthly_attendance?: number;
  semester_attendance?: number;
  daily_timeline?: PeriodAttendanceItem[];
  consecutive_absences?: number;
  risk_indicators?: Array<{
    type: 'LOW_ATTENDANCE_RISK' | 'DECLINING_ATTENDANCE' | 'ABSENCE_PATTERN';
    severity: 'CRITICAL' | 'WARNING' | 'MONITOR';
    explanation: string;
  }>;
  notifications?: AbsenceNotification[];
  object_detection_events?: StudentBehaviorEvent[];
  subject_wise: Record<string, { total: number; attended: number; percentage: number }>;
  monthly_trend: Array<{ month: string; total: number; attended: number; percentage: number }>;
  recent_records: AttendanceRecord[];
  behavior_events: StudentBehaviorEvent[];
  biometric_readiness: {
    status: 'READY' | 'ENROLLMENT_REQUIRED';
    photos_count: number;
    has_embeddings: boolean;
    last_biometric_sync?: string;
    google_sheets_synced: boolean;
  };
  has_data: boolean;
  no_data_reason?: string;
}

export interface CampusNode3D {
  id: string;
  name: string;
  type: 'BUILDING' | 'CLASSROOM' | 'CAMERA' | 'IOT_GATEWAY';
  building: string;
  classroom?: string;
  department?: string;
  position: [number, number, number];
  status: 'ONLINE' | 'OFFLINE' | 'ACTIVE_SESSION' | 'IDLE';
  metadata?: {
    active_subject?: string;
    active_faculty?: string;
    present_count?: number;
    total_roster?: number;
    temperature_c?: number;
    humidity_pct?: number;
    stream_profile?: string;
    ip_address?: string;
  };
}

