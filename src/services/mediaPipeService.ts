/**
 * MediaPipe FaceLandmarker vision integration and canvas rendering
 */
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { NormalizedLandmark, EYE_LANDMARKS } from './blinkDetector.ts';

let faceLandmarkerInstance: FaceLandmarker | null = null;
let isLoadingModel = false;

export async function initFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (faceLandmarkerInstance) return faceLandmarkerInstance;
  if (isLoadingModel) {
    // Wait until initialized
    while (isLoadingModel) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return faceLandmarkerInstance;
  }

  isLoadingModel = true;
  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    faceLandmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      outputFaceBlendshapes: false,
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    return faceLandmarkerInstance;
  } catch (err) {
    console.warn('GPU delegate failed or network slow, falling back to CPU delegate:', err);
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      faceLandmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU',
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      return faceLandmarkerInstance;
    } catch (fallbackErr) {
      console.error('Failed to initialize FaceLandmarker:', fallbackErr);
      return null;
    }
  } finally {
    isLoadingModel = false;
  }
}

/**
 * Draw eye contours, key EAR vertical/horizontal points, and iris
 */
export function drawEyeLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  isClosed: boolean
) {
  ctx.save();

  const drawEye = (indices: typeof EYE_LANDMARKS.left, label: string) => {
    const pOuter = landmarks[indices.outer];
    const pInner = landmarks[indices.inner];
    const pTop1 = landmarks[indices.top1];
    const pTop2 = landmarks[indices.top2];
    const pBot1 = landmarks[indices.bottom1];
    const pBot2 = landmarks[indices.bottom2];
    const pPupil = landmarks[indices.pupil];

    if (!pOuter || !pInner || !pTop1 || !pTop2 || !pBot1 || !pBot2) return;

    // Draw eye contour outline
    ctx.beginPath();
    ctx.strokeStyle = isClosed ? '#ef4444' : '#06b6d4';
    ctx.lineWidth = 2;
    ctx.moveTo(pOuter.x * width, pOuter.y * height);
    ctx.lineTo(pTop1.x * width, pTop1.y * height);
    ctx.lineTo(pTop2.x * width, pTop2.y * height);
    ctx.lineTo(pInner.x * width, pInner.y * height);
    ctx.lineTo(pBot2.x * width, pBot2.y * height);
    ctx.lineTo(pBot1.x * width, pBot1.y * height);
    ctx.closePath();
    ctx.stroke();

    // Draw EAR vertical distance vectors
    ctx.strokeStyle = isClosed ? '#f87171' : '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);

    // Vector 1 (top1 to bot1)
    ctx.beginPath();
    ctx.moveTo(pTop1.x * width, pTop1.y * height);
    ctx.lineTo(pBot1.x * width, pBot1.y * height);
    ctx.stroke();

    // Vector 2 (top2 to bot2)
    ctx.beginPath();
    ctx.moveTo(pTop2.x * width, pTop2.y * height);
    ctx.lineTo(pBot2.x * width, pBot2.y * height);
    ctx.stroke();

    // Horizontal vector
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(pOuter.x * width, pOuter.y * height);
    ctx.lineTo(pInner.x * width, pInner.y * height);
    ctx.stroke();

    ctx.setLineDash([]);

    // Draw landmark points
    const points = [pOuter, pInner, pTop1, pTop2, pBot1, pBot2];
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isClosed ? '#ef4444' : '#22d3ee';
      ctx.fill();
    });

    // Pupil
    if (pPupil) {
      ctx.beginPath();
      ctx.arc(pPupil.x * width, pPupil.y * height, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Label
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(label, pOuter.x * width - 10, pOuter.y * height - 8);
  };

  drawEye(EYE_LANDMARKS.left, 'L-EYE');
  drawEye(EYE_LANDMARKS.right, 'R-EYE');

  ctx.restore();
}

/**
 * Generate synthetic landmark coordinates for demo/testing when webcam is unavailable
 */
export function generateSyntheticLandmarks(earValue: number): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = [];
  for (let i = 0; i < 480; i++) {
    landmarks.push({ x: 0.5, y: 0.5, z: 0 });
  }

  // Eye width
  const eyeWidth = 0.08;
  const eyeOpening = eyeWidth * earValue;

  // Left Eye (centered around x: 0.42, y: 0.45)
  const lx = 0.42;
  const ly = 0.45;
  landmarks[EYE_LANDMARKS.left.outer] = { x: lx - eyeWidth / 2, y: ly, z: 0 };
  landmarks[EYE_LANDMARKS.left.inner] = { x: lx + eyeWidth / 2, y: ly, z: 0 };
  landmarks[EYE_LANDMARKS.left.top1] = { x: lx - eyeWidth / 4, y: ly - eyeOpening / 2, z: 0 };
  landmarks[EYE_LANDMARKS.left.top2] = { x: lx + eyeWidth / 4, y: ly - eyeOpening / 2, z: 0 };
  landmarks[EYE_LANDMARKS.left.bottom1] = { x: lx - eyeWidth / 4, y: ly + eyeOpening / 2, z: 0 };
  landmarks[EYE_LANDMARKS.left.bottom2] = { x: lx + eyeWidth / 4, y: ly + eyeOpening / 2, z: 0 };
  landmarks[EYE_LANDMARKS.left.pupil] = { x: lx, y: ly, z: 0 };

  // Right Eye (centered around x: 0.58, y: 0.45)
  const rx = 0.58;
  const ry = 0.45;
  landmarks[EYE_LANDMARKS.right.inner] = { x: rx - eyeWidth / 2, y: ry, z: 0 };
  landmarks[EYE_LANDMARKS.right.outer] = { x: rx + eyeWidth / 2, y: ry, z: 0 };
  landmarks[EYE_LANDMARKS.right.top1] = { x: rx - eyeWidth / 4, y: ry - eyeOpening / 2, z: 0 };
  landmarks[EYE_LANDMARKS.right.top2] = { x: rx + eyeWidth / 4, y: ry - eyeOpening / 2, z: 0 };
  landmarks[EYE_LANDMARKS.right.bottom1] = { x: rx - eyeWidth / 4, y: ry + eyeOpening / 2, z: 0 };
  landmarks[EYE_LANDMARKS.right.bottom2] = { x: rx + eyeWidth / 4, y: ry + eyeOpening / 2, z: 0 };
  landmarks[EYE_LANDMARKS.right.pupil] = { x: rx, y: ry, z: 0 };

  return landmarks;
}
