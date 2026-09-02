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
} from 'lucide-react';
import { api } from '../services/api';
import { bluetoothManager, EnvironmentDiagnostics } from '../services/bluetooth';
import { iotGatewayClient, IoTGatewayConnectionState } from '../services/iotGatewayClient';
import {
  CampusDevice,
  DeviceCategory,
  DeviceProtocol,
  SmartClassroomCorrelation,
  RemoteSensingData,
  BluetoothCapabilityState,
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
  const [activeTab, setActiveTab] = useState<'devices' | 'gateway' | 'bluetooth' | 'smart_classroom' | 'events' | 'remote_sensing'>('devices');
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

  // WebSocket Live Gateway State
  const [wsState, setWsState] = useState<IoTGatewayConnectionState>('DISCONNECTED');
  const [liveEvents, setLiveEvents] = useState<DeviceEventLog[]>([]);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [classroomFilter, setClassroomFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Register Modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    category: 'ESP32_GATEWAY' as DeviceCategory,
    device_type: 'ESP32 Environmental Gateway (DHT22 + MQ-135 + PIR)',
    classroom: 'LH-101',
    building: 'Main Academic Block',
    department: userRole === 'HOD' ? userDepartment : 'Computer Science & Engineering',
    protocol: 'HTTPS_REST' as DeviceProtocol,
    ip_or_hostname: '',
    mac_or_uuid: '',
    capabilities: ['TEMPERATURE', 'HUMIDITY', 'CO2', 'OCCUPANCY', 'NOISE_LEVEL'],
  });
  const [registeredCredentials, setRegisteredCredentials] = useState<any | null>(null);
  const [registering, setRegistering] = useState(false);

  // Code Snippet & Firmware Modal
  const [selectedDeviceForCode, setSelectedDeviceForCode] = useState<CampusDevice | null>(null);
  const [firmwareTab, setFirmwareTab] = useState<'arduino' | 'micropython' | 'curl' | 'websocket'>('arduino');

  // Interactive Ingestion Testing Panel
  const [testPayload, setTestPayload] = useState({
    deviceId: 'ESP32-C204-01',
    classroom: 'C-204',
    temperature_c: 24.5,
    humidity_pct: 54,
    co2_ppm: 520,
    occupancy_count: 35,
    noise_db: 48,
  });
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Diagnostics & Bluetooth State
  const [diagnostics, setDiagnostics] = useState<EnvironmentDiagnostics | null>(null);
  const [bleState, setBleState] = useState<{
    capability: BluetoothCapabilityState;
    message: string;
    isIframe: boolean;
    isSecure: boolean;
    scanning: boolean;
    connectedDeviceName: string | null;
    liveTelemetry: DeviceTelemetry | null;
    error: string | null;
  }>({
    capability: 'AVAILABLE',
    message: '',
    isIframe: false,
    isSecure: true,
    scanning: false,
    connectedDeviceName: null,
    liveTelemetry: null,
    error: null,
  });

  // Smart Classroom Correlations
  const [correlations, setCorrelations] = useState<SmartClassroomCorrelation[]>([]);
  const [correlationsLoading, setCorrelationsLoading] = useState(false);

  // Remote Sensing Data
  const [remoteSensing, setRemoteSensing] = useState<RemoteSensingData | null>(null);
  const [remoteSensingLoading, setRemoteSensingLoading] = useState(false);
  const [remoteSensingError, setRemoteSensingError] = useState<string | null>(null);

  // Run diagnostics and initial load
  useEffect(() => {
    runDiagnostics();
    loadData();
    loadEvents();

    // Subscribe to IoT Gateway WebSocket Client
    const unsubState = iotGatewayClient.onState((state) => {
      setWsState(state);
    });

    const unsubTelemetry = iotGatewayClient.onTelemetry((evt) => {
      setDevices((prevDevices) =>
        prevDevices.map((d) => {
          if (d.id === evt.deviceId) {
            return {
              ...d,
              status: 'ONLINE',
              telemetry: evt.telemetry,
              last_heartbeat: evt.timestamp,
            };
          }
          return d;
        })
      );
    });

    const unsubStatus = iotGatewayClient.onStatus((evt) => {
      setDevices((prevDevices) =>
        prevDevices.map((d) => {
          if (d.id === evt.deviceId) {
            return {
              ...d,
              status: evt.status,
              last_heartbeat: evt.lastSeen || d.last_heartbeat,
            };
          }
          return d;
        })
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
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [categoryFilter, classroomFilter, statusFilter]);

  const runDiagnostics = () => {
    const diag = bluetoothManager.diagnoseEnvironment();
    setDiagnostics(diag);
    setBleState((prev) => ({
      ...prev,
      capability: diag.bluetoothApi.capabilityState,
      message: diag.bluetoothApi.statusMessage,
      isIframe: diag.iframeStatus.isInsideIframe,
      isSecure: diag.httpsStatus.isSecureContext,
    }));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [devRes, statRes] = await Promise.all([
        api.getCampusDevices({
          category: categoryFilter,
          classroom: classroomFilter,
          status: statusFilter,
          department: userRole === 'HOD' ? userDepartment : undefined,
        }),
        api.getDeviceStats(),
      ]);

      if (devRes.success) {
        setDevices(devRes.devices || []);
      }
      if (statRes.success) {
        setStats(statRes.stats);
      }
    } catch (err) {
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await api.getDeviceEvents();
      if (res.success && Array.isArray(res.events)) {
        setLiveEvents(res.events);
      }
    } catch (err) {
      console.error('Error loading device events:', err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    runDiagnostics();
    loadData();
    loadEvents();
    if (activeTab === 'smart_classroom') loadCorrelations();
    if (activeTab === 'remote_sensing') loadRemoteSensing();
  };

  const loadCorrelations = async () => {
    setCorrelationsLoading(true);
    try {
      const res = await api.getSmartClassroomCorrelations();
      if (res.success) {
        setCorrelations(res.correlations || []);
      }
    } catch (err) {
      console.error('Error loading correlations:', err);
    } finally {
      setCorrelationsLoading(false);
    }
  };

  const loadRemoteSensing = async () => {
    setRemoteSensingLoading(true);
    setRemoteSensingError(null);
    try {
      const res = await api.getRemoteSensingWeather(17.4399, 78.6811);
      if (res.success) {
        setRemoteSensing(res);
      } else {
        setRemoteSensingError('Failed to retrieve remote sensing telemetry from Open-Meteo satellite provider.');
      }
    } catch (err: any) {
      setRemoteSensingError(err.message || 'Remote sensing provider unreachable.');
    } finally {
      setRemoteSensingLoading(false);
    }
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'smart_classroom') loadCorrelations();
    if (tab === 'remote_sensing') loadRemoteSensing();
    if (tab === 'events') loadEvents();
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const res = await api.registerCampusDevice(registerForm);
      if (res.success) {
        setRegisteredCredentials(res.credentials);
        loadData();
      } else {
        alert(res.message || 'Registration failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove the registered device "${name}"?`)) return;
    try {
      const res = await api.deleteCampusDevice(id);
      if (res.success) {
        loadData();
      }
    } catch (err) {
      console.error('Failed to delete device:', err);
    }
  };

  const handleScanBluetoothDevice = async () => {
    setBleState((prev) => ({ ...prev, scanning: true, error: null }));
    try {
      const res = await bluetoothManager.connectSensorDevice(
        (telemetry) => {
          setBleState((prev) => ({ ...prev, liveTelemetry: telemetry }));
        },
        (status, errorMsg) => {
          if (status === 'ERROR' && errorMsg) {
            setBleState((prev) => ({ ...prev, error: errorMsg, scanning: false }));
          }
        }
      );

      if (res.success && res.connection) {
        setBleState((prev) => ({
          ...prev,
          capability: 'CONNECTED',
          connectedDeviceName: res.connection?.name || 'BLE Physical Sensor Node',
          scanning: false,
          error: null,
        }));
      } else {
        setBleState((prev) => ({
          ...prev,
          capability: res.state,
          error: res.error || null,
          scanning: false,
        }));
      }
    } catch (err: any) {
      setBleState((prev) => ({
        ...prev,
        error: err.message || 'Bluetooth connection failed.',
        scanning: false,
      }));
    }
  };

  const handleSendTestTelemetry = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const targetDevice = devices.find((d) => d.id === testPayload.deviceId) || devices[0];
      const res = await api.submitEsp32Telemetry({
        deviceId: targetDevice ? targetDevice.id : testPayload.deviceId,
        token: targetDevice?.device_token,
        classroom: testPayload.classroom,
        sensors: {
          temperature_c: testPayload.temperature_c,
          humidity_pct: testPayload.humidity_pct,
          co2_ppm: testPayload.co2_ppm,
          occupancy_count: testPayload.occupancy_count,
          noise_db: testPayload.noise_db,
        },
      });
      setTestResult(res);
      loadData();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Ingestion failed.' });
    } finally {
      setTestSending(false);
    }
  };

  const openAppInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  const getCategoryBadge = (category: DeviceCategory) => {
    switch (category) {
      case 'ESP32_GATEWAY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">ESP32 GATEWAY</span>;
      case 'BLE_SENSOR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/80 text-blue-400 border border-blue-800/40">BLE SENSOR</span>;
      case 'OCCUPANCY_SENSOR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/80 text-indigo-400 border border-indigo-800/40">OCCUPANCY PIR</span>;
      case 'ENVIRONMENTAL_SENSOR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">ENVIRONMENTAL</span>;
      case 'CAMERA':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/80 text-purple-400 border border-purple-800/40">VISION CAMERA</span>;
      case 'DOOR_BEACON':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-400 border border-amber-800/40">DOOR BEACON</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">DEVICE</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ONLINE</span>
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span>CONNECTING</span>
          </span>
        );
      case 'ERROR':
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <span>ERROR</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span>OFFLINE</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">Campus IoT & Sensor Intelligence Hub</h1>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 border ${
                      wsState === 'CONNECTED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : wsState === 'RECONNECTING'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        wsState === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                    <span>WS GATEWAY: {wsState}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time hardware telemetry gateway for ESP32 Wi-Fi nodes, Web Bluetooth sensors, RTSP vision cameras & Open-Meteo
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center space-x-1.5 transition shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>

            <button
              onClick={() => {
                setRegisteredCredentials(null);
                setIsRegisterOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register New Device</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 font-medium">Registered Nodes</div>
            <div className="text-xl font-bold text-white mt-1 font-mono">{stats.total}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-emerald-400 font-medium flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online Physical Nodes</span>
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">{stats.online}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 font-medium">Offline / Standby</div>
            <div className="text-xl font-bold text-slate-400 mt-1 font-mono">{stats.offline}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-cyan-400 font-medium">ESP32 Gateways</div>
            <div className="text-xl font-bold text-cyan-400 mt-1 font-mono">{stats.categories?.ESP32_GATEWAY || 0}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 col-span-2 sm:col-span-1">
            <div className="text-[11px] text-purple-400 font-medium">Remote Sensing</div>
            <div className="text-xs font-bold text-purple-300 mt-2 font-mono flex items-center space-x-1">
              <Globe className="w-3.5 h-3.5" />
              <span>Open-Meteo LIVE</span>
            </div>
          </div>
        </div>

        {/* Strict Anti-Fake Notice Banner */}
        <div className="mt-4 p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-start space-x-2.5 text-xs text-slate-400">
          <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold text-slate-200">Anti-Mocking Hardware Policy: </span>
            ATTENDIQ strictly displays authentic physical device metrics and provider-backed remote sensing. If a sensor node is offline, the interface reports zero telemetry and offline status without synthetic data fabrication.
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto pb-1">
        <button
          onClick={() => handleTabChange('devices')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 border-b-2 whitespace-nowrap ${
            activeTab === 'devices'
              ? 'border-blue-500 text-blue-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Device Registry ({devices.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('gateway')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 border-b-2 whitespace-nowrap ${
            activeTab === 'gateway'
              ? 'border-cyan-500 text-cyan-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <Wifi className="w-4 h-4 text-cyan-400" />
          <span>ESP32 Wi-Fi & Gateway Hub</span>
        </button>

        <button
          onClick={() => handleTabChange('bluetooth')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 border-b-2 whitespace-nowrap ${
            activeTab === 'bluetooth'
              ? 'border-blue-500 text-blue-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <Bluetooth className="w-4 h-4" />
          <span>Web Bluetooth Client</span>
        </button>

        <button
          onClick={() => handleTabChange('smart_classroom')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 border-b-2 whitespace-nowrap ${
            activeTab === 'smart_classroom'
              ? 'border-blue-500 text-blue-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Smart Classroom Correlation</span>
        </button>

        <button
          onClick={() => handleTabChange('events')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 border-b-2 whitespace-nowrap ${
            activeTab === 'events'
              ? 'border-emerald-500 text-emerald-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Live Hardware Events ({liveEvents.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('remote_sensing')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center space-x-2 border-b-2 whitespace-nowrap ${
            activeTab === 'remote_sensing'
              ? 'border-purple-500 text-purple-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Remote Sensing (Open-Meteo)</span>
        </button>
      </div>

      {/* Tab 1: Device Registry */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Categories</option>
                  <option value="ESP32_GATEWAY">ESP32 Gateways</option>
                  <option value="BLE_SENSOR">BLE Environmental</option>
                  <option value="OCCUPANCY_SENSOR">Occupancy Sensors</option>
                  <option value="CAMERA">Vision Cameras</option>
                  <option value="DOOR_BEACON">Door Beacons</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Classroom:</span>
                <select
                  value={classroomFilter}
                  onChange={(e) => setClassroomFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Classrooms</option>
                  <option value="C-204">C-204</option>
                  <option value="LH-101">LH-101</option>
                  <option value="LH-102">LH-102</option>
                  <option value="LH-103">LH-103</option>
                  <option value="LH-104">LH-104</option>
                  <option value="LH-105">LH-105</option>
                  <option value="LH-201">LH-201</option>
                  <option value="LH-202">LH-202</option>
                  <option value="LH-301">LH-301</option>
                  <option value="IoT-Lab-1">IoT Lab 1</option>
                  <option value="AI-Lab-1">AI Vision Lab 1</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ONLINE">Online Only</option>
                  <option value="OFFLINE">Offline Only</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-400 flex items-center space-x-3">
              <span>
                Showing <span className="text-white font-bold">{devices.length}</span> devices
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400 font-medium flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Broadcast Active</span>
              </span>
            </div>
          </div>

          {/* Devices Grid */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
              <p className="text-xs font-semibold">Loading Campus Device Registry...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <Radio className="w-12 h-12 mx-auto text-slate-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-300">No Devices Found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  No IoT sensors or gateways match the selected filters. Register a new ESP32 microcontroller, BLE node, or occupancy detector.
                </p>
              </div>
              <button
                onClick={() => {
                  setRegisteredCredentials(null);
                  setIsRegisterOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl inline-flex items-center space-x-1.5 transition shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register First Device</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          {getCategoryBadge(device.category)}
                          <span className="text-xs font-mono text-slate-400">{device.classroom}</span>
                        </div>
                        <h3 className="text-sm font-bold text-white truncate" title={device.name}>
                          {device.name}
                        </h3>
                        <p className="text-[11px] text-slate-400">{device.device_type}</p>
                      </div>
                      {getStatusBadge(device.status)}
                    </div>

                    {/* Telemetry Display */}
                    <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Live Telemetry</span>
                        {device.telemetry?.received_at ? (
                          <span className="text-[9px] text-emerald-400 font-mono flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>{new Date(device.telemetry.received_at).toLocaleTimeString()}</span>
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-500 font-mono">NO DATA</span>
                        )}
                      </div>

                      {device.telemetry ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {device.telemetry.temperature_c !== undefined && (
                            <div className="flex items-center space-x-1.5 text-slate-300">
                              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                              <span>{device.telemetry.temperature_c.toFixed(1)} °C</span>
                            </div>
                          )}
                          {device.telemetry.humidity_pct !== undefined && (
                            <div className="flex items-center space-x-1.5 text-slate-300">
                              <Wind className="w-3.5 h-3.5 text-cyan-400" />
                              <span>{device.telemetry.humidity_pct.toFixed(0)}% RH</span>
                            </div>
                          )}
                          {device.telemetry.co2_ppm !== undefined && (
                            <div className="flex items-center space-x-1.5 text-slate-300">
                              <Activity className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{device.telemetry.co2_ppm} ppm CO₂</span>
                            </div>
                          )}
                          {device.telemetry.occupancy_count !== undefined && (
                            <div className="flex items-center space-x-1.5 text-slate-300">
                              <Users className="w-3.5 h-3.5 text-blue-400" />
                              <span>{device.telemetry.occupancy_count} Occupants</span>
                            </div>
                          )}
                          {device.telemetry.noise_db !== undefined && (
                            <div className="flex items-center space-x-1.5 text-slate-300">
                              <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                              <span>{device.telemetry.noise_db} dB</span>
                            </div>
                          )}
                          {device.telemetry.battery_pct !== undefined && (
                            <div className="flex items-center space-x-1.5 text-slate-300">
                              <Battery className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{device.telemetry.battery_pct}%</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-2 text-center text-slate-600 text-[11px] font-mono">
                          NO TELEMETRY RECORDED
                        </div>
                      )}
                    </div>

                    {/* Metadata summary */}
                    <div className="text-[10px] text-slate-400 space-y-1 font-mono pt-1">
                      <div className="flex justify-between">
                        <span>Protocol:</span>
                        <span className="text-slate-300 font-bold">{device.protocol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Classroom / Block:</span>
                        <span className="text-slate-300 truncate max-w-[150px]">{device.classroom} ({device.building})</span>
                      </div>
                      {device.last_heartbeat && (
                        <div className="flex justify-between">
                          <span>Last Seen:</span>
                          <span className="text-slate-400">{new Date(device.last_heartbeat).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedDeviceForCode(device)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium rounded-lg flex items-center space-x-1 transition"
                      title="View Firmware Code & Ingestion Token"
                    >
                      <Code className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Code & Token</span>
                    </button>

                    <button
                      onClick={() => handleDeleteDevice(device.id, device.name)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      title="Delete Device"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: ESP32 Wi-Fi & Gateway Hub */}
      {activeTab === 'gateway' && (
        <div className="space-y-6">
          {/* Gateway Overview Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Wifi className="w-4 h-4 text-cyan-400" />
                  <span>ESP32 Wi-Fi / HTTP / WebSocket Ingestion Gateway</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Primary production architecture: Hardware microcontrollers push authentic environmental and occupancy telemetry directly via Wi-Fi HTTP REST or WebSocket.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-cyan-950/80 border border-cyan-800/40 text-cyan-300 text-xs font-mono rounded-lg">
                  REST: /api/devices/telemetry
                </span>
                <span className="px-3 py-1 bg-emerald-950/80 border border-emerald-800/40 text-emerald-300 text-xs font-mono rounded-lg">
                  WS: /api/devices/ws
                </span>
              </div>
            </div>

            {/* Live Pipeline Test Panel */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold text-white">Interactive Hardware Pipeline Ingestion Tester</h4>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Authentic Backend Test</span>
              </div>

              <p className="text-xs text-slate-400">
                Trigger an authentic telemetry packet to test end-to-end ingestion and verify that dashboard cards and the WebSocket broadcast update immediately.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Device Node</label>
                  <select
                    value={testPayload.deviceId}
                    onChange={(e) => {
                      const dev = devices.find((d) => d.id === e.target.value);
                      setTestPayload({
                        ...testPayload,
                        deviceId: e.target.value,
                        classroom: dev?.classroom || testPayload.classroom,
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs font-mono outline-none focus:border-cyan-500"
                  >
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.classroom})
                      </option>
                    ))}
                    {devices.length === 0 && <option value="ESP32-C204-01">ESP32-C204-01</option>}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Classroom</label>
                  <input
                    type="text"
                    value={testPayload.classroom}
                    onChange={(e) => setTestPayload({ ...testPayload, classroom: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs font-mono outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testPayload.temperature_c}
                    onChange={(e) => setTestPayload({ ...testPayload, temperature_c: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs font-mono outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Humidity (%RH)</label>
                  <input
                    type="number"
                    value={testPayload.humidity_pct}
                    onChange={(e) => setTestPayload({ ...testPayload, humidity_pct: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs font-mono outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">CO₂ (ppm)</label>
                  <input
                    type="number"
                    value={testPayload.co2_ppm}
                    onChange={(e) => setTestPayload({ ...testPayload, co2_ppm: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs font-mono outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Occupancy</label>
                  <input
                    type="number"
                    value={testPayload.occupancy_count}
                    onChange={(e) => setTestPayload({ ...testPayload, occupancy_count: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs font-mono outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="text-xs text-slate-400">
                  {testResult && (
                    <span
                      className={`font-mono ${
                        testResult.success ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {testResult.success
                        ? `✓ Ingested successfully at ${testResult.timestamp || 'now'}`
                        : `✗ Error: ${testResult.message}`}
                    </span>
                  )}
                </div>

                <button
                  onClick={handleSendTestTelemetry}
                  disabled={testSending}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-md"
                >
                  {testSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Push Telemetry Packet</span>
                </button>
              </div>
            </div>

            {/* Standard ESP32 JSON Payload Specification */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-300">ESP32 Standard JSON Ingestion Specification</h4>
              <pre className="bg-slate-900 p-3 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto">
{`// POST /api/devices/telemetry
{
  "deviceId": "ESP32-C204-01",
  "classroom": "C-204",
  "timestamp": "${new Date().toISOString()}",
  "sensors": {
    "temperature_c": 24.5,
    "humidity_percent": 55,
    "occupancy": 38,
    "air_quality": 450,
    "noise_db": 42
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Web Bluetooth Client */}
      {activeTab === 'bluetooth' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Bluetooth className="w-4 h-4 text-blue-400" />
                <span>Web Bluetooth Hardware Pairing & Capability Diagnostics</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Direct browser-side GATT connection to Bluetooth 4.0+ BLE Environmental & Occupancy sensors
              </p>
            </div>

            {/* Runtime Capability Diagnostics Inspection Panel */}
            <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">Runtime Browser & Security Context:</span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    bleState.capability === 'AVAILABLE' || bleState.capability === 'CONNECTED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {bleState.capability}
                </span>
              </div>

              {diagnostics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 space-y-1">
                    <div className="text-[10px] text-slate-400 font-semibold">Browser Engine</div>
                    <div className="text-slate-200 font-mono font-bold">{diagnostics.browser.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {diagnostics.browser.isChromium ? 'Chromium-compatible' : 'Non-Chromium browser'}
                    </div>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 space-y-1">
                    <div className="text-[10px] text-slate-400 font-semibold">Transport Security (HTTPS)</div>
                    <div className="text-slate-200 font-mono font-bold flex items-center space-x-1">
                      {diagnostics.httpsStatus.isSecureContext ? (
                        <span className="text-emerald-400">✓ Secure Context</span>
                      ) : (
                        <span className="text-rose-400">✗ Insecure Context</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">Protocol: {diagnostics.httpsStatus.protocol}</div>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 space-y-1">
                    <div className="text-[10px] text-slate-400 font-semibold">Iframe Sandbox Status</div>
                    <div className="text-slate-200 font-mono font-bold">
                      {diagnostics.iframeStatus.isInsideIframe ? (
                        <span className="text-amber-400">Embedded Iframe</span>
                      ) : (
                        <span className="text-emerald-400">Top-Level Window</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {diagnostics.iframeStatus.isInsideIframe
                        ? 'Permissions Policy restricted'
                        : 'Direct hardware access allowed'}
                    </div>
                  </div>
                </div>
              )}

              {/* Status Message & Guidance */}
              <p className="text-xs text-slate-400">{bleState.message}</p>

              {bleState.isIframe && (
                <div className="p-4 bg-amber-950/40 border border-amber-800/50 rounded-xl text-amber-200 text-xs space-y-3">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">Embedded Preview Context Notice: </span>
                      Browser security specifications block Web Bluetooth API inside sandboxed iframes. To connect to physical Bluetooth sensors, open ATTENDIQ in a top-level tab or use the ESP32 Wi-Fi IoT Gateway.
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={openAppInNewTab}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1.5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open ATTENDIQ in New Tab</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('gateway')}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-lg text-xs flex items-center space-x-1.5 transition border border-slate-700"
                    >
                      <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Connect ESP32 over Wi-Fi Gateway</span>
                    </button>

                    <button
                      onClick={runDiagnostics}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-lg text-xs flex items-center space-x-1.5 transition border border-slate-700"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Re-evaluate Diagnostics</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {bleState.error && (
              <div className="p-3.5 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                <div>
                  <span className="font-bold">Bluetooth Notice: </span>
                  {bleState.error}
                </div>
              </div>
            )}

            {/* Scan / Connect Action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <div>
                <h4 className="text-xs font-bold text-white">Scan for Physical BLE Sensor</h4>
                <p className="text-[11px] text-slate-400">
                  Select your physical BLE GATT peripheral (DHT22 sensor, Nordic nRF52, or ESP32 BLE beacon).
                </p>
              </div>
              <button
                onClick={handleScanBluetoothDevice}
                disabled={bleState.scanning || bleState.capability === 'BLOCKED_BY_PERMISSIONS_POLICY' || bleState.capability === 'BLOCKED_BY_BROWSER' || bleState.capability === 'UNSUPPORTED'}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition flex items-center space-x-2 shadow-md shrink-0"
              >
                {bleState.scanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Awaiting User Selection...</span>
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4" />
                    <span>Scan Physical Bluetooth Devices</span>
                  </>
                )}
              </button>
            </div>

            {/* Live BLE Readout */}
            {bleState.connectedDeviceName ? (
              <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Connected Physical BLE Device: {bleState.connectedDeviceName}</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">GATT ACTIVE</span>
                </div>

                {bleState.liveTelemetry ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {bleState.liveTelemetry.temperature_c !== undefined && (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                        <div className="text-[10px] text-slate-400 font-medium">Temperature</div>
                        <div className="text-lg font-bold text-amber-400 mt-1">
                          {bleState.liveTelemetry.temperature_c.toFixed(1)} °C
                        </div>
                      </div>
                    )}
                    {bleState.liveTelemetry.humidity_pct !== undefined && (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                        <div className="text-[10px] text-slate-400 font-medium">Humidity</div>
                        <div className="text-lg font-bold text-cyan-400 mt-1">
                          {bleState.liveTelemetry.humidity_pct.toFixed(0)} % RH
                        </div>
                      </div>
                    )}
                    {bleState.liveTelemetry.battery_pct !== undefined && (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                        <div className="text-[10px] text-slate-400 font-medium">Battery Level</div>
                        <div className="text-lg font-bold text-emerald-400 mt-1">
                          {bleState.liveTelemetry.battery_pct} %
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Connected — GATT telemetry characteristics awaiting read...</p>
                )}
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center space-y-2">
                <Radio className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-semibold text-slate-400">No Physical Bluetooth Device Connected</p>
                <p className="text-[11px] text-slate-600 max-w-sm mx-auto">
                  Only authentic physical Bluetooth 4.0+ devices are displayed. Simulated sensor readings are strictly excluded.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Smart Classroom Correlation */}
      {activeTab === 'smart_classroom' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Smart Classroom Attendance & Occupancy Correlation</h3>
                <p className="text-xs text-slate-400">
                  Cross-verifies camera facial recognition attendance counts with physical classroom occupancy telemetry
                </p>
              </div>
              <button
                onClick={loadCorrelations}
                disabled={correlationsLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${correlationsLoading ? 'animate-spin' : ''}`} />
                <span>Re-correlate</span>
              </button>
            </div>

            {correlationsLoading ? (
              <div className="p-8 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                <p className="text-xs">Computing multi-modal classroom correlations...</p>
              </div>
            ) : correlations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No active classroom sessions or occupancy data available for correlation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-mono">
                    <tr>
                      <th className="p-3">Classroom</th>
                      <th className="p-3">Subject / Session</th>
                      <th className="p-3">Face Recognition Count</th>
                      <th className="p-3">Physical IoT Occupancy</th>
                      <th className="p-3">Status / Discrepancy</th>
                      <th className="p-3">Climate Telemetry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                    {correlations.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-bold text-white">{c.classroom}</td>
                        <td className="p-3 font-sans text-slate-300">{c.subject || 'Live Lecture'}</td>
                        <td className="p-3">
                          <span className="text-blue-400 font-bold">{c.attendance_face_count}</span> verified
                        </td>
                        <td className="p-3">
                          {c.physical_occupancy_count !== undefined ? (
                            <span>{c.physical_occupancy_count} occupants</span>
                          ) : (
                            <span className="text-slate-600">No sensor stream</span>
                          )}
                        </td>
                        <td className="p-3">
                          {c.discrepancy_alert ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center space-x-1 w-fit">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{c.discrepancy_alert}</span>
                            </span>
                          ) : c.physical_occupancy_count !== undefined ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>100% Correlated</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">Awaiting Sensor</span>
                          )}
                        </td>
                        <td className="p-3 font-sans">
                          {c.environmental ? (
                            <div className="flex items-center space-x-2 text-[11px] text-slate-300">
                              {c.environmental.temperature_c && <span>{c.environmental.temperature_c.toFixed(1)}°C</span>}
                              {c.environmental.co2_ppm && (
                                <span className="text-emerald-400 font-mono">{c.environmental.co2_ppm} ppm</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[10px] italic">No Climate Node</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Live Hardware Events */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Authentic Hardware Event & Telemetry Stream</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time audit log of hardware connections, disconnections, telemetry packets, and environmental thresholds
                </p>
              </div>

              <button
                onClick={loadEvents}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center space-x-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Log</span>
              </button>
            </div>

            {liveEvents.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                No hardware events recorded yet. Connect a device or push a telemetry packet to see live events.
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {liveEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            evt.severity === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : evt.severity === 'warning'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : evt.severity === 'error'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {evt.type}
                        </span>
                        <span className="font-mono text-slate-300 font-bold">{evt.device_name}</span>
                        <span className="text-slate-500">in {evt.classroom}</span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{evt.message}</p>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Remote Sensing & Geospatial Context (Open-Meteo) */}
      {activeTab === 'remote_sensing' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-purple-400" />
                  <span>Remote Sensing & Geospatial Atmosphere Context</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Official Open-Meteo WMO / Copernicus high-resolution atmospheric & solar irradiance telemetry
                </p>
              </div>
              <button
                onClick={loadRemoteSensing}
                disabled={remoteSensingLoading}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center space-x-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${remoteSensingLoading ? 'animate-spin' : ''}`} />
                <span>Fetch Satellite Observation</span>
              </button>
            </div>

            {remoteSensingLoading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-500 mb-3" />
                <p className="text-xs font-semibold">Querying Open-Meteo WMO Global Reanalysis Grid...</p>
              </div>
            ) : remoteSensingError ? (
              <div className="p-4 bg-rose-950/60 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                <span>{remoteSensingError}</span>
              </div>
            ) : remoteSensing ? (
              <div className="space-y-6">
                {/* Location & Metadata Pill */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Target Institution Campus</div>
                    <div className="text-slate-200 font-bold font-sans">
                      {remoteSensing.institution_location.campus}
                    </div>
                    <div className="text-slate-400 text-[11px] font-sans">
                      {remoteSensing.institution_location.city} ({remoteSensing.institution_location.latitude}° N, {remoteSensing.institution_location.longitude}° E)
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Provider & Resolution</div>
                    <div className="text-purple-300 font-bold">{remoteSensing.provider}</div>
                    <div className="text-slate-400 text-[11px]">{remoteSensing.spatial_resolution}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Data Freshness</div>
                    <div className="text-emerald-400 font-bold flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{remoteSensing.data_freshness}</span>
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {new Date(remoteSensing.acquisition_time).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Atmosphere & Weather Metrics */}
                {remoteSensing.weather && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Campus Atmospheric Telemetry:
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                          <Thermometer className="w-4 h-4 text-amber-400" />
                          <span>Surface Temp</span>
                        </div>
                        <div className="text-2xl font-bold text-white font-mono">
                          {remoteSensing.weather.temperature_c.toFixed(1)} <span className="text-sm">°C</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Feels like {remoteSensing.weather.apparent_temperature_c.toFixed(1)} °C
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                          <Wind className="w-4 h-4 text-cyan-400" />
                          <span>Relative Humidity</span>
                        </div>
                        <div className="text-2xl font-bold text-white font-mono">
                          {remoteSensing.weather.relative_humidity_pct} <span className="text-sm">%</span>
                        </div>
                        <div className="text-[10px] text-slate-500">Pressure: {remoteSensing.weather.surface_pressure_hpa} hPa</div>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                          <Sun className="w-4 h-4 text-yellow-400" />
                          <span>Solar Irradiance</span>
                        </div>
                        <div className="text-2xl font-bold text-white font-mono">
                          {remoteSensing.weather.solar_irradiance_wm2 ?? 0} <span className="text-sm">W/m²</span>
                        </div>
                        <div className="text-[10px] text-slate-500">Cloud cover: {remoteSensing.weather.cloud_cover_pct}%</div>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                          <Activity className="w-4 h-4 text-emerald-400" />
                          <span>Air Quality (US AQI)</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-400 font-mono">
                          {remoteSensing.air_quality?.us_aqi ?? 'Good'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          PM2.5: {remoteSensing.air_quality?.pm2_5_ugm3 ?? '--'} μg/m³
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Register Device Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-blue-400" />
                <span>Register New Campus IoT Device</span>
              </h3>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {registeredCredentials ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-950/50 border border-emerald-500/40 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-emerald-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Device Successfully Provisioned!</span>
                  </div>
                  <p className="text-slate-300">
                    Use the following secret credentials in your ESP32 / microcontroller firmware:
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-slate-500">Device ID: </span>
                    <span className="text-cyan-400 font-bold">{registeredCredentials.device_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Secret Token: </span>
                    <span className="text-emerald-400 font-bold">{registeredCredentials.device_token}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Ingestion URL: </span>
                    <span className="text-slate-300">{registeredCredentials.ingestion_url}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">HTTP Header: </span>
                    <span className="text-amber-400">{registeredCredentials.header_auth}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsRegisterOpen(false);
                    setRegisteredCredentials(null);
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Device Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. C-204 Environmental & Occupancy Node"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Category *</label>
                    <select
                      value={registerForm.category}
                      onChange={(e) => setRegisterForm({ ...registerForm, category: e.target.value as DeviceCategory })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                    >
                      <option value="ESP32_GATEWAY">ESP32 Gateway (WiFi / REST)</option>
                      <option value="BLE_SENSOR">BLE Environmental Sensor</option>
                      <option value="OCCUPANCY_SENSOR">Occupancy PIR Node</option>
                      <option value="ENVIRONMENTAL_SENSOR">DHT22 / MQ-135 Climate Node</option>
                      <option value="CAMERA">Vision Camera (RTSP / USB)</option>
                      <option value="DOOR_BEACON">Door Access Beacon</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Classroom *</label>
                    <select
                      value={registerForm.classroom}
                      onChange={(e) => setRegisterForm({ ...registerForm, classroom: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                    >
                      <option value="C-204">C-204</option>
                      <option value="LH-101">LH-101</option>
                      <option value="LH-102">LH-102</option>
                      <option value="LH-103">LH-103</option>
                      <option value="LH-104">LH-104</option>
                      <option value="LH-105">LH-105</option>
                      <option value="LH-201">LH-201</option>
                      <option value="LH-202">LH-202</option>
                      <option value="LH-301">LH-301</option>
                      <option value="IoT-Lab-1">IoT Lab 1</option>
                      <option value="AI-Lab-1">AI Vision Lab 1</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Protocol</label>
                    <select
                      value={registerForm.protocol}
                      onChange={(e) => setRegisterForm({ ...registerForm, protocol: e.target.value as DeviceProtocol })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                    >
                      <option value="HTTPS_REST">HTTPS REST Ingestion</option>
                      <option value="WEBSOCKET">WebSocket Stream</option>
                      <option value="BLE_GATT">Web Bluetooth GATT</option>
                      <option value="MQTT">MQTT Gateway</option>
                      <option value="RTSP">RTSP Camera Stream</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-semibold">Hardware Type / Model</label>
                    <input
                      type="text"
                      placeholder="e.g. ESP32 NodeMCU + DHT22"
                      value={registerForm.device_type}
                      onChange={(e) => setRegisterForm({ ...registerForm, device_type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registering}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition shadow-md flex items-center space-x-1.5"
                  >
                    {registering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Provision Device</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Code Snippet & Firmware Modal */}
      {selectedDeviceForCode && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Hardware Ingestion Code & Credentials</h3>
              </div>
              <button
                onClick={() => setSelectedDeviceForCode(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-xs font-mono">
              <div>
                <span className="text-slate-500">Device Name: </span>
                <span className="text-white font-bold">{selectedDeviceForCode.name}</span>
              </div>
              <div>
                <span className="text-slate-500">Device ID: </span>
                <span className="text-cyan-400 font-bold">{selectedDeviceForCode.id}</span>
              </div>
              <div>
                <span className="text-slate-500">Secret Token: </span>
                <span className="text-emerald-400 font-bold">{selectedDeviceForCode.device_token || '(Pre-shared)'}</span>
              </div>
              <div>
                <span className="text-slate-500">Endpoint: </span>
                <span className="text-slate-300">POST /api/devices/{selectedDeviceForCode.id}/telemetry</span>
              </div>
            </div>

            {/* Firmware Selector Tabs */}
            <div className="flex border-b border-slate-800 space-x-2">
              <button
                onClick={() => setFirmwareTab('arduino')}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition ${
                  firmwareTab === 'arduino' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400'
                }`}
              >
                ESP32 (C++ / Arduino)
              </button>
              <button
                onClick={() => setFirmwareTab('micropython')}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition ${
                  firmwareTab === 'micropython' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400'
                }`}
              >
                MicroPython
              </button>
              <button
                onClick={() => setFirmwareTab('curl')}
                className={`px-3 py-1.5 text-xs font-bold border-b-2 transition ${
                  firmwareTab === 'curl' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400'
                }`}
              >
                cURL / Terminal
              </button>
            </div>

            {firmwareTab === 'arduino' && (
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-[11px] font-mono text-cyan-300 overflow-x-auto">
{`#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "CAMPUS_WIFI";
const char* password = "WIFI_PASSWORD";
const char* serverUrl = "https://${typeof window !== 'undefined' ? window.location.host : 'your-domain'}/api/devices/${selectedDeviceForCode.id}/telemetry";
const char* deviceToken = "${selectedDeviceForCode.device_token || 'TOKEN'}";

void sendTelemetry(float temp, float humidity, int co2, int occupancy) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Token", deviceToken);

    StaticJsonDocument<256> doc;
    doc["temperature_c"] = temp;
    doc["humidity_pct"] = humidity;
    doc["co2_ppm"] = co2;
    doc["occupancy_count"] = occupancy;

    String body;
    serializeJson(doc, body);
    int code = http.POST(body);
    http.end();
  }
}`}
              </pre>
            )}

            {firmwareTab === 'micropython' && (
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-[11px] font-mono text-emerald-300 overflow-x-auto">
{`import urequests
import json

URL = "https://${typeof window !== 'undefined' ? window.location.host : 'your-domain'}/api/devices/${selectedDeviceForCode.id}/telemetry"
TOKEN = "${selectedDeviceForCode.device_token || 'TOKEN'}"

def send_telemetry(temp, hum, co2, occ):
    headers = {"Content-Type": "application/json", "X-Device-Token": TOKEN}
    payload = {
        "temperature_c": temp,
        "humidity_pct": hum,
        "co2_ppm": co2,
        "occupancy_count": occ
    }
    res = urequests.post(URL, data=json.dumps(payload), headers=headers)
    print("Ingestion Status:", res.status_code)
    res.close()`}
              </pre>
            )}

            {firmwareTab === 'curl' && (
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 overflow-x-auto">
{`curl -X POST https://${typeof window !== 'undefined' ? window.location.host : 'localhost:3000'}/api/devices/${selectedDeviceForCode.id}/telemetry \\
  -H "Content-Type: application/json" \\
  -H "X-Device-Token: ${selectedDeviceForCode.device_token || 'TOKEN'}" \\
  -d '{"temperature_c": 24.5, "humidity_pct": 52, "co2_ppm": 480, "occupancy_count": 28}'`}
              </pre>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedDeviceForCode(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
