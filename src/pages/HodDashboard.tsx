import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { OverviewCards } from '../components/OverviewCards';
import { CameraView } from '../components/CameraView';
import { StudentDirectory } from '../components/StudentDirectory';
import { AttendanceTable } from '../components/AttendanceTable';
import { IntelligenceView } from '../components/IntelligenceView';
import { SessionModal } from '../components/SessionModal';
import { StudentFormModal } from '../components/StudentFormModal';
import { VoiceAssistant } from '../components/VoiceAssistant';
import { DepartmentInfo, AttendanceSession } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const HodDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const fetchDeptsAndSession = async () => {
    try {
      const [deptRes, sessionRes] = await Promise.all([
        api.getDepartments(),
        api.getActiveSession(user?.department),
      ]);
      if (deptRes.success) {
        // Filter departments to only the HOD's department
        const hodDept = deptRes.departments.filter(
          (d) => d.name.toLowerCase() === user?.department.toLowerCase()
        );
        setDepartments(hodDept.length > 0 ? hodDept : deptRes.departments);
      }
      if (sessionRes.success && sessionRes.active) {
        setActiveSession(sessionRes.session);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Error fetching HOD data:', err);
    }
  };

  useEffect(() => {
    fetchDeptsAndSession();
  }, [activeTab, user]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSessionInfo={
          activeSession
            ? {
                subject: activeSession.subject,
                section: activeSession.section,
                department: activeSession.department,
              }
            : null
        }
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewCards
            onNavigate={(tab) => setActiveTab(tab)}
            onRequestNewSession={() => setShowSessionModal(true)}
            onRequestRegisterStudent={() => setShowRegisterModal(true)}
            onTriggerMobilePair={() => setActiveTab('live-camera')}
            onOpenSheetsSync={() => setActiveTab('students')}
          />
        )}

        {activeTab === 'live-camera' && (
          <CameraView
            onSessionChange={fetchDeptsAndSession}
            onRequestNewSession={() => setShowSessionModal(true)}
          />
        )}

        {activeTab === 'intelligence' && <IntelligenceView departments={departments} />}

        {activeTab === 'students' && <StudentDirectory departments={departments} />}

        {activeTab === 'attendance' && <AttendanceTable departments={departments} />}
      </main>

      <SessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        onSuccess={() => {
          fetchDeptsAndSession();
          setActiveTab('live-camera');
        }}
        departments={departments}
      />

      <StudentFormModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={() => {
          setActiveTab('students');
        }}
        departments={departments}
      />

      {/* Futuristic Hands-Free AI Voice Agent */}
      <VoiceAssistant
        activeTab={activeTab}
        onNavigateTab={(tab) => {
          if (tab === 'camera') setActiveTab('live-camera');
          else if (tab === 'attendance') setActiveTab('attendance');
          else if (tab === 'students') setActiveTab('students');
          else if (tab === 'intelligence') setActiveTab('intelligence');
        }}
      />
    </div>
  );
};
