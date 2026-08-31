import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Sparkles,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Check,
  XCircle,
} from 'lucide-react';
import { Student } from '../types';
import { api } from '../services/api';
import { validateEnrollmentImage, loadFaceModels, FaceQualityScore } from '../services/faceModel';

interface FaceEnrollmentModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const FaceEnrollmentModal: React.FC<FaceEnrollmentModalProps> = ({
  student,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [latestQuality, setLatestQuality] = useState<FaceQualityScore | null>(null);

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraReady, setCameraReady] = useState<boolean>(false);

  // Enrolled images & descriptors
  const [capturedSamples, setCapturedSamples] = useState<
    Array<{
      dataUrl: string;
      descriptor: number[];
      box: { x: number; y: number; width: number; height: number };
      quality?: FaceQualityScore;
    }>
  >([]);

  useEffect(() => {
    if (isOpen) {
      setCapturedSamples([]);
      setErrorMsg(null);
      setSuccessMsg(null);
      setLatestQuality(null);
      loadFaceModels();
      if (activeTab === 'camera') {
        startWebcam();
      }
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [isOpen, activeTab]);

  const startWebcam = async () => {
    setErrorMsg(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraActive(true);
            setCameraReady(true);
          };
        }
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setErrorMsg('Could not open webcam. Ensure camera permissions are granted or switch to File Upload.');
      setCameraActive(false);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Capture single shot from video feed and validate 1-face rule
  const handleCaptureShot = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      // Validate single face and extract 128-d descriptor
      const valResult = await validateEnrollmentImage(canvas);

      if (valResult.qualityScore) {
        setLatestQuality(valResult.qualityScore);
      }

      if (!valResult.valid || !valResult.descriptor) {
        setErrorMsg(valResult.error || 'Face quality validation failed. Ensure single face facing the camera.');
        setIsProcessing(false);
        return;
      }

      setCapturedSamples((prev) => [
        ...prev,
        {
          dataUrl,
          descriptor: valResult.descriptor!,
          box: valResult.faceBox || { x: 0, y: 0, width: 100, height: 100 },
          quality: valResult.qualityScore,
        },
      ]);

      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(`Capture error: ${err.message || 'Unknown processing error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const newSamples = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        // Create HTMLImageElement to validate
        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const val = await validateEnrollmentImage(img);
        if (val.qualityScore) {
          setLatestQuality(val.qualityScore);
        }

        if (!val.valid || !val.descriptor) {
          setErrorMsg(`Image "${file.name}" rejected: ${val.error}`);
          setIsProcessing(false);
          return;
        }

        newSamples.push({
          dataUrl,
          descriptor: val.descriptor,
          box: val.faceBox || { x: 0, y: 0, width: 100, height: 100 },
          quality: val.qualityScore,
        });
      }

      setCapturedSamples((prev) => [...prev, ...newSamples]);
    } catch (err: any) {
      setErrorMsg(`Upload error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveSample = (index: number) => {
    setCapturedSamples((prev) => prev.filter((_, i) => i !== index));
  };

  // Final Submit to Backend
  const handleSubmitEnrollment = async () => {
    if (capturedSamples.length < 3) {
      setErrorMsg(`Minimum 3 face captures required for reliable recognition (Currently: ${capturedSamples.length}).`);
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const payload = {
        encodings: capturedSamples.map((s) => s.descriptor),
        images: capturedSamples.map((s) => s.dataUrl),
        replaceExisting: true,
      };

      const res = await api.enrollFace(student.id, payload);

      if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.message || 'Face enrollment failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit enrollment.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-bold text-white">Student Face Registration</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Enrolling: <strong className="text-slate-200">{student.full_name}</strong> ({student.roll_number}) • {student.department}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Camera vs Upload */}
        <div className="flex space-x-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md flex items-center justify-center space-x-2 transition ${
              activeTab === 'camera' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Camera Capture (Recommended)</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md flex items-center justify-center space-x-2 transition ${
              activeTab === 'upload' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Image Upload (3 to 5 Photos)</span>
          </button>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Quality Score Breakdown Card */}
        {latestQuality && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>Face Quality Score & Biometric Analysis</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  latestQuality.readyForRecognition
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                    : 'bg-rose-900/60 text-rose-300 border border-rose-700'
                }`}
              >
                {latestQuality.readyForRecognition ? 'READY FOR RECOGNITION' : 'QUALITY REJECTED'}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">Face Detected</div>
                <div className="font-semibold text-white flex items-center space-x-1 mt-0.5">
                  {latestQuality.faceDetected ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>{latestQuality.faceDetected ? '1 Face' : '0 Faces'}</span>
                </div>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">Face Size</div>
                <div className="font-semibold text-white mt-0.5">{latestQuality.faceSizePx}</div>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">Sharpness</div>
                <div className="font-semibold text-white mt-0.5">
                  <span className={latestQuality.sharpnessValid ? 'text-emerald-400' : 'text-rose-400'}>
                    {latestQuality.sharpnessScore}%
                  </span>
                </div>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">Brightness</div>
                <div className="font-semibold text-white mt-0.5">
                  <span className={latestQuality.brightnessValid ? 'text-emerald-400' : 'text-amber-400'}>
                    {latestQuality.brightnessValue}/255
                  </span>
                </div>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">128D Embedding</div>
                <div className="font-semibold text-white mt-0.5">
                  {latestQuality.embeddingGenerated ? (
                    <span className="text-emerald-400 font-mono">128-D Vector</span>
                  ) : (
                    <span className="text-slate-500">Pending</span>
                  )}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-500 text-[10px]">Enrollment</div>
                <div className="font-semibold text-white mt-0.5">
                  {latestQuality.readyForRecognition ? (
                    <span className="text-emerald-400">PASSED</span>
                  ) : (
                    <span className="text-rose-400">FAILED</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Camera Mode Body */}
        {activeTab === 'camera' && (
          <div className="space-y-3">
            <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 aspect-video flex items-center justify-center">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />

              {!cameraActive && (
                <div className="text-center p-6">
                  <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Opening camera stream...</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Captured: <strong className="text-blue-400">{capturedSamples.length}</strong> of 3–5 recommended samples
              </span>
              <button
                onClick={handleCaptureShot}
                disabled={isProcessing || !cameraReady}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow flex items-center space-x-2 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                <span>{isProcessing ? 'Validating Face...' : 'Capture Face Frame'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Upload Mode Body */}
        {activeTab === 'upload' && (
          <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-6 text-center bg-slate-950/50 cursor-pointer transition relative">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-200">Select 3 to 5 Frontal Face Photos</h4>
            <p className="text-xs text-slate-400 mt-1">
              Each photo must contain exactly one face. Non-face items (phones, background objects) are automatically rejected.
            </p>
          </div>
        )}

        {/* Captured Samples Thumbnails Bar */}
        {capturedSamples.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              Verified Enrolled Frames ({capturedSamples.length}):
            </div>
            <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-thin">
              {capturedSamples.map((sample, idx) => (
                <div key={idx} className="relative group shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-emerald-500/50">
                  <img src={sample.dataUrl} alt={`Sample ${idx + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 bg-black/70 text-[10px] px-1 rounded font-mono text-emerald-400">
                    #{idx + 1}
                  </span>
                  <button
                    onClick={() => handleRemoveSample(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-600/80 text-white rounded hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="text-[11px] text-slate-400">
            {capturedSamples.length < 3 ? (
              <span className="text-amber-400">Need at least {3 - capturedSamples.length} more face samples.</span>
            ) : (
              <span className="text-emerald-400">Ready to build student 128D face descriptor database.</span>
            )}
          </div>

          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitEnrollment}
              disabled={capturedSamples.length < 3 || isProcessing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow flex items-center space-x-2 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save Face Registration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
