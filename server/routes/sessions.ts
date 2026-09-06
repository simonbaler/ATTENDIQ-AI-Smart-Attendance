import express from 'express';
import { db, AttendanceSession, DepartmentRosterInfo, DepartmentSessionStat } from '../db.js';
import { authenticateToken } from './auth.js';
import { clearSessionTracking } from '../recognition.js';

const router = express.Router();

// Helper to compute live session stats including department-wise breakdown
function calculateSessionStats(session: AttendanceSession) {
  const attendanceRecords = db.getAttendance({ session_id: session.id });
  const presentRecords = attendanceRecords.filter((r) => r.status === 'PRESENT');
  const presentRolls = new Set(presentRecords.map((r) => r.roll_number));

  if (session.is_multi_department && session.roster_snapshot) {
    const deptStats: Record<string, DepartmentSessionStat> = {};
    const absentStudents: Array<{
      id: string;
      student_id: string;
      full_name: string;
      roll_number: string;
      department: string;
      section: string;
      status: 'ABSENT';
    }> = [];

    let totalRoster = 0;
    let totalPresent = 0;

    for (const [deptName, rosterInfo] of Object.entries(session.roster_snapshot.departments)) {
      const deptPresentRecords = presentRecords.filter((r) => {
        const studentDept = r.department?.toLowerCase() || '';
        const targetDept = deptName.toLowerCase();
        return studentDept === targetDept || studentDept.includes(targetDept) || targetDept.includes(studentDept);
      });

      const deptPresentCount = deptPresentRecords.length;
      const deptTotal = rosterInfo.total || rosterInfo.students?.length || 0;
      const deptAbsentCount = Math.max(0, deptTotal - deptPresentCount);
      const deptPct = deptTotal > 0 ? Math.round((deptPresentCount / deptTotal) * 100) : 0;

      deptStats[deptName] = {
        department: deptName,
        total: deptTotal,
        present: deptPresentCount,
        absent: deptAbsentCount,
        attendance_percentage: deptPct,
      };

      totalRoster += deptTotal;
      totalPresent += deptPresentCount;

      // Find absent students for this department
      if (rosterInfo.students) {
        for (const stu of rosterInfo.students) {
          if (!presentRolls.has(stu.roll_number)) {
            absentStudents.push({
              id: stu.id,
              student_id: stu.student_id,
              full_name: stu.full_name,
              roll_number: stu.roll_number,
              department: stu.department,
              section: stu.section,
              status: 'ABSENT',
            });
          }
        }
      }
    }

    const overallTotal = totalRoster || session.roster_snapshot.total_students || 0;
    const overallPresent = totalPresent;
    const overallAbsent = Math.max(0, overallTotal - overallPresent);
    const overallPct = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;

    return {
      total_students: overallTotal,
      present_count: overallPresent,
      absent_count: overallAbsent,
      attendance_percentage: overallPct,
      department_stats: deptStats,
      absent_students: absentStudents,
    };
  }

  // Single department session
  const sectionStudents = db.getStudents({
    department: session.department,
    section: session.section !== 'ALL' ? session.section : undefined,
    status: 'ACTIVE',
  });

  const presentCount = presentRecords.length;
  const totalStudents = sectionStudents.length;
  const absentCount = Math.max(0, totalStudents - presentCount);
  const percentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  const absentStudents = sectionStudents
    .filter((s) => !presentRolls.has(s.roll_number))
    .map((s) => ({
      id: s.id,
      student_id: s.student_id,
      full_name: s.full_name,
      roll_number: s.roll_number,
      department: s.department,
      section: s.section,
      status: 'ABSENT' as const,
    }));

  return {
    total_students: totalStudents,
    present_count: presentCount,
    absent_count: absentCount,
    attendance_percentage: percentage,
    department_stats: {
      [session.department]: {
        department: session.department,
        total: totalStudents,
        present: presentCount,
        absent: absentCount,
        attendance_percentage: percentage,
      },
    },
    absent_students: absentStudents,
  };
}

// GET /api/sessions
router.get('/', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const { department, status } = req.query as Record<string, string>;

  const effectiveDept = user.role === 'HOD' ? user.department : department;
  const sessions = db.getSessions({
    department: effectiveDept,
    status,
  });

  res.json({ success: true, count: sessions.length, sessions });
});

