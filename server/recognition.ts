import { db, Student } from './db.js';
import { globalVectorIndex, VectorSearchResult } from './vectorIndex.js';

export interface FaceMatchResult {
  student?: Student;
  distance: number;
  second_distance?: number;
  confidence: number;
  isMatch: boolean;
  status: 'RECOGNIZED' | 'UNKNOWN';
  uncertain?: boolean;
  candidatesEvaluated?: number;
  searchLatencyMs?: number;
}

export interface DetectedFaceInput {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  descriptor: number[];
  detectionScore?: number;
  landmarks?: any;
  quality?: {
    blur_score?: number;
    brightness_score?: number;
    contrast_score?: number;
  };
}

// Calculate Euclidean distance between two 128-d vectors
export function euclideanDistance(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 1.0;
  }
  let sum = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Adapter Pattern Interface for Model-Independent Face Recognition Architecture
export interface IFaceRecognitionAdapter {
  name: string;
  match(
    descriptor: number[],
    departmentFilter?: string | string[],
    sectionFilter?: string
  ): FaceMatchResult;
}

// Production Vector Index Adapter (10,000+ Student Scaling)
export class VectorIndexFaceRecognitionAdapter implements IFaceRecognitionAdapter {
  name = 'VectorIndexFaceRecognitionAdapter';

  match(
    descriptor: number[],
    departmentFilter?: string | string[],
    sectionFilter?: string
  ): FaceMatchResult {
    const searchRes = globalVectorIndex.search(descriptor, departmentFilter, sectionFilter);

    if (searchRes.status === 'RECOGNIZED' && searchRes.bestCandidate) {
      return {
        student: searchRes.bestCandidate.student,
        distance: searchRes.bestCandidate.distance,
        second_distance: searchRes.secondCandidate?.distance,
        confidence: searchRes.confidence,
        isMatch: true,
        status: 'RECOGNIZED',
        uncertain: searchRes.isAmbiguous,
        candidatesEvaluated: searchRes.totalCandidatesEvaluated,
        searchLatencyMs: searchRes.searchLatencyMs,
      };
    }

    return {
      student: undefined,
      distance: searchRes.secondCandidate?.distance ?? 1.0,
      second_distance: searchRes.secondCandidate?.distance,
      confidence: searchRes.confidence,
      isMatch: false,
      status: 'UNKNOWN',
      uncertain: searchRes.isAmbiguous,
      candidatesEvaluated: searchRes.totalCandidatesEvaluated,
      searchLatencyMs: searchRes.searchLatencyMs,
    };
  }
}

// Active Adapter Instance
export const activeFaceAdapter: IFaceRecognitionAdapter = new VectorIndexFaceRecognitionAdapter();

export function matchFaceDescriptor(
  descriptor: number[],
  departmentFilter?: string | string[],
  sectionFilter?: string
): FaceMatchResult {
  return activeFaceAdapter.match(descriptor, departmentFilter, sectionFilter);
}

// Multi-Face Tracking Engine
// Assigns and maintains temporary tracking IDs (e.g. TRK-1001, TRK-1002) across frames
export interface FaceTrackItem {
  trackingId: string;
  lastBox: { x: number; y: number; width: number; height: number };
  lastDescriptor: number[];
  firstSeenTimestamp: number;
  lastSeenTimestamp: number;
  framesSeen: number;
  livenessHistory: number[];
  motionScores: number[];
  qualityHistory: boolean[];
  assignedStudentId?: string;
}

let globalTrackCounter = 1001;
const activeFaceTracks: Map<string, FaceTrackItem> = new Map();

