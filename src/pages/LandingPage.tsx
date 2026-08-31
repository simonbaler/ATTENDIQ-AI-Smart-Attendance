import React, { useState } from 'react';
import {
  Sparkles,
  Camera,
  Smartphone,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  Database,
  Cpu,
  Radio,
  Volume2,
  Lock,
  ArrowRight,
  CheckCircle2,
  Eye,
  Sliders,
  BarChart3,
  Users,
  ChevronRight,
  ExternalLink,
  Play,
} from 'lucide-react';
import { VisionSphere3D } from '../components/VisionSphere3D';

interface LandingPageProps {
  onLaunchApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  const [activeDemoTab, setActiveDemoTab] = useState<'detection' | 'tracking' | 'sheets'>('detection');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white font-sans overflow-x-hidden">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg ring-2 ring-blue-500/20">
              AI
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white flex items-center space-x-1">
                <span>ATTENDIQ</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                  AI
                </span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                Vision Attendance Platform
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-xs font-semibold text-slate-300">
            <button onClick={() => scrollToSection('vision')} className="hover:text-blue-400 transition">
              AI Vision
            </button>
            <button onClick={() => scrollToSection('multicam')} className="hover:text-blue-400 transition">
              Multi-Camera
            </button>
            <button onClick={() => scrollToSection('sheets')} className="hover:text-blue-400 transition">
              Google Sheets
            </button>
            <button onClick={() => scrollToSection('analytics')} className="hover:text-blue-400 transition">
              Analytics
            </button>
            <button onClick={() => scrollToSection('security')} className="hover:text-blue-400 transition">
              Security
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onLaunchApp}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.02] flex items-center space-x-1.5"
            >
              <span>Launch ATTENDIQ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Ambient Gradient Background Glow */}
        <div className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Hero Left Content */}
        <div className="flex-1 space-y-6 text-center lg:text-left z-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>Next-Gen Computer Vision Attendance Engine</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Attendance, <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
              Reimagined by AI.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
            Real-time facial recognition, intelligent classroom monitoring, multi-camera connectivity, and automated attendance intelligence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
            <button
              onClick={onLaunchApp}
              className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-bold rounded-xl shadow-xl shadow-blue-600/25 transition-all transform hover:scale-105 flex items-center justify-center space-x-2"
            >
              <span>Launch ATTENDIQ</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollToSection('vision')}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-sm font-bold rounded-xl border border-slate-800 transition flex items-center justify-center space-x-2"
            >
              <Eye className="w-4 h-4 text-blue-400" />
              <span>Explore AI Vision</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="pt-6 border-t border-slate-900 grid grid-cols-3 gap-4 max-w-md mx-auto lg:mx-0 text-center lg:text-left font-mono">
            <div>
              <div className="text-xl font-bold text-white">68-Pt</div>
              <div className="text-[11px] text-slate-400">Landmarks</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">&lt; 35ms</div>
              <div className="text-[11px] text-slate-400">Inference</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-400">100%</div>
              <div className="text-[11px] text-slate-400">Sheet Sync</div>
            </div>
          </div>
        </div>

        {/* Hero Right 3D Sphere Interactive Canvas */}
        <div className="flex-1 w-full max-w-lg lg:max-w-xl h-[420px] sm:h-[480px] relative z-10 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
          <VisionSphere3D className="w-full h-full" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Interactive 3D Vision Core • Hover cursor to rotate</span>
          </div>
        </div>
      </section>

      {/* Section 1: AI Vision Engine */}
      <section id="vision" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-900">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-xs font-semibold border border-blue-500/20">
            <Camera className="w-3.5 h-3.5" />
            <span>Face-Only Computer Vision Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Precision Facial Biometrics, Not Object Guesswork
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            ATTENDIQ strictly detects human faces through 68-point landmark geometry. Arms, phones, clothing, and chairs are mathematically rejected.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-4 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Passive Liveness Anti-Spoofing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Temporal micro-motion analysis and reflection gradients filter out printed photographs, digital screen replays, and non-living artifacts.
            </p>
          </div>

          <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-4 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Multi-Face Concurrent Tracking</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Wide classroom cameras detect and extract 128D Euclidean face descriptors for dozens of students simultaneously without frame rate degradation.
            </p>
          </div>

          <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-4 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Adaptive Temporal Confirmation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              High confidence detections lock in 3 frames; marginal angles confirm across 5 consecutive frames before recording attendance.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Multi-Camera Classroom Mesh */}
      <section id="multicam" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-900">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-5">
            <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-xs font-semibold border border-purple-500/20">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Multi-Source Mesh Networking</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Turn Any Smartphone or IP Camera into an AI Vision Sensor
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Scan a QR code from any smartphone to instantly stream high-definition WebRTC video directly to the desktop recognition engine with zero PINs or manual configurations.
            </p>

            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Webcam, USB Vision, and Physical Smartphone QR Pairing</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>RTSP & ONVIF Classroom Ceiling Camera Integration</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Independent Camera Health Isolation — One drop won't affect others</span>
              </li>
            </ul>
          </div>

          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Live Camera Mesh Status</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                ALL ONLINE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Desktop WebRTC</div>
                <div className="text-sm font-bold text-white mt-1">LH-301 Main</div>
                <div className="text-[10px] text-emerald-400 mt-1">30 FPS • 18ms</div>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400">Mobile Smartphone</div>
                <div className="text-sm font-bold text-purple-300 mt-1">Galaxy S24 Ultra</div>
                <div className="text-[10px] text-emerald-400 mt-1">1080p • 24ms</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Google Sheets Sole Authoritative Master */}
      <section id="sheets" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-900">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-semibold border border-emerald-500/20">
            <Database className="w-3.5 h-3.5" />
            <span>Sole Master Dataset Synchronization</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Google Sheets Stays 100% Authoritative
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Student records, roll numbers, sections, and department rosters synchronize bi-directionally with your institution's Google Sheets.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="space-y-2">
              <div className="text-2xl font-black text-white">2-Way Sync</div>
              <p className="text-xs text-slate-400">
                Edits in Google Sheets instantly sync down; verified attendance writes back up.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-black text-emerald-400">Zero Duplicates</div>
              <p className="text-xs text-slate-400">
                Deterministic hash checks ensure students are only registered and marked once per lecture.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-black text-purple-400">Automated Audit</div>
              <p className="text-xs text-slate-400">
                Every sync timestamp and change delta is permanently logged in system audit trails.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Interactive Product Preview (Explicitly Labeled) */}
      <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-900">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 text-xs font-semibold border border-cyan-500/20">
            <Play className="w-3.5 h-3.5" />
            <span>Interactive Product Preview</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            How ATTENDIQ Operates in the Classroom
          </h2>
          <p className="text-xs text-slate-400 italic">
            *Visual interactive walkthrough preview. Production attendance executes live inside the dashboard.*
          </p>
        </div>

        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex border-b border-slate-800 space-x-4">
            <button
              onClick={() => setActiveDemoTab('detection')}
              className={`pb-3 text-xs font-bold transition border-b-2 ${
                activeDemoTab === 'detection'
                  ? 'text-blue-400 border-blue-400'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              1. Landmark Detection
            </button>
            <button
              onClick={() => setActiveDemoTab('tracking')}
              className={`pb-3 text-xs font-bold transition border-b-2 ${
                activeDemoTab === 'tracking'
                  ? 'text-purple-400 border-purple-400'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              2. Biometric Verification
            </button>
            <button
              onClick={() => setActiveDemoTab('sheets')}
              className={`pb-3 text-xs font-bold transition border-b-2 ${
                activeDemoTab === 'sheets'
                  ? 'text-emerald-400 border-emerald-400'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              3. Attendance Lock & Sync
            </button>
          </div>

          <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-4">
            {activeDemoTab === 'detection' && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-blue-300 font-semibold">
                  <Camera className="w-4 h-4" />
                  <span>Optical Frame Ingestion & Landmark Localization</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Incoming 1080p camera frames pass through SSD MobileNet face detection. Coordinates for eyes, nose bridge, jawline, and lips are computed in &lt; 20 milliseconds.
                </p>
              </div>
            )}
            {activeDemoTab === 'tracking' && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-purple-300 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Descriptor Matching & Liveness Confirmation</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Extracted 128D embeddings are compared against enrolled Google Sheet student biometric vectors using cosine distance thresholding (&lt; 0.42 cutoff).
                </p>
              </div>
            )}
            {activeDemoTab === 'sheets' && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-emerald-300 font-semibold">
                  <Database className="w-4 h-4" />
                  <span>Idempotent Attendance Recording</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Once confirmed across consecutive frames, a verified timestamped record is committed to the local ledger and streamed to the Google Sheet.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 5: Security & Privacy */}
      <section id="security" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-900">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-rose-500/10 text-rose-300 text-xs font-semibold border border-rose-500/20">
              <Lock className="w-3.5 h-3.5" />
              <span>Zero-Raw-Storage Biometric Protection</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">
              Institutional Privacy & Data Compliance
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              ATTENDIQ is engineered for educational institutions with strict student data sovereignty. Raw photographs are converted into irreversible mathematical embeddings and discarded immediately.
            </p>
            <div className="space-y-2 pt-2 text-xs text-slate-300 font-mono">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                🔒 Cryptographic Ephemeral Pairing Tokens (5-min TTL)
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                🛡️ Role-Based Access Control (Admin / HOD isolation)
              </div>
            </div>
          </div>

          <div className="p-8 bg-gradient-to-tr from-slate-900 to-slate-950 border border-slate-800 rounded-3xl space-y-6">
            <h3 className="text-base font-bold text-white">Full Technology Stack</h3>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Vision AI</span>
                <strong className="text-blue-400">Face-API / TF.js</strong>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Real-Time Streaming</span>
                <strong className="text-purple-400">WebRTC / WebSocket</strong>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">3D Interface</span>
                <strong className="text-cyan-400">Three.js / WebGL</strong>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Cloud Backend</span>
                <strong className="text-emerald-400">Node.js Express</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-900 text-center">
        <div className="bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-slate-900/80 border border-blue-500/30 rounded-3xl p-10 sm:p-14 shadow-2xl space-y-6 max-w-4xl mx-auto relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Ready to Experience Modern AI Attendance?
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Launch ATTENDIQ AI to monitor classroom live streams, pair physical smartphone cameras, and sync with Google Sheets.
          </p>
          <button
            onClick={onLaunchApp}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-bold rounded-2xl shadow-xl shadow-blue-600/30 transition-all transform hover:scale-105 inline-flex items-center space-x-2"
          >
            <span>Launch ATTENDIQ Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <div>
          ATTENDIQ AI — Siddhartha Institute of Technology and Sciences
        </div>
        <div className="flex items-center space-x-6">
          <span>Production AI Vision Platform</span>
          <span>•</span>
          <span>SIH 2026</span>
        </div>
      </footer>
    </div>
  );
};
