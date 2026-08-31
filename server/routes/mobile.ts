import express from 'express';
import QRCode from 'qrcode';
import os from 'os';
import { db, mobileStreamManager, AttendanceRecord, AttendanceSession } from '../db.js';
import { authenticateToken } from './auth.js';
import {
  matchFaceDescriptor,
  assignTrackingId,
  evaluateFaceQuality,
  evaluateLiveness,
  updateAdaptiveTemporalConfirmation,
} from '../recognition.js';
import { globalVectorIndex } from '../vectorIndex.js';

const router = express.Router();

/**
 * Helper to get local network IP address of the machine
 */
function getLocalNetworkIp(): string | null {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// Helper function to resolve reachable origin (Strict AI Studio & Localhost filtering + Public Cloud Run auto-rewrite)
function resolveReachableOrigin(req: express.Request, clientOrigin?: string): { baseOrigin: string; isLocalhost: boolean; lanIp: string | null; isAiStudioPreview: boolean } {
  const lanIp = getLocalNetworkIp();
  const forwardedHost = req.get('x-forwarded-host');
  const headerHost = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const settings = db.getSettings();

  // Known public preview URL for this project (unauthenticated, public access)
  const PUBLIC_PREVIEW_URL = 'https://ais-pre-bpayzufx5syjwygztm4y7l-460380840568.asia-southeast1.run.app';

  const normalizeOrigin = (url?: string | null): string | null => {
    if (!url || typeof url !== 'string') return null;
    let clean = url.trim().replace(/\/$/, '');
    // If the origin is the internal development preview (ais-dev-) or aistudio iframe, rewrite to public preview
    if (clean.includes('ais-dev-') && clean.includes('.run.app')) {
      clean = clean.replace('ais-dev-', 'ais-pre-');
    }
    if (clean.includes('aistudio.google.com') || clean.includes('localhost') || clean.includes('127.0.0.1')) {
      return PUBLIC_PREVIEW_URL;
    }
    return clean;
  };

  const isBadOrigin = (url?: string | null): boolean => {
    if (!url || typeof url !== 'string') return true;
    const lower = url.toLowerCase();
    return (
      lower.includes('aistudio.google.com') ||
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('0.0.0.0') ||
      url === 'MY_APP_URL'
    );
  };

  let baseOrigin = '';

  // Priority 1: Persisted DB System Settings (APP_PUBLIC_URL, DEV_PUBLIC_ORIGIN, DEV_LAN_ORIGIN)
  const settingsUrl = normalizeOrigin(settings.app_public_url || settings.dev_public_origin || settings.dev_lan_origin);
  if (settingsUrl && !isBadOrigin(settingsUrl)) {
    baseOrigin = settingsUrl;
  }
  // Priority 2: Configured Environment URLs
  else if (process.env.APP_PUBLIC_URL) {
    const envUrl = normalizeOrigin(process.env.APP_PUBLIC_URL);
    if (envUrl && !isBadOrigin(envUrl)) baseOrigin = envUrl;
  } else if (process.env.DEV_PUBLIC_ORIGIN) {
    const envDev = normalizeOrigin(process.env.DEV_PUBLIC_ORIGIN);
    if (envDev && !isBadOrigin(envDev)) baseOrigin = envDev;
  }
  // Priority 3: Client browser origin rewritten from ais-dev to ais-pre
  else if (clientOrigin) {
    const normClient = normalizeOrigin(clientOrigin);
    if (normClient && !isBadOrigin(normClient)) {
      baseOrigin = normClient;
    }
  }
  // Priority 4: Forwarded host header from reverse proxies / Cloud Run rewritten from ais-dev to ais-pre
  else if (forwardedHost) {
    const normFwd = normalizeOrigin(`${protocol}://${forwardedHost}`);
    if (normFwd && !isBadOrigin(normFwd)) {
      baseOrigin = normFwd;
    }
  }
  // Priority 5: Direct headerHost if not localhost or AI Studio
  else if (headerHost) {
    const normHost = normalizeOrigin(`${protocol}://${headerHost}`);
    if (normHost && !isBadOrigin(normHost)) {
      baseOrigin = normHost;
    }
  }

  // If still empty or unresolved or contains dev/aistudio, fallback to known public preview origin
  if (!baseOrigin || isBadOrigin(baseOrigin) || baseOrigin.includes('ais-dev-')) {
    baseOrigin = PUBLIC_PREVIEW_URL;
  }

  const isLocalhost = baseOrigin.includes('localhost') || baseOrigin.includes('127.0.0.1');
  const isAiStudioPreview = baseOrigin.includes('aistudio.google.com');
  return { baseOrigin, isLocalhost, lanIp, isAiStudioPreview };
}

function getIceServers() {
  const settings = db.getSettings();
  const stunUrls =
    settings.webrtc_stun_urls && settings.webrtc_stun_urls.length > 0
      ? settings.webrtc_stun_urls
      : process.env.WEBRTC_STUN_URLS
      ? process.env.WEBRTC_STUN_URLS.split(',').map((s) => s.trim())
      : [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun.cloudflare.com:3478',
        ];

  const iceServers: any[] = [{ urls: stunUrls }];

  const turnUrl = settings.webrtc_turn_url || process.env.WEBRTC_TURN_URL;
  if (turnUrl) {
    iceServers.push({
      urls: [turnUrl],
      username: settings.webrtc_turn_username || process.env.WEBRTC_TURN_USERNAME || '',
      credential: settings.webrtc_turn_credential || process.env.WEBRTC_TURN_CREDENTIAL || '',
    });
  }

  return iceServers;
}

// POST /api/mobile/pair/create & /api/mobile/pairing/create (Phase 3 standard endpoints)
const handlePairCreate = async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    let { session_id, client_origin } = req.body;

    let attSession = session_id ? db.getSessionById(session_id) : undefined;
    
    // Auto-resolve active session if not provided
    if (!attSession) {
      attSession = db.getActiveSession(user.role === 'HOD' ? user.department : undefined) ||
                   db.getActiveSession() ||
                   db.getSessions({ status: 'ACTIVE' })[0];
    }

    // Auto-create active session if none exists
    if (!attSession) {
      const now = new Date();
      const newSess: AttendanceSession = {
        id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        department: user.department || 'Computer Science & Engineering',
        section: 'A',
        subject: 'Classroom Lecture',
        classroom: 'LH-301',
        date: now.toISOString().split('T')[0],
        start_time: now.toTimeString().split(' ')[0],
        end_time: '',
        status: 'ACTIVE',
        created_by: user.id || user.name || 'System',
        created_at: now.toISOString(),
      };
      db.saveSession(newSess);
      attSession = newSess;
    }

    if (user.role === 'HOD' && attSession.department.toLowerCase() !== user.department.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot pair session for another department.' });
    }

    const result = db.createMobileCameraSession(attSession.id, `${user.name} (${user.role})`);
    if (!result.success || !result.session) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to generate mobile camera session.' });
    }

    const { baseOrigin, isLocalhost, lanIp, isAiStudioPreview } = resolveReachableOrigin(req, client_origin);

    // Mobile URL strictly according to Phase 3 & 5 specification
    const mobileUrl = `${baseOrigin}/mobile/pair/${result.session.pairing_token}`;

    console.log('[Mobile Pairing QR Diagnostic] Generated destination URL:', mobileUrl);

    const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 360,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    const iceServers = getIceServers();

    res.json({
      success: true,
      pairingId: result.session.id,
      token: result.session.pairing_token,
      opaqueToken: result.session.pairing_token,
      mobileUrl,
      qrDataUrl,
      expiresAt: result.session.expires_at,
      session: result.session,
      isLocalhost,
      lanIp,
      isAiStudioPreview,
      iceServers,
    });
  } catch (err: any) {
    console.error('Mobile pairing create error:', err);
    res.status(500).json({ success: false, message: err.message || 'Mobile pairing creation failed.' });
  }
};

