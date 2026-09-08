import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Search,
  Plus,
  Camera,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  FileSpreadsheet,
  User,
} from 'lucide-react';
import { Student, DepartmentInfo } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StudentFormModal } from './StudentFormModal';
import { FaceEnrollmentModal } from './FaceEnrollmentModal';
import { GoogleSheetsSyncModal } from './GoogleSheetsSyncModal';
import { StudentProfileModal } from './StudentProfileModal';

interface StudentDirectoryProps {
  departments: DepartmentInfo[];
}

export const StudentDirectory: React.FC<StudentDirectoryProps> = ({ departments }) => {
  const { user, isAdmin } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filter states
  const [filterDept, setFilterDept] = useState(user?.role === 'HOD' ? user.department : 'ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showSheetsSyncModal, setShowSheetsSyncModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [enrollStudent, setEnrollStudent] = useState<Student | null>(null);
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await api.getStudents({
        department: filterDept !== 'ALL' ? filterDept : undefined,
        section: filterSection !== 'ALL' ? filterSection : undefined,
        status: filterStatus !== 'ALL' ? filterStatus : undefined,
      });
      if (res.success) {
        setStudents(res.students);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [filterDept, filterSection, filterStatus]);

  const handleRebuildEncoding = async (studentId: string, studentName: string) => {
    try {
      const res = await api.rebuildEncoding(studentId);
      if (res.success) {
        alert(`Face encodings rebuilt and normalized for ${studentName}.`);
        fetchStudents();
      } else {
        alert(res.message || 'Failed to rebuild encoding.');
      }
    } catch (err: any) {
      alert(err.message || 'Encoding rebuild error.');
    }
  };

  const handleDeactivate = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to deactivate student ${studentName}?`)) return;
    try {
      const res = await api.deactivateStudent(studentId);
      if (res.success) {
        fetchStudents();
      }
    } catch (err) {
      console.error('Error deactivating student:', err);
    }
  };

  const filteredStudents = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.roll_number.toLowerCase().includes(q) ||
      s.student_id.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Student Directory & Face Enrolment
            </h2>
            <p className="text-xs text-slate-400">
              Registered students and biometric 128D facial feature vectors database.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSheetsSyncModal(true)}
              className="px-3.5 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-emerald-100 rounded-lg text-xs font-semibold shadow transition flex items-center space-x-1.5 border border-emerald-600/50"
              title="Synchronize from Google Sheets master source"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Sync Google Sheets</span>
            </button>
            <button
              onClick={fetchStudents}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Refresh Students"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setEditingStudent(null);
                setShowRegisterModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Student</span>
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or roll number..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

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

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Students Only</option>
              <option value="INACTIVE">Deactivated Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Department & Sec</th>
                <th className="py-3 px-4">Academic Year</th>
                <th className="py-3 px-4">Face Status</th>
                <th className="py-3 px-4">Enrolled Vectors</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4 text-right">Biometric & Record Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading student records...</span>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <span>No students found. Click "Register New Student" to enroll your first student.</span>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setProfileStudentId(s.id)}
                        className="text-left group"
                        title="View Student Intelligence Profile"
                      >
                        <div className="font-bold text-white text-sm group-hover:text-blue-400 transition flex items-center space-x-1.5">
                          <span>{s.full_name}</span>
                          <User className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">{s.student_id}</div>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setProfileStudentId(s.id)}
                        className="font-mono font-semibold text-slate-200 hover:text-blue-300 transition text-left"
                        title="View Student Intelligence Profile"
                      >
                        {s.roll_number}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-200">{s.department}</div>
                      <div className="text-[11px] text-slate-400 font-mono">Sec {s.section}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      <div>{s.academic_year}</div>
                      <div className="text-slate-500">{s.batch}</div>
                    </td>
                    <td className="py-3 px-4">
                      {s.face_registered ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>ENROLLED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <XCircle className="w-3 h-3" />
                          <span>NOT REGISTERED</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {s.face_images_count || 0} samples
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          s.status === 'ACTIVE'
                            ? 'bg-blue-900/40 text-blue-300 border border-blue-800'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setEnrollStudent(s)}
                          className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-[11px] font-semibold transition flex items-center space-x-1"
                          title="Capture / Enroll Student Face"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{s.face_registered ? 'Update Face' : 'Enroll Face'}</span>
                        </button>

                        {s.face_registered && (
                          <button
                            onClick={() => handleRebuildEncoding(s.id, s.full_name)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-[11px]"
                            title="Rebuild Mean Descriptor"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setEditingStudent(s);
                            setShowRegisterModal(true);
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700"
                          title="Edit Details"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {s.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleDeactivate(s.id, s.full_name)}
                            className="p-1 rounded bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-300 border border-slate-700"
                            title="Deactivate Student"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration / Edit Modal */}
      <StudentFormModal
        isOpen={showRegisterModal}
        onClose={() => {
          setShowRegisterModal(false);
          setEditingStudent(null);
        }}
        onSuccess={(saved) => {
          fetchStudents();
          if (saved && !editingStudent) {
            // Prompt to enroll face immediately after registration
            setEnrollStudent(saved);
          }
        }}
        departments={departments}
        editStudent={editingStudent}
      />

      {/* Face Enrollment Modal */}
      {enrollStudent && (
        <FaceEnrollmentModal
          student={enrollStudent}
          isOpen={!!enrollStudent}
          onClose={() => setEnrollStudent(null)}
          onSuccess={() => {
            fetchStudents();
          }}
        />
      )}

      {/* Google Sheets Synchronization Modal */}
      <GoogleSheetsSyncModal
        isOpen={showSheetsSyncModal}
        onClose={() => setShowSheetsSyncModal(false)}
        onSuccess={() => {
          fetchStudents();
        }}
        departments={departments}
      />

      {/* Student Intelligence Profile Modal */}
      {profileStudentId && (
        <StudentProfileModal
          studentIdOrRoll={profileStudentId}
          onClose={() => setProfileStudentId(null)}
        />
      )}
    </div>
  );
};
