import React, { useState, useEffect } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCw,
  Send,
  Filter,
  Search,
  Building2,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { AbsenceNotification, AttendanceSession } from '../types';
import { api } from '../services/api';

export const AbsenceNotificationView: React.FC = () => {
  const [notifications, setNotifications] = useState<AbsenceNotification[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    delivered: number;
    failed: number;
    queued: number;
    retry: number;
    last_dispatched_at: string | null;
  }>({
    total: 0,
    delivered: 0,
    failed: 0,
    queued: 0,
    retry: 0,
    last_dispatched_at: null,
  });

  const [completedSessions, setCompletedSessions] = useState<AttendanceSession[]>([]);
  const [selectedSessionToDispatch, setSelectedSessionToDispatch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [notifsRes, statsRes, sessionsRes] = await Promise.all([
        api.getAbsenceNotifications({
          delivery_status: statusFilter !== 'ALL' ? statusFilter : undefined,
        }),
        api.getNotificationStats(),
        api.getSessions({ status: 'COMPLETED' }),
      ]);

      if (notifsRes.success) {
        setNotifications(notifsRes.notifications);
      }
      if (statsRes.success) {
        setStats(statsRes);
      }
      if (sessionsRes.success) {
        setCompletedSessions(sessionsRes.sessions);
        if (sessionsRes.sessions.length > 0 && !selectedSessionToDispatch) {
          setSelectedSessionToDispatch(sessionsRes.sessions[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load absence notification data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleDispatchSession = async () => {
    if (!selectedSessionToDispatch) return;
    setDispatching(true);
    setActionMessage(null);
    try {
      const res = await api.dispatchSessionAbsenceNotifications(selectedSessionToDispatch);
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `Successfully dispatched ${res.generated} institutional absence alerts to verified student emails.`,
        });
        loadData();
      } else {
        setActionMessage({ type: 'error', text: res.message || 'Failed to dispatch absence alerts' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Network error dispatching alerts' });
    } finally {
      setDispatching(false);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const res = await api.retryAbsenceNotification(id);
      if (res.success) {
        loadData();
      }
    } catch (err) {
      console.error('Failed to retry notification:', err);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.student_name.toLowerCase().includes(q) ||
      n.roll_number.toLowerCase().includes(q) ||
      n.email.toLowerCase().includes(q) ||
      n.subject.toLowerCase().includes(q) ||
      n.notification_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Institutional Email Dispatcher
            </span>
            <span className="text-xs text-gray-500">SMTP / SES Cloud Relays</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center space-x-2">
            <span>Automated Absence Notification Engine</span>
            <Mail className="w-5 h-5 text-blue-600" />
          </h2>
          <p className="text-sm text-gray-500 max-w-2xl">
            Automatically notifies absent students and parents upon completion of each academic period. Strict anti-duplicate registry with cryptographic message IDs.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={loadData}
            className="p-2.5 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-600 transition border border-gray-200"
            title="Refresh Notification Log"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Dispatches</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Authoritative absence records</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-sm">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Delivered</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.delivered}</div>
          <div className="text-[11px] text-emerald-700/80 mt-0.5">Confirmed delivery receipt</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-sm">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>In Queue / Retry</span>
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{stats.queued + stats.retry}</div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">Automated retry scheduler</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-red-200/80 shadow-sm">
          <div className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Delivery Failures</span>
          </div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.failed}</div>
          <div className="text-[11px] text-red-700/80 mt-0.5">Bounced or invalid mailbox</div>
        </div>
      </div>

      {/* Manual Dispatch Tool for Completed Sessions */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Send className="w-4 h-4 text-blue-400" />
              <span>Dispatch Absence Alerts for Completed Session</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Select any completed attendance session to cross-reference with authoritative student master and dispatch notices.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedSessionToDispatch}
              onChange={(e) => setSelectedSessionToDispatch(e.target.value)}
              className="bg-white/10 text-white border border-white/20 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-400 outline-none"
            >
              {completedSessions.length === 0 ? (
                <option value="" className="text-gray-900">No completed sessions available</option>
              ) : (
                completedSessions.map((s) => (
                  <option key={s.id} value={s.id} className="text-gray-900">
                    {s.subject} &bull; Room {s.classroom} &bull; {s.date}
                  </option>
                ))
              )}
            </select>

            <button
              onClick={handleDispatchSession}
              disabled={dispatching || !selectedSessionToDispatch}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center space-x-2 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{dispatching ? 'Dispatching Notices...' : 'Send Absence Alerts'}</span>
            </button>
          </div>
        </div>

        {actionMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
              actionMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'bg-red-500/20 text-red-200 border border-red-500/30'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-300" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search student, roll number, email, or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-medium bg-transparent outline-none text-gray-900"
          />
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="DELIVERED">Delivered</option>
            <option value="QUEUED">Queued</option>
            <option value="RETRY">Retry Needed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Notifications Table */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Dispatch ID</th>
                <th className="px-5 py-3">Student & Roll No</th>
                <th className="px-5 py-3">Course & Room</th>
                <th className="px-5 py-3">Date & Period</th>
                <th className="px-5 py-3">Recipient Email</th>
                <th className="px-5 py-3">Delivery Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500 font-semibold">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                    Loading notifications log...
                  </td>
                </tr>
              ) : filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500 font-semibold">
                    <Mail className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    No absence notifications found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredNotifications.map((notif) => (
                  <tr key={notif.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-3.5 font-mono text-[11px] text-gray-600 font-semibold">
                      {notif.notification_id}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-gray-900">{notif.student_name}</div>
                      <div className="text-[11px] font-mono text-blue-700 font-semibold">{notif.roll_number}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-800">{notif.subject}</div>
                      <div className="text-[11px] text-gray-500">{notif.classroom} &bull; {notif.faculty}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-gray-900 font-medium">{notif.date}</div>
                      <div className="text-[11px] text-gray-500">{notif.period}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-gray-600">
                      {notif.email}
                    </td>
                    <td className="px-5 py-3.5">
                      {notif.delivery_status === 'DELIVERED' && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Delivered</span>
                        </span>
                      )}
                      {notif.delivery_status === 'QUEUED' && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Queued</span>
                        </span>
                      )}
                      {notif.delivery_status === 'RETRY' && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <RotateCw className="w-3 h-3 text-purple-600" />
                          <span>Retry ({notif.retry_count})</span>
                        </span>
                      )}
                      {notif.delivery_status === 'FAILED' && (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          <span>Failed</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {notif.delivery_status !== 'DELIVERED' && (
                        <button
                          onClick={() => handleRetry(notif.id)}
                          className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                        >
                          Retry
                        </button>
                      )}
                    </td>
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
