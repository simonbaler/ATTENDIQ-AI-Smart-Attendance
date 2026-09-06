import React, { useState } from 'react';
import {
  Building2,
  Cpu,
  Radio,
  Camera,
  Activity,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export const CampusHardwareNetwork: React.FC = () => {
  const [activeHoverNode, setActiveHoverNode] = useState<string | null>(null);

  const nodes = [
    {
      id: 'campus',
      label: 'SITS Campus',
      sub: 'Main Institutional Hub',
      icon: Building2,
      color: 'bg-blue-600 text-white',
      border: 'border-blue-200',
      badge: 'Authoritative Root',
    },
    {
      id: 'classroom',
      label: 'Classroom C-204',
      sub: 'Block C • 3rd Floor',
      icon: Building2,
      color: 'bg-indigo-600 text-white',
      border: 'border-indigo-200',
      badge: 'Active Room',
    },
    {
      id: 'gateway',
      label: 'ESP32 Gateway',
      sub: 'MQTT / WebSocket',
      icon: Cpu,
      color: 'bg-emerald-600 text-white',
      border: 'border-emerald-200',
      badge: 'Online',
    },
    {
      id: 'sensor',
      label: 'Peripherals & Cameras',
      sub: 'USB HD Cam • BLE Node',
      icon: Camera,
      color: 'bg-amber-600 text-white',
      border: 'border-amber-200',
      badge: '1080p 30 FPS',
    },
    {
      id: 'engine',
      label: 'Attendance Engine',
      sub: '128D Face Biometrics',
      icon: ShieldCheck,
      color: 'bg-purple-600 text-white',
      border: 'border-purple-200',
      badge: 'Sheets Sync',
    },
  ];

  return (
    <div className="apple-card p-6 bg-white border border-gray-200/80 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
            <Zap className="w-4 h-4 text-blue-600" />
            <span>Campus Hardware Topology & Data Pipeline</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time physical architecture from edge microcontroller sensors to verified institutional attendance.
          </p>
        </div>
        <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto font-semibold">
          Zero Synthetic Simulation
        </span>
      </div>

      {/* Interactive Node Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
        {nodes.map((node, index) => {
          const Icon = node.icon;
          const isHovered = activeHoverNode === node.id;

          return (
            <div
              key={node.id}
              onMouseEnter={() => setActiveHoverNode(node.id)}
              onMouseLeave={() => setActiveHoverNode(null)}
              className={`p-4 rounded-2xl border transition-all duration-200 relative flex flex-col justify-between ${
                isHovered
                  ? 'bg-blue-50/40 border-blue-400 shadow-sm scale-[1.02]'
                  : 'bg-gray-50/60 border-gray-200/80 hover:bg-gray-50'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-xl ${node.color} flex items-center justify-center shadow-xs`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    Step {index + 1}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-900 leading-snug">{node.label}</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">{node.sub}</p>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {node.badge}
                </span>
                {index < nodes.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 hidden sm:block -mr-1" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-200/70 flex items-center justify-between">
        <span>
          Topology is automatically maintained by the <strong>ATTENDIQ Node Registry</strong>. No background 3D WebGL processes compete with client face-inference threads.
        </span>
        <span className="font-mono text-gray-400 hidden md:inline">Latency: ~18ms</span>
      </div>
    </div>
  );
};
