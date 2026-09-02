import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { db } from './db.js';

interface SignalingClient {
  ws: WebSocket;
  role: 'desktop' | 'mobile';
  pairingToken: string;
  sessionId: string;
}

// In-memory registry of active signaling peers
const peers: Map<WebSocket, SignalingClient> = new Map();

export function createSignalingServer(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  console.log('[SITS AI] WebRTC WebSocket Signaling Server initialized');

  wss.on('connection', (ws: WebSocket, req) => {
    // Determine client connection URL
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const tokenFromUrl = url.searchParams.get('token');
    const roleFromUrl = url.searchParams.get('role') as 'desktop' | 'mobile' | null;

    ws.on('message', (messageRaw: string) => {
      try {
        const message = JSON.parse(messageRaw.toString());
        const { type } = message;

        switch (type) {
          case 'REGISTER_DESKTOP': {
            const { token, sessionId } = message;
            if (!token) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Pairing token is required for registration.' }));
              return;
            }

            peers.set(ws, {
              ws,
              role: 'desktop',
              pairingToken: token,
              sessionId: sessionId || '',
            });

            ws.send(JSON.stringify({
              type: 'DESKTOP_REGISTERED',
              pairingToken: token,
              status: 'AWAITING_MOBILE_SCAN',
            }));

            // Check if mobile peer is already waiting
            for (const [otherWs, client] of peers.entries()) {
              if (client.role === 'mobile' && client.pairingToken === token && otherWs.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'PHONE_SCANNED', token }));
                break;
              }
            }
            break;
          }

          case 'JOIN_MOBILE': {
            const { token, deviceInfo } = message;
            if (!token) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Pairing token is required.' }));
              return;
            }

            // Validate pairing session in database
            const validateRes = db.connectMobileCamera(token, deviceInfo);
            if (!validateRes.success || !validateRes.session) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: validateRes.error || 'Pairing token is invalid or expired. Please generate a new QR.',
              }));
              return;
            }

            peers.set(ws, {
              ws,
              role: 'mobile',
              pairingToken: token,
              sessionId: validateRes.session.attendance_session_id,
            });

            ws.send(JSON.stringify({
              type: 'MOBILE_JOINED',
              session: validateRes.session,
              sessionDetails: validateRes.session.session_details,
            }));

            // Notify connected desktop peer
            let desktopFound = false;
            for (const [otherWs, client] of peers.entries()) {
              if (client.role === 'desktop' && client.pairingToken === token && otherWs.readyState === WebSocket.OPEN) {
                desktopFound = true;
                otherWs.send(JSON.stringify({
                  type: 'PHONE_SCANNED',
                  token,
                  session: validateRes.session,
                  deviceInfo,
                }));
              }
            }

            if (!desktopFound) {
              console.log(`[Signaling] Mobile joined with token ${token.slice(0, 8)}... (desktop not yet registered)`);
            }
            break;
          }

          case 'CAMERA_READY': {
            const client = peers.get(ws);
            if (!client || client.role !== 'mobile') return;

            // Notify desktop that mobile has acquired camera permissions
            for (const [otherWs, peer] of peers.entries()) {
              if (peer.role === 'desktop' && peer.pairingToken === client.pairingToken && otherWs.readyState === WebSocket.OPEN) {
                otherWs.send(JSON.stringify({
                  type: 'CAMERA_PERMISSION_GRANTED',
                  token: client.pairingToken,
                }));
              }
            }
            break;
          }

          case 'OFFER': {
            const client = peers.get(ws);
            if (!client) return;

            const { sdp } = message;
            // Relay OFFER from Desktop to Mobile
            for (const [otherWs, peer] of peers.entries()) {
              if (peer.role === 'mobile' && peer.pairingToken === client.pairingToken && otherWs.readyState === WebSocket.OPEN) {
                otherWs.send(JSON.stringify({
                  type: 'OFFER',
                  sdp,
                  token: client.pairingToken,
                }));
              }
            }
            break;
          }

          case 'ANSWER': {
            const client = peers.get(ws);
            if (!client) return;

            const { sdp } = message;
            // Relay ANSWER from Mobile to Desktop
            for (const [otherWs, peer] of peers.entries()) {
              if (peer.role === 'desktop' && peer.pairingToken === client.pairingToken && otherWs.readyState === WebSocket.OPEN) {
                otherWs.send(JSON.stringify({
                  type: 'ANSWER',
                  sdp,
                  token: client.pairingToken,
                }));
              }
            }
            break;
          }

          case 'ICE_CANDIDATE': {
            const client = peers.get(ws);
            if (!client) return;

            const { candidate } = message;
            const targetRole = client.role === 'desktop' ? 'mobile' : 'desktop';

            // Relay ICE candidate to the opposite peer
            for (const [otherWs, peer] of peers.entries()) {
              if (peer.role === targetRole && peer.pairingToken === client.pairingToken && otherWs.readyState === WebSocket.OPEN) {
                otherWs.send(JSON.stringify({
                  type: 'ICE_CANDIDATE',
                  candidate,
                  token: client.pairingToken,
                }));
              }
            }
            break;
          }

          case 'DISCONNECT': {
            const client = peers.get(ws);
            if (client) {
              handlePeerDisconnect(ws, client);
            }
            break;
          }

          default:
            console.warn('[Signaling] Unknown message type:', type);
        }
      } catch (err: any) {
        console.error('[Signaling] Message parse error:', err);
      }
    });

    ws.on('close', () => {
      const client = peers.get(ws);
      if (client) {
        handlePeerDisconnect(ws, client);
      }
    });

    ws.on('error', (err) => {
      console.error('[Signaling] WebSocket error:', err);
    });

    // If token and role provided in query param on connection, auto-initiate
    if (tokenFromUrl && roleFromUrl) {
      if (roleFromUrl === 'desktop') {
        peers.set(ws, { ws, role: 'desktop', pairingToken: tokenFromUrl, sessionId: '' });
      }
    }
  });

  function handlePeerDisconnect(ws: WebSocket, client: SignalingClient) {
    peers.delete(ws);
    const targetRole = client.role === 'desktop' ? 'mobile' : 'desktop';

    for (const [otherWs, peer] of peers.entries()) {
      if (peer.role === targetRole && peer.pairingToken === client.pairingToken && otherWs.readyState === WebSocket.OPEN) {
        otherWs.send(JSON.stringify({
          type: 'PEER_DISCONNECTED',
          role: client.role,
          token: client.pairingToken,
        }));
      }
    }

    if (client.role === 'mobile' && client.sessionId) {
      db.disconnectMobileCamera(client.sessionId, 'MOBILE_CLIENT_DISCONNECTED');
    }
  }

  return wss;
}

export function setupSignalingServer(httpServer: HttpServer) {
  return createSignalingServer();
}
