import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, User } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sits_smartattend_ai_jwt_secret_key_2026';

// In-memory rate limiting and lockout state
interface FailedAttemptInfo {
  count: number;
  lockedUntil: number;
}
const failedAttemptsMap = new Map<string, FailedAttemptInfo>();

// Middleware to verify JWT token
export function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
    (req as any).user = user;
    next();
  });
}

// Middleware to check Admin role
export function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user as User;
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
  }
  next();
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${username?.toLowerCase()}_${clientIp}`;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    // Check account lockout
    const attemptInfo = failedAttemptsMap.get(key);
    const now = Date.now();
    if (attemptInfo && attemptInfo.lockedUntil > now) {
      const waitMinutes = Math.ceil((attemptInfo.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Account locked due to excessive failed attempts. Please retry in ${waitMinutes} minute(s).`,
      });
    }

    const user = db.getUserByUsername(username);
    if (!user) {
      // Record failed attempt
      const curr = failedAttemptsMap.get(key) || { count: 0, lockedUntil: 0 };
      curr.count += 1;
      if (curr.count >= 5) {
        curr.lockedUntil = now + 5 * 60 * 1000; // 5 minute lock
        db.logSecurityEvent({
          event_type: 'REPEATED_FAILED_LOGIN',
          severity: 'HIGH',
          details: `5 consecutive failed login attempts for username '${username}' from IP ${clientIp}. Account locked for 5 minutes.`,
          ip_address: clientIp,
        });
      }
      failedAttemptsMap.set(key, curr);

      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact Administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const curr = failedAttemptsMap.get(key) || { count: 0, lockedUntil: 0 };
      curr.count += 1;
      if (curr.count >= 5) {
        curr.lockedUntil = now + 5 * 60 * 1000;
        db.logSecurityEvent({
          event_type: 'REPEATED_FAILED_LOGIN',
          severity: 'HIGH',
          details: `5 consecutive failed login attempts for user '${user.username}' from IP ${clientIp}. Account locked for 5 minutes.`,
          ip_address: clientIp,
        });
      }
      failedAttemptsMap.set(key, curr);

      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Clear failed attempts on success
    failedAttemptsMap.delete(key);

    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      department: user.department,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '12h' });

    db.logAudit({
      action: 'USER_LOGIN',
      performed_by: user.username,
      actor_id: user.id,
      actor_role: user.role,
      target_type: 'USER',
      target_id: user.id,
      ip_address: clientIp,
      details: `User ${user.username} (${user.role}) logged in successfully.`,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        department: user.department,
        status: user.status,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const tokenUser = (req as any).user;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    const user = db.getUserById(tokenUser.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(new_password, salt);
    db.saveUser(user);

    db.logAudit({
      action: 'USER_PASSWORD_CHANGE',
      performed_by: user.username,
      actor_id: user.id,
      actor_role: user.role,
      target_type: 'USER',
      target_id: user.id,
      details: `User ${user.username} updated their account credentials.`,
    });

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const tokenUser = (req as any).user;
  const user = db.getUserById(tokenUser.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      department: user.department,
      status: user.status,
    },
  });
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  const user = (req as any).user;
  db.logAudit({
    action: 'USER_LOGOUT',
    performed_by: user.username,
    target_type: 'USER',
    target_id: user.id,
    details: `User ${user.username} logged out.`,
  });
  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/users (ADMIN ONLY)
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.getUsers().map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    name: u.name,
    department: u.department,
    status: u.status,
    created_at: u.created_at,
  }));
  res.json({ success: true, users });
});

// POST /api/auth/users (ADMIN ONLY - Create HOD)
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, name, department, role } = req.body;
    if (!username || !password || !name || !department) {
      return res.status(400).json({ success: false, message: 'All fields (username, password, name, department) are required.' });
    }

    const existing = db.getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: username.toLowerCase().trim(),
      password_hash,
      role: role === 'ADMIN' ? 'ADMIN' : 'HOD',
      name,
      department,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };

    db.saveUser(newUser);

    const creator = (req as any).user;
    db.logAudit({
      action: 'CREATE_USER',
      performed_by: creator.username,
      target_type: 'USER',
      target_id: newUser.id,
      details: `Created new ${newUser.role} user ${newUser.username} for department ${newUser.department}`,
    });

    res.status(201).json({
      success: true,
      message: `${newUser.role} account created successfully.`,
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        name: newUser.name,
        department: newUser.department,
        status: newUser.status,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create user.' });
  }
});

// PUT /api/auth/users/:id/status (ADMIN ONLY)
router.put('/users/:id/status', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const targetUser = db.getUserById(id);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (targetUser.username === 'admin') {
    return res.status(400).json({ success: false, message: 'Cannot deactivate master admin account.' });
  }

  targetUser.status = status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
  db.saveUser(targetUser);

  const actor = (req as any).user;
  db.logAudit({
    action: 'USER_STATUS_CHANGE',
    performed_by: actor.username,
    target_type: 'USER',
    target_id: targetUser.id,
    details: `Changed status of ${targetUser.username} to ${targetUser.status}`,
  });

  res.json({ success: true, message: `User status updated to ${targetUser.status}` });
});

// PUT /api/auth/users/:id/reset-password (ADMIN ONLY)
router.put('/users/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
  }

  const targetUser = db.getUserById(id);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const salt = await bcrypt.genSalt(10);
  targetUser.password_hash = await bcrypt.hash(new_password, salt);
  db.saveUser(targetUser);

  const actor = (req as any).user;
  db.logAudit({
    action: 'RESET_PASSWORD',
    performed_by: actor.username,
    target_type: 'USER',
    target_id: targetUser.id,
    details: `Reset password for user ${targetUser.username}`,
  });

  res.json({ success: true, message: 'Password reset successfully.' });
});

export default router;
