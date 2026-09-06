import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  LogOut,
  UserCheck,
  Camera,
  Activity,
  Layers,
  Sparkles,
  Award,
  Radio,
  Bell,
  Mic,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Video,
} from 'lucide-react';
import { iotGatewayClient, IoTGatewayConnectionState } from '../services/iotGatewayClient';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSessionInfo?: { subject: string; section: string; department: string } | null;
  onOpenVoiceAssistant?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeSessionInfo,
  onOpenVoiceAssistant,
}) => {
  const { user, isAdmin, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [wsConnectionState, setWsConnectionState] = useState<IoTGatewayConnectionState>('CONNECTED');
  const [hasRecentThreat, setHasRecentThreat] = useState(false);
  const [recentThreatDetails, setRecentThreatDetails] = useState<string | null>(null);

  useEffect(() => {
    const unsub = iotGatewayClient.onStateChange((state) => {
      setWsConnectionState(state);
    });
    const unsubAlert = iotGatewayClient.onSecurityAlert((alert) => {
      setHasRecentThreat(true);
      setRecentThreatDetails(`${alert.event_type} blocked from ${alert.ip_address} (${alert.location?.city || 'LAN'})`);
      setTimeout(() => setHasRecentThreat(false), 10000);
    });
    return () => {
      unsub();
      unsubAlert();
    };
  }, []);

  const primaryTabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'live-camera', label: 'Live Attendance', icon: Camera, liveBadge: !!activeSessionInfo },
    { id: 'students', label: 'Students', icon: UserCheck },
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'devices', label: 'Hardware', icon: Cpu },
    { id: 'cameras', label: 'Cameras', icon: Video },
    { id: 'intelligence', label: 'Analytics', icon: Sparkles },
    ...(isAdmin ? [{ id: 'security', label: 'Cyber Defense', icon: ShieldAlert, alertBadge: hasRecentThreat }] : []),
  ];

  const adminExtraTabs = [
    { id: 'security', label: 'Cyber Defense Center', icon: ShieldAlert },
    { id: 'attendance', label: 'Attendance Logs', icon: ShieldCheck },
    { id: 'sessions', label: 'Sessions', icon: Layers },
    { id: 'users', label: 'Faculty & HODs', icon: Building2 },
    { id: 'validation', label: 'Validation & Hardening', icon: Award },
    { id: 'settings', label: 'Settings', icon: Cpu },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-gray-900 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Left: ATTENDIQ AI Logo & Live Status */}
          <div className="flex items-center space-x-3 shrink-0">
            <div
              onClick={() => setActiveTab('overview')}
              className="cursor-pointer flex items-center space-x-2.5 group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm group-hover:scale-105 transition-transform duration-200">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-base tracking-tight text-gray-900 font-sans">
                    ATTENDIQ <span className="text-blue-600 font-extrabold">AI</span>
                  </span>
                  <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                    SITS
                  </span>
                </div>
                <span className="text-[11px] text-gray-500 hidden sm:block">
                  Smart Institutional Platform
                </span>
              </div>
            </div>

            {/* Real Hardware Live Status Pill */}
            <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-medium text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real Hardware Active</span>
            </div>

            {/* Active Attendance Session indicator */}
            {activeSessionInfo && (
              <div
                onClick={() => setActiveTab('live-camera')}
                className="cursor-pointer hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100/80 border border-blue-200 text-xs text-blue-700 transition"
                title="Click to view live stream"
              >
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                <span className="font-semibold">Live:</span>
                <span className="truncate max-w-[140px]">{activeSessionInfo.subject}</span>
                <span className="font-mono text-[11px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                  {activeSessionInfo.section}
                </span>
              </div>
            )}
          </div>

          {/* Center: Apple-style pill navigation */}
          <nav className="hidden lg:flex items-center p-1 bg-gray-100/90 rounded-full border border-gray-200/60 shadow-inner">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span>{tab.label}</span>
                  {tab.liveBadge && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                  )}
                  {tab.alertBadge && (
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" title="Recent Intrusion Intercepted" />
                  )}
                </button>
              );
            })}

            {/* Admin Extra dropdown or pill */}
            {isAdmin && (
              <div className="relative group">
                <button
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    adminExtraTabs.some((t) => t.id === activeTab)
                      ? 'bg-white text-gray-900 shadow-sm font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>More</span>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-200 p-1.5 hidden group-hover:block transition-all z-50">
                  {adminExtraTabs.map((extra) => {
                    const Icon = extra.icon;
                    const isExtraActive = activeTab === extra.id;
                    return (
                      <button
                        key={extra.id}
                        onClick={() => setActiveTab(extra.id)}
                        className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-left transition ${
                          isExtraActive
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span>{extra.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          {/* Right: Connection indicator, Notifications, Voice Agent, Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Connection Indicator */}
            <div
              className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                wsConnectionState === 'CONNECTED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : wsConnectionState === 'CONNECTING'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
              title={`IoT Gateway WebSocket: ${wsConnectionState}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnectionState === 'CONNECTED'
                    ? 'bg-emerald-500 animate-pulse'
                    : wsConnectionState === 'CONNECTING'
                    ? 'bg-amber-500'
                    : 'bg-gray-400'
                }`}
              />
              <span className="font-mono text-[11px]">
                {wsConnectionState === 'CONNECTED' ? 'Gateway Online' : wsConnectionState}
              </span>
            </div>

            {/* Quick Voice Assistant shortcut */}
            {onOpenVoiceAssistant && (
              <button
                onClick={onOpenVoiceAssistant}
                title="Launch AI Voice Agent"
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200/80 text-gray-700 flex items-center justify-center transition border border-gray-200/80"
              >
                <Mic className="w-4 h-4 text-indigo-600" />
              </button>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                title="System Notifications"
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200/80 text-gray-700 flex items-center justify-center transition border border-gray-200/80 relative"
              >
                <Bell className="w-4 h-4 text-gray-600" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="font-semibold text-xs text-gray-900">Hardware & System Updates</span>
                    <span className="text-[10px] text-gray-400">Live</span>
                  </div>
                  <div className="mt-3 space-y-2.5 text-xs">
                    {recentThreatDetails && (
                      <div
                        onClick={() => {
                          setActiveTab('security');
                          setShowNotifications(false);
                        }}
                        className="cursor-pointer flex items-start space-x-2.5 p-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 transition"
                      >
                        <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <p className="font-bold text-red-800">Security Threat Blocked</p>
                          <p className="text-[11px] text-red-700">
                            {recentThreatDetails}
                          </p>
                          <span className="text-[10px] text-red-600 font-semibold underline mt-0.5 block">
                            View in Cyber Defense Center →
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start space-x-2.5 p-2 rounded-xl bg-gray-50">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-800">Real Device Layer Active</p>
                        <p className="text-[11px] text-gray-500">
                          Web Bluetooth, USB Cameras, and IoT Gateway running without simulations.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2.5 p-2 rounded-xl bg-gray-50">
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-800">Google Sheets Synchronized</p>
                        <p className="text-[11px] text-gray-500">
                          Student master records and attendance logs verified authoritative.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Pill */}
            <div className="flex items-center space-x-2 pl-2 sm:pl-3 border-l border-gray-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 flex items-center justify-center text-gray-700 font-semibold text-xs shadow-inner">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-gray-900 leading-tight">
                  {user?.name}
                </span>
                <span className="text-[10px] font-medium text-gray-500">
                  {isAdmin ? 'Super Admin' : `HOD ${user?.department || ''}`}
                </span>
              </div>

              <button
                onClick={() => logout()}
                title="Sign out of ATTENDIQ AI"
                className="w-8 h-8 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-600 flex items-center justify-center transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Mobile Navigation Scrollbar */}
      <div className="lg:hidden border-t border-gray-200/70 px-4 py-2 bg-gray-50/90 overflow-x-auto scrollbar-none flex items-center space-x-1.5">
        {[...primaryTabs, ...(isAdmin ? adminExtraTabs : [])].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900 bg-white border border-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
