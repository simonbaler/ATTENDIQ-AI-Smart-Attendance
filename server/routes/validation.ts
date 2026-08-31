import express from 'express';
import { db } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = express.Router();

// POST /api/validation/benchmark - Run full dataset pairwise genuine vs imposter cross-validation
router.post('/benchmark', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { candidateThreshold } = req.body;
    const benchmark = db.runFaceRecognitionBenchmark(
      candidateThreshold ? Number(candidateThreshold) : undefined
    );

    const user = (req as any).user;
    db.logAudit({
      action: 'FACE_RECOGNITION_BENCHMARK_RUN',
      performed_by: user.username,
      actor_id: user.id,
      actor_role: user.role,
      target_type: 'SYSTEM_MODEL',
      target_id: benchmark.id,
      details: `Executed full-dataset accuracy benchmark on ${benchmark.total_students_evaluated} students (${benchmark.total_enrolled_faces} face samples). Measured Accuracy: ${benchmark.accuracy}%, FAR: ${benchmark.far}%, FRR: ${benchmark.frr}%.`,
    });

    res.json({ success: true, benchmark });
  } catch (err: any) {
    console.error('Benchmark execution error:', err);
    res.status(500).json({ success: false, message: err.message || 'Benchmark execution failed.' });
  }
});

// GET /api/validation/benchmark/history - Get past benchmark runs
router.get('/benchmark/history', authenticateToken, (req, res) => {
  try {
    const history = db.getBenchmarkHistory();
    res.json({ success: true, history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve benchmark history.' });
  }
});

// POST /api/validation/calibrate-threshold - Calibrate and set institutional recognition threshold
router.post('/calibrate-threshold', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { threshold, reason } = req.body;
    const num = Number(threshold);

    if (isNaN(num) || num < 0.3 || num > 0.7) {
      return res.status(400).json({
        success: false,
        message: 'Invalid threshold. Must be a floating point value between 0.30 and 0.70.',
      });
    }

    const prevSettings = db.getSettings();
    const prevThreshold = prevSettings.recognition_threshold;

    const updated = db.updateSettings({ recognition_threshold: Number(num.toFixed(2)) });

    const user = (req as any).user;
    db.logAudit({
      action: 'THRESHOLD_CALIBRATION_MODIFIED',
      performed_by: user.username,
      actor_id: user.id,
      actor_role: user.role,
      target_type: 'SYSTEM_SETTINGS',
      target_id: 'recognition_threshold',
      previous_value: String(prevThreshold),
      new_value: String(updated.recognition_threshold),
      details: `Institutional face recognition threshold calibrated from ${prevThreshold} to ${updated.recognition_threshold}. Reason: ${reason || 'SIH-2026 Production Validation Protocol.'}`,
    });

    res.json({
      success: true,
      threshold: updated.recognition_threshold,
      settings: updated,
      message: `Recognition threshold updated to ${updated.recognition_threshold}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to calibrate threshold.' });
  }
});

// GET /api/validation/liveness-stats - Get real measured liveness & anti-spoofing telemetry
router.get('/liveness-stats', authenticateToken, (req, res) => {
  try {
    const stats = db.getLivenessBenchmarkStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve liveness stats.' });
  }
});

// POST /api/validation/run-system-tests - Execute 10-point automated self-test suite
router.post('/run-system-tests', authenticateToken, requireAdmin, (req, res) => {
  try {
    const tests = db.runAutomatedSystemTests();
    const passedCount = tests.filter((t) => t.status === 'PASSED').length;

    const user = (req as any).user;
    db.logAudit({
      action: 'SYSTEM_SELF_TEST_SUITE_RUN',
      performed_by: user.username,
      actor_id: user.id,
      actor_role: user.role,
      target_type: 'SYSTEM',
      target_id: 'automated_tests',
      details: `Executed 10-point validation suite: ${passedCount}/${tests.length} tests PASSED.`,
    });

    res.json({
      success: true,
      tests,
      summary: {
        total: tests.length,
        passed: passedCount,
        failed: tests.length - passedCount,
        all_passed: passedCount === tests.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Automated test suite failed to execute.' });
  }
});

// POST /api/validation/backup - Create atomic encrypted backup snapshot
router.post('/backup', authenticateToken, requireAdmin, (req, res) => {
  try {
    const user = (req as any).user;
    const backup = db.createDatabaseBackup(user.username);
    res.json({ success: true, backup });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Backup failed.' });
  }
});

// GET /api/validation/backups - List all verified backup snapshots
router.get('/backups', authenticateToken, requireAdmin, (req, res) => {
  try {
    const backups = db.getDatabaseBackups();
    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to list backups.' });
  }
});

// POST /api/validation/restore - Restore state from a verified backup snapshot
router.post('/restore', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Backup filename is required.' });
    }

    const user = (req as any).user;
    const result = db.restoreDatabaseBackup(filename, user.username);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: result.message });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Restore operation failed.' });
  }
});

export default router;
