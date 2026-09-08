import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Building2,
  Users,
  Play,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Video,
  Shield,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { TimetableSlot, AttendanceSession } from '../types';
import { api } from '../services/api';

interface TimetableEngineViewProps {
  onTriggerSession?: (session: AttendanceSession) => void;
  userRole?: string;
  userDepartment?: string;
}

export const TimetableEngineView: React.FC<TimetableEngineViewProps> = ({
  onTriggerSession,
  userRole = 'ADMIN',
  userDepartment,
}) => {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlotData, setActiveSlotData] = useState<{
    has_active_slot: boolean;
    slot?: TimetableSlot;
    current_time: string;
    current_day: string;
    active_session?: AttendanceSession;
  } | null>(null);

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>(userDepartment || 'ALL');
  const [selectedDay, setSelectedDay] = useState<string>('ALL');
  const [selectedClassroom, setSelectedClassroom] = useState<string>('ALL');

  // Triggering state
  const [triggeringSlotId, setTriggeringSlotId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Slot modal
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [formData, setFormData] = useState<Partial<TimetableSlot>>({
    department: userDepartment || 'CSE',
    departments: ['CSE'],
    section: 'A',
    classroom: 'C-204',
    subject: '',
    faculty: '',
    start_time: '09:00',
    end_time: '10:00',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    period_number: 1,
    academic_year: '2025-2026 (Even Semester)',
    attendance_policy: 'STRICT_TEMPORAL_3F',
    is_multi_department: false,
    camera_ids: ['cam_c204_front'],
  });

  const loadTimetable = async () => {
    setLoading(true);
    try {
      const [slotsRes, activeRes] = await Promise.all([
        api.getTimetableSlots({
          department: selectedDepartment !== 'ALL' ? selectedDepartment : undefined,
          day: selectedDay !== 'ALL' ? selectedDay : undefined,
          classroom: selectedClassroom !== 'ALL' ? selectedClassroom : undefined,
        }),
        api.getActiveTimetableSlot(),
      ]);

      if (slotsRes.success) {
        setSlots(slotsRes.slots);
      }
      if (activeRes.success) {
        setActiveSlotData(activeRes);
      }
    } catch (err) {
      console.error('Failed to load timetable:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable();
    const timer = setInterval(() => {
      api.getActiveTimetableSlot().then((res) => {
        if (res.success) setActiveSlotData(res);
      });
    }, 30000);
    return () => clearInterval(timer);
  }, [selectedDepartment, selectedDay, selectedClassroom]);

  const handleTriggerSession = async (slot: TimetableSlot) => {
    setTriggeringSlotId(slot.id);
    setActionMessage(null);
    try {
      const res = await api.triggerTimetableSession(slot.id);
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `Session activated for ${slot.subject} in ${slot.classroom}. ${slot.is_multi_department ? `Multi-department roster initialized (${slot.departments?.join(', ')}).` : ''}`,
        });
        if (onTriggerSession && res.session) {
          onTriggerSession(res.session);
        }
        loadTimetable();
      } else {
        setActionMessage({ type: 'error', text: res.message || 'Failed to trigger timetable session' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Network error triggering session' });
    } finally {
      setTriggeringSlotId(null);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this timetable slot?')) return;
    try {
      const res = await api.deleteTimetableSlot(id);
      if (res.success) {
        loadTimetable();
      }
    } catch (err) {
      console.error('Error deleting slot:', err);
    }
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSlot) {
        const res = await api.updateTimetableSlot(editingSlot.id, formData);
        if (res.success) {
          setShowSlotModal(false);
          setEditingSlot(null);
          loadTimetable();
        }
      } else {
        const res = await api.createTimetableSlot(formData);
        if (res.success) {
          setShowSlotModal(false);
          loadTimetable();
        }
      }
    } catch (err) {
      console.error('Error saving slot:', err);
    }
  };

  const openNewSlotModal = () => {
    setEditingSlot(null);
    setFormData({
      department: userDepartment || 'CSE',
      departments: ['CSE'],
      section: 'A',
      classroom: 'C-204',
      subject: '',
      faculty: '',
      start_time: '09:00',
      end_time: '10:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      period_number: slots.length + 1,
      academic_year: '2025-2026 (Even Semester)',
      attendance_policy: 'STRICT_TEMPORAL_3F',
      is_multi_department: false,
      camera_ids: ['cam_c204_front'],
    });
    setShowSlotModal(true);
  };

  const openEditSlotModal = (slot: TimetableSlot) => {
    setEditingSlot(slot);
    setFormData({ ...slot });
    setShowSlotModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Active Timetable Slot Detection */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-400/20 text-blue-200 border border-blue-400/30 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-blue-300" />
                <span>Clock Synchronized</span>
              </span>
              <span className="text-xs text-blue-200/80">
                {activeSlotData?.current_day}, {activeSlotData?.current_time}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
              <span>Intelligent Timetable Attendance Engine</span>
              <Sparkles className="w-5 h-5 text-amber-300" />
            </h2>
            <p className="text-sm text-blue-100/80 max-w-2xl">
              Automated institutional course timetable with multi-department roster resolution, linked classroom camera streams, and instant session activation.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={loadTimetable}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition border border-white/10"
              title="Refresh Timetable Engine"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openNewSlotModal}
              className="flex items-center space-x-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-2xl font-semibold shadow-lg shadow-blue-500/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Timetable Slot</span>
            </button>
          </div>
        </div>

        {/* Current Active Slot Callout */}
        {activeSlotData?.has_active_slot && activeSlotData.slot && (
          <div className="mt-5 pt-5 border-t border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/5 rounded-2xl p-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Scheduled Right Now</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white">Period {activeSlotData.slot.period_number}</span>
                  {activeSlotData.slot.is_multi_department && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 border border-amber-400/30 font-semibold">
                      Multi-Department ({activeSlotData.slot.departments?.join(', ')})
                    </span>
                  )}
                </div>
                <div className="text-base font-bold text-white mt-0.5">
                  {activeSlotData.slot.subject} &bull; Room {activeSlotData.slot.classroom}
                </div>
                <div className="text-xs text-blue-200/80">
                  {activeSlotData.slot.faculty} &bull; {activeSlotData.slot.start_time} - {activeSlotData.slot.end_time}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              {activeSlotData.active_session ? (
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Session Live In Classroom</span>
                </div>
              ) : (
                <button
                  onClick={() => handleTriggerSession(activeSlotData.slot!)}
                  disabled={triggeringSlotId === activeSlotData.slot.id}
                  className="flex items-center justify-center space-x-2 w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{triggeringSlotId === activeSlotData.slot.id ? 'Initializing Session...' : 'Start Session for Active Period'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center space-x-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span className="text-sm font-medium">{actionMessage.text}</span>
        </div>
      )}

      {/* Filter Controls */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Department:</span>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Departments</option>
              <option value="CSE">CSE</option>
              <option value="AIML">AIML</option>
              <option value="DS">Data Science</option>
              <option value="ECE">ECE</option>
              <option value="SE">Software Eng</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Day:</span>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Weekdays</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Classroom:</span>
            <select
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">All Classrooms</option>
              <option value="C-204">C-204</option>
              <option value="LH-301">LH-301 (Multi-Dept Hall)</option>
              <option value="LH-204">LH-204</option>
              <option value="ECE-Lab-1">ECE-Lab-1</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-semibold text-gray-500">
          Showing <span className="text-gray-900 font-bold">{slots.length}</span> institutional periods
        </div>
      </div>

      {/* Timetable Grid / Card List */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-sm">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">Loading authoritative timetable slots...</p>
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-sm">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">No Timetable Slots Found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            No institutional period schedules match the selected filters. Click "Add Timetable Slot" to create a new period schedule.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {slots.map((slot) => {
            const isCurrentlyActive = activeSlotData?.slot?.id === slot.id;
            return (
              <div
                key={slot.id}
                className={`bg-white rounded-3xl border transition-all duration-200 hover:shadow-lg flex flex-col justify-between overflow-hidden ${
                  isCurrentlyActive
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : 'border-gray-200/80 shadow-sm'
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Period Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-7 h-7 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200">
                        P{slot.period_number}
                      </span>
                      <span className="text-xs font-semibold text-gray-600 font-mono">
                        {slot.start_time} - {slot.end_time}
                      </span>
                    </div>

                    {slot.is_multi_department ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1">
                        <Layers className="w-3 h-3 text-amber-600" />
                        <span>Multi-Dept</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                        {slot.department} - Sec {slot.section}
                      </span>
                    )}
                  </div>

                  {/* Subject and Details */}
                  <div>
                    <h4 className="text-base font-bold text-gray-900 leading-tight">{slot.subject}</h4>
                    <p className="text-xs text-gray-500 mt-1 flex items-center space-x-1">
                      <span>Faculty:</span>
                      <span className="font-semibold text-gray-800">{slot.faculty}</span>
                    </p>
                  </div>

                  {/* Multi-department tags */}
                  {slot.is_multi_department && slot.departments && (
                    <div className="bg-amber-50/70 rounded-2xl p-2.5 border border-amber-200/70 text-xs">
                      <span className="font-bold text-amber-900 block mb-1">Roster Resolution across:</span>
                      <div className="flex flex-wrap gap-1">
                        {slot.departments.map((d) => (
                          <span
                            key={d}
                            className="px-2 py-0.5 bg-white rounded-lg font-semibold text-amber-800 border border-amber-200 text-[11px]"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Room, Policy & Hardware */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                    <div className="flex items-center space-x-1.5 text-gray-600">
                      <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="font-semibold text-gray-800">{slot.classroom}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-gray-600">
                      <Shield className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate text-[11px]">{slot.attendance_policy.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-gray-600 col-span-2">
                      <Video className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate text-[11px] text-gray-500">
                        Cameras: {slot.camera_ids?.join(', ') || 'Classroom Front Cam'}
                      </span>
                    </div>
                  </div>

                  {/* Days */}
                  <div className="flex flex-wrap gap-1">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
                      const active = slot.days.includes(day);
                      return (
                        <span
                          key={day}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            active
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-gray-50 text-gray-400 border border-transparent'
                          }`}
                        >
                          {day.slice(0, 3)}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="bg-gray-50/80 px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditSlotModal(slot)}
                      className="p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition"
                      title="Edit Period Slot"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                      title="Delete Period Slot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleTriggerSession(slot)}
                    disabled={triggeringSlotId === slot.id}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{triggeringSlotId === slot.id ? 'Starting...' : 'Start Session'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timetable Slot Modal */}
      {showSlotModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">
                {editingSlot ? 'Edit Timetable Slot' : 'Create Timetable Period'}
              </h3>
              <button
                onClick={() => setShowSlotModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Subject Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.subject || ''}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Distributed Systems"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Assigned Faculty *</label>
                  <input
                    type="text"
                    required
                    value={formData.faculty || ''}
                    onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Dr. K. Srinivas"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Classroom *</label>
                  <input
                    type="text"
                    required
                    value={formData.classroom || ''}
                    onChange={(e) => setFormData({ ...formData, classroom: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. C-204"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Period Number *</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={formData.period_number || 1}
                    onChange={(e) => setFormData({ ...formData, period_number: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={formData.section || 'A'}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="A or ALL"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Start Time (24h) *</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time || '09:00'}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">End Time (24h) *</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time || '10:00'}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Multi-department toggle */}
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block">Multi-Department Classroom</span>
                    <span className="text-[11px] text-gray-500">Enable if multiple departments share this classroom</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.is_multi_department || false}
                    onChange={(e) => setFormData({ ...formData, is_multi_department: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </div>

                {formData.is_multi_department ? (
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Participating Departments (comma separated)</label>
                    <input
                      type="text"
                      value={formData.departments?.join(', ') || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          departments: e.target.value.split(',').map((d) => d.trim().toUpperCase()),
                        })
                      }
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-gray-900 outline-none"
                      placeholder="e.g. CSE, AIML, DS"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Department</label>
                    <select
                      value={formData.department || 'CSE'}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-gray-900 outline-none"
                    >
                      <option value="CSE">Computer Science & Engineering (CSE)</option>
                      <option value="AIML">Artificial Intelligence & ML (AIML)</option>
                      <option value="DS">Data Science (DS)</option>
                      <option value="ECE">Electronics & Communication (ECE)</option>
                      <option value="SE">Software Engineering (SE)</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Attendance Policy</label>
                <select
                  value={formData.attendance_policy || 'STRICT_TEMPORAL_3F'}
                  onChange={(e) => setFormData({ ...formData, attendance_policy: e.target.value as any })}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-900 outline-none"
                >
                  <option value="STRICT_TEMPORAL_3F">Strict Temporal 3-Frame Accumulation (Anti-Spoof)</option>
                  <option value="ROBUST_MULTI_PASS">Robust Multi-Pass (Large Lecture Halls)</option>
                  <option value="IMMEDIATE_CONFIRMATION">Immediate Confirmation</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSlotModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md"
                >
                  {editingSlot ? 'Update Period Slot' : 'Create Period Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
