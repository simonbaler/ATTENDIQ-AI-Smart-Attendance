import React, { useState, useEffect } from 'react';
import { Layers, X, Loader2, AlertCircle, Play, Building2, Users, CheckSquare, Square, Sparkles } from 'lucide-react';
import { DepartmentInfo, AttendanceSession, Student } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newSession?: AttendanceSession) => void;
  departments: DepartmentInfo[];
}

export const SessionModal: React.FC<SessionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  departments,
}) => {
  const { user } = useAuth();
  const [sessionMode, setSessionMode] = useState<'multi' | 'single'>('multi');

  // Multi-department state
  const [selectedDepts, setSelectedDepts] = useState<string[]>([
    'Computer Science & Engineering',
    'Software Engineering',
    'Electrical & Electronics Engineering',
  ]);
  const [students, setStudents] = useState<Student[]>([]);

  // Form fields
  const [classroom, setClassroom] = useState('C-204');
  const [subject, setSubject] = useState('Database Management Systems');
  const [faculty, setFaculty] = useState(user?.full_name || 'Prof. R. Sharma');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [singleDept, setSingleDept] = useState(
    user?.role === 'HOD' ? user.department : departments[0]?.name || 'Computer Science & Engineering'
  );
  const [section, setSection] = useState('A');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(new Date().toTimeString().slice(0, 5));

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch active students to calculate real-time department roster counts
  useEffect(() => {
    if (isOpen) {
      api.getStudents().then((res) => {
        if (res.success && res.students) {
          setStudents(res.students);
        }
      }).catch((e) => console.error('Error fetching students for session modal:', e));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleDept = (deptName: string) => {
    if (selectedDepts.includes(deptName)) {
      if (selectedDepts.length > 1) {
        setSelectedDepts(selectedDepts.filter((d) => d !== deptName));
      }
    } else {
      setSelectedDepts([...selectedDepts, deptName]);
    }
  };

  const selectAllDepts = () => {
    setSelectedDepts(departments.map((d) => d.name));
  };

  const clearDepts = () => {
    setSelectedDepts(departments.length > 0 ? [departments[0].name] : []);
  };

  // Calculate live roster count based on selected departments
  const getDeptStudentCount = (deptName: string) => {
    const target = deptName.toLowerCase();
    return students.filter((s) => {
      const sDept = s.department.toLowerCase();
      return sDept === target || sDept.includes(target) || target.includes(sDept);
    }).length;
  };

  const totalRosterCount = selectedDepts.reduce((sum, d) => sum + getDeptStudentCount(d), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (sessionMode === 'multi') {
        if (selectedDepts.length === 0) {
          setErrorMsg('Please select at least one department.');
          setLoading(false);
          return;
        }

        const res = await api.startSession({
          is_multi_department: true,
          departments: selectedDepts,
          subject,
          classroom,
          faculty,
          academic_year: academicYear,
          date: sessionDate,
          start_time: startTime,
        });

        if (res.success && res.session) {
          onSuccess(res.session);
          onClose();
        } else {
          setErrorMsg(res.message || 'Failed to start multi-department session.');
        }
      } else {
        const res = await api.startSession({
          is_multi_department: false,
          department: singleDept,
          section,
          subject,
          classroom,
          faculty,
          academic_year: academicYear,
          date: sessionDate,
          start_time: startTime,
        });

        if (res.success && res.session) {
          onSuccess(res.session);
          onClose();
        } else {
          setErrorMsg(res.message || 'Failed to start session.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Session start failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-slate-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Start Attendance Session</h3>
              <p className="text-xs text-slate-400">Multi-Department or Single-Section Classroom Launch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setSessionMode('multi')}
            className={`py-2.5 px-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition ${
              sessionMode === 'multi'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Multi-Department Session</span>
            <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 px-1.5 py-0.5 rounded">
              Smart
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSessionMode('single')}
            className={`py-2.5 px-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition ${
              sessionMode === 'single'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Single Section Session</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Multi-Department Selector Panel */}
          {sessionMode === 'multi' ? (
            <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-200">
                    Participating Departments <span className="text-rose-400">*</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Synchronized Google Sheet master data will automatically identify and assign each student's department.
                  </p>
                </div>
                <div className="flex space-x-2 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllDepts}
                    className="text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={clearDepts}
                    className="text-slate-400 hover:text-slate-300 font-medium"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
                {departments.map((dept) => {
                  const isSelected = selectedDepts.includes(dept.name);
                  const count = getDeptStudentCount(dept.name);
                  return (
                    <div
                      key={dept.code}
                      onClick={() => toggleDept(dept.name)}
                      className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition text-xs ${
                        isSelected
                          ? 'bg-emerald-950/40 border-emerald-600/70 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2 overflow-hidden">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <div className="truncate">
                          <span className="font-semibold text-white mr-1.5">{dept.code}</span>
                          <span className="text-[11px] text-slate-300 truncate">{dept.name}</span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono shrink-0 ml-1">
                        {count} stu
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Roster Live Preview Badge */}
              <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-800/40 px-3 py-2 rounded-lg text-xs text-emerald-300">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    <strong>{selectedDepts.length}</strong> Departments Selected
                  </span>
                </div>
                <div className="font-mono text-emerald-200">
                  {totalRosterCount > 0 ? `${totalRosterCount} Students in Frozen Roster` : 'Roster ready'}
                </div>
              </div>
            </div>
          ) : (
            /* Single Department Selector */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Department <span className="text-rose-400">*</span>
                </label>
                <select
                  disabled={user?.role === 'HOD'}
                  value={singleDept}
                  onChange={(e) => setSingleDept(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-75"
                >
                  {departments.map((d) => (
                    <option key={d.code} value={d.name}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Section <span className="text-rose-400">*</span>
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {['A', 'B', 'C', 'D', 'ALL'].map((sec) => (
                    <option key={sec} value={sec}>
                      {sec === 'ALL' ? 'All Sections' : `Section ${sec}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Core Session Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Classroom / Venue <span className="text-rose-400">*</span>
              </label>
              <input
                required
                value={classroom}
                onChange={(e) => setClassroom(e.target.value)}
                placeholder="e.g. C-204, LH-301"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Subject / Topic <span className="text-rose-400">*</span>
              </label>
              <input
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Database Management Systems"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Faculty In-Charge</label>
              <input
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="e.g. Prof. R. Sharma"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Academic Year</label>
              <input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2025-2026"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Session Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Start Time <span className="text-rose-400">*</span>
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg flex items-center space-x-2 disabled:opacity-50 transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{sessionMode === 'multi' ? 'Launch Multi-Department Session' : 'Launch Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

