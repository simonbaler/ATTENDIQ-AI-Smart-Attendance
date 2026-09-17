import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  Building2,
  Camera,
  Cpu,
  Users,
  UserCheck,
  UserX,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  Clock,
  Radio,
  Wifi,
  ShieldCheck,
  Video,
  Eye,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Minimize2,
  Sliders,
  Compass,
} from 'lucide-react';
import { api } from '../services/api';
import { eventBusClient, CampusEvent } from '../services/eventBusClient';
import { AttendanceSession, Student, CampusDevice } from '../types';

interface BuildingDef {
  id: string;
  name: string;
  code: string;
  subtitle: string;
  departments: string[];
  classrooms: string[];
  position: [number, number, number];
  color: number;
  height: number;
}

const BUILDINGS: BuildingDef[] = [
  {
    id: 'bldg_turing',
    name: 'Alan Turing Computer Science Tower',
    code: 'CS-TOWER',
    subtitle: 'Core Computing, Software & AI Laboratories',
    departments: ['Computer Science & Engineering', 'Software Engineering'],
    classrooms: ['LH-301', 'LH-302', 'LH-303', 'C-204', 'CS-Lab-1', 'CS-Lab-2', 'SE-Lab-1'],
    position: [-2.2, 0, -1.2],
    color: 0x2563eb, // Royal Blue
    height: 3.2,
  },
  {
    id: 'bldg_ramanujan',
    name: 'Ramanujan Mathematical & Data Sciences Center',
    code: 'DS-CENTER',
    subtitle: 'Data Science, AIML & Cyber Defense Cluster',
    departments: [
      'Artificial Intelligence & Machine Learning',
      'Data Science',
      'Cyber Security',
      'Internet of Things',
    ],
    classrooms: ['LH-401', 'LH-402', 'AI-Lab-1', 'DS-Lab-1', 'IoT-Lab-1', 'Cyber-Lab-1'],
    position: [2.2, 0, -1.2],
    color: 0x4f46e5, // Indigo
    height: 3.0,
  },
  {
    id: 'bldg_aryabhata',
    name: 'Aryabhata Engineering Hall',
    code: 'EE-HALL',
    subtitle: 'Electronics, Telemetry & Embedded Systems',
    departments: [
      'Electronics & Communication Engineering',
      'Electrical & Electronics Engineering',
    ],
    classrooms: ['LH-201', 'LH-202', 'ECE-Lab-1', 'EEE-Lab-1', 'Seminar-Hall-B'],
    position: [-2.2, 0, 1.8],
    color: 0x059669, // Emerald
    height: 2.5,
  },
  {
    id: 'bldg_science',
    name: 'Science & Technology Complex',
    code: 'ST-COMPLEX',
    subtitle: 'Foundation Sciences, Mechanical & Structural Engineering',
    departments: ['Mechanical Engineering', 'Civil Engineering'],
    classrooms: ['LH-101', 'LH-102', 'LH-103', 'LH-104', 'LH-105', 'Civil-Lab-1', 'Mech-Workshop-1'],
    position: [2.2, 0, 1.8],
    color: 0xd97706, // Amber
    height: 2.2,
  },
];

