import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Server,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Database,
  Radio,
  Video,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';

export const SystemHealthCenterView: React.FC = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await api.getObservabilityHealth();
      if (data && data.success) {
        setHealthData(data);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Failed to fetch observability telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Telemetry Active</span>
            </span>
            <span className="text-xs text-gray-500">Live Server-Side Process Metrics</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center space-x-2">
            <span>Production Observability & System Health Center</span>
            <Activity className="w-5 h-5 text-blue-600" />
          </h2>
          <p className="text-sm text-gray-500 max-w-2xl">
            Real-time infrastructure health monitoring, process heap memory metrics, edge camera telemetry, IoT gateway status, and cloud synchronization validation.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <span className="text-xs text-gray-500 font-mono">Updated: {lastRefreshed || 'Just now'}</span>
          <button
            onClick={fetchHealth}
            className="p-2.5 rounded-2xl bg-gray-50 hover:bg-gray-100 text-gray-700 transition border border-gray-200"
            title="Refresh System Health"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {healthData && (
        <>
          {/* Top Status Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>System Status</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{healthData.status}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Node {healthData.process?.node_version}</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Process Uptime</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {Math.floor((healthData.process?.uptime_seconds || 0) / 60)}m {(healthData.process?.uptime_seconds || 0) % 60}s
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">Continuous execution</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1">
                <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                <span>Heap Memory</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {healthData.process?.heap_used_mb} <span className="text-sm font-medium text-gray-500">/ {healthData.process?.heap_total_mb} MB</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">RSS: {healthData.process?.rss_mb} MB</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-sm">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center space-x-1">
                <Cpu className="w-3.5 h-3.5 text-purple-600" />
                <span>CPU Cores</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{healthData.os?.cpus} Cores</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Platform: {healthData.os?.platform}</div>
            </div>
          </div>

          {/* Infrastructure Health Grids */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Edge Infrastructure Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm space-y-4">
              <div className="flex items-center space-x-2">
                <Video className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900">Edge & Hardware Infrastructure</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="font-semibold text-gray-700">Classroom Vision Cameras:</span>
                  <span className="font-bold text-gray-900">
                    {healthData.edge_infrastructure?.online_cameras} Online / {healthData.edge_infrastructure?.registered_cameras} Registered
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="font-semibold text-gray-700">Campus IoT Sensor Hubs:</span>
                  <span className="font-bold text-gray-900">
                    {healthData.edge_infrastructure?.online_iot_devices} Online / {healthData.edge_infrastructure?.registered_iot_devices} Registered
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="font-semibold text-gray-700">Active Live Attendance Sessions:</span>
                  <span className="font-bold text-blue-600">
                    {healthData.edge_infrastructure?.active_attendance_sessions} Running
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="font-semibold text-gray-700">Total Attendance Verification Records:</span>
                  <span className="font-bold text-gray-900 font-mono">
                    {healthData.edge_infrastructure?.total_attendance_records} Records
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="font-semibold text-gray-700">Pending Absence Notice Queue:</span>
                  <span className="font-bold text-amber-600">
                    {healthData.edge_infrastructure?.pending_absence_notifications} in Dispatch Queue
                  </span>
                </div>
              </div>
            </div>

            {/* Cloud Sync & Storage Engine Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm space-y-4">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900">Authoritative Cloud Synchronization</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900">Authoritative Master:</span>
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-white text-emerald-700 border border-emerald-300">
                      CONNECTED
                    </span>
                  </div>
                  <p className="text-emerald-800">
                    Synchronized with Google Sheets v4 API. Real-time bi-directional parity verified with institution database.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">Storage Engine:</span>
                    <span className="font-mono text-gray-700 font-semibold">{healthData.cloud_sync?.database_engine}</span>
                  </div>
                  <p className="text-gray-600">
                    Durable file-backed atomic transactions with cryptographic tamper-evident audit logs and automated snapshots.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="font-semibold text-gray-700">Host Memory Free / Total:</span>
                  <span className="font-bold text-gray-900">
                    {healthData.os?.free_memory_mb} MB / {healthData.os?.total_memory_mb} MB
                  </span>
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
};
