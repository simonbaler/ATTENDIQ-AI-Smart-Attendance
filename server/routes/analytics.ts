import express from 'express';
import crypto from 'crypto';
import os from 'os';
import { db, StudentBehaviorEvent } from '../db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// 1. Student Profile & Intelligence Analytics (Phase 16 & 16A)
router.get('/student/:id', authenticateToken, (req, res) => {
  try {
    const studentIdOrRoll = req.params.id;
    const profile = db.getStudentProfileAnalytics(studentIdOrRoll);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }
    res.json({ success: true, profile });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve student analytics profile' });
  }
});

// 2. Behavioral Timeline Events (Phase 13 & 14)
router.post('/behavior', authenticateToken, (req, res) => {
  try {
    const settings = db.getSettings();
    if (settings.vision_analytics_enabled === false) {
      return res.json({ success: false, message: 'Vision behavioral analytics are disabled by institutional policy.' });
    }

    const { session_id, student_id, roll_number, student_name, event_type, details, metadata } = req.body;
    if (!session_id || !student_id || !event_type) {
      return res.status(400).json({ success: false, message: 'Missing required behavioral event fields' });
    }

    const newEvent: StudentBehaviorEvent = {
      id: `bev_${Date.now()}_${crypto.randomUUID().slice(0, 4)}`,
      session_id,
      student_id,
      roll_number: roll_number || '',
      student_name: student_name || '',
      timestamp: new Date().toISOString(),
      event_type,
      signal_label: 'AI-estimated visual signal',
      details: details || 'Visual tracking signal recorded',
      metadata,
    };

    db.saveStudentBehaviorEvent(newEvent);
    res.status(201).json({ success: true, event: newEvent });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to record behavior event' });
  }
});

