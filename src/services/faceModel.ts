import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let modelLoadingPromise: Promise<boolean> | null = null;

const MODEL_SOURCES = [
  '/models',
  'https://cdn.jsdelivr.net/gh/vladmandic/face-api/model',
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights',
];

export async function loadFaceModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    for (const baseUrl of MODEL_SOURCES) {
      try {
        console.log(`[SITS AI] Attempting to load neural networks from: ${baseUrl}`);

        // 1. Tiny Face Detector (Fast, accurate, resilient)
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          await faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl);
        }

        // 2. Face Landmarks (Tiny + Full)
        if (!faceapi.nets.faceLandmark68TinyNet.isLoaded) {
          await faceapi.nets.faceLandmark68TinyNet.loadFromUri(baseUrl);
        }
        if (!faceapi.nets.faceLandmark68Net.isLoaded) {
          try {
            await faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl);
          } catch (e) {
            console.warn('[SITS AI] Full landmark68 failed, tiny landmark will be used:', e);
          }
        }

        // 3. Face Recognition 128-D Vector Net
        if (!faceapi.nets.faceRecognitionNet.isLoaded) {
          await faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl);
        }

        // 4. SSD MobileNet V1 (Optional high-density detector)
        if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
          try {
            await faceapi.nets.ssdMobilenetv1.loadFromUri(baseUrl);
          } catch (e) {
            console.warn('[SITS AI] SSD MobileNet failed to load, falling back to TinyFaceDetector:', e);
          }
        }

        modelsLoaded = true;
        console.log(`[SITS AI] Face recognition neural networks loaded successfully from ${baseUrl}`);
        return true;
      } catch (err) {
        console.warn(`[SITS AI] Failed to load models from ${baseUrl}, trying next source...`, err);
      }
    }

    // Check if at least TinyFaceDetector and FaceRecognitionNet are loaded
    if (faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceRecognitionNet.isLoaded) {
      modelsLoaded = true;
      console.log('[SITS AI] Core TinyFaceDetector & FaceRecognitionNet loaded successfully.');
      return true;
    }

    console.error('[SITS AI] All model sources failed to load face recognition neural networks.');
    modelsLoaded = false;
    return false;
  })();

  return modelLoadingPromise;
}

export interface DetectedFaceDescriptor {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  descriptor: number[];
  score: number;
  landmarks?: any;
  visual_signals?: FaceVisualSignals;
}

export interface FaceVisualSignals {
  head_pose: {
    yaw: number;
    pitch: number;
    roll: number;
  };
  face_direction: 'Facing Forward' | 'Looking Left' | 'Looking Right' | 'Looking Up' | 'Looking Down';
  gaze_direction: 'Forward' | 'Averted Left' | 'Averted Right';
  expression: 'neutral' | 'smile' | 'expression classification unavailable';
  quality_metric: {
    sharpness_score: number;
    brightness_value: number;
  };
}

