import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Activity,
  CheckCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  UserX,
  Search,
  Filter,
  CheckCircle2,
  Server,
  Zap,
  ArrowRight,
  ShieldCheck,
  Award,
  ListFilter,
  MapPin,
  Radio,
} from 'lucide-react';
import { api } from '../services/api';
import {
  AiInsight,
  AttendanceAnomaly,
  SecurityEvent,
  StudentRiskProfile,
  SystemHealthStatus,
  DepartmentInfo,
} from '../types';
import { useAuth } from '../context/AuthContext';

interface IntelligenceViewProps {
  departments?: DepartmentInfo[];
}

export const IntelligenceView: React.FC<IntelligenceViewProps> = ({ departments = [] }) => {
  const { user, isAdmin } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'insights' | 'anomalies' | 'risk' | 'health' | 'timeline'>('insights');
  const [loading, setLoading] = useState(false);

  // Timeline states (Phase 41+ Global Campus Activity Timeline)
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineClassroom, setTimelineClassroom] = useState<string>('ALL');
  const [timelineEventType, setTimelineEventType] = useState<string>('ALL');
  const [timelineSeverity, setTimelineSeverity] = useState<string>('ALL');
  const [timelineLoading, setTimelineLoading] = useState<boolean>(false);

  // Data states
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [anomalies, setAnomalies] = useState<AttendanceAnomaly[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [riskProfiles, setRiskProfiles] = useState<StudentRiskProfile[]>([]);
  const [riskSummary, setRiskSummary] = useState<{ total: number; high_risk: number; medium_risk: number; low_risk: number }>({
    total: 0,
    high_risk: 0,
    medium_risk: 0,
    low_risk: 0,
  });
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus | null>(null);
  const [recognitionStats, setRecognitionStats] = useState<any | null>(null);

  // Filter states
  const [selectedDept, setSelectedDept] = useState<string>(user?.role === 'HOD' ? (user.department || '') : '');
  const [anomalySeverity, setAnomalySeverity] = useState<string>('');
  const [anomalyResolved, setAnomalyResolved] = useState<string>('false');
  const [riskFilter, setRiskFilter] = useState<string>('');
  const [riskSearch, setRiskSearch] = useState<string>('');

  // Action status state
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Fetch all intelligence data
  const loadIntelligenceData = async () => {
    setLoading(true);
    try {
      const deptParam = user?.role === 'HOD' ? user.department : selectedDept || undefined;

      const [insightsRes, anomaliesRes, securityRes, riskRes, healthRes, statsRes] = await Promise.all([
        api.getAiInsights(deptParam),
        api.getAnomalies({
          department_id: deptParam,
          severity: anomalySeverity || undefined,
          resolved: anomalyResolved === 'all' ? undefined : anomalyResolved === 'true',
        }),
        api.getSecurityEvents({ department: deptParam }),
        api.getRiskProfiles({
          department: deptParam,
          risk_level: riskFilter || undefined,
        }),
        api.getSystemHealth(),
        api.getRecognitionStats(),
      ]);

      if (insightsRes.success) setInsights(insightsRes.insights);
      if (anomaliesRes.success) setAnomalies(anomaliesRes.anomalies);
      if (securityRes.success) setSecurityEvents(securityRes.events);
      if (riskRes.success) {
        setRiskProfiles(riskRes.profiles);
        if (riskRes.summary) setRiskSummary(riskRes.summary);
      }
      if (healthRes.success) setHealthStatus(healthRes.health);
      if (statsRes.success) setRecognitionStats(statsRes.stats);
    } catch (err) {
      console.error('Error fetching intelligence data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntelligenceData();
  }, [selectedDept, anomalySeverity, anomalyResolved, riskFilter]);

  const fetchTimeline = async () => {
    setTimelineLoading(true);
    try {
      const res = await api.getGlobalTimeline({
        classroom: timelineClassroom === 'ALL' ? undefined : timelineClassroom,
        event_type: timelineEventType === 'ALL' ? undefined : timelineEventType,
        severity: timelineSeverity === 'ALL' ? undefined : timelineSeverity,
        limit: 50,
      });
      if (res.success) {
        setTimelineEvents(res.timeline || []);
      }
    } catch (e) {
      console.error('Failed to load global timeline:', e);
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'timeline') {
      fetchTimeline();
    }
  }, [activeSubTab, timelineClassroom, timelineEventType, timelineSeverity]);

  // Handle manual generation of insights
  const handleRegenerateInsights = async () => {
    setLoading(true);
    try {
      const deptParam = user?.role === 'HOD' ? user.department : selectedDept || undefined;
      const res = await api.generateAiInsights(deptParam);
      if (res.success) {
        setInsights(res.insights);
        setActionMessage('AI Strategic Insights recalculated with live system telemetry.');
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err) {
      console.error('Failed to regenerate insights:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle resolving an anomaly
  const handleResolveAnomaly = async (id: string) => {
    try {
      const res = await api.resolveAnomaly(id);
      if (res.success) {
        setActionMessage('Anomaly resolved and archived in the security log.');
        setTimeout(() => setActionMessage(null), 4000);
        loadIntelligenceData();
      }
    } catch (err) {
      console.error('Failed to resolve anomaly:', err);
    }
  };

  // Filtered risk profiles
  const filteredRiskProfiles = riskProfiles.filter((p) => {
    if (!riskSearch) return true;
    const term = riskSearch.toLowerCase();
    return (
      p.student_name.toLowerCase().includes(term) ||
      p.roll_number.toLowerCase().includes(term) ||
      p.student_id.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  AI Intelligence & Anomaly Detection Center
                </h1>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  ENGINE v3.0
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Continuous biometric surveillance, anti-spoofing verification, attendance risk clustering, and predictive insights for SITS.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isAdmin && (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">All Departments (Institution-wide)</option>
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleRegenerateInsights}
              disabled={loading}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Recalculate AI Models</span>
            </button>
          </div>
        </div>

        {/* Global Action notification message */}
        {actionMessage && (
          <div className="mt-4 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Intelligence Quick Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400">
              <span>Active Insights</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">{insights.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Real-time forecasts</div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-rose-400">
              <span>Unresolved Anomalies</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-bold text-rose-400 mt-1">
              {anomalies.filter((a) => !a.resolved).length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Requires review</div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-amber-400">
              <span>High Risk Students</span>
              <UserX className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400 mt-1">{riskSummary.high_risk}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">&lt; 75% attendance</div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-emerald-400">
              <span>Anti-Spoof Rejections</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {securityEvents.filter((e) => e.event_type === 'SPOOF_ATTEMPT').length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Photo attacks blocked</div>
          </div>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('insights')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-2 ${
            activeSubTab === 'insights'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Strategic AI Insights ({insights.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('anomalies')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-2 ${
            activeSubTab === 'anomalies'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Anomalies & Spoof Logs ({anomalies.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('risk')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-2 ${
            activeSubTab === 'risk'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <UserX className="w-4 h-4" />
          <span>Student Risk Profiles ({riskProfiles.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('health')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-2 ${
            activeSubTab === 'health'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System Health & Biometrics</span>
        </button>

        <button
          onClick={() => setActiveSubTab('timeline')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-2 ${
            activeSubTab === 'timeline'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Global Campus Activity Timeline</span>
        </button>
      </div>

      {/* Sub Tab 1: Strategic AI Insights */}
      {activeSubTab === 'insights' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.length === 0 ? (
              <div className="col-span-2 p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-40 text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-300">No Insights Generated Yet</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Click "Recalculate AI Models" above to run the analytical engine across current attendance sessions.
                </p>
              </div>
            ) : (
              insights.map((insight) => {
                const isHigh = insight.severity === 'HIGH';
                const isMedium = insight.severity === 'MEDIUM';

                return (
                  <div
                    key={insight.id}
                    className={`bg-slate-900 border rounded-xl p-5 shadow-sm space-y-3 transition hover:border-slate-700 ${
                      isHigh
                        ? 'border-rose-900/50 bg-gradient-to-b from-rose-950/20 to-slate-900'
                        : isMedium
                        ? 'border-amber-900/40 bg-gradient-to-b from-amber-950/15 to-slate-900'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isHigh
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isMedium
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {insight.category}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {insight.scope} • {insight.department || 'ALL DEPTS'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">{new Date(insight.created_at).toLocaleTimeString()}</span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white">{insight.title}</h3>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{insight.description}</p>
                    </div>

                    <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 flex items-start space-x-2 text-xs">
                      <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-indigo-300">Recommended Action: </span>
                        <span className="text-slate-300">{insight.actionable_recommendation}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Sub Tab 2: Anomalies & Spoof Logs */}
      {activeSubTab === 'anomalies' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center space-x-1">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </span>

              <select
                value={anomalySeverity}
                onChange={(e) => setAnomalySeverity(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <select
                value={anomalyResolved}
                onChange={(e) => setAnomalyResolved(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="false">Unresolved Only</option>
                <option value="true">Resolved Only</option>
                <option value="all">All Records</option>
              </select>
            </div>

            <div className="text-xs text-slate-400">
              Showing <strong className="text-white">{anomalies.length}</strong> flagged anomalies
            </div>
          </div>

          {/* Anomalies List */}
          <div className="space-y-3">
            {anomalies.length === 0 ? (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-500 opacity-60" />
                <h3 className="text-sm font-semibold text-slate-300">No Anomalies Detected</h3>
                <p className="text-xs text-slate-500 mt-1">
                  All session attendance records meet standard institutional biometric and quorum criteria.
                </p>
              </div>
            ) : (
              anomalies.map((anom) => (
                <div
                  key={anom.id}
                  className={`bg-slate-900 border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                    anom.resolved ? 'opacity-70 border-slate-800' : 'border-rose-900/60 bg-rose-950/10'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          anom.severity === 'CRITICAL' || anom.severity === 'HIGH'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {anom.severity}
                      </span>
                      <span className="text-xs font-bold text-white">{anom.type.replace(/_/g, ' ')}</span>
                      {anom.resolved ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                          RESOLVED
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30 animate-pulse">
                          ACTION REQUIRED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{anom.description}</p>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-3 pt-1">
                      <span>Dept: {anom.department_id || 'Global'}</span>
                      <span>•</span>
                      <span>Detected: {new Date(anom.detected_at).toLocaleString()}</span>
                      {anom.resolved && <span>• Resolved by: {anom.resolved_by}</span>}
                    </div>
                  </div>

                  {!anom.resolved && (
                    <button
                      onClick={() => handleResolveAnomaly(anom.id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shrink-0 self-start md:self-center shadow flex items-center space-x-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Anti-Spoofing & Security Audit Log Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Biometric Security & Anti-Spoofing Audit Log</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">{securityEvents.length} security alerts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Target Student</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {securityEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No biometric security incidents recorded. System functioning securely.
                      </td>
                    </tr>
                  ) : (
                    securityEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-rose-400 font-mono">
                          {evt.event_type}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              evt.severity === 'HIGH' || evt.severity === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {evt.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-200">
                          {evt.student_name || 'Unidentified Face'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{evt.department || 'N/A'}</td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">{evt.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab 3: Student Risk Profiles */}
      {activeSubTab === 'risk' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search student or roll number..."
                value={riskSearch}
                onChange={(e) => setRiskSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">All Risk Tiers</option>
                <option value="HIGH">High Risk (&lt; 75% Attendance)</option>
                <option value="MEDIUM">Medium Risk (75% - 85%)</option>
                <option value="LOW">Low Risk (&gt; 85%)</option>
              </select>
            </div>
          </div>

          {/* Risk Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredRiskProfiles.length === 0 ? (
              <div className="col-span-3 p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
                <UserX className="w-10 h-10 mx-auto mb-3 opacity-40 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-300">No Student Profiles Matching Filter</h3>
              </div>
            ) : (
              filteredRiskProfiles.map((p) => {
                const isHigh = p.risk_level === 'HIGH';
                const isMedium = p.risk_level === 'MEDIUM';

                return (
                  <div
                    key={p.student_id}
                    className={`bg-slate-900 border rounded-xl p-4 shadow-sm space-y-3 ${
                      isHigh
                        ? 'border-rose-900/60 bg-gradient-to-b from-rose-950/20 to-slate-900'
                        : isMedium
                        ? 'border-amber-900/40 bg-gradient-to-b from-amber-950/15 to-slate-900'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{p.student_name}</h4>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {p.roll_number} • {p.department} ({p.section})
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          isHigh
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isMedium
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {p.risk_level} RISK
                      </span>
                    </div>

                    {/* Metric progress bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">Attendance Rate</span>
                        <span
                          className={`font-bold font-mono ${
                            isHigh ? 'text-rose-400' : isMedium ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {p.attendance_percentage}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            isHigh ? 'bg-rose-500' : isMedium ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, p.attendance_percentage)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                        <span className="text-slate-500 text-[10px]">Attended:</span>
                        <div className="font-semibold text-slate-200">
                          {p.attended_sessions} / {p.total_sessions} sessions
                        </div>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                        <span className="text-slate-500 text-[10px]">Consecutive Absences:</span>
                        <div className="font-semibold text-rose-400">{p.consecutive_absences} classes</div>
                      </div>
                    </div>

                    {/* Risk Factors */}
                    {p.risk_factors.length > 0 && (
                      <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800/80">
                        {p.risk_factors.map((f, i) => (
                          <div key={i} className="flex items-start space-x-1.5 text-rose-300/90">
                            <span className="text-rose-400 font-bold">•</span>
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Sub Tab 4: System Health & Biometrics */}
      {activeSubTab === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* System Engine Health Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
                <Server className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Neural Server & Biometric Store</h3>
              </div>

              {healthStatus && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Server Architecture Status:</span>
                    <span className="font-bold text-emerald-400 font-mono uppercase">
                      {healthStatus.status} (Healthy)
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Active Uptime:</span>
                    <span className="font-bold text-white font-mono">
                      {Math.floor(healthStatus.uptime / 60)}m {Math.floor(healthStatus.uptime % 60)}s
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Memory Allocation (RSS):</span>
                    <span className="font-bold text-slate-200 font-mono">
                      {Math.round(healthStatus.memory.rss / (1024 * 1024))} MB
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Face Embeddings in RAM:</span>
                    <span className="font-bold text-blue-400 font-mono">
                      {healthStatus.face_embeddings_indexed} Enrolled Descriptors
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Recognition Telemetry Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Recognition & Anti-Spoofing Telemetry</h3>
              </div>

              {recognitionStats && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                      <span className="text-slate-400">Total Frame Passes:</span>
                      <div className="text-lg font-bold text-white mt-1">
                        {recognitionStats.total_attempts}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                      <span className="text-emerald-400">Success Rate:</span>
                      <div className="text-lg font-bold text-emerald-400 mt-1">
                        {recognitionStats.success_rate}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Average Biometric Confidence:</span>
                    <span className="font-bold text-indigo-400 font-mono">
                      {recognitionStats.average_confidence}% Match
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Anti-Spoofing Interception Rate:</span>
                    <span className="font-bold text-rose-400 font-mono">
                      {recognitionStats.spoof_rate}% Blocked
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab 5: Global Campus Activity Timeline (Phase 41+) */}
      {activeSubTab === 'timeline' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5 text-slate-400">
                <Filter className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold text-slate-300">Filters:</span>
              </div>

              {/* Classroom filter */}
              <select
                value={timelineClassroom}
                onChange={(e) => setTimelineClassroom(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="ALL">All Classrooms</option>
                <option value="LH-101">LH-101 (Lecture Hall)</option>
                <option value="LH-102">LH-102 (Lecture Hall)</option>
                <option value="C-201">C-201 (Classroom)</option>
                <option value="C-204">C-204 (Classroom)</option>
                <option value="LAB-1">LAB-1 (Computer Lab)</option>
                <option value="LAB-2">LAB-2 (IoT Lab)</option>
                <option value="AUD-01">AUD-01 (Auditorium)</option>
              </select>

              {/* Event Type filter */}
              <select
                value={timelineEventType}
                onChange={(e) => setTimelineEventType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="ALL">All Event Types</option>
                <option value="ATTENDANCE_RECORDED">Attendance Recorded</option>
                <option value="FACE_RECOGNIZED">Face Recognized</option>
                <option value="SESSION_STARTED">Session Started</option>
                <option value="SESSION_STOPPED">Session Ended</option>
                <option value="DEVICE_HEARTBEAT">Device Heartbeat</option>
                <option value="DEVICE_OFFLINE">Device Offline</option>
                <option value="ANOMALY_DETECTED">Anomaly Detected</option>
                <option value="SECURITY_ALERT">Security Alert</option>
              </select>

              {/* Severity filter */}
              <select
                value={timelineSeverity}
                onChange={(e) => setTimelineSeverity(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="ALL">All Severities</option>
                <option value="INFO">Info</option>
                <option value="WARNING">Warning</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <button
              onClick={fetchTimeline}
              disabled={timelineLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${timelineLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Feed</span>
            </button>
          </div>

          {/* Timeline Stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Authoritative Unified Campus Event Stream</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {timelineEvents.length} Events Aggregated
              </span>
            </div>

            {timelineLoading && timelineEvents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 text-slate-600 animate-spin mx-auto mb-2" />
                <span>Aggregating real-time campus events...</span>
              </div>
            ) : timelineEvents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-1">
                <CheckCircle className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                <p className="font-semibold text-slate-300">No events found matching current criteria</p>
                <p className="text-[11px]">Real campus events will populate dynamically as attendance and sensors operate.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {timelineEvents.map((evt, idx) => {
                  const isCritical = evt.severity === 'CRITICAL' || evt.event_type?.includes('SECURITY') || evt.event_type?.includes('ANOMALY');
                  const isWarning = evt.severity === 'WARNING' || evt.event_type?.includes('OFFLINE');
                  const isVerified = evt.event_type?.includes('ATTENDANCE') || evt.event_type?.includes('RECOGNIZED');

                  return (
                    <div
                      key={evt.id || idx}
                      className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        isCritical
                          ? 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                          : isWarning
                          ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                          : isVerified
                          ? 'bg-emerald-950/15 border-emerald-800/30 text-emerald-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                            isCritical
                              ? 'bg-rose-950/80 text-rose-400 border border-rose-700/50'
                              : isWarning
                              ? 'bg-amber-950/80 text-amber-400 border border-amber-700/50'
                              : isVerified
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {isCritical ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : isVerified ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Activity className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white">{evt.event_type || 'SYSTEM_EVENT'}</span>
                            {evt.classroom && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                                {evt.classroom}
                              </span>
                            )}
                            {evt.severity && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isCritical
                                    ? 'bg-rose-900/60 text-rose-300'
                                    : isWarning
                                    ? 'bg-amber-900/60 text-amber-300'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {evt.severity}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-[11px] leading-relaxed">
                            {evt.description || evt.message || JSON.stringify(evt.payload || evt.data || 'Event recorded')}
                          </p>
                        </div>
                      </div>

                      <div className="sm:text-right shrink-0">
                        <span className="text-[11px] font-mono text-slate-400 block">
                          {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : 'Recent'}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {evt.timestamp ? new Date(evt.timestamp).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
