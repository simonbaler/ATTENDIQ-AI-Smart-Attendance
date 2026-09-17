import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Camera,
  Shield,
  Activity,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Smartphone,
  Laptop,
  AlertTriangle,
  Bell,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { StudentAnalyticsProfile } from '../types';
import { api } from '../services/api';

interface StudentProfileModalProps {
  studentIdOrRoll: string | null;
  onClose: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  studentIdOrRoll,
  onClose,
}) => {
  const [profile, setProfile] = useState<StudentAnalyticsProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'subjects' | 'objects' | 'behavior' | 'notifications' | 'biometrics'>('overview');

  useEffect(() => {
    if (!studentIdOrRoll) return;
    setLoading(true);
    setError(null);
    api
      .getStudentProfile(studentIdOrRoll)
      .then((res) => {
        if (res.success && res.profile) {
          setProfile(res.profile);
        } else {
          setError('Student analytics profile could not be loaded.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch student profile.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [studentIdOrRoll]);

  if (!studentIdOrRoll) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header Bar */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-blue-500/20">
              {profile?.student.name?.slice(0, 2).toUpperCase() || profile?.student.full_name?.slice(0, 2).toUpperCase() || 'ST'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-gray-900 leading-tight">
                  {profile?.student.name || profile?.student.full_name || 'Student Intelligence Profile'}
                </h3>
                {profile?.student.status === 'ACTIVE' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                    Inactive
                  </span>
                )}
                {profile && (() => {
                  const pct = profile.attendance_percentage ?? 0;
                  const cat: 'CRITICAL' | 'AT_RISK' | 'MODERATE' | 'SAFE' =
                    pct < 65 ? 'CRITICAL' : pct < 75 ? 'AT_RISK' : pct < 85 ? 'MODERATE' : 'SAFE';
                  const badgeStyle =
                    cat === 'CRITICAL'
                      ? 'bg-red-100 text-red-800 border-red-300'
                      : cat === 'AT_RISK'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : cat === 'MODERATE'
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300';
                  return (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeStyle}`}>
                      {cat.replace('_', ' ')}
                    </span>
                  );
                })()}
                {profile && (profile.consecutive_absences ?? 0) >= 2 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{profile.consecutive_absences} Consecutive Absences</span>
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 flex items-center space-x-2 mt-0.5">
                <span className="font-mono font-semibold text-blue-700">{profile?.student.roll_number || studentIdOrRoll}</span>
                <span>&bull;</span>
                <span>{profile?.student.department}</span>
                <span>&bull;</span>
                <span>Section {profile?.student.section}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">Computing authoritative analytics for {studentIdOrRoll}...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-red-600">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-sm">{error}</p>
            </div>
          ) : profile && (
            <>
              {/* Tab Navigation */}
              <div className="flex items-center space-x-1 border-b border-gray-100 pb-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'overview'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Overview & Risk
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'timeline'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Daily Timeline
                </button>
                <button
                  onClick={() => setActiveTab('subjects')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'subjects'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Subject Breakdown
                </button>
                <button
                  onClick={() => setActiveTab('objects')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'objects'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Object Events
                </button>
                <button
                  onClick={() => setActiveTab('behavior')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'behavior'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Visual Signals
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'notifications'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Absence Notices
                </button>
                <button
                  onClick={() => setActiveTab('biometrics')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    activeTab === 'biometrics'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Biometric Readiness
                </button>
              </div>

              {/* Tab 1: Overview & Risk Indicators */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  {/* Time-Granular Attendance Progression */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/80">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Today's Attendance</div>
                      <div className="text-2xl font-bold mt-1 text-blue-600">
                        {profile.daily_attendance ?? profile.attendance_percentage}%
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Today's active periods</div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/80">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Weekly Attendance</div>
                      <div className="text-2xl font-bold text-indigo-600 mt-1">
                        {profile.weekly_attendance ?? profile.attendance_percentage}%
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Last 7 calendar days</div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/80">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Monthly Attendance</div>
                      <div className="text-2xl font-bold text-emerald-600 mt-1">
                        {profile.monthly_attendance ?? profile.attendance_percentage}%
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Current month cycle</div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/80">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Semester Turnout</div>
                      <div className={`text-2xl font-bold mt-1 ${
                        profile.attendance_percentage >= 75 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {profile.attendance_percentage}%
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Benchmark: 75% minimum</div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/80 col-span-2 sm:col-span-1">
                      <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Consistency Score</div>
                      {(() => {
                        const variance = Math.abs((profile.weekly_attendance ?? profile.attendance_percentage) - (profile.monthly_attendance ?? profile.attendance_percentage));
                        const penalties = (profile.consecutive_absences ?? 0) * 8;
                        const score = Math.max(10, Math.min(100, Math.round(100 - variance * 1.2 - penalties)));
                        return (
                          <>
                            <div className={`text-2xl font-bold mt-1 ${score >= 80 ? 'text-purple-700' : score >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {score}/100
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {score >= 80 ? 'Highly Reliable' : score >= 60 ? 'Moderate Variance' : 'High Volatility'}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Institutional Risk Indicators */}
                  {profile.risk_indicators && profile.risk_indicators.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Institutional Attendance Risk Alerts</span>
                      </h4>
                      <div className="space-y-2">
                        {profile.risk_indicators.map((risk, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-2xl border flex items-start justify-between space-x-3 text-xs ${
                              risk.severity === 'CRITICAL'
                                ? 'bg-red-50/80 border-red-200 text-red-900'
                                : 'bg-amber-50/80 border-amber-200 text-amber-900'
                            }`}
                          >
                            <div>
                              <div className="font-bold flex items-center space-x-2">
                                <span>{risk.type.replace(/_/g, ' ')}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                  risk.severity === 'CRITICAL' ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'
                                }`}>
                                  {risk.severity}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] opacity-90">{risk.explanation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Monthly Progression Trend */}
                  {profile.monthly_trend.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Monthly Attendance Progression</h4>
                      <div className="space-y-2">
                        {profile.monthly_trend.map((m) => (
                          <div key={m.month} className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-800">{m.month}</span>
                            <div className="flex items-center space-x-3">
                              <span className="text-gray-500">{m.attended} / {m.total} periods</span>
                              <span className={`font-bold ${
                                m.percentage >= 75 ? 'text-emerald-600' : 'text-amber-600'
                              }`}>
                                {m.percentage}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Attendance Records */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Recent Attendance Verification Records</h4>
                    {profile.recent_records.length === 0 ? (
                      <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-500">
                        No recorded attendance events in current term.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden bg-white max-h-56 overflow-y-auto">
                        {profile.recent_records.map((rec) => (
                          <div key={rec.id} className="p-3 text-xs flex items-center justify-between hover:bg-gray-50">
                            <div>
                              <span className="font-bold text-gray-900">{rec.subject}</span>
                              <div className="text-[11px] text-gray-500">{rec.date} &bull; {rec.time || 'Period Class'}</div>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.status === 'PRESENT'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {rec.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Hourly Attendance / Daily Timeline (Phase 52) */}
              {activeTab === 'timeline' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Today's Period-Wise Attendance Timeline
                    </h4>
                    <span className="text-[11px] text-gray-500 font-medium">
                      Authoritative Timetable Alignment
                    </span>
                  </div>

                  {(!profile.daily_timeline || profile.daily_timeline.length === 0) ? (
                    <div className="p-8 bg-gray-50 rounded-2xl text-center text-xs text-gray-500">
                      <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold">No scheduled periods for today.</p>
                      <p className="text-[11px] text-gray-400 mt-1">Timetable slots configured for this student will appear here automatically.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {profile.daily_timeline.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex items-center justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold text-blue-700">
                                {item.period_time}
                              </span>
                              <span className="text-xs font-bold text-gray-900">
                                {item.subject}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 flex items-center space-x-2">
                              <span>Room {item.classroom}</span>
                              {item.faculty && <span>&bull; Faculty: {item.faculty}</span>}
                              {item.timestamp && (
                                <span className="font-mono text-gray-400">
                                  &bull; Verified: {new Date(item.timestamp).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold border ${
                              item.status === 'PRESENT'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.status === 'ABSENT'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Subject Breakdown */}
              {activeTab === 'subjects' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Subject-Wise Breakdown</h4>
                  {Object.keys(profile.subject_wise).length === 0 ? (
                    <div className="p-8 bg-gray-50 rounded-2xl text-center text-xs text-gray-500">
                      No subjects recorded for this student yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {Object.entries(profile.subject_wise).map(([subject, stats]: [string, { total: number; attended: number; percentage: number }]) => (
                        <div key={subject} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-900">{subject}</span>
                            <span className={`font-bold ${
                              stats.percentage >= 75 ? 'text-emerald-600' : 'text-amber-600'
                            }`}>
                              {stats.percentage}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                stats.percentage >= 75 ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, stats.percentage)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-500">
                            <span>Attended: {stats.attended}</span>
                            <span>Total Conducted: {stats.total}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Object Detection Events (Phase 43 & 52) */}
              {activeTab === 'objects' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Detected Classroom Device Signals
                    </h4>
                    <span className="text-[10px] px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-full font-bold">
                      Strictly Separate from Biometric ID
                    </span>
                  </div>

                  {(!profile.object_detection_events || profile.object_detection_events.length === 0) ? (
                    <div className="p-8 bg-gray-50 rounded-2xl text-center text-xs text-gray-500">
                      <Smartphone className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold">No device usage events detected for this student.</p>
                      <p className="text-[11px] text-gray-400 mt-1">Objects detected during live camera monitoring are logged here with timestamps.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {profile.object_detection_events.map((evt) => (
                        <div key={evt.id} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                              <Laptop className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-gray-900">
                                {evt.metadata?.detected_object || evt.details}
                              </span>
                              <div className="text-[11px] text-gray-500">
                                Confidence: {evt.metadata?.confidence ? `${evt.metadata.confidence}%` : 'High'} &bull; Room {evt.metadata?.classroom || 'Classroom'}
                              </div>
                            </div>
                          </div>
                          <span className="font-mono text-gray-500 text-[11px]">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Visual Signals */}
              {activeTab === 'behavior' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">In-Class Visual Signals</h4>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md font-semibold">
                      AI-estimated visual signal
                    </span>
                  </div>

                  {profile.behavior_events.length === 0 ? (
                    <div className="p-8 bg-gray-50 rounded-2xl text-center text-xs text-gray-500">
                      No behavioral signal events recorded for this student.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {profile.behavior_events.map((evt) => (
                        <div key={evt.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900">{evt.event_type.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-gray-500 font-mono">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-gray-600">{evt.details}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 6: Absence Notifications Dispatched */}
              {activeTab === 'notifications' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Absence Dispatch Notices Log
                    </h4>
                    <span className="text-[10px] px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full font-bold">
                      Automated Institutional Alerts
                    </span>
                  </div>

                  {(!profile.notifications || profile.notifications.length === 0) ? (
                    <div className="p-8 bg-gray-50 rounded-2xl text-center text-xs text-gray-500">
                      <Bell className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold">No absence notifications dispatched for this student.</p>
                      <p className="text-[11px] text-gray-400 mt-1">When students are absent during scheduled sessions, automated notices appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {profile.notifications.map((notif) => (
                        <div key={notif.id} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-gray-900">{notif.subject} Notice</div>
                            <div className="text-[11px] text-gray-500">
                              {notif.date} &bull; Room {notif.classroom} &bull; Email: {notif.email}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              notif.delivery_status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {notif.delivery_status}
                            </span>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                              {new Date(notif.sent_at).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 7: Biometric Readiness */}
              {activeTab === 'biometrics' && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700">Biometric Template Status:</span>
                      <span className={`px-2.5 py-0.5 rounded-full font-bold ${
                        profile.biometric_readiness.status === 'READY'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {profile.biometric_readiness.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700">Authoritative Master Sync:</span>
                      <span className="flex items-center space-x-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Google Sheets Synced</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700">Enrolled Face Samples:</span>
                      <span className="font-bold text-gray-900">{profile.biometric_readiness.photos_count} Images</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700">Embedding Vector Available:</span>
                      <span className="font-bold text-gray-900">
                        {profile.biometric_readiness.has_embeddings ? '128D Vector Enrolled' : 'Not generated'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700">Last Biometric Audit:</span>
                      <span className="text-gray-500 font-mono">
                        {profile.biometric_readiness.last_biometric_sync || 'Upon Registration'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs shadow-sm transition"
          >
            Close Profile
          </button>
        </div>

      </div>
    </div>
  );
};
