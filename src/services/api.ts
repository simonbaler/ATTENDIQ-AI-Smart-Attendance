import {
  User,
  Student,
  AttendanceSession,
  AttendanceRecord,
  AuditLog,
  SystemSettings,
  DashboardSummary,
  DepartmentInfo,
  CampusDevice,
  SmartClassroomCorrelation,
  RemoteSensingData,
  DeviceTelemetry,
} from '../types';

const API_BASE = '/api';

async function safeJson<T = any>(res: Response, fallback: T): Promise<T> {
  try {
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('sits_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ success: boolean; token: string; user: User; message?: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  },

  async getMe(): Promise<{ success: boolean; user?: User; message?: string }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async logout(): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      return res.json();
    } catch {
      return { success: true };
    }
  },

  async getUsers(): Promise<{ success: boolean; users: User[] }> {
    const res = await fetch(`${API_BASE}/auth/users`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async createUser(payload: { username: string; password: string; name: string; department: string; role?: string }): Promise<{ success: boolean; message: string; user?: User }> {
    const res = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async updateUserStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/users/${id}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  async resetUserPassword(id: string, new_password: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/users/${id}/reset-password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ new_password }),
    });
    return res.json();
  },

  // Departments
  async getDepartments(): Promise<{ success: boolean; departments: DepartmentInfo[] }> {
    const res = await fetch(`${API_BASE}/departments`);
    return res.json();
  },

  // Students
  async getStudents(params?: { department?: string; section?: string; status?: string; search?: string }): Promise<{ success: boolean; count: number; students: Student[] }> {
    const query = new URLSearchParams();
    if (params?.department) query.append('department', params.department);
    if (params?.section) query.append('section', params.section);
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE}/students?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getStudentById(id: string): Promise<{ success: boolean; student: Student }> {
    const res = await fetch(`${API_BASE}/students/${id}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async registerStudent(student: Partial<Student>): Promise<{ success: boolean; message: string; student?: Student }> {
    const res = await fetch(`${API_BASE}/students`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(student),
    });
    return res.json();
  },

  async updateStudent(id: string, data: Partial<Student>): Promise<{ success: boolean; message: string; student?: Student }> {
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async enrollFace(id: string, payload: { encodings: number[][]; images?: string[]; replaceExisting?: boolean }): Promise<{ success: boolean; message: string; student?: any }> {
    const res = await fetch(`${API_BASE}/students/${id}/face/enroll`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async rebuildEncoding(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/students/${id}/rebuild-encoding`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async syncGoogleSheetRoster(params: {
    sheetUrl?: string;
    csvText?: string;
    dryRun?: boolean;
  }): Promise<{
    success: boolean;
    message?: string;
    dryRun?: boolean;
    report?: any;
  }> {
    const res = await fetch(`${API_BASE}/students/sync-google-sheet`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async bulkImportStudents(students: Array<Partial<Student>>): Promise<{
    success: boolean;
    message: string;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    errors?: string[];
  }> {
    const res = await fetch(`${API_BASE}/students/bulk-import`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ students }),
    });
    return res.json();
  },

  async generateSyntheticCohort(params: { department?: string; count?: number; generateEncodings?: boolean }): Promise<{
    success: boolean;
    message: string;
    added_count: number;
    total_indexed: number;
  }> {
    const res = await fetch(`${API_BASE}/students/generate-synthetic-cohort`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async deactivateStudent(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Sessions
  async getSessions(params?: { department?: string; status?: string }): Promise<{ success: boolean; sessions: AttendanceSession[] }> {
    const query = new URLSearchParams();
    if (params?.department) query.append('department', params.department);
    if (params?.status) query.append('status', params.status);

    const res = await fetch(`${API_BASE}/sessions?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getActiveSession(department?: string, section?: string): Promise<{
    success: boolean;
    active: boolean;
    session: AttendanceSession | null;
    stats?: { total_students: number; present_count: number; absent_count: number; attendance_percentage: number };
    department_stats?: Record<string, { department: string; total: number; present: number; absent: number; attendance_percentage: number }>;
    absent_students?: Array<{ id: string; student_id: string; full_name: string; roll_number: string; department: string; section: string; status: 'ABSENT' }>;
  }> {
    const query = new URLSearchParams();
    if (department) query.append('department', department);
    if (section) query.append('section', section);

    const res = await fetch(`${API_BASE}/sessions/active?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async startSession(payload: {
    department?: string;
    section?: string;
    subject: string;
    classroom: string;
    faculty?: string;
    academic_year?: string;
    date?: string;
    start_time?: string;
    is_multi_department?: boolean;
    departments?: string[];
  }): Promise<{ success: boolean; message: string; session?: AttendanceSession }> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async stopSession(id: string): Promise<{ success: boolean; message: string; session?: AttendanceSession }> {
    const res = await fetch(`${API_BASE}/sessions/${id}/stop`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getSessionById(id: string): Promise<{
    success: boolean;
    session: AttendanceSession;
    stats?: { total_students: number; present_count: number; absent_count: number; attendance_percentage: number };
    department_stats?: Record<string, { department: string; total: number; present: number; absent: number; attendance_percentage: number }>;
    absent_students?: Array<{ id: string; student_id: string; full_name: string; roll_number: string; department: string; section: string; status: 'ABSENT' }>;
  }> {
    const res = await fetch(`${API_BASE}/sessions/${id}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Attendance
  async getTodaySummary(): Promise<{ success: boolean; data: DashboardSummary }> {
    try {
      const res = await fetch(`${API_BASE}/attendance/today`, {
        headers: getAuthHeaders(),
      });
      return safeJson(res, { success: false, data: {} as DashboardSummary });
    } catch {
      return { success: false, data: {} as DashboardSummary };
    }
  },

  async getCommandCenterData(): Promise<{ success: boolean; data: import('../types').CommandCenterData }> {
    try {
      const res = await fetch(`${API_BASE}/attendance/command-center`, {
        headers: getAuthHeaders(),
      });
      return safeJson(res, { success: false, data: null as any });
    } catch {
      return { success: false, data: null as any };
    }
  },

  async getAttendance(params?: {
    session_id?: string;
    student_id?: string;
    department?: string;
    section?: string;
    date?: string;
    status?: string;
  }): Promise<{ success: boolean; count: number; records: AttendanceRecord[] }> {
    const query = new URLSearchParams();
    if (params?.session_id) query.append('session_id', params.session_id);
    if (params?.student_id) query.append('student_id', params.student_id);
    if (params?.department) query.append('department', params.department);
    if (params?.section) query.append('section', params.section);
    if (params?.date) query.append('date', params.date);
    if (params?.status) query.append('status', params.status);

    const res = await fetch(`${API_BASE}/attendance?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async processRecognition(payload: {
    session_id?: string;
    faces: Array<{
      descriptor: number[];
      box: { x: number; y: number; width: number; height: number };
      detectionScore?: number;
    }>;
  }): Promise<{
    success: boolean;
    faces_count: number;
    results: any[];
    active_session?: any;
  }> {
    const res = await fetch(`${API_BASE}/attendance/process-recognition`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async overrideAttendance(id: string, status: 'PRESENT' | 'ABSENT', reason?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/attendance/${id}/override`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, reason }),
    });
    return res.json();
  },

  async exportAttendanceCsv(params?: {
    department?: string;
    section?: string;
    session_id?: string;
    date?: string;
    status?: string;
  }): Promise<void> {
    const query = new URLSearchParams();
    if (params?.department) query.append('department', params.department);
    if (params?.section) query.append('section', params.section);
    if (params?.session_id) query.append('session_id', params.session_id);
    if (params?.date) query.append('date', params.date);
    if (params?.status) query.append('status', params.status);

    const token = localStorage.getItem('sits_token');
    const url = `${API_BASE}/reports/attendance/export?${query.toString()}`;

    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error('Failed to download CSV export');
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `SITS_Attendance_Export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  },

  // Settings & Logs
  async getSettings(): Promise<{ success: boolean; settings: SystemSettings }> {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<{ success: boolean; message: string; settings: SystemSettings }> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  async getAuditLogs(limit = 100): Promise<{ success: boolean; count: number; logs: AuditLog[] }> {
    const res = await fetch(`${API_BASE}/audit-logs?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Phase 3: Attendance Anomalies
  async getAnomalies(params?: {
    department_id?: string;
    severity?: string;
    resolved?: boolean;
  }): Promise<{ success: boolean; count: number; anomalies: import('../types').AttendanceAnomaly[] }> {
    const query = new URLSearchParams();
    if (params?.department_id) query.append('department_id', params.department_id);
    if (params?.severity) query.append('severity', params.severity);
    if (params?.resolved !== undefined) query.append('resolved', String(params.resolved));

    const res = await fetch(`${API_BASE}/anomalies?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async resolveAnomaly(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/anomalies/${id}/resolve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async triggerAnomalyDetection(sessionId: string): Promise<{ success: boolean; count: number; detected: any[] }> {
    const res = await fetch(`${API_BASE}/anomalies/detect/${sessionId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Phase 3: Security & Anti-Spoofing
  async getSecurityEvents(params?: {
    department?: string;
    severity?: string;
    event_type?: string;
    limit?: number;
  }): Promise<{ success: boolean; count: number; events: import('../types').SecurityEvent[] }> {
    const query = new URLSearchParams();
    if (params?.department) query.append('department', params.department);
    if (params?.severity) query.append('severity', params.severity);
    if (params?.event_type) query.append('event_type', params.event_type);
    if (params?.limit) query.append('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/security/threats?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getSecurityStats(): Promise<{
    success: boolean;
    stats: {
      total: number;
      critical: number;
      high: number;
      blocked: number;
      jailed_ips_count: number;
      defense_shield_active: boolean;
      firewall_mode: string;
      topVectors: Record<string, number>;
      topCountries: Record<string, number>;
      ips_jailed: any[];
    };
  }> {
    const res = await fetch(`${API_BASE}/security/stats`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getJailedIps(): Promise<{ success: boolean; count: number; jailed_ips: any[] }> {
    const res = await fetch(`${API_BASE}/security/jailed-ips`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async jailIp(payload: { ip: string; reason?: string; duration_minutes?: number }): Promise<{ success: boolean; message: string; record: any }> {
    const res = await fetch(`${API_BASE}/security/jailed-ips`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async unjailIp(ip: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/security/jailed-ips/${encodeURIComponent(ip)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async clearSecurityLogs(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/security/clear-logs`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async runSecurityTestCase(testType: 'SQLI' | 'XSS' | 'PATH_TRAVERSAL' | 'COMMAND_INJECTION' | 'EXPLOIT_SCANNER' | 'TOKEN_TAMPERING' | 'BRUTE_FORCE'): Promise<{
    success: boolean;
    blocked: boolean;
    http_status_enforced: number;
    shield_action: string;
    test_result: {
      test_type: string;
      vector_detected: string;
      sample_payload: string;
      attacker_ip: string;
      location: {
        city: string;
        country: string;
        country_code: string;
        isp: string;
        flag: string;
        coordinates: [number, number];
      };
      event_id: string;
      timestamp: string;
      realtime_alert_broadcasted: boolean;
    };
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/security/test-case`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ test_type: testType }),
    });
    return res.json();
  },

  async logSecurityEvent(payload: {
    session_id?: string;
    student_id?: string;
    student_name?: string;
    department?: string;
    event_type: string;
    severity: string;
    details: string;
  }): Promise<{ success: boolean; event: import('../types').SecurityEvent }> {
    const res = await fetch(`${API_BASE}/security/events`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Phase 3: Risk Intelligence Engine
  async getRiskProfiles(params?: {
    department?: string;
    section?: string;
    risk_level?: string;
  }): Promise<{
    success: boolean;
    count: number;
    summary: { total: number; high_risk: number; medium_risk: number; low_risk: number };
    profiles: import('../types').StudentRiskProfile[];
  }> {
    const query = new URLSearchParams();
    if (params?.department) query.append('department', params.department);
    if (params?.section) query.append('section', params.section);
    if (params?.risk_level) query.append('risk_level', params.risk_level);

    const res = await fetch(`${API_BASE}/risk/profiles?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getStudentRisk(id: string): Promise<{ success: boolean; profile: import('../types').StudentRiskProfile }> {
    const res = await fetch(`${API_BASE}/risk/student/${id}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Phase 3: AI Smart Insights
  async getAiInsights(department?: string): Promise<{
    success: boolean;
    scope: 'INSTITUTION' | 'DEPARTMENT';
    department?: string;
    count: number;
    insights: import('../types').AiInsight[];
  }> {
    const query = new URLSearchParams();
    if (department) query.append('department', department);

    const res = await fetch(`${API_BASE}/insights?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async generateAiInsights(department?: string): Promise<{
    success: boolean;
    count: number;
    insights: import('../types').AiInsight[];
  }> {
    const res = await fetch(`${API_BASE}/insights/generate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ department }),
    });
    return res.json();
  },

  // Phase 3: System Health & Performance
  async getSystemHealth(): Promise<{ success: boolean; health: import('../types').SystemHealthStatus }> {
    const res = await fetch(`${API_BASE}/system/health`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getRecognitionStats(): Promise<{
    success: boolean;
    stats: {
      total_attempts: number;
      recognized_count: number;
      unknown_count: number;
      spoof_count: number;
      success_rate: number;
      unknown_rate: number;
      spoof_rate: number;
      average_confidence: number;
    };
  }> {
    const res = await fetch(`${API_BASE}/system/recognition-stats`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Phase 4: Production Accuracy, Validation & Hardening APIs
  async runBenchmark(candidateThreshold?: number): Promise<{
    success: boolean;
    benchmark: import('../types').FaceRecognitionBenchmarkResult;
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/validation/benchmark`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ candidateThreshold }),
    });
    return res.json();
  },

  async getBenchmarkHistory(): Promise<{
    success: boolean;
    history: import('../types').FaceRecognitionBenchmarkResult[];
  }> {
    const res = await fetch(`${API_BASE}/validation/benchmark/history`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async calibrateThreshold(threshold: number, reason?: string): Promise<{
    success: boolean;
    threshold: number;
    settings: SystemSettings;
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/validation/calibrate-threshold`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ threshold, reason }),
    });
    return res.json();
  },

  async getLivenessStats(): Promise<{
    success: boolean;
    stats: import('../types').LivenessBenchmarkStats;
  }> {
    const res = await fetch(`${API_BASE}/validation/liveness-stats`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async runSystemTests(): Promise<{
    success: boolean;
    tests: import('../types').AutomatedSystemTest[];
    summary: { total: number; passed: number; failed: number; all_passed: boolean };
  }> {
    const res = await fetch(`${API_BASE}/validation/run-system-tests`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async createBackup(): Promise<{
    success: boolean;
    backup: import('../types').BackupSnapshotInfo;
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/validation/backup`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getBackups(): Promise<{
    success: boolean;
    backups: import('../types').BackupSnapshotInfo[];
  }> {
    const res = await fetch(`${API_BASE}/validation/backups`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async restoreBackup(filename: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/validation/restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ filename }),
    });
    return res.json();
  },

  async changePassword(current_password: string, new_password: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ current_password, new_password }),
    });
    return res.json();
  },

  // Mobile Classroom Vision API (Phase 9 WebRTC Pairing)
  async createMobilePairing(sessionId?: string, clientOrigin?: string): Promise<{
    success: boolean;
    pairingId: string;
    token?: string;
    opaqueToken: string;
    mobileUrl: string;
    qrDataUrl: string;
    expiresAt: string;
    session?: import('../types').MobileCameraSession;
    isLocalhost?: boolean;
    lanIp?: string;
    iceServers?: RTCIceServer[];
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/mobile/pairing/create`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        client_origin: clientOrigin || (typeof window !== 'undefined' ? window.location.origin : undefined),
      }),
    });
    return res.json();
  },

  async validateMobilePairing(token: string, deviceInfo?: any): Promise<{
    success: boolean;
    session?: import('../types').MobileCameraSession;
    session_details?: any;
    is_attendance_active?: boolean;
    iceServers?: RTCIceServer[];
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/mobile/pairing/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, device_info: deviceInfo }),
    });
    return res.json();
  },

  async pairMobileCamera(sessionId: string, clientOrigin?: string): Promise<{
    success: boolean;
    session?: import('../types').MobileCameraSession;
    pairing_code: string;
    pairing_token: string;
    pairing_url: string;
    base_origin?: string;
    is_localhost?: boolean;
    lan_ip?: string;
    qr_data_url: string;
    expires_at: string;
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/mobile/pair`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        client_origin: clientOrigin || (typeof window !== 'undefined' ? window.location.origin : undefined),
      }),
    });
    return res.json();
  },

  async benchmarkVectorScale(count: number = 10000): Promise<{
    success: boolean;
    benchmark?: {
      totalStudents: number;
      totalVectors: number;
      avgQueryLatencyMs: number;
      p95LatencyMs: number;
      p99LatencyMs: number;
      queriesPerSecond: number;
      memoryMb: number;
      vectorDimension: number;
    };
    index_stats?: {
      totalIndexedVectors: number;
      totalStudentsIndexed: number;
      departmentPartitions: string[];
      lastRebuildTimestamp: number;
    };
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/mobile/benchmark-vector-scale?count=${count}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async connectMobileCamera(
    codeOrToken: string,
    deviceInfo?: { userAgent?: string; platform?: string; cameraFacing?: string; orientation?: 'landscape' | 'portrait' }
  ): Promise<{
    success: boolean;
    session?: import('../types').MobileCameraSession;
    session_details?: any;
    is_attendance_active?: boolean;
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/mobile/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeOrToken, token: codeOrToken, device_info: deviceInfo }),
    });
    return res.json();
  },

  async getMobileCameraStatus(sessionId: string): Promise<{
    success: boolean;
    active: boolean;
    session: import('../types').MobileCameraSession | null;
    latest_frame?: any;
  }> {
    const res = await fetch(`${API_BASE}/mobile/session/${sessionId}`);
    return res.json();
  },

  async getActiveMobileCameras(): Promise<{
    success: boolean;
    count: number;
    sessions: import('../types').MobileCameraSession[];
  }> {
    const res = await fetch(`${API_BASE}/mobile/list`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async sendMobileFrame(data: {
    session_id: string;
    token?: string;
    preview_image?: string;
    fps?: number;
    latency_ms?: number;
    orientation?: 'landscape' | 'portrait';
    faces: Array<{
      descriptor: number[];
      box: { x: number; y: number; width: number; height: number };
      detectionScore?: number;
      crop_data_url?: string;
    }>;
  }): Promise<{
    success: boolean;
    faces_count: number;
    new_marks_count: number;
    total_present_count: number;
    results: import('../types').RecognitionBox[];
    latency_ms: number;
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/mobile/frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async sendMobileHeartbeat(data: {
    session_id: string;
    fps?: number;
    latency_ms?: number;
    orientation?: 'landscape' | 'portrait';
  }): Promise<{ success: boolean; timestamp: number }> {
    const res = await fetch(`${API_BASE}/mobile/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async disconnectMobileCamera(sessionId: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${API_BASE}/mobile/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    return res.json();
  },

  // Phase 10: Reachability Diagnostics
  async testReachability(url: string): Promise<import('../types').ReachabilityTestResult> {
    const res = await fetch(`${API_BASE}/mobile/reachability-test`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ url }),
    });
    return res.json();
  },

  // Phase 10: Classroom & Network Camera Registry
  async getCameras(params?: {
    department?: string;
    classroom?: string;
    type?: string;
  }): Promise<{ success: boolean; count: number; cameras: import('../types').RegisteredCamera[] }> {
    const query = new URLSearchParams();
    if (params?.department) query.append('department', params.department);
    if (params?.classroom) query.append('classroom', params.classroom);
    if (params?.type) query.append('type', params.type);

    const res = await fetch(`${API_BASE}/cameras?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getCameraById(id: string): Promise<{ success: boolean; camera?: import('../types').RegisteredCamera; message?: string }> {
    const res = await fetch(`${API_BASE}/cameras/${id}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async registerCamera(data: Partial<import('../types').RegisteredCamera>): Promise<{
    success: boolean;
    camera?: import('../types').RegisteredCamera;
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/cameras`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateCamera(id: string, data: Partial<import('../types').RegisteredCamera>): Promise<{
    success: boolean;
    camera?: import('../types').RegisteredCamera;
    message?: string;
  }> {
    const res = await fetch(`${API_BASE}/cameras/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteCamera(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`${API_BASE}/cameras/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async discoverOnvifCameras(): Promise<{
    success: boolean;
    message: string;
    devices: Array<{
      ip_address: string;
      manufacturer: string;
      model: string;
      onvif_port: number;
      rtsp_port: number;
      profiles: string[];
      status: string;
      hardware_mac: string;
    }>;
  }> {
    const res = await fetch(`${API_BASE}/cameras/discover-onvif`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async testCameraConnection(id: string): Promise<{
    success: boolean;
    camera_id: string;
    name: string;
    status: string;
    latency_ms: number;
    fps: number;
    rtsp_reachable: boolean;
    gateway_bridge: string;
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/cameras/${id}/test`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Campus Devices & IoT Ecosystem
  async getCampusDevices(params?: {
    category?: string;
    classroom?: string;
    status?: string;
    department?: string;
  }): Promise<{ success: boolean; count: number; devices: CampusDevice[] }> {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.classroom) query.append('classroom', params.classroom);
    if (params?.status) query.append('status', params.status);
    if (params?.department) query.append('department', params.department);

    const res = await fetch(`${API_BASE}/devices?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getDeviceStats(): Promise<{
    success: boolean;
    stats: {
      total: number;
      online: number;
      offline: number;
      connecting: number;
      errors: number;
      categories: Record<string, number>;
    };
  }> {
    const res = await fetch(`${API_BASE}/devices/stats`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getCampusDevice(id: string): Promise<{ success: boolean; device: CampusDevice }> {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async registerCampusDevice(data: Partial<CampusDevice>): Promise<{
    success: boolean;
    message: string;
    device: CampusDevice;
    credentials?: {
      device_id: string;
      device_token: string;
      ingestion_url: string;
      header_auth: string;
    };
  }> {
    const res = await fetch(`${API_BASE}/devices/register`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateCampusDevice(id: string, data: Partial<CampusDevice>): Promise<{
    success: boolean;
    message: string;
    device: CampusDevice;
  }> {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteCampusDevice(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async submitDeviceTelemetry(
    id: string,
    telemetry: Partial<DeviceTelemetry>,
    deviceToken?: string
  ): Promise<{ success: boolean; message: string; timestamp: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((getAuthHeaders() as any) || {}),
    };
    if (deviceToken) {
      headers['X-Device-Token'] = deviceToken;
    }

    const res = await fetch(`${API_BASE}/devices/${id}/telemetry`, {
      method: 'POST',
      headers,
      body: JSON.stringify(telemetry),
    });
    return res.json();
  },

  async getSmartClassroomCorrelations(): Promise<{
    success: boolean;
    count: number;
    correlations: SmartClassroomCorrelation[];
  }> {
    const res = await fetch(`${API_BASE}/devices/smart-classroom/correlations`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async getRemoteSensingWeather(lat = 17.4399, lon = 78.6811): Promise<RemoteSensingData> {
    const res = await fetch(`${API_BASE}/devices/remote-sensing/weather?lat=${lat}&lon=${lon}`);
    return res.json();
  },

  async getDeviceEvents(): Promise<{ success: boolean; count: number; events: import('../types').DeviceEventLog[] }> {
    const res = await fetch(`${API_BASE}/devices/events`, {
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  async submitEsp32Telemetry(payload: {
    deviceId: string;
    token?: string;
    classroom?: string;
    timestamp?: string;
    sensors: Record<string, any>;
  }): Promise<{ success: boolean; message: string; deviceId?: string; classroom?: string; timestamp?: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((getAuthHeaders() as any) || {}),
    };
    if (payload.token) {
      headers['X-Device-Token'] = payload.token;
    }

    const res = await fetch(`${API_BASE}/devices/telemetry`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};
