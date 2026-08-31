/**
 * SITS SmartAttend AI - WebRTC Real-Time Video Streaming Service
 * End-to-End PeerConnection and WebSocket Signaling
 */

export interface WebRTCConfig {
  iceServers?: RTCIceServer[];
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
];

export function getSignalingUrl(token: string, role: 'desktop' | 'mobile'): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/api/mobile/signaling?token=${encodeURIComponent(token)}&role=${role}`;
}

export type WebRTCConnectionState =
  | 'STANDBY'
  | 'CONNECTING_SIGNALING'
  | 'AWAITING_PHONE_SCAN'
  | 'PHONE_SCANNED'
  | 'REQUESTING_CAMERA'
  | 'CREATING_PEER_CONNECTION'
  | 'EXCHANGING_SDP'
  | 'CONNECTED'
  | 'STREAMING'
  | 'DISCONNECTED'
  | 'FAILED';

export interface WebRTCReceiverCallbacks {
  onStateChange: (state: WebRTCConnectionState, details?: string) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onPhoneScanned?: (data: any) => void;
  onCameraPermissionGranted?: () => void;
  onError: (error: string) => void;
}

export interface WebRTCSenderCallbacks {
  onStateChange: (state: WebRTCConnectionState, details?: string) => void;
  onConnected: () => void;
  onError: (error: string) => void;
}

/**
 * Desktop WebRTC Receiver Class (PeerConnection recipient of the phone's live camera stream)
 */
export class DesktopWebRTCReceiver {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private pairingToken: string;
  private sessionId: string;
  private callbacks: WebRTCReceiverCallbacks;
  private iceServers: RTCIceServer[];
  private queuedIceCandidates: RTCIceCandidateInit[] = [];
  private isRemoteDescriptionSet = false;
  private isDisposed = false;

  constructor(token: string, sessionId: string, callbacks: WebRTCReceiverCallbacks, iceServers?: RTCIceServer[]) {
    this.pairingToken = token;
    this.sessionId = sessionId;
    this.callbacks = callbacks;
    this.iceServers = iceServers && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS;
  }

  public start() {
    this.isDisposed = false;
    this.connectSignaling();
  }

  private connectSignaling() {
    try {
      this.callbacks.onStateChange('CONNECTING_SIGNALING', 'Connecting to WebRTC signaling server...');
      const url = getSignalingUrl(this.pairingToken, 'desktop');
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        if (this.isDisposed) return;
        this.callbacks.onStateChange('AWAITING_PHONE_SCAN', 'Waiting for smartphone QR scan...');
        this.ws?.send(JSON.stringify({
          type: 'REGISTER_DESKTOP',
          token: this.pairingToken,
          sessionId: this.sessionId,
        }));
      };

      this.ws.onmessage = async (event) => {
        if (this.isDisposed) return;
        try {
          const msg = JSON.parse(event.data);
          await this.handleSignalingMessage(msg);
        } catch (e: any) {
          console.error('[WebRTC Desktop] Error handling signaling message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[WebRTC Desktop] Signaling WebSocket error:', err);
      };

      this.ws.onclose = () => {
        if (!this.isDisposed) {
          this.callbacks.onStateChange('DISCONNECTED', 'Signaling disconnected');
        }
      };
    } catch (e: any) {
      this.callbacks.onError(e.message || 'Failed to initialize signaling connection');
    }
  }

  private async handleSignalingMessage(msg: any) {
    switch (msg.type) {
      case 'PHONE_SCANNED': {
        this.callbacks.onStateChange('PHONE_SCANNED', 'Smartphone scanned QR code! Requesting camera...');
        this.callbacks.onPhoneScanned?.(msg);
        break;
      }

      case 'CAMERA_PERMISSION_GRANTED': {
        this.callbacks.onStateChange('REQUESTING_CAMERA', 'Smartphone camera ready. Initiating peer connection...');
        this.callbacks.onCameraPermissionGranted?.();
        await this.initiatePeerConnectionAndOffer();
        break;
      }

      case 'ANSWER': {
        if (!this.pc) return;
        this.callbacks.onStateChange('EXCHANGING_SDP', 'Processing WebRTC answer from phone...');
        const remoteDesc = new RTCSessionDescription({ type: 'answer', sdp: msg.sdp });
        await this.pc.setRemoteDescription(remoteDesc);
        this.isRemoteDescriptionSet = true;

        // Flush any queued ICE candidates
        for (const candidate of this.queuedIceCandidates) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('[WebRTC Desktop] Error adding queued ICE candidate:', e);
          }
        }
        this.queuedIceCandidates = [];
        break;
      }

      case 'ICE_CANDIDATE': {
        if (msg.candidate) {
          if (this.pc && this.isRemoteDescriptionSet) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (e) {
              console.warn('[WebRTC Desktop] Error adding ICE candidate:', e);
            }
          } else {
            this.queuedIceCandidates.push(msg.candidate);
          }
        }
        break;
      }

      case 'PEER_DISCONNECTED': {
        this.callbacks.onStateChange('DISCONNECTED', 'Smartphone disconnected');
        this.cleanupPeerConnection();
        break;
      }

      case 'ERROR': {
        this.callbacks.onError(msg.message || 'Signaling error');
        break;
      }
    }
  }

  private async initiatePeerConnectionAndOffer() {
    try {
      this.cleanupPeerConnection();
      this.callbacks.onStateChange('CREATING_PEER_CONNECTION', 'Creating RTCPeerConnection...');

      this.pc = new RTCPeerConnection({
        iceServers: this.iceServers,
        iceCandidatePoolSize: 2,
      });

      this.isRemoteDescriptionSet = false;
      this.queuedIceCandidates = [];

      // We want to receive video (and optionally audio) from the mobile phone
      this.pc.addTransceiver('video', { direction: 'recvonly' });

      this.pc.ontrack = (event) => {
        console.log('[WebRTC Desktop] Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          this.callbacks.onRemoteStream(event.streams[0]);
          this.callbacks.onStateChange('STREAMING', 'Streaming live video from smartphone');
        }
      };

      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'ICE_CANDIDATE',
            candidate: event.candidate.toJSON(),
          }));
        }
      };

      this.pc.onconnectionstatechange = () => {
        if (!this.pc) return;
        console.log('[WebRTC Desktop] Connection state:', this.pc.connectionState);
        if (this.pc.connectionState === 'connected') {
          this.callbacks.onStateChange('CONNECTED', 'WebRTC Connected! Processing stream...');
        } else if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed') {
          this.callbacks.onStateChange('DISCONNECTED', 'WebRTC peer disconnected');
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        if (!this.pc) return;
        console.log('[WebRTC Desktop] ICE state:', this.pc.iceConnectionState);
        if (this.pc.iceConnectionState === 'connected' || this.pc.iceConnectionState === 'completed') {
          this.callbacks.onStateChange('STREAMING', 'Mobile classroom video feed active');
        }
      };

      const offer = await this.pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
      });

      await this.pc.setLocalDescription(offer);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'OFFER',
          sdp: offer.sdp,
        }));
      }
    } catch (err: any) {
      console.error('[WebRTC Desktop] Failed to create offer:', err);
      this.callbacks.onError(err.message || 'Failed to initiate WebRTC session');
    }
  }

  private cleanupPeerConnection() {
    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {
        // ignore
      }
      this.pc = null;
    }
    this.isRemoteDescriptionSet = false;
    this.queuedIceCandidates = [];
  }

  public dispose() {
    this.isDisposed = true;
    this.cleanupPeerConnection();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
  }
}

/**
 * Mobile WebRTC Sender Class (Smartphone camera publisher to desktop)
 */
export class MobileWebRTCSender {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private pairingToken: string;
  private localStream: MediaStream | null = null;
  private callbacks: WebRTCSenderCallbacks;
  private iceServers: RTCIceServer[];
  private queuedIceCandidates: RTCIceCandidateInit[] = [];
  private isRemoteDescriptionSet = false;
  private isDisposed = false;

  constructor(token: string, callbacks: WebRTCSenderCallbacks, iceServers?: RTCIceServer[]) {
    this.pairingToken = token;
    this.callbacks = callbacks;
    this.iceServers = iceServers && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS;
  }

  public async start(localStream: MediaStream, deviceInfo?: any) {
    this.localStream = localStream;
    this.isDisposed = false;
    this.connectSignaling(deviceInfo);
  }

  private connectSignaling(deviceInfo?: any) {
    try {
      this.callbacks.onStateChange('CONNECTING_SIGNALING', 'Connecting to classroom server...');
      const url = getSignalingUrl(this.pairingToken, 'mobile');
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        if (this.isDisposed) return;
        this.callbacks.onStateChange('PHONE_SCANNED', 'Connected to server. Verifying session...');

        // Register mobile client with token
        this.ws?.send(JSON.stringify({
          type: 'JOIN_MOBILE',
          token: this.pairingToken,
          deviceInfo: deviceInfo || {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
          },
        }));

        // Notify that camera is ready
        this.ws?.send(JSON.stringify({
          type: 'CAMERA_READY',
        }));
      };

      this.ws.onmessage = async (event) => {
        if (this.isDisposed) return;
        try {
          const msg = JSON.parse(event.data);
          await this.handleSignalingMessage(msg);
        } catch (e: any) {
          console.error('[WebRTC Mobile] Error handling message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[WebRTC Mobile] Signaling WebSocket error:', err);
      };

      this.ws.onclose = () => {
        if (!this.isDisposed) {
          this.callbacks.onStateChange('DISCONNECTED', 'Server disconnected');
        }
      };
    } catch (e: any) {
      this.callbacks.onError(e.message || 'Failed to connect signaling');
    }
  }

  private async handleSignalingMessage(msg: any) {
    switch (msg.type) {
      case 'OFFER': {
        this.callbacks.onStateChange('EXCHANGING_SDP', 'Received connection offer. Preparing answer...');
        await this.handleOfferAndCreateAnswer(msg.sdp);
        break;
      }

      case 'ICE_CANDIDATE': {
        if (msg.candidate) {
          if (this.pc && this.isRemoteDescriptionSet) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (e) {
              console.warn('[WebRTC Mobile] Error adding candidate:', e);
            }
          } else {
            this.queuedIceCandidates.push(msg.candidate);
          }
        }
        break;
      }

      case 'ERROR': {
        this.callbacks.onError(msg.message || 'Session error');
        break;
      }
    }
  }

  private async handleOfferAndCreateAnswer(sdp: string) {
    try {
      this.cleanupPeerConnection();

      this.pc = new RTCPeerConnection({
        iceServers: this.iceServers,
        iceCandidatePoolSize: 2,
      });

      this.isRemoteDescriptionSet = false;
      this.queuedIceCandidates = [];

      // Add local camera tracks to peer connection
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          this.pc?.addTrack(track, this.localStream!);
        });
      }

      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'ICE_CANDIDATE',
            candidate: event.candidate.toJSON(),
          }));
        }
      };

      this.pc.onconnectionstatechange = () => {
        if (!this.pc) return;
        console.log('[WebRTC Mobile] Connection state:', this.pc.connectionState);
        if (this.pc.connectionState === 'connected') {
          this.callbacks.onStateChange('STREAMING', 'Streaming live classroom video');
          this.callbacks.onConnected();
        } else if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed') {
          this.callbacks.onStateChange('DISCONNECTED', 'Desktop connection closed');
        }
      };

      const remoteOffer = new RTCSessionDescription({ type: 'offer', sdp });
      await this.pc.setRemoteDescription(remoteOffer);
      this.isRemoteDescriptionSet = true;

      // Process any queued candidates
      for (const candidate of this.queuedIceCandidates) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC Mobile] Error adding queued ICE candidate:', e);
        }
      }
      this.queuedIceCandidates = [];

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'ANSWER',
          sdp: answer.sdp,
        }));
      }
    } catch (err: any) {
      console.error('[WebRTC Mobile] Failed to handle offer:', err);
      this.callbacks.onError(err.message || 'Failed to answer WebRTC offer');
    }
  }

  private cleanupPeerConnection() {
    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {
        // ignore
      }
      this.pc = null;
    }
    this.isRemoteDescriptionSet = false;
    this.queuedIceCandidates = [];
  }

  public dispose() {
    this.isDisposed = true;
    this.cleanupPeerConnection();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
  }
}
