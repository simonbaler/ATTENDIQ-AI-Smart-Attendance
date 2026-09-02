import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initDb } from './server/db.js';
import authRouter from './server/routes/auth.js';
import studentsRouter from './server/routes/students.js';
import sessionsRouter from './server/routes/sessions.js';
import attendanceRouter from './server/routes/attendance.js';
import settingsRouter from './server/routes/settings.js';
import intelligenceRouter from './server/routes/intelligence.js';
import validationRouter from './server/routes/validation.js';
import mobileRouter from './server/routes/mobile.js';
import camerasRouter from './server/routes/cameras.js';
import devicesRouter from './server/routes/devices.js';
import { createSignalingServer } from './server/signaling.js';
import { createIoTGatewayServer } from './server/iotGateway.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Initialize Database & seed accounts
  await initDb();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);

  // Initialize WebSocket Servers with noServer mode
  const signalingWss = createSignalingServer();
  const iotWss = createIoTGatewayServer();

  // Dispatch HTTP upgrade events based on URL path
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);

    if (pathname.startsWith('/api/mobile/signaling')) {
      signalingWss.handleUpgrade(request, socket, head, (ws) => {
        signalingWss.emit('connection', ws, request);
      });
    } else if (
      pathname.startsWith('/api/devices/ws') ||
      pathname.startsWith('/api/devices/stream') ||
      pathname.startsWith('/api/iot')
    ) {
      iotWss.handleUpgrade(request, socket, head, (ws) => {
        iotWss.emit('connection', ws, request);
      });
    } else {
      // Let Vite HMR or other handlers take over if in dev mode, or destroy socket
      if (process.env.NODE_ENV === 'production') {
        socket.destroy();
      }
    }
  });

  // CORS middleware for public mobile pairing and API access
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // JSON Body parser (50MB for multi-image face captures)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Static storage for captured student photos
  app.use('/data/students', express.static(path.join(process.cwd(), 'data', 'students')));

  // Health check endpoint (public, unauthenticated)
  app.get(['/health', '/api/health'], (req, res) => {
    res.status(200).json({
      status: 'ok',
      system: 'ATTENDIQ AI — Smart Vision Attendance',
      institution: 'Siddhartha Institute of Technology and Sciences',
      public_origin: process.env.APP_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://ais-pre-bpayzufx5syjwygztm4y7l-460380840568.asia-southeast1.run.app',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/reports/attendance', attendanceRouter);
  app.use('/api/validation', validationRouter);
  app.use('/api/system', validationRouter);
  app.use('/api/mobile', mobileRouter);
  app.use('/api/cameras', camerasRouter);
  app.use('/api/devices', devicesRouter);
  app.use('/api', intelligenceRouter);
  app.use('/api', settingsRouter);

  // Dedicated unauthenticated mobile pairing route (returns HTML without Google login or auth barriers)
  app.get(['/mobile/pair/:token', '/pair/:token', '/mobile/pair', '/mobile'], (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
      const distPath = path.join(process.cwd(), 'dist');
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    // In development mode, hand off to Vite middleware
    next();
  });

  // Vite middleware for development or Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SITS SmartAttend AI] Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SITS SmartAttend AI] Failed to start server:', err);
  process.exit(1);
});

