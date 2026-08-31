import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Activity,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Radio,
  Wifi,
  WifiOff,
  Video,
} from 'lucide-react';
import { api } from '../services/api';
import { MobileCameraSession } from '../types';
import { MobileWebRTCSender, WebRTCConnectionState } from '../services/webrtc';

export const MobileCameraView: React.FC = () => {
  // Extract token from query param or pathname
  const getTokenFromUrl = (): string => {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get('token') || params.get('code');
    if (queryToken) return queryToken;

    const pathname = window.location.pathname;
    const match = pathname.match(/\/(?:mobile\/)?pair\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return match[1];

    return '';
  };

  const [token, setToken] = useState<string>(getTokenFromUrl);
  const [session, setSession] = useState<MobileCameraSession | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [iceServers, setIceServers] = useState<RTCIceServer[] | undefined>(undefined);

  // WebRTC & Camera States
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState<boolean>(false);
  const [cameraRequesting, setCameraRequesting] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [connectionState, setConnectionState] = useState<WebRTCConnectionState>('STANDBY');
  const [statusMessage, setStatusMessage] = useState<string>('Validating pairing token...');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const webrtcSenderRef = useRef<MobileWebRTCSender | null>(null);

  // 1. Automatically Validate Pairing Token on Mount
  const validateToken = useCallback(async (tokenToValidate: string) => {
    if (!tokenToValidate) {
      setIsValidating(false);
      setValidationError('No pairing token provided. Please scan the QR code from the ATTENDIQ AI dashboard.');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setStatusMessage('Validating pairing token with ATTENDIQ AI...');

    try {
      const res = await api.validateMobilePairing(tokenToValidate, {
        userAgent: navigator.userAgent,
        platform: navigator.platform || 'Mobile Device',
      });

      if (res.success && res.session) {
        setSession(res.session);
        setSessionDetails(res.session_details || res.session.session_details);
        if (res.iceServers) setIceServers(res.iceServers);
        setStatusMessage('Phone detected! Ready to start camera stream.');
      } else {
        setValidationError(res.message || 'Pairing token has expired or is invalid. Please generate a new QR code from the desktop.');
      }
    } catch (err: any) {
      setValidationError(err.message || 'Failed to validate token. Please ensure your device is connected to the network.');
    } finally {
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    const currentToken = getTokenFromUrl();
    if (currentToken) {
      setToken(currentToken);
      validateToken(currentToken);
    } else {
      setIsValidating(false);
      setValidationError('No pairing token detected. Please scan the QR code displayed on the ATTENDIQ AI dashboard.');
    }
  }, [validateToken]);

  // 2. Request Camera & Start WebRTC Stream
  const handleStartCameraAndStream = async () => {
    if (!token) return;
    setCameraRequesting(true);
    setCameraError(null);
    setStatusMessage('Requesting camera access...');

    try {
      // Stop existing stream if any
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }

      let stream: MediaStream;
      try {
        // Try with ideal constraints first
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
      } catch (err) {
        // Fallback to basic video constraint
        console.warn('Fallback to basic video constraint:', err);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      localStreamRef.current = stream;
      setCameraPermissionGranted(true);

      // Attach stream to local preview video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }

      // Initialize WebRTC Sender
      if (webrtcSenderRef.current) {
        webrtcSenderRef.current.dispose();
      }

      const sender = new MobileWebRTCSender(
        token,
        {
          onStateChange: (state, details) => {
            setConnectionState(state);
            if (details) setStatusMessage(details);
          },
          onConnected: () => {
            setStatusMessage('Streaming live video to ATTENDIQ AI');
          },
          onError: (error) => {
            setCameraError(error);
          },
        },
        iceServers
      );

      webrtcSenderRef.current = sender;
      await sender.start(stream, {
        userAgent: navigator.userAgent,
        platform: navigator.platform || 'Mobile Device',
        cameraFacing: facingMode,
        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
      });
    } catch (err: any) {
      console.error('Camera permission/startup error:', err);
      setCameraError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera permission was denied. Please allow camera access in your browser settings to continue.'
          : `Camera error: ${err.message || 'Unable to access camera.'}`
      );
    } finally {
      setCameraRequesting(false);
    }
  };

  // Switch facing mode (Front/Back)
  const toggleFacingMode = async () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);

    if (cameraPermissionGranted) {
      // Re-trigger camera with new facing mode
      try {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: newFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        localStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }

        // Restart WebRTC sender with new stream
        if (webrtcSenderRef.current) {
          webrtcSenderRef.current.dispose();
        }

        const sender = new MobileWebRTCSender(
          token,
          {
            onStateChange: (state, details) => {
              setConnectionState(state);
              if (details) setStatusMessage(details);
            },
            onConnected: () => {
              setStatusMessage('Streaming live video to ATTENDIQ AI');
            },
            onError: (error) => {
              setCameraError(error);
            },
          },
          iceServers
        );

        webrtcSenderRef.current = sender;
        await sender.start(stream);
      } catch (e: any) {
        console.error('Failed to switch camera:', e);
      }
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (webrtcSenderRef.current) {
        webrtcSenderRef.current.dispose();
      }
    };
  }, []);

  // Disconnect stream
  const handleDisconnect = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (webrtcSenderRef.current) {
      webrtcSenderRef.current.dispose();
      webrtcSenderRef.current = null;
    }
    setCameraPermissionGranted(false);
    setConnectionState('DISCONNECTED');
    setStatusMessage('Mobile camera stream stopped.');
  };

  // 1. Loading / Validation Screen
  if (isValidating) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 animate-pulse">
          <Smartphone className="w-7 h-7" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-base font-bold">Connecting to ATTENDIQ AI</h2>
          <p className="text-xs text-slate-400 flex items-center justify-center space-x-2 font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
            <span>{statusMessage}</span>
          </p>
        </div>
      </div>
    );
  }

  // 2. Error / Expired Screen
  if (validationError) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-bold text-white">Pairing Link Invalid or Expired</h2>
            <p className="text-xs text-slate-400 leading-relaxed">{validationError}</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 text-left space-y-1">
            <p className="font-semibold text-slate-300">How to reconnect:</p>
            <p>1. Open the ATTENDIQ AI Dashboard on your computer.</p>
            <p>2. Click <strong>Mobile Camera</strong> or <strong>Pair Phone</strong>.</p>
            <p>3. Scan the fresh QR code generated on screen.</p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Ready to Stream / Enable Camera Screen (if camera not yet granted)
  if (!cameraPermissionGranted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">
              AI
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">ATTENDIQ AI</h1>
              <p className="text-[11px] text-purple-400 font-mono">Classroom Camera Node</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full text-emerald-400 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Phone Detected</span>
          </div>
        </header>

        {/* Pairing Confirmation Card */}
        <main className="max-w-md w-full mx-auto my-auto space-y-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Ready to Connect</h2>
                <p className="text-xs text-slate-400">Automatic WebRTC pairing established</p>
              </div>
            </div>

            {/* Session Metadata */}
            {sessionDetails && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Classroom:</span>
                  <span className="font-bold text-white">{sessionDetails.classroom}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Subject:</span>
                  <span className="font-bold text-purple-300">{sessionDetails.subject}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Department:</span>
                  <span className="font-mono text-slate-200">{sessionDetails.department}</span>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start space-x-2 text-rose-300 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            <button
              onClick={handleStartCameraAndStream}
              disabled={cameraRequesting}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white font-semibold rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg shadow-purple-600/30 text-xs sm:text-sm"
            >
              {cameraRequesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Requesting Camera...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Enable Camera & Start Stream</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3.5 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300 flex items-center space-x-1.5">
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>Recommended Placement:</span>
            </p>
            <p className="text-[11px] leading-relaxed">
              Place the smartphone in landscape mode facing the classroom. WebRTC low-latency streaming will transmit the live feed directly to the attendance AI.
            </p>
          </div>
        </main>

        <footer className="text-center text-[11px] text-slate-500 font-mono">
          Siddhartha Institute of Technology and Sciences • ATTENDIQ AI
        </footer>
      </div>
    );
  }

  // 4. Live Active Camera Stream Viewport
  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden flex flex-col select-none">
      {/* Top Floating Glass Header */}
      <div className="absolute top-0 inset-x-0 z-30 bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent p-3 sm:p-4 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white text-sm shadow-md">
            AI
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                {sessionDetails?.classroom || 'Classroom'} • {sessionDetails?.subject || 'Lecture'}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{connectionState === 'STREAMING' ? 'LIVE' : connectionState}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {sessionDetails?.department} • Section {sessionDetails?.section}
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center space-x-2">
          {/* Flip Camera */}
          <button
            onClick={toggleFacingMode}
            title="Switch Camera (Front/Rear)"
            className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-700/80 text-slate-300 hover:text-white flex items-center justify-center transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="w-8 h-8 rounded-lg bg-slate-900/80 border border-slate-700/80 text-slate-300 hover:text-white flex items-center justify-center transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            title="Stop Stream"
            className="px-2.5 py-1 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all"
          >
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Live Overlay Badge */}
        <div className="absolute top-16 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-purple-500/30 text-[11px] text-purple-300 font-mono flex items-center space-x-2 z-20">
          <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span>WebRTC Feed Active • {facingMode === 'environment' ? 'Rear Camera' : 'Front Camera'}</span>
        </div>
      </div>

      {/* Bottom Floating Telemetry Bar */}
      <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-transparent p-3 sm:p-4 flex items-center justify-between text-xs font-mono text-slate-300 pointer-events-auto">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            {connectionState === 'STREAMING' || connectionState === 'CONNECTED' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">WebRTC Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300">{connectionState}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-lg text-slate-200 flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Recognition Online</span>
          </div>
        </div>
      </div>
    </div>
  );
};
