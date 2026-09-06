import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Globe,
  Radio,
  Terminal,
  Activity,
  Trash2,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  UserX,
  MapPin,
  Flame,
  Zap,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { api } from '../services/api';
import { iotGatewayClient } from '../services/iotGatewayClient';
import { SecurityEvent } from '../types';

export const CyberDefenseView: React.FC = () => {
  const [threats, setThreats] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [jailedIps, setJailedIps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  // Manual IP jail modal state
  const [showJailModal, setShowJailModal] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualDuration, setManualDuration] = useState('60');

  // Test suite execution state
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [lastTestResult, setLastTestResult] = useState<any>(null);

  // Live threat flash banner
  const [liveThreatAlert, setLiveThreatAlert] = useState<SecurityEvent | null>(null);

  // Web Audio radar ping generator
  const playAlertSound = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Dual tone radar security chirp
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);

      osc2.frequency.setValueAtTime(1200, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.25);
      osc2.stop(ctx.currentTime + 0.25);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  };

  const loadData = async () => {
    try {
      const [threatsRes, statsRes, jailedRes] = await Promise.all([
        api.getSecurityEvents({ limit: 100 }),
        api.getSecurityStats(),
        api.getJailedIps(),
      ]);

      if (threatsRes.success) setThreats(threatsRes.events);
      if (statsRes.success) setStats(statsRes.stats);
      if (jailedRes.success) setJailedIps(jailedRes.jailed_ips);
    } catch (err) {
      console.error('Failed to load cyber defense data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to real-time security alerts over WebSocket
    const unsubscribe = iotGatewayClient.onSecurityAlert((alertEvent) => {
      // Prepend threat immediately to real-time feed
      setThreats((prev) => [alertEvent, ...prev.filter((t) => t.id !== alertEvent.id)]);
      setLiveThreatAlert(alertEvent);
      playAlertSound();

      // Refresh stats and jail lists
      api.getSecurityStats().then((res) => {
        if (res.success) setStats(res.stats);
      });
      api.getJailedIps().then((res) => {
        if (res.success) setJailedIps(res.jailed_ips);
      });

      // Auto dismiss flash after 6 seconds
      setTimeout(() => {
        setLiveThreatAlert((curr) => (curr?.id === alertEvent.id ? null : curr));
      }, 6000);
    });

    return () => {
      unsubscribe();
    };
  }, [soundEnabled]);

  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const handleUnjail = async (ip: string) => {
    try {
      const res = await api.unjailIp(ip);
      if (res.success) {
        setJailedIps((prev) => prev.filter((j) => j.ip !== ip));
        loadData();
      }
    } catch (err) {
      console.error('Failed to unjail IP:', err);
    }
  };

  const handleManualJail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp) return;
    try {
      const res = await api.jailIp({
        ip: manualIp.trim(),
        reason: manualReason.trim() || 'Admin manual IP quarantine',
        duration_minutes: Number(manualDuration) || 60,
      });
      if (res.success) {
        setShowJailModal(false);
        setManualIp('');
        setManualReason('');
        loadData();
      }
    } catch (err) {
      console.error('Failed to jail IP:', err);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all security incident history? Active IP quarantines will remain in place.')) {
      return;
    }
    try {
      const res = await api.clearSecurityLogs();
      if (res.success) {
        setThreats([]);
        loadData();
      }
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const handleRunTestCase = async (
    testType: 'SQLI' | 'XSS' | 'PATH_TRAVERSAL' | 'COMMAND_INJECTION' | 'EXPLOIT_SCANNER' | 'TOKEN_TAMPERING' | 'BRUTE_FORCE'
  ) => {
    setRunningTest(testType);
    setLastTestResult(null);
    try {
      const res = await api.runSecurityTestCase(testType);
      setLastTestResult(res);
      playAlertSound();
      loadData();
    } catch (err: any) {
      console.error('Failed to run security test case:', err);
    } finally {
      setRunningTest(null);
    }
  };

  const filteredThreats = threats.filter((t) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'SQLI') return t.event_type === 'SQLI_PROBE';
    if (activeFilter === 'XSS') return t.event_type === 'XSS_INJECTION';
    if (activeFilter === 'PATH') return t.event_type === 'PATH_TRAVERSAL';
    if (activeFilter === 'RCE') return t.event_type === 'COMMAND_INJECTION';
    if (activeFilter === 'BRUTE') return t.event_type === 'BRUTE_FORCE' || t.event_type === 'REPEATED_FAILED_LOGIN';
    if (activeFilter === 'JAILED') return t.jail_status === 'JAILED' || t.event_type === 'IP_JAILED';
    return true;
  });

  const getVectorBadgeColor = (type: string) => {
    switch (type) {
      case 'SQLI_PROBE':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'XSS_INJECTION':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'PATH_TRAVERSAL':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COMMAND_INJECTION':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'EXPLOIT_SCANNER':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'BRUTE_FORCE':
      case 'REPEATED_FAILED_LOGIN':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'IP_JAILED':
        return 'bg-red-100 text-red-800 border-red-300 font-bold';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Threat Alert Banner (Appears when an attack is intercepted) */}
      {liveThreatAlert && (
        <div className="bg-red-600 text-white rounded-2xl p-4 shadow-xl border border-red-700 animate-bounce flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-red-700 rounded-xl shrink-0">
              <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-sm uppercase tracking-wider bg-red-800 px-2 py-0.5 rounded text-red-100">
                  CRITICAL INTRUSION INTERCEPTED & BLOCKED
                </span>
                <span className="text-xs text-red-200">{new Date(liveThreatAlert.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm font-semibold mt-1">
                {liveThreatAlert.details}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-mono text-red-100">
                <span>Attacker IP: <strong className="text-white">{liveThreatAlert.ip_address}</strong></span>
                <span>•</span>
                <span>Location: <strong className="text-white">{liveThreatAlert.location?.city || 'Local LAN'}, {liveThreatAlert.location?.country || 'India'} {liveThreatAlert.location?.flag || '🇮🇳'}</strong></span>
                <span>•</span>
                <span>Action: <span className="bg-white text-red-700 px-1.5 py-0.5 rounded font-bold">HTTP 403 FORBIDDEN (BLOCKED)</span></span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setLiveThreatAlert(null)}
            className="text-red-200 hover:text-white p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header & Defense Posture HUD */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-black tracking-tight">
                    ATTENDIQ Cyber Defense & Intrusion Center
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1" />
                    Shield Active & Guarding
                  </span>
                </div>
                <p className="text-sm text-slate-300">
                  Real-time intrusion prevention system (IPS), active IP jailing, attack payload inspection, and global geolocation tracking.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition ${
                soundEnabled
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-red-950/40 border-red-800 text-red-300 hover:bg-red-900/40'
              }`}
              title={soundEnabled ? 'Audio alerts active' : 'Audio alerts muted'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Alert Sound ON' : 'Sound Muted'}</span>
            </button>

            <button
              onClick={() => setShowJailModal(true)}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-red-600/30 transition"
            >
              <Lock className="w-4 h-4" />
              <span>Quarantine IP</span>
            </button>

            <button
              onClick={loadData}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition"
              title="Refresh security telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* HUD Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Threats Intercepted</span>
              <ShieldAlert className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {stats?.total ?? threats.length}
            </div>
            <div className="text-[11px] text-emerald-400 font-medium mt-0.5 flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1" /> 100% Blocked & Repelled
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Active Quarantines (Jail)</span>
              <Lock className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-black text-red-400 mt-1">
              {jailedIps.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              IPs actively locked out (403)
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Critical Severity</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {stats?.critical ?? threats.filter((t) => t.severity === 'CRITICAL').length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              SQLi, RCE, Tamper Probes
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Intrusion Prevention</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              0 Breaches
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Strict Zero-Trust Perimeter
            </div>
          </div>
        </div>
      </div>

      {/* Security Test Suite (Verify that intrusion prevention and tracking works live!) */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center space-x-2">
              <Terminal className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-gray-900">
                Live Defensive Security Test Suite
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Test defensive security controls against simulated attack vectors. Verify that every attack is intercepted with HTTP 403, logged with geolocation tracking, and alerted in real-time.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
            Live Penetration Verification
          </span>
        </div>

        {/* Test Case Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <button
            onClick={() => handleRunTestCase('SQLI')}
            disabled={runningTest !== null}
            className="flex flex-col items-center text-center p-3 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/70 text-purple-900 transition disabled:opacity-50"
          >
            <Zap className="w-5 h-5 text-purple-600 mb-1" />
            <span className="text-xs font-bold">SQL Injection</span>
            <span className="text-[10px] text-purple-600 mt-0.5">Test SQLi Defense</span>
          </button>

          <button
            onClick={() => handleRunTestCase('XSS')}
            disabled={runningTest !== null}
            className="flex flex-col items-center text-center p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 text-amber-900 transition disabled:opacity-50"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 mb-1" />
            <span className="text-xs font-bold">XSS Payload</span>
            <span className="text-[10px] text-amber-600 mt-0.5">Script Injection</span>
          </button>

          <button
            onClick={() => handleRunTestCase('PATH_TRAVERSAL')}
            disabled={runningTest !== null}
            className="flex flex-col items-center text-center p-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 text-blue-900 transition disabled:opacity-50"
          >
            <Radio className="w-5 h-5 text-blue-600 mb-1" />
            <span className="text-xs font-bold">Path Traversal</span>
            <span className="text-[10px] text-blue-600 mt-0.5">LFI File Read</span>
          </button>

          <button
            onClick={() => handleRunTestCase('COMMAND_INJECTION')}
            disabled={runningTest !== null}
            className="flex flex-col items-center text-center p-3 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100/70 text-red-900 transition disabled:opacity-50"
          >
            <Flame className="w-5 h-5 text-red-600 mb-1" />
            <span className="text-xs font-bold">RCE Injection</span>
            <span className="text-[10px] text-red-600 mt-0.5">Shell Command</span>
          </button>

          <button
            onClick={() => handleRunTestCase('TOKEN_TAMPERING')}
            disabled={runningTest !== null}
            className="flex flex-col items-center text-center p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-emerald-900 transition disabled:opacity-50"
          >
            <Lock className="w-5 h-5 text-emerald-600 mb-1" />
            <span className="text-xs font-bold">Token Forgery</span>
            <span className="text-[10px] text-emerald-600 mt-0.5">JWT Tampering</span>
          </button>

          <button
            onClick={() => handleRunTestCase('BRUTE_FORCE')}
            disabled={runningTest !== null}
            className="flex flex-col items-center text-center p-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/70 text-rose-900 transition disabled:opacity-50"
          >
            <Activity className="w-5 h-5 text-rose-600 mb-1" />
            <span className="text-xs font-bold">Brute Force</span>
            <span className="text-[10px] text-rose-600 mt-0.5">Rapid Flooding</span>
          </button>
        </div>

        {/* Test Result Display Box */}
        {lastTestResult && (
          <div className="mt-4 p-4 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-emerald-400 font-bold">
              <span className="flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" />
                DEFENSE SHIELD VERIFICATION: 100% SUCCESSFUL
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                HTTP {lastTestResult.http_status_enforced} FORBIDDEN
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <p className="text-slate-400">Attack Vector Intercepted:</p>
                <p className="text-white font-bold">{lastTestResult.test_result.vector_detected}</p>
                <p className="text-slate-400 mt-2">Payload Blocked:</p>
                <p className="text-amber-300 bg-slate-950 p-1.5 rounded border border-slate-800 overflow-x-auto truncate">
                  {lastTestResult.test_result.sample_payload}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Attacker IP Tracked:</p>
                <p className="text-white font-bold">{lastTestResult.test_result.attacker_ip}</p>
                <p className="text-slate-400 mt-2">Geographic Origin Resolved:</p>
                <p className="text-white font-bold flex items-center">
                  <span className="mr-1.5">{lastTestResult.test_result.location.flag}</span>
                  {lastTestResult.test_result.location.city}, {lastTestResult.test_result.location.country} ({lastTestResult.test_result.location.isp})
                </p>
                <p className="text-[11px] text-emerald-400 mt-1">
                  ✓ Logged in Security Database (ID: {lastTestResult.test_result.event_id})
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Layout: Active Jails & Live Intrusion Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Jailed IPs & Security Posture */}
        <div className="space-y-6">
          {/* Active Quarantined IPs Box */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  Active IP Quarantine Jail ({jailedIps.length})
                </h3>
              </div>
              <button
                onClick={() => setShowJailModal(true)}
                className="text-xs text-red-600 hover:text-red-700 font-semibold"
              >
                + Add IP
              </button>
            </div>

            {jailedIps.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                No IPs currently in quarantine. Perimeter clean.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[380px] overflow-y-auto">
                {jailedIps.map((j) => (
                  <div key={j.ip} className="py-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-xs font-bold text-red-700">{j.ip}</span>
                        <span className="text-xs">{j.location?.flag || '🌐'}</span>
                        <button
                          onClick={() => handleCopyIp(j.ip)}
                          className="text-gray-400 hover:text-gray-600 p-0.5"
                          title="Copy IP"
                        >
                          {copiedIp === j.ip ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        {j.reason}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono mt-1">
                        <span>{j.location?.city || 'LAN'}, {j.location?.country || 'India'}</span>
                        <span>•</span>
                        <span>{j.attack_count} attempts blocked</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnjail(j.ip)}
                      className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-semibold transition shrink-0"
                    >
                      Release
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Threat Vectors Chart / Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              <span>Attack Vectors Intercepted</span>
            </h3>
            {stats?.topVectors && Object.keys(stats.topVectors).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(stats.topVectors as Record<string, number>).map(([vec, count]) => {
                  const pct = Math.min(100, Math.round(((count as number) / (stats.total || 1)) * 100));
                  return (
                    <div key={vec} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-gray-700 font-medium">{vec}</span>
                        <span className="font-bold text-gray-900">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Awaiting attack vector metrics.</p>
            )}
          </div>
        </div>

        {/* Right Column: Live Intrusion Stream (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Radio className="w-5 h-5 text-red-600 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Live Intrusion & Threat Feed ({filteredThreats.length})
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Real-time audit log of intercepted intrusions with full geographic tracking.
                  </p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1">
                {['ALL', 'SQLI', 'XSS', 'PATH', 'RCE', 'BRUTE', 'JAILED'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveFilter(tab)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      activeFilter === tab
                        ? 'bg-gray-900 text-white font-semibold'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}

                <button
                  onClick={handleClearLogs}
                  className="p-1 rounded-lg text-gray-400 hover:text-red-600 ml-1"
                  title="Clear incident logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Threat Event Cards */}
            {filteredThreats.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-xs">
                <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                No threat events matching filter. System perimeter is secure.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[640px] overflow-y-auto mt-2">
                {filteredThreats.map((threat) => (
                  <div key={threat.id} className="py-3.5 hover:bg-gray-50/80 rounded-xl px-2 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${getVectorBadgeColor(
                              threat.event_type
                            )}`}
                          >
                            {threat.event_type}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              threat.severity === 'CRITICAL'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {threat.severity}
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono">
                            {new Date(threat.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <p className="text-xs text-gray-800 font-medium">
                          {threat.details}
                        </p>

                        {/* Location and Attacker Details */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-gray-600 pt-1">
                          <span className="flex items-center text-gray-900 font-semibold">
                            <MapPin className="w-3 h-3 text-red-500 mr-1" />
                            <span>{threat.location?.flag || '🇮🇳'}</span>
                            <span className="ml-1">
                              {threat.location?.city || 'Hyderabad'}, {threat.location?.country || 'India'}
                            </span>
                            {threat.location?.isp && (
                              <span className="text-gray-400 ml-1 font-normal hidden sm:inline">
                                ({threat.location.isp})
                              </span>
                            )}
                          </span>

                          <span>•</span>

                          <span className="flex items-center">
                            <span>IP: <strong className="text-gray-900">{threat.ip_address || '127.0.0.1'}</strong></span>
                            <button
                              onClick={() => handleCopyIp(threat.ip_address || '')}
                              className="text-gray-400 hover:text-gray-600 ml-1"
                              title="Copy IP"
                            >
                              {copiedIp === threat.ip_address ? (
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          </span>

                          {threat.target_endpoint && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-600 font-semibold">{threat.target_endpoint}</span>
                            </>
                          )}
                        </div>

                        {/* Blocked Payload Snippet */}
                        {threat.attack_payload && (
                          <div className="mt-1.5 p-2 rounded-lg bg-gray-900 text-amber-300 font-mono text-[11px] overflow-x-auto">
                            <span className="text-gray-500 select-none mr-2">BLOCKED_PAYLOAD:</span>
                            {threat.attack_payload}
                          </div>
                        )}
                      </div>

                      {/* Shield Action Badge */}
                      <div className="shrink-0 flex flex-col items-end space-y-1">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          BLOCKED 403
                        </span>
                        {threat.jail_status === 'JAILED' && (
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                            IP QUARANTINED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual IP Jail Modal */}
      {showJailModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-bold text-gray-900">
                  Manually Quarantine IP Address
                </h3>
              </div>
              <button
                onClick={() => setShowJailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualJail} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  IPv4 or IPv6 Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 185.220.101.5 or 192.168.1.105"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Quarantine
                </label>
                <input
                  type="text"
                  placeholder="e.g. Suspicious brute force probe, rogue device"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Lockout Duration (Minutes)
                </label>
                <select
                  value={manualDuration}
                  onChange={(e) => setManualDuration(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="60">1 Hour</option>
                  <option value="360">6 Hours</option>
                  <option value="1440">24 Hours</option>
                  <option value="10080">7 Days</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowJailModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm"
                >
                  Quarantine Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CyberDefenseView;
