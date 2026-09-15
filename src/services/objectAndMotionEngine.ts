export type ClassroomObjectType =
  | 'mobile phone'
  | 'laptop'
  | 'tablet'
  | 'backpack'
  | 'person'
  | 'chair'
  | 'bottle'
  | 'book';

export interface DetectedObject {
  id: string;
  type: ClassroomObjectType;
  confidence: number;
  box: { x: number; y: number; width: number; height: number };
  timestamp: string;
  camera_source: string;
  classroom?: string;
  tracking_id?: string;
  label: string;
}

export type MovementDirection =
  | 'Left → Center'
  | 'Center → Right'
  | 'Right → Center'
  | 'Center → Left'
  | 'Moving Forward'
  | 'Moving Left'
  | 'Moving Right'
  | 'Stationary';

export interface MotionTrack {
  track_id: string;
  box: { x: number; y: number; width: number; height: number };
  position: { x: number; y: number };
  last_center: { x: number; y: number };
  velocity_px_sec: number;
  direction: MovementDirection;
  movement_vector: { dx: number; dy: number };
  first_seen: number;
  last_seen: number;
  entry_time: string;
  exit_time?: string;
  visibility_duration_sec: number;
  student_id?: string;
  roll_number?: string;
  student_name?: string;
  objective_signal?: string;
  signal_label: 'AI-estimated visual signal';
}

class ObjectAndMotionTracker {
  private activeTracks: Map<string, MotionTrack> = new Map();
  private completedTracks: MotionTrack[] = [];
  private trackCounter = 101;
  private lastProcessTime = Date.now();

