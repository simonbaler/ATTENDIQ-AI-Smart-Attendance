import express from 'express';
import { db } from '../db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// GET /api/anomalies (List detected anomalies with filters)
router.get('/anomalies', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const { department_id, severity, resolved } = req.query as Record<string, string>;

    const effectiveDept = user.role === 'HOD' ? user.department : department_id;
    const resolvedBool = resolved !== undefined ? resolved === 'true' : undefined;

    const anomalies = db.getAnomalies({
      department_id: effectiveDept,
      severity,
      resolved: resolvedBool,
    });

    res.json({ success: true, count: anomalies.length, anomalies });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/anomalies/:id/resolve
router.post('/anomalies/:id/resolve', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const success = db.resolveAnomaly(id, `${user.name} (${user.role})`);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Anomaly not found.' });
    }

    res.json({ success: true, message: 'Anomaly marked as resolved.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/anomalies/detect/:sessionId
router.post('/anomalies/detect/:sessionId', authenticateToken, (req, res) => {
  try {
    const { sessionId } = req.params;
    const detected = db.detectAnomaliesForSession(sessionId);
    res.json({ success: true, count: detected.length, detected });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/security/events (List anti-spoofing and security logs)
router.get('/security/events', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const { department, severity, event_type } = req.query as Record<string, string>;

    const effectiveDept = user.role === 'HOD' ? user.department : department;
    const events = db.getSecurityEvents({
      department: effectiveDept,
      severity,
      event_type,
    });

    res.json({ success: true, count: events.length, events });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/security/events (Log security event)
router.post('/security/events', authenticateToken, (req, res) => {
  try {
    const { session_id, student_id, student_name, department, event_type, severity, details } = req.body;

    if (!event_type || !severity || !details) {
      return res.status(400).json({ success: false, message: 'Missing required security event fields.' });
    }

    const event = db.logSecurityEvent({
      session_id,
      student_id,
      student_name,
      department,
      event_type,
      severity,
      details,
      ip_address: req.ip,
    });

    res.json({ success: true, event });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/risk/profiles (Calculate and retrieve student attendance risk levels)
router.get('/risk/profiles', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const { department, section, risk_level } = req.query as Record<string, string>;

    const effectiveDept = user.role === 'HOD' ? user.department : department;
    const profiles = db.getRiskProfiles({
      department: effectiveDept,
      section,
      risk_level,
    });

    const highCount = profiles.filter((p) => p.risk_level === 'HIGH').length;
    const mediumCount = profiles.filter((p) => p.risk_level === 'MEDIUM').length;
    const lowCount = profiles.filter((p) => p.risk_level === 'LOW').length;

    res.json({
      success: true,
      count: profiles.length,
      summary: {
        total: profiles.length,
        high_risk: highCount,
        medium_risk: mediumCount,
        low_risk: lowCount,
      },
      profiles,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/risk/student/:id (Deep risk calculation for one student)
router.get('/risk/student/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const profile = db.calculateStudentRisk(id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/insights (Get AI Smart Insights for institution or department)
router.get('/insights', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const { department } = req.query as Record<string, string>;

    const scope: 'INSTITUTION' | 'DEPARTMENT' = user.role === 'HOD' || department ? 'DEPARTMENT' : 'INSTITUTION';
    const deptId = user.role === 'HOD' ? user.department : department;

    const insights = db.generateAiInsights(scope, deptId);
    res.json({ success: true, scope, department: deptId, count: insights.length, insights });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/insights/generate (Force recalculation)
router.post('/insights/generate', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const { department } = req.body;

    const scope: 'INSTITUTION' | 'DEPARTMENT' = user.role === 'HOD' || department ? 'DEPARTMENT' : 'INSTITUTION';
    const deptId = user.role === 'HOD' ? user.department : department;

    const insights = db.generateAiInsights(scope, deptId);
    res.json({ success: true, count: insights.length, insights });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/system/health (Real-time system health metrics)
router.get('/system/health', authenticateToken, (req, res) => {
  try {
    const health = db.getSystemHealth();
    res.json({ success: true, health });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/system/recognition-stats (Face recognition performance stats)
router.get('/system/recognition-stats', authenticateToken, (req, res) => {
  try {
    const stats = db.getRecognitionStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
