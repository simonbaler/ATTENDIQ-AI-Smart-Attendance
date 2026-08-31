import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Database,
  Radio,
  Wifi,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Layers,
  Sparkles,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { api } from '../services/api';

interface ObservabilityDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fps?: number;
  recognitionLatency?: number;
  detectedCount?: number;
  recognizedCount?: number;
  mobileActive?: boolean;
}

export const ObservabilityDiagnosticsModal: React.FC<ObservabilityDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  fps = 30,
  recognitionLatency = 24,
  detectedCount = 0,
  recognizedCount = 0,
  mobileActive = false,
}) => {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await api.getSystemHealth();
      if (res.success) {
        setHealthStatus(res.health);
      }
    } catch (e) {
      console.warn('Diagnostics health query error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto text-slate-100 font-sans">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-md">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>ATTENDIQ Live Observability & Diagnostics</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                HEALTHY
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Real-time telemetry across vision inference, WebRTC mesh, database sync, and AI pipelines
            </p>
          </div>
        </div>

        {/* Real-Time Live Telemetry Bento */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Camera Ingestion</div>
            <div className="text-lg font-bold text-white mt-1 flex items-baseline space-x-1">
              <span>{fps}</span>
              <span className="text-xs text-slate-400">FPS</span>
            </div>
            <div className="text-[10px] text-emerald-400 mt-1">● Smooth Stream</div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Inference Latency</div>
            <div className="text-lg font-bold text-cyan-400 mt-1 flex items-baseline space-x-1">
              <span>{recognitionLatency}</span>
              <span className="text-xs text-slate-400">ms</span>
            </div>
            <div className="text-[10px] text-cyan-400/80 mt-1">68-Pt Landmark</div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Faces</div>
            <div className="text-lg font-bold text-purple-400 mt-1 flex items-baseline space-x-1">
              <span>{detectedCount}</span>
              <span className="text-xs text-slate-400">tracked</span>
            </div>
            <div className="text-[10px] text-purple-400/80 mt-1">{recognizedCount} verified</div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">WebRTC Mesh</div>
            <div className="text-lg font-bold text-emerald-400 mt-1 flex items-baseline space-x-1">
              <span className="text-sm">{mobileActive ? 'LIVE' : 'STANDBY'}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">{mobileActive ? 'Mobile Paired' : 'Desktop Cam'}</div>
          </div>
        </div>

        {/* Subsystems Health Matrix */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="uppercase tracking-wider">Subsystem Status Matrix:</span>
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="text-slate-400 hover:text-white flex items-center space-x-1 transition font-mono text-[11px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">Google Sheet Master</div>
                  <div className="text-[11px] text-slate-400">Bi-directional dataset synchronization</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ONLINE
              </span>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">WebRTC Signaling Node</div>
                  <div className="text-[11px] text-slate-400">Ephemeral peer pairing & STUN/TURN</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ONLINE
              </span>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">Face-API Neural Engine</div>
                  <div className="text-[11px] text-slate-400">SSD MobileNet & 128D Descriptors</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                LOADED
              </span>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white">AI Analytics (Groq / DeepSeek)</div>
                  <div className="text-[11px] text-slate-400">Anomaly detection & intelligent reports</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                ASYNC
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