router.post('/pair/create', authenticateToken, handlePairCreate);
router.post('/pairing/create', authenticateToken, handlePairCreate);

// POST /api/mobile/reachability-test (Test mobile reachability without Google login redirects or 403s)
router.post('/reachability-test', authenticateToken, async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, message: 'URL is required for reachability test.' });
  }

  const tStart = performance.now();
  let cleanUrl = url.trim().replace(/\/$/, '');
  const isLocalhost = cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1');
  const isAiStudio = cleanUrl.includes('aistudio.google.com');

  try {
    const testEndpoint = `${cleanUrl}/api/health`;
    const response = await fetch(testEndpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Math.round(performance.now() - tStart);
    const hasGoogleRedirect = response.url.includes('accounts.google.com') || response.url.includes('google.com/auth');
    const is403 = response.status === 403;
    const isOk = response.ok && !hasGoogleRedirect && !is403;

    let responseData: any = null;
    try {
      responseData = await response.json();
    } catch {
      // ignore
    }

    res.json({
      success: true,
      url: cleanUrl,
      status_code: response.status,
      latency_ms: latency,
      reachable: isOk,
      is_ai_studio_preview: isAiStudio,
      is_localhost: isLocalhost,
      has_google_login_redirect: hasGoogleRedirect,
      message: isOk
        ? `Reachable! Server responded with HTTP ${response.status} in ${latency}ms.`
        : is403
        ? 'Access Forbidden (403). The destination requires desktop authorization or is an authenticated preview.'
        : hasGoogleRedirect
        ? 'URL redirected to Google login. Physical phones will not have active session credentials.'
        : `Connection failed with HTTP ${response.status}.`,
      diagnostics: {
        origin_tested: cleanUrl,
        endpoint_tested: testEndpoint,
        http_status: response.status,
        final_url: response.url,
        latency_ms: latency,
        response_type: response.headers.get('content-type') || 'unknown',
        system_response: responseData,
        checked_at: new Date().toISOString(),
        suggested_fix: !isOk
          ? isLocalhost
            ? 'Localhost cannot be reached by a physical phone on Wi-Fi. Configure your computer LAN IP (e.g. http://192.168.1.x:3000) or an ngrok/tunnel URL.'
            : isAiStudio || is403
            ? 'AI Studio preview requires desktop Google account. Configure APP_PUBLIC_URL or a LAN development URL in Camera Settings.'
            : 'Verify that the server is running and accessible on this port without firewall blocks.'
          : undefined,
      },
    });
  } catch (err: any) {
    const latency = Math.round(performance.now() - tStart);
    res.json({
      success: false,
      url: cleanUrl,
      reachable: false,
      is_ai_studio_preview: isAiStudio,
      is_localhost: isLocalhost,
      has_google_login_redirect: false,
      message: `Failed to connect to ${cleanUrl}: ${err.message || 'Connection timeout/refused.'}`,
      diagnostics: {
        origin_tested: cleanUrl,
        latency_ms: latency,
        error_name: err.name,
        error_message: err.message,
        checked_at: new Date().toISOString(),
        suggested_fix: isLocalhost
          ? 'Localhost is only accessible on this machine. Use your LAN IP (e.g., http://192.168.x.x:3000) or a public tunnel.'
          : 'Check if the host is active, port 3000 is open, and firewall allows incoming connections.',
      },
    });
  }
});

