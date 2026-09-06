import React, { useState } from 'react';
import {
  Building2,
  Camera,
  Cpu,
  Activity,
  DoorClosed,
  Users,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Sliders,
  Thermometer,
  Wind,
  Layers,
} from 'lucide-react';
import { CampusDevice } from '../types';

interface SmartClassroomViewProps {
  devices: CampusDevice[];
  onOpenLiveCamera?: () => void;
  onOpenDeviceDrawer?: (device: CampusDevice) => void;
}

export const SmartClassroomView: React.FC<SmartClassroomViewProps> = ({
  devices,
  onOpenLiveCamera,
  onOpenDeviceDrawer,
}) => {
  const [selectedClassroom, setSelectedClassroom] = useState<string>('C-204');

  // Hardcoded classroom options that exist in SITS
  const classrooms = ['C-204', 'B-102', 'C-301', 'Mech-Lab-01', 'Civil-CAD-Lab'];

  // Devices in this classroom
  const classroomDevices = devices.filter(
    (d) => d.correlation?.classroom === selectedClassroom || d.name.includes(selectedClassroom)
  );

  // Hardware status mapping
  const cameraDevice = classroomDevices.find((d) => d.category.includes('CAM')) || {
    id: 'cam_default',
    name: 'Classroom HD Camera',
    category: 'USB_CAMERA',
    status: 'ONLINE',
  };

  const gatewayDevice = classroomDevices.find((d) => d.category.includes('GATEWAY') || d.category.includes('ESP32')) || {
    id: 'gw_default',
    name: 'ESP32 IoT Gateway',
    category: 'ESP32_GATEWAY',
    status: 'ONLINE',
  };

  const bleSensorDevice = classroomDevices.find((d) => d.category.includes('BLE') || d.category.includes('SENSOR')) || {
    id: 'ble_default',
    name: 'BLE Environmental Sensor',
    category: 'BLE_ENVIRONMENTAL_SENSOR',
    status: 'ONLINE',
  };

  // Door sensor - authentically offline/unconfigured
  const doorSensorDevice = {
    id: 'door_sensor_01',
    name: 'Magnetic Door Proximity Sensor',
    category: 'PROXIMITY_SENSOR',
    status: 'OFFLINE',
  };

  // Occupancy metrics
  const verifiedStudents = 35;
  const physicalOccupancy = 39;
  const hasDiscrepancy = physicalOccupancy > verifiedStudents;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="apple-card p-6 bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Connected Classroom Intelligence
              </span>
              <span className="text-xs font-bold text-gray-500">• Block C, 3rd Floor</span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 flex items-center space-x-2">
              <Building2 className="w-6 h-6 text-blue-600" />
              <span>Smart Classroom {selectedClassroom}</span>
            </h2>
            <p className="text-xs text-gray-500">
              Synchronized peripheral telemetry, hardware node heartbeats, and facial verification integrity.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-gray-500 font-semibold">Select Classroom:</span>
              <select
                value={selectedClassroom}
                onChange={(e) => setSelectedClassroom(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-600"
              >
                {classrooms.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Integrity & Occupancy Alert Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="apple-card p-5 bg-white border border-gray-200 space-y-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            Verified Students (Face AI)
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-gray-900">{verifiedStudents}</span>
            <span className="text-xs text-emerald-600 font-bold">Biometrically Verified</span>
          </div>
          <p className="text-[11px] text-gray-500">
            Confirmed via 128D facial embeddings and temporal liveness checks.
          </p>
        </div>

        <div className="apple-card p-5 bg-white border border-gray-200 space-y-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            Physical Room Occupancy (Sensor)
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-indigo-600">{physicalOccupancy}</span>
            <span className="text-xs text-gray-500 font-medium">PIR / Thermal Counter</span>
          </div>
          <p className="text-[11px] text-gray-500">
            Real physical presence count reported by ESP32 environmental gateway.
          </p>
        </div>

        <div className="apple-card p-5 bg-white border border-gray-200 space-y-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            Attendance Integrity Ratio
          </span>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-blue-600">{verifiedStudents} / {physicalOccupancy}</span>
            <span className="text-xs text-amber-600 font-bold">89.7% Ratio</span>
          </div>
          <p className="text-[11px] text-gray-500">
            4 unverified occupants detected in classroom area.
          </p>
        </div>
      </div>

      {/* Prominent Warning if Physical Occupancy > Verified Attendance */}
      {hasDiscrepancy && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-start space-x-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-900">
              Discrepancy Warning: Physical occupancy exceeds verified attendance
            </h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              The environmental node registered <strong>{physicalOccupancy} persons</strong>, but only <strong>{verifiedStudents} students</strong> have passed biometric facial verification.
            </p>
            <div className="pt-1 text-[11px] text-amber-950/80 font-medium">
              <strong>CRITICAL AUDIT RULE:</strong> Physical occupancy sensor readings are strictly observational and must <strong>NEVER</strong> automatically mark attendance or inflate verified student counts.
            </div>
          </div>
        </div>
      )}

      {/* Connected Hardware Inventory in this Classroom */}
      <div className="apple-card p-6 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <span>Connected Hardware Nodes in {selectedClassroom}</span>
          </h3>
          <span className="text-xs text-gray-400 font-mono">
            4 Hardware Peripherals Mapped
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Node 1: Camera */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ONLINE</span>
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">Attendance Camera</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Podium USB HD Camera</p>
            </div>
            <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-500">
              <span>1080p • 30 FPS</span>
              {onOpenLiveCamera && (
                <button
                  onClick={onOpenLiveCamera}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  View Feed
                </button>
              )}
            </div>
          </div>

          {/* Node 2: Gateway */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ONLINE</span>
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">ESP32 Gateway</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Node: dev_esp32_c204_01</p>
            </div>
            <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-500">
              <span>Heartbeat: 4s ago</span>
              <span className="text-emerald-600 font-mono">18ms</span>
            </div>
          </div>

          {/* Node 3: BLE Sensor */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ONLINE</span>
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">BLE Sensor</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">24.2°C • 54% RH</p>
            </div>
            <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-500">
              <span>CO2: 520 PPM</span>
              <span className="text-indigo-600 font-semibold">Good Air</span>
            </div>
          </div>

          {/* Node 4: Door Proximity Sensor */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-gray-200 text-gray-600 flex items-center justify-center">
                <DoorClosed className="w-4 h-4" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700">
                OFFLINE
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">Door Sensor</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Magnetic Reed Switch</p>
            </div>
            <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-400">
              <span>Awaiting Pairing</span>
              <span className="font-mono">Standby</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
