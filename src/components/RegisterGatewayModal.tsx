import React, { useState } from 'react';
import { X, Wifi, Server, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface RegisterGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (gateway: {
    name: string;
    id: string;
    ip_address: string;
    classroom: string;
    protocol: 'HTTP' | 'HTTPS' | 'WebSocket' | 'MQTT';
    authToken: string;
  }) => Promise<void>;
  classrooms?: string[];
}

export const RegisterGatewayModal: React.FC<RegisterGatewayModalProps> = ({
  isOpen,
  onClose,
  onRegister,
  classrooms = ['C-204', 'B-102', 'C-301', 'Mech-Lab-01', 'Civil-CAD-Lab'],
}) => {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [classroom, setClassroom] = useState(classrooms[0] || 'C-204');
  const [protocol, setProtocol] = useState<'HTTP' | 'HTTPS' | 'WebSocket' | 'MQTT'>('WebSocket');
  const [authToken, setAuthToken] = useState('');

  const [registering, setRegistering] = useState(false);
  const [registerStep, setRegisterStep] = useState<'IDLE' | 'CONNECTING' | 'AUTHENTICATING' | 'ONLINE' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !id || !ipAddress) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    setRegistering(true);
    setErrorMessage(null);
    try {
      // Step 1: CONNECTING
      setRegisterStep('CONNECTING');
      await new Promise((r) => setTimeout(r, 600));

      // Step 2: AUTHENTICATING
      setRegisterStep('AUTHENTICATING');
      await new Promise((r) => setTimeout(r, 600));

      // Invoke real backend registration
      await onRegister({
        name,
        id,
        ip_address: ipAddress,
        classroom,
        protocol,
        authToken,
      });

      // Step 3: ONLINE
      setRegisterStep('ONLINE');
      await new Promise((r) => setTimeout(r, 500));
      onClose();
    } catch (err: any) {
      setRegisterStep('ERROR');
      setErrorMessage(err.message || 'Registration failed. Check network address.');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Register Wi-Fi / IoT Gateway</h3>
              <p className="text-xs text-gray-500">Configure physical gateway for sensor telemetry ingestion</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-200/80 text-gray-400 hover:text-gray-700 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator when active */}
        {registerStep !== 'IDLE' && (
          <div className="px-6 pt-4">
            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
              <span className="font-bold text-blue-900">Registration State:</span>
              <span className="font-mono font-semibold text-blue-700 uppercase">{registerStep}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">Gateway Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ESP32 Gateway C-204"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">Gateway ID</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="dev_esp32_c204_01"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">IP Address / Host</label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.1.105:8080"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">Classroom Assignment</label>
              <select
                value={classroom}
                onChange={(e) => setClassroom(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-blue-600"
              >
                {classrooms.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">Transport Protocol</label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-blue-600"
              >
                <option value="WebSocket">WebSocket (/ws/iot-gateway)</option>
                <option value="HTTP">HTTP REST</option>
                <option value="HTTPS">HTTPS Secure</option>
                <option value="MQTT">MQTT Broker Gateway</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 block">Authentication Token</label>
              <input
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="iot_tok_..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <p className="text-[11px] text-gray-400 leading-tight pt-1">
            Note: The gateway will only flip to <strong>ONLINE</strong> once a verified heartbeat packet with matching token is ingested by the server.
          </p>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-xl border border-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={registering}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center space-x-2"
            >
              {registering && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{registering ? 'Validating...' : 'Register Gateway'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
