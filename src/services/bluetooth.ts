import { DeviceTelemetry, BluetoothCapabilityState } from '../types';

export interface BluetoothSensorReading {
  temperature_c?: number;
  humidity_pct?: number;
  battery_pct?: number;
  rssi_dbm?: number;
  raw_hex?: string;
  received_at: string;
}

export interface BluetoothDeviceConnection {
  device: any;
  server: any;
  name: string;
  id: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'STREAMING';
  lastReading?: BluetoothSensorReading;
  disconnect: () => void;
}

export interface EnvironmentDiagnostics {
  browser: {
    name: string;
    userAgent: string;
    isChromium: boolean;
    isFirefox: boolean;
    isSafari: boolean;
  };
  httpsStatus: {
    isSecureContext: boolean;
    protocol: string;
    isLocalhost: boolean;
  };
  iframeStatus: {
    isInsideIframe: boolean;
    canAccessTopWindow: boolean;
  };
  permissionsPolicy: {
    bluetoothFeatureAllowed: boolean | 'UNKNOWN';
    details: string;
  };
  bluetoothApi: {
    isNavigatorBluetoothPresent: boolean;
    capabilityState: BluetoothCapabilityState;
    statusMessage: string;
  };
  websocketApi: {
    isAvailable: boolean;
  };
  applicationOrigin: string;
  checkedAt: string;
}

export class BluetoothManager {
  private static instance: BluetoothManager;
  private activeConnections: Map<string, BluetoothDeviceConnection> = new Map();

  private constructor() {}

  public static getInstance(): BluetoothManager {
    if (!BluetoothManager.instance) {
      BluetoothManager.instance = new BluetoothManager();
    }
    return BluetoothManager.instance;
  }

