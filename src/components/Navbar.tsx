import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Building2,
  LogOut,
  UserCheck,
  Camera,
  Activity,
  Layers,
  Sparkles,
  Award,
  Radio,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSessionInfo?: { subject: string; section: string; department: string } | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeSessionInfo,
}) => {
  const { user, isAdmin, isHOD, logout } = useAuth();

  const adminTabs = [
    { id: 'overview', label: 'Dashboard', icon: Activity },
    { id: 'live-camera', label: 'Live Camera', icon: Camera, highlight: true },
    { id: 'devices', label: 'Campus IoT & Sensors', icon: Radio },
    { id: 'intelligence', label: 'AI Intelligence & Risk', icon: Sparkles },
    { id: 'students', label: 'Students', icon: UserCheck },
    { id: 'attendance', label: 'Attendance', icon: ShieldCheck },
    { id: 'sessions', label: 'Sessions', icon: Layers },
    { id: 'users', label: 'HOD Management', icon: Building2 },
    { id: 'validation', label: 'SIH 2026 Validation & Hardening', icon: Award },
    { id: 'settings', label: 'System & Audit', icon: ShieldCheck },
  ];

  const hodTabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'live-camera', label: 'Live Attendance Camera', icon: Camera, highlight: true },
    { id: 'devices', label: 'Classroom IoT & Sensors', icon: Radio },
    { id: 'intelligence', label: 'Dept AI Insights', icon: Sparkles },
    { id: 'students', label: 'Dept Students', icon: UserCheck },
    { id: 'attendance', label: 'Attendance Records', icon: ShieldCheck },
  ];

  const tabs = isAdmin ? adminTabs : hodTabs;

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-md">
      {/* Top Banner with Institution Identity */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-inner ring-2 ring-blue-400/30">
              SITS
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white">
                  SITS SmartAttend AI
                </span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  SIH 2026
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Siddhartha Institute of Technology and Sciences
              </p>
            </div>
          </div>

          {/* Center: Live Session Banner if running */}
          {activeSessionInfo && (
            <div className="hidden lg:flex items-center space-x-2 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-full text-xs text-emerald-300 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-semibold">SESSION ACTIVE:</span>
              <span>{activeSessionInfo.subject}</span>
              <span className="text-emerald-400 font-mono">({activeSessionInfo.department} - {activeSessionInfo.section})</span>
            </div>
          )}

          {/* Right: User Profile & Actions */}
          <div className="flex items-center space-x-4">
            <div className="text-right hidden md:block">
              <div className="text-xs font-semibold text-slate-200">{user?.name}</div>
              <div className="flex items-center justify-end space-x-1.5 text-[11px] text-slate-400">
                <span
                  className={`px-1.5 py-0.2 rounded font-mono uppercase text-[10px] font-bold ${
                    isAdmin ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50' : 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                  }`}
                >
                  {user?.role}
                </span>
                <span>• {isAdmin ? 'Institution-wide' : user?.department}</span>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign out of SITS SmartAttend AI"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center space-x-1.5 text-xs"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-slate-950/70 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/40'
                    : tab.highlight
                    ? 'bg-blue-950/40 text-blue-300 hover:bg-blue-900/50 hover:text-white border border-blue-800/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : tab.highlight ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.highlight && activeSessionInfo && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
