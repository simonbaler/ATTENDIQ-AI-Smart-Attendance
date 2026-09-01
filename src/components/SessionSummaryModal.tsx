import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Users,
  UserCheck,
  UserX,
  Building2,
  Calendar,
  Clock,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import { AttendanceSession, DepartmentSessionStat } from '../types';
import { api } from '../services/api';

interface SessionSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AttendanceSession | null;
  departmentStats?: Record<string, DepartmentSessionStat>;
  absentStudents?: Array<{
    id: string;
    student_id: string;
    full_name: string;
    roll_number: string;
    department: string;
    section: string;
    status: 'ABSENT';
  }>;
  overallStats?: {
    total_students: number;
    present_count: number;
    absent_count: number;
    attendance_percentage: number;
  };
}

export const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  isOpen,
  onClose,
  session,
  departmentStats,
  absentStudents = [],
  overallStats,
}) => {
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [exporting, setExporting] = useState<boolean>(false);

  if (!isOpen || !session) return null;

  const totalStudents = overallStats?.total_students ?? session.roster_snapshot?.total_students ?? 0;
  const presentCount = overallStats?.present_count ?? 0;
  const absentCount = overallStats?.absent_count ?? Math.max(0, totalStudents - presentCount);
  const attendancePct = overallStats?.attendance_percentage ?? (totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0);

  const stats = departmentStats || session.department_stats || {};
  const deptList = Object.keys(stats);

  const filteredAbsentees = absentStudents.filter((stu) => {
    const matchesDept =
      selectedDeptFilter === 'ALL' ||
      stu.department.toLowerCase().includes(selectedDeptFilter.toLowerCase()) ||
      selectedDeptFilter.toLowerCase().includes(stu.department.toLowerCase());

    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      stu.full_name.toLowerCase().includes(q) ||
      stu.roll_number.toLowerCase().includes(q) ||
      stu.student_id.toLowerCase().includes(q);

    return matchesDept && matchesQuery;
  });

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await api.exportAttendanceCsv({ session_id: session.id });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export session CSV.');
    } finally {
      setExporting(false);
    }
  };

  const getDeptShortCode = (name: string) => {
    return name
      .replace('Computer Science & Engineering', 'CSE')
      .replace('Software Engineering', 'SE')
      .replace('Electrical & Electronics Engineering', 'EEE')
      .replace('Electronics & Communication Engineering', 'ECE')
      .replace('Artificial Intelligence & Machine Learning', 'AIML')
      .replace('Data Science', 'DS')
      .replace('Information Technology', 'IT')
      .replace('Mechanical Engineering', 'MECH')
      .replace('Civil Engineering', 'CIVIL');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 text-slate-100 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Session Attendance Summary
                </h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                    session.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {session.status}
                </span>
                {session.is_multi_department && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold">
                    Multi-Department
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {session.subject} • {session.classroom} • {session.date} ({session.start_time} - {session.end_time || 'Ongoing'})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCsv}
              disabled={exporting}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center space-x-1.5 disabled:opacity-50"
              title="Download verified institutional session attendance report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto space-y-6 pr-1 flex-1">
          {/* Top-Level Overall Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Members
              </span>
              <div className="text-2xl font-black text-white mt-1 font-mono">{totalStudents}</div>
              <span className="text-[10px] text-slate-500">Enrolled in session roster</span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                Total Present
              </span>
              <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">{presentCount}</div>
              <span className="text-[10px] text-emerald-500/80">Biometrically verified</span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">
                Total Absent
              </span>
              <div className="text-2xl font-black text-rose-400 mt-1 font-mono">{absentCount}</div>
              <span className="text-[10px] text-rose-500/80">Unverified absentees</span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider block">
                Attendance Rate
              </span>
              <div className="text-2xl font-black text-blue-400 mt-1 font-mono">{attendancePct}%</div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, attendancePct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Department Breakdown Cards */}
          {deptList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Department Attendance Breakdown ({deptList.length} Participating Departments)</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {deptList.map((deptName) => {
                  const stat = stats[deptName];
                  const shortCode = getDeptShortCode(deptName);
                  const isHigh = stat.attendance_percentage >= 80;
                  const isLow = stat.attendance_percentage < 60;

                  return (
                    <div
                      key={deptName}
                      className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-emerald-300">
                            {shortCode}
                          </span>
                          <span className="text-xs font-semibold text-white truncate max-w-[130px]">
                            {deptName}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-mono font-bold ${
                            isHigh ? 'text-emerald-400' : isLow ? 'text-rose-400' : 'text-amber-400'
                          }`}
                        >
                          {stat.attendance_percentage}%
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-[11px] pt-1 border-t border-slate-900">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Total</span>
                          <span className="font-mono text-slate-200 font-bold">{stat.total}</span>
                        </div>
                        <div>
                          <span className="text-emerald-500/80 block text-[10px]">Present</span>
                          <span className="font-mono text-emerald-400 font-bold">{stat.present}</span>
                        </div>
                        <div>
                          <span className="text-rose-500/80 block text-[10px]">Absent</span>
                          <span className="font-mono text-rose-400 font-bold">{stat.absent}</span>
                        </div>
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isHigh ? 'bg-emerald-500' : isLow ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, stat.attendance_percentage)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Absent Students List with Search & Department Filters */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <UserX className="w-3.5 h-3.5 text-rose-400" />
                  <span>Absent Students ({filteredAbsentees.length} of {absentStudents.length})</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Students enrolled in the authoritative roster who were not verified in this session.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {/* Department Filter Tabs */}
                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Departments</option>
                  {deptList.map((d) => (
                    <option key={d} value={d}>
                      {getDeptShortCode(d)} ({d})
                    </option>
                  ))}
                </select>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search absentee..."
                    className="pl-7 pr-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36 sm:w-44"
                  />
                </div>
              </div>
            </div>

            {filteredAbsentees.length === 0 ? (
              <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-xs font-semibold text-emerald-300">
                  {absentStudents.length === 0 ? '100% Full Attendance!' : 'No matching absentees found.'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {absentStudents.length === 0
                    ? 'All enrolled students from all departments were verified present.'
                    : 'Try changing your department filter or search query.'}
                </p>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-850">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Roll Number</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3">Department</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 bg-slate-950/60">
                    {filteredAbsentees.map((stu) => (
                      <tr key={stu.id || stu.roll_number} className="hover:bg-slate-900/60 transition">
                        <td className="py-2 px-3 font-mono font-bold text-slate-200">{stu.roll_number}</td>
                        <td className="py-2 px-3 font-semibold text-slate-300">{stu.full_name}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                            {getDeptShortCode(stu.department)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                            ABSENT
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center space-x-2">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Recorded in ATTENDIQ AI Roster Ledger</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition"
          >
            Close Summary
          </button>
        </div>
      </div>
    </div>
  );
};