  /**
   * Complete runtime diagnostic inspection of the client environment
   */
  public diagnoseEnvironment(): EnvironmentDiagnostics {
    const isClient = typeof window !== 'undefined';
    const isSecureContext = isClient && Boolean(window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isLocalhost = isClient && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const protocol = isClient ? window.location.protocol : 'unknown';
    const origin = isClient ? window.location.origin : '';
    const isInsideIframe = isClient && window.self !== window.top;

    let canAccessTopWindow = false;
    if (isClient) {
      try {
        canAccessTopWindow = window.self === window.top || Boolean(window.top?.location.href);
      } catch (e) {
        canAccessTopWindow = false; // Cross-origin iframe
      }
    }

    const ua = isClient ? navigator.userAgent : '';
    const isChromium = /Chrome|Chromium|Edg/i.test(ua) && !/Firefox/i.test(ua);
    const isFirefox = /Firefox/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua);
    const browserName = isChromium ? 'Chromium / Chrome / Edge' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Standard Web Browser';

    const isNavigatorBluetoothPresent = isClient && typeof navigator !== 'undefined' && 'bluetooth' in navigator;
    const isWebSocketAvailable = isClient && 'WebSocket' in window;

    // Check Permissions Policy if available
    let bluetoothFeatureAllowed: boolean | 'UNKNOWN' = 'UNKNOWN';
    let policyDetails = 'Permissions-Policy API not exposed by browser.';

    if (isClient && (document as any).featurePolicy) {
      try {
        const fp = (document as any).featurePolicy;
        if (typeof fp.allowsFeature === 'function') {
          bluetoothFeatureAllowed = fp.allowsFeature('bluetooth');
          policyDetails = bluetoothFeatureAllowed
            ? 'Permissions-Policy permits "bluetooth" feature.'
            : 'Permissions-Policy explicitly BLOCKS "bluetooth" feature in this frame.';
        }
      } catch (e) {
        policyDetails = 'Could not query featurePolicy: ' + String(e);
      }
    } else if (isInsideIframe) {
      // In cross-origin sandboxed iframes without allow="bluetooth", it is blocked
      policyDetails = 'Embedded iframe context: Browsers block Web Bluetooth unless explicitly enabled via allow="bluetooth" on parent frame.';
    }

    // Determine accurate capability state
    let capabilityState: BluetoothCapabilityState = 'AVAILABLE';
    let statusMessage = 'Web Bluetooth API is available for physical BLE hardware pairing.';

    if (!isSecureContext) {
      capabilityState = 'HTTPS_REQUIRED';
      statusMessage = 'Web Bluetooth requires an HTTPS connection or localhost context.';
    } else if (isInsideIframe && bluetoothFeatureAllowed === false) {
      capabilityState = 'BLOCKED_BY_PERMISSIONS_POLICY';
      statusMessage = 'Web Bluetooth is blocked by the iframe Permissions Policy. Open the application directly in a separate browser tab to use physical Bluetooth.';
    } else if (!isNavigatorBluetoothPresent) {
      if (isFirefox || isSafari) {
        capabilityState = 'BLOCKED_BY_BROWSER';
        statusMessage = `${browserName} does not implement Web Bluetooth. Please use Google Chrome, Microsoft Edge, or a Chromium-based browser.`;
      } else {
        capabilityState = 'UNSUPPORTED';
        statusMessage = 'Web Bluetooth API is not supported on this platform/browser.';
      }
    } else if (isInsideIframe) {
      capabilityState = 'BLOCKED_BY_PERMISSIONS_POLICY';
      statusMessage = 'Embedded iframe environment detected: Web Bluetooth calls are restricted by Permissions Policy in iframe previews. Open ATTENDIQ in a new browser tab for direct BLE connectivity, or use the Wi-Fi IoT Gateway (ESP32).';
    } else {
      capabilityState = 'AVAILABLE';
      statusMessage = 'Web Bluetooth is available for pairing physical Bluetooth 4.0+ BLE sensors.';
    }

    return {
      browser: {
        name: browserName,
        userAgent: ua,
        isChromium,
        isFirefox,
        isSafari,
      },
      httpsStatus: {
        isSecureContext,
        protocol,
        isLocalhost,
      },
      iframeStatus: {
        isInsideIframe,
        canAccessTopWindow,
      },
      permissionsPolicy: {
        bluetoothFeatureAllowed,
        details: policyDetails,
      },
      bluetoothApi: {
        isNavigatorBluetoothPresent,
        capabilityState,
        statusMessage,
      },
      websocketApi: {
        isAvailable: isWebSocketAvailable,
      },
      applicationOrigin: origin,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Quick check for capability state
   */
  public checkCapability(): {
    state: BluetoothCapabilityState;
    message: string;
    isIframe: boolean;
    isSecure: boolean;
  } {
    const diag = this.diagnoseEnvironment();
    return {
      state: diag.bluetoothApi.capabilityState,
      message: diag.bluetoothApi.statusMessage,
      isIframe: diag.iframeStatus.isInsideIframe,
      isSecure: diag.httpsStatus.isSecureContext,
    };
  }

  /**
   * Request user gesture pairing with a physical Bluetooth sensor device.
   * Strictly reads real GATT characteristics; returns NO fake telemetry.
   */
  public async connectSensorDevice(
    onTelemetry?: (telemetry: DeviceTelemetry) => void,
    onStatusChange?: (status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR', errorMsg?: string) => void
  ): Promise<{
    success: boolean;
    connection?: BluetoothDeviceConnection;
    state: BluetoothCapabilityState;
    error?: string;
  }> {
    const diag = this.diagnoseEnvironment();
    if (diag.bluetoothApi.capabilityState !== 'AVAILABLE') {
      return {
        success: false,
        state: diag.bluetoothApi.capabilityState,
        error: diag.bluetoothApi.statusMessage,
      };
    }

    try {
      onStatusChange?.('CONNECTING');

      // Request physical device with standard environmental / battery services and open filters
      const navBluetooth = (navigator as any).bluetooth;
      const device = await navBluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'environmental_sensing',
          'battery_service',
          'device_information',
          0x181a, // Environmental Sensing GATT Service
          0x180f, // Battery GATT Service
          0x180a, // Device Information GATT Service
          '0000181a-0000-1000-8000-00805f9b34fb',
          '0000180f-0000-1000-8000-00805f9b34fb',
          '0000180a-0000-1000-8000-00805f9b34fb',
        ],
      });

      if (!device) {
        onStatusChange?.('DISCONNECTED');
        return {
          success: false,
          state: 'DISCONNECTED',
          error: 'No Bluetooth device selected.',
        };
      }

      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to establish GATT connection with the selected physical Bluetooth peripheral.');
      }

      const connection: BluetoothDeviceConnection = {
        device,
        server,
        name: device.name || 'Physical BLE Sensor',
        id: device.id,
        status: 'CONNECTED',
        disconnect: () => {
          try {
            if (device.gatt?.connected) {
              device.gatt.disconnect();
            }
          } catch (e) {
            console.warn('Error disconnecting BLE device:', e);
          }
        },
      };

      // Listen for physical disconnection
      device.addEventListener('gattserverdisconnected', () => {
        connection.status = 'DISCONNECTED';
        this.activeConnections.delete(device.id);
        onStatusChange?.('DISCONNECTED', 'Physical device disconnected.');
      });

      this.activeConnections.set(device.id, connection);
      onStatusChange?.('CONNECTED');

      // Read real GATT characteristics if available
      this.readGattTelemetry(server, (telemetry) => {
        connection.lastReading = telemetry;
        onTelemetry?.(telemetry);
      });

      return {
        success: true,
        connection,
        state: 'CONNECTED',
      };
    } catch (err: any) {
      console.error('[Web Bluetooth Error]', err);
      const errMsg = err.message || String(err);

      if (
        err.name === 'SecurityError' ||
        errMsg.includes('Permissions Policy') ||
        errMsg.includes('disallowed by permissions policy') ||
        errMsg.includes('feature "bluetooth"')
      ) {
        const errorText =
          'Bluetooth is unavailable in this browser context (disallowed by Permissions Policy / embedded iframe). Open ATTENDIQ in a new browser tab and allow Bluetooth access.';
        onStatusChange?.('ERROR', errorText);
        return {
          success: false,
          state: 'BLOCKED_BY_PERMISSIONS_POLICY',
          error: errorText,
        };
      }

      if (err.name === 'NotAllowedError') {
        const errorText = 'Bluetooth pairing request was cancelled or denied.';
        onStatusChange?.('ERROR', errorText);
        return {
          success: false,
          state: 'PERMISSION_DENIED',
          error: errorText,
        };
      }

      if (err.name === 'NotFoundError') {
        const errorText = 'No Bluetooth device was selected.';
        onStatusChange?.('DISCONNECTED', errorText);
        return {
          success: false,
          state: 'DISCONNECTED',
          error: errorText,
        };
      }

      const errorText = `Bluetooth connection error: ${errMsg}`;
      onStatusChange?.('ERROR', errorText);
      return {
        success: false,
        state: 'ERROR',
        error: errorText,
      };
    }
  }

  /**
   * Reads and subscribes to real GATT characteristics from physical BLE sensor.
   */
  private async readGattTelemetry(
    server: any,
    callback: (telemetry: DeviceTelemetry) => void
  ) {
    try {
      let tempC: number | undefined = undefined;
      let humidityPct: number | undefined = undefined;
      let batteryPct: number | undefined = undefined;

      // 1. Try reading Environmental Sensing GATT (0x181A)
      try {
        const envService =
          (await server.getPrimaryService('environmental_sensing').catch(() => null)) ||
          (await server.getPrimaryService(0x181a).catch(() => null));

        if (envService) {
          // Temperature Characteristic (0x2A6E: 16-bit signed, resolution 0.01 °C)
          const tempChar =
            (await envService.getCharacteristic('temperature').catch(() => null)) ||
            (await envService.getCharacteristic(0x2a6e).catch(() => null));
          if (tempChar) {
            const val = await tempChar.readValue();
            tempC = val.getInt16(0, true) / 100.0;
          }

          // Humidity Characteristic (0x2A6F: 16-bit unsigned, resolution 0.01 %)
          const humChar =
            (await envService.getCharacteristic('humidity').catch(() => null)) ||
            (await envService.getCharacteristic(0x2a6f).catch(() => null));
          if (humChar) {
            const val = await humChar.readValue();
            humidityPct = val.getUint16(0, true) / 100.0;
          }
        }
      } catch (e) {
        // Service not present
      }

      // 2. Try reading Battery GATT (0x180F)
      try {
        const batService =
          (await server.getPrimaryService('battery_service').catch(() => null)) ||
          (await server.getPrimaryService(0x180f).catch(() => null));

        if (batService) {
          const batChar =
            (await batService.getCharacteristic('battery_level').catch(() => null)) ||
            (await batService.getCharacteristic(0x2a19).catch(() => null));
          if (batChar) {
            const val = await batChar.readValue();
            batteryPct = val.getUint8(0);
          }
        }
      } catch (e) {
        // Battery service not present
      }

      const telemetry: DeviceTelemetry = {
        temperature_c: tempC,
        humidity_pct: humidityPct,
        battery_pct: batteryPct,
        received_at: new Date().toISOString(),
      };

      callback(telemetry);
    } catch (e) {
      console.warn('GATT characteristics read error:', e);
    }
  }

  public getActiveConnections(): BluetoothDeviceConnection[] {
    return Array.from(this.activeConnections.values());
  }

  public disconnectAll(): void {
    for (const conn of this.activeConnections.values()) {
      conn.disconnect();
    }
    this.activeConnections.clear();
  }
}

export const bluetoothManager = BluetoothManager.getInstance();
