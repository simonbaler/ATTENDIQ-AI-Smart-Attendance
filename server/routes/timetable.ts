import express from 'express';
import crypto from 'crypto';
import { db, TimetableSlot, AttendanceSession, DepartmentRosterInfo, DepartmentSessionStat } from '../db.js';
import { authenticateToken } from './auth.js';
import { eventBus } from '../eventBus.js';

const router = express.Router();

// Get all timetable slots with optional filters
router.get('/', authenticateToken, (req, res) => {
  try {
    const { department, classroom, day, section } = req.query;
    const slots = db.getTimetableSlots({
      department: department as string,
      classroom: classroom as string,
      day: day as string,
      section: section as string,
    });
    res.json({ success: true, slots });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve timetable slots' });
  }
});

// Detect current active timetable slot according to institutional clock
router.get('/active', authenticateToken, (req, res) => {
  try {
    const { time, day } = req.query;
    const result = db.getCurrentActiveTimetableSlot(time as string, day as string);
    
    // Check if an active attendance session already exists for this slot's classroom
    let activeSession: AttendanceSession | undefined;
    if (result.slot) {
      const sessions = db.getSessions({ status: 'ACTIVE' });
      activeSession = sessions.find((s) => s.classroom.toLowerCase() === result.slot!.classroom.toLowerCase());
    }

    res.json({
      success: true,
      has_active_slot: result.has_active_slot,
      slot: result.slot,
      current_time: result.current_time,
      current_day: result.current_day,
      active_session: activeSession,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to detect active slot' });
  }
});

// Get slot by ID
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const slot = db.getTimetableSlotById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Timetable slot not found' });
    }
    res.json({ success: true, slot });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve timetable slot' });
  }
});

// Create timetable slot (Admin / HOD)
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      department,
      departments,
      section,
      classroom,
      subject,
      faculty,
      start_time,
      end_time,
      days,
      period_number,
      academic_year,
      attendance_policy,
      camera_ids,
      is_multi_department,
    } = req.body;

    if (!department || !classroom || !subject || !faculty || !start_time || !end_time || !days || !period_number) {
      return res.status(400).json({ success: false, message: 'Missing required timetable slot fields' });
    }

    const newSlot: TimetableSlot = {
      id: `slot_${crypto.randomUUID().slice(0, 8)}`,
      department,
      departments: is_multi_department ? departments || [department] : undefined,
      section: section || 'A',
      classroom,
      subject,
      faculty,
      start_time,
      end_time,
      days: Array.isArray(days) ? days : [days],
      period_number: Number(period_number),
      academic_year: academic_year || '2025-2026 (Even Semester)',
      attendance_policy: attendance_policy || 'STRICT_TEMPORAL_3F',
      camera_ids: camera_ids || [],
      is_active: true,
      is_multi_department: !!is_multi_department,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.saveTimetableSlot(newSlot);

    db.logAudit({
      action: 'TIMETABLE_SLOT_CREATED',
      performed_by: (req as any).user?.username || 'SYSTEM',
      actor_id: (req as any).user?.id,
      actor_role: (req as any).user?.role,
      target_type: 'TIMETABLE_SLOT',
      target_id: newSlot.id,
      details: `Configured period ${newSlot.period_number} for ${newSlot.subject} in ${newSlot.classroom}`,
    });

    res.status(201).json({ success: true, slot: newSlot });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create timetable slot' });
  }
});

// Update timetable slot
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.getTimetableSlotById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Timetable slot not found' });
    }

    const updated: TimetableSlot = {
      ...existing,
      ...req.body,
      id: existing.id,
      updated_at: new Date().toISOString(),
    };

    db.saveTimetableSlot(updated);

    res.json({ success: true, slot: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update timetable slot' });
  }
});

// Delete timetable slot
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const deleted = db.deleteTimetableSlot(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Timetable slot not found' });
    }
    res.json({ success: true, message: 'Timetable slot deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete timetable slot' });
  }
});

// Trigger an automated attendance session from a timetable slot
router.post('/trigger-session/:id', authenticateToken, (req, res) => {
  try {
    const slot = db.getTimetableSlotById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Timetable slot not found' });
    }

    // Check if an active session already exists in this classroom
    const activeSessions = db.getSessions({ status: 'ACTIVE' });
    const existingActive = activeSessions.find((s) => s.classroom.toLowerCase() === slot.classroom.toLowerCase());
    if (existingActive) {
      return res.status(400).json({
        success: false,
        message: `An active attendance session is already running in ${slot.classroom} (${existingActive.subject})`,
        session: existingActive,
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const isMultiDept = slot.is_multi_department && slot.departments && slot.departments.length > 0;

    // Snapshot authoritative student rosters across all departments participating in this classroom
    const deptRosters: Record<string, DepartmentRosterInfo> = {};
    const deptStats: Record<string, DepartmentSessionStat> = {};
    let totalRosterCount = 0;

    const targetDepts = isMultiDept ? slot.departments! : [slot.department];
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
      id: `sess_${Date.now()}_${crypto.randomUUID().slice(0, 4)}`,
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
      created_by: (req as any).user?.name || (req as any).user?.username || 'Timetable Automation Engine',
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

    // Broadcast automated session start across Campus Event Bus
    eventBus.publish('TIMETABLE_SESSION_STARTED', {
      source: 'TIMETABLE_ENGINE',
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
      action: 'TIMETABLE_SESSION_AUTOMATION',
      performed_by: (req as any).user?.username || 'SYSTEM',
      actor_id: (req as any).user?.id,
      actor_role: (req as any).user?.role,
      target_type: 'ATTENDANCE_SESSION',
      target_id: newSession.id,
      details: `Triggered period ${slot.period_number} session for ${slot.subject} (${isMultiDept ? 'Multi-Department' : slot.department}) with roster of ${totalRosterCount} students`,
    });

    res.status(201).json({
      success: true,
      message: `Timetable attendance session successfully activated for ${slot.classroom}`,
      session: newSession,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to trigger timetable session' });
  }
});

export default router;
