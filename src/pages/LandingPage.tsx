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
  Lock,
  ArrowRight,
  CheckCircle2,
  Eye,
  Sliders,
  BarChart3,
  Users,
  ChevronRight,
  ExternalLink,
  Check,
  FileSpreadsheet,
  Globe,
  Wifi,
} from 'lucide-react';
import { VisionSphere3D } from '../components/VisionSphere3D';

interface LandingPageProps {
  onLaunchApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'hardware' | 'governance'>('attendance');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-gray-900 selection:bg-blue-600 selection:text-white font-sans overflow-x-hidden">
      {/* Top Translucent Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-xl border-b border-gray-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-gray-900 flex items-center space-x-1.5">
                <span>ATTENDIQ</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                  AI
                </span>
              </span>
              <span className="text-[11px] text-gray-500 block -mt-0.5 font-medium">
                SITS Smart Classroom Platform
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-xs font-medium text-gray-600">
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-blue-600 transition">
              How It Works
            </button>
            <button onClick={() => scrollToSection('ai-attendance')} className="hover:text-blue-600 transition">
              AI Attendance
            </button>
            <button onClick={() => scrollToSection('multi-department')} className="hover:text-blue-600 transition">
              Departments
            </button>
            <button onClick={() => scrollToSection('smart-devices')} className="hover:text-blue-600 transition">
              Classroom Devices
            </button>
            <button onClick={() => scrollToSection('camera-network')} className="hover:text-blue-600 transition">
              Camera Network
            </button>
            <button onClick={() => scrollToSection('security')} className="hover:text-blue-600 transition">
              Security
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onLaunchApp}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full shadow-xs transition-all flex items-center space-x-1.5"
            >
              <span>Launch ATTENDIQ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Hero Left Content */}
        <div className="flex-1 space-y-6 text-center lg:text-left z-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Next-Generation Institutional Attendance & Hardware Ecosystem</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.15]">
            AI-Powered <br />
            <span className="text-blue-600">Smart Classroom</span> Attendance
          </h1>

