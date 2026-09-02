import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  Wifi,
  Activity,
  Battery,
  Signal,
  Thermometer,
  Wind,
  Volume2,
  Users,
  AlertTriangle,
  RefreshCw,
  X,
  Radio,
  CheckCircle2,
  Cpu,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { bluetoothManager } from '../services/bluetooth';
import { DeviceTelemetry, BluetoothCapabilityState } from '../types';

interface SensorIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullDeviceManager?: () => void;
}

export const SensorIntelligenceModal: React.FC<SensorIntelligenceModalProps> = ({
  isOpen,
  onClose,
  onOpenFullDeviceManager,
}) => {
  const [bleScanning, setBleScanning] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<Array<{
    id: string;
    name: string;
    type: string;
    telemetry?: DeviceTelemetry;
  }>>([]);
  const [bleError, setBleError] = useState<string | null>(null);
  const [capabilityState, setCapabilityState] = useState<BluetoothCapabilityState>('BLUETOOTH_SUPPORTED');

  useEffect(() => {
    if (isOpen) {
      const cap = bluetoothManager.checkCapability();
      setCapabilityState(cap.state);
      if (cap.state !== 'BLUETOOTH_SUPPORTED') {
        setBleError(cap.message);
      } else {
        setBleError(null);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScanBluetooth = async () => {
    setBleError(null);
    setBleScanning(true);

    try {
      const res = await bluetoothManager.connectSensorDevice(
        (telemetry) => {
          setConnectedDevices((prev) =>
            prev.map((d) => (d.id === res.connection?.id ? { ...d, telemetry } : d))
          );
        },
        (status, errorMsg) => {
          if (status === 'ERROR' && errorMsg) {
            setBleError(errorMsg);
          }
        }
      );

      if (res.success && res.connection) {
        setConnectedDevices((prev) => [
          ...prev.filter((d) => d.id !== res.connection!.id),
          {
            id: res.connection!.id,
            name: res.connection!.name || 'Classroom BLE Sensor',
            type: 'Physical BLE Environmental & Occupancy Node',
            telemetry: res.connection!.lastReading ? {
              temperature_c: res.connection!.lastReading.temperature_c,
              humidity_pct: res.connection!.lastReading.humidity_pct,
              battery_pct: res.connection!.lastReading.battery_pct,
              received_at: res.connection!.lastReading.received_at,
            } : undefined,
          },
        ]);
        setCapabilityState('CONNECTED');
      } else {
        setCapabilityState(res.state);
        if (res.error) {
          setBleError(res.error);
        }
      }
    } catch (err: any) {
      setBleError(err.message || 'Bluetooth connection failed.');
    } finally {
      setBleScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Campus IoT & Sensor Intelligence</h3>
            <p className="text-xs text-slate-400">
              Web Bluetooth telemetry & smart classroom environmental monitoring
            </p>
          </div>
        </div>

        {/* Real Hardware Rule Notice */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 space-y-1">
          <div className="flex items-center space-x-2 font-semibold text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Strict Hardware Telemetry Architecture</span>
          </div>
          <p className="text-[11px] text-slate-400">
            ATTENDIQ connects to physical BLE/Wi-Fi microcontrollers (ESP32 / Arduino / BLE Beacons). In accordance with Phase 7 guidelines, no artificial simulated data is reported.
          </p>
        </div>

        {/* Bluetooth Pairing Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
          <div>
            <h4 className="text-xs font-bold text-white flex items-center space-x-2">
              <Bluetooth className="w-4 h-4 text-blue-400" />
              <span>Web Bluetooth Device Discovery</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Pair with nearby physical BLE environmental sensors, door beacons, and occupancy detectors.
            </p>
          </div>
          <button
            onClick={handleScanBluetooth}
            disabled={bleScanning}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center space-x-1.5 shadow-md shrink-0"
          >
            {bleScanning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Scanning BLE...</span>
              </>
            ) : (
              <>
                <Bluetooth className="w-3.5 h-3.5" />
                <span>Scan Bluetooth Devices</span>
              </>
            )}
          </button>
        </div>

        {bleError && (
          <div className="p-3 bg-amber-950/60 border border-amber-800/40 rounded-xl text-amber-300 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <span className="font-bold">Bluetooth Status: </span>
              <span>{bleError}</span>
            </div>
          </div>
        )}

        {/* Connected Sensors Grid or Empty State */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Connected Physical Hardware:
          </h4>

          {connectedDevices.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
              <Radio className="w-8 h-8 opacity-30 text-slate-400" />
              <p className="text-xs font-semibold text-slate-400">NO DEVICE CONNECTED</p>
              <p className="text-[11px] text-slate-600 max-w-sm">
                Pair a Web Bluetooth environmental beacon or connect an authenticated ESP32 gateway to view real-time classroom telemetry. Zero synthetic data is generated when offline.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {connectedDevices.map((dev) => (
                <div
                  key={dev.id}
                  className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate">{dev.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>ONLINE</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{dev.type}</div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900 text-[11px] font-mono">
                    {dev.telemetry?.temperature_c !== undefined && (
                      <span className="flex items-center space-x-1 text-slate-300">
                        <Thermometer className="w-3 h-3 text-amber-400" />
                        <span>{dev.telemetry.temperature_c.toFixed(1)} °C</span>
                      </span>
                    )}
                    {dev.telemetry?.humidity_pct !== undefined && (
                      <span className="flex items-center space-x-1 text-slate-300">
                        <Wind className="w-3 h-3 text-cyan-400" />
                        <span>{dev.telemetry.humidity_pct.toFixed(0)}% RH</span>
                      </span>
                    )}
                    {dev.telemetry?.battery_pct !== undefined && (
                      <span className="flex items-center space-x-1 text-slate-300">
                        <Battery className="w-3 h-3 text-emerald-400" />
                        <span>{dev.telemetry.battery_pct}%</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Link to Full Device Manager */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">Need full gateway & ESP32 management?</span>
          {onOpenFullDeviceManager ? (
            <button
              onClick={() => {
                onClose();
                onOpenFullDeviceManager();
              }}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold rounded-lg flex items-center space-x-1 transition"
            >
              <span>Open Campus Device Manager</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
