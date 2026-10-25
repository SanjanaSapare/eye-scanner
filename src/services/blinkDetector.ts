/**
 * AccessScan Blink Detection & Eye Aspect Ratio (EAR) Vision Engine
 * Supports MediaPipe FaceLandmarker WebAssembly and synthetic simulation.
 */

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface EARResult {
  leftEAR: number;
  rightEAR: number;
  avgEAR: number;
  isEyesClosed: boolean;
}

export type BlinkGestureType = 'double-blink' | 'long-blink' | 'single-blink';

export type BlinkState =
  | 'IDLE'
  | 'FIRST_BLINK_CLOSING'
  | 'FIRST_BLINK_OPENED'
  | 'SECOND_BLINK_CLOSING'
  | 'TRIGGERED'
  | 'REFRACTORY';

export interface BlinkDetectorConfig {
  earThreshold: number; // e.g. 0.21
  minBlinkDurationMs: number; // e.g. 60ms (reject noise / frame drops)
  maxBlinkDurationMs: number; // e.g. 350ms (reject long resting eyelids)
  doubleBlinkWindowMs: number; // e.g. 450ms (window between first reopen and second close)
  longBlinkDurationMs: number; // e.g. 600ms (sustained closure)
  refractoryPeriodMs: number; // e.g. 600ms (cooldown after trigger)
  enableDoubleBlink: boolean;
  enableLongBlink: boolean;
}

export const DEFAULT_CONFIG: BlinkDetectorConfig = {
  earThreshold: 0.22,
  minBlinkDurationMs: 60,
  maxBlinkDurationMs: 350,
  doubleBlinkWindowMs: 480,
  longBlinkDurationMs: 550,
  refractoryPeriodMs: 650,
  enableDoubleBlink: true,
  enableLongBlink: false,
};

/**
 * MediaPipe Face Mesh landmark indices for Left and Right Eyes
 * Left Eye: 33 (outer), 133 (inner), 160 (upper outer), 158 (upper inner), 144 (lower outer), 153 (lower inner)
 * Right Eye: 362 (inner), 263 (outer), 385 (upper inner), 387 (upper outer), 380 (lower inner), 373 (lower outer)
 */
export const EYE_LANDMARKS = {
  left: {
    outer: 33,
    inner: 133,
    top1: 160,
    top2: 158,
    bottom1: 144,
    bottom2: 153,
    pupil: 468,
  },
  right: {
    inner: 362,
    outer: 263,
    top1: 385,
    top2: 387,
    bottom1: 380,
    bottom2: 373,
    pupil: 473,
  },
};

/**
 * Euclidean distance in 2D normalized space
 */
export function euclideanDistance(p1: NormalizedLandmark, p2: NormalizedLandmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate Eye Aspect Ratio (EAR) for a single eye given 6 contour points:
 * EAR = (|p_top1 - p_bot1| + |p_top2 - p_bot2|) / (2 * |p_outer - p_inner|)
 */
export function calculateSingleEyeEAR(
  outer: NormalizedLandmark,
  inner: NormalizedLandmark,
  top1: NormalizedLandmark,
  top2: NormalizedLandmark,
  bot1: NormalizedLandmark,
  bot2: NormalizedLandmark
): number {
  const vertical1 = euclideanDistance(top1, bot1);
  const vertical2 = euclideanDistance(top2, bot2);
  const horizontal = euclideanDistance(outer, inner);

  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Extract EAR from full 468/478 face landmarks
 */
export function calculateFaceEAR(landmarks: NormalizedLandmark[], threshold = 0.22): EARResult {
  const left = EYE_LANDMARKS.left;
  const right = EYE_LANDMARKS.right;

  // Validate indices exist
  if (!landmarks[left.outer] || !landmarks[right.outer]) {
    return { leftEAR: 0.3, rightEAR: 0.3, avgEAR: 0.3, isEyesClosed: false };
  }

  const leftEAR = calculateSingleEyeEAR(
    landmarks[left.outer],
    landmarks[left.inner],
    landmarks[left.top1],
    landmarks[left.top2],
    landmarks[left.bottom1],
    landmarks[left.bottom2]
  );

  const rightEAR = calculateSingleEyeEAR(
    landmarks[right.outer],
    landmarks[right.inner],
    landmarks[right.top1],
    landmarks[right.top2],
    landmarks[right.bottom1],
    landmarks[right.bottom2]
  );

  const avgEAR = (leftEAR + rightEAR) / 2.0;
  const isEyesClosed = avgEAR < threshold;

  return { leftEAR, rightEAR, avgEAR, isEyesClosed };
}

/**
 * Sound synthesizer for accessible audio cues
 */
export class AccessibilityAudio {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Lazy initialize on first interaction
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  playTick() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(640, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // Audio context may be restricted before user interaction
    }
  }

  playSelect() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6 chime
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Audio context fail-safe
    }
  }
}

/**
 * Robust Intentional Blink State Machine
 */
export class BlinkStateMachine {
  private config: BlinkDetectorConfig;
  private state: BlinkState = 'IDLE';

