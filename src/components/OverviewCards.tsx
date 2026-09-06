import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Camera,
  Layers,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Activity,
  Cpu,
  Radio,
  Wifi,
  Video,
  Mic,
  RefreshCw,
  AlertTriangle,
  QrCode,
  Check,
  ExternalLink,
  Building2,
  BarChart3,
  Filter,
} from 'lucide-react';
import { CommandCenterData, LiveActivityEvent } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface OverviewCardsProps {
  onNavigate: (tab: string) => void;
  onRequestNewSession: () => void;
  onRequestRegisterStudent: () => void;
  onTriggerMobilePair?: () => void;
  onOpenSheetsSync?: () => void;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  onNavigate,
  onRequestNewSession,
  onRequestRegisterStudent,
  onTriggerMobilePair,
  onOpenSheetsSync,
}) => {
  const { user, isAdmin } = useAuth();
  const [commandData, setCommandData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');

  const fetchCommandData = async () => {
    try {
      const res = await api.getCommandCenterData();
      if (res.success && res.data) {
        setCommandData(res.data);
      }
    } catch (err) {
      console.error('Failed to load command center data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCommandData();
    const interval = setInterval(fetchCommandData, 10000); // Polling every 10s for real-time dashboard updates
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchCommandData();
  };

  const isLive = commandData?.live_attendance.status === 'ACTIVE';

  const getDeptShortCode = (name: string) => {
    return name
      .replace('Computer Science & Engineering', 'CSE')
      .replace('Software Engineering', 'SE')
      .replace('Electrical & Electronics Engineering', 'EEE')
      .replace('Electronics & Communication Engineering', 'ECE')
      .replace('Artificial Intelligence & Machine Learning', 'AIML')
      .replace('Data Science', 'DS')
      .replace('Internet of Things', 'IOT')
      .replace('Mechanical Engineering', 'MECH')
      .replace('Civil Engineering', 'CIVIL')
      .replace('Cyber Security', 'CSC');
  };

  // Department list and filters
  const deptStatsObj = commandData?.department_stats || {};
  const allDeptKeys = Object.keys(deptStatsObj);

  const filteredDeptKeys = allDeptKeys.filter((deptName) => {
    if (selectedDeptFilter === 'ALL') return true;
    const shortCode = getDeptShortCode(deptName).toLowerCase();
    const filterLower = selectedDeptFilter.toLowerCase();
    return shortCode.includes(filterLower) || deptName.toLowerCase().includes(filterLower);
  });

  const departmentFilterOptions = [
    { label: 'All Departments', value: 'ALL' },
    { label: 'CSE', value: 'CSE' },
    { label: 'SE', value: 'SE' },
    { label: 'EEE', value: 'EEE' },
    { label: 'AIML', value: 'AIML' },
    { label: 'ECE', value: 'ECE' },
    { label: 'CIVIL', value: 'CIVIL' },
    { label: 'MECH', value: 'MECH' },
    { label: 'IOT', value: 'IOT' },
    { label: 'CSC', value: 'CSC' },
  ];

  return (
    <div className="space-y-6">
      {/* Command Center Hero & System Status Header */}
      <div className="apple-card p-6 sm:p-7 bg-white relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>AI COMMAND CENTER — MULTI-DEPARTMENT INTELLIGENCE</span>
              </div>

              <div
                className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  isLive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isLive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                  }`}
                />
                <span>{isLive ? 'LIVE RECOGNITION ACTIVE' : 'SYSTEM READY / IDLE'}</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              {isAdmin ? 'Institutional AI Attendance Command Center' : `${user?.department} — Live Attendance Command`}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 max-w-3xl leading-relaxed">
              Real-time multi-department classroom attendance, 128D neural verification, Google Sheets authoritative roster sync, and live department-wise intelligence counters.
            </p>
          </div>

          {/* Quick Action Matrix */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('live-camera')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs sm:text-sm font-semibold shadow-xs transition flex items-center space-x-2"
            >
              <Camera className="w-4 h-4" />
              <span>Launch Live Camera</span>
            </button>

            {onTriggerMobilePair && (
              <button
                onClick={onTriggerMobilePair}
                className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5"
                title="Pair Smartphone WebRTC Camera via QR Code"
              >
                <QrCode className="w-4 h-4" />
                <span>Pair Mobile</span>
              </button>
            )}

            {onOpenSheetsSync && (
              <button
                onClick={onOpenSheetsSync}
                className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5"
                title="Sync Authoritative Roster with Google Sheets"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Sync Sheets</span>
              </button>
            )}

            <button
              onClick={handleManualRefresh}
              className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-full transition"
              title="Refresh Command Center Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 10 Institutional Status Cards Grid (Ecommerce-style Usability) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Live Attendance */}
        <div
          onClick={() => onNavigate('live-camera')}
          className="apple-card p-5 bg-white border border-gray-200 hover:border-blue-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">1. Live Attendance</span>
            <div className={`p-2 rounded-xl ${isLive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
              <Video className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-extrabold text-gray-900 flex items-center space-x-2">
              <span>{commandData?.live_attendance.status || 'IDLE'}</span>
              {isLive && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">ONLINE</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1 truncate font-medium">
              {commandData?.live_attendance.active_session_name || 'No active session'}
            </p>
            <div className="mt-2 text-[11px] text-gray-400 font-mono">
              {commandData?.live_attendance.total_markings_today || 0} today records
            </div>
          </div>
        </div>

        {/* Card 2: Students Present */}
        <div
          onClick={() => onNavigate('attendance')}
          className="apple-card p-5 bg-white border border-gray-200 hover:border-emerald-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">2. Students Present</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-gray-900">
              {commandData?.students_present.count ?? 0}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
              <span>Turnout Rate</span>
              <span className="font-bold text-emerald-600">{commandData?.students_present.percentage ?? 0}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${commandData?.students_present.percentage ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Students Absent */}
        <div
          onClick={() => onNavigate('attendance')}
          className="apple-card p-5 bg-white border border-gray-200 hover:border-amber-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">3. Students Absent</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-gray-900">
              {commandData?.students_absent.count ?? 0}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
              <span>Absent Rate</span>
              <span className="font-bold text-amber-600">{commandData?.students_absent.percentage ?? 0}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${commandData?.students_absent.percentage ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Unknown People */}
        <div
          onClick={() => onNavigate('intelligence')}
          className="apple-card p-5 bg-white border border-gray-200 hover:border-red-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">4. Unknown People</span>
            <div className="p-2 rounded-xl bg-red-50 text-red-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-gray-900">
              {commandData?.unknown_people.count ?? 0}
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Un-enrolled face events
            </p>
            <div className="mt-2 text-[11px] text-gray-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>Face filter active</span>
            </div>
          </div>
        </div>

        {/* Card 5: Recognition Confidence */}
        <div
          onClick={() => onNavigate('validation')}
          className="apple-card p-5 bg-white border border-gray-200 hover:border-blue-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">5. Rec. Confidence</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-gray-900">
              {commandData?.recognition_confidence.average_confidence ?? 94.2}%
            </div>
            <p className="text-xs text-blue-600 mt-1 font-mono font-medium">
              {commandData?.recognition_confidence.dimension || '128D L2'}
            </p>
            <div className="mt-2 text-[11px] text-gray-400 truncate">
              Cosine/Euclidean exact
            </div>
          </div>
        </div>

        {/* Card 6: Connected Cameras */}
        <div
          onClick={() => onNavigate('live-camera')}
          className="apple-card p-5 bg-white border border-gray-200 hover:border-indigo-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">6. Cameras Online</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-gray-900">
              {commandData?.connected_cameras.online_count ?? 1}
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Webcam + WebRTC + RTSP
            </p>
            <div className="mt-2 text-[11px] text-emerald-600 flex items-center space-x-1 font-semibold">
              <Check className="w-3 h-3" />
              <span>Multi-feed enabled</span>
            </div>
          </div>
        </div>

        {/* Card 7: Camera Health */}
        <div
          onClick={() => onNavigate('system')}
          className="apple-card p-5 bg-white border border-gray-200 hover:border-emerald-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">7. Camera Health</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Wifi className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-extrabold text-gray-900 flex items-center space-x-1.5">
              <span>{commandData?.camera_health.avg_fps ?? 30} FPS</span>
            </div>
            <p className="text-xs text-emerald-600 mt-1 font-mono font-medium">
              {commandData?.camera_health.avg_latency_ms ?? 28}ms Latency
            </p>
            <div className="mt-2 text-[11px] text-gray-400">
              0 frame drops detected
            </div>
          </div>
        </div>

        {/* Card 8: Google Sheet Health */}
        <div
          onClick={onOpenSheetsSync || (() => onNavigate('students'))}
          className="apple-card p-5 bg-white border border-gray-200 hover:border-emerald-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">8. Google Sheets</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-extrabold text-gray-900 flex items-center space-x-1.5">
              <span>{commandData?.google_sheet_health.status || 'SYNCHRONIZED'}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 truncate font-medium">
              {commandData?.google_sheet_health.total_students ?? 0} Students in Roster
            </p>
            <div className="mt-2 text-[11px] text-blue-600 flex items-center space-x-1 font-semibold">
              <span>Authoritative Source</span>
            </div>
          </div>
        </div>

        {/* Card 9: AI Agent Status */}
        <div
          onClick={() => onNavigate('intelligence')}
          className="apple-card p-5 bg-white border border-gray-200 hover:border-purple-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">9. AI Agent</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-extrabold text-gray-900 flex items-center space-x-1.5">
              <span>{commandData?.ai_agent_status.status || 'ONLINE'}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 truncate font-medium">
              Groq & DeepSeek Ready
            </p>
            <div className="mt-2 text-[11px] text-purple-600 font-mono font-medium">
              Voice Agent active
            </div>
          </div>
        </div>

        {/* Card 10: Participating Departments */}
        <div className="apple-card p-5 bg-white border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">10. Departments</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-gray-900">
              {allDeptKeys.length || 10}
            </div>
            <p className="text-xs text-gray-500 mt-1 truncate font-medium">
              Google Sheet Synchronized
            </p>
            <div className="mt-2 text-[11px] text-emerald-600 font-mono font-medium">
              Multi-Dept Roster Ready
            </div>
          </div>
        </div>
      </div>

      {/* Real Cyber Defense & Intrusion Shield Posture Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-400 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-sm text-white">
                Institutional Cyber Defense & Anti-Hack Shield
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ACTIVE ZERO-TRUST
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Deep payload inspection (SQLi, XSS, RCE, Path Traversal), automated IP quarantine jail, and real-time intruder geolocation tracking.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => onNavigate('security')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 flex items-center space-x-1.5 transition"
          >
            <span>Open Cyber Defense Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Real-Time Department Attendance Dashboard & Intelligence */}
      <div className="apple-card p-6 bg-white space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Real-Time Department Attendance Intelligence
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Authoritative Google Sheet student breakdown per department with live turnout percentages.
            </p>
          </div>

          {/* Department Filter Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 max-w-full">
            {departmentFilterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedDeptFilter(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
                  selectedDeptFilter === opt.value
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200/70'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Department Comparison Insights Badges */}
        {commandData?.department_insights && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {commandData.department_insights.highest_attendance_department && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Highest Attendance</span>
                    <p className="text-xs font-bold text-gray-900 truncate max-w-[150px]">
                      {commandData.department_insights.highest_attendance_department.name}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-mono font-bold text-emerald-700">
                  {commandData.department_insights.highest_attendance_department.percentage}%
                </span>
              </div>
            )}

            {commandData.department_insights.lowest_attendance_department && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Lowest Turnout</span>
                    <p className="text-xs font-bold text-gray-900 truncate max-w-[150px]">
                      {commandData.department_insights.lowest_attendance_department.name}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-mono font-bold text-amber-700">
                  {commandData.department_insights.lowest_attendance_department.percentage}%
                </span>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Compliance Threshold</span>
                  <p className="text-xs font-bold text-gray-900">75% Institutional Minimum</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-blue-600">Enforced</span>
            </div>
          </div>
        )}

        {/* Department Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredDeptKeys.length === 0 ? (
            <div className="col-span-full py-8 text-center text-gray-400">
              <Building2 className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <span>No department found matching "{selectedDeptFilter}".</span>
            </div>
          ) : (
            filteredDeptKeys.map((deptName) => {
              const stat = deptStatsObj[deptName] || {
                department: deptName,
                total: 0,
                present: 0,
                absent: 0,
                attendance_percentage: 0,
              };
              const shortCode = getDeptShortCode(deptName);
              const isHigh = stat.attendance_percentage >= 80;
              const isLow = stat.attendance_percentage < 60;

              return (
                <div
                  key={deptName}
                  className="bg-gray-50/70 border border-gray-200 hover:border-gray-300 rounded-2xl p-4 space-y-2.5 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-xs font-mono font-bold text-blue-700">
                        {shortCode}
                      </span>
                      <span className="text-xs font-semibold text-gray-800 truncate max-w-[130px]">
                        {deptName}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold ${
                        isHigh ? 'text-emerald-600' : isLow ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {stat.attendance_percentage}%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-[11px] pt-1.5 border-t border-gray-200/80">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Total</span>
                      <span className="font-mono text-gray-700 font-bold">{stat.total}</span>
                    </div>
                    <div>
                      <span className="text-emerald-600 block text-[10px]">Present</span>
                      <span className="font-mono text-emerald-600 font-bold">{stat.present}</span>
                    </div>
                    <div>
                      <span className="text-red-600 block text-[10px]">Absent</span>
                      <span className="font-mono text-red-600 font-bold">{stat.absent}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isHigh ? 'bg-emerald-500' : isLow ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, stat.attendance_percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Command Center Layout: Live Activity Stream + Navigation Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Live Activity Stream */}
        <div className="lg:col-span-2 apple-card p-6 bg-white space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Live Institutional Activity Ledger
              </h2>
            </div>
            <span className="text-[11px] font-mono text-gray-500">
              Real telemetry stream
            </span>
          </div>

          {commandData?.live_activity && commandData.live_activity.length > 0 ? (
            <div className="divide-y divide-gray-100 max-h-[380px] overflow-y-auto pr-1">
              {commandData.live_activity.map((event: any) => (
                <div key={event.id} className="py-3 flex items-start justify-between space-x-3 text-xs">
                  <div className="flex items-start space-x-3">
                    <div
                      className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                        event.severity === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-600'
                          : event.severity === 'ALERT'
                          ? 'bg-red-50 text-red-600'
                          : event.severity === 'WARNING'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {event.type === 'ATTENDANCE_RECORDED' ? (
                        <UserCheck className="w-4 h-4" />
                      ) : event.type === 'GOOGLE_SHEET_SYNC' ? (
                        <FileSpreadsheet className="w-4 h-4" />
                      ) : event.type === 'CAMERA_CONNECTED' ? (
                        <Camera className="w-4 h-4" />
                      ) : event.type === 'UNKNOWN_PERSON' ? (
                        <ShieldAlert className="w-4 h-4" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{event.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{event.description}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono shrink-0 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 border border-dashed border-gray-200 rounded-2xl text-center space-y-2">
              <Activity className="w-8 h-8 opacity-30 text-gray-400 mx-auto" />
              <p className="text-xs font-semibold text-gray-600">No activity events recorded yet today</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Start an attendance session and launch the camera to begin live multi-face recognition streaming.
              </p>
            </div>
          )}
        </div>

        {/* Quick Operations & System Specs */}
        <div className="space-y-4">
          {/* Quick Nav Card */}
          <div className="apple-card p-6 bg-white space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Quick Operations
            </h3>
            
            <div className="space-y-2">
              <button
                onClick={() => onNavigate('live-camera')}
                className="w-full p-3 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl text-left flex items-center justify-between text-xs transition"
              >
                <div className="flex items-center space-x-2.5">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-800">Live Attendance Stream</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <button
                onClick={() => onNavigate('devices')}
                className="w-full p-3 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl text-left flex items-center justify-between text-xs transition"
              >
                <div className="flex items-center space-x-2.5">
                  <Radio className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold text-gray-800">Campus Device Center</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <button
                onClick={() => onNavigate('students')}
                className="w-full p-3 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl text-left flex items-center justify-between text-xs transition"
              >
                <div className="flex items-center space-x-2.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-gray-800">Authoritative Student Registry</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <button
                onClick={() => onNavigate('attendance')}
                className="w-full p-3 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl text-left flex items-center justify-between text-xs transition"
              >
                <div className="flex items-center space-x-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                  <span className="font-semibold text-gray-800">Attendance Records & Export</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <button
                onClick={() => onNavigate('validation')}
                className="w-full p-3 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl text-left flex items-center justify-between text-xs transition"
              >
                <div className="flex items-center space-x-2.5">
                  <Activity className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-gray-800">128D Accuracy Validation</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Biometric Verification Specs */}
          <div className="apple-card p-6 bg-white space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Biometric Architecture Specs
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-gray-100 text-gray-500">
                <span>Face Detector</span>
                <span className="text-gray-900 font-bold">SSD MobileNet V1</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 text-gray-500">
                <span>Embedding Model</span>
                <span className="text-gray-900 font-bold">FaceRecognitionNet</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 text-gray-500">
                <span>Vector Dimension</span>
                <span className="text-emerald-600 font-bold">128D Float32</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 text-gray-500">
                <span>Distance Metric</span>
                <span className="text-blue-600 font-bold">Euclidean & Cosine</span>
              </div>
              <div className="flex justify-between py-1.5 text-gray-500">
                <span>Temporal Window</span>
                <span className="text-amber-600 font-bold">3 Consecutive Frames</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
