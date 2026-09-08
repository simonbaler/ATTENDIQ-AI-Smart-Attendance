import { Router, Request, Response } from 'express';
import { eventBus, CampusEvent, CampusEventType } from '../eventBus';
import { authenticateToken } from './auth';

const router = Router();

// SSE Stream for Real-time Campus Event Bus (Phase 32)
router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString(), status: 'STREAMING' })}\n\n`);

  // Send recent backlog so connecting client has immediate context
  const recent = eventBus.getRecentEvents(20);
  for (const evt of recent.reverse()) {
    res.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
  }

  // Listener for new campus events
  const onEvent = (evt: CampusEvent) => {
    res.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
  };

  eventBus.on('campus_event', onEvent);

  // Keep-alive heartbeat ping every 15s to prevent cloud proxy timeouts
  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('campus_event', onEvent);
    res.end();
  });
});

// Query recent events buffer
router.get('/recent', authenticateToken, (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const type = req.query.type as CampusEventType | undefined;
  const events = eventBus.getRecentEvents(limit, type);
  res.json({ success: true, count: events.length, events });
});

// Publish a custom verified event into the bus (e.g. from vision worker or IoT sensor)
router.post('/publish', authenticateToken, (req: Request, res: Response) => {
  const { type, source, classroom, sessionId, payload } = req.body;
  if (!type || !source) {
    return res.status(400).json({ success: false, message: 'Type and source are required for campus events.' });
  }

  const event = eventBus.publish(type, {
    source,
    classroom,
    sessionId,
    payload: payload || {},
  });

  res.json({ success: true, event });
});

export default router;
