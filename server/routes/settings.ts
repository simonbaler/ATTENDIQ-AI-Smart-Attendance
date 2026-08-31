import express from 'express';
import { db } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = express.Router();

export const INSTITUTION_DATA = {
  name: 'Siddhartha Institute of Technology and Sciences',
  short_name: 'SITS Hyderabad',
  departments: [
    {
      code: 'CSE',
      name: 'Computer Science & Engineering',
      sections: ['A', 'B', 'C', 'D'],
      subjects: ['Machine Learning', 'Artificial Intelligence', 'Cloud Computing', 'Computer Networks', 'Operating Systems', 'Database Management Systems'],
      classrooms: ['LH-301', 'LH-302', 'LH-303', 'CS-Lab-1', 'CS-Lab-2', 'Seminar Hall A', 'C-204'],
    },
    {
      code: 'SE',
      name: 'Software Engineering',
      sections: ['A', 'B'],
      subjects: ['Software Architecture', 'Agile Methodologies', 'Software Testing & QA', 'Cloud Systems & DevOps', 'Database Systems'],
      classrooms: ['LH-204', 'C-204', 'SE-Lab-1', 'Seminar Hall A'],
    },
    {
      code: 'ECE',
      name: 'Electronics & Communication Engineering',
      sections: ['A', 'B'],
      subjects: ['VLSI Design', 'Digital Signal Processing', 'Embedded Systems', 'Microprocessors', 'Wireless Communications'],
      classrooms: ['LH-201', 'LH-202', 'ECE-Lab-1', 'Seminar Hall B'],
    },
    {
      code: 'AIML',
      name: 'Artificial Intelligence & Machine Learning',
      sections: ['A', 'B'],
      subjects: ['Deep Learning', 'Natural Language Processing', 'Computer Vision', 'Reinforcement Learning', 'AI Ethics'],
      classrooms: ['LH-401', 'LH-402', 'AI-Lab-1'],
    },
    {
      code: 'DS',
      name: 'Data Science',
      sections: ['A', 'B'],
      subjects: ['Big Data Analytics', 'Data Mining', 'Predictive Modeling', 'Data Visualization', 'Statistical Analysis'],
      classrooms: ['LH-403', 'DS-Lab-1'],
    },
    {
      code: 'EEE',
      name: 'Electrical & Electronics Engineering',
      sections: ['A'],
      subjects: ['Power Systems', 'Control Systems', 'Electrical Machines', 'Renewable Energy'],
      classrooms: ['LH-101', 'EEE-Lab-1'],
    },
    {
      code: 'MECH',
      name: 'Mechanical Engineering',
      sections: ['A'],
      subjects: ['Thermodynamics', 'Fluid Mechanics', 'CAD/CAM', 'Robotics & Automation'],
      classrooms: ['LH-102', 'Mech-Workshop-1'],
    },
    {
      code: 'CIVIL',
      name: 'Civil Engineering',
      sections: ['A'],
      subjects: ['Structural Analysis', 'Geotechnical Engineering', 'Environmental Engineering', 'Surveying'],
      classrooms: ['LH-103', 'Civil-Lab-1'],
    },
  ],
};

// GET /api/departments (Public / Authenticated)
router.get('/departments', (req, res) => {
  res.json({
    success: true,
    institution: INSTITUTION_DATA.name,
    departments: INSTITUTION_DATA.departments,
  });
});

// GET /api/settings
router.get('/settings', authenticateToken, (req, res) => {
  const settings = db.getSettings();
  res.json({ success: true, settings });
});

// PUT /api/settings (Admin only)
router.put('/settings', authenticateToken, requireAdmin, (req, res) => {
  const user = (req as any).user;
  const updated = db.updateSettings(req.body);

  db.logAudit({
    action: 'UPDATE_SETTINGS',
    performed_by: user.username,
    target_type: 'SYSTEM',
    target_id: 'settings',
    details: `Updated system settings: threshold=${updated.recognition_threshold}, confirmation_frames=${updated.temporal_confirmation_frames}`,
  });

  res.json({ success: true, message: 'Settings updated successfully.', settings: updated });
});

// GET /api/audit-logs (Admin only)
router.get('/audit-logs', authenticateToken, requireAdmin, (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const logs = db.getAuditLogs(limit);
  res.json({ success: true, count: logs.length, logs });
});

export default router;