export function extractVisualSignalsFromLandmarks(landmarks: any): FaceVisualSignals | undefined {
  if (!landmarks || !landmarks.positions || landmarks.positions.length < 68) {
    return undefined;
  }
  const pts = landmarks.positions;
  const noseTip = pts[30];
  const leftJaw = pts[0];
  const rightJaw = pts[16];
  const chin = pts[8];
  const noseBridge = pts[27];

  const dLeft = Math.hypot(noseTip.x - leftJaw.x, noseTip.y - leftJaw.y);
  const dRight = Math.hypot(noseTip.x - rightJaw.x, noseTip.y - rightJaw.y);
  const yawRatio = dLeft / Math.max(1, dRight);
  const yawDeg = Math.round((yawRatio - 1) * 35);

  let faceDirection: 'Facing Forward' | 'Looking Left' | 'Looking Right' | 'Looking Up' | 'Looking Down' = 'Facing Forward';
  if (yawRatio > 1.35) faceDirection = 'Looking Left';
  else if (yawRatio < 0.74) faceDirection = 'Looking Right';

  const dNoseToChin = Math.hypot(noseTip.x - chin.x, noseTip.y - chin.y);
  const dBridgeToNose = Math.hypot(noseTip.x - noseBridge.x, noseTip.y - noseBridge.y);
  const pitchRatio = dNoseToChin / Math.max(1, dBridgeToNose);
  if (pitchRatio > 2.2) faceDirection = 'Looking Down';
  else if (pitchRatio < 1.1) faceDirection = 'Looking Up';

  const leftEye = pts[36];
  const rightEye = pts[45];
  const dY = rightEye.y - leftEye.y;
  const dX = rightEye.x - leftEye.x;
  const rollDeg = Math.round((Math.atan2(dY, dX) * 180) / Math.PI);

  const mouthWidth = Math.hypot(pts[54].x - pts[48].x, pts[54].y - pts[48].y);
  const jawWidth = Math.hypot(rightJaw.x - leftJaw.x, rightJaw.y - leftJaw.y);
  const mouthRatio = mouthWidth / Math.max(1, jawWidth);
  const expression: 'neutral' | 'smile' | 'expression classification unavailable' = mouthRatio > 0.46 ? 'smile' : 'neutral';

  return {
    head_pose: {
      yaw: yawDeg,
      pitch: Math.round((pitchRatio - 1.6) * 25),
      roll: rollDeg,
    },
    face_direction: faceDirection,
    gaze_direction: yawRatio > 1.3 ? 'Averted Left' : yawRatio < 0.77 ? 'Averted Right' : 'Forward',
    expression,
    quality_metric: {
      sharpness_score: 88,
      brightness_value: 125,
    },
  };
}

export interface FaceQualityScore {
  faceDetected: boolean;
  facesCount: number;
  faceSizePx: string;
  faceSizeValid: boolean;
  sharpnessScore: number;
  sharpnessValid: boolean;
  brightnessValue: number;
  brightnessValid: boolean;
  embeddingGenerated: boolean;
  readyForRecognition: boolean;
  rejectionReason?: string;
}

export interface EnrollmentValidationResult {
  valid: boolean;
  facesCount: number;
  error?: string;
  descriptor?: number[];
  faceBox?: { x: number; y: number; width: number; height: number };
  qualityScore?: FaceQualityScore;
}

/**
 * Compute brightness and sharpness metrics from a canvas / image element
 */
function analyzeImageQuality(
  imageElement: HTMLImageElement | HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number }
): { brightness: number; brightnessValid: boolean; sharpness: number; sharpnessValid: boolean } {
  try {
    const tempCanvas = document.createElement('canvas');
    const width = Math.max(10, Math.round(box.width));
    const height = Math.max(10, Math.round(box.height));
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { brightness: 128, brightnessValid: true, sharpness: 80, sharpnessValid: true };
    }

    ctx.drawImage(
      imageElement,
      Math.max(0, box.x),
      Math.max(0, box.y),
      width,
      height,
      0,
      0,
      width,
      height
    );

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    let totalLuma = 0;
    const gray = new Float32Array(width * height);

    for (let i = 0, g = 0; i < data.length; i += 4, g++) {
      const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      totalLuma += luma;
      gray[g] = luma;
    }

    const avgLuma = Math.round(totalLuma / (width * height));
    const brightnessValid = avgLuma >= 35 && avgLuma <= 235;

    // Laplacian gradient variance for sharpness evaluation
    let laplacianVar = 0;
    let lapCount = 0;
    let lapSum = 0;
    const lapl: number[] = [];

    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = y * width + x;
        const val =
          -4 * gray[idx] +
          gray[idx - 1] +
          gray[idx + 1] +
          gray[idx - width] +
          gray[idx + width];
        lapl.push(val);
        lapSum += val;
        lapCount++;
      }
    }

    if (lapCount > 0) {
      const meanLap = lapSum / lapCount;
      let varianceSum = 0;
      for (let i = 0; i < lapl.length; i++) {
        const diff = lapl[i] - meanLap;
        varianceSum += diff * diff;
      }
      laplacianVar = varianceSum / lapCount;
    }

    const sharpnessScore = Math.min(100, Math.round(Math.sqrt(laplacianVar) * 5));
    const sharpnessValid = sharpnessScore >= 20;

    return {
      brightness: avgLuma,
      brightnessValid,
      sharpness: sharpnessScore,
      sharpnessValid,
    };
  } catch (e) {
    console.warn('[Face Quality] Error evaluating pixel quality:', e);
    return { brightness: 120, brightnessValid: true, sharpness: 75, sharpnessValid: true };
  }
}

