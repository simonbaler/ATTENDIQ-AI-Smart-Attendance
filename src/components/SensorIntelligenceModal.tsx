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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="apple-card p-6 sm:p-7 bg-white max-w-2xl w-full shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto text-gray-900">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">Campus IoT & Sensor Intelligence</h3>
            <p className="text-xs text-gray-500">
              Web Bluetooth telemetry & smart classroom environmental monitoring
            </p>
          </div>
        </div>

        {/* Real Hardware Rule Notice */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-xs text-gray-600 space-y-1">
          <div className="flex items-center space-x-2 font-semibold text-gray-800">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span>Strict Hardware Telemetry Architecture</span>
          </div>
          <p className="text-[11px] text-gray-500">
            ATTENDIQ connects to physical BLE/Wi-Fi microcontrollers (ESP32 / Arduino / BLE Beacons). In accordance with Phase 7 guidelines, no artificial simulated data is reported.
          </p>
        </div>

        {/* Bluetooth Pairing Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50/70 border border-gray-200 rounded-2xl">
          <div>
            <h4 className="text-xs font-bold text-gray-900 flex items-center space-x-2">
              <Bluetooth className="w-4 h-4 text-blue-600" />
              <span>Web Bluetooth Device Discovery</span>
            </h4>
            <p className="text-[11px] text-gray-500">
              Pair with nearby physical BLE environmental sensors, door beacons, and occupancy detectors.
            </p>
          </div>
          <button
            onClick={handleScanBluetooth}
            disabled={bleScanning}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-full transition flex items-center justify-center space-x-1.5 shadow-xs shrink-0"
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
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <span className="font-bold">Bluetooth Status: </span>
              <span>{bleError}</span>
            </div>
          </div>
        )}

        {/* Connected Sensors Grid or Empty State */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Connected Physical Hardware:
          </h4>

          {connectedDevices.length === 0 ? (
            <div className="p-8 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center text-gray-400 space-y-2">
              <Radio className="w-8 h-8 opacity-40 text-gray-400" />
              <p className="text-xs font-semibold text-gray-700">NO DEVICE CONNECTED</p>
              <p className="text-[11px] text-gray-400 max-w-sm">
                Pair a Web Bluetooth environmental beacon or connect an authenticated ESP32 gateway to view real-time classroom telemetry. Zero synthetic data is generated when offline.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {connectedDevices.map((dev) => (
                <div
                  key={dev.id}
                  className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2.5 text-xs shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 truncate">{dev.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>ONLINE</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500">{dev.type}</div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200 text-[11px] font-mono">
                    {dev.telemetry?.temperature_c !== undefined && (
                      <span className="flex items-center space-x-1 text-gray-700">
                        <Thermometer className="w-3 h-3 text-amber-500" />
                        <span>{dev.telemetry.temperature_c.toFixed(1)} °C</span>
                      </span>
                    )}
                    {dev.telemetry?.humidity_pct !== undefined && (
                      <span className="flex items-center space-x-1 text-gray-700">
                        <Wind className="w-3 h-3 text-blue-500" />
                        <span>{dev.telemetry.humidity_pct.toFixed(0)}% RH</span>
                      </span>
                    )}
                    {dev.telemetry?.battery_pct !== undefined && (
                      <span className="flex items-center space-x-1 text-gray-700">
                        <Battery className="w-3 h-3 text-emerald-500" />
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
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">Need full gateway & ESP32 management?</span>
          {onOpenFullDeviceManager ? (
            <button
              onClick={() => {
                onClose();
                onOpenFullDeviceManager();
              }}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-blue-600 text-xs font-semibold rounded-full flex items-center space-x-1 transition"
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
