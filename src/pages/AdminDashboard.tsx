import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { OverviewCards } from '../components/OverviewCards';
import { CameraView } from '../components/CameraView';
import { StudentDirectory } from '../components/StudentDirectory';
import { AttendanceTable } from '../components/AttendanceTable';
import { SessionsView } from '../components/SessionsView';
import { UserManagement } from '../components/UserManagement';
import { SystemSettingsView } from '../components/SystemSettingsView';
import { IntelligenceView } from '../components/IntelligenceView';
import { ValidationHardeningView } from '../components/ValidationHardeningView';
import { CampusDeviceManager } from '../components/CampusDeviceManager';
import { SessionModal } from '../components/SessionModal';
import { StudentFormModal } from '../components/StudentFormModal';
import { VoiceAssistant } from '../components/VoiceAssistant';
import { DepartmentInfo, AttendanceSession } from '../types';
import { api } from '../services/api';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);

  // Quick modals triggered from anywhere
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const fetchDeptsAndSession = async () => {
    try {
      const [deptRes, sessionRes] = await Promise.all([
        api.getDepartments(),
        api.getActiveSession(),
      ]);
      if (deptRes.success) setDepartments(deptRes.departments);
      if (sessionRes.success && sessionRes.active) {
        setActiveSession(sessionRes.session);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    }
  };

  useEffect(() => {
    fetchDeptsAndSession();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-gray-900 flex flex-col selection:bg-blue-600 selection:text-white">
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

        {activeTab === 'devices' && <CampusDeviceManager userRole="ADMIN" />}

        {activeTab === 'intelligence' && <IntelligenceView departments={departments} />}

        {activeTab === 'students' && <StudentDirectory departments={departments} />}

        {activeTab === 'attendance' && <AttendanceTable departments={departments} />}

        {activeTab === 'sessions' && (
          <SessionsView
            departments={departments}
            onOpenLiveCamera={() => setActiveTab('live-camera')}
          />
        )}

        {activeTab === 'users' && <UserManagement departments={departments} />}

        {activeTab === 'validation' && <ValidationHardeningView />}

        {activeTab === 'settings' && <SystemSettingsView />}
      </main>

      {/* Global Quick Modals */}
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
          else if (tab === 'devices') setActiveTab('devices');
          else if (tab === 'intelligence') setActiveTab('intelligence');
          else if (tab === 'system') setActiveTab('settings');
        }}
      />
    </div>
  );
};