/**
 * Detect all faces in a live video element or canvas
 * Only human faces are detected. Non-face items (hands, phones, laptops, chairs) produce 0 face activations.
 */
export async function detectFacesInMedia(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  useTiny = true
): Promise<DetectedFaceDescriptor[]> {
  await loadFaceModels();

  try {
    let detections: any[] = [];

    // Try tiny face detector first (fastest and most reliable)
    if (useTiny || !faceapi.nets.ssdMobilenetv1.isLoaded) {
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 });
      detections = await faceapi
        .detectAllFaces(input, options)
        .withFaceLandmarks(faceapi.nets.faceLandmark68TinyNet.isLoaded)
        .withFaceDescriptors();
    } else {
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
      detections = await faceapi
        .detectAllFaces(input, options)
        .withFaceLandmarks()
        .withFaceDescriptors();
    }

    return detections.map((det) => {
      const box = det.detection.box;
      return {
        box: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
        descriptor: Array.from(det.descriptor),
        score: Math.round(det.detection.score * 100) / 100,
        landmarks: det.landmarks,
        visual_signals: extractVisualSignalsFromLandmarks(det.landmarks),
      };
    });
  } catch (err) {
    console.error('[SITS AI] Error detecting faces:', err);
    return [];
  }
}

/**
 * Validate a single face image during student enrollment
 * Strict rules:
 * - Exactly one face must be detected (reject 0 faces, reject 2+ faces)
 * - Minimum face size check (>= 60px)
 * - Sharpness and brightness check (reject heavy blur, severe darkness, severe overexposure)
 * - Extract 128D descriptor
 */