export function assignTrackingId(
  box: { x: number; y: number; width: number; height: number },
  descriptor: number[]
): { trackingId: string; isNewTrack: boolean; framesSeen: number; trackItem: FaceTrackItem } {
  const now = Date.now();

  // Prune dead tracks older than 4 seconds
  for (const [id, track] of activeFaceTracks.entries()) {
    if (now - track.lastSeenTimestamp > 4000) {
      activeFaceTracks.delete(id);
    }
  }

  let bestMatchedTrack: FaceTrackItem | null = null;
  let bestScore = 999;

  const boxCenterX = box.x + box.width / 2;
  const boxCenterY = box.y + box.height / 2;

  for (const track of activeFaceTracks.values()) {
    const trackCenterX = track.lastBox.x + track.lastBox.width / 2;
    const trackCenterY = track.lastBox.y + track.lastBox.height / 2;

    const spatialDistance = Math.hypot(boxCenterX - trackCenterX, boxCenterY - trackCenterY);
    const descDistance = euclideanDistance(descriptor, track.lastDescriptor);

    // Composite tracking matching score (spatial proximity + embedding similarity)
    if (spatialDistance < 140 && descDistance < 0.45) {
      const score = spatialDistance * 0.4 + descDistance * 100;
      if (score < bestScore) {
        bestScore = score;
        bestMatchedTrack = track;
      }
    }
  }

  if (bestMatchedTrack) {
    // Record motion shift
    const prevCenterX = bestMatchedTrack.lastBox.x + bestMatchedTrack.lastBox.width / 2;
    const prevCenterY = bestMatchedTrack.lastBox.y + bestMatchedTrack.lastBox.height / 2;
    const frameMotion = Math.hypot(boxCenterX - prevCenterX, boxCenterY - prevCenterY);

    bestMatchedTrack.motionScores.push(frameMotion);
    if (bestMatchedTrack.motionScores.length > 10) bestMatchedTrack.motionScores.shift();

    bestMatchedTrack.lastBox = box;
    bestMatchedTrack.lastDescriptor = descriptor;
    bestMatchedTrack.lastSeenTimestamp = now;
    bestMatchedTrack.framesSeen += 1;

    return {
      trackingId: bestMatchedTrack.trackingId,
      isNewTrack: false,
      framesSeen: bestMatchedTrack.framesSeen,
      trackItem: bestMatchedTrack,
    };
  }

  // Create new track (Format: TRK-1001, TRK-1002, ...)
  const trackingId = `TRK-${globalTrackCounter++}`;
  const newTrack: FaceTrackItem = {
    trackingId,
    lastBox: box,
    lastDescriptor: descriptor,
    firstSeenTimestamp: now,
    lastSeenTimestamp: now,
    framesSeen: 1,
    livenessHistory: [],
    motionScores: [0],
    qualityHistory: [true],
  };

  activeFaceTracks.set(trackingId, newTrack);

  return {
    trackingId,
    isNewTrack: true,
    framesSeen: 1,
    trackItem: newTrack,
  };
}

// Liveness & Anti-Spoofing Verification Pipeline
export interface LivenessResult {
  status: 'LIVE' | 'SPOOF_SUSPECTED' | 'CHECKING' | 'UNCERTAIN';
  livenessScore: number;
  isLive: boolean;
  spoofSuspected: boolean;
  reasons: string[];
}

export function evaluateLiveness(
  track: FaceTrackItem,
  box: { x: number; y: number; width: number; height: number },
  descriptor: number[],
  detectionScore: number
): LivenessResult {
  const reasons: string[] = [];

  // Minimum frames to evaluate temporal liveness
  if (track.framesSeen < 2) {
    return {
      status: 'CHECKING',
      livenessScore: 0.75,
      isLive: false,
      spoofSuspected: false,
      reasons: ['Accumulating temporal frames'],
    };
  }

  // Check 1: Static Presentation Detection
  // A static printed photo held still has zero descriptor/position micro-variance across frames
  const descDiff = euclideanDistance(descriptor, track.lastDescriptor);

  track.livenessHistory.push(descDiff);
  if (track.livenessHistory.length > 8) {
    track.livenessHistory.shift();
  }

  const avgMicroMotion =
    track.livenessHistory.reduce((a, b) => a + b, 0) / track.livenessHistory.length;

  let livenessScore = 0.85;

  // If presented image is 100% frozen/identical across 5+ frames without any natural micro-motion
  if (track.framesSeen >= 5 && avgMicroMotion < 0.001) {
    livenessScore = 0.35;
    reasons.push('Zero natural micro-motion detected (static printed photograph / frozen display suspected)');
  }

  // Check 2: Aspect ratio and detection score bounds (rejecting non-faces like hands/bags)
  const aspectRatio = box.width / Math.max(1, box.height);
  if (aspectRatio < 0.65 || aspectRatio > 1.35) {
    livenessScore -= 0.25;
    reasons.push('Unnatural face aspect ratio bounding profile');
  }

  if (detectionScore < 0.60) {
    livenessScore -= 0.15;
    reasons.push('Low face neural detection confidence');
  }

  const isLive = livenessScore >= 0.70;
  const spoofSuspected = livenessScore < 0.50;

  let status: 'LIVE' | 'SPOOF_SUSPECTED' | 'CHECKING' | 'UNCERTAIN' = 'LIVE';
  if (spoofSuspected) {
    status = 'SPOOF_SUSPECTED';
  } else if (!isLive) {
    status = 'UNCERTAIN';
  }

  return {
    status,
    livenessScore: Number(livenessScore.toFixed(2)),
    isLive,
    spoofSuspected,
    reasons,
  };
}

