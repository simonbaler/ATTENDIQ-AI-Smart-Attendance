import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Users,
  RefreshCw,
  Clock,
  ShieldCheck,
  Zap,
  Activity,
  UserCheck,
  AlertCircle,
  Smartphone,
  QrCode,
  ExternalLink,
  Copy,
  Check,
  X,
  Radio,
  Upload,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '../services/api';
import { detectFacesInMedia, loadFaceModels } from '../services/faceModel';
import { AttendanceSession, RecognitionBox, Student, User, MobileCameraSession } from '../types';
import { DesktopWebRTCReceiver, WebRTCConnectionState } from '../services/webrtc';
import { SensorIntelligenceModal } from './SensorIntelligenceModal';
import { ObservabilityDiagnosticsModal } from './ObservabilityDiagnosticsModal';
import { LiveFaceGrid } from './LiveFaceGrid';

interface CameraViewProps {
  user?: User | null;
  onSessionChange?: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ user, onSessionChange }) => {
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionStats, setSessionStats] = useState<{
    present: number;
    absent: number;
    total: number;
    percentage: number;
  } | null>(null);

  // Camera Mode: 'LOCAL' (Webcam) vs 'MOBILE' (Remote WebRTC Phone)
  const [cameraMode, setCameraMode] = useState<'LOCAL' | 'MOBILE'>('MOBILE');

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [modelsReady, setModelsReady] = useState<boolean>(false);
  const [modelsLoading, setModelsLoading] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<RecognitionBox[]>([]);
  const [recentMarks, setRecentMarks] = useState<
    Array<{
      id: string;
      name: string;
      roll: string;
      time: string;
      confidence: number;
      trackingId?: string;
      source?: 'WEB_CAMERA' | 'MOBILE_CAMERA';
      cropUrl?: string;
    }>
  >([]);

  const [fps, setFps] = useState<number>(0);
  const [lastFrameLatency, setLastFrameLatency] = useState<number>(0);
  const [antiSpoofActive, setAntiSpoofActive] = useState<boolean>(true);

  // WebRTC Mobile Camera State
  const [showPairModal, setShowPairModal] = useState<boolean>(false);
  const [pairingLoading, setPairingLoading] = useState<boolean>(false);
  const [customOrigin, setCustomOrigin] = useState<string>(
    typeof window !== 'undefined' ? window.location.origin : ''
  );
  const [pairingData, setPairingData] = useState<{
    token: string;
    url: string;
    qrDataUrl: string;
    expiresAt: string;
    isLocalhost?: boolean;
    lanIp?: string;
  } | null>(null);

  const [mobileWebRTCState, setMobileWebRTCState] = useState<WebRTCConnectionState>('STANDBY');
  const [mobileStateDetails, setMobileStateDetails] = useState<string>('Mobile Camera Not Connected');
  const [mobileStreamActive, setMobileStreamActive] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [pairingTimeLeft, setPairingTimeLeft] = useState<number | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [showSensorModal, setShowSensorModal] = useState<boolean>(false);
  const [showObservabilityModal, setShowObservabilityModal] = useState<boolean>(false);

  // Countdown timer for pairing token expiration
  useEffect(() => {
    if (!pairingData || !pairingData.expiresAt || !showPairModal) {
      setPairingTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const expires = new Date(pairingData.expiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      setPairingTimeLeft(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pairingData, showPairModal]);

  // Video and Canvas Refs for Local & Remote WebRTC feeds
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const webrtcReceiverRef = useRef<DesktopWebRTCReceiver | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const isRemoteProcessingRef = useRef<boolean>(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const remoteAnimationFrameIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(Date.now());
  const lastRemoteFrameTimeRef = useRef<number>(Date.now());

  // Helper to regenerate QR code for reachable origin
  const regenerateQr = async (token: string, originToUse: string) => {
    try {
      const cleanOrigin = originToUse.replace(/\/$/, '');
      const fullUrl = `${cleanOrigin}/mobile/pair/${token}`;
      console.log('[Mobile Pairing QR Diagnostic] Regenerated destination URL:', fullUrl);
      const qrDataUrl = await QRCode.toDataURL(fullUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 340,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      return { url: fullUrl, qrDataUrl };
    } catch (e) {
      console.error('QR generation error:', e);
      return null;
    }
  };

  // Load active session
  const fetchActiveSession = useCallback(async () => {
    try {
      const res = await api.getActiveSession(user?.role === 'HOD' ? user.department : undefined);
      if (res.success && res.active && res.session) {
        setActiveSession(res.session);
        if (res.stats) setSessionStats(res.stats);
      } else {
        setActiveSession(null);
        setSessionStats(null);
      }
    } catch (err) {
      console.error('Error fetching active session:', err);
    }
  }, [user]);

  // Load models on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      setModelsLoading(true);
      const ready = await loadFaceModels();
      if (mounted) {
        setModelsReady(ready);
        setModelsLoading(false);
      }
    })();
    fetchActiveSession();
    return () => {
      mounted = false;
    };
  }, [fetchActiveSession]);

  // Attach Remote MediaStream to hidden or visible remote video element
  const handleRemoteStream = useCallback((stream: MediaStream) => {
    console.log('[WebRTC Desktop] Remote camera stream received!');
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.onloadedmetadata = () => {
        remoteVideoRef.current?.play().catch(console.error);
        setMobileStreamActive(true);
      };
    }
  }, []);

  // Initiate WebRTC Pairing
  const handleInitiatePairing = async (overrideOrigin?: string) => {
    setPairingLoading(true);
    setShowPairModal(true);

    try {
      const originToPass = overrideOrigin || customOrigin || undefined;
      const res = await api.createMobilePairing(activeSession?.id, originToPass);

      if (res.success && res.session) {
        let finalUrl = res.mobileUrl;
        let finalQr = res.qrDataUrl;

        // If explicit custom override origin requested
        if (overrideOrigin && !res.mobileUrl.startsWith(overrideOrigin)) {
          const generated = await regenerateQr(res.opaqueToken, overrideOrigin);
          if (generated) {
            finalUrl = generated.url;
            finalQr = generated.qrDataUrl;
          }
        }

        console.log('[Mobile Pairing QR Diagnostic] Generated destination URL:', finalUrl);

        setPairingData({
          token: res.opaqueToken,
          url: finalUrl,
          qrDataUrl: finalQr,
          expiresAt: res.expiresAt,
          isLocalhost: res.isLocalhost,
          lanIp: res.lanIp,
        });

        // If session was auto-created, refresh active session state
        fetchActiveSession();

        // Initialize Desktop WebRTC Receiver
        if (webrtcReceiverRef.current) {
          webrtcReceiverRef.current.dispose();
        }

        const receiver = new DesktopWebRTCReceiver(
          res.opaqueToken,
          res.session.attendance_session_id || activeSession?.id || 'default_session',
          {
            onStateChange: (state, details) => {
              setMobileWebRTCState(state);
              if (details) setMobileStateDetails(details);
              if (state === 'STREAMING' || state === 'CONNECTED') {
                setMobileStreamActive(true);
              } else if (state === 'DISCONNECTED' || state === 'FAILED') {
                setMobileStreamActive(false);
              }
            },
            onRemoteStream: handleRemoteStream,
            onPhoneScanned: () => {
              console.log('[WebRTC Desktop] Phone scanned QR code');
            },
            onError: (err) => {
              console.error('[WebRTC Desktop] Receiver error:', err);
              setMobileStateDetails(`WebRTC error: ${err}`);
            },
          },
          res.iceServers
        );

        webrtcReceiverRef.current = receiver;
        receiver.start();
      }
    } catch (err: any) {
      console.error('Pairing creation error:', err);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleOriginChange = async (newOrigin: string) => {
    setCustomOrigin(newOrigin);
    if (pairingData && pairingData.token) {
      const generated = await regenerateQr(pairingData.token, newOrigin);
      if (generated) {
        setPairingData((prev) => (prev ? {
          ...prev,
          url: generated.url,
          qrDataUrl: generated.qrDataUrl,
          isLocalhost: newOrigin.includes('localhost') || newOrigin.includes('127.0.0.1'),
        } : null));
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);

  // Start Local Webcam
  const startLocalCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Webcam API is not supported or blocked in this browser.');
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });
      } catch (err: any) {
        console.warn('Optimal webcam failed, fallback to basic:', err);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setCameraError('Camera permission was denied. Please grant camera access in browser site settings.');
      } else {
        setCameraError(`Camera initialization failed: ${err.message || 'Unknown device error'}`);
      }
      setCameraActive(false);
    }
  };

  // Stop Local Camera
  const stopLocalCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    setCameraActive(false);
    setDetectedFaces([]);
  };

  // Stop Active Session
  const handleStopSession = async () => {
    if (!activeSession) return;
    try {
      const res = await api.stopSession(activeSession.id);
      if (res.success) {
        await fetchActiveSession();
        if (onSessionChange) onSessionChange();
      }
    } catch (err) {
      console.error('Failed to stop session:', err);
    }
  };

  // Photo Upload Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setCameraError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const detections = await detectFacesInMedia(img, false);

          if (detections.length === 0) {
            setCameraError('No human faces detected in classroom photo.');
            setIsProcessingPhoto(false);
            return;
          }

          const payload = {
            session_id: activeSession?.id,
            faces: detections.map((d) => ({
              descriptor: d.descriptor,
              box: d.box,
              detectionScore: d.score,
            })),
          };

          const recRes = await api.processRecognition(payload);

          if (recRes.success && recRes.results) {
            setDetectedFaces(recRes.results);

            recRes.results.forEach((fr: RecognitionBox) => {
              if (fr.student && fr.status === 'RECOGNIZED') {
                setRecentMarks((prev) => [
                  {
                    id: `mark_${Date.now()}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`,
                    name: fr.student!.full_name,
                    roll: fr.student!.roll_number,
                    time: new Date().toLocaleTimeString(),
                    confidence: fr.confidence,
                    trackingId: fr.tracking_id || `IMG-${fr.student!.roll_number}`,
                    source: 'WEB_CAMERA',
                  },
                  ...prev.slice(0, 29),
                ]);
              }
            });

            if (activeSession) {
              await fetchActiveSession();
            }
          }
        } catch (err: any) {
          console.error('Error processing classroom photo:', err);
          setCameraError(`Photo processing failed: ${err.message || 'Unknown error'}`);
        } finally {
          setIsProcessingPhoto(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Draw Bounding Boxes Helper
  const drawBoxesOnCanvas = (canvas: HTMLCanvasElement, results: RecognitionBox[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    results.forEach((faceResult: RecognitionBox) => {
      const {
        x,
        y,
        width,
        height,
        tracking_id,
        status,
        student,
        confidence,
        liveness,
        isConfirmed,
        confirmationFrames,
        requiredFrames,
        duplicateIgnored,
        quality_valid,
        quality_rejection,
      } = faceResult;

      const box = { x, y, width, height };
      const isRecognized = status === 'RECOGNIZED' && student;
      const isSpoof = liveness?.spoof_suspected;

      ctx.lineWidth = 3;
      if (isSpoof) {
        ctx.strokeStyle = '#DC2626';
        ctx.fillStyle = 'rgba(220, 38, 38, 0.2)';
      } else if (isRecognized) {
        if (isConfirmed) {
          ctx.strokeStyle = '#10B981';
          ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        } else {
          ctx.strokeStyle = '#3B82F6';
          ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
        }
      } else {
        ctx.strokeStyle = '#F59E0B';
        ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
      }

      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.width, box.height, 8);
      ctx.stroke();
      ctx.fill();

      // Header Tag Box
      const tagWidth = Math.max(box.width, 240);
      const labelHeight = 52;
      const labelY = Math.max(0, box.y - labelHeight - 4);

      ctx.fillStyle = isSpoof ? '#450A0A' : isRecognized ? '#0F172A' : '#1E293B';
      ctx.beginPath();
      ctx.roundRect(box.x, labelY, tagWidth, labelHeight, 6);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = isSpoof ? '#EF4444' : isRecognized ? (isConfirmed ? '#10B981' : '#3B82F6') : '#64748B';
      ctx.stroke();

      if (tracking_id) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.roundRect(box.x + 6, labelY + 6, 70, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#CBD5E1';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(tracking_id, box.x + 10, labelY + 18);
      }

      if (liveness) {
        const liveX = box.x + 82;
        ctx.fillStyle = isSpoof ? '#EF4444' : liveness.is_live ? '#10B981' : '#F59E0B';
        ctx.beginPath();
        ctx.roundRect(liveX, labelY + 6, 60, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(isSpoof ? 'SPOOF!' : liveness.is_live ? 'LIVE' : 'CHECKING', liveX + 6, labelY + 18);
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      if (isSpoof) {
        ctx.fillStyle = '#FCA5A5';
        ctx.fillText('SPOOF PRESENTATION FLAGGED', box.x + 8, labelY + 36);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#FECACA';
        ctx.fillText('Photo/Screen presentation blocked', box.x + 8, labelY + 47);
      } else if (isRecognized) {
        const deptCode = (student.department || '')
          .replace('Computer Science & Engineering', 'CSE')
          .replace('Software Engineering', 'SE')
          .replace('Electrical & Electronics Engineering', 'EEE')
          .replace('Electronics & Communication Engineering', 'ECE')
          .replace('Artificial Intelligence & Machine Learning', 'AIML')
          .replace('Data Science', 'DS');

        ctx.fillText(`${student.full_name}`, box.x + 8, labelY + 36);
        ctx.font = '10px monospace';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(`${student.roll_number} [${deptCode}] • ${confidence}%`, box.x + 8, labelY + 47);

        if (isConfirmed || duplicateIgnored) {
          ctx.fillStyle = '#10B981';
          ctx.beginPath();
          ctx.roundRect(box.x + tagWidth - 76, labelY + 16, 70, 22, 4);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(duplicateIgnored ? 'RECORDED' : 'VERIFIED', box.x + tagWidth - 70, labelY + 31);
        } else {
          ctx.fillStyle = '#3B82F6';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(`Frame ${confirmationFrames || 1}/${requiredFrames || 3}`, box.x + tagWidth - 72, labelY + 31);
        }
      } else {
        ctx.fillStyle = '#FCD34D';
        ctx.fillText('UNKNOWN PERSON', box.x + 8, labelY + 36);
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(quality_valid ? 'No student match • Ignored' : (quality_rejection || 'Low quality'), box.x + 8, labelY + 47);
      }
    });
  };

  // Local Video Frame Loop
  useEffect(() => {
    if (cameraMode !== 'LOCAL') return;

    let active = true;

    const processFrame = async () => {
      if (
        !active ||
        !cameraActive ||
        !videoRef.current ||
        !canvasRef.current ||
        videoRef.current.paused ||
        videoRef.current.ended ||
        isProcessingRef.current
      ) {
        if (active && cameraActive) {
          animationFrameIdRef.current = requestAnimationFrame(processFrame);
        }
        return;
      }

      isProcessingRef.current = true;
      const startTime = performance.now();

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          const detected = await detectFacesInMedia(video, true);

          const now = Date.now();
          const delta = (now - lastFrameTimeRef.current) / 1000;
          if (delta > 0) {
            setFps(Math.round(1 / delta));
          }
          lastFrameTimeRef.current = now;

          if (detected.length > 0) {
            const payload = {
              session_id: activeSession?.id,
              faces: detected.map((d) => ({
                descriptor: d.descriptor,
                box: d.box,
                detectionScore: d.score,
              })),
            };

            const recRes = await api.processRecognition(payload);

            if (recRes.success && recRes.results) {
              setDetectedFaces(recRes.results);
              drawBoxesOnCanvas(canvas, recRes.results);

              recRes.results.forEach((fr: any) => {
                if (fr.attendanceMarked && fr.student) {
                  setRecentMarks((prev) => [
                    {
                      id: `mark_${Date.now()}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`,
                      name: fr.student.full_name,
                      roll: fr.student.roll_number,
                      time: new Date().toLocaleTimeString(),
                      confidence: fr.confidence,
                      trackingId: fr.tracking_id,
                      source: 'WEB_CAMERA',
                    },
                    ...prev.slice(0, 29),
                  ]);
                  fetchActiveSession();
                }
              });
            }
          } else {
            setDetectedFaces([]);
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }

        setLastFrameLatency(Math.round(performance.now() - startTime));
      } catch (err) {
        console.error('Frame loop error:', err);
      } finally {
        isProcessingRef.current = false;
        if (active && cameraActive) {
          animationFrameIdRef.current = requestAnimationFrame(processFrame);
        }
      }
    };

    if (cameraActive) {
      animationFrameIdRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      active = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [cameraMode, cameraActive, activeSession, fetchActiveSession]);

  // Remote WebRTC Video Frame Loop (Face Recognition on live phone stream)
  useEffect(() => {
    if (cameraMode !== 'MOBILE') return;

    let active = true;

    const processRemoteFrame = async () => {
      if (
        !active ||
        !remoteVideoRef.current ||
        !remoteCanvasRef.current ||
        remoteVideoRef.current.paused ||
        remoteVideoRef.current.ended ||
        isRemoteProcessingRef.current ||
        !mobileStreamActive
      ) {
        if (active && mobileStreamActive) {
          remoteAnimationFrameIdRef.current = requestAnimationFrame(processRemoteFrame);
        }
        return;
      }

      isRemoteProcessingRef.current = true;
      const startTime = performance.now();

      try {
        const video = remoteVideoRef.current;
        const canvas = remoteCanvasRef.current;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          // Run face detection on remote video stream
          const detected = await detectFacesInMedia(video, true);

          const now = Date.now();
          const delta = (now - lastRemoteFrameTimeRef.current) / 1000;
          if (delta > 0) {
            setFps(Math.round(1 / delta));
          }
          lastRemoteFrameTimeRef.current = now;

          if (detected.length > 0) {
            const payload = {
              session_id: activeSession?.id,
              faces: detected.map((d) => ({
                descriptor: d.descriptor,
                box: d.box,
                detectionScore: d.score,
              })),
            };

            const recRes = await api.processRecognition(payload);

            if (recRes.success && recRes.results) {
              setDetectedFaces(recRes.results);
              drawBoxesOnCanvas(canvas, recRes.results);

              recRes.results.forEach((fr: any) => {
                if (fr.attendanceMarked && fr.student) {
                  setRecentMarks((prev) => [
                    {
                      id: `mark_${Date.now()}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`,
                      name: fr.student.full_name,
                      roll: fr.student.roll_number,
                      time: new Date().toLocaleTimeString(),
                      confidence: fr.confidence,
                      trackingId: fr.tracking_id,
                      source: 'MOBILE_CAMERA',
                    },
                    ...prev.slice(0, 29),
                  ]);
                  fetchActiveSession();
                }
              });
            }
          } else {
            setDetectedFaces([]);
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }

        setLastFrameLatency(Math.round(performance.now() - startTime));
      } catch (err) {
        console.error('Remote WebRTC frame processing error:', err);
      } finally {
        isRemoteProcessingRef.current = false;
        if (active && mobileStreamActive) {
          remoteAnimationFrameIdRef.current = requestAnimationFrame(processRemoteFrame);
        }
      }
    };

    if (mobileStreamActive) {
      remoteAnimationFrameIdRef.current = requestAnimationFrame(processRemoteFrame);
    }

    return () => {
      active = false;
      if (remoteAnimationFrameIdRef.current) {
        cancelAnimationFrame(remoteAnimationFrameIdRef.current);
      }
    };
  }, [cameraMode, mobileStreamActive, activeSession, fetchActiveSession]);

  // Clean up WebRTC on unmount
  useEffect(() => {
    return () => {
      if (webrtcReceiverRef.current) {
        webrtcReceiverRef.current.dispose();
      }
      stopLocalCamera();
    };
  }, []);

  return (
    <div id="camera-view-container" className="space-y-6">
      {/* Top Header & Mode Selector */}
      <div className="apple-card p-5 bg-white border border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-gray-900 tracking-tight">
                Live Attendance Vision Stream
              </h2>
              {activeSession && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full animate-pulse">
                  ACTIVE SESSION
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {activeSession
                ? activeSession.is_multi_department
                  ? `${activeSession.classroom} • ${activeSession.subject} • Multi-Dept (${activeSession.departments?.length || 0} Departments)`
                  : `${activeSession.classroom} • ${activeSession.subject} (${activeSession.department}-${activeSession.section})`
                : 'No active attendance session'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switch: Mobile Phone vs Webcam */}
          <div className="bg-gray-100 p-1 rounded-full border border-gray-200 flex items-center space-x-1 text-xs">
            <button
              onClick={() => {
                setCameraMode('MOBILE');
                stopLocalCamera();
                if (activeSession && !pairingData) {
                  handleInitiatePairing();
                }
              }}
              className={`px-3 py-1.5 rounded-full font-medium transition flex items-center space-x-1.5 ${
                cameraMode === 'MOBILE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Camera</span>
            </button>
            <button
              onClick={() => {
                setCameraMode('LOCAL');
                if (activeSession && !cameraActive) {
                  startLocalCamera();
                }
              }}
              className={`px-3 py-1.5 rounded-full font-medium transition flex items-center space-x-1.5 ${
                cameraMode === 'LOCAL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Webcam</span>
            </button>
          </div>

          {cameraMode === 'MOBILE' && (
            <button
              onClick={() => handleInitiatePairing()}
              disabled={pairingLoading}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>
                {mobileStreamActive
                  ? 'Mobile Connected'
                  : mobileWebRTCState === 'DISCONNECTED' || mobileWebRTCState === 'FAILED'
                  ? 'Reconnect Mobile'
                  : 'Connect Mobile'}
              </span>
            </button>
          )}

          {/* Additional Campus Hardware & Telemetry Tools */}
          <button
            onClick={() => setShowSensorModal(true)}
            className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition border border-gray-200"
            title="Campus BLE & Environmental Sensors"
          >
            <Radio className="w-3.5 h-3.5 text-indigo-600" />
            <span>Campus Sensors</span>
          </button>

          <button
            onClick={() => setShowObservabilityModal(true)}
            className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition border border-gray-200"
            title="Live System Observability & Subsystems Health"
          >
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Diagnostics</span>
          </button>

          {activeSession && (
            <button
              onClick={handleStopSession}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
            >
              <Square className="w-3.5 h-3.5" />
              <span>End Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col (2 cols): Video Canvas Stream Viewport */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative bg-black rounded-2xl overflow-hidden shadow-md flex flex-col items-center justify-center min-h-[440px] max-h-[560px]">
            {/* Top Left Live Status HUD */}
            <div className="absolute top-3 left-3 z-20 flex items-center space-x-2">
              <div
                className={`px-2.5 py-1 rounded-full text-xs font-mono backdrop-blur-md flex items-center space-x-1.5 shadow-sm ${
                  (cameraMode === 'LOCAL' && cameraActive) || (cameraMode === 'MOBILE' && mobileStreamActive)
                    ? 'bg-black/60 text-emerald-400 border border-emerald-500/40'
                    : 'bg-black/60 text-gray-300 border border-gray-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    (cameraMode === 'LOCAL' && cameraActive) || (cameraMode === 'MOBILE' && mobileStreamActive)
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-gray-500'
                  }`}
                />
                <span>
                  {cameraMode === 'MOBILE'
                    ? mobileStreamActive
                      ? 'LIVE MOBILE CLASSROOM FEED'
                      : mobileWebRTCState === 'STANDBY'
                      ? 'MOBILE STANDBY'
                      : mobileWebRTCState
                    : cameraActive
                    ? 'LIVE WEBCAM STREAM'
                    : 'WEBCAM STANDBY'}
                </span>
              </div>

              {cameraMode === 'MOBILE' && (
                <div className="px-2 py-1 rounded-full text-xs bg-black/60 text-indigo-300 border border-indigo-500/40 backdrop-blur-md font-mono flex items-center space-x-1">
                  <Smartphone className="w-3 h-3 text-indigo-400" />
                  <span>{mobileWebRTCState}</span>
                </div>
              )}

              {((cameraMode === 'LOCAL' && cameraActive) || (cameraMode === 'MOBILE' && mobileStreamActive)) && (
                <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs bg-black/60 text-gray-200 border border-gray-700 backdrop-blur-md font-mono">
                  <Activity className="w-3 h-3 text-blue-400" />
                  <span>{fps} FPS</span>
                  <span className="text-gray-500">•</span>
                  <span>{lastFrameLatency}ms</span>
                </div>
              )}
            </div>

            {/* Top Right Anti-Spoof & Tracks HUD */}
            <div className="absolute top-3 right-3 z-20 flex items-center space-x-2">
              <div className="px-2.5 py-1 rounded-full text-xs bg-black/60 text-emerald-400 border border-emerald-500/40 backdrop-blur-md flex items-center space-x-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Anti-Spoof ON</span>
              </div>
              <div className="px-2.5 py-1 rounded-full text-xs bg-black/60 text-white border border-gray-700 backdrop-blur-md font-mono">
                Faces: <span className="text-blue-400 font-bold">{detectedFaces.length}</span>
              </div>
            </div>

            {/* LOCAL WEBCAM VIEWPORT */}
            {cameraMode === 'LOCAL' && (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`w-full h-full object-cover max-h-[560px] ${!cameraActive ? 'hidden' : ''}`}
                />
                <canvas
                  ref={canvasRef}
                  className={`absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-10 ${
                    !cameraActive ? 'hidden' : ''
                  }`}
                />
              </>
            )}

            {/* MOBILE WEBRTC REMOTE STREAM VIEWPORT */}
            {cameraMode === 'MOBILE' && (
              <div className="w-full h-full flex items-center justify-center relative min-h-[460px]">
                <video
                  ref={remoteVideoRef}
                  playsInline
                  autoPlay
                  muted
                  className={`w-full h-full object-cover max-h-[560px] ${!mobileStreamActive ? 'hidden' : ''}`}
                />
                <canvas
                  ref={remoteCanvasRef}
                  className={`absolute top-0 left-0 w-full h-full object-cover pointer-events-none z-10 ${
                    !mobileStreamActive ? 'hidden' : ''
                  }`}
                />

                {!mobileStreamActive && (
                  <div className="p-8 text-center max-w-md space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                      <Smartphone className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-white">Mobile Camera Not Connected</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {mobileStateDetails || 'Connect your smartphone camera to stream live classroom video directly into the attendance recognition pipeline.'}
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={() => handleInitiatePairing()}
                        disabled={pairingLoading}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold shadow-md inline-flex items-center space-x-2 transition"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Connect Mobile Camera</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Standby / Error Screen for Local Camera */}
            {cameraMode === 'LOCAL' && !cameraActive && (
              <div className="p-6 sm:p-8 text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4 text-gray-400">
                  <Camera className="w-8 h-8" />
                </div>
                {cameraError ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-2 text-red-400 font-semibold text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>Camera Access Notification</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed bg-gray-900 p-3 rounded-xl border border-gray-800">
                      {cameraError}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={startLocalCamera}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold shadow-xs transition"
                      >
                        Retry Camera Access
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-white">Classroom Webcam is Idle</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Click below to activate local webcam. The system detects human faces in real time and automatically marks verified attendance.
                    </p>
                    <button
                      onClick={startLocalCamera}
                      disabled={modelsLoading}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold shadow-xs transition inline-flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{modelsLoading ? 'Loading AI Models...' : 'Start Classroom Webcam'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Hidden Photo Upload Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>

          {/* AI Recognition Engine Rules Notice */}
          <div className="apple-card p-4 bg-white border border-gray-200 text-xs text-gray-600 space-y-1.5">
            <div className="flex items-center space-x-2 font-semibold text-gray-900">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>SITS Multi-Stage Intelligence & Anti-Spoofing Pipeline</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-gray-500 pl-1">
              <li><strong className="text-gray-800">Multi-Face Auto-Crop Vision:</strong> Concurrently tracks and extracts embeddings for all students in wide classroom views.</li>
              <li><strong className="text-gray-800">Passive Liveness Detection:</strong> Micro-motion variance filters out printed photographs and static digital screens.</li>
              <li><strong className="text-gray-800">Adaptive Temporal Confirmation:</strong> High confidence matches confirm in 3 frames; marginal matches confirm in 5 frames.</li>
              <li><strong className="text-gray-800">Duplicate Guard:</strong> Attendance is marked only once per student per active session.</li>
            </ul>
          </div>
        </div>

        {/* Right Col: Live Attendance Stream & Department Intelligence */}
        <div className="space-y-4">
          {/* Department Intelligence Roster Card */}
          {activeSession && (
            <div className="apple-card p-5 bg-white border border-gray-200 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    {activeSession.is_multi_department ? 'Department-Wise Live Attendance' : 'Session Attendance Status'}
                  </h3>
                </div>
                {sessionStats && (
                  <span className="text-xs font-mono font-bold text-emerald-600">
                    {sessionStats.present} / {sessionStats.total} ({sessionStats.percentage}%)
                  </span>
                )}
              </div>

              {activeSession.is_multi_department && activeSession.department_stats && Object.keys(activeSession.department_stats).length > 0 ? (
                <div className="space-y-2.5">
                  {Object.entries(activeSession.department_stats).map(([deptName, stat]: [string, any]) => {
                    const deptCode = deptName
                      .replace('Computer Science & Engineering', 'CSE')
                      .replace('Software Engineering', 'SE')
                      .replace('Electrical & Electronics Engineering', 'EEE')
                      .replace('Electronics & Communication Engineering', 'ECE')
                      .replace('Artificial Intelligence & Machine Learning', 'AIML')
                      .replace('Data Science', 'DS');
                    return (
                      <div key={deptName} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px] font-mono text-blue-700 font-bold">
                              {deptCode}
                            </span>
                            <span className="text-gray-700 truncate text-[11px] font-medium">{deptName}</span>
                          </div>
                          <div className="font-mono text-gray-600 text-[11px]">
                            <strong className="text-gray-900">{stat.present}</strong> / {stat.total} ({stat.attendance_percentage}%)
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, stat.attendance_percentage)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : sessionStats ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Attendance Progress:</span>
                    <span className="font-mono font-semibold text-gray-900">{sessionStats.present} of {sessionStats.total} students</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, sessionStats.percentage)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="apple-card p-5 bg-white border border-gray-200 flex flex-col h-[440px]">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Live Attendance Stream</h3>
              </div>
              <span className="text-[11px] font-mono text-gray-400">
                {recentMarks.length} records marked
              </span>
            </div>

            {/* Feed List */}
            <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
              {recentMarks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                  <UserCheck className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs font-medium text-gray-600">No attendance marked yet in this session.</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    When registered students are recognized by the camera, verified records appear here.
                  </p>
                </div>
              ) : (
                recentMarks.map((mark) => (
                  <div
                    key={mark.id}
                    className="p-3 bg-gray-50/70 border border-gray-200 rounded-xl text-xs space-y-1 hover:border-gray-300 transition flex items-center space-x-3"
                  >
                    {mark.cropUrl ? (
                      <img
                        src={mark.cropUrl}
                        alt={mark.name}
                        className="w-11 h-11 rounded-lg object-cover border border-emerald-300 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold shrink-0">
                        ✓
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 truncate">{mark.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shrink-0">
                          PRESENT
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-gray-500 font-mono text-[11px]">
                        <span>{mark.roll}</span>
                        <span className="text-blue-600 font-semibold">{mark.confidence}% match</span>
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center justify-between pt-0.5 font-mono">
                        <span className="flex items-center space-x-1">
                          {mark.source === 'MOBILE_CAMERA' ? (
                            <span className="text-indigo-600 flex items-center space-x-0.5">
                              <Smartphone className="w-2.5 h-2.5" />
                              <span>Mobile</span>
                            </span>
                          ) : (
                            <span className="text-blue-600 flex items-center space-x-0.5">
                              <Camera className="w-2.5 h-2.5" />
                              <span>Webcam</span>
                            </span>
                          )}
                          <span>•</span>
                          <span>{mark.trackingId || 'TRACK'}</span>
                        </span>
                        <span>{mark.time}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Currently in Camera Frame */}
            {detectedFaces.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
                <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Currently in Camera Frame ({detectedFaces.length}):
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {detectedFaces.map((f, i) => (
                    <div
                      key={i}
                      className={`px-2.5 py-1 rounded-lg text-[11px] flex items-center justify-between ${
                        f.liveness?.spoof_suspected
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : f.status === 'RECOGNIZED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <span className="truncate font-medium">
                        {f.liveness?.spoof_suspected
                          ? `Spoof Alert (${f.tracking_id || 'Track'})`
                          : f.status === 'RECOGNIZED'
                          ? `${f.student?.full_name} (${f.tracking_id || 'Track'})`
                          : `Unknown Face (${f.tracking_id || 'Track'})`}
                      </span>
                      <span className="font-mono text-[10px] font-bold">
                        {f.liveness?.spoof_suspected
                          ? 'BLOCKED'
                          : f.status === 'RECOGNIZED'
                          ? `${f.confidence}%`
                          : 'Unknown'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Classroom Attendance Wall (Phase 8 Requirement) */}
      <LiveFaceGrid detectedFaces={detectedFaces} />

      {/* Mobile Camera Pairing Modal */}
      {showPairModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="apple-card p-6 sm:p-7 bg-white max-w-md w-full shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowPairModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Connect Mobile Camera</h3>
                <p className="text-xs text-gray-500">
                  Use your smartphone as the classroom AI camera.
                </p>
              </div>
            </div>

            {pairingLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-xs text-gray-500">Generating secure pairing session...</p>
              </div>
            ) : pairingData ? (
              <div className="space-y-4">
                {/* QR Code Container */}
                <div className="bg-white p-3.5 rounded-2xl border border-gray-200 flex flex-col items-center justify-center shadow-xs mx-auto w-fit">
                  <img
                    src={pairingData.qrDataUrl}
                    alt="Mobile Pairing QR Code"
                    className="w-56 h-56 rounded-lg object-contain"
                  />
                  <div className="mt-2 text-[10px] font-bold tracking-wider text-gray-600 uppercase flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Ready for smartphone scan</span>
                  </div>
                </div>

                {/* Expiration Countdown & Live Status */}
                <div className="flex items-center justify-between text-xs px-1">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        mobileStreamActive
                          ? 'bg-emerald-500 animate-pulse'
                          : mobileWebRTCState === 'CONNECTED'
                          ? 'bg-blue-500'
                          : mobileWebRTCState === 'PHONE_SCANNED' || mobileWebRTCState === 'REQUESTING_CAMERA'
                          ? 'bg-indigo-500 animate-pulse'
                          : 'bg-amber-500 animate-ping'
                      }`}
                    />
                    <span className="font-semibold text-gray-700">
                      {mobileStreamActive
                        ? 'Mobile camera connected ✓ (LIVE)'
                        : mobileWebRTCState === 'PHONE_SCANNED'
                        ? 'Phone detected ✓ • Waiting for camera...'
                        : mobileWebRTCState === 'REQUESTING_CAMERA'
                        ? 'Camera granted ✓ • Connecting...'
                        : mobileWebRTCState === 'DISCONNECTED'
                        ? 'Mobile Disconnected'
                        : 'Waiting for phone...'}
                    </span>
                  </div>

                  {pairingTimeLeft !== null && (
                    <span
                      className={`font-mono text-[11px] ${
                        pairingTimeLeft < 60 ? 'text-red-600 font-bold animate-pulse' : 'text-gray-400'
                      }`}
                    >
                      {pairingTimeLeft > 0
                        ? `Expires in ${Math.floor(pairingTimeLeft / 60)
                            .toString()
                            .padStart(2, '0')}:${(pairingTimeLeft % 60).toString().padStart(2, '0')}`
                        : 'QR Expired'}
                    </span>
                  )}
                </div>

                {/* 5-Step Numbered Guide */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-xs text-gray-700 space-y-2">
                  <div className="flex items-center space-x-2 text-indigo-700 font-semibold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>How to connect in 5 seconds:</span>
                  </div>
                  <ol className="space-y-1 text-[11px] text-gray-600 pl-1">
                    <li className="flex items-start space-x-2">
                      <span className="font-bold text-indigo-600">1.</span>
                      <span>Open your phone camera.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="font-bold text-indigo-600">2.</span>
                      <span>Scan the QR code above.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="font-bold text-indigo-600">3.</span>
                      <span>Open the ATTENDIQ link.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="font-bold text-indigo-600">4.</span>
                      <span>Allow camera permission.</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="font-bold text-indigo-600">5.</span>
                      <span>Camera connects automatically.</span>
                    </li>
                  </ol>
                  <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-200 font-medium">
                    🔒 Secure temporary connection • No PIN required
                  </p>
                </div>

                {/* Action Buttons: Generate New QR, Copy URL, Open Link */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleInitiatePairing()}
                    className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-full transition flex items-center justify-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Generate New QR</span>
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pairingData.url);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2500);
                    }}
                    className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-full transition flex items-center justify-center space-x-1.5"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                        <span>Copy Mobile URL</span>
                      </>
                    )}
                  </button>
                </div>

                <a
                  href={pairingData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold rounded-full transition flex items-center justify-center space-x-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open on Phone / New Tab</span>
                </a>

                {/* Diagnostics Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDiagnostics(!showDiagnostics)}
                    className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center space-x-1 font-mono transition"
                  >
                    <span>{showDiagnostics ? '▼ Hide Diagnostics' : '▶ Show WebRTC Diagnostics'}</span>
                  </button>

                  {showDiagnostics && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200 text-[11px] font-mono space-y-1 text-gray-600">
                      <div>Session ID: <span className="text-gray-900">{activeSession?.id || 'Auto-Provisioned'}</span></div>
                      <div>Token Prefix: <span className="text-gray-900">{pairingData.token.slice(0, 10)}...</span></div>
                      <div>Signaling: <span className="text-emerald-600">Connected (/api/mobile/signaling)</span></div>
                      <div>WebRTC State: <span className="text-indigo-600">{mobileWebRTCState}</span></div>
                      <div>Stream Active: <span className={mobileStreamActive ? 'text-emerald-600' : 'text-gray-400'}>{mobileStreamActive ? 'YES' : 'NO'}</span></div>
                      {pairingData.lanIp && <div>LAN IP: <span className="text-gray-900">{pairingData.lanIp}</span></div>}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <button
              onClick={() => {
                setShowPairModal(false);
                setCameraMode('MOBILE');
              }}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-full text-xs transition"
            >
              {mobileStreamActive ? 'View Live Classroom Feed' : 'Close Modal'}
            </button>
          </div>
        </div>
      )}

      {/* Campus IoT & Environmental Sensor Modal */}
      <SensorIntelligenceModal
        isOpen={showSensorModal}
        onClose={() => setShowSensorModal(false)}
      />

      {/* Live Observability & Hardware Diagnostics Modal */}
      <ObservabilityDiagnosticsModal
        isOpen={showObservabilityModal}
        onClose={() => setShowObservabilityModal(false)}
        fps={fps}
        recognitionLatency={lastFrameLatency}
        detectedCount={detectedFaces.length}
        recognizedCount={detectedFaces.filter((f) => f.student).length}
        mobileActive={mobileStreamActive}
      />
    </div>
  );
};