  private firstBlinkStartTime: number = 0;
  private firstBlinkEndTime: number = 0;
  private secondBlinkStartTime: number = 0;
  private sustainedStartTime: number = 0;
  private refractoryStartTime: number = 0;

  private onTriggerCallback?: (gesture: BlinkGestureType, durationMs: number) => void;
  private onStateChangeCallback?: (state: BlinkState, message: string) => void;

  constructor(config: BlinkDetectorConfig = DEFAULT_CONFIG) {
    this.config = { ...config };
  }

  updateConfig(newConfig: Partial<BlinkDetectorConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): BlinkDetectorConfig {
    return { ...this.config };
  }

  onTrigger(cb: (gesture: BlinkGestureType, durationMs: number) => void) {
    this.onTriggerCallback = cb;
  }

  onStateChange(cb: (state: BlinkState, message: string) => void) {
    this.onStateChangeCallback = cb;
  }

  getState(): BlinkState {
    return this.state;
  }

  private setState(newState: BlinkState, message: string) {
    this.state = newState;
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(newState, message);
    }
  }

  /**
   * Process a single video frame with computed EAR
   */
  processFrame(earResult: EARResult, nowMs: number = Date.now()): BlinkState {
    const isClosed = earResult.avgEAR < this.config.earThreshold;

    // 1. Refractory Period cooldown
    if (this.state === 'REFRACTORY') {
      if (nowMs - this.refractoryStartTime > this.config.refractoryPeriodMs && !isClosed) {
        this.setState('IDLE', 'Ready for input');
      }
      return this.state;
    }

    // 2. Long Blink check (if enabled)
    if (this.config.enableLongBlink) {
      if (isClosed) {
        if (!this.sustainedStartTime) {
          this.sustainedStartTime = nowMs;
        } else if (nowMs - this.sustainedStartTime >= this.config.longBlinkDurationMs) {
          // Sustained long blink achieved!
          this.setState('TRIGGERED', 'Sustained Long Blink triggered!');
          if (this.onTriggerCallback) {
            this.onTriggerCallback('long-blink', nowMs - this.sustainedStartTime);
          }
          this.sustainedStartTime = 0;
          this.refractoryStartTime = nowMs;
          this.setState('REFRACTORY', 'Refractory cooldown');
          return this.state;
        }
      } else {
        this.sustainedStartTime = 0;
      }
    }

    // 3. Double-Blink State Machine
    switch (this.state) {
      case 'IDLE': {
        if (isClosed) {
          this.firstBlinkStartTime = nowMs;
          this.setState('FIRST_BLINK_CLOSING', 'First blink started');
        }
        break;
      }

      case 'FIRST_BLINK_CLOSING': {
        if (!isClosed) {
          const blinkDuration = nowMs - this.firstBlinkStartTime;
          if (
            blinkDuration >= this.config.minBlinkDurationMs &&
            blinkDuration <= this.config.maxBlinkDurationMs
          ) {
            // Valid first blink completed!
            this.firstBlinkEndTime = nowMs;
            this.setState('FIRST_BLINK_OPENED', 'First blink confirmed. Waiting for second blink...');
          } else {
            // Glitch or too slow -> reset to IDLE
            this.setState('IDLE', 'Blink discarded (invalid duration)');
          }
        }
        break;
      }

      case 'FIRST_BLINK_OPENED': {
        const timeSinceFirstOpen = nowMs - this.firstBlinkEndTime;

        // If user waits too long without closing eyes again, timeout back to IDLE
        if (timeSinceFirstOpen > this.config.doubleBlinkWindowMs) {
          this.setState('IDLE', 'Double-blink timed out (single natural blink)');
          break;
        }

        // Eyes closed again within window!
        if (isClosed) {
          this.secondBlinkStartTime = nowMs;
          this.setState('SECOND_BLINK_CLOSING', 'Second blink detected');
        }
        break;
      }

      case 'SECOND_BLINK_CLOSING': {
        if (!isClosed) {
          const secondBlinkDuration = nowMs - this.secondBlinkStartTime;
          if (
            secondBlinkDuration >= this.config.minBlinkDurationMs &&
            secondBlinkDuration <= this.config.maxBlinkDurationMs
          ) {
            // VALID DOUBLE-BLINK ACHIEVED!
            this.setState('TRIGGERED', 'Double-blink confirmed! Switch selected!');
            if (this.onTriggerCallback) {
              this.onTriggerCallback('double-blink', secondBlinkDuration);
            }
            this.refractoryStartTime = nowMs;
            this.setState('REFRACTORY', 'Cooldown to prevent re-trigger');
          } else {
            // Second blink invalid
            this.setState('IDLE', 'Second blink duration invalid');
          }
        }
        break;
      }

      default:
        break;
    }

    return this.state;
  }

  reset() {
    this.state = 'IDLE';
    this.firstBlinkStartTime = 0;
    this.firstBlinkEndTime = 0;
    this.secondBlinkStartTime = 0;
    this.sustainedStartTime = 0;
    this.refractoryStartTime = 0;
  }
}