interface CampusDigitalTwin3DProps {
  onOpenLiveCamera?: (classroomId?: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const CampusDigitalTwin3D: React.FC<CampusDigitalTwin3DProps> = ({
  onOpenLiveCamera,
  onNavigateTab,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingDef | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);

  // Layer Toggle Bar States (Phase 41+ Digital Twin 2.0)
  const [layers, setLayers] = useState({
    cameras: true,
    iot: true,
    occupancy: true,
    network: true,
  });

  // Real backend data states
  const [classroomsState, setClassroomsState] = useState<any[]>([]);
  const [deviceHealthList, setDeviceHealthList] = useState<any[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [devices, setDevices] = useState<CampusDevice[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load real authoritative records
  const loadCampusState = async () => {
    try {
      setLoading(true);
      const [sessRes, actRes, studRes, devRes, camRes, cStateRes, dHealthRes] = await Promise.all([
        api.getSessions(),
        api.getActiveSession(),
        api.getStudents(),
        api.getCampusDevices(),
        api.getCameras(),
        api.getClassroomsIntelligence().catch(() => ({ success: false, classrooms: [] })),
        api.getDeviceHealthRegistry().catch(() => ({ success: false, devices: [] })),
      ]);

      if (sessRes.success && sessRes.sessions) setSessions(sessRes.sessions);
      if (actRes.success) setActiveSession(actRes.session || null);
      if (studRes.success && studRes.students) setStudents(studRes.students);
      if (devRes.success && devRes.devices) setDevices(devRes.devices);
      if (camRes.success && camRes.cameras) setCameras(camRes.cameras);
      if (cStateRes.success && cStateRes.classrooms) setClassroomsState(cStateRes.classrooms);
      if (dHealthRes.success && dHealthRes.devices) setDeviceHealthList(dHealthRes.devices);
    } catch (err) {
      console.error('Failed to load campus twin telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampusState();

    // SSE Event Listener for instant live digital twin state updates
    const onCampusEvent = (evt: CampusEvent) => {
      setRecentEvents((prev) => [evt, ...prev.slice(0, 19)]);
      if (
        evt.type === 'TIMETABLE_SESSION_STARTED' ||
        evt.type === 'TIMETABLE_SESSION_ENDED' ||
        evt.type === 'ATTENDANCE_RECORDED' ||
        evt.type === 'FACE_VERIFIED'
      ) {
        api.getActiveSession().then((res) => {
          if (res.success) setActiveSession(res.session || null);
        });
      }
    };

    eventBusClient.subscribe('*', onCampusEvent);
    return () => {
      eventBusClient.unsubscribe('*', onCampusEvent);
    };
  }, []);

  // Three.js Scene Setup & Interaction
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc); // Crisp light off-white

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 8.5, 9.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Campus Grounds: Subtle light grid and green zones
    const gridHelper = new THREE.GridHelper(16, 16, 0xcbd5e1, 0xe2e8f0);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // Ground Plane
    const groundGeo = new THREE.PlaneGeometry(16, 16);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.8,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Lighting (Warm Daylight Architecture)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    sunLight.position.set(5, 12, 6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    const skyLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.4);
    scene.add(skyLight);

    // Building Meshes Group
    const buildingsGroup = new THREE.Group();
    scene.add(buildingsGroup);

    const interactiveMeshes: Array<{ mesh: THREE.Mesh; building: BuildingDef }> = [];

    BUILDINGS.forEach((bldg) => {
      const bldgGroup = new THREE.Group();
      bldgGroup.position.set(bldg.position[0], 0, bldg.position[2]);

      // Base Footprint / Foundation
      const baseGeo = new THREE.BoxGeometry(2.4, 0.15, 2.0);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.075;
      baseMesh.receiveShadow = true;
      bldgGroup.add(baseMesh);

      // Main Architectural Block
      const mainGeo = new THREE.BoxGeometry(2.1, bldg.height, 1.7);
      const mainMat = new THREE.MeshStandardMaterial({
        color: bldg.color,
        roughness: 0.35,
        metalness: 0.25,
        transparent: true,
        opacity: 0.9,
      });
      const mainMesh = new THREE.Mesh(mainGeo, mainMat);
      mainMesh.position.y = bldg.height / 2 + 0.15;
      mainMesh.castShadow = true;
      mainMesh.receiveShadow = true;
      (mainMesh as any).userData = { buildingId: bldg.id };
      bldgGroup.add(mainMesh);
      interactiveMeshes.push({ mesh: mainMesh, building: bldg });

      // Glass Architectural Facade Ribs (Floor Dividers)
      const floors = Math.floor(bldg.height / 0.7);
      for (let f = 1; f <= floors; f++) {
        const floorGeo = new THREE.BoxGeometry(2.14, 0.04, 1.74);
        const floorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.position.y = 0.15 + f * 0.7;
        bldgGroup.add(floorMesh);
      }

      // Roof Penthouse / Antenna Node
      const roofGeo = new THREE.BoxGeometry(0.8, 0.3, 0.8);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
      const roofMesh = new THREE.Mesh(roofGeo, roofMat);
      roofMesh.position.y = bldg.height + 0.3;
      bldgGroup.add(roofMesh);

      // Status Beacon
      const beaconGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: activeSession && bldg.classrooms.includes(activeSession.classroom) ? 0x10b981 : 0x3b82f6,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = bldg.height + 0.55;
      bldgGroup.add(beacon);

      // Layer 1: Occupancy Heatmap Glow Ring
      if (layers.occupancy && activeSession && bldg.classrooms.includes(activeSession.classroom)) {
        const ringGeo = new THREE.RingGeometry(1.5, 1.8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        bldgGroup.add(ring);
      }

      // Layer 2: Cameras Marker
      if (layers.cameras) {
        const camMarkerGeo = new THREE.OctahedronGeometry(0.16);
        const camMarkerMat = new THREE.MeshStandardMaterial({
          color: 0x0ea5e9,
          roughness: 0.2,
          metalness: 0.8,
        });
        const camMarker = new THREE.Mesh(camMarkerGeo, camMarkerMat);
        camMarker.position.set(-0.7, bldg.height + 0.5, 0.4);
        bldgGroup.add(camMarker);
      }

      // Layer 3: IoT Devices Node
      if (layers.iot) {
        const iotGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
        const iotMat = new THREE.MeshStandardMaterial({
          color: 0x8b5cf6,
          roughness: 0.3,
          metalness: 0.6,
        });
        const iotMesh = new THREE.Mesh(iotGeo, iotMat);
        iotMesh.position.set(0.7, bldg.height + 0.5, -0.4);
        bldgGroup.add(iotMesh);
      }

      // Layer 4: Network Health Ping
      if (layers.network) {
        const netGeo = new THREE.SphereGeometry(0.08, 12, 12);
        const netMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        const netMesh = new THREE.Mesh(netGeo, netMat);
        netMesh.position.set(0, bldg.height + 0.75, 0);
        bldgGroup.add(netMesh);
      }

      buildingsGroup.add(bldgGroup);
    });

    // Raycasting for Mouse Picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes.map((m) => m.mesh));

      if (intersects.length > 0) {
        const hit = interactiveMeshes.find((m) => m.mesh === intersects[0].object);
        if (hit) {
          setSelectedBuilding(hit.building);
          setSelectedDept(hit.building.departments[0] || null);
          setSelectedClassroom(hit.building.classrooms[0] || null);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Subtle Continuous Orbit Animation
    let reqId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Subtle slow campus orbital drift when idle
      if (!selectedBuilding) {
        const t = clock.getElapsedTime() * 0.08;
        camera.position.x = Math.sin(t) * 9.5;
        camera.position.z = Math.cos(t) * 9.5;
        camera.lookAt(0, 0.8, 0);
      } else {
        // Smoothly zoom focus on selected building
        const targetX = selectedBuilding.position[0] * 0.9;
        const targetZ = selectedBuilding.position[2] * 0.9 + 5.2;
        camera.position.x += (targetX - camera.position.x) * 0.05;
        camera.position.y += (4.2 - camera.position.y) * 0.05;
        camera.position.z += (targetZ - camera.position.z) * 0.05;
        camera.lookAt(selectedBuilding.position[0], 1.2, selectedBuilding.position[2]);
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 550;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [selectedBuilding, activeSession, layers]);

  // Derived telemetry for current selection
  const classroomSession = activeSession && activeSession.classroom.toLowerCase() === selectedClassroom?.toLowerCase()
    ? activeSession
    : sessions.find((s) => s.classroom.toLowerCase() === selectedClassroom?.toLowerCase() && s.status === 'ACTIVE');

  // Classroom authoritative roster count
  const classroomStudents = students.filter((s) => {
    if (!selectedDept) return true;
    return s.department.toLowerCase() === selectedDept.toLowerCase();
  });

  const assignedCameras = cameras.filter((c) =>
    (c.classroom || '').toLowerCase() === selectedClassroom?.toLowerCase() ||
    (c.name || '').toLowerCase().includes((selectedClassroom || '').toLowerCase())
  );

  const assignedDevices = devices.filter((d) =>
    (d.classroom || '').toLowerCase() === selectedClassroom?.toLowerCase()
  );

  const resetView = () => {
    setSelectedBuilding(null);
    setSelectedDept(null);
    setSelectedClassroom(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Phase 41 — Live Digital Twin</span>
            </span>
            <span className="text-xs text-gray-500 font-medium">Real-Time Spatial Intelligence</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight mt-1">
            Campus Classroom Digital Twin
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Interactive 3D structural model of institutional academic complexes, classrooms, assigned cameras, and IoT gateways.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={resetView}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center space-x-1.5 ${
              selectedBuilding
                ? 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-sm'
                : 'bg-gray-100 text-gray-400 border-transparent cursor-default'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Reset Camera</span>
          </button>
          <button
            onClick={loadCampusState}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Telemetry</span>
          </button>
        </div>
      </div>

      {/* Main 3D Canvas & Drilldown Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: 3D Stage */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden flex flex-col relative">
          
          {/* Breadcrumb Navigation Ribbon */}
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/80 flex items-center space-x-2 text-xs font-medium text-gray-600 overflow-x-auto">
            <button
              onClick={resetView}
              className={`hover:text-blue-600 transition font-bold ${!selectedBuilding ? 'text-blue-700' : 'text-gray-500'}`}
            >
              Campus Grounds
            </button>
            {selectedBuilding && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <button
                  onClick={() => setSelectedDept(selectedBuilding.departments[0] || null)}
                  className="font-bold text-gray-900 hover:text-blue-600 transition shrink-0"
                >
                  {selectedBuilding.name}
                </button>
              </>
            )}
            {selectedDept && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-blue-600 font-semibold shrink-0">{selectedDept}</span>
              </>
            )}
            {selectedClassroom && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono font-bold shrink-0">
                  {selectedClassroom}
                </span>
              </>
            )}
          </div>

          {/* Layer Toggle Bar (Phase 41+ Digital Twin 2.0) */}
          <div className="px-5 py-2.5 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">
              Spatial Layers:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setLayers((prev) => ({ ...prev, cameras: !prev.cameras }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  layers.cameras
                    ? 'bg-sky-100 text-sky-800 border border-sky-300 shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Cameras</span>
              </button>
              <button
                onClick={() => setLayers((prev) => ({ ...prev, iot: !prev.iot }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  layers.iot
                    ? 'bg-purple-100 text-purple-800 border border-purple-300 shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>IoT Devices</span>
              </button>
              <button
                onClick={() => setLayers((prev) => ({ ...prev, occupancy: !prev.occupancy }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  layers.occupancy
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Occupancy Heatmap</span>
              </button>
              <button
                onClick={() => setLayers((prev) => ({ ...prev, network: !prev.network }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  layers.network
                    ? 'bg-green-100 text-green-800 border border-green-300 shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Network Health</span>
              </button>
            </div>
          </div>

          {/* Three.js Container */}
          <div className="relative flex-1 min-h-[460px] bg-slate-50 cursor-grab active:cursor-grabbing">
            <div ref={mountRef} className="w-full h-full" />

            {/* Quick 3D Overlay Badges */}
            <div className="absolute top-3 left-3 pointer-events-none flex flex-wrap gap-2">
              {BUILDINGS.map((bldg) => {
                const isFocused = selectedBuilding?.id === bldg.id;
                const hasActive = activeSession && bldg.classrooms.includes(activeSession.classroom);
                return (
                  <div
                    key={bldg.id}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border backdrop-blur-md shadow-sm transition ${
                      isFocused
                        ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                        : 'bg-white/90 text-gray-700 border-gray-200/80'
                    }`}
                  >
                    <span className="mr-1.5">{bldg.code}</span>
                    {hasActive && (
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hint Tag */}
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-200 text-[11px] text-gray-500 font-medium pointer-events-none shadow-sm flex items-center space-x-2">
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>Click building in 3D or select from right panel to inspect classrooms.</span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Classroom & Structural Intelligence Inspector */}
        <div className="space-y-4">
          
          {/* Level 1: Building Selector Cards */}
          {!selectedBuilding ? (
            <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center justify-between">
                <span>Campus Complexes</span>
                <span className="text-xs text-blue-600 font-semibold">{BUILDINGS.length} Blocks</span>
              </h3>

              <div className="space-y-2.5">
                {BUILDINGS.map((bldg) => {
                  const hasActive = activeSession && bldg.classrooms.includes(activeSession.classroom);
                  return (
                    <button
                      key={bldg.id}
                      onClick={() => {
                        setSelectedBuilding(bldg);
                        setSelectedDept(bldg.departments[0] || null);
                        setSelectedClassroom(bldg.classrooms[0] || null);
                      }}
                      className="w-full text-left p-3.5 rounded-2xl border border-gray-200/80 hover:border-blue-300 hover:bg-blue-50/40 transition group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-blue-700">{bldg.code}</span>
                        {hasActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Live Class</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400 font-medium">Idle</span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-gray-900 mt-1 group-hover:text-blue-600 transition">
                        {bldg.name}
                      </div>
                      <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                        {bldg.subtitle}
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] text-gray-400 mt-2">
                        <span>{bldg.departments.length} Departments</span>
                        <span>&bull;</span>
                        <span>{bldg.classrooms.length} Rooms</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Level 2, 3 & 4: Deep Inspection Mode */
            <div className="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-sm space-y-4">
              
              {/* Selected Building Header */}
              <div className="pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-700">{selectedBuilding.code}</span>
                  <button
                    onClick={resetView}
                    className="text-xs text-gray-500 hover:text-gray-900 font-semibold"
                  >
                    Back to All
                  </button>
                </div>
                <h3 className="text-base font-bold text-gray-900 mt-0.5">{selectedBuilding.name}</h3>
              </div>

              {/* Department Tabs */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Departments in this Complex
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedBuilding.departments.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => setSelectedDept(dept)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                        selectedDept === dept
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {dept.replace('Computer Science & Engineering', 'CSE')
                        .replace('Software Engineering', 'SE')
                        .replace('Electronics & Communication Engineering', 'ECE')
                        .replace('Electrical & Electronics Engineering', 'EEE')
                        .replace('Artificial Intelligence & Machine Learning', 'AIML')
                        .replace('Data Science', 'DS')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Classroom Pills */}
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Classrooms & Laboratories
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {selectedBuilding.classrooms.map((room) => {
                    const isLiveHere = activeSession && activeSession.classroom.toLowerCase() === room.toLowerCase();
                    const isSelected = selectedClassroom?.toLowerCase() === room.toLowerCase();
                    return (
                      <button
                        key={room}
                        onClick={() => setSelectedClassroom(room)}
                        className={`p-2 rounded-xl text-left border text-xs font-bold transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm'
                            : 'bg-gray-50 text-gray-800 border-gray-200/80 hover:bg-gray-100'
                        }`}
                      >
                        <span className="font-mono">{room}</span>
                        {isLiveHere && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

                  {/* Deep Classroom Telemetry Card */}
              {selectedClassroom && (() => {
                const currentIntel = classroomsState.find(
                  (c) => c.classroom_id?.toLowerCase() === selectedClassroom.toLowerCase()
                );
                const turnoutPct = classroomSession?.attendance_percentage ?? 0;
                const env = currentIntel?.telemetry;

                return (
                  <div className="pt-3 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-gray-900 font-mono flex items-center space-x-1.5">
                        <span>Room {selectedClassroom}</span>
                        {classroomSession || currentIntel?.has_active_session ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active Class
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
                            No Active Class
                          </span>
                        )}
                      </div>

                      {(classroomSession || currentIntel?.has_active_session) && (
                        <button
                          onClick={() => onOpenLiveCamera?.(selectedClassroom)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center space-x-1"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>View Camera</span>
                        </button>
                      )}
                    </div>

                    {/* Class Info Box */}
                    <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200/80 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-[10px] font-bold text-gray-500 uppercase">Subject</div>
                          <div className="font-bold text-gray-900 truncate">
                            {classroomSession?.subject || currentIntel?.current_subject || 'Free / Unscheduled'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-gray-500 uppercase">Faculty</div>
                          <div className="font-bold text-gray-900 truncate">
                            {classroomSession?.faculty || currentIntel?.faculty_name || 'Not Assigned'}
                          </div>
                        </div>
                      </div>

                      {/* Verified Attendance Metrics & Turnout Gauge */}
                      <div className="pt-2 border-t border-gray-200/60 space-y-2">
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="bg-white p-2 rounded-xl border border-gray-100">
                            <div className="text-[10px] font-bold text-gray-500 uppercase">Roster</div>
                            <div className="text-base font-bold text-gray-900">
                              {classroomSession?.total_students || classroomStudents.length || 0}
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded-xl border border-gray-100">
                            <div className="text-[10px] font-bold text-emerald-700 uppercase">Present</div>
                            <div className="text-base font-bold text-emerald-600">
                              {classroomSession?.present_count || currentIntel?.verified_attendance_count || 0}
                            </div>
                          </div>
                          <div className="bg-white p-2 rounded-xl border border-gray-100">
                            <div className="text-[10px] font-bold text-blue-700 uppercase">Turnout</div>
                            <div className="text-base font-bold text-blue-600">
                              {turnoutPct}%
                            </div>
                          </div>
                        </div>

                        {/* Turnout Gauge Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-gray-500">
                            <span>Attendance Compliance</span>
                            <span className={turnoutPct >= 75 ? 'text-emerald-600' : turnoutPct >= 50 ? 'text-amber-600' : 'text-rose-600'}>
                              {turnoutPct}% (Threshold: 75%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                turnoutPct >= 75 ? 'bg-emerald-500' : turnoutPct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, turnoutPct))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Environmental Telemetry from IoT */}
                    {env && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                          <span>IoT Environmental Telemetry</span>
                          <span className="text-[9px] text-emerald-600 font-mono font-bold">REAL-TIME</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-center font-mono">
                          {env.temperature_c !== undefined && (
                            <div className="bg-white p-1 rounded border border-slate-100">
                              <span className="text-[9px] text-gray-400 block">TEMP</span>
                              <span className="font-bold text-gray-800">{env.temperature_c}°C</span>
                            </div>
                          )}
                          {env.humidity_pct !== undefined && (
                            <div className="bg-white p-1 rounded border border-slate-100">
                              <span className="text-[9px] text-gray-400 block">HUMIDITY</span>
                              <span className="font-bold text-gray-800">{env.humidity_pct}%</span>
                            </div>
                          )}
                          {env.co2_ppm !== undefined && (
                            <div className="bg-white p-1 rounded border border-slate-100">
                              <span className="text-[9px] text-gray-400 block">CO2</span>
                              <span className="font-bold text-gray-800">{env.co2_ppm} ppm</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Hardware Status: Cameras & IoT Devices */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Hardware & Gateway Status
                    </div>

                    {/* Camera */}
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <Camera className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-gray-800">
                          {assignedCameras.length > 0
                            ? `${assignedCameras.length} Camera Connected (${assignedCameras[0].name || 'HD Vision'})`
                            : 'No camera assigned'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        assignedCameras.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {assignedCameras.length > 0 ? 'ONLINE' : 'UNASSIGNED'}
                      </span>
                    </div>

                    {/* IoT Sensor */}
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <Cpu className="w-4 h-4 text-indigo-600" />
                        <span className="font-medium text-gray-800">
                          {assignedDevices.length > 0
                            ? `${assignedDevices[0].device_name} (${assignedDevices[0].device_type})`
                            : 'No sensors connected'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        assignedDevices.length > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {assignedDevices.length > 0 ? assignedDevices[0].status : 'STANDBY'}
                      </span>
                    </div>
                  </div>

                  {/* Recent Verified Events in this Classroom */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Recent Events</span>
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        <span>SSE Stream</span>
                      </span>
                    </div>

                    {recentEvents.filter((e) => !e.classroom || e.classroom.toLowerCase() === selectedClassroom.toLowerCase()).length === 0 ? (
                      <div className="text-xs text-gray-400 py-3 text-center bg-gray-50 rounded-xl">
                        No live events recorded in this period yet.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {recentEvents
                          .filter((e) => !e.classroom || e.classroom.toLowerCase() === selectedClassroom.toLowerCase())
                          .slice(0, 4)
                          .map((evt, idx) => (
                            <div
                              key={evt.eventId || idx}
                              className="text-[11px] p-2 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between"
                            >
                              <span className="font-medium text-gray-800 truncate max-w-[180px]">
                                {evt.payload?.student_name ? `${evt.payload.student_name} verified` : evt.type}
                              </span>
                              <span className="text-[10px] text-gray-400 shrink-0 font-mono">
                                {new Date(evt.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
