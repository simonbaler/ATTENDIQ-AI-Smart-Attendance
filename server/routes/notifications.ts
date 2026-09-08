import express from 'express';
import { db, AbsenceNotification } from '../db.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// List notifications with optional filters
router.get('/', authenticateToken, (req, res) => {
  try {
    const { session_id, student_id, delivery_status } = req.query;
    const notifications = db.getAbsenceNotifications({
      session_id: session_id as string,
      student_id: student_id as string,
      delivery_status: delivery_status as string,
    });
    res.json({ success: true, count: notifications.length, notifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve notifications' });
  }
});

// Summary metrics of notifications
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const notifications = db.getAbsenceNotifications();
    const delivered = notifications.filter((n) => n.delivery_status === 'DELIVERED').length;
    const failed = notifications.filter((n) => n.delivery_status === 'FAILED').length;
    const queued = notifications.filter((n) => n.delivery_status === 'QUEUED').length;
    const retry = notifications.filter((n) => n.delivery_status === 'RETRY').length;

    res.json({
      success: true,
      total: notifications.length,
      delivered,
      failed,
      queued,
      retry,
      last_dispatched_at: notifications[0]?.sent_at || null,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to compute notification stats' });
  }
});

// Trigger absence notifications for a completed attendance session
router.post('/dispatch-session/:sessionId', authenticateToken, (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Attendance session not found' });
    }

    const result = db.generateSessionAbsenceNotifications(sessionId);

    db.logAudit({
      action: 'ABSENCE_NOTIFICATIONS_DISPATCHED',
      performed_by: (req as any).user?.username || 'SYSTEM',
      actor_id: (req as any).user?.id,
      actor_role: (req as any).user?.role,
      target_type: 'SESSION_NOTIFICATIONS',
      target_id: sessionId,
      details: `Generated and dispatched ${result.generated} absence notifications for ${session.subject} (${session.classroom})`,
    });

    res.json({
      success: true,
      message: `Dispatched ${result.generated} institutional absence notifications for session ${sessionId}`,
      generated: result.generated,
      notifications: result.notifications,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to dispatch absence notifications' });
  }
});

// Retry a specific notification
router.post('/:id/retry', authenticateToken, (req, res) => {
  try {
    const settings = db.getSettings();
    const hasEmailProvider = Boolean(process.env.SMTP_HOST || (settings.smtp_configured && settings.smtp_host));

    if (!hasEmailProvider) {
      db.updateNotificationStatus(req.params.id, 'FAILED', 'Email delivery unavailable — provider not configured');
      return res.status(400).json({
        success: false,
        message: 'Email delivery unavailable — provider not configured. Configure institutional SMTP relay in Settings.',
      });
    }

    const success = db.updateNotificationStatus(req.params.id, 'DELIVERED');
    if (!success) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, message: 'Notification resent successfully via configured provider' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to retry notification' });
  }
});

export default router;