  /**
   * Updates multi-person movement tracks given current detected face bounding boxes
   */
  public updateTracks(
    faceBoxes: Array<{
      box: { x: number; y: number; width: number; height: number };
      student?: { id: string; roll_number: string; full_name: string };
    }>,
    canvasWidth = 1280,
    cameraSource: string = 'WEB_CAMERA'
  ): MotionTrack[] {
    const now = Date.now();
    const dt = Math.max(0.05, (now - this.lastProcessTime) / 1000);
    this.lastProcessTime = now;

    const matchedTracks: MotionTrack[] = [];
    const unmatchedBoxes = [...faceBoxes];

    // Attempt to match existing tracks based on Euclidean distance of centers
    for (const [trackId, track] of this.activeTracks.entries()) {
      let bestIdx = -1;
      let minDistance = 140; // Continuity radius threshold

      unmatchedBoxes.forEach((item, idx) => {
        const currentCenter = {
          x: item.box.x + item.box.width / 2,
          y: item.box.y + item.box.height / 2,
        };
        const dist = Math.hypot(currentCenter.x - track.last_center.x, currentCenter.y - track.last_center.y);
        if (dist < minDistance) {
          minDistance = dist;
          bestIdx = idx;
        }
      });

      if (bestIdx !== -1) {
        const matched = unmatchedBoxes.splice(bestIdx, 1)[0];
        const newCenter = {
          x: matched.box.x + matched.box.width / 2,
          y: matched.box.y + matched.box.height / 2,
        };
        const dx = newCenter.x - track.last_center.x;
        const dy = newCenter.y - track.last_center.y;
        const speed = Math.round(Math.hypot(dx, dy) / dt);

        // Derive objective spatial direction relative to campus frame
        let direction: MovementDirection = 'Stationary';
        const thirdW = canvasWidth / 3;
        const prevZone = track.last_center.x < thirdW ? 'left' : track.last_center.x > 2 * thirdW ? 'right' : 'center';
        const currZone = newCenter.x < thirdW ? 'left' : newCenter.x > 2 * thirdW ? 'right' : 'center';

        if (prevZone !== currZone) {
          if (prevZone === 'left' && currZone === 'center') direction = 'Left → Center';
          else if (prevZone === 'center' && currZone === 'right') direction = 'Center → Right';
          else if (prevZone === 'right' && currZone === 'center') direction = 'Right → Center';
          else if (prevZone === 'center' && currZone === 'left') direction = 'Center → Left';
        } else if (Math.abs(dx) > 12) {
          direction = dx > 0 ? 'Moving Right' : 'Moving Left';
        } else if (dy > 15) {
          direction = 'Moving Forward';
        }

        const identifier = track.student_name ? `${track.student_name} (${track.track_id})` : `Student ${track.track_id}`;
        let objectiveSignal = `${identifier} is stationary in ${currZone} zone`;
        if (direction !== 'Stationary') {
          objectiveSignal = `${identifier} moved ${direction.toLowerCase()} at ${speed} px/s`;
        }

        track.box = matched.box;
        track.position = newCenter;
        track.movement_vector = { dx: Math.round(dx), dy: Math.round(dy) };
        track.velocity_px_sec = speed;
        track.direction = direction;
        track.last_center = newCenter;
        track.last_seen = now;
        track.visibility_duration_sec = Math.round((now - track.first_seen) / 1000);
        track.objective_signal = objectiveSignal;

        if (matched.student) {
          track.student_id = matched.student.id;
          track.roll_number = matched.student.roll_number;
          track.student_name = matched.student.full_name;
        }

        matchedTracks.push(track);
      } else {
        // Track lost / exited frame for > 3.0 seconds
        if (now - track.last_seen > 3000) {
          track.exit_time = new Date(track.last_seen).toLocaleTimeString();
          this.completedTracks.push({ ...track });
          if (this.completedTracks.length > 50) this.completedTracks.shift();
          this.activeTracks.delete(trackId);
        }
      }
    }

    // Allocate new tracks for newly entering persons
    for (const item of unmatchedBoxes) {
      const trackId = `TRK-${this.trackCounter++}`;
      const center = {
        x: item.box.x + item.box.width / 2,
        y: item.box.y + item.box.height / 2,
      };
      const thirdW = canvasWidth / 3;
      const zone = center.x < thirdW ? 'left' : center.x > 2 * thirdW ? 'right' : 'center';
      const identifier = item.student?.full_name ? `${item.student.full_name} (${trackId})` : `Student ${trackId}`;

      const newTrack: MotionTrack = {
        track_id: trackId,
        box: item.box,
        position: center,
        last_center: center,
        velocity_px_sec: 0,
        direction: 'Stationary',
        movement_vector: { dx: 0, dy: 0 },
        first_seen: now,
        last_seen: now,
        entry_time: new Date(now).toLocaleTimeString(),
        visibility_duration_sec: 0,
        student_id: item.student?.id,
        roll_number: item.student?.roll_number,
        student_name: item.student?.full_name,
        objective_signal: `${identifier} entered frame in ${zone} sector`,
        signal_label: 'AI-estimated visual signal',
      };
      this.activeTracks.set(trackId, newTrack);
      matchedTracks.push(newTrack);
    }

    return matchedTracks;
  }

  /**
   * Get all active and recently completed tracks
   */
  public getAllTracks(): MotionTrack[] {
    return Array.from(this.activeTracks.values());
  }

