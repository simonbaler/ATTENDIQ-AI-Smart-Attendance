import express from 'express';
import fs from 'fs';
import path from 'path';
import { db, SecurityEvent, SecurityEventType } from './db.js';
import { broadcastSecurityThreat } from './iotGateway.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const JAILED_IPS_FILE = path.join(DATA_DIR, 'jailed_ips.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface GeoLocation {
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  isp?: string;
  latitude?: number;
  longitude?: number;
  flag?: string;
}

export interface JailedRecord {
  ip: string;
  reason: string;
  attack_vector: string;
  jailed_at: string;
  expires_at: string;
  attack_count: number;
  location?: GeoLocation;
  last_attempt?: string;
  user_agent?: string;
}

// In-memory Geo Cache
const geoCache = new Map<string, GeoLocation>();

// Load persisted jailed IPs
function loadJailedIps(): Map<string, JailedRecord> {
  const map = new Map<string, JailedRecord>();
  try {
    if (fs.existsSync(JAILED_IPS_FILE)) {
      const data = JSON.parse(fs.readFileSync(JAILED_IPS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        const now = Date.now();
        for (const item of data) {
          if (new Date(item.expires_at).getTime() > now) {
            map.set(item.ip, item);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Cyber Defense] Failed to load jailed IPs:', err);
  }
  return map;
}

function saveJailedIps(map: Map<string, JailedRecord>) {
  try {
    const list = Array.from(map.values());
    fs.writeFileSync(JAILED_IPS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Cyber Defense] Failed to save jailed IPs:', err);
  }
}

const jailedIpsMap = loadJailedIps();

// Client IP resolver
export function getClientIp(req: express.Request): string {
  const cfIp = req.headers['cf-connecting-ip'] as string;
  if (cfIp) return cfIp.trim();
  const xRealIp = req.headers['x-real-ip'] as string;
  if (xRealIp) return xRealIp.trim();
  const xForwarded = req.headers['x-forwarded-for'] as string;
  if (xForwarded) {
    const first = xForwarded.split(',')[0].trim();
    if (first) return first;
  }
  const socketIp = req.socket?.remoteAddress;
  if (socketIp) {
    return socketIp.replace(/^::ffff:/, '').trim();
  }
  return (req.ip || '127.0.0.1').replace(/^::ffff:/, '').trim();
}

// Check private / local campus network IP
export function isPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/, '').trim();
  return (
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'localhost' ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean) ||
    clean.startsWith('fc00:') ||
    clean.startsWith('fe80:')
  );
}

// Country code to flag emoji
function countryCodeToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Geolocation Resolver
export async function resolveGeoLocation(ip: string): Promise<GeoLocation> {
  const cleanIp = ip.replace(/^::ffff:/, '').trim();

  if (geoCache.has(cleanIp)) {
    return geoCache.get(cleanIp)!;
  }

  // Institutional campus intranet
  if (isPrivateIp(cleanIp)) {
    const campusLoc: GeoLocation = {
      city: 'Hyderabad',
      region: 'Telangana',
      country: 'India',
      country_code: 'IN',
      isp: 'Siddhartha Institute Campus Intranet (SITS)',
      latitude: 17.385,
      longitude: 78.4867,
      flag: '🇮🇳',
    };
    geoCache.set(cleanIp, campusLoc);
    return campusLoc;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,message,country,countryCode,regionName,city,lat,lon,isp`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.status === 'success') {
        const geo: GeoLocation = {
          city: data.city || 'Unknown City',
          region: data.regionName || '',
          country: data.country || 'Global Network',
          country_code: data.countryCode || 'GL',
          isp: data.isp || 'External ISP',
          latitude: data.lat,
          longitude: data.lon,
          flag: countryCodeToFlag(data.countryCode || 'GL'),
        };
        geoCache.set(cleanIp, geo);
        return geo;
      }
    }
  } catch (err) {
    // Fallback if offline / query blocked
  }

  const fallback: GeoLocation = {
    city: 'External Network',
    region: 'WAN',
    country: 'Remote Host',
    country_code: 'UN',
    isp: `IP: ${cleanIp}`,
    latitude: 20.5937,
    longitude: 78.9629,
    flag: '🌐',
  };
  geoCache.set(cleanIp, fallback);
  return fallback;
}

// Threat signatures
const SQLI_PATTERNS = [
  /(\b(union\s+all\s+select|union\s+select)\b)/i,
  /(\b(select|insert|update|delete|drop|alter|create|truncate)\s+.*\bfrom\b)/i,
  /(;\s*(drop|delete|truncate|alter|create)\s+table\b)/i,
  /(\b(or|and)\s+[\'\"0-9a-zA-Z]+\s*=\s*[\'\"0-9a-zA-Z]+)/i,
  /(\b(sleep|benchmark|waitfor\s+delay)\s*\(\s*\d+\s*\))/i,
  /(\'|\")\s*(or|and)\s*(\'|\"|\d)/i,
  /(\bexec\s*\(.*\bxp_)/i,
  /(--|\#|\/\*|\*\/)/,
];

const XSS_PATTERNS = [
  /<\s*script\b[^>]*>([\s\S]*?)<\s*\/\s*script\s*>/i,
  /<\s*script\b[^>]*>/i,
  /javascript\s*:\s*[a-zA-Z0-9_\$]/i,
  /\bon(load|error|click|mouseover|submit|focus|blur|change|input)\s*=/i,
  /\bdocument\.(cookie|location|write)\b/i,
  /\b(eval|alert|prompt|confirm)\s*\(\s*[\'\"]/i,
];

const PATH_TRAVERSAL_PATTERNS = [
  /((\.\.[\/\\])+)/,
  /(%2e%2e[\/\\])/i,
  /(\/etc\/(passwd|shadow|group|hosts))/i,
  /(\b(c:\\|d:\\)windows\b)/i,
  /(\b(win\.ini|boot\.ini)\b)/i,
];

const COMMAND_INJECTION_PATTERNS = [
  /(;\s*(cat|rm|ls|chmod|chown|wget|curl|nc|ncat|bash|sh|powershell|cmd)\s+)/i,
  /(\|\s*(cat|rm|ls|chmod|wget|curl|bash|sh|powershell)\s+)/i,
  /(\$\(\s*(whoami|id|cat|uname|ls)\s*\))/i,
  /(`\s*(whoami|id|cat|uname|ls)\s*`)/i,
  /(&&\s*(cat|rm|curl|wget|bash|sh)\s+)/i,
];

const SCANNER_PROBES = [
  /\/\.env(\.|$)/i,
  /\/\.git(\/|$)/i,
  /\/wp-(login|admin|content)\b/i,
  /\/phpmyadmin\b/i,
  /\/shell\.(php|asp|aspx|jsp)/i,
  /\/actuator(\/|$)/i,
  /\/cgi-bin\//i,
];

const SUSPICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /acunetix/i,
  /dirbuster/i,
  /gobuster/i,
  /masscan/i,
  /wpscan/i,
  /nmap/i,
  /havij/i,
];

// In-memory rate limiting buckets: ip -> { count, resetAt }
interface RateBucket {
  count: number;
  resetAt: number;
}
const rateBuckets = new Map<string, RateBucket>();
const authRateBuckets = new Map<string, RateBucket>();

// Deep recursive object string scanning (ignoring facial descriptors & large base64 to avoid false alarms)
function inspectPayload(val: any, depth = 0): { detected: boolean; vector?: SecurityEventType; sample?: string } {
  if (!val || depth > 5) return { detected: false };

  if (typeof val === 'string') {
    // Skip if base64 image or large embeddings
    if (val.startsWith('data:image/') || val.length > 5000) {
      return { detected: false };
    }

    // Check SQLi
    for (const pat of SQLI_PATTERNS) {
      if (pat.test(val)) {
        return { detected: true, vector: 'SQLI_PROBE', sample: val.substring(0, 100) };
      }
    }

    // Check XSS
    for (const pat of XSS_PATTERNS) {
      if (pat.test(val)) {
        return { detected: true, vector: 'XSS_INJECTION', sample: val.substring(0, 100) };
      }
    }

    // Check Path Traversal
    for (const pat of PATH_TRAVERSAL_PATTERNS) {
      if (pat.test(val)) {
        return { detected: true, vector: 'PATH_TRAVERSAL', sample: val.substring(0, 100) };
      }
    }

    // Check Command Injection
    for (const pat of COMMAND_INJECTION_PATTERNS) {
      if (pat.test(val)) {
        return { detected: true, vector: 'COMMAND_INJECTION', sample: val.substring(0, 100) };
      }
    }

    return { detected: false };
  }

  if (Array.isArray(val)) {
    // If it's a numeric vector (like 128-d face descriptor), skip
    if (val.length > 10 && typeof val[0] === 'number') {
      return { detected: false };
    }
    for (const item of val) {
      const res = inspectPayload(item, depth + 1);
      if (res.detected) return res;
    }
    return { detected: false };
  }

  if (typeof val === 'object') {
    for (const [k, v] of Object.entries(val)) {
      // Skip known binary / descriptor fields
      if (k === 'face_descriptor' || k === 'photos' || k === 'images' || k === 'face_features' || k === 'embedding') {
        continue;
      }
      const res = inspectPayload(v, depth + 1);
      if (res.detected) return res;
    }
  }

  return { detected: false };
}

// IP Jailing Management
export const CyberDefense = {
  isJailed(ip: string): boolean {
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    const rec = jailedIpsMap.get(cleanIp);
    if (!rec) return false;
    if (new Date(rec.expires_at).getTime() <= Date.now()) {
      jailedIpsMap.delete(cleanIp);
      saveJailedIps(jailedIpsMap);
      return false;
    }
    return true;
  },

  getJailedRecord(ip: string): JailedRecord | undefined {
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    return jailedIpsMap.get(cleanIp);
  },

  async jailIp(
    ip: string,
    reason: string,
    attackVector: string,
    durationMs = 30 * 60 * 1000,
    userAgent?: string
  ): Promise<JailedRecord> {
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    const existing = jailedIpsMap.get(cleanIp);
    const now = new Date();
    const expires = new Date(now.getTime() + durationMs);

    const location = await resolveGeoLocation(cleanIp);

    const record: JailedRecord = {
      ip: cleanIp,
      reason,
      attack_vector: attackVector,
      jailed_at: now.toISOString(),
      expires_at: expires.toISOString(),
      attack_count: (existing?.attack_count || 0) + 1,
      location,
      last_attempt: now.toISOString(),
      user_agent: userAgent || existing?.user_agent,
    };

    jailedIpsMap.set(cleanIp, record);
    saveJailedIps(jailedIpsMap);

    // Log security event
    const event = db.logSecurityEvent({
      event_type: 'IP_JAILED',
      severity: 'CRITICAL',
      details: `[SHIELD ACTION] Quarantined IP ${cleanIp} (${location.city}, ${location.country}) for 30m. Reason: ${reason}. Total attempts: ${record.attack_count}.`,
      ip_address: cleanIp,
      location,
      user_agent: userAgent,
      attack_payload: attackVector,
      blocked: true,
      jail_status: 'JAILED',
    });

    broadcastSecurityThreat(event);

    return record;
  },

  unjailIp(ip: string): boolean {
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    if (jailedIpsMap.has(cleanIp)) {
      jailedIpsMap.delete(cleanIp);
      saveJailedIps(jailedIpsMap);

      db.logSecurityEvent({
        event_type: 'UNAUTHORIZED_ACCESS',
        severity: 'LOW',
        details: `Administrator manually released IP ${cleanIp} from quarantine jail.`,
        ip_address: cleanIp,
        blocked: false,
        jail_status: 'RELEASED',
      });

      return true;
    }
    return false;
  },

  getJailedList(): JailedRecord[] {
    const now = Date.now();
    const valid: JailedRecord[] = [];
    for (const [ip, rec] of jailedIpsMap.entries()) {
      if (new Date(rec.expires_at).getTime() > now) {
        valid.push(rec);
      } else {
        jailedIpsMap.delete(ip);
      }
    }
    return valid;
  },

  clearAllJailed(): void {
    jailedIpsMap.clear();
    saveJailedIps(jailedIpsMap);
  },
};

// Global Cyber Shield Middleware
export const cyberDefenseMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const clientIp = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || '';
  const pathname = req.path;

  // 1. Production Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Skip static assets
  if (
    pathname.startsWith('/@') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.woff2')
  ) {
    return next();
  }

  // 2. Check if IP is currently quarantined in jail
  if (CyberDefense.isJailed(clientIp)) {
    const rec = CyberDefense.getJailedRecord(clientIp);
    const loc = rec?.location || (await resolveGeoLocation(clientIp));

    // Refresh last attempt timestamp
    if (rec) {
      rec.last_attempt = new Date().toISOString();
      rec.attack_count += 1;
    }

    return res.status(403).json({
      success: false,
      code: 'IP_QUARANTINED',
      message: 'Access Denied: Your IP has been quarantined by SITS ATTENDIQ Cyber Defense System due to security policy violations.',
      quarantine_info: {
        ip: clientIp,
        location: `${loc.city || 'Unknown'}, ${loc.country || 'Unknown'} ${loc.flag || '🌐'}`,
        expires_at: rec?.expires_at,
        reason: rec?.reason,
      },
    });
  }

  // 3. Inspect malicious scanners and probe paths
  for (const pat of SCANNER_PROBES) {
    if (pat.test(pathname)) {
      const loc = await resolveGeoLocation(clientIp);
      await CyberDefense.jailIp(clientIp, `Vulnerability scanner target probed: ${pathname}`, 'EXPLOIT_SCANNER', 45 * 60 * 1000, userAgent);

      return res.status(403).json({
        success: false,
        code: 'PROBE_BLOCKED',
        message: 'Malicious probe detected and blocked.',
      });
    }
  }

  // Inspect suspicious scanner User-Agents
  for (const pat of SUSPICIOUS_USER_AGENTS) {
    if (pat.test(userAgent)) {
      const loc = await resolveGeoLocation(clientIp);
      await CyberDefense.jailIp(clientIp, `Automated attack tool / scanner User-Agent: ${userAgent}`, 'EXPLOIT_SCANNER', 60 * 60 * 1000, userAgent);

      return res.status(403).json({
        success: false,
        code: 'SCANNER_BLOCKED',
        message: 'Security Scanner signature detected and blocked.',
      });
    }
  }

  // 4. Rate Limiting Check
  const now = Date.now();
  const isAuthRoute = pathname.startsWith('/api/auth/login');
  const targetBucketMap = isAuthRoute ? authRateBuckets : rateBuckets;
  const maxLimit = isAuthRoute ? 12 : 250; // max reqs per minute
  const windowMs = 60 * 1000;

  let bucket = targetBucketMap.get(clientIp);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 1, resetAt: now + windowMs };
    targetBucketMap.set(clientIp, bucket);
  } else {
    bucket.count += 1;
    if (bucket.count > maxLimit) {
      const loc = await resolveGeoLocation(clientIp);
      await CyberDefense.jailIp(
        clientIp,
        `Rate limit exceeded: ${bucket.count} requests in 60s (${isAuthRoute ? 'Brute-force login probe' : 'API flood attack'})`,
        'BRUTE_FORCE',
        15 * 60 * 1000,
        userAgent
      );

      return res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Defense shield has temporarily quarantined your IP.',
      });
    }
  }

  // 5. Inspect Query Parameters
  const queryResult = inspectPayload(req.query);
  if (queryResult.detected) {
    const loc = await resolveGeoLocation(clientIp);
    const event = db.logSecurityEvent({
      event_type: queryResult.vector || 'INTRUSION_ATTEMPT',
      severity: 'CRITICAL',
      details: `[INTRUSION BLOCKED] Malicious ${queryResult.vector} pattern in query params on ${req.method} ${pathname}. Target: ${queryResult.sample}`,
      ip_address: clientIp,
      location: loc,
      user_agent: userAgent,
      target_endpoint: `${req.method} ${pathname}`,
      attack_payload: queryResult.sample,
      blocked: true,
      jail_status: 'JAILED',
    });

    await CyberDefense.jailIp(clientIp, `Active ${queryResult.vector} attack in query parameter`, queryResult.vector || 'SQLI_PROBE', 30 * 60 * 1000, userAgent);

    return res.status(403).json({
      success: false,
      code: 'ATTACK_INTERCEPTED',
      message: 'Malicious payload detected and blocked by SITS ATTENDIQ Cyber Defense Guard.',
      threat: {
        type: queryResult.vector,
        target_endpoint: `${req.method} ${pathname}`,
        action: 'BLOCKED_AND_IP_JAILED',
        origin: `${loc.city}, ${loc.country} ${loc.flag}`,
      },
    });
  }

  // 6. Inspect Request Body (for POST, PUT, PATCH)
  if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    const bodyResult = inspectPayload(req.body);
    if (bodyResult.detected) {
      const loc = await resolveGeoLocation(clientIp);
      const event = db.logSecurityEvent({
        event_type: bodyResult.vector || 'INTRUSION_ATTEMPT',
        severity: 'CRITICAL',
        details: `[INTRUSION BLOCKED] Malicious ${bodyResult.vector} pattern in request payload on ${req.method} ${pathname}. Snippet: ${bodyResult.sample}`,
        ip_address: clientIp,
        location: loc,
        user_agent: userAgent,
        target_endpoint: `${req.method} ${pathname}`,
        attack_payload: bodyResult.sample,
        blocked: true,
        jail_status: 'JAILED',
      });

      await CyberDefense.jailIp(clientIp, `Active ${bodyResult.vector} in request payload`, bodyResult.vector || 'INTRUSION_ATTEMPT', 30 * 60 * 1000, userAgent);

      return res.status(403).json({
        success: false,
        code: 'ATTACK_INTERCEPTED',
        message: 'Malicious payload detected and blocked by SITS ATTENDIQ Cyber Defense Guard.',
        threat: {
          type: bodyResult.vector,
          target_endpoint: `${req.method} ${pathname}`,
          action: 'BLOCKED_AND_IP_JAILED',
          origin: `${loc.city}, ${loc.country} ${loc.flag}`,
        },
      });
    }
  }

  next();
};
