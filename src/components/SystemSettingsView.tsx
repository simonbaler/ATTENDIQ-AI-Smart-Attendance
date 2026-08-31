import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Sliders,
  FileText,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wifi,
  Globe,
  Radio,
  Video,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Activity,
  Server,
  Zap,
} from 'lucide-react';
import { SystemSettings, AuditLog, RegisteredCamera, ReachabilityTestResult } from '../types';
import { api } from '../services/api';

export const SystemSettingsView: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [cameras, setCameras] = useState<RegisteredCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reachability test state
  const [testUrlInput, setTestUrlInput] = useState('');
  const [testingReachability, setTestingReachability] = useState(false);
  const [reachabilityResult, setReachabilityResult] = useState<ReachabilityTestResult | null>(null);

  // Camera management modal state
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [cameraForm, setCameraForm] = useState<Partial<RegisteredCamera>>({
    name: '',
    classroom: 'LH-301',
    building: 'Sir C.V. Raman Block',
    department: 'Computer Science & Engineering',
    type: 'CLASSROOM_CAMERA',
    connection_type: 'RTSP',
    ip_address: '192.168.1.101',
    rtsp_url: 'rtsp://admin:sits2026@192.168.1.101:554/live',
    onvif_port: 8000,
    stream_profile: '1080p_30fps_H264',
  });
  const [testingCameraId, setTestingCameraId] = useState<string | null>(null);
  const [discoveringOnvif, setDiscoveringOnvif] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);

  const fetchSettingsAndLogs = async () => {
    setLoading(true);
    try {
      const [settingsRes, logsRes, camerasRes] = await Promise.all([
        api.getSettings(),
        api.getAuditLogs(100),
        api.getCameras(),
      ]);
      if (settingsRes.success) {
        setSettings(settingsRes.settings);
        if (!testUrlInput) {
          setTestUrlInput(
            settingsRes.settings.app_public_url ||
            settingsRes.settings.dev_public_origin ||
            window.location.origin
          );
        }
      }
      if (logsRes.success) setAuditLogs(logsRes.logs);
      if (camerasRes.success) setCameras(camerasRes.cameras);
    } catch (err) {
      console.error('Failed to load settings, cameras, or logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndLogs();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await api.updateSettings(settings);
      if (res.success) {
        setSettings(res.settings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        // Refresh audit logs
        const logsRes = await api.getAuditLogs(100);
        if (logsRes.success) setAuditLogs(logsRes.logs);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRunReachabilityTest = async () => {
    if (!testUrlInput.trim()) return;
    setTestingReachability(true);
    setReachabilityResult(null);
    try {
      const result = await api.testReachability(testUrlInput.trim());
      setReachabilityResult(result);
    } catch (err: any) {
      setReachabilityResult({
        success: false,
        url: testUrlInput.trim(),
        reachable: false,
        is_ai_studio_preview: testUrlInput.includes('aistudio.google.com'),
        is_localhost: testUrlInput.includes('localhost'),
        has_google_login_redirect: false,
        message: err.message || 'Failed to execute reachability probe.',
      });
    } finally {
      setTestingReachability(false);
    }
  };

  const handleTestCamera = async (id: string) => {
    setTestingCameraId(id);
    try {
      const res = await api.testCameraConnection(id);
      if (res.success) {
        setCameras((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, status: 'ONLINE', latency_ms: res.latency_ms, fps: res.fps } : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to test camera:', err);
    } finally {
      setTestingCameraId(null);
    }
  };

  const handleDeleteCamera = async (id: string) => {
    if (!confirm('Are you sure you want to remove this registered camera?')) return;
    try {
      const res = await api.deleteCamera(id);
      if (res.success) {
        setCameras((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete camera:', err);
    }
  };

  const handleSaveNewCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.registerCamera(cameraForm);
      if (res.success && res.camera) {
        setCameras((prev) => [...prev, res.camera!]);
        setIsCameraModalOpen(false);
        setCameraForm({
          name: '',
          classroom: 'LH-301',
          building: 'Sir C.V. Raman Block',
          department: 'Computer Science & Engineering',
          type: 'CLASSROOM_CAMERA',
          connection_type: 'RTSP',
        });
      }
    } catch (err) {
      console.error('Failed to register camera:', err);
    }
  };

  const handleDiscoverOnvif = async () => {
    setDiscoveringOnvif(true);
    try {
      const res = await api.discoverOnvifCameras();
      if (res.success && res.devices) {
        setDiscoveredDevices(res.devices);
      }
    } catch (err) {
      console.error('ONVIF discovery error:', err);
    } finally {
      setDiscoveringOnvif(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              AI Face Recognition & Institutional Configuration
            </h2>
          </div>
          {saveSuccess && (
            <span className="flex items-center space-x-1 text-xs text-emerald-400 font-semibold bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Settings Saved</span>
            </span>
          )}
        </div>

        {settings && (
          <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
            {/* Core AI Recognition Thresholds */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Biometric & Recognition Verification Parameters</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Recognition Distance Threshold: <span className="font-mono text-blue-400">{settings.recognition_threshold}</span>
                  </label>
                  <input
                    type="range"
                    min="0.30"
                    max="0.65"
                    step="0.01"
                    value={settings.recognition_threshold}
                    onChange={(e) => setSettings({ ...settings, recognition_threshold: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Lower value (e.g. 0.45) = stricter match. Higher value (e.g. 0.58) = more tolerant under angle changes.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Temporal Confirmation Frames: <span className="font-mono text-blue-400">{settings.temporal_confirmation_frames} frames</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.temporal_confirmation_frames}
                    onChange={(e) => setSettings({ ...settings, temporal_confirmation_frames: parseInt(e.target.value) || 3 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Consecutive video frames a face must be recognized before logging attendance.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Academic Session</label>
                  <input
                    type="text"
                    value={settings.academic_session}
                    onChange={(e) => setSettings({ ...settings, academic_session: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Institution Code</label>
                  <input
                    type="text"
                    value={settings.institution_code}
                    onChange={(e) => setSettings({ ...settings, institution_code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Institution Legal Name</label>
                  <input
                    type="text"
                    value={settings.institution_name}
                    onChange={(e) => setSettings({ ...settings, institution_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Network Reachability & Public Mobile Origin */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>Network Reachability & Mobile QR Public Origin (Phase 10)</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Ensures scanned QR codes can be opened on physical smartphones without 403 / auth redirects.
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Application Public URL (Production / Cloud Run / Domain)
                  </label>
                  <input
                    type="text"
                    placeholder="https://attend.yourcollege.edu or Cloud Run URL"
                    value={settings.app_public_url || ''}
                    onChange={(e) => setSettings({ ...settings, app_public_url: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    The public HTTPS origin that smartphones will load when scanning the pairing QR code.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Development LAN Origin (Campus Wi-Fi / Local Subnet)
                  </label>
                  <input
                    type="text"
                    placeholder="http://192.168.1.50:3000"
                    value={settings.dev_lan_origin || ''}
                    onChange={(e) => setSettings({ ...settings, dev_lan_origin: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Fallback IP address when testing on local Wi-Fi router (bypasses localhost isolation).
                  </p>
                </div>
              </div>
            </div>

            {/* WebRTC STUN / TURN Configuration */}
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center space-x-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>WebRTC STUN / TURN NAT Traversal Infrastructure</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                <div className="md:col-span-3">
                  <label className="block font-semibold text-slate-300 mb-1">
                    STUN Server URLs (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="stun:stun.l.google.com:19302, stun:stun.cloudflare.com:3478"
                    value={(settings.webrtc_stun_urls || []).join(', ')}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        webrtc_stun_urls: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">TURN Server URL</label>
                  <input
                    type="text"
                    placeholder="turn:turn.yourinstitution.edu:3478"
                    value={settings.webrtc_turn_url || ''}
                    onChange={(e) => setSettings({ ...settings, webrtc_turn_url: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">TURN Username</label>
                  <input
                    type="text"
                    placeholder="turn_user"
                    value={settings.webrtc_turn_username || ''}
                    onChange={(e) => setSettings({ ...settings, webrtc_turn_username: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">TURN Password / Secret</label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={settings.webrtc_turn_credential || ''}
                    onChange={(e) => setSettings({ ...settings, webrtc_turn_credential: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow transition flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Interactive Reachability Diagnostic Tool */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Mobile Reachability & Network Diagnostic Tool
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            Probe any server endpoint to verify physical mobile reachability
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="e.g. https://ais-dev-bpayzufx5syjwygztm4y7l-460380840568.asia-southeast1.run.app"
              value={testUrlInput}
              onChange={(e) => setTestUrlInput(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleRunReachabilityTest}
              disabled={testingReachability || !testUrlInput.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow transition flex items-center justify-center space-x-2 shrink-0"
            >
              <Zap className={`w-4 h-4 ${testingReachability ? 'animate-spin' : ''}`} />
              <span>{testingReachability ? 'Probing Endpoint...' : 'Test Reachability'}</span>
            </button>
          </div>

          {reachabilityResult && (
            <div
              className={`p-4 rounded-xl border ${
                reachabilityResult.reachable
                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
              }`}
            >
              <div className="flex items-start space-x-3">
                {reachabilityResult.reachable ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 flex-1">
                  <div className="font-semibold text-sm flex items-center justify-between">
                    <span>
                      {reachabilityResult.reachable ? 'Reachable from Mobile Devices' : 'Reachability Issue Detected'}
                    </span>
                    {reachabilityResult.latency_ms && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-black/40">
                        {reachabilityResult.latency_ms} ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs">{reachabilityResult.message}</p>
                  {reachabilityResult.diagnostics?.suggested_fix && (
                    <p className="text-xs text-amber-300 font-medium mt-2 bg-black/30 p-2.5 rounded-lg border border-amber-500/30">
                      💡 <strong>Recommended Action:</strong> {reachabilityResult.diagnostics.suggested_fix}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Classroom & IP Cameras Registry (Phase 10) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Classroom & Network Camera Fleet Registry
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDiscoverOnvif}
              disabled={discoveringOnvif}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Radio className={`w-3.5 h-3.5 text-cyan-400 ${discoveringOnvif ? 'animate-pulse' : ''}`} />
              <span>{discoveringOnvif ? 'Scanning ONVIF...' : 'Discover Network Cameras'}</span>
            </button>
            <button
              onClick={() => setIsCameraModalOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Camera</span>
            </button>
          </div>
        </div>

        {/* Discovered devices prompt */}
        {discoveredDevices.length > 0 && (
          <div className="p-3 bg-cyan-950/40 border border-cyan-800/80 rounded-xl text-xs space-y-2">
            <div className="font-semibold text-cyan-300 flex items-center justify-between">
              <span>Discovered {discoveredDevices.length} ONVIF / RTSP Cameras on Subnet</span>
              <button
                onClick={() => setDiscoveredDevices([])}
                className="text-slate-400 hover:text-white text-[11px]"
              >
                Dismiss
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {discoveredDevices.map((dev, i) => (
                <div key={i} className="p-2 bg-black/40 rounded-lg border border-cyan-900/50 space-y-1">
                  <div className="font-semibold text-white truncate">{dev.manufacturer} {dev.model}</div>
                  <div className="text-slate-400 font-mono text-[10px]">IP: {dev.ip_address}:{dev.rtsp_port}</div>
                  <button
                    onClick={() => {
                      setCameraForm({
                        name: `${dev.manufacturer} ${dev.model}`,
                        classroom: 'LH-301',
                        building: 'Sir C.V. Raman Block',
                        department: 'Computer Science & Engineering',
                        type: 'CLASSROOM_CAMERA',
                        connection_type: 'ONVIF',
                        ip_address: dev.ip_address,
                        rtsp_url: `rtsp://admin:sits2026@${dev.ip_address}:${dev.rtsp_port}/stream1`,
                        onvif_port: dev.onvif_port,
                        stream_profile: dev.profiles[0] || '1080p_30fps',
                      });
                      setIsCameraModalOpen(true);
                    }}
                    className="w-full mt-1 py-1 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded text-[10px] font-semibold"
                  >
                    Import to Registry
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registered Cameras Table */}
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Camera Name</th>
                <th className="py-2.5 px-3">Classroom / Location</th>
                <th className="py-2.5 px-3">Protocol / IP</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Latency / FPS</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {cameras.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-500 font-sans">
                    No classroom cameras registered yet.
                  </td>
                </tr>
              ) : (
                cameras.map((cam) => (
                  <tr key={cam.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-sans font-medium text-white flex items-center space-x-2">
                      <Video className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{cam.name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans">
                      <span className="font-semibold text-blue-300">{cam.classroom}</span> ({cam.building})
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-semibold text-[10px] mr-1.5">
                        {cam.connection_type}
                      </span>
                      {cam.ip_address || 'WebRTC Peer'}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          cam.status === 'ONLINE'
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                            : 'bg-rose-950/60 text-rose-400 border-rose-800'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cam.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                        {cam.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {cam.latency_ms ? `${cam.latency_ms}ms` : '—'} / {cam.fps ? `${cam.fps} FPS` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans space-x-2">
                      <button
                        onClick={() => handleTestCamera(cam.id)}
                        disabled={testingCameraId === cam.id}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition"
                      >
                        {testingCameraId === cam.id ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button
                        onClick={() => handleDeleteCamera(cam.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Camera Registration Modal */}
      {isCameraModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Video className="w-5 h-5 text-cyan-400" />
                <span>Register Classroom / IP Camera</span>
              </h3>
              <button
                onClick={() => setIsCameraModalOpen(false)}
                className="text-slate-400 hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewCamera} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Camera Friendly Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. C-204 Front AI Camera"
                    value={cameraForm.name || ''}
                    onChange={(e) => setCameraForm({ ...cameraForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Classroom / Room *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LH-301"
                    value={cameraForm.classroom || ''}
                    onChange={(e) => setCameraForm({ ...cameraForm, classroom: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Building Block</label>
                  <input
                    type="text"
                    placeholder="Sir C.V. Raman Block"
                    value={cameraForm.building || ''}
                    onChange={(e) => setCameraForm({ ...cameraForm, building: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Camera Type</label>
                  <select
                    value={cameraForm.type || 'CLASSROOM_CAMERA'}
                    onChange={(e) => setCameraForm({ ...cameraForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="CLASSROOM_CAMERA">Classroom Ceiling Camera</option>
                    <option value="IP_CAMERA">Network IP Camera (ONVIF/RTSP)</option>
                    <option value="USB_WEBCAM">USB / Integrated Webcam</option>
                    <option value="MOBILE_CAMERA">Mobile Phone Companion</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Connection Protocol</label>
                  <select
                    value={cameraForm.connection_type || 'RTSP'}
                    onChange={(e) => setCameraForm({ ...cameraForm, connection_type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="RTSP">RTSP H.264 Stream</option>
                    <option value="ONVIF">ONVIF Profile S/T</option>
                    <option value="WEBRTC">WebRTC P2P Gateway</option>
                    <option value="USB">USB UVC Driver</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">RTSP Stream URL / Host IP</label>
                  <input
                    type="text"
                    placeholder="rtsp://admin:sits2026@192.168.1.101:554/live"
                    value={cameraForm.rtsp_url || ''}
                    onChange={(e) => setCameraForm({ ...cameraForm, rtsp_url: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCameraModalOpen(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold shadow"
                >
                  Register Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Institutional Security & Operational Audit Trail
            </h2>
          </div>
          <button
            onClick={fetchSettingsAndLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Target</th>
                <th className="py-2.5 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-500 font-sans">
                    No audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-semibold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 font-sans font-medium">{log.performed_by}</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {log.target_type}: {log.target_id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans text-xs">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
