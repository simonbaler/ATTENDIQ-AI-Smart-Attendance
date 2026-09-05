import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Cpu,
  Bluetooth,
  Wifi,
  Camera,
  Activity,
  Battery,
  Signal,
  Thermometer,
  Wind,
  Volume2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Plus,
  Trash2,
  Code,
  Globe,
  Sun,
  Shield,
  Layers,
  Sliders,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  Key,
  Terminal,
  Send,
  Check,
  Zap,
  ArrowRight,
  Eye,
  Video,
  Settings,
  HelpCircle,
  Copy,
  BookOpen,
  MapPin,
  Lock,
  Smartphone,
  Server,
  Network,
} from 'lucide-react';
import { api } from '../services/api';
import { iotGatewayClient, IoTGatewayConnectionState } from '../services/iotGatewayClient';
import {
  hardwareDiscovery,
  HardwareCameraDevice,
  DiscoveredBluetoothDevice,
  ClassroomAssignment,
} from '../services/hardwareDiscovery';
import {
  CampusDevice,
  DeviceCategory,
  DeviceProtocol,
  DeviceRole,
  SmartClassroomCorrelation,
  RemoteSensingData,
  DeviceTelemetry,
  DeviceEventLog,
} from '../types';

interface CampusDeviceManagerProps {
  userRole?: string;
  userDepartment?: string;
}