// POST /api/mobile/pairing/validate and /api/mobile/pair/validate
const handlePairValidate = (req: express.Request, res: express.Response) => {
  try {
    const { token, device_info } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Pairing token is required.' });
    }

    const validateRes = db.validateMobilePairingToken(token);
    if (!validateRes.success || !validateRes.session) {
      return res.status(400).json({ success: false, message: validateRes.error || 'Pairing token is invalid or expired.' });
    }

    const session = validateRes.session;
    const activeAttSession = db.getSessionById(session.attendance_session_id);

    res.json({
      success: true,
      session,
      session_details: session.session_details,
      is_attendance_active: activeAttSession?.status === 'ACTIVE',
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
        ...(process.env.WEBRTC_TURN_URL ? [{
          urls: [process.env.WEBRTC_TURN_URL],
          username: process.env.WEBRTC_TURN_USERNAME || '',
          credential: process.env.WEBRTC_TURN_CREDENTIAL || '',
        }] : []),
      ],
    });
  } catch (err: any) {
    console.error('Pairing validation error:', err);
    res.status(500).json({ success: false, message: err.message || 'Pairing validation failed.' });
  }
};

router.post('/pairing/validate', handlePairValidate);
router.post('/pair/validate', handlePairValidate);

// GET /api/mobile/pair/:token/status & /api/mobile/pair/status/:token (Public check of pairing token status)
const handlePairStatus = (req: express.Request, res: express.Response) => {
  const token = req.params.token || req.query.token as string;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required.' });
  }
  const validateRes = db.validateMobilePairingToken(token);
  if (!validateRes.success || !validateRes.session) {
    return res.status(404).json({ success: false, message: validateRes.error || 'Token invalid or expired.' });
  }
  const session = validateRes.session;
  res.json({
    success: true,
    status: session.status,
    expires_at: session.expires_at,
    is_valid: true,
    session_id: session.attendance_session_id,
  });
};

