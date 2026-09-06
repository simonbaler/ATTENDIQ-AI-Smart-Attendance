/**
 * ATTENDIQ AI — Hardware Discovery & Physical Device Integration Service
 * Strictly adheres to real-world browser and operating system APIs.
 * NO simulated devices, NO Math.random() ranges, NO fake telemetry.
 */

import { HardwareCameraDevice, DiscoveredBluetoothDevice, ClassroomAssignment, DiscoveredUsbDevice, WebUsbCapabilityState } from '../types';

export type { HardwareCameraDevice, DiscoveredBluetoothDevice, ClassroomAssignment, DiscoveredUsbDevice, WebUsbCapabilityState };

export interface NetworkConnectionInfo {
  isOnline: boolean;
  effectiveType?: string; // '4g', '3g', '2g', 'slow-2g'
  downlinkSpeedMbps?: number;
  roundTripLatencyMs?: number;
  saveData?: boolean;
  type?: string; // 'wifi', 'cellular', 'ethernet', etc.
  supported: boolean;
}

export class HardwareDiscoveryService {
  private static instance: HardwareDiscoveryService;

  // Active attendance camera selection
  private activeAttendanceDeviceId: string = '';
  private discoveredCameras: HardwareCameraDevice[] = [];
  private discoveredBluetoothDevices: Map<string, DiscoveredBluetoothDevice> = new Map();

  private constructor() {
    // Load persisted attendance camera choice if exists
    if (typeof window !== 'undefined') {
      this.activeAttendanceDeviceId = localStorage.getItem('attendiq_active_camera_id') || '';
    }
  }

  public static getInstance(): HardwareDiscoveryService {
    if (!HardwareDiscoveryService.instance) {
      HardwareDiscoveryService.instance = new HardwareDiscoveryService();
    }
    return HardwareDiscoveryService.instance;
  }

  // =========================================================================
  // 1. USB & HARDWARE VIDEO INPUT ENUMERATION
  // =========================================================================