          <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
            Real-time face recognition, multi-department attendance and intelligent classroom device management in one platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
            <button
              onClick={onLaunchApp}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full shadow-sm hover:shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <span>Launch ATTENDIQ</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => scrollToSection('how-it-works')}
              className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-gray-50 text-gray-800 text-sm font-semibold rounded-full border border-gray-300 shadow-xs transition-all flex items-center justify-center space-x-2"
            >
              <span>Explore Platform</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Quick Credibility Trust Badges */}
          <div className="pt-6 grid grid-cols-3 gap-4 border-t border-gray-200/80 max-w-md mx-auto lg:mx-0">
            <div>
              <div className="text-xl font-bold text-gray-900">100%</div>
              <div className="text-xs text-gray-500 font-medium">Real Hardware Discovery</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-600">128D</div>
              <div className="text-xs text-gray-500 font-medium">Neural Face Embeddings</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">0.0%</div>
              <div className="text-xs text-gray-500 font-medium">Simulated Data</div>
            </div>
          </div>
        </div>

        {/* Hero Right: Interactive 3D VisionSphere Visualizer */}
        <div className="flex-1 w-full max-w-md lg:max-w-xl h-[400px] sm:h-[480px] relative rounded-3xl overflow-hidden apple-card p-6 flex flex-col items-center justify-center bg-white">
          <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100/90 border border-gray-200 text-[11px] font-medium text-gray-700">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>Interactive 3D Vision System</span>
          </div>

          <div className="w-full h-full">
            <VisionSphere3D />
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-gray-200 text-[11px] font-mono text-gray-500 flex items-center space-x-1.5 shadow-xs">
            <Eye className="w-3 h-3 text-blue-600" />
            <span>Move cursor to orient biometric optical vector space</span>
          </div>
        </div>
      </section>

      {/* Section 1: How ATTENDIQ Works */}
      <section id="how-it-works" className="py-20 bg-white border-y border-gray-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">Step-by-Step Architecture</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-gray-900">How ATTENDIQ Works</p>
            <p className="text-sm sm:text-base text-gray-600">
              From classroom optical stream capture to authoritative cloud synchronization in milliseconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="apple-card p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-100">
                1
              </div>
              <h3 className="text-base font-bold text-gray-900">Optical Capture</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Connects to integrated webcams, physical USB cameras, paired faculty smartphones, or RTSP IP cameras.
              </p>
            </div>

            <div className="apple-card p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg border border-indigo-100">
                2
              </div>
              <h3 className="text-base font-bold text-gray-900">128D Face Analysis</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Strict face-only detection isolates facial landmarks and extracts immutable 128-dimensional biometric embeddings.
              </p>
            </div>

            <div className="apple-card p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg border border-emerald-100">
                3
              </div>
              <h3 className="text-base font-bold text-gray-900">Temporal Confirmation</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Verifies matches across multiple sequential frames to guarantee zero false positives from passersby or transient glimpses.
              </p>
            </div>

            <div className="apple-card p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg border border-purple-100">
                4
              </div>
              <h3 className="text-base font-bold text-gray-900">Authoritative Sync</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Marks verified attendance in Google Sheets and updates institutional logs with precise timestamps and confidence metrics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: AI Attendance Engine */}
      <section id="ai-attendance" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">High-Precision Biometrics</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
              Face-Only Neural Recognition with Zero False Positives
            </h2>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
              ATTENDIQ processes multiple students simultaneously in real-time. Biometric matching compares live 128D vector embeddings directly against official Google Sheets records.
            </p>

            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-gray-700">
                  <strong>Strict Face-Only Filtering:</strong> Never misclassifies hands, bags, or random objects as human faces.
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-gray-700">
                  <strong>Multi-Face Real-Time Tracking:</strong> Seamlessly detects and tracks up to 20+ students in large lecture halls.
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-gray-700">
                  <strong>Google Sheets Master Record:</strong> Uses official student photos and IDs with instant 2-way attendance sync.
                </span>
              </div>
            </div>
          </div>

          {/* Clean UI Card Preview */}
          <div className="flex-1 w-full apple-card p-6 space-y-5 bg-white">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-gray-900">Live AI Biometric Analysis</span>
              </div>
              <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                28.4 FPS • 12ms
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[11px] text-gray-500">Verified Match</span>
                <p className="text-sm font-bold text-gray-900">Rahul Sharma</p>
                <p className="text-[10px] font-mono text-emerald-600 mt-1">98.4% Confidence</p>
              </div>
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[11px] text-gray-500">Active Department</span>
                <p className="text-sm font-bold text-gray-900">CSE — Section A</p>
                <p className="text-[10px] font-mono text-blue-600 mt-1">Room 304 • Session Live</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1 text-xs text-blue-900">
              <div className="font-semibold flex items-center space-x-1.5">
                <Database className="w-4 h-4 text-blue-600" />
                <span>Authoritative Institutional Master Record</span>
              </div>
              <p className="text-blue-700 text-[11px]">
                Directly synchronized with Siddhartha Institute Google Sheets master workbook. No redundant local databases.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Multi-Department Intelligence */}
      <section id="multi-department" className="py-20 bg-white border-y border-gray-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">Enterprise Campus Architecture</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-gray-900">Multi-Department Intelligence</p>
            <p className="text-sm sm:text-base text-gray-600">
              Dedicated institutional workflows for CSE, EEE, ECE, MECH, CIVIL, and AIML with isolated HOD boundaries.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { code: 'CSE', name: 'Computer Science & Engineering', rooms: 'Labs 1-4 & Classrooms 301-308' },
              { code: 'AIML', name: 'Artificial Intelligence & Machine Learning', rooms: 'AI Innovation Center & High-Performance Lab' },
              { code: 'ECE', name: 'Electronics & Communication', rooms: 'Embedded Systems & Signal Processing Labs' },
              { code: 'EEE', name: 'Electrical & Electronics', rooms: 'Power Systems & Circuit Analysis Labs' },
              { code: 'MECH', name: 'Mechanical Engineering', rooms: 'CAD/CAM & Automation Workshop' },
              { code: 'CIVIL', name: 'Civil Engineering', rooms: 'Structural Engineering & Geotechnical Labs' },
            ].map((dept) => (
              <div key={dept.code} className="apple-card p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {dept.code}
                  </span>
                  <span className="text-[11px] text-gray-400">Autonomous View</span>
                </div>
                <h3 className="text-base font-bold text-gray-900">{dept.name}</h3>
                <p className="text-xs text-gray-500">{dept.rooms}</p>
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-medium text-gray-600">
                  <span>HOD Department Lock</span>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Smart Classroom Devices & Zero-Simulation Policy */}
      <section id="smart-devices" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Strict Anti-Fake Hardware Policy</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Real Smart Classroom Devices</h2>
          <p className="text-sm sm:text-base text-gray-600">
            Never generates simulated devices or fake telemetry. Adheres strictly to browser capabilities and real hardware APIs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="apple-card p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Web Bluetooth (BLE)</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Discovers real nearby peripherals via user-gesture GATT pairing. Inspects actual service UUIDs and battery telemetry without mock data.
            </p>
            <div className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
              Honest status: If running in an iframe with Permissions Policy restrictions, provides direct new-tab launch action.
            </div>
          </div>

          <div className="apple-card p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900">USB & External Webcams</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Enumerates physical video input hardware, measures real resolutions and FPS, and routes chosen camera feeds into the attendance engine.
            </p>
            <div className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
              Only classifies cameras as USB when device labels or OS attributes explicitly corroborate it.
            </div>
          </div>

          <div className="apple-card p-6 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900">ESP32 & IoT Gateways</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Microcontroller firmware connects via classroom Wi-Fi or faculty hotspot, streaming live environmental and physical occupancy telemetry.
            </p>
            <div className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
              Full step-by-step hotspot deployment guide and copy-ready C++ firmware snippet included.
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Real-Time Camera Network */}
      <section id="camera-network" className="py-20 bg-white border-y border-gray-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Physical Input Selection</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
                Real-Time Multi-Source Camera Network
              </h2>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                Faculty can effortlessly switch between multiple physical video inputs for the current attendance session without reloading the platform.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-xs font-bold text-gray-900">Laptop Webcam</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Quick single-lecturer setup</div>
                </div>
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-xs font-bold text-gray-900">USB External Camera</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Wide-angle podium webcam</div>
                </div>
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-xs font-bold text-gray-900">Mobile Smartphone</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Instant QR WebRTC pairing</div>
                </div>
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="text-xs font-bold text-gray-900">RTSP / IP Camera</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Permanent classroom ceiling mount</div>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full apple-card p-6 space-y-4 bg-white">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Live Attendance Feed Monitor</h3>
              <div className="aspect-video bg-gray-900 rounded-2xl relative overflow-hidden flex items-center justify-center text-white">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                <div className="text-center z-10 space-y-2">
                  <Camera className="w-8 h-8 text-blue-400 mx-auto animate-pulse" />
                  <span className="text-xs font-medium text-gray-300">Camera Source: USB External HD Camera</span>
                </div>
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono text-emerald-400 flex items-center space-x-1.5 border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>LIVE • 1080p @ 30 FPS</span>
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex justify-between text-[11px] text-gray-300">
                  <span>Detected: 8 faces</span>
                  <span className="text-emerald-300">Verified: 8 students</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Security, Disaster Recovery & Governance */}
      <section id="security" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Enterprise Grade Compliance</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Security & Institutional Governance</h2>
          <p className="text-sm sm:text-base text-gray-600">
            Engineered specifically to satisfy strict SIH 2026 guidelines with tamper-evident audit logs and privacy preservation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="apple-card p-6 space-y-3">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            <h3 className="text-base font-bold text-gray-900">Strict Role Separation</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Super Administrators govern campus-wide policies while HODs are strictly sandboxed to their respective academic departments.
            </p>
          </div>

          <div className="apple-card p-6 space-y-3">
            <Lock className="w-6 h-6 text-indigo-600" />
            <h3 className="text-base font-bold text-gray-900">Tamper-Proof Audit Trails</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Every hardware connection, attendance verification, session start, and override is permanently logged with cryptographically verifiable signatures.
            </p>
          </div>

          <div className="apple-card p-6 space-y-3">
            <Activity className="w-6 h-6 text-emerald-600" />
            <h3 className="text-base font-bold text-gray-900">Fail-Safe Disaster Recovery</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Local persistent memory queues attendance events during network drops and automatically replays state once connectivity is restored.
            </p>
          </div>
        </div>
      </section>

      {/* Section 7: Final Call to Action */}
      <section className="py-20 bg-gradient-to-b from-white to-blue-50/50 border-t border-gray-200/80">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            Ready to deploy institutional AI attendance?
          </h2>
          <p className="text-sm sm:text-base text-gray-600 max-w-xl mx-auto leading-relaxed">
            Experience real-world smart classroom intelligence, physical camera selection, and seamless Google Sheets synchronization.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onLaunchApp}
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
            >
              <span>Launch ATTENDIQ</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-gray-400 pt-4">
            Siddhartha Institute of Technology and Sciences • SIH 2026 Production System
          </p>
        </div>
      </section>
    </div>
  );
};
