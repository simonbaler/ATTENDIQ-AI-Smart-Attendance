import React, { useState, useEffect } from 'react';
import {
  Download,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Edit,
  RefreshCw,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  User,
  ShieldCheck,
} from 'lucide-react';
import { AttendanceRecord, DepartmentInfo } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StudentProfileModal } from './StudentProfileModal';
import { ExplainDecisionModal } from './ExplainDecisionModal';

interface AttendanceTableProps {
  departments: DepartmentInfo[];
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({ departments }) => {
  const { user, isAdmin } = useAuth();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters
  const [filterDept, setFilterDept] = useState(user?.role === 'HOD' ? user.department : 'ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');

  // Override Modal
  const [overrideRecord, setOverrideRecord] = useState<AttendanceRecord | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
  const [explainRecord, setExplainRecord] = useState<AttendanceRecord | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.getAttendance({
        department: filterDept !== 'ALL' ? filterDept : undefined,
        section: filterSection !== 'ALL' ? filterSection : undefined,
        status: filterStatus !== 'ALL' ? filterStatus : undefined,
        date: filterDate || undefined,
      });
      if (res.success) {
        setRecords(res.records);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [filterDept, filterSection, filterStatus, filterDate]);

  const handleExportCsv = async () => {
    try {
      await api.exportAttendanceCsv({
        department: filterDept !== 'ALL' ? filterDept : undefined,
        section: filterSection !== 'ALL' ? filterSection : undefined,
        status: filterStatus !== 'ALL' ? filterStatus : undefined,
        date: filterDate || undefined,
      });
    } catch (err) {
      alert('Failed to export CSV. Please try again.');
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideRecord) return;
    setOverrideLoading(true);
    setOverrideError(null);

    try {
      const res = await api.overrideAttendance(overrideRecord.id, overrideStatus, overrideReason);
      if (res.success) {
        setOverrideRecord(null);
        setOverrideReason('');
        fetchRecords();
      } else {
        setOverrideError(res.message || 'Override failed.');
      }
    } catch (err: any) {
      setOverrideError(err.message || 'Override error.');
    } finally {
      setOverrideLoading(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.full_name.toLowerCase().includes(q) ||
      r.roll_number.toLowerCase().includes(q) ||
      r.student_id.toLowerCase().includes(q) ||
      r.subject?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Institutional Attendance Records
            </h2>
            <p className="text-xs text-slate-400">
              Verified face recognition entries and administrative attendance audit records.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchRecords}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center space-x-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Verified CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-800 text-xs">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or roll no..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              disabled={user?.role === 'HOD'}
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-70"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.code} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="C">Section C</option>
              <option value="D">Section D</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">PRESENT Only</option>
              <option value="ABSENT">ABSENT Only</option>
            </select>
          </div>

          {/* Date Picker */}
          <div className="relative">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Dept / Sec</th>
                <th className="py-3 px-4">Subject & Room</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading attendance records from database...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <span>No attendance records matching the selected filters.</span>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">
                      <button
                        onClick={() => setProfileStudentId(r.student_id)}
                        className="text-left group"
                        title="View Student Intelligence Profile"
                      >
                        <div className="font-bold text-white group-hover:text-blue-400 transition flex items-center space-x-1.5">
                          <span>{r.full_name}</span>
                          <User className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{r.student_id}</div>
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      <button
                        onClick={() => setProfileStudentId(r.student_id)}
                        className="text-left hover:text-blue-300 font-mono transition"
                        title="View Student Intelligence Profile"
                      >
                        {r.roll_number}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div>{r.department}</div>
                      <div className="text-[11px] text-slate-400">Sec {r.section}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-200 font-medium">{r.subject || 'Class Session'}</div>
                      <div className="text-[11px] text-slate-400">{r.classroom || 'Main Hall'}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <div>{r.date}</div>
                      <div className="text-slate-500">{r.time}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          r.status === 'PRESENT'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${r.confidence >= 80 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${r.confidence}%` }}
                          ></div>
                        </div>
                        <span className="text-[11px] text-slate-300">{r.confidence}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      <span className="text-slate-300">{r.verification_method}</span>
                      {r.notes && (
                        <div className="text-[10px] text-slate-500 italic truncate max-w-[120px]" title={r.notes}>
                          "{r.notes}"
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => setExplainRecord(r)}
                        className="px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-medium transition inline-flex items-center space-x-1"
                        title="Inspect biometric verification evidence"
                      >
                        <ShieldCheck className="w-3 h-3 text-blue-400" />
                        <span>Evidence</span>
                      </button>
                      <button
                        onClick={() => {
                          setOverrideRecord(r);
                          setOverrideStatus(r.status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
                          setOverrideReason('');
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium transition inline-flex items-center space-x-1"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Override</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Attendance Override Modal */}
      {overrideRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-100">
            <h3 className="text-base font-bold text-white">Manual Attendance Correction</h3>
            <p className="text-xs text-slate-400">
              Editing record for <strong className="text-white">{overrideRecord.full_name}</strong> ({overrideRecord.roll_number}) on {overrideRecord.date}.
            </p>

            {overrideError && (
              <div className="p-2.5 bg-rose-950/70 border border-rose-800 text-rose-300 text-xs rounded-lg">
                {overrideError}
              </div>
            )}

            <form onSubmit={handleSaveOverride} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">New Status</label>
                <div className="flex space-x-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="PRESENT"
                      checked={overrideStatus === 'PRESENT'}
                      onChange={() => setOverrideStatus('PRESENT')}
                      className="text-emerald-500"
                    />
                    <span className="text-emerald-400 font-semibold">PRESENT</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="ABSENT"
                      checked={overrideStatus === 'ABSENT'}
                      onChange={() => setOverrideStatus('ABSENT')}
                      className="text-rose-500"
                    />
                    <span className="text-rose-400 font-semibold">ABSENT</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Reason for Administrative Override</label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. On-duty college sports event, medical leave verified by HOD, technical correction."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOverrideRecord(null)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow transition disabled:opacity-50"
                >
                  {overrideLoading ? 'Saving...' : 'Confirm Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Intelligence Profile Modal */}
      {profileStudentId && (
        <StudentProfileModal
          studentIdOrRoll={profileStudentId}
          onClose={() => setProfileStudentId(null)}
        />
      )}

      {/* AI Decision Explainability Evidence Modal */}
      {explainRecord && (
        <ExplainDecisionModal
          record={explainRecord}
          onClose={() => setExplainRecord(null)}
        />
      )}
    </div>
  );
};
