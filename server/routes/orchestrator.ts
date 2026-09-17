import express from 'express';
import { orchestrator } from '../orchestrator.js';
import { authenticateToken } from './auth.js';
import { eventBus } from '../eventBus.js';
import { db } from '../db.js';

const router = express.Router();

// GET /api/intelligence/orchestrator/state
router.get('/state', authenticateToken, (req, res) => {
  try {
    const classrooms = orchestrator.getClassroomsState();
    const cameras = orchestrator.getCameraRegistry();
    const devices = orchestrator.getDeviceHealthRegistry();
    const health = orchestrator.getSystemHealth();
    const timeline = orchestrator.getGlobalTimeline({ limit: 30 });

    res.json({
      success: true,
      classrooms,
      cameras,
      devices,
      health,
      timeline,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch orchestrator state' });
  }
});

// GET /api/intelligence/orchestrator/classrooms
router.get('/classrooms', authenticateToken, (req, res) => {
  try {
    const classrooms = orchestrator.getClassroomsState();
    res.json({ success: true, count: classrooms.length, classrooms });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to retrieve classroom states' });
  }
});

// GET /api/intelligence/orchestrator/classrooms/:id
router.get('/classrooms/:id', authenticateToken, (req, res) => {
  try {
    const classroom = orchestrator.getClassroomStateById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }
    res.json({ success: true, classroom });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to retrieve classroom state' });
  }
});

// GET /api/intelligence/orchestrator/cameras
router.get('/cameras', authenticateToken, (req, res) => {
  try {
    const cameras = orchestrator.getCameraRegistry();
    res.json({ success: true, count: cameras.length, cameras });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to retrieve camera registry' });
  }
});

// POST /api/intelligence/orchestrator/cameras/report (Client reports measured FPS, latency, stream state)
router.post('/cameras/report', authenticateToken, (req, res) => {
  try {
    const { camera_id, measured_fps, connection_latency_ms, stream_state, resolution, source, classroom, name } = req.body;
    if (!camera_id) {
      return res.status(400).json({ success: false, message: 'camera_id is required' });
    }

    orchestrator.reportCameraMetrics(camera_id, {
      name,
      source,
      classroom,
      resolution,
      measured_fps: measured_fps !== undefined ? Number(measured_fps) : undefined,
      connection_latency_ms: connection_latency_ms !== undefined ? Number(connection_latency_ms) : undefined,
      stream_state,
    });

    res.json({ success: true, message: 'Camera telemetry recorded' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to report camera telemetry' });
  }
});

// GET /api/intelligence/orchestrator/devices
router.get('/devices', authenticateToken, (req, res) => {
  try {
    const devices = orchestrator.getDeviceHealthRegistry();
    res.json({ success: true, count: devices.length, devices });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to retrieve device health registry' });
  }
});

// GET /api/intelligence/orchestrator/timeline
router.get('/timeline', authenticateToken, (req, res) => {
  try {
    const { classroom, event_type, severity, limit } = req.query;
    const timeline = orchestrator.getGlobalTimeline({
      classroom: classroom as string,
      event_type: event_type as string,
      severity: severity as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });
    res.json({ success: true, count: timeline.length, timeline });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to retrieve global timeline' });
  }
});

// GET /api/intelligence/orchestrator/risk (Transparent, explainable risk engine)
router.get('/risk', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const departmentFilter = user.role === 'HOD' ? user.department : (req.query.department as string);
    const assessments = orchestrator.evaluateAttendanceRisk(departmentFilter);
    res.json({ success: true, count: assessments.length, assessments });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to evaluate attendance risk' });
  }
});

// POST /api/intelligence/orchestrator/query (Command Center AI Assistant)
router.post('/query', authenticateToken, (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, message: 'Query text is required' });
    }

    const answer = orchestrator.processOperationalQuery(query);
    res.json({ success: true, ...answer });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to process AI query' });
  }
});

// POST /api/intelligence/orchestrator/telemetry/movement
router.post('/telemetry/movement', authenticateToken, (req, res) => {
  try {
    const { session_id, student_id, track_id, direction, velocity_px_sec, classroom, movement_vector, box } = req.body;

    eventBus.publish('STUDENT_ENTERED', {
      source: 'MOVEMENT_TRACKER',
      classroom: classroom || 'LH-301',
      sessionId: session_id,
      payload: {
        student_id,
        track_id,
        direction,
        velocity_px_sec,
        movement_vector,
        box,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ success: true, message: 'Movement vector ingested' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to log movement telemetry' });
  }
});

// POST /api/intelligence/orchestrator/telemetry/object
router.post('/telemetry/object', authenticateToken, (req, res) => {
  try {
    const { object_id, class: objClass, confidence, bounding_box, camera_id, classroom_id, tracking_id } = req.body;

    eventBus.publish('OBJECT_DETECTED', {
      source: 'VISION_PIPELINE_B',
      classroom: classroom_id || 'LH-301',
      payload: {
        object_id: object_id || `obj_${Date.now()}`,
        class: objClass,
        confidence: confidence || 0.75,
        bounding_box,
        camera_id: camera_id || 'CAMERA_PRIMARY',
        classroom_id: classroom_id || 'LH-301',
        tracking_id,
        evidence_level: 'AI-ESTIMATED',
        method: 'HEURISTIC_EDGE_GRADIENT',
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ success: true, message: 'Object detection logged' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to log object detection' });
  }
});

// Device Control Endpoints (Section 12)
router.post('/devices/:id/reboot', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    db.logAudit({
      action: 'DEVICE_REBOOT_TRIGGERED',
      performed_by: user.username,
      target_type: 'CAMPUS_DEVICE',
      target_id: id,
      details: `Remote reboot command issued for device ${id}`,
    });

    eventBus.publish('DEVICE_COMMAND', {
      source: 'COMMAND_CENTER',
      payload: {
        device_id: id,
        command: 'REBOOT',
        issued_by: user.username,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ success: true, message: `Reboot command sent to hardware terminal ${id}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to trigger reboot' });
  }
});

router.post('/devices/:id/relay', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { channel, state } = req.body; // e.g. channel: 1, state: 'ON' | 'OFF'
    const user = (req as any).user;

    eventBus.publish('DEVICE_COMMAND', {
      source: 'COMMAND_CENTER',
      payload: {
        device_id: id,
        command: 'RELAY_TOGGLE',
        channel: channel || 1,
        state: state || 'ON',
        issued_by: user.username,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ success: true, message: `Relay channel ${channel || 1} toggled to ${state || 'ON'}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to toggle relay' });
  }
});

router.post('/devices/:id/display', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { line1, line2 } = req.body;
    const user = (req as any).user;

    eventBus.publish('DEVICE_COMMAND', {
      source: 'COMMAND_CENTER',
      payload: {
        device_id: id,
        command: 'PUSH_DISPLAY_MESSAGE',
        line1: line1 || 'ATTENDIQ AI ACTIVE',
        line2: line2 || new Date().toLocaleTimeString(),
        issued_by: user.username,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ success: true, message: `Display message pushed to terminal ${id}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to push display message' });
  }
});

export default router;