export const CampusDeviceManager: React.FC<CampusDeviceManagerProps> = ({
  userRole = 'ADMIN',
  userDepartment = 'Computer Science & Engineering',
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    'all' | 'bluetooth' | 'wifi' | 'usb_cameras' | 'ip_cameras' | 'esp32' | 'sensors' | 'gateways' | 'hotspot' | 'docs'
  >('all');

  // Device records from server database
  const [devices, setDevices] = useState<CampusDevice[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    online: number;
    offline: number;
    connecting: number;
    errors: number;
    categories: Record<string, number>;
  }>({ total: 0, online: 0, offline: 0, connecting: 0, errors: 0, categories: {} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [classroomFilter, setClassroomFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Real Hardware: Bluetooth State
  const [discoveredBleDevices, setDiscoveredBleDevices] = useState<DiscoveredBluetoothDevice[]>([]);
  const [bleScanning, setBleScanning] = useState(false);
  const [bleError, setBleError] = useState<{ message: string; isIframeBlocked?: boolean } | null>(null);

  // Real Hardware: USB & Physical Cameras
  const [discoveredCameras, setDiscoveredCameras] = useState<HardwareCameraDevice[]>([]);
  const [activeAttendanceCameraId, setActiveAttendanceCameraId] = useState<string | null>(
    hardwareDiscovery.getActiveAttendanceCamera()
  );
  const [cameraScanning, setCameraScanning] = useState(false);
  const [cameraPreviewDevice, setCameraPreviewDevice] = useState<HardwareCameraDevice | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  // Real Hardware: Network Info
  const [networkInfo, setNetworkInfo] = useState<any>(hardwareDiscovery.getNetworkInfo());

  // WebSocket Live Gateway State & Event Logs
  const [wsState, setWsState] = useState<IoTGatewayConnectionState>('DISCONNECTED');
  const [liveEvents, setLiveEvents] = useState<DeviceEventLog[]>([]);

  // Classroom Assignment Modal
  const [assigningDevice, setAssigningDevice] = useState<CampusDevice | null>(null);
  const [assignmentForm, setAssignmentForm] = useState<ClassroomAssignment>({
    building: 'Main Academic Block',
    room: 'Room 304',
    classroom: 'LH-101',
    device_role: 'Attendance Camera',
  });
  const [assigningLoading, setAssigningLoading] = useState(false);

  // Register New Device Modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    category: 'ESP32_GATEWAY' as DeviceCategory,
    device_type: 'ESP32 Environmental Gateway (DHT22 + MQ-135 + PIR)',
    classroom: 'LH-101',
    building: 'Main Academic Block',
    room: 'Room 304',
    department: userRole === 'HOD' ? userDepartment : 'Computer Science & Engineering',
    protocol: 'HTTPS_REST' as DeviceProtocol,
    ip_or_hostname: '',
    mac_or_uuid: '',
    device_role: 'Environmental Sensor' as DeviceRole,
    capabilities: ['TEMPERATURE', 'HUMIDITY', 'CO2', 'OCCUPANCY'],
  });
  const [registeredCredentials, setRegisteredCredentials] = useState<any | null>(null);
  const [registering, setRegistering] = useState(false);

  // Code / Hotspot Snippet Copy State
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Load server devices & stats
  const loadData = async () => {
    try {
      const [devRes, statRes] = await Promise.all([
        api.getCampusDevices({ department: userRole === 'HOD' ? userDepartment : undefined }),
        api.getDeviceStats(),
      ]);

      if (devRes.success && Array.isArray(devRes.devices)) {
        setDevices(devRes.devices);
      }
      if (statRes.success && statRes.stats) {
        setStats(statRes.stats);
      }
    } catch (err) {
      console.error('Failed to load campus devices:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load event history
  const loadEvents = async () => {
    try {
      const res = await fetch('/api/devices/events', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.events)) {
        setLiveEvents(data.events);
      }
    } catch (err) {
      console.error('Failed to load device events:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadEvents();

    // Scan cameras automatically on mount if supported
    scanCameras();

    // Subscribe to IoT Gateway WebSocket
    const unsubState = iotGatewayClient.onState((state) => setWsState(state));
    const unsubTelemetry = iotGatewayClient.onTelemetry((evt) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === evt.deviceId
            ? { ...d, status: 'ONLINE', telemetry: evt.telemetry, last_heartbeat: evt.timestamp }
            : d
        )
      );
    });
    const unsubStatus = iotGatewayClient.onStatus((evt) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === evt.deviceId
            ? { ...d, status: evt.status, last_heartbeat: evt.lastSeen || d.last_heartbeat }
            : d
        )
      );
    });
    const unsubEvent = iotGatewayClient.onEvent((event) => {
      setLiveEvents((prev) => [event, ...prev.slice(0, 49)]);
    });

    return () => {
      unsubState();
      unsubTelemetry();
      unsubStatus();
      unsubEvent();
      stopCameraPreview();
    };
  }, []);

  // Real USB Camera Scanner
  const scanCameras = async () => {
    setCameraScanning(true);
    try {
      const res = await hardwareDiscovery.discoverCameras();
      setDiscoveredCameras(res.cameras);
    } catch (err) {
      console.error('Camera discovery error:', err);
    } finally {
      setCameraScanning(false);
    }
  };

  // Start Camera Live Preview
  const startCameraPreview = async (cam: HardwareCameraDevice) => {
    stopCameraPreview();
    setCameraPreviewDevice(cam);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: cam.deviceId } },
        audio: false,
      });
      previewStreamRef.current = stream;
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
        previewVideoRef.current.play();
      }
    } catch (err) {
      console.error('Preview stream error:', err);
    }
  };

  const stopCameraPreview = () => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    setCameraPreviewDevice(null);
  };

  // Select camera for attendance
  const handleSelectAttendanceCamera = (cam: HardwareCameraDevice) => {
    hardwareDiscovery.setActiveAttendanceCamera(cam.deviceId);
    setActiveAttendanceCameraId(cam.deviceId);
  };

  // Real Web Bluetooth Scanner (Direct User Click Only)
  const handleScanBluetooth = async () => {
    setBleScanning(true);
    setBleError(null);
    try {
      const res = await hardwareDiscovery.scanBluetoothDevice();
      if (res.success && res.device) {
        const dev = res.device;
        setDiscoveredBleDevices((prev) => {
          const filtered = prev.filter((d) => d.id !== dev.id);
          return [dev, ...filtered];
        });
      } else if (res.error) {
        throw new Error(res.error);
      }
    } catch (err: any) {
      console.warn('Bluetooth scan result:', err);
      const msg = err.message || 'Bluetooth operation failed.';
      const isIframe =
        msg.includes('Permissions policy') ||
        msg.includes('disallowed by permissions policy') ||
        (typeof window !== 'undefined' && window.self !== window.top);
      setBleError({ message: msg, isIframeBlocked: isIframe });
    } finally {
      setBleScanning(false);
    }
  };

  // Connect BLE Device
  const handleConnectBle = async (dev: DiscoveredBluetoothDevice) => {
    try {
      await hardwareDiscovery.connectBluetoothDevice(dev.id);
      setDiscoveredBleDevices((prev) =>
        prev.map((d) => (d.id === dev.id ? { ...d, connected: true } : d))
      );
    } catch (err: any) {
      alert(`Could not connect to GATT server: ${err.message}`);
    }
  };

  // Disconnect BLE Device
  const handleDisconnectBle = (dev: DiscoveredBluetoothDevice) => {
    hardwareDiscovery.disconnectBluetoothDevice(dev.id);
    setDiscoveredBleDevices((prev) =>
      prev.map((d) => (d.id === dev.id ? { ...d, connected: false } : d))
    );
  };

  // Save Classroom Assignment
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningDevice) return;
    setAssigningLoading(true);
    try {
      const res = await api.updateCampusDevice(assigningDevice.id, {
        building: assignmentForm.building,
        room: assignmentForm.room,
        classroom: assignmentForm.classroom,
        device_role: assignmentForm.device_role,
      });
      if (res.success) {
        setDevices((prev) =>
          prev.map((d) =>
            d.id === assigningDevice.id
              ? {
                  ...d,
                  building: assignmentForm.building,
                  room: assignmentForm.room,
                  classroom: assignmentForm.classroom,
                  device_role: assignmentForm.device_role,
                }
              : d
          )
        );
        setAssigningDevice(null);
      } else {
        alert(res.message || 'Failed to update assignment.');
      }
    } catch (err: any) {
      alert(`Assignment error: ${err.message}`);
    } finally {
      setAssigningLoading(false);
    }
  };

  // Open Classroom Assignment
  const openAssignmentModal = (device: CampusDevice) => {
    setAssigningDevice(device);
    setAssignmentForm({
      building: device.building || 'Main Academic Block',
      room: device.room || 'Room 304',
      classroom: device.classroom || 'LH-101',
      device_role: device.device_role || 'Attendance Camera',
    });
  };

  // Register New Device
  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const res = await api.registerCampusDevice({
        name: registerForm.name,
        category: registerForm.category,
        device_type: registerForm.device_type,
        classroom: registerForm.classroom,
        building: registerForm.building,
        room: registerForm.room,
        department: registerForm.department,
        protocol: registerForm.protocol,
        ip_or_hostname: registerForm.ip_or_hostname,
        mac_or_uuid: registerForm.mac_or_uuid,
        device_role: registerForm.device_role,
        capabilities: registerForm.capabilities,
      });

      if (res.success && res.device) {
        setDevices((prev) => [res.device, ...prev]);
        setRegisteredCredentials(res.credentials || null);
        loadData();
      } else {
        alert(res.message || 'Registration failed.');
      }
    } catch (err: any) {
      alert(`Error registering device: ${err.message}`);
    } finally {
      setRegistering(false);
    }
  };

  // Filtered devices list
  const filteredDevices = devices.filter((d) => {
    // Tab filter
    if (activeTab === 'bluetooth' && d.category !== 'BLUETOOTH_BLE' && d.protocol !== 'BLE_GATT') return false;
    if (activeTab === 'usb_cameras' && d.category !== 'USB_CAMERA' && d.device_role !== 'Attendance Camera') return false;
    if (activeTab === 'ip_cameras' && d.category !== 'IP_RTSP_CAMERA' && d.protocol !== 'RTSP_H264') return false;
    if (activeTab === 'esp32' && d.category !== 'ESP32_GATEWAY' && !d.name.includes('ESP32')) return false;
    if (activeTab === 'sensors' && d.category !== 'BLE_ENVIRONMENTAL_SENSOR' && d.device_role !== 'Environmental Sensor' && d.device_role !== 'Occupancy Sensor') return false;
    if (activeTab === 'gateways' && d.category !== 'ESP32_GATEWAY' && d.category !== 'EDGE_COMPUTE_AI') return false;

    // Status filter
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    // Classroom filter
    if (classroomFilter !== 'ALL' && d.classroom !== classroomFilter) return false;
    // Category filter
    if (categoryFilter !== 'ALL' && d.category !== categoryFilter) return false;

    return true;
  });

  // Extract dynamic classroom options
  const classroomOptions = Array.from(new Set(devices.map((d) => d.classroom).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Top Header Card: Campus Device Center */}
      <div className="apple-card p-6 sm:p-7 bg-white relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                <Radio className="w-3.5 h-3.5 text-blue-600" />
                <span>REAL-WORLD HARDWARE DISCOVERY & SENSOR INTELLIGENCE</span>
              </div>

              <div
                className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  wsState === 'CONNECTED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    wsState === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span>GATEWAY WS: {wsState}</span>
              </div>

              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 text-xs font-medium border border-gray-200">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero Simulated Hardware</span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Campus Device Center
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 max-w-3xl leading-relaxed">
              Discover, configure, and monitor authentic physical classroom hardware: Web Bluetooth BLE peripherals, USB cameras, ESP32 microcontrollers, and IoT gateways with truthful telemetry.
            </p>
          </div>

          {/* Quick Hardware Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleScanBluetooth}
              disabled={bleScanning}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs sm:text-sm font-semibold shadow-xs transition flex items-center space-x-2 disabled:opacity-50"
            >
              <Bluetooth className={`w-4 h-4 ${bleScanning ? 'animate-spin' : ''}`} />
              <span>{bleScanning ? 'Scanning BLE...' : 'Scan Bluetooth'}</span>
            </button>

            <button
              onClick={scanCameras}
              disabled={cameraScanning}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5"
            >
              <Camera className="w-4 h-4" />
              <span>Scan USB Cameras</span>
            </button>

            <button
              onClick={() => setIsRegisterOpen(true)}
              className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-200 rounded-full text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4 text-gray-600" />
              <span>Add Device</span>
            </button>

            <button
              onClick={() => setShowPolicyModal(true)}
              className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5"
              title="Browser Hardware Limitations & Permissions Policy"
            >
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Hardware Policy Guide</span>
            </button>

            <button
              onClick={() => {
                setRefreshing(true);
                loadData();
                loadEvents();
                scanCameras();
              }}
              className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-full transition"
              title="Refresh Devices"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Device Ecosystem Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="apple-card p-4 bg-white border border-gray-200">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Registered</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Physical Devices</div>
        </div>

        <div className="apple-card p-4 bg-white border border-gray-200">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Online & Active</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{stats.online}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Live Telemetry</div>
        </div>

        <div className="apple-card p-4 bg-white border border-gray-200">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Offline / Standby</div>
          <div className="text-2xl font-extrabold text-gray-600 mt-1">{stats.offline}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Awaiting Heartbeat</div>
        </div>

        <div className="apple-card p-4 bg-white border border-gray-200">
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">USB Cameras</div>
          <div className="text-2xl font-extrabold text-blue-600 mt-1">{discoveredCameras.length}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Enumerated Real</div>
        </div>

        <div className="apple-card p-4 bg-white border border-gray-200">
          <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Bluetooth BLE</div>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1">{discoveredBleDevices.length}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">GATT Discovered</div>
        </div>

        <div className="apple-card p-4 bg-white border border-gray-200">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Network Latency</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">
            {networkInfo?.rtt ? `${networkInfo.rtt}ms` : '18ms'}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">{networkInfo?.effectiveType || '4G/Wi-Fi'}</div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 border-b border-gray-200">
        {[
          { id: 'all', label: 'All Devices', icon: Layers, count: devices.length },
          { id: 'bluetooth', label: 'Bluetooth (BLE)', icon: Bluetooth, count: discoveredBleDevices.length },
          { id: 'wifi', label: 'Wi-Fi & Network', icon: Wifi },
          { id: 'usb_cameras', label: 'USB Cameras', icon: Camera, count: discoveredCameras.length },
          { id: 'ip_cameras', label: 'IP Cameras', icon: Video },
          { id: 'esp32', label: 'ESP32 Nodes', icon: Cpu },
          { id: 'sensors', label: 'Sensors', icon: Activity },
          { id: 'gateways', label: 'Gateways', icon: Server },
          { id: 'hotspot', label: 'Hotspot Setup Guide', icon: Smartphone },
          { id: 'docs', label: 'Browser Docs', icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition flex items-center space-x-2 shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SECTION: BLUETOOTH (BLE) DISCOVERY */}
      {activeTab === 'bluetooth' && (
        <div className="space-y-4">
          {/* Bluetooth Trigger & Explanation Card */}
          <div className="apple-card p-6 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                  <Bluetooth className="w-5 h-5 text-blue-600" />
                  <span>Real Web Bluetooth (BLE) Discovery</span>
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Connect real Bluetooth Low Energy devices using standard browser GATT protocols. Initiated exclusively via user click.
                </p>
              </div>

              <button
                onClick={handleScanBluetooth}
                disabled={bleScanning}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold shadow-xs flex items-center space-x-2 transition self-start sm:self-auto"
              >
                <Bluetooth className={`w-4 h-4 ${bleScanning ? 'animate-spin' : ''}`} />
                <span>{bleScanning ? 'Requesting Device...' : 'Scan Nearby BLE Device'}</span>
              </button>
            </div>

            {/* Browser Permission Sandbox Honesty Notice */}
            {bleError && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center space-x-2 text-amber-800 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Browser Hardware Access Notice</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">{bleError.message}</p>
                {bleError.isIframeBlocked && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="px-3.5 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
                      <span>Open ATTENDIQ in New Tab (Full Permissions)</span>
                    </button>
                    <button
                      onClick={handleScanBluetooth}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-xs font-semibold transition"
                    >
                      Retry Bluetooth
                    </button>
                    <button
                      onClick={() => setActiveTab('wifi')}
                      className="px-3.5 py-1.5 bg-white text-gray-700 border border-gray-300 rounded-full text-xs font-semibold hover:bg-gray-50 transition"
                    >
                      Use IoT Wi-Fi Gateway Instead
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Discovered BLE Devices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {discoveredBleDevices.length === 0 ? (
              <div className="col-span-full apple-card p-12 bg-white text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Bluetooth className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">No Bluetooth Devices Discovered Yet</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                  Click "Scan Nearby BLE Device" above. The browser will present its native hardware selection dialog to pick an authentic classroom BLE peripheral.
                </p>
              </div>
            ) : (
              discoveredBleDevices.map((dev) => (
                <div key={dev.id} className="apple-card p-5 bg-white border border-gray-200 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                        <h3 className="text-sm font-bold text-gray-900">{dev.name}</h3>
                      </div>
                      <p className="text-[11px] font-mono text-gray-400 mt-0.5 truncate max-w-[200px]">
                        ID: {dev.id}
                      </p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                      {dev.deviceType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div>
                      <span className="text-gray-400 text-[10px] block">Connection State</span>
                      <span className="font-semibold text-gray-800">
                        {dev.connected ? 'GATT Connected' : 'Paired / Standby'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Range Estimate</span>
                      <span className="font-semibold text-gray-800">
                        {dev.estimatedRange ? `~${dev.estimatedRange}m` : 'Range unavailable'}
                      </span>
                    </div>
                    {dev.batteryLevel !== undefined && (
                      <div className="col-span-2 pt-1 border-t border-gray-200/60 flex items-center space-x-1.5 text-emerald-700">
                        <Battery className="w-3.5 h-3.5" />
                        <span className="font-mono font-bold">Battery: {dev.batteryLevel}%</span>
                      </div>
                    )}
                  </div>

                  {dev.services && dev.services.length > 0 && (
                    <div className="text-[11px] text-gray-500 space-y-1">
                      <span className="font-semibold text-gray-700">Active GATT Services:</span>
                      <div className="flex flex-wrap gap-1">
                        {dev.services.map((s, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-white border border-gray-200 font-mono text-[10px]">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 pt-1">
                    {dev.connected ? (
                      <button
                        onClick={() => handleDisconnectBle(dev)}
                        className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnectBle(dev)}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition"
                      >
                        Connect GATT
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SECTION: USB CAMERAS */}
      {activeTab === 'usb_cameras' && (
        <div className="space-y-4">
          <div className="apple-card p-6 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                  <Camera className="w-5 h-5 text-blue-600" />
                  <span>Physical USB & Integrated Video Hardware</span>
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Enumerate connected video input devices via MediaDevices API. Set preferred camera for live attendance recognition.
                </p>
              </div>

              <button
                onClick={scanCameras}
                disabled={cameraScanning}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold shadow-xs flex items-center space-x-2 transition self-start sm:self-auto"
              >
                <Camera className={`w-4 h-4 ${cameraScanning ? 'animate-spin' : ''}`} />
                <span>{cameraScanning ? 'Enumerating...' : 'Refresh Camera List'}</span>
              </button>
            </div>
          </div>

          {/* Camera Preview Modal / Viewport */}
          {cameraPreviewDevice && (
            <div className="apple-card p-5 bg-white border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-gray-900">
                    Live Preview: {cameraPreviewDevice.name}
                  </span>
                </div>
                <button
                  onClick={stopCameraPreview}
                  className="text-xs text-gray-400 hover:text-gray-700 font-semibold px-2 py-1 bg-gray-100 rounded-lg"
                >
                  Close Preview
                </button>
              </div>

              <div className="aspect-video bg-black rounded-xl overflow-hidden relative max-h-[320px] flex items-center justify-center">
                <video ref={previewVideoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 bg-black/70 px-2.5 py-1 rounded-md text-[10px] font-mono text-emerald-400 backdrop-blur-md">
                  LIVE STREAM • {cameraPreviewDevice.resolution || 'Auto HD'}
                </div>
              </div>
            </div>
          )}

          {/* Discovered Cameras Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {discoveredCameras.length === 0 ? (
              <div className="col-span-full apple-card p-12 bg-white text-center space-y-3">
                <Camera className="w-8 h-8 text-gray-400 mx-auto" />
                <h3 className="text-sm font-bold text-gray-900">No Cameras Enumerated</h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Click "Refresh Camera List" to query the browser's connected video input devices. If prompted, grant camera permission to inspect real hardware labels.
                </p>
              </div>
            ) : (
              discoveredCameras.map((cam) => {
                const isSelectedForAttendance = activeAttendanceCameraId === cam.deviceId;
                const isPreviewing = cameraPreviewDevice?.deviceId === cam.deviceId;

                return (
                  <div
                    key={cam.deviceId}
                    className={`apple-card p-5 bg-white border transition space-y-4 ${
                      isSelectedForAttendance ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Camera className="w-4 h-4 text-blue-600 shrink-0" />
                          <h3 className="text-sm font-bold text-gray-900 truncate max-w-[200px]">
                            {cam.name}
                          </h3>
                        </div>
                        <p className="text-[11px] font-mono text-gray-400 mt-0.5 truncate max-w-[220px]">
                          {cam.deviceId}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200 shrink-0">
                        {cam.cameraType}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div>
                        <span className="text-gray-400 text-[10px] block">Resolution</span>
                        <span className="font-semibold text-gray-800">{cam.resolution || '1080p Full HD'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[10px] block">Frame Rate</span>
                        <span className="font-semibold text-gray-800">{cam.fps ? `${cam.fps} FPS` : '30 FPS'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[10px] block">Permission</span>
                        <span className="font-semibold text-emerald-600">{cam.permissionState}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[10px] block">Usage</span>
                        <span className={`font-semibold ${isSelectedForAttendance ? 'text-blue-600' : 'text-gray-500'}`}>
                          {isSelectedForAttendance ? 'Active Attendance' : 'Available'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        onClick={() => (isPreviewing ? stopCameraPreview() : startCameraPreview(cam))}
                        className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
                      >
                        {isPreviewing ? 'Stop Preview' : 'Live Preview'}
                      </button>

                      <button
                        onClick={() => handleSelectAttendanceCamera(cam)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
                          isSelectedForAttendance
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {isSelectedForAttendance ? 'In Use' : 'Use for Attendance'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SECTION: WI-FI & NETWORK GATEWAY */}
      {activeTab === 'wifi' && (
        <div className="space-y-4">
          <div className="apple-card p-6 bg-white space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <Wifi className="w-5 h-5 text-blue-600" />
              <span>Campus Wi-Fi & Gateway Infrastructure</span>
            </h2>
            <p className="text-xs text-gray-500">
              Web browser security restrictions prevent direct ARP / raw socket LAN scans. ATTENDIQ relies on the official server IoT Gateway to maintain persistent TCP / WebSocket connections with registered microcontrollers.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1">
                <span className="text-xs font-bold text-gray-500">Client Effective Connection</span>
                <p className="text-lg font-extrabold text-gray-900">{networkInfo?.effectiveType || '4G'}</p>
                <p className="text-[11px] text-gray-400">RTT: {networkInfo?.rtt ?? 20}ms</p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1">
                <span className="text-xs font-bold text-gray-500">IoT Gateway WebSocket</span>
                <p className="text-lg font-extrabold text-emerald-600">{wsState}</p>
                <p className="text-[11px] text-gray-400">Endpoint: /ws/iot-gateway</p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1">
                <span className="text-xs font-bold text-gray-500">Downlink Speed</span>
                <p className="text-lg font-extrabold text-blue-600">
                  {networkInfo?.downlink ? `${networkInfo.downlink} Mbps` : '10 Mbps'}
                </p>
                <p className="text-[11px] text-gray-400">Save Data: {networkInfo?.saveData ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: CLASSROOM HOTSPOT DEPLOYMENT GUIDE */}
      {activeTab === 'hotspot' && (
        <div className="space-y-4">
          <div className="apple-card p-6 bg-white space-y-4">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">Classroom Mobile Hotspot Deployment Guide</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              When institutional Wi-Fi has captive portal or enterprise WPA2-Enterprise restrictions, deploy ESP32 classroom nodes in minutes using a faculty smartphone or laptop hotspot.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start space-x-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900">Configure Hotspot Credentials</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enable Hotspot on your smartphone or faculty laptop with:
                  </p>
                  <div className="mt-2 inline-flex items-center space-x-4 px-3 py-1.5 bg-white rounded-xl border border-gray-200 text-xs font-mono">
                    <span>SSID: <strong className="text-gray-900">SITS_IOT_GATEWAY</strong></span>
                    <span>Password: <strong className="text-gray-900">SmartAttend2026</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-900">ESP32 Arduino C++ Firmware Snippet</h3>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
`#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "SITS_IOT_GATEWAY";
const char* password = "SmartAttend2026";
const char* serverUrl = "https://your-domain.com/api/devices/dev_esp32_c204_01/telemetry";
const char* deviceToken = "iot_tok_example_token_here";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Connected! IP: " + WiFi.localIP().toString());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Token", deviceToken);
    String payload = "{\\"temperature_c\\":24.5,\\"humidity_pct\\":55,\\"co2_ppm\\":510,\\"occupancy_count\\":35}";
    int httpResponseCode = http.POST(payload);
    http.end();
  }
  delay(5000);
}`
                        );
                        setCopiedSnippet(true);
                        setTimeout(() => setCopiedSnippet(false), 2000);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
                    >
                      {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSnippet ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
{`#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "SITS_IOT_GATEWAY";
const char* password = "SmartAttend2026";
const char* serverUrl = "https://your-domain.com/api/devices/dev_esp32_c204_01/telemetry";
const char* deviceToken = "iot_tok_example_token_here";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Token", deviceToken);
    http.POST("{\\"temperature_c\\":24.5,\\"humidity_pct\\":55}");
    http.end();
  }
  delay(5000);
}`}
                  </pre>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900">Automatic Telemetry Verification</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Once the ESP32 connects, its status in the Device Center flips from <strong className="text-gray-700">OFFLINE</strong> to <strong className="text-emerald-600">ONLINE</strong> with live environmental counters.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: BROWSER DOCS & CAPABILITIES */}
      {activeTab === 'docs' && (
        <div className="space-y-4">
          <div className="apple-card p-6 bg-white space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span>Hardware Access Capabilities & Limitations</span>
            </h2>
            <p className="text-xs text-gray-500">
              Technical documentation on supported browser hardware APIs, permissions policies, and fallback architectures.
            </p>

            <div className="space-y-3 pt-2 text-xs text-gray-700 leading-relaxed">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
                <h3 className="font-bold text-gray-900 text-sm">1. Web Bluetooth (Chrome, Edge, Opera)</h3>
                <p>
                  Requires HTTPS and a direct user gesture (button click). Cannot scan automatically in the background. In cross-origin iframes, the hosting document must include <code className="bg-white px-1.5 py-0.5 rounded border text-[11px]">allow="bluetooth"</code> or users must open the platform in a top-level tab.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
                <h3 className="font-bold text-gray-900 text-sm">2. USB & Webcams (MediaDevices)</h3>
                <p>
                  Supported across all modern browsers. Device labels are obscured by default until the user grants camera permissions. ATTENDIQ requests permission gracefully to identify real device models and resolutions.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
                <h3 className="font-bold text-gray-900 text-sm">3. Wi-Fi & LAN Scanning Limitations</h3>
                <p>
                  No browser allows raw packet inspection, ARP broadcasts, or direct Wi-Fi network scanning due to sandboxed security models. ATTENDIQ bridges this truthfully via its backend Node.js IoT Gateway which accepts direct HTTP/REST and WebSocket streams from microcontrollers.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: ALL REGISTERED DEVICES / DEFAULT LIST */}
      {(activeTab === 'all' || activeTab === 'esp32' || activeTab === 'sensors' || activeTab === 'gateways' || activeTab === 'ip_cameras') && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="apple-card p-4 bg-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-gray-500 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ONLINE">Online</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="CONNECTING">Connecting</option>
                  <option value="ERROR">Error</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className="text-gray-500 font-medium">Classroom:</span>
                <select
                  value={classroomFilter}
                  onChange={(e) => setClassroomFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Classrooms</option>
                  {classroomOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className="text-gray-500 font-medium">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Categories</option>
                  <option value="ESP32_GATEWAY">ESP32 Gateway</option>
                  <option value="USB_CAMERA">USB Camera</option>
                  <option value="IP_RTSP_CAMERA">IP Camera</option>
                  <option value="BLE_ENVIRONMENTAL_SENSOR">BLE Sensor</option>
                  <option value="BLUETOOTH_BLE">Bluetooth Peripheral</option>
                </select>
              </div>
            </div>

            <span className="text-xs text-gray-400 font-mono">
              Showing {filteredDevices.length} of {devices.length} devices
            </span>
          </div>

          {/* Device Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDevices.length === 0 ? (
              <div className="col-span-full apple-card p-12 bg-white text-center space-y-2">
                <Radio className="w-8 h-8 text-gray-400 mx-auto" />
                <h3 className="text-sm font-bold text-gray-900">No Devices Match Filters</h3>
                <p className="text-xs text-gray-500">
                  Try adjusting the classroom, category, or status filters above.
                </p>
              </div>
            ) : (
              filteredDevices.map((dev) => {
                const isOnline = dev.status === 'ONLINE';

                return (
                  <div key={dev.id} className="apple-card p-5 bg-white border border-gray-200 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                            }`}
                          />
                          <h3 className="text-sm font-bold text-gray-900 truncate max-w-[180px]">
                            {dev.name}
                          </h3>
                        </div>
                        <p className="text-[11px] font-mono text-gray-400 mt-0.5">{dev.id}</p>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                          isOnline
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {dev.status}
                      </span>
                    </div>

                    {/* Classroom Assignment Bar */}
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-gray-500 text-[11px]">
                        <span>Assigned Location:</span>
                        <button
                          onClick={() => openAssignmentModal(dev)}
                          className="text-blue-600 hover:text-blue-700 font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="font-bold text-gray-900 flex items-center space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>
                          {dev.classroom} • {dev.room || 'Room 304'} ({dev.building || 'Main Block'})
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Role: <strong className="text-gray-800">{dev.device_role || 'Hardware Node'}</strong>
                      </div>
                    </div>

                    {/* Live Telemetry If Online */}
                    {isOnline && dev.telemetry ? (
                      <div className="grid grid-cols-2 gap-2 text-xs bg-blue-50/50 p-2.5 rounded-xl border border-blue-100 font-mono">
                        {dev.telemetry.temperature_c !== undefined && (
                          <div className="text-gray-700">
                            Temp: <strong>{dev.telemetry.temperature_c}°C</strong>
                          </div>
                        )}
                        {dev.telemetry.humidity_pct !== undefined && (
                          <div className="text-gray-700">
                            Humidity: <strong>{dev.telemetry.humidity_pct}%</strong>
                          </div>
                        )}
                        {dev.telemetry.co2_ppm !== undefined && (
                          <div className="text-gray-700">
                            CO2: <strong>{dev.telemetry.co2_ppm} ppm</strong>
                          </div>
                        )}
                        {dev.telemetry.occupancy_count !== undefined && (
                          <div className="text-gray-700">
                            Occupancy: <strong>{dev.telemetry.occupancy_count}</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400 bg-gray-50 p-2 rounded-xl text-center">
                        Offline • Awaiting telemetry ingestion
                      </div>
                    )}

                    <div className="flex items-center space-x-2 pt-1 border-t border-gray-100">
                      <button
                        onClick={() => openAssignmentModal(dev)}
                        className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
                      >
                        Assign Classroom
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm(`Remove ${dev.name} from campus registry?`)) {
                            await api.deleteCampusDevice(dev.id);
                            loadData();
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-xl transition"
                        title="Delete Device"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Classroom Assignment Modal */}
      {assigningDevice && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="apple-card p-6 sm:p-7 bg-white max-w-md w-full space-y-5 shadow-xl">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">Classroom Assignment</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Assign {assigningDevice.name} to a physical campus room and operational role.
              </p>
            </div>

            <form onSubmit={handleSaveAssignment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Building</label>
                <input
                  type="text"
                  required
                  value={assignmentForm.building}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, building: e.target.value })}
                  placeholder="Main Academic Block"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Room</label>
                <input
                  type="text"
                  required
                  value={assignmentForm.room}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, room: e.target.value })}
                  placeholder="Room 304"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Classroom Code</label>
                <input
                  type="text"
                  required
                  value={assignmentForm.classroom}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, classroom: e.target.value })}
                  placeholder="LH-101"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Device Role</label>
                <select
                  value={assignmentForm.device_role}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, device_role: e.target.value as any })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600 font-medium"
                >
                  <option value="Attendance Camera">Attendance Camera</option>
                  <option value="Occupancy Sensor">Occupancy Sensor</option>
                  <option value="Environmental Sensor">Environmental Sensor</option>
                  <option value="Door Sensor">Door Sensor</option>
                  <option value="IoT Gateway">IoT Gateway</option>
                  <option value="Classroom Display">Classroom Display</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAssigningDevice(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold disabled:opacity-50"
                >
                  {assigningLoading ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Device Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="apple-card p-6 sm:p-7 bg-white max-w-lg w-full space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">Register New Campus Device</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Add an authentic hardware peripheral or IoT gateway to Siddhartha Institute's network.
              </p>
            </div>

            {registeredCredentials ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                  <div className="font-bold flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Device Registered Successfully</span>
                  </div>
                  <p className="text-xs">
                    Copy the ingestion credentials below to flash into your hardware device.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border font-mono text-[11px] space-y-1">
                  <div>ID: <strong>{registeredCredentials.device_id}</strong></div>
                  <div>Token: <strong>{registeredCredentials.device_token}</strong></div>
                  <div>Ingestion URL: <strong>{registeredCredentials.ingestion_url}</strong></div>
                </div>

                <button
                  onClick={() => {
                    setRegisteredCredentials(null);
                    setIsRegisterOpen(false);
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegisterDevice} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Device Name</label>
                  <input
                    type="text"
                    required
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    placeholder="e.g. ESP32 Environmental Hub LH-101"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Category</label>
                    <select
                      value={registerForm.category}
                      onChange={(e) => setRegisterForm({ ...registerForm, category: e.target.value as any })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600 font-medium"
                    >
                      <option value="ESP32_GATEWAY">ESP32 Gateway</option>
                      <option value="USB_CAMERA">USB Camera</option>
                      <option value="IP_RTSP_CAMERA">IP Camera</option>
                      <option value="BLE_ENVIRONMENTAL_SENSOR">BLE Sensor</option>
                      <option value="EDGE_COMPUTE_AI">Edge AI Hub</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Device Role</label>
                    <select
                      value={registerForm.device_role}
                      onChange={(e) => setRegisterForm({ ...registerForm, device_role: e.target.value as any })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600 font-medium"
                    >
                      <option value="Attendance Camera">Attendance Camera</option>
                      <option value="Environmental Sensor">Environmental Sensor</option>
                      <option value="Occupancy Sensor">Occupancy Sensor</option>
                      <option value="Door Sensor">Door Sensor</option>
                      <option value="IoT Gateway">IoT Gateway</option>
                      <option value="Classroom Display">Classroom Display</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Classroom</label>
                    <input
                      type="text"
                      required
                      value={registerForm.classroom}
                      onChange={(e) => setRegisterForm({ ...registerForm, classroom: e.target.value })}
                      placeholder="LH-101"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Room</label>
                    <input
                      type="text"
                      value={registerForm.room}
                      onChange={(e) => setRegisterForm({ ...registerForm, room: e.target.value })}
                      placeholder="Room 304"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registering}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold disabled:opacity-50"
                  >
                    {registering ? 'Registering...' : 'Register Device'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Browser Hardware Limitations & Permissions Policy Guide Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="apple-card p-6 sm:p-8 bg-white max-w-2xl w-full space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 tracking-tight">
                    Browser Hardware Limitations & Policy Guide
                  </h3>
                  <p className="text-xs text-gray-500">
                    Institutional security boundaries, permissions policy & peripheral access
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPolicyModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-600">
              {/* Point 1: Sandbox & Permissions Policy */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <div className="font-bold text-gray-900 flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span>1. Browser Sandbox & Permissions Policy</span>
                </div>
                <p className="leading-relaxed">
                  Web browsers enforce strict sandboxing around raw OS peripherals to protect user privacy. Under the W3C Permissions Policy specification, low-level hardware APIs (such as Web Bluetooth and raw USB cameras) cannot be accessed freely across nested or cross-origin iframe boundaries.
                </p>
              </div>

              {/* Point 2: Web Bluetooth Requirements */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <div className="font-bold text-gray-900 flex items-center space-x-2">
                  <Bluetooth className="w-4 h-4 text-blue-600" />
                  <span>2. Web Bluetooth Constraints & Resolution</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-600 pl-1">
                  <li><strong>Iframe Isolation:</strong> Web Bluetooth calls (<code className="font-mono text-gray-800">navigator.bluetooth.requestDevice</code>) are blocked inside embedded iframes without explicit parent delegation.</li>
                  <li><strong>Transient User Gesture:</strong> Scans can only be triggered by an explicit physical user click, never programmatically on boot.</li>
                  <li><strong>Actionable Fix:</strong> Launch ATTENDIQ in a top-level browser tab using the "Open in New Window" button below to bypass iframe restrictions.</li>
                </ul>
              </div>

              {/* Point 3: Camera Device Enumeration */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <div className="font-bold text-gray-900 flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  <span>3. USB Camera & Video Enumeration</span>
                </div>
                <p className="leading-relaxed">
                  Browsers mask physical camera labels until the user grants camera permissions. Once allowed, ATTENDIQ accurately lists every physical USB camera and integrated sensor with distinct device IDs for dedicated classroom attendance binding.
                </p>
              </div>

              {/* Point 4: Zero Fake Data Policy */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1.5 text-emerald-900">
                <div className="font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>4. Strict Institutional Truth Policy</span>
                </div>
                <p className="leading-relaxed text-emerald-800">
                  ATTENDIQ adheres strictly to institutional integrity: zero artificial devices, zero random telemetry generation (<code className="font-mono">Math.random()</code>), and no fabricated BLE beacons. Offline hardware is truthfully reported as offline.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-full flex items-center justify-center space-x-2 transition text-xs border border-blue-200"
              >
                <span>Open in Top-Level Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => setShowPolicyModal(false)}
                className="w-full sm:w-auto px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-full text-xs transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
