# ATTENDIQ AI: Browser Hardware Access & Limitation Architecture

This document provides definitive technical documentation regarding browser-level security policies, sandbox limitations, Permissions Policy enforcement, and hardware integration protocols for **ATTENDIQ AI**.

---

## 1. Executive Summary & Truth Policy Guarantee

ATTENDIQ AI is designed for institutional deployment in smart university classrooms. Unlike prototype or demonstrator systems:
- **No Synthetic Telemetry**: The system never generates simulated devices, random temperature readings (`Math.random()`), or fake RSSI/battery values.
- **Hardware Isolation**: Physical hardware discovery and sensor monitoring are strictly decoupled from the biometric facial recognition pipeline.
- **Strict Browser Transparency**: If a hardware feature (such as Web Bluetooth or WebRTC camera ingestion) is restricted by browser security policies or cross-origin iframe sandboxes, the application explicitly surfaces the exact underlying cause and provides actionable resolution steps (such as opening the app in a dedicated top-level window).

---

## 2. Browser Sandbox & Permissions Policy Matrix

Modern web browsers enforce strict security controls around peripheral hardware to prevent fingerprinting and unauthorized surveillance.

| Hardware Feature | Browser API | Permissions Policy Directive | Secure Context (HTTPS) Required? | User Gesture Required? | Iframe Delegation Support |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Web Bluetooth (BLE)** | `navigator.bluetooth` | `bluetooth` | **YES** (`https://` or `localhost`) | **YES** (Direct click/tap) | Restrictive (`allow="bluetooth"`) |
| **USB / Integrated Cameras** | `navigator.mediaDevices.getUserMedia` | `camera` | **YES** (`https://` or `localhost`) | **YES** (Initial prompt) | Delegated (`allow="camera"`) |
| **Audio Microphones** | `navigator.mediaDevices.getUserMedia` | `microphone` | **YES** (`https://` or `localhost`) | **YES** (Initial prompt) | Delegated (`allow="microphone"`) |
| **WebRTC Remote Mobile Camera** | `RTCPeerConnection` | N/A | **YES** | User triggers connection | Supported via WebSockets |
| **ESP32 IoT Gateway (LAN/WAN)** | WebSocket / REST | N/A | Mixed-content rules apply | No | Standard cross-origin rules |

---

## 3. Web Bluetooth API (`navigator.bluetooth`) Deep-Dive

### 3.1 Strict Security Constraints
1. **Top-Level Browsing Context**:
   - Web Bluetooth calls (`navigator.bluetooth.requestDevice`) in most Chromium browsers (Chrome, Edge, Opera, Brave) are **blocked inside cross-origin `<iframe>` elements by default**.
   - If executed inside an iframe without explicit parent permission delegation, the browser throws:
     `SecurityError: Failed to execute 'requestDevice' on 'Bluetooth': Access to the feature "bluetooth" is disallowed by permissions policy.`
   - **ATTENDIQ Resolution**: ATTENDIQ detects when it is running inside an iframe and surfaces a prominent `"Open in New Window"` action button. Running in a top-level tab grants direct access to the native Bluetooth pairing prompt.

2. **Transient User Activation**:
   - Web Bluetooth discovery cannot be triggered programmatically on page load or on an automated timer.
   - It **must** originate directly from an explicit user gesture (e.g. clicking the `"Scan Bluetooth"` button).

3. **OS-Level Driver & Platform Support**:
   - **macOS / Android**: Supported out-of-the-box in Chrome and Edge.
   - **Windows 10/11**: Requires Bluetooth 4.0+ hardware and Windows Bluetooth services enabled.
   - **Linux**: Requires BlueZ 5.41+ and experimental flags enabled in Chrome (`chrome://flags/#enable-web-bluetooth-new-permissions-backend`).
   - **iOS / Safari**: Web Bluetooth is **not** supported by Apple Safari. On iOS devices, the ATTENDIQ WebRTC Mobile Camera stream is recommended instead.

---

## 4. Camera Ingestion & Device Enumeration

### 4.1 Device Label Masking (`enumerateDevices`)
- To prevent browser fingerprinting, `navigator.mediaDevices.enumerateDevices()` returns masked labels (e.g. empty strings or generic IDs) until the user grants explicit camera permission via `getUserMedia()`.
- Once permission is approved, ATTENDIQ accurately enumerates all physical USB webcams, integrated laptop sensors, and external capture cards with full device names and unique hardware IDs.

### 4.2 Hardware Device Selection & Constraints
- ATTENDIQ allows administrators and faculty to bind a specific classroom attendance camera using exact hardware device IDs:
  ```typescript
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: { exact: selectedCameraDeviceId },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 }
    },
    audio: false
  });
  ```
- The selected camera preference is persisted locally in `localStorage` under `attendiq_active_camera_id` so the assigned camera is retained across classroom sessions.

---

## 5. WebRTC Mobile Camera Pairing Architecture

For lecture halls where a dedicated USB camera is not installed, ATTENDIQ provides an ephemeral, zero-install WebRTC pairing mechanism:
1. **Desktop Host**: Generates an encrypted 6-character ephemeral pairing token and an accompanying QR code.
2. **Mobile Device**: The lecturer scans the QR code with their smartphone.
3. **Peer-to-Peer Mesh**:
   - Signaling is negotiated via the ATTENDIQ backend signaling server over secure WebSockets (`/api/webrtc/ws`).
   - Video is streamed peer-to-peer using H.264 / VP8 video codecs with STUN fallback (`stun:stun.l.google.com:19302`).
   - No video frames are stored on intermediate servers; face descriptors (128-D vectors) are extracted directly in memory on the desktop terminal.

---

## 6. ESP32 & IoT Classroom Gateways

For ambient classroom intelligence (temperature, relative humidity, CO2 levels, and occupancy verification):
- **ESP32 Microcontrollers** communicate directly with the ATTENDIQ backend over mutual-authenticated REST/HTTPS (`/api/iot/telemetry`) or persistent WebSockets.
- If a sensor node disconnects or exhausts its battery, the status is immediately marked as **OFFLINE**. No artificial numbers are invented or interpolated.

---

## 7. Troubleshooting Common Hardware Issues

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| `"Disallowed by permissions policy"` on Bluetooth scan | App running inside an iframe (e.g., development preview or LMS wrapper) | Click **"Open in New Window"** to execute Bluetooth pairing in a top-level tab. |
| Camera dropdown shows generic "Camera 1", "Camera 2" | Camera permissions not yet granted | Click **"Scan USB Cameras"** or start a session to trigger the browser permission prompt. |
| WebRTC QR Code cannot be reached by phone | Smartphone and desktop are on isolated subnets or using `localhost` origin | Use the in-app LAN IP dropdown or enter the desktop's Wi-Fi IP address in the pairing modal. |
| Bluetooth scan button does not open system prompt | Browser does not support Web Bluetooth or running on non-secure HTTP | Use Google Chrome or Microsoft Edge on a secure HTTPS domain. |

---

*ATTENDIQ AI — Institutional Attendance & Hardware Intelligence Platform*