router.get('/pair/:token/status', handlePairStatus);
router.get('/pair/status/:token', handlePairStatus);
router.get('/pairing/:token/status', handlePairStatus);

// POST /api/mobile/pair/:token/connect (Public device connect for a pairing token)
const handlePairTokenConnect = (req: express.Request, res: express.Response) => {
  const token = req.params.token || req.body.token;
  const deviceInfo = req.body.device_info || req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required.' });
  }
  const connectResult = db.connectMobileCamera(token, deviceInfo);
  if (!connectResult.success || !connectResult.session) {
    return res.status(400).json({ success: false, message: connectResult.error || 'Pairing token invalid or expired.' });
  }
  const session = connectResult.session;
  const activeAttSession = db.getSessionById(session.attendance_session_id);
  res.json({
    success: true,
    message: 'Mobile camera paired successfully.',
    session,
    session_details: session.session_details,
    is_attendance_active: activeAttSession?.status === 'ACTIVE',
  });
};

router.post('/pair/:token/connect', handlePairTokenConnect);
router.post('/pairing/:token/connect', handlePairTokenConnect);

// POST /api/mobile/pair (Admin / HOD initiates mobile camera pairing - backward compatibility)
router.post('/pair', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { session_id, client_origin } = req.body;

    if (!session_id) {
      return res.status(400).json({ success: false, message: 'session_id is required.' });
    }

    const attSession = db.getSessionById(session_id);
    if (!attSession) {
      return res.status(404).json({ success: false, message: 'Attendance session not found.' });
    }

    // RBAC check: HOD can only pair sessions in their department
    if (user.role === 'HOD' && attSession.department.toLowerCase() !== user.department.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot pair session for another department.' });
    }

    const result = db.createMobileCameraSession(session_id, `${user.name} (${user.role})`);
    if (!result.success || !result.session) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to generate mobile camera session.' });
    }

    const { baseOrigin, isLocalhost, lanIp } = resolveReachableOrigin(req, client_origin);
    const pairingUrl = `${baseOrigin}/?mode=mobile-camera&token=${result.session.pairing_token}`;

    // Generate high-resolution QR code
    const qrDataUrl = await QRCode.toDataURL(pairingUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 360,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    res.json({
      success: true,
      session: result.session,
      pairingId: result.session.id,
      pairing_code: result.session.pairing_code,
      pairing_token: result.session.pairing_token,
      opaqueToken: result.session.pairing_token,
      pairing_url: pairingUrl,
      mobileUrl: pairingUrl,
      base_origin: baseOrigin,
      is_localhost: isLocalhost,
      isLocalhost,
      lan_ip: lanIp,
      lanIp,
      qr_data_url: qrDataUrl,
      qrDataUrl,
      expires_at: result.session.expires_at,
      expiresAt: result.session.expires_at,
    });
  } catch (err: any) {
    console.error('Mobile pairing error:', err);
    res.status(500).json({ success: false, message: err.message || 'Mobile pairing failed.' });
  }
});