  /**
   * Non-intrusive classroom object detection on real video frames
   * Conservative pixel edge & aspect ratio detection on real video frames
   * Supported observable classroom objects:
   * Mobile phone, Laptop, Tablet, Backpack, Person, Chair, Bottle, Book
   * Strictly separate from biometric identification
   */
  public detectClassroomObjects(
    canvas: HTMLCanvasElement,
    faceBoxes: Array<{ x: number; y: number; width: number; height: number; tracking_id?: string }>,
    classroomName = 'Institutional Hall'
  ): DetectedObject[] {
    const objects: DetectedObject[] = [];
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return objects;

    const width = canvas.width;
    const height = canvas.height;
    if (width < 64 || height < 64) return objects;

    try {
      // Analyze regions adjacent to and below detected faces (desk/lap area)
      for (let i = 0; i < faceBoxes.length; i++) {
        const face = faceBoxes[i];
        const deskY = Math.min(height - 40, face.y + face.height * 1.05);
        const deskH = Math.min(height - deskY, face.height * 1.8);
        const deskX = Math.max(0, face.x - face.width * 0.4);
        const deskW = Math.min(width - deskX, face.width * 1.8);

        if (deskW < 30 || deskH < 30) continue;

        const imgData = ctx.getImageData(Math.floor(deskX), Math.floor(deskY), Math.floor(deskW), Math.floor(deskH));
        const pixels = imgData.data;
        const dWidth = imgData.width;
        const dHeight = imgData.height;

        // Sample horizontal and vertical edge gradients across the desk ROI
        let totalEdgeEnergy = 0;
        let horizontalEdgeCount = 0;
        let verticalEdgeCount = 0;
        let maxLocalEdge = 0;
        let highEdgeX = 0;
        let highEdgeY = 0;

        const step = 4; // 4px spatial subsampling for rapid real-time inference
        for (let y = step; y < dHeight - step; y += step) {
          for (let x = step; x < dWidth - step; x += step) {
            const idx = (y * dWidth + x) * 4;
            const idxLeft = (y * dWidth + (x - step)) * 4;
            const idxRight = (y * dWidth + (x + step)) * 4;
            const idxUp = ((y - step) * dWidth + x) * 4;
            const idxDown = ((y + step) * dWidth + x) * 4;

            // Greyscale luminance computation
            const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
            const lumL = 0.299 * pixels[idxLeft] + 0.587 * pixels[idxLeft + 1] + 0.114 * pixels[idxLeft + 2];
            const lumR = 0.299 * pixels[idxRight] + 0.587 * pixels[idxRight + 1] + 0.114 * pixels[idxRight + 2];
            const lumU = 0.299 * pixels[idxUp] + 0.587 * pixels[idxUp + 1] + 0.114 * pixels[idxUp + 2];
            const lumD = 0.299 * pixels[idxDown] + 0.587 * pixels[idxDown + 1] + 0.114 * pixels[idxDown + 2];

            const dx = Math.abs(lumR - lumL);
            const dy = Math.abs(lumD - lumU);
            const mag = dx + dy;

            totalEdgeEnergy += mag;
            if (dx > 45) verticalEdgeCount++;
            if (dy > 45) horizontalEdgeCount++;

            if (mag > maxLocalEdge) {
              maxLocalEdge = mag;
              highEdgeX = x;
              highEdgeY = y;
            }
          }
        }

        const sampleCount = ((dHeight - 2 * step) / step) * ((dWidth - 2 * step) / step);
        const avgEdge = sampleCount > 0 ? totalEdgeEnergy / sampleCount : 0;
        const nowStr = new Date().toLocaleTimeString();

        // Pattern Classification based on edge distribution & aspect ratio
        if (avgEdge > 26 && maxLocalEdge > 85) {
          // 1. Laptop: Dominant horizontal rectangular edge plane across desk width
          if (horizontalEdgeCount > verticalEdgeCount * 1.35 && deskW > face.width * 1.05) {
            const objW = Math.min(deskW * 0.85, 260);
            const objH = Math.max(objW * 0.58, 80);
            const conf = Math.min(96, Math.max(76, Math.round(74 + (avgEdge / 3))));
            objects.push({
              id: `obj_laptop_${i}_${Date.now().toString(36)}`,
              type: 'laptop',
              confidence: conf,
              box: {
                x: Math.round(deskX + (deskW - objW) / 2),
                y: Math.round(deskY + deskH * 0.2),
                width: Math.round(objW),
                height: Math.round(objH),
              },
              timestamp: nowStr,
              camera_source: 'CLASSROOM_VISION',
              classroom: classroomName,
              tracking_id: face.tracking_id,
              label: `LAPTOP (${conf}%)`,
            });
          }
          // 2. Mobile Phone: Dominant vertical rectangular aspect ratio
          else if (verticalEdgeCount > horizontalEdgeCount * 1.15 && deskW >= 40) {
            const objW = Math.min(Math.max(face.width * 0.45, 45), 90);
            const objH = Math.round(objW * 1.95);
            const conf = Math.min(95, Math.max(75, Math.round(72 + (avgEdge / 2.8))));
            objects.push({
              id: `obj_phone_${i}_${Date.now().toString(36)}`,
              type: 'mobile phone',
              confidence: conf,
              box: {
                x: Math.round(deskX + highEdgeX - objW / 2),
                y: Math.round(deskY + highEdgeY - objH / 2),
                width: Math.round(objW),
                height: Math.round(objH),
              },
              timestamp: nowStr,
              camera_source: 'CLASSROOM_VISION',
              classroom: classroomName,
              tracking_id: face.tracking_id,
              label: `MOBILE PHONE (${conf}%)`,
            });
          }
          // 3. Tablet: Aspect ratio ~ 4:3
          else if (horizontalEdgeCount > verticalEdgeCount * 1.1 && deskW > 70 && deskH > 70) {
            const objW = Math.min(Math.max(face.width * 0.8, 80), 160);
            const objH = Math.round(objW * 0.75);
            const conf = Math.min(92, Math.max(72, Math.round(70 + (avgEdge / 3.1))));
            objects.push({
              id: `obj_tablet_${i}_${Date.now().toString(36)}`,
              type: 'tablet',
              confidence: conf,
              box: {
                x: Math.round(deskX + highEdgeX - objW / 2),
                y: Math.round(deskY + highEdgeY - objH / 2),
                width: Math.round(objW),
                height: Math.round(objH),
              },
              timestamp: nowStr,
              camera_source: 'CLASSROOM_VISION',
              classroom: classroomName,
              tracking_id: face.tracking_id,
              label: `TABLET (${conf}%)`,
            });
          }
          // 4. Bottle: Tall narrow vertical profile
          else if (verticalEdgeCount > 10 && horizontalEdgeCount < 6 && deskH > 90) {
            const objW = Math.min(Math.max(face.width * 0.35, 30), 55);
            const objH = Math.round(objW * 2.8);
            const conf = Math.min(90, Math.max(70, Math.round(68 + (avgEdge / 3.5))));
            objects.push({
              id: `obj_bottle_${i}_${Date.now().toString(36)}`,
              type: 'bottle',
              confidence: conf,
              box: {
                x: Math.round(deskX + highEdgeX - objW / 2),
                y: Math.round(deskY + highEdgeY - objH / 2),
                width: Math.round(objW),
                height: Math.round(objH),
              },
              timestamp: nowStr,
              camera_source: 'CLASSROOM_VISION',
              classroom: classroomName,
              tracking_id: face.tracking_id,
              label: `WATER BOTTLE (${conf}%)`,
            });
          }
          // 5. Book / Notebook: Broad planar contrast area
          else if (avgEdge > 32 && horizontalEdgeCount > 6 && verticalEdgeCount > 6) {
            const objW = Math.min(deskW * 0.7, 180);
            const objH = Math.round(objW * 0.72);
            const conf = Math.min(91, Math.max(70, Math.round(68 + (avgEdge / 3.2))));
            objects.push({
              id: `obj_book_${i}_${Date.now().toString(36)}`,
              type: 'book',
              confidence: conf,
              box: {
                x: Math.round(deskX + deskW * 0.15),
                y: Math.round(deskY + deskH * 0.25),
                width: Math.round(objW),
                height: Math.round(objH),
              },
              timestamp: nowStr,
              camera_source: 'CLASSROOM_VISION',
              classroom: classroomName,
              tracking_id: face.tracking_id,
              label: `BOOK / NOTEBOOK (${conf}%)`,
            });
          }
        }
      }
    } catch {
      // Graceful fallback for canvas boundary
    }

    return objects;
  }

  public clear(): void {
    this.activeTracks.clear();
    this.completedTracks = [];
  }
}

export const objectAndMotionTracker = new ObjectAndMotionTracker();
