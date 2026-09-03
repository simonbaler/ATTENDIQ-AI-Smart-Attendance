import express from 'express';
import crypto from 'crypto';
import { db, CampusDevice, DeviceCategory, DeviceProtocol } from '../db.js';
import { authenticateToken, requireAdmin } from './auth.js';
import {
  notifyDeviceTelemetry,
  notifyDeviceStatus,
  recordDeviceEvent,
  getDeviceEvents,
} from '../iotGateway.js';

const router = express.Router();

// GET /api/devices - List all registered devices
router.get('/', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const { category, classroom, status, department } = req.query as Record<string, string>;

    let deptFilter = department;
    if (user.role === 'HOD' && (!deptFilter || deptFilter === 'ALL')) {
      deptFilter = user.department;
    }

    const devices = db.getCampusDevices({
      category,
      classroom,
      status,
      department: deptFilter,
    });

    res.json({
      success: true,
      count: devices.length,
      devices,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/devices/events - Real-time authentic hardware event logs
router.get('/events', authenticateToken, (req, res) => {
  try {
    const events = getDeviceEvents();
    res.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/devices/stats - Device ecosystem statistics
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const deptFilter = user.role === 'HOD' ? user.department : undefined;
    const devices = db.getCampusDevices({ department: deptFilter });

    const total = devices.length;
    const online = devices.filter((d) => d.status === 'ONLINE').length;
    const offline = devices.filter((d) => d.status === 'OFFLINE' || d.status === 'DEGRADED').length;
    const connecting = devices.filter((d) => d.status === 'CONNECTING').length;
    const errors = devices.filter((d) => d.status === 'ERROR').length;

    const categories: Record<string, number> = {};
    devices.forEach((d) => {
      categories[d.category] = (categories[d.category] || 0) + 1;
    });

    res.json({
      success: true,
      stats: {
        total,
        online,
        offline,
        connecting,
        errors,
        categories,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/devices/smart-classroom/correlations - Smart Classroom occupancy & environmental correlation
router.get('/smart-classroom/correlations', authenticateToken, (req, res) => {
  try {
    const correlations = db.getSmartClassroomCorrelations();
    res.json({
      success: true,
      count: correlations.length,
      correlations,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/devices/remote-sensing/weather - Real-world Geospatial & Environmental Context via Open-Meteo
router.get('/remote-sensing/weather', async (req, res) => {
  try {
    const lat = Number(req.query.lat) || 17.4399; // SITS Hyderabad Latitude
    const lon = Number(req.query.lon) || 78.6811; // SITS Hyderabad Longitude

    // Call official Open-Meteo public REST API for live weather, cloud cover, radiation, surface temperature
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,direct_normal_irradiance&hourly=temperature_2m,relative_humidity_2m,uv_index&timezone=auto`;

    // Call Open-Meteo Air Quality API
    const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`;

    const [weatherResp, aqResp] = await Promise.all([
      fetch(weatherUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(airQualityUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);

    if (!weatherResp && !aqResp) {
      return res.status(503).json({
        success: false,
        message: 'External remote sensing weather provider is unreachable.',
      });
    }

    const currentW = weatherResp?.current;
    const currentAQ = aqResp?.current;

    res.json({
      success: true,
      provider: 'Open-Meteo / WMO Standard & Copernicus Atmosphere Reanalysis',
      attribution: 'Weather and air quality data by Open-Meteo.com (CC-BY 4.0)',
      institution_location: {
        campus: 'Siddhartha Institute of Technology and Sciences',
        city: 'Hyderabad, Telangana, India',
        latitude: lat,
        longitude: lon,
        elevation_m: weatherResp?.elevation || 505,
      },
      acquisition_time: currentW?.time ? new Date(currentW.time).toISOString() : new Date().toISOString(),
      data_freshness: 'LIVE_OBSERVATION',
      spatial_resolution: '11 km (0.1° High Resolution Global Grid)',
      weather: currentW
        ? {
            temperature_c: currentW.temperature_2m,
            apparent_temperature_c: currentW.apparent_temperature,
            relative_humidity_pct: currentW.relative_humidity_2m,
            surface_pressure_hpa: currentW.surface_pressure,
            cloud_cover_pct: currentW.cloud_cover,
            wind_speed_kmh: currentW.wind_speed_10m,
            wind_direction_deg: currentW.wind_direction_10m,
            solar_irradiance_wm2: currentW.direct_normal_irradiance,
            precipitation_mm: currentW.precipitation,
            weather_code: currentW.weather_code,
          }
        : null,
      air_quality: currentAQ
        ? {
            us_aqi: currentAQ.us_aqi,
            european_aqi: currentAQ.european_aqi,
            pm2_5_ugm3: currentAQ.pm2_5,
            pm10_ugm3: currentAQ.pm10,
            carbon_monoxide_ugm3: currentAQ.carbon_monoxide,
            nitrogen_dioxide_ugm3: currentAQ.nitrogen_dioxide,
            ozone_ugm3: currentAQ.ozone,
          }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/devices/:id/status - Real device status and last-seen tracking
router.get('/:id/status', (req, res) => {
  try {
    const device = db.getCampusDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }
    const isOnline = device.status === 'ONLINE';
    res.json({
      success: true,
      deviceId: device.id,
      name: device.name,
      status: device.status,
      is_online: isOnline,
      classroom: device.classroom,
      department: device.department,
      last_seen: device.last_seen || device.last_heartbeat || null,
      last_heartbeat: device.last_heartbeat || null,
      server_timestamp: new Date().toISOString(),
      telemetry: device.telemetry || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/devices/:id - Get specific device
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const device = db.getCampusDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }
    res.json({ success: true, device });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/devices/register - Register a new IoT device / gateway
router.post('/register', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const {
      name,
      category,
      device_type,
      classroom,
      building,
      department,
      protocol,
      ip_or_hostname,
      mac_or_uuid,
      capabilities,
    } = req.body;

    if (!name || !category || !classroom) {
      return res.status(400).json({
        success: false,
        message: 'Device name, category, and assigned classroom are required.',
      });
    }

    const deviceToken = `iot_tok_${crypto.randomBytes(16).toString('hex')}`;
    const deviceId = `dev_${category.toLowerCase().replace(/_/g, '')}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const newDevice: CampusDevice = {
      id: deviceId,
      name,
      category: category as DeviceCategory,
      device_type: device_type || 'IoT Node',
      classroom,
      building: building || 'Main Academic Block',
      department: user.role === 'HOD' ? user.department : (department || 'Computer Science & Engineering'),
      protocol: (protocol as DeviceProtocol) || 'HTTPS_REST',
      ip_or_hostname,
      mac_or_uuid,
      device_token: deviceToken,
      status: 'OFFLINE', // Strict anti-fake: starts OFFLINE until real hardware connects
      capabilities: Array.isArray(capabilities) ? capabilities : ['TEMPERATURE', 'HUMIDITY'],
      created_at: new Date().toISOString(),
      registered_by: user.username || user.name || 'ADMIN',
    };

    db.saveCampusDevice(newDevice);

    recordDeviceEvent({
      type: 'DEVICE_REGISTERED',
      device_id: newDevice.id,
      device_name: newDevice.name,
      classroom: newDevice.classroom,
      message: `Registered ${newDevice.category} (${newDevice.name}) for classroom ${newDevice.classroom}.`,
      severity: 'info',
    });

    db.logAudit({
      action: 'DEVICE_REGISTERED',
      performed_by: user.username,
      target_type: 'CAMPUS_DEVICE',
      target_id: newDevice.id,
      details: `Registered ${newDevice.category} (${newDevice.name}) for classroom ${newDevice.classroom}.`,
    });

    res.json({
      success: true,
      message: 'Campus device registered successfully.',
      device: newDevice,
      credentials: {
        device_id: newDevice.id,
        device_token: deviceToken,
        ingestion_url: `/api/devices/${newDevice.id}/telemetry`,
        header_auth: `X-Device-Token: ${deviceToken}`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/devices/:id - Update device configuration
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const existing = db.getCampusDeviceById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const updated: CampusDevice = {
      ...existing,
      ...req.body,
      id: existing.id,
      device_token: existing.device_token, // Preserve secret token
    };

    db.saveCampusDevice(updated);

    db.logAudit({
      action: 'DEVICE_UPDATED',
      performed_by: user.username,
      target_type: 'CAMPUS_DEVICE',
      target_id: updated.id,
      details: `Updated configuration for device ${updated.name}.`,
    });

    res.json({ success: true, message: 'Device updated successfully.', device: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/devices/:id - Remove registered device
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const user = (req as any).user;
    const existing = db.getCampusDeviceById(req.params.id);
    const success = db.deleteCampusDevice(req.params.id);
    if (success) {
      notifyDeviceStatus(req.params.id, 'OFFLINE', existing?.classroom, existing?.department);
      recordDeviceEvent({
        type: 'DEVICE_DISCONNECTED',
        device_id: req.params.id,
        device_name: existing?.name || req.params.id,
        classroom: existing?.classroom || 'Unknown',
        message: `Device ${existing?.name || req.params.id} was deleted from the institutional registry.`,
        severity: 'warning',
      });

      db.logAudit({
        action: 'DEVICE_DELETED',
        performed_by: user.username,
        target_type: 'CAMPUS_DEVICE',
        target_id: req.params.id,
        details: `Deleted campus device ${req.params.id}.`,
      });
      return res.json({ success: true, message: 'Device removed successfully.' });
    }
    res.status(404).json({ success: false, message: 'Device not found.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper function to extract and normalize sensor values without replacing null with 0
function parseSensorValue(val: any): number | null | undefined {
  if (val === null) return null;
  if (val === undefined) return undefined;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

// POST /api/devices/heartbeat - Generic heartbeat endpoint for ESP32 & physical gateways
router.post('/heartbeat', (req, res) => {
  try {
    const { deviceId, device_id, token } = req.body;
    const targetId = deviceId || device_id || req.query.deviceId || req.query.device_id;
    const headerToken =
      req.headers['x-device-token'] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    const targetToken = token || headerToken || req.query.token;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Missing deviceId in request.' });
    }

    const device =
      db.getCampusDeviceById(targetId) ||
      db.getCampusDevices().find((d) => d.name === targetId || d.mac_or_uuid === targetId);
    if (!device) {
      return res.status(404).json({ success: false, message: `Device '${targetId}' not found.` });
    }

    if (device.device_token && device.device_token !== targetToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid device token.' });
    }

    const wasOffline = device.status !== 'ONLINE';
    db.updateDeviceHeartbeat(device.id, 'ONLINE');
    notifyDeviceStatus(device.id, 'ONLINE', device.classroom, device.department);

    if (wasOffline) {
      recordDeviceEvent({
        type: 'DEVICE_ONLINE',
        device_id: device.id,
        device_name: device.name,
        classroom: device.classroom,
        message: `Hardware node ${device.name} in ${device.classroom} is now ONLINE.`,
        severity: 'success',
      });
    }

    recordDeviceEvent({
      type: 'DEVICE_HEARTBEAT',
      device_id: device.id,
      device_name: device.name,
      classroom: device.classroom,
      message: `Heartbeat acknowledged from physical node ${device.name}.`,
      severity: 'info',
    });

    res.json({
      success: true,
      deviceId: device.id,
      status: 'ONLINE',
      server_timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/devices/telemetry - Generic ESP32 / Gateway Ingestion Endpoint
// Supports { deviceId, token, classroom, timestamp, sensors: { temperature_c, humidity_percent, occupancy, air_quality, ... } }
router.post('/telemetry', (req, res) => {
  try {
    const { deviceId, device_id, token, classroom, sensors, timestamp, device_timestamp } = req.body;
    const targetId = deviceId || device_id;
    const authHeader =
      req.headers['x-device-token'] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    const targetToken = token || authHeader || req.query.token;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'Missing deviceId in payload.' });
    }

    const device =
      db.getCampusDeviceById(targetId) ||
      db.getCampusDevices().find((d) => d.name === targetId || d.mac_or_uuid === targetId);
    if (!device) {
      return res.status(404).json({ success: false, message: `Device '${targetId}' not registered.` });
    }

    if (device.device_token && device.device_token !== targetToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid device token.' });
    }

    const s = sensors || req.body;
    const deviceTime = timestamp || device_timestamp || s.timestamp || null;
    const serverTime = new Date().toISOString();

    // Respect null explicitly - null means physical device does not provide that sensor
    const tempC = parseSensorValue(s.temperature_c ?? s.temp);
    const humPct = parseSensorValue(s.humidity_percent ?? s.humidity_pct ?? s.humidity);
    const co2Ppm = parseSensorValue(s.air_quality ?? s.co2_ppm ?? s.co2);
    const occCount = parseSensorValue(s.occupancy ?? s.occupancy_count);
    const noiseDb = parseSensorValue(s.noise_db ?? s.noise);
    const batPct = parseSensorValue(s.battery_percent ?? s.battery_pct ?? s.battery);
    const rssiDbm = parseSensorValue(s.rssi_dbm ?? s.rssi);

    const wasOffline = device.status !== 'ONLINE';

    const result = db.recordDeviceTelemetry(device.id, {
      temperature_c: tempC !== undefined ? tempC : undefined,
      humidity_pct: humPct !== undefined ? humPct : undefined,
      co2_ppm: co2Ppm !== undefined ? co2Ppm : undefined,
      occupancy_count: occCount !== undefined ? occCount : undefined,
      noise_db: noiseDb !== undefined ? noiseDb : undefined,
      battery_pct: batPct !== undefined ? batPct : undefined,
      rssi_dbm: rssiDbm !== undefined ? rssiDbm : undefined,
      device_timestamp: deviceTime,
      server_timestamp: serverTime,
      raw_payload: req.body,
    });

    if (!result.success || !result.device) {
      return res.status(400).json({ success: false, message: result.error });
    }

    if (wasOffline) {
      recordDeviceEvent({
        type: 'DEVICE_ONLINE',
        device_id: device.id,
        device_name: device.name,
        classroom: device.classroom,
        message: `Hardware node ${device.name} transitioned to ONLINE upon receiving real telemetry.`,
        severity: 'success',
      });
    }

    // Broadcast in real-time to dashboard WebSocket clients
    notifyDeviceTelemetry(result.device, result.device.telemetry!);

    recordDeviceEvent({
      type: 'TELEMETRY_RECEIVED',
      device_id: result.device.id,
      device_name: result.device.name,
      classroom: result.device.classroom,
      message: `Physical ESP32 telemetry ingested for ${result.device.classroom}: ${
        tempC !== null && tempC !== undefined ? `${tempC.toFixed(1)}°C, ` : ''
      }${humPct !== null && humPct !== undefined ? `${humPct}% RH, ` : ''}${
        occCount !== null && occCount !== undefined ? `${occCount} occupants, ` : ''
      }${co2Ppm !== null && co2Ppm !== undefined ? `${co2Ppm} ppm CO₂` : ''}`,
      severity: 'info',
      data: {
        ...result.device.telemetry,
        device_timestamp: deviceTime,
        server_timestamp: serverTime,
      },
    });

    res.json({
      success: true,
      message: 'Telemetry received and broadcasted.',
      deviceId: result.device.id,
      classroom: result.device.classroom,
      device_timestamp: deviceTime,
      server_timestamp: serverTime,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/devices/:id/telemetry - Real IoT hardware ingestion endpoint
// Authenticated via X-Device-Token header or Bearer Token or query param
router.post('/:id/telemetry', (req, res) => {
  try {
    const { id } = req.params;
    const token =
      req.headers['x-device-token'] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null) ||
      req.query.token;

    const device = db.getCampusDeviceById(id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    if (device.device_token && device.device_token !== token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid device token.' });
    }

    const {
      temperature_c,
      humidity_pct,
      humidity_percent,
      co2_ppm,
      air_quality,
      pm25,
      pm10,
      voc_ppb,
      noise_db,
      occupancy_count,
      occupancy,
      battery_pct,
      battery_percent,
      rssi_dbm,
      raw_payload,
      sensors,
      timestamp,
      device_timestamp,
    } = req.body;

    const s = sensors || {};
    const deviceTime = timestamp || device_timestamp || s.timestamp || null;
    const serverTime = new Date().toISOString();

    const finalTemp = parseSensorValue(temperature_c ?? s.temperature_c ?? s.temp);
    const finalHum = parseSensorValue(humidity_percent ?? humidity_pct ?? s.humidity_percent ?? s.humidity_pct ?? s.humidity);
    const finalOcc = parseSensorValue(occupancy ?? occupancy_count ?? s.occupancy ?? s.occupancy_count);
    const finalCo2 = parseSensorValue(air_quality ?? co2_ppm ?? s.air_quality ?? s.co2_ppm ?? s.co2);
    const finalNoise = parseSensorValue(noise_db ?? s.noise_db ?? s.noise);
    const finalBat = parseSensorValue(battery_percent ?? battery_pct ?? s.battery_percent ?? s.battery_pct ?? s.battery);
    const finalRssi = parseSensorValue(rssi_dbm ?? s.rssi_dbm ?? s.rssi);

    const wasOffline = device.status !== 'ONLINE';

    const result = db.recordDeviceTelemetry(id, {
      temperature_c: finalTemp !== undefined ? finalTemp : undefined,
      humidity_pct: finalHum !== undefined ? finalHum : undefined,
      co2_ppm: finalCo2 !== undefined ? finalCo2 : undefined,
      pm25: parseSensorValue(pm25 ?? s.pm25) ?? undefined,
      pm10: parseSensorValue(pm10 ?? s.pm10) ?? undefined,
      voc_ppb: parseSensorValue(voc_ppb ?? s.voc_ppb) ?? undefined,
      noise_db: finalNoise !== undefined ? finalNoise : undefined,
      occupancy_count: finalOcc !== undefined ? finalOcc : undefined,
      battery_pct: finalBat !== undefined ? finalBat : undefined,
      rssi_dbm: finalRssi !== undefined ? finalRssi : undefined,
      device_timestamp: deviceTime,
      server_timestamp: serverTime,
      raw_payload,
    });

    if (!result.success || !result.device) {
      return res.status(400).json({ success: false, message: result.error });
    }

    if (wasOffline) {
      recordDeviceEvent({
        type: 'DEVICE_ONLINE',
        device_id: device.id,
        device_name: device.name,
        classroom: device.classroom,
        message: `Physical device ${device.name} is now ONLINE.`,
        severity: 'success',
      });
    }

    // Broadcast in real time
    notifyDeviceTelemetry(result.device, result.device.telemetry!);

    recordDeviceEvent({
      type: 'TELEMETRY_RECEIVED',
      device_id: result.device.id,
      device_name: result.device.name,
      classroom: result.device.classroom,
      message: `Telemetry recorded for ${result.device.name} in ${result.device.classroom}.`,
      severity: 'info',
      data: {
        ...result.device.telemetry,
        device_timestamp: deviceTime,
        server_timestamp: serverTime,
      },
    });

    res.json({
      success: true,
      message: 'Telemetry recorded successfully.',
      deviceId: result.device.id,
      classroom: result.device.classroom,
      device_timestamp: deviceTime,
      server_timestamp: serverTime,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/devices/:id/heartbeat - Real IoT hardware heartbeat
router.post('/:id/heartbeat', (req, res) => {
  try {
    const { id } = req.params;
    const token =
      req.headers['x-device-token'] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null) ||
      req.query.token;

    const device = db.getCampusDeviceById(id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    if (device.device_token && device.device_token !== token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid device token.' });
    }

    const wasOffline = device.status !== 'ONLINE';
    db.updateDeviceHeartbeat(id, 'ONLINE');
    notifyDeviceStatus(id, 'ONLINE', device.classroom, device.department);

    if (wasOffline) {
      recordDeviceEvent({
        type: 'DEVICE_ONLINE',
        device_id: device.id,
        device_name: device.name,
        classroom: device.classroom,
        message: `Hardware node ${device.name} transitioned to ONLINE via heartbeat.`,
        severity: 'success',
      });
    }

    recordDeviceEvent({
      type: 'DEVICE_HEARTBEAT',
      device_id: device.id,
      device_name: device.name,
      classroom: device.classroom,
      message: `Heartbeat acknowledged from ${device.name}.`,
      severity: 'info',
    });

    res.json({
      success: true,
      deviceId: device.id,
      status: 'ONLINE',
      server_timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