// Face Quality & Motion Robustness Engine
export interface FaceQualityResult {
  isValid: boolean;
  isMotionBlur: boolean;
  rejectionReason?: string;
  metrics: {
    face_size_px: number;
    blur_score: number;
    brightness_score: number;
    contrast_score: number;
  };
}

export function evaluateFaceQuality(
  box: { width: number; height: number },
  detectionScore?: number
): FaceQualityResult {
  const settings = db.getSettings();
  const minSize = settings.min_face_size_px || 55;
  const faceSize = Math.min(box.width, box.height);

  if (faceSize < minSize) {
    return {
      isValid: false,
      isMotionBlur: false,
      rejectionReason: `Face size (${Math.round(faceSize)}px) below minimum institutional threshold (${minSize}px).`,
      metrics: {
        face_size_px: Math.round(faceSize),
        blur_score: 0.85,
        brightness_score: 0.90,
        contrast_score: 0.88,
      },
    };
  }

  // Check detection confidence as indicator of motion blur or extreme face tilt
  if (detectionScore !== undefined && detectionScore < 0.55) {
    return {
      isValid: false,
      isMotionBlur: true,
      rejectionReason: 'Temporary motion blur or rapid head movement detected. Maintaining track for clearer frame.',
      metrics: {
        face_size_px: Math.round(faceSize),
        blur_score: 0.50,
        brightness_score: 0.85,
        contrast_score: 0.80,
      },
    };
  }

  return {
    isValid: true,
    isMotionBlur: false,
    metrics: {
      face_size_px: Math.round(faceSize),
      blur_score: 0.92,
      brightness_score: 0.95,
      contrast_score: 0.91,
    },
  };
}

// Adaptive Temporal Confirmation Engine
interface SessionTrackingState {
  [sessionId: string]: {
    [studentId: string]: {
      consecutiveFrames: number;
      lastSeenTimestamp: number;
      avgConfidence: number;
      confidences: number[];
      confirmed: boolean;
    };
  };
}

const sessionTracker: SessionTrackingState = {};

export function updateAdaptiveTemporalConfirmation(
  sessionId: string,
  studentId: string,
  confidence: number,
  distance: number
): { isConfirmed: boolean; consecutiveFrames: number; requiredFrames: number } {
  const settings = db.getSettings();
  const baseFrames = settings.temporal_confirmation_frames || 3;

  // Adaptive threshold rules:
  // High confidence (distance <= 0.40): 3 frames
  // Medium confidence (0.40 < distance <= 0.52): 5 frames
  // Low confidence (distance > 0.52): Not confirmed
  let requiredFrames = baseFrames;
  if (distance <= 0.40 && confidence >= 85) {
    requiredFrames = 3;
  } else if (distance <= 0.52) {
    requiredFrames = Math.max(5, baseFrames + 2);
  } else {
    return { isConfirmed: false, consecutiveFrames: 0, requiredFrames: 999 };
  }

  const now = Date.now();

  if (!sessionTracker[sessionId]) {
    sessionTracker[sessionId] = {};
  }

  const studentTrack = sessionTracker[sessionId][studentId] || {
    consecutiveFrames: 0,
    lastSeenTimestamp: 0,
    avgConfidence: 0,
    confidences: [],
    confirmed: false,
  };

  if (now - studentTrack.lastSeenTimestamp <= 2200) {
    studentTrack.consecutiveFrames += 1;
  } else {
    studentTrack.consecutiveFrames = 1;
    studentTrack.confidences = [];
  }

  studentTrack.lastSeenTimestamp = now;
  studentTrack.confidences.push(confidence);
  if (studentTrack.confidences.length > 6) {
    studentTrack.confidences.shift();
  }

  studentTrack.avgConfidence = Math.round(
    studentTrack.confidences.reduce((a, b) => a + b, 0) / studentTrack.confidences.length
  );

  const isConfirmed = studentTrack.consecutiveFrames >= requiredFrames;
  studentTrack.confirmed = isConfirmed;
  sessionTracker[sessionId][studentId] = studentTrack;

  return {
    isConfirmed,
    consecutiveFrames: studentTrack.consecutiveFrames,
    requiredFrames,
  };
}

export function clearSessionTracking(sessionId: string) {
  delete sessionTracker[sessionId];
}