// POST /api/mobile/connect (Mobile camera device connects via pairing code or token)
router.post('/connect', (req, res) => {
  try {
    const { code, token, device_info } = req.body;
    const lookupKey = token || code;

    if (!lookupKey) {
      return res.status(400).json({ success: false, message: 'Pairing code or token is required.' });
    }

    const connectResult = db.connectMobileCamera(lookupKey, device_info);
    if (!connectResult.success || !connectResult.session) {
      return res.status(400).json({ success: false, message: connectResult.error || 'Pairing code invalid or expired.' });
    }

    const session = connectResult.session;
    const activeAttSession = db.getSessionById(session.attendance_session_id);

    res.json({
      success: true,
      message: 'Mobile camera paired successfully with SITS SmartAttend AI.',
      session,
      session_details: session.session_details,
      is_attendance_active: activeAttSession?.status === 'ACTIVE',
    });
  } catch (err: any) {
    console.error('Mobile connect error:', err);
    res.status(500).json({ success: false, message: err.message || 'Connection failed.' });
  }
});

// GET /api/mobile/session/:sessionId (Get mobile camera status for a session)
router.get('/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = db.getMobileCameraBySessionId(sessionId);
  if (!session) {
    return res.json({ success: true, active: false, session: null });
  }

  const latestFrame = mobileStreamManager.getLatestFrame(sessionId);

  res.json({
    success: true,
    active: session.status === 'CONNECTED' || session.status === 'STREAMING',
    session,
    latest_frame: latestFrame ? {
      timestamp: latestFrame.timestamp,
      faces_count: latestFrame.faces_count,
      fps: latestFrame.fps,
      latency_ms: latestFrame.latency_ms,
      results: latestFrame.results,
    } : null,
  });
});

// GET /api/mobile/list (Admin/HOD list active mobile cameras)
router.get('/list', authenticateToken, (req, res) => {
  const user = (req as any).user;
  const effectiveDept = user.role === 'HOD' ? user.department : undefined;
  const sessions = db.getMobileCameraSessions(effectiveDept);

  res.json({
    success: true,
    count: sessions.length,
    sessions,
  });
});

