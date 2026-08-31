import React, { useState, useEffect } from 'react';
import {
  Layers,
  Play,
  Square,
  RefreshCw,
  Clock,
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { AttendanceSession, DepartmentInfo } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SessionModal } from './SessionModal';

interface SessionsViewProps {
  departments: DepartmentInfo[];
  onOpenLiveCamera?: () => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({ departments, onOpenLiveCamera }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await api.getSessions({
        department: user?.role === 'HOD' ? user.department : undefined,
      });
      if (res.success) {
        setSessions(res.sessions);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleStopSession = async (id: string) => {
    try {
      const res = await api.stopSession(id);
      if (res.success) {
        fetchSessions();
      }
    } catch (err) {
      console.error('Failed to stop session:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Classroom Attendance Sessions
          </h2>
          <p className="text-xs text-slate-400">
            Create and track live class periods for automated face recognition attendance.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchSessions}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh Sessions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center space-x-2"
          >
            <Play className="w-4 h-4" />
            <span>Launch New Session</span>
          </button>
        </div>
      </div>

      {/* Grid of Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Loading attendance sessions...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <span>No attendance sessions created yet. Click "Launch New Session" to begin.</span>
          </div>
        ) : (
          sessions.map((s) => {
            const isActive = s.status === 'ACTIVE';
            return (
              <div
                key={s.id}
                className={`p-4 rounded-xl border transition shadow-sm space-y-3 ${
                  isActive
                    ? 'bg-slate-900 border-emerald-500/40 ring-1 ring-emerald-500/30'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase inline-flex items-center space-x-1 ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>}
                      <span>{s.status}</span>
                    </span>
                    <h3 className="text-base font-bold text-white mt-1.5">{s.subject}</h3>
                  </div>

                  {isActive ? (
                    <button
                      onClick={() => handleStopSession(s.id)}
                      className="px-2.5 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded text-[11px] font-semibold transition flex items-center space-x-1"
                    >
                      <Square className="w-3 h-3" />
                      <span>Conclude</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Ended</span>
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 pt-1 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Department:</span>
                    {s.is_multi_department ? (
                      <span className="font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded text-[11px] border border-emerald-800/40">
                        Multi-Dept ({s.departments?.length || 0} Depts)
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-200">{s.department}</span>
                    )}
                  </div>
                  {s.is_multi_department && s.departments && s.departments.length > 0 && (
                    <div className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 font-semibold mb-1 text-[10px] uppercase">Roster Breakdown:</div>
                      <div className="flex flex-wrap gap-1">
                        {s.departments.map((d) => {
                          const stat = s.department_stats ? s.department_stats[d] : undefined;
                          return (
                            <span key={d} className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-300">
                              {d.replace('Engineering', 'Eng.').replace('Computer Science &', 'CSE').replace('Software', 'SE').replace('Electrical & Electronics', 'EEE')}
                              {stat ? `: ${stat.present}/${stat.total}` : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Classroom:</span>
                    <span className="font-mono text-slate-200">{s.classroom} {s.section !== 'ALL' && `(Sec ${s.section})`}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Schedule:</span>
                    <span className="font-mono text-slate-400">{s.date} ({s.start_time} - {s.end_time || 'Ongoing'})</span>
                  </div>
                  {s.faculty && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Faculty:</span>
                      <span className="text-slate-300">{s.faculty}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Created by:</span>
                    <span className="font-mono">{s.created_by}</span>
                  </div>
                </div>

                {isActive && onOpenLiveCamera && (
                  <button
                    onClick={onOpenLiveCamera}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow transition flex items-center justify-center space-x-2"
                  >
                    <span>Open Live Attendance Camera</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <SessionModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSuccess={() => {
          fetchSessions();
          if (onOpenLiveCamera) onOpenLiveCamera();
        }}
        departments={departments}
      />
    </div>
  );
};