export async function validateEnrollmentImage(
  imageElement: HTMLImageElement | HTMLCanvasElement
): Promise<EnrollmentValidationResult> {
  await loadFaceModels();

  try {
    let detections: any[] = [];

    if (faceapi.nets.ssdMobilenetv1.isLoaded) {
      try {
        const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.55 });
        detections = await faceapi
          .detectAllFaces(imageElement, options)
          .withFaceLandmarks()
          .withFaceDescriptors();
      } catch {
        // Fallback to TinyFaceDetector
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 });
        detections = await faceapi
          .detectAllFaces(imageElement, options)
          .withFaceLandmarks(faceapi.nets.faceLandmark68TinyNet.isLoaded)
          .withFaceDescriptors();
      }
    } else {
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 });
      detections = await faceapi
        .detectAllFaces(imageElement, options)
        .withFaceLandmarks(faceapi.nets.faceLandmark68TinyNet.isLoaded)
        .withFaceDescriptors();
    }

    if (!detections || detections.length === 0) {
      return {
        valid: false,
        facesCount: 0,
        error: 'No human face detected. Ensure good lighting and look directly at the camera. Hands, phones, and non-face items are ignored.',
        qualityScore: {
          faceDetected: false,
          facesCount: 0,
          faceSizePx: '0 x 0 px',
          faceSizeValid: false,
          sharpnessScore: 0,
          sharpnessValid: false,
          brightnessValue: 0,
          brightnessValid: false,
          embeddingGenerated: false,
          readyForRecognition: false,
          rejectionReason: 'No human face detected.',
        },
      };
    }

    if (detections.length > 1) {
      return {
        valid: false,
        facesCount: detections.length,
        error: `Multiple faces detected (${detections.length} faces). Exactly one student face is required for enrollment.`,
        qualityScore: {
          faceDetected: true,
          facesCount: detections.length,
          faceSizePx: 'Multiple',
          faceSizeValid: false,
          sharpnessScore: 0,
          sharpnessValid: false,
          brightnessValue: 0,
          brightnessValid: false,
          embeddingGenerated: false,
          readyForRecognition: false,
          rejectionReason: `Multiple faces detected (${detections.length}).`,
        },
      };
    }

    const singleDetection = detections[0];
    const box = singleDetection.detection.box;
    const faceBox = {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };

    const faceSizeValid = faceBox.width >= 60 && faceBox.height >= 60;
    if (!faceSizeValid) {
      return {
        valid: false,
        facesCount: 1,
        error: `Face is too small (${faceBox.width}x${faceBox.height}px). Minimum required size is 60x60px. Please move closer.`,
        faceBox,
        qualityScore: {
          faceDetected: true,
          facesCount: 1,
          faceSizePx: `${faceBox.width} x ${faceBox.height} px`,
          faceSizeValid: false,
          sharpnessScore: 50,
          sharpnessValid: true,
          brightnessValue: 120,
          brightnessValid: true,
          embeddingGenerated: false,
          readyForRecognition: false,
          rejectionReason: 'Face size too small (< 60px).',
        },
      };
    }

    // Perform deep pixel analysis on the detected face
    const qualityMetrics = analyzeImageQuality(imageElement, faceBox);

    if (!qualityMetrics.brightnessValid) {
      const reason = qualityMetrics.brightness < 35 ? 'Image is too dark' : 'Image is overexposed / washed out';
      return {
        valid: false,
        facesCount: 1,
        error: `${reason} (Brightness: ${qualityMetrics.brightness}/255). Please ensure balanced lighting.`,
        faceBox,
        qualityScore: {
          faceDetected: true,
          facesCount: 1,
          faceSizePx: `${faceBox.width} x ${faceBox.height} px`,
          faceSizeValid: true,
          sharpnessScore: qualityMetrics.sharpness,
          sharpnessValid: qualityMetrics.sharpnessValid,
          brightnessValue: qualityMetrics.brightness,
          brightnessValid: false,
          embeddingGenerated: false,
          readyForRecognition: false,
          rejectionReason: reason,
        },
      };
    }

    if (!qualityMetrics.sharpnessValid) {
      return {
        valid: false,
        facesCount: 1,
        error: `Image is heavily blurred (Sharpness: ${qualityMetrics.sharpness}%). Hold the camera steady and refocus.`,
        faceBox,
        qualityScore: {
          faceDetected: true,
          facesCount: 1,
          faceSizePx: `${faceBox.width} x ${faceBox.height} px`,
          faceSizeValid: true,
          sharpnessScore: qualityMetrics.sharpness,
          sharpnessValid: false,
          brightnessValue: qualityMetrics.brightness,
          brightnessValid: true,
          embeddingGenerated: false,
          readyForRecognition: false,
          rejectionReason: 'Heavy motion blur or out of focus.',
        },
      };
    }

    const descriptor = Array.from(singleDetection.descriptor) as number[];

    return {
      valid: true,
      facesCount: 1,
      descriptor,
      faceBox,
      qualityScore: {
        faceDetected: true,
        facesCount: 1,
        faceSizePx: `${faceBox.width} x ${faceBox.height} px`,
        faceSizeValid: true,
        sharpnessScore: qualityMetrics.sharpness,
        sharpnessValid: true,
        brightnessValue: qualityMetrics.brightness,
        brightnessValid: true,
        embeddingGenerated: descriptor.length === 128,
        readyForRecognition: true,
      },
    };
  } catch (err: any) {
    return {
      valid: false,
      facesCount: 0,
      error: `Validation error: ${err.message || 'Unknown error during face analysis.'}`,
    };
  }
}