// POST /api/mobile/frame (Multi-Face Mobile Camera Frame Processing & Streaming)
router.post('/frame', (req, res) => {
  const startTime = performance.now();
  try {
    const {
      session_id,
      faces,
      preview_image,
      fps,
      latency_ms,
      orientation,
    } = req.body as {
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
    };

    if (!session_id) {
      return res.status(400).json({ success: false, message: 'session_id is required.' });
    }

    const mobSession = db.getMobileCameraBySessionId(session_id);
    const activeSession = db.getSessionById(session_id);

    if (!activeSession) {
      return res.status(404).json({ success: false, message: 'Active attendance session not found.' });
    }

    const processedResults = [];
    let newMarksCount = 0;

    if (Array.isArray(faces)) {
      for (const face of faces) {
        if (!face.descriptor || face.descriptor.length !== 128) {
          continue;
        }

        // 1. Multi-Face Tracking Engine (TRK-1001, TRK-1002, ...)
        const tracking = assignTrackingId(face.box, face.descriptor);

        // 2. Face Quality & Motion Robustness Engine
        const quality = evaluateFaceQuality(face.box, face.detectionScore);

        // 3. Liveness & Anti-Spoofing Engine
        const liveness = evaluateLiveness(
          tracking.trackItem,
          face.box,
          face.descriptor,
          face.detectionScore || 0.90
        );

        // 4. Fast Vector Search against 10,000+ Biometric Vectors
        const match = matchFaceDescriptor(
          face.descriptor,
          activeSession.department,
          activeSession.section
        );

        let recognitionState: 'DETECTING' | 'MATCHING' | 'CONFIRMING' | 'VERIFIED' | 'UNKNOWN' | 'POOR_FRAME' = 'DETECTING';
        if (!quality.isValid && quality.isMotionBlur) {
          recognitionState = 'POOR_FRAME';
        } else if (match.isMatch && match.student) {
          recognitionState = 'MATCHING';
        } else {
          recognitionState = 'UNKNOWN';
        }

        let attendanceMarked = false;
        let duplicateIgnored = false;
        let confirmationFrames = 0;
        let requiredFrames = 3;
        let isConfirmed = false;

        if (liveness.spoofSuspected) {
          db.logSecurityEvent({
            session_id: activeSession.id,
            student_id: match.student?.id,
            student_name: match.student?.full_name,
            department: activeSession.department,
            event_type: 'SPOOF_ATTEMPT',
            severity: 'HIGH',
            details: `[Mobile Camera Stream] Spoofing flagged for track ${tracking.trackingId} in ${activeSession.classroom}. Reasons: ${liveness.reasons.join('; ')}`,
          });
        }

        // 5. Temporal Confirmation & Transactional Attendance Marking
        if (match.isMatch && match.student && !liveness.spoofSuspected && quality.isValid) {
          if (activeSession.status === 'ACTIVE') {
            const temporal = updateAdaptiveTemporalConfirmation(
              activeSession.id,
              match.student.id,
              match.confidence,
              match.distance
            );

            confirmationFrames = temporal.consecutiveFrames;
            requiredFrames = temporal.requiredFrames;
            isConfirmed = temporal.isConfirmed;

            if (isConfirmed) {
              recognitionState = 'VERIFIED';
            } else {
              recognitionState = 'CONFIRMING';
            }

            const existingRecord = db.getAttendanceByStudentAndSession(
              match.student.id,
              activeSession.id
            );

            if (existingRecord && existingRecord.status === 'PRESENT') {
              duplicateIgnored = true;
            } else if (isConfirmed) {
              const now = new Date();
              const newRecord: AttendanceRecord = {
                id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                student_id: match.student.id,
                roll_number: match.student.roll_number,
                full_name: match.student.full_name,
                // Department is strictly derived from institutional student record
                department: match.student.department,
                section: match.student.section,
                session_id: activeSession.id,
                subject: activeSession.subject,
                classroom: activeSession.classroom,
                date: activeSession.date,
                time: now.toTimeString().slice(0, 8),
                status: 'PRESENT',
                confidence: match.confidence,
                verification_method: 'FACE_RECOGNITION',
                camera_source: 'MOBILE_CAMERA',
                created_at: now.toISOString(),
                marked_by: `AI_MOBILE_VISION (${mobSession?.device_info?.platform || 'Smartphone'})`,
              };

              const txResult = db.saveAttendanceTransactional(newRecord, {
                actorRole: 'ADMIN',
                actorDepartment: activeSession.department,
              });

              if (txResult.success) {
                attendanceMarked = true;
                newMarksCount++;

                setTimeout(() => {
                  try {
                    db.detectAnomaliesForSession(activeSession.id);
                  } catch (e) {
                    console.error('Anomaly check error:', e);
                  }
                }, 400);

                db.logAudit({
                  action: 'ATTENDANCE_MOBILE_CAMERA_MARKED',
                  performed_by: 'MOBILE_CLASSROOM_CAMERA',
                  target_type: 'ATTENDANCE',
                  target_id: newRecord.id,
                  details: `[Mobile Camera] Marked PRESENT for ${match.student.full_name} (${match.student.roll_number}) in ${activeSession.classroom} with ${match.confidence}% confidence.`,
                });
              } else if (txResult.duplicate) {
                duplicateIgnored = true;
              }
            }
          }
        }

        // Telemetry
        db.logRecognitionEvent({
          session_id: activeSession.id,
          student_id: match.student?.id,
          confidence: match.confidence,
          face_distance: match.distance,
          liveness_score: liveness.livenessScore,
          result: liveness.spoofSuspected ? 'SPOOF' : match.isMatch ? 'RECOGNIZED' : 'UNKNOWN',
        });

        processedResults.push({
          x: face.box.x,
          y: face.box.y,
          width: face.box.width,
          height: face.box.height,
          box: face.box,
          crop_data_url: face.crop_data_url,
          tracking_id: tracking.trackingId,
          status: match.status,
          state: recognitionState,
          student: match.student
            ? {
                id: match.student.id,
                student_id: match.student.student_id,
                full_name: match.student.full_name,
                roll_number: match.student.roll_number,
                department: match.student.department,
                section: match.student.section,
              }
            : null,
          confidence: match.confidence,
          distance: match.distance,
          second_distance: match.second_distance,
          is_uncertain: match.uncertain,
          candidates_evaluated: match.candidatesEvaluated,
          search_latency_ms: match.searchLatencyMs,
          liveness: {
            status: liveness.status,
            liveness_score: liveness.livenessScore,
            is_live: liveness.isLive,
            spoof_suspected: liveness.spoofSuspected,
            reasons: liveness.reasons,
          },
          quality: quality.metrics,
          quality_valid: quality.isValid,
          quality_rejection: quality.rejectionReason,
          isConfirmed,
          confirmationFrames,
          requiredFrames,
          attendanceMarked,
          duplicateIgnored,
          camera_source: 'MOBILE_CAMERA',
        });
      }
    }

    const calcLatency = Math.round(performance.now() - startTime);

    // Update Mobile Camera Session Health
    db.updateMobileCameraHealth(session_id, {
      status: 'STREAMING',
      fps: fps || 24,
      latency_ms: latency_ms || calcLatency,
      orientation: orientation || 'landscape',
      incrementFrames: 1,
      incrementFaces: processedResults.length,
      incrementMarks: newMarksCount,
    });

    // Broadcast frame to live dashboard listeners
    const liveFrameData = {
      session_id,
      timestamp: Date.now(),
      preview_image,
      faces_count: processedResults.length,
      results: processedResults,
      fps: fps || 24,
      latency_ms: latency_ms || calcLatency,
      orientation: orientation || 'landscape',
    };
    mobileStreamManager.broadcastFrame(session_id, liveFrameData);

    // Get current attendance count for session
    const currentAttendance = db.getAttendance({ session_id, status: 'PRESENT' });

    res.json({
      success: true,
      faces_count: processedResults.length,
      new_marks_count: newMarksCount,
      total_present_count: currentAttendance.length,
      results: processedResults,
      latency_ms: calcLatency,
    });
  } catch (err: any) {
    console.error('Mobile frame process error:', err);
    res.status(500).json({ success: false, message: err.message || 'Frame processing error.' });
  }
});