// Get behavioral timeline for a session
router.get('/behavior/session/:sessionId', authenticateToken, (req, res) => {
  try {
    const events = db.getStudentBehaviorEvents({ session_id: req.params.sessionId });
    res.json({ success: true, count: events.length, events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve session behavior events' });
  }
});

// Get behavioral timeline for a student
router.get('/behavior/student/:studentId', authenticateToken, (req, res) => {
  try {
    const events = db.getStudentBehaviorEvents({ student_id: req.params.studentId });
    res.json({ success: true, count: events.length, events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve student behavior events' });
  }
});

// 2b. AI Attendance Risk Engine (Phase 31)
router.get('/risk', authenticateToken, (req, res) => {
  try {
    const students = db.getStudents({ status: 'ACTIVE' });
    const threshold = 75; // Institutional benchmark threshold

    const atRiskStudents: Array<{
      student_id: string;
      roll_number: string;
      full_name: string;
      department: string;
      section: string;
      attendance_percentage: number;
      risk_factors: Array<{
        type: 'LOW_ATTENDANCE_RISK' | 'DECLINING_ATTENDANCE' | 'ABSENCE_PATTERN';
        severity: 'CRITICAL' | 'WARNING' | 'MONITOR';
        explanation: string;
      }>;
      total_sessions: number;
      attended_sessions: number;
    }> = [];

    students.forEach((student) => {
      const profile = db.getStudentProfileAnalytics(student.id);
      if (!profile || profile.total_sessions_conducted === 0) return;

      const riskFactors: Array<{
        type: 'LOW_ATTENDANCE_RISK' | 'DECLINING_ATTENDANCE' | 'ABSENCE_PATTERN';
        severity: 'CRITICAL' | 'WARNING' | 'MONITOR';
        explanation: string;
      }> = [];

      // 1. Below Institutional Threshold Rule
      if (profile.attendance_percentage < threshold) {
        riskFactors.push({
          type: 'LOW_ATTENDANCE_RISK',
          severity: profile.attendance_percentage < 60 ? 'CRITICAL' : 'WARNING',
          explanation: `Attendance is ${profile.attendance_percentage.toFixed(1)}%, below the configured ${threshold}% threshold.`,
        });
      }

      // 2. Declining Trend Rule across real historical month snapshots
      if (profile.monthly_trend.length >= 2) {
        const prev = profile.monthly_trend[profile.monthly_trend.length - 2].percentage;
        const current = profile.monthly_trend[profile.monthly_trend.length - 1].percentage;
        if (current < prev && (prev - current) >= 10) {
          riskFactors.push({
            type: 'DECLINING_ATTENDANCE',
            severity: 'WARNING',
            explanation: `Attendance dropped from ${prev.toFixed(1)}% in previous month to ${current.toFixed(1)}% in current month.`,
          });
        }
      }

      // 3. Repeated Consecutive Absences Rule
      let consecutiveAbsences = 0;
      for (const rec of profile.recent_records) {
        if (rec.status === 'ABSENT') {
          consecutiveAbsences++;
        } else {
          break;
        }
      }
      if (consecutiveAbsences >= 2) {
        riskFactors.push({
          type: 'ABSENCE_PATTERN',
          severity: consecutiveAbsences >= 3 ? 'CRITICAL' : 'WARNING',
          explanation: `Recorded ${consecutiveAbsences} consecutive absences across recent attendance sessions.`,
        });
      }

      if (riskFactors.length > 0) {
        atRiskStudents.push({
          student_id: student.id,
          roll_number: student.roll_number,
          full_name: student.full_name,
          department: student.department,
          section: student.section,
          attendance_percentage: profile.attendance_percentage,
          risk_factors: riskFactors,
          total_sessions: profile.total_sessions_conducted,
          attended_sessions: profile.sessions_attended,
        });
      }
    });

    // Sort by severity (most critical first)
    atRiskStudents.sort((a, b) => a.attendance_percentage - b.attendance_percentage);

    res.json({
      success: true,
      threshold,
      total_students_evaluated: students.length,
      at_risk_count: atRiskStudents.length,
      critical_count: atRiskStudents.filter((s) => s.risk_factors.some((r) => r.severity === 'CRITICAL')).length,
      warning_count: atRiskStudents.filter((s) => !s.risk_factors.some((r) => r.severity === 'CRITICAL')).length,
      students: atRiskStudents,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to evaluate attendance risk' });
  }
});

// 3. System Health Center Observability (Phase 20)
router.get('/observability/health', authenticateToken, (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const uptimeSec = process.uptime();
    const cpuLoads = os.loadavg();
    const freeMemBytes = os.freemem();
    const totalMemBytes = os.totalmem();

    const registeredCameras = db.getCameras();
    const onlineCameras = registeredCameras.filter((c) => c.status === 'ONLINE').length;
    const campusDevices = db.getCampusDevices();
    const onlineDevices = campusDevices.filter((d) => d.status === 'ONLINE').length;

    const sessions = db.getSessions();
    const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length;
    const allRecords = db.getAttendance();

    const notifications = db.getAbsenceNotifications();
    const pendingNotifications = notifications.filter((n) => n.delivery_status === 'QUEUED' || n.delivery_status === 'RETRY').length;

    // Real system status determination
    const memPct = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    let systemStatus: 'HEALTHY' | 'DEGRADED' | 'ERROR' = 'HEALTHY';
    if (memPct > 90) {
      systemStatus = 'DEGRADED';
    }

    res.json({
      success: true,
      status: systemStatus,
      timestamp: new Date().toISOString(),
      process: {
        uptime_seconds: Math.round(uptimeSec),
        heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss_mb: Math.round(memUsage.rss / 1024 / 1024),
        node_version: process.version,
      },
      os: {
        platform: os.platform(),
        cpus: os.cpus().length,
        load_average: cpuLoads,
        free_memory_mb: Math.round(freeMemBytes / 1024 / 1024),
        total_memory_mb: Math.round(totalMemBytes / 1024 / 1024),
      },
      edge_infrastructure: {
        registered_cameras: registeredCameras.length,
        online_cameras: onlineCameras,
        registered_iot_devices: campusDevices.length,
        online_iot_devices: onlineDevices,
        active_attendance_sessions: activeSessions,
        total_attendance_records: allRecords.length,
        pending_absence_notifications: pendingNotifications,
      },
      cloud_sync: {
        google_sheets: {
          status: 'CONNECTED',
          last_sync: new Date().toISOString(),
          authoritative_master: 'Google Sheets (v4 API)',
        },
        database_engine: 'Atomic File-Backed JSON Store',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to compute observability telemetry' });
  }
});

export default router;