// GET /api/sessions/active
router.get('/active', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const { department, section } = req.query as Record<string, string>;
  const effectiveDept = user.role === 'HOD' ? user.department : department;

  const session = db.getActiveSession(effectiveDept, section);
  if (!session) {
    return res.json({ success: true, active: false, session: null });
  }

  const computedStats = calculateSessionStats(session);

  res.json({
    success: true,
    active: true,
    session,
    stats: {
      total_students: computedStats.total_students,
      present_count: computedStats.present_count,
      absent_count: computedStats.absent_count,
      attendance_percentage: computedStats.attendance_percentage,
    },
    department_stats: computedStats.department_stats,
    absent_students: computedStats.absent_students,
  });
});

// GET /api/sessions/:id
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const session = db.getSessionById(id);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  const computedStats = calculateSessionStats(session);

  res.json({
    success: true,
    session,
    stats: {
      total_students: computedStats.total_students,
      present_count: computedStats.present_count,
      absent_count: computedStats.absent_count,
      attendance_percentage: computedStats.attendance_percentage,
    },
    department_stats: computedStats.department_stats,
    absent_students: computedStats.absent_students,
  });
});

// POST /api/sessions (Create / Start new session - Single or Multi-Department)
router.post('/', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const {
      is_multi_department,
      departments,
      department,
      section,
      subject,
      classroom,
      faculty,
      academic_year,
      date,
      start_time,
      end_time,
    } = req.body;

    if (!subject || !classroom) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: Subject and Classroom.',
      });
    }

    const todayStr = date || new Date().toISOString().split('T')[0];
    const nowTimeStr = start_time || new Date().toTimeString().slice(0, 5);

    // Multi-Department Session Handling
    if (is_multi_department || (Array.isArray(departments) && departments.length > 0)) {
      const selectedDepts = Array.isArray(departments) ? departments.filter((d: string) => d && d.trim().length > 0) : [department];

      if (selectedDepts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one department for the multi-department session.',
        });
      }

      if (user.role === 'HOD') {
        const canLaunch = selectedDepts.some((d: string) => d.toLowerCase() === user.department.toLowerCase());
        if (!canLaunch) {
          return res.status(403).json({
            success: false,
            message: `HOD of ${user.department} must include ${user.department} in multi-department sessions.`,
          });
        }
      }

      // Check if there is an active session running in the exact same classroom
      const existingActive = db.getSessions({ status: 'ACTIVE' }).find(
        (s) => s.classroom.toLowerCase() === classroom.trim().toLowerCase()
      );
      if (existingActive) {
        return res.status(400).json({
          success: false,
          message: `Classroom ${classroom} already has an active session (${existingActive.subject}). Stop it before launching a new one.`,
          activeSession: existingActive,
        });
      }

      // Build frozen roster snapshot from authoritative Google Sheets synchronized students
      const allActiveStudents = db.getStudents({ status: 'ACTIVE' });
      const deptRosterMap: Record<string, DepartmentRosterInfo> = {};
      let totalFrozenStudents = 0;

      for (const deptName of selectedDepts) {
        const matchingStudents = allActiveStudents.filter((s) => {
          const sDept = s.department.toLowerCase();
          const target = deptName.toLowerCase();
          return sDept === target || sDept.includes(target) || target.includes(sDept);
        });

        deptRosterMap[deptName] = {
          total: matchingStudents.length,
          student_ids: matchingStudents.map((s) => s.id),
          roll_numbers: matchingStudents.map((s) => s.roll_number),
          students: matchingStudents.map((s) => ({
            id: s.id,
            student_id: s.student_id,
            full_name: s.full_name,
            roll_number: s.roll_number,
            department: s.department,
            section: s.section,
          })),
        };

        totalFrozenStudents += matchingStudents.length;
      }

      const newMultiSession: AttendanceSession = {
        id: `ses_${Date.now()}_${crypto.randomUUID().split('-')[0]}`,
        department: selectedDepts.join(' + '),
        section: 'MULTI',
        subject: subject.trim(),
        classroom: classroom.trim(),
        faculty: faculty?.trim() || user.full_name || user.username,
        academic_year: academic_year || '2025-2026',
        date: todayStr,
        start_time: nowTimeStr,
        end_time: end_time || '',
        status: 'ACTIVE',
        created_by: user.username,
        created_at: new Date().toISOString(),
        is_multi_department: true,
        departments: selectedDepts,
        roster_snapshot: {
          total_students: totalFrozenStudents,
          departments: deptRosterMap,
        },
      };

      db.saveSession(newMultiSession);

      db.logAudit({
        action: 'START_MULTI_DEPT_SESSION',
        performed_by: user.username,
        target_type: 'SESSION',
        target_id: newMultiSession.id,
        details: `Launched multi-department session in ${classroom} for [${selectedDepts.join(', ')}] with ${totalFrozenStudents} roster students.`,
      });

      return res.status(201).json({
        success: true,
        message: `Multi-department session launched successfully with ${totalFrozenStudents} students across ${selectedDepts.length} departments.`,
        session: newMultiSession,
      });
    }

    // Single Department Session
    if (!department || !section) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: Department, Section, Subject, Classroom.',
      });
    }

    if (user.role === 'HOD' && department.toLowerCase() !== user.department.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: `HOD of ${user.department} can only create sessions for ${user.department}.`,
      });
    }

    const existingActive = db.getActiveSession(department, section);
    if (existingActive) {
      return res.status(400).json({
        success: false,
        message: `An active session for ${department} Section ${section} (${existingActive.subject}) is already running. Complete or stop it first.`,
        activeSession: existingActive,
      });
    }

    // Freeze single department roster snapshot
    const singleDeptStudents = db.getStudents({
      department,
      section: section.trim().toUpperCase(),
      status: 'ACTIVE',
    });

    const newSession: AttendanceSession = {
      id: `ses_${Date.now()}_${crypto.randomUUID().split('-')[0]}`,
      department: department.trim(),
      section: section.trim().toUpperCase(),
      subject: subject.trim(),
      classroom: classroom.trim(),
      faculty: faculty?.trim() || user.full_name || user.username,
      academic_year: academic_year || '2025-2026',
      date: todayStr,
      start_time: nowTimeStr,
      end_time: end_time || '',
      status: 'ACTIVE',
      created_by: user.username,
      created_at: new Date().toISOString(),
      is_multi_department: false,
      departments: [department.trim()],
      roster_snapshot: {
        total_students: singleDeptStudents.length,
        departments: {
          [department.trim()]: {
            total: singleDeptStudents.length,
            student_ids: singleDeptStudents.map((s) => s.id),
            roll_numbers: singleDeptStudents.map((s) => s.roll_number),
            students: singleDeptStudents.map((s) => ({
              id: s.id,
              student_id: s.student_id,
              full_name: s.full_name,
              roll_number: s.roll_number,
              department: s.department,
              section: s.section,
            })),
          },
        },
      },
    };

    db.saveSession(newSession);

    db.logAudit({
      action: 'START_SESSION',
      performed_by: user.username,
      target_type: 'SESSION',
      target_id: newSession.id,
      details: `Started active attendance session for ${newSession.department} - Sec ${newSession.section} (${newSession.subject}) in ${newSession.classroom}`,
    });

    res.status(201).json({
      success: true,
      message: 'Attendance session started successfully. Ready for live camera stream.',
      session: newSession,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create session.' });
  }
});

// POST /api/sessions/:id/stop (Close / Complete session)
router.post('/:id/stop', authenticateToken, (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;
  const session = db.getSessionById(id);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  if (user.role === 'HOD') {
    const isOwner = session.department.toLowerCase() === user.department.toLowerCase() ||
      (session.departments && session.departments.some((d) => d.toLowerCase() === user.department.toLowerCase()));
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }

  const finalStats = calculateSessionStats(session);

  session.status = 'COMPLETED';
  session.end_time = new Date().toTimeString().slice(0, 5);
  session.department_stats = finalStats.department_stats;
  db.saveSession(session);

  // Clear in-memory temporal trackers for this session
  clearSessionTracking(session.id);

  db.logAudit({
    action: 'STOP_SESSION',
    performed_by: user.username,
    target_type: 'SESSION',
    target_id: session.id,
    details: `Completed session ${session.subject} (${session.classroom}). Total: ${finalStats.total_students}, Present: ${finalStats.present_count} (${finalStats.attendance_percentage}%)`,
  });

  res.json({
    success: true,
    message: 'Attendance session concluded successfully.',
    session,
    final_stats: finalStats,
  });
});

export default router;