// POST /api/mobile/heartbeat
router.post('/heartbeat', (req, res) => {
  const { session_id, fps, latency_ms, orientation } = req.body;
  if (session_id) {
    db.updateMobileCameraHealth(session_id, {
      status: 'STREAMING',
      fps,
      latency_ms,
      orientation,
    });
  }
  res.json({ success: true, timestamp: Date.now() });
});

// POST /api/mobile/disconnect
router.post('/disconnect', (req, res) => {
  const { session_id, code } = req.body;
  const lookup = session_id || code;
  if (lookup) {
    db.disconnectMobileCamera(lookup, 'USER_REQUEST');
  }
  res.json({ success: true, message: 'Disconnected successfully.' });
});

// GET /api/mobile/live-feed/:sessionId (SSE endpoint for real-time live monitoring)
router.get('/live-feed/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial frame if available
  const initialFrame = mobileStreamManager.getLatestFrame(sessionId);
  if (initialFrame) {
    sendEvent(initialFrame);
  }

  mobileStreamManager.subscribe(subId, sessionId, sendEvent);

  req.on('close', () => {
    mobileStreamManager.unsubscribe(subId);
  });
});

// GET /api/mobile/benchmark-vector-scale (Admin endpoint to benchmark 10,000 student vector search)
router.get('/benchmark-vector-scale', authenticateToken, (req, res) => {
  const user = (req as any).user;
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }

  const count = parseInt(req.query.count as string, 10) || 10000;
  const benchmark = globalVectorIndex.runScaleBenchmark(count);
  const stats = globalVectorIndex.getStats();

  res.json({
    success: true,
    benchmark,
    index_stats: stats,
  });
});

export default router;