  /**
   * Checks current camera permission state using Permissions API when available.
   */
  public async getCameraPermissionState(): Promise<'granted' | 'prompt' | 'denied'> {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return 'prompt';
    }
    try {
      const status = await navigator.permissions.query({ name: 'camera' as any });
      return status.state as 'granted' | 'prompt' | 'denied';
    } catch {
      return 'prompt';
    }
  }

  /**
   * Request camera permission from user to unlock real hardware device labels.
   * Browsers deliberately mask device labels until getUserMedia permission is granted.
   */
  public async requestCameraPermission(): Promise<{ granted: boolean; error?: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { granted: false, error: 'MediaDevices API is not supported in this browser.' };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      // Stop temporary track immediately
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true };
    } catch (err: any) {
      return {
        granted: false,
        error: err.name === 'NotAllowedError' ? 'Camera permission was denied by the user.' : err.message,
      };
    }
  }

  /**
   * Truthfully inspect camera label to categorize device type.
   * Never claims USB unless label or device attributes explicitly corroborate it.
   */
  private classifyCameraType(label: string): 'Integrated Laptop Camera' | 'USB Webcam / External Camera' | 'Camera Device' {
    const lower = label.toLowerCase();
    const isUsb =
      lower.includes('usb') ||
      lower.includes('uvc') ||
      lower.includes('webcam') ||
      lower.includes('logitech') ||
      lower.includes('c920') ||
      lower.includes('c922') ||
      lower.includes('c930') ||
      lower.includes('c270') ||
      lower.includes('creative') ||
      lower.includes('brio') ||
      lower.includes('external');

    const isIntegrated =
      lower.includes('integrated') ||
      lower.includes('built-in') ||
      lower.includes('facetime') ||
      lower.includes('internal') ||
      lower.includes('front camera');

    if (isUsb) return 'USB Webcam / External Camera';
    if (isIntegrated) return 'Integrated Laptop Camera';
    return 'Camera Device';
  }

  /**
   * Discover and enumerate all real physical video input devices.
   */
  public async discoverCameras(): Promise<{
    cameras: HardwareCameraDevice[];
    permissionState: 'granted' | 'prompt' | 'denied';
  }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return { cameras: [], permissionState: 'denied' };
    }

    const permissionState = await this.getCameraPermissionState();
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === 'videoinput');

    const result: HardwareCameraDevice[] = videoInputs.map((device, index) => {
      const label = device.label || (permissionState === 'granted' ? `Video Input ${index + 1}` : `Camera Device ${index + 1} (Permission Required to Reveal Label)`);
      const type = this.classifyCameraType(label);
      const isAttendanceSource =
        this.activeAttendanceDeviceId === device.deviceId ||
        (!this.activeAttendanceDeviceId && index === 0);

      return {
        deviceId: device.deviceId,
        label,
        kind: 'videoinput',
        groupId: device.groupId,
        type,
        permissionState,
        isConnected: true,
        isAttendanceSource,
      };
    });

    this.discoveredCameras = result;
    return { cameras: result, permissionState };
  }

  /**
   * Select a physical camera device ID as the active attendance camera source.
   */
  public setActiveAttendanceCamera(deviceId: string): void {
    this.activeAttendanceDeviceId = deviceId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('attendiq_active_camera_id', deviceId);
    }
    this.discoveredCameras.forEach((cam) => {
      cam.isAttendanceSource = cam.deviceId === deviceId;
    });
  }

  public getActiveAttendanceCameraId(): string {
    return this.activeAttendanceDeviceId;
  }

  public getActiveAttendanceCamera(): string {
    return this.activeAttendanceDeviceId;
  }

  /**
   * Measure real resolution and FPS for a specific camera device.
   */
  public async probeCameraStream(
    deviceId: string,
    onProgress?: (info: { width: number; height: number; fps: number }) => void
  ): Promise<{
    stream: MediaStream;
    width: number;
    height: number;
    fps: number;
    stop: () => void;
  }> {
    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings ? track.getSettings() : ({} as any);

    let measuredFps = settings.frameRate || 30;
    const width = settings.width || 1280;
    const height = settings.height || 720;

    // Real FPS counter using frame interval observation
    let frameCount = 0;
    let startTime = performance.now();

    const videoElem = document.createElement('video');
    videoElem.srcObject = stream;
    videoElem.muted = true;
    videoElem.playsInline = true;
    await videoElem.play().catch(() => {});

    let animId: number;
    const countFrames = () => {
      frameCount++;
      const now = performance.now();
      const elapsed = (now - startTime) / 1000;
      if (elapsed >= 1.0) {
        measuredFps = Math.round((frameCount / elapsed) * 10) / 10;
        frameCount = 0;
        startTime = now;
        onProgress?.({ width: videoElem.videoWidth || width, height: videoElem.videoHeight || height, fps: measuredFps });
      }
      animId = requestAnimationFrame(countFrames);
    };
    animId = requestAnimationFrame(countFrames);

    const stop = () => {
      cancelAnimationFrame(animId);
      videoElem.pause();
      videoElem.srcObject = null;
      stream.getTracks().forEach((t) => t.stop());
    };

    return {
      stream,
      width: videoElem.videoWidth || width,
      height: videoElem.videoHeight || height,
      fps: measuredFps,
      stop,
    };
  }

  // =========================================================================
  // 2. REAL WEB BLUETOOTH DISCOVERY & GATT PAIRING
  // =========================================================================

  /**
   * Truthful categorization of Bluetooth peripheral based on name and exposed services.
   */
  public classifyBluetoothType(
    name: string,
    services: string[] = []
  ): DiscoveredBluetoothDevice['type'] {
    const lower = name.toLowerCase();

    if (lower.includes('iphone') || lower.includes('galaxy') || lower.includes('pixel') || lower.includes('phone') || lower.includes('oneplus') || lower.includes('redmi')) {
      return 'Mobile Phone';
    }
    if (lower.includes('cam') || lower.includes('gopro') || lower.includes('insta360')) {
      return 'Camera';
    }
    if (lower.includes('headset') || lower.includes('airpods') || lower.includes('buds') || lower.includes('wh-') || lower.includes('quietcomfort') || lower.includes('audio')) {
      return 'Headset';
    }
    if (lower.includes('speaker') || lower.includes('jbl') || lower.includes('bose') || lower.includes('echo')) {
      return 'Speaker';
    }
    if (lower.includes('beacon') || lower.includes('ibeacon') || lower.includes('eddystone')) {
      return 'BLE Beacon';
    }
    if (lower.includes('esp32') || lower.includes('esp_') || lower.includes('nodemcu')) {
      return 'ESP32';
    }
    if (lower.includes('arduino') || lower.includes('nano') || lower.includes('mkr')) {
      return 'Arduino-compatible BLE device';
    }
    if (
      lower.includes('sensor') ||
      lower.includes('dht') ||
      lower.includes('env') ||
      lower.includes('temp') ||
      services.includes('environmental_sensing') ||
      services.includes('0000181a-0000-1000-8000-00805f9b34fb')
    ) {
      return 'Environmental Sensor';
    }

    return 'Unknown Bluetooth Device';
  }

  /**
   * Approximate distance calculation based on log-distance path loss model:
   * d = 10 ^ ((MeasuredPower - RSSI) / (10 * n))
   * Where MeasuredPower (RSSI at 1m) is approx -59 dBm and path loss exponent n = 2.0.
   * If RSSI is unavailable, returns undefined (strictly no fake range).
   */
  public calculateEstimatedRange(rssi?: number, txPower?: number): string {
    if (rssi === undefined || rssi === null || isNaN(rssi)) {
      return 'Range unavailable';
    }
    const measuredPower = txPower !== undefined && !isNaN(txPower) ? txPower : -59;
    const n = 2.0; // indoor path loss exponent
    const distance = Math.pow(10, (measuredPower - rssi) / (10 * n));
    const rounded = Math.round(distance * 10) / 10;
    return `Estimated: ~${rounded}m`;
  }

  /**
   * Initiates real Web Bluetooth requestDevice() on direct user click.
   * NEVER generates fake devices. NEVER calls requestDevice() automatically.
   */
  public async scanBluetoothDevice(): Promise<{
    success: boolean;
    device?: DiscoveredBluetoothDevice;
    error?: string;
    blockedReason?: 'PERMISSIONS_POLICY' | 'UNSUPPORTED' | 'NOT_ALLOWED' | 'NOT_FOUND' | 'UNKNOWN';
  }> {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      return {
        success: false,
        error: 'Bluetooth is not supported by this browser. Use Google Chrome or Microsoft Edge.',
        blockedReason: 'UNSUPPORTED',
      };
    }

    try {
      const navBluetooth = (navigator as any).bluetooth;

      // Real browser device picker
      const device = await navBluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'environmental_sensing',
          'battery_service',
          'device_information',
          0x181a, // Environmental Sensing
          0x180f, // Battery Service
          0x180a, // Device Information
          '0000181a-0000-1000-8000-00805f9b34fb',
          '0000180f-0000-1000-8000-00805f9b34fb',
          '0000180a-0000-1000-8000-00805f9b34fb',
        ],
      });

      if (!device) {
        return {
          success: false,
          error: 'No Bluetooth device selected.',
          blockedReason: 'NOT_FOUND',
        };
      }

      const exactName =
        device.name && device.name.trim()
          ? device.name.trim()
          : 'Bluetooth device — name unavailable';
      const deviceType = this.classifyBluetoothType(exactName);

      const discovered: DiscoveredBluetoothDevice = {
        id: device.id,
        name: exactName,
        type: deviceType,
        connectionState: 'DISCONNECTED',
        estimatedRange: 'Range unavailable',
        services: [],
        lastSeen: new Date().toISOString(),
        deviceObj: device,
      };

      // Listen for disconnection
      device.addEventListener('gattserverdisconnected', () => {
        discovered.connectionState = 'DISCONNECTED';
      });

      this.discoveredBluetoothDevices.set(device.id, discovered);

      return {
        success: true,
        device: discovered,
      };
    } catch (err: any) {
      console.warn('[Web Bluetooth Discovery Result]', err);
      const errMsg = err.message || String(err);

      if (
        err.name === 'SecurityError' ||
        errMsg.includes('Permissions Policy') ||
        errMsg.includes('permissions policy') ||
        errMsg.includes('feature "bluetooth"')
      ) {
        return {
          success: false,
          error: 'Bluetooth is blocked by the current embedded environment (Permissions Policy). Open ATTENDIQ in a new browser tab.',
          blockedReason: 'PERMISSIONS_POLICY',
        };
      }

      if (err.name === 'NotAllowedError') {
        return {
          success: false,
          error: 'Bluetooth device selection was cancelled or denied.',
          blockedReason: 'NOT_ALLOWED',
        };
      }

      if (err.name === 'NotFoundError') {
        return {
          success: false,
          error: 'No Bluetooth device was chosen from the browser selector.',
          blockedReason: 'NOT_FOUND',
        };
      }

      return {
        success: false,
        error: `Bluetooth request failed: ${errMsg}`,
        blockedReason: 'UNKNOWN',
      };
    }
  }

  /**
   * Connect to real GATT server on a discovered Bluetooth peripheral.
   */
  public async connectBluetoothGatt(
    deviceId: string,
    onBatteryUpdate?: (battery: number) => void
  ): Promise<{
    success: boolean;
    services: string[];
    battery?: number;
    error?: string;
  }> {
    const item = this.discoveredBluetoothDevices.get(deviceId);
    if (!item || !item.deviceObj) {
      return { success: false, services: [], error: 'Bluetooth device reference not found. Please re-scan.' };
    }

    item.connectionState = 'CONNECTING';

    try {
      const server = await item.deviceObj.gatt?.connect();
      if (!server) {
        throw new Error('Could not establish GATT connection.');
      }

      item.gattServer = server;
      item.connectionState = 'CONNECTED';
      item.lastSeen = new Date().toISOString();

      const discoveredServices: string[] = [];
      let batteryPct: number | undefined = undefined;

      // Attempt to inspect primary services if permitted
      try {
        const services = await server.getPrimaryServices().catch(() => []);
        services.forEach((s: any) => discoveredServices.push(s.uuid));
      } catch {
        // Limited service access
      }

      // Read real Battery Characteristic (0x180F -> 0x2A19)
      try {
        const batService =
          (await server.getPrimaryService('battery_service').catch(() => null)) ||
          (await server.getPrimaryService(0x180f).catch(() => null));

        if (batService) {
          discoveredServices.push('battery_service');
          const batChar =
            (await batService.getCharacteristic('battery_level').catch(() => null)) ||
            (await batService.getCharacteristic(0x2a19).catch(() => null));
          if (batChar) {
            const val = await batChar.readValue();
            batteryPct = val.getUint8(0);
            item.battery = batteryPct;
            onBatteryUpdate?.(batteryPct);
          }
        }
      } catch {
        // Battery service not exposed by device
      }

      item.services = discoveredServices;

      return {
        success: true,
        services: discoveredServices,
        battery: batteryPct,
      };
    } catch (err: any) {
      item.connectionState = 'ERROR';
      return {
        success: false,
        services: [],
        error: `GATT Connection failed: ${err.message || String(err)}`,
      };
    }
  }

  /**
   * Disconnect GATT server.
   */
  public disconnectBluetoothGatt(deviceId: string): void {
    const item = this.discoveredBluetoothDevices.get(deviceId);
    if (item && item.gattServer) {
      try {
        if (item.deviceObj?.gatt?.connected) {
          item.deviceObj.gatt.disconnect();
        }
      } catch (e) {
        console.warn('Error disconnecting GATT:', e);
      }
      item.connectionState = 'DISCONNECTED';
      item.gattServer = null;
    }
  }

  public async connectBluetoothDevice(
    deviceId: string,
    onBatteryUpdate?: (battery: number) => void
  ) {
    return this.connectBluetoothGatt(deviceId, onBatteryUpdate);
  }

  public disconnectBluetoothDevice(deviceId: string): void {
    this.disconnectBluetoothGatt(deviceId);
  }

  public getDiscoveredBluetoothDevices(): DiscoveredBluetoothDevice[] {
    return Array.from(this.discoveredBluetoothDevices.values());
  }

  // =========================================================================
  // 3. REAL WEBUSB PERIPHERAL ENUMERATION & INSPECTION
  // =========================================================================

  private discoveredUsbDevices: Map<string, DiscoveredUsbDevice> = new Map();

  /**
   * Determine WebUSB support in current browser and iframe context
   */
  public getUsbCapabilityState(): WebUsbCapabilityState {
    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      return 'UNSUPPORTED';
    }
    try {
      if (window.self !== window.top) {
        // Embedded iframe - check if permissions policy delegates usb
        return 'BLOCKED_BY_IFRAME';
      }
    } catch {
      return 'BLOCKED_BY_IFRAME';
    }
    return 'SUPPORTED';
  }

  /**
   * Enumerate already-paired USB devices
   */
  public async getPairedUsbDevices(): Promise<DiscoveredUsbDevice[]> {
    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      return [];
    }
    try {
      const devices = await (navigator as any).usb.getDevices();
      const list: DiscoveredUsbDevice[] = devices.map((d: any) => ({
        device: d,
        vendorId: d.vendorId,
        productId: d.productId,
        productName: d.productName || `USB Device [0x${d.vendorId.toString(16).padStart(4, '0')}:0x${d.productId.toString(16).padStart(4, '0')}]`,
        manufacturerName: d.manufacturerName || 'Unknown Manufacturer',
        serialNumber: d.serialNumber || undefined,
        opened: d.opened || false,
      }));
      list.forEach((dev) => {
        this.discoveredUsbDevices.set(`${dev.vendorId}_${dev.productId}`, dev);
      });
      return list;
    } catch (err) {
      console.warn('[WebUSB getDevices]', err);
      return [];
    }
  }

  /**
   * Prompt user to pair a real physical USB peripheral via WebUSB
   */
  public async requestUsbDevice(): Promise<{
    success: boolean;
    device?: DiscoveredUsbDevice;
    error?: string;
    blockedReason?: 'PERMISSIONS_POLICY' | 'UNSUPPORTED' | 'NOT_ALLOWED' | 'NOT_FOUND' | 'UNKNOWN';
  }> {
    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      return {
        success: false,
        error: 'WebUSB is not supported by this browser. Use Google Chrome, Microsoft Edge, or Opera on desktop.',
        blockedReason: 'UNSUPPORTED',
      };
    }

    try {
      const d = await (navigator as any).usb.requestDevice({ filters: [] });
      if (!d) {
        return {
          success: false,
          error: 'No USB device was chosen.',
          blockedReason: 'NOT_FOUND',
        };
      }

      const dev: DiscoveredUsbDevice = {
        device: d,
        vendorId: d.vendorId,
        productId: d.productId,
        productName: d.productName || `USB Device [0x${d.vendorId.toString(16).padStart(4, '0')}:0x${d.productId.toString(16).padStart(4, '0')}]`,
        manufacturerName: d.manufacturerName || 'Hardware Peripheral',
        serialNumber: d.serialNumber || undefined,
        opened: d.opened || false,
      };

      this.discoveredUsbDevices.set(`${dev.vendorId}_${dev.productId}`, dev);
      return { success: true, device: dev };
    } catch (err: any) {
      const msg = err.message || String(err);
      if (err.name === 'SecurityError' || msg.includes('Permissions Policy') || msg.includes('permissions policy')) {
        return {
          success: false,
          error: 'WebUSB is blocked by the embedded preview permissions policy. Open ATTENDIQ in a new browser tab for direct USB hardware access.',
          blockedReason: 'PERMISSIONS_POLICY',
        };
      }
      if (err.name === 'NotFoundError') {
        return {
          success: false,
          error: 'No USB device selected from the browser prompt.',
          blockedReason: 'NOT_FOUND',
        };
      }
      if (err.name === 'NotAllowedError') {
        return {
          success: false,
          error: 'USB access prompt was cancelled or denied.',
          blockedReason: 'NOT_ALLOWED',
        };
      }
      return {
        success: false,
        error: `WebUSB error: ${msg}`,
        blockedReason: 'UNKNOWN',
      };
    }
  }

  public getDiscoveredUsbDevices(): DiscoveredUsbDevice[] {
    return Array.from(this.discoveredUsbDevices.values());
  }

  // =========================================================================
  // 3. REAL NETWORK & WI-FI CONNECTION INFORMATION
  // =========================================================================

  /**
   * Inspects real network properties exposed by the browser Network Information API.
   * Browsers do NOT permit scanning raw nearby SSIDs; truthfully exposes what is accessible.
   */
  public getNetworkInfo(): NetworkConnectionInfo {
    const isClient = typeof window !== 'undefined';
    const isOnline = isClient ? navigator.onLine : true;

    if (!isClient) {
      return { isOnline: true, supported: false };
    }

    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (!conn) {
      return {
        isOnline,
        supported: false,
      };
    }

    return {
      isOnline,
      effectiveType: conn.effectiveType, // '4g', '3g', etc.
      downlinkSpeedMbps: conn.downlink,
      roundTripLatencyMs: conn.rtt,
      saveData: conn.saveData,
      type: conn.type,
      supported: true,
    };
  }
}

export const hardwareDiscovery = HardwareDiscoveryService.getInstance();
