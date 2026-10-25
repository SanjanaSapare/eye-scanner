import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Sliders,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Activity,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  BlinkDetectorConfig,
  DEFAULT_CONFIG,
  BlinkStateMachine,
  BlinkState,
  AccessibilityAudio,
  calculateFaceEAR,
  EARResult,
} from '../services/blinkDetector.ts';
import {
  initFaceLandmarker,
  drawEyeLandmarks,
  generateSyntheticLandmarks,
} from '../services/mediaPipeService.ts';

interface CalibrationLabProps {
  onBlinkTriggered?: (source: string) => void;
  config: BlinkDetectorConfig;
  onConfigChange: (newConfig: BlinkDetectorConfig) => void;
}

export const CalibrationLab: React.FC<CalibrationLabProps> = ({
  onBlinkTriggered,
  config,
  onConfigChange,
}) => {
  // Video and Canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const earHistoryCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [currentEAR, setCurrentEAR] = useState<number>(0.3);
  const [currentState, setCurrentState] = useState<BlinkState>('IDLE');
  const [stateMessage, setStateMessage] = useState<string>('Ready');
  const [triggerCount, setTriggerCount] = useState<number>(0);
  const [lastTriggerTime, setLastTriggerTime] = useState<string | null>(null);

  // Calibration Wizard State
  const [calibrationStep, setCalibrationStep] = useState<'idle' | 'measuring_open' | 'measuring_closed' | 'done'>('idle');
  const [countdown, setCountdown] = useState<number>(3);
  const [openEarSamples, setOpenEarSamples] = useState<number[]>([]);
  const [closedEarSamples, setClosedEarSamples] = useState<number[]>([]);
  const [measuredOpenEar, setMeasuredOpenEar] = useState<number | null>(null);
  const [measuredClosedEar, setMeasuredClosedEar] = useState<number | null>(null);

  // Audio and State Machine instances
  const audioRef = useRef<AccessibilityAudio | null>(null);
  const stateMachineRef = useRef<BlinkStateMachine | null>(null);
  const earHistoryRef = useRef<number[]>(new Array(60).fill(0.3));
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize audio & state machine
  useEffect(() => {
    audioRef.current = new AccessibilityAudio();
    const sm = new BlinkStateMachine(config);
    sm.onTrigger((gesture) => {
      audioRef.current?.playSelect();
      setTriggerCount((c) => c + 1);
      setLastTriggerTime(new Date().toLocaleTimeString());
      onBlinkTriggered?.(`Blink (${gesture})`);
      confetti({
        particleCount: 25,
        spread: 45,
        origin: { y: 0.7 },
        colors: ['#06b6d4', '#10b981', '#38bdf8'],
      });
    });
    sm.onStateChange((state, msg) => {
      setCurrentState(state);
      setStateMessage(msg);
      if (state === 'FIRST_BLINK_CLOSING' || state === 'SECOND_BLINK_CLOSING') {
        audioRef.current?.playTick();
      }
    });
    stateMachineRef.current = sm;

    return () => {
      stopCamera();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Sync config updates into state machine
  useEffect(() => {
    stateMachineRef.current?.updateConfig(config);
  }, [config]);

  // Audio mute sync
  useEffect(() => {
    audioRef.current?.setMuted(isAudioMuted);
  }, [isAudioMuted]);

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraActive(true);
        };
      }

      // Load model if not loaded
      if (!isModelLoaded) {
        setStateMessage('Loading MediaPipe Vision WASM...');
        const landmarker = await initFaceLandmarker();
        if (landmarker) {
          setIsModelLoaded(true);
          setStateMessage('Vision model loaded. Running detection.');
        } else {
          setCameraError('MediaPipe model could not load. Running synthetic fallback.');
        }
      }
    } catch (err: unknown) {
      console.warn('Camera access denied or unavailable:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setCameraError(`Camera permission or device error: ${errMsg}. You can use the Synthetic Simulator below!`);
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Main Detection Loop
  const runDetectionLoop = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) {
      animFrameRef.current = requestAnimationFrame(runDetectionLoop);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (isCameraActive && video.readyState >= 2 && ctx) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Draw mirrored video
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      const landmarker = await initFaceLandmarker();
      if (landmarker) {
        try {
          const results = landmarker.detectForVideo(video, performance.now());
          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            // Mirror landmarks for mirrored display
            const rawLandmarks = results.faceLandmarks[0];
            const mirrored = rawLandmarks.map((p) => ({ ...p, x: 1 - p.x }));

            const earData: EARResult = calculateFaceEAR(rawLandmarks, config.earThreshold);
            setCurrentEAR(Number(earData.avgEAR.toFixed(3)));

            // Add to history
            earHistoryRef.current.push(earData.avgEAR);
            if (earHistoryRef.current.length > 60) earHistoryRef.current.shift();

            // Run state machine
            stateMachineRef.current?.processFrame(earData, Date.now());

            // Draw eye landmarks
            drawEyeLandmarks(ctx, mirrored, canvas.width, canvas.height, earData.isEyesClosed);

            // Calibration collection if active
            if (calibrationStep === 'measuring_open') {
              setOpenEarSamples((prev) => [...prev, earData.avgEAR]);
            } else if (calibrationStep === 'measuring_closed') {
              setClosedEarSamples((prev) => [...prev, earData.avgEAR]);
            }
          }
        } catch {
          // Frame skip handling
        }
      }
    }

    // Render EAR Sparkline Graph
    drawEarHistoryGraph();

    animFrameRef.current = requestAnimationFrame(runDetectionLoop);
  }, [isCameraActive, config, calibrationStep]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(runDetectionLoop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [runDetectionLoop]);

  // Draw EAR Rolling Chart
  const drawEarHistoryGraph = () => {
    if (!earHistoryCanvasRef.current) return;
    const canvas = earHistoryCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const history = earHistoryRef.current;
    const maxEAR = 0.45;
    const minEAR = 0.05;

    // Background grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.stroke();

    // Threshold Line
    const thresholdY = h - ((config.earThreshold - minEAR) / (maxEAR - minEAR)) * h;
    ctx.strokeStyle = '#f59e0b';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(w, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    // EAR Waveform
    ctx.beginPath();
    ctx.lineWidth = 2;
    history.forEach((ear, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = h - ((ear - minEAR) / (maxEAR - minEAR)) * h;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    const isBelow = currentEAR < config.earThreshold;
    ctx.strokeStyle = isBelow ? '#ef4444' : '#06b6d4';
    ctx.stroke();
  };

  // Synthetic Test Triggers (allows testing algorithm even without a camera)
  const triggerSyntheticBlinkSequence = (type: 'double' | 'single' | 'long') => {
    const sm = stateMachineRef.current;
    if (!sm) return;

    if (type === 'single') {
      simulateSingleBlink();
    } else if (type === 'double') {
      simulateDoubleBlink();
    } else if (type === 'long') {
      simulateLongBlink();
    }
  };

  const simulateSingleBlink = () => {
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      const earVal = frame >= 3 && frame <= 7 ? 0.12 : 0.32;
      setCurrentEAR(earVal);
      earHistoryRef.current.push(earVal);
      if (earHistoryRef.current.length > 60) earHistoryRef.current.shift();

      stateMachineRef.current?.processFrame(
        { leftEAR: earVal, rightEAR: earVal, avgEAR: earVal, isEyesClosed: earVal < config.earThreshold },
        Date.now()
      );

      if (frame > 16) clearInterval(interval);
    }, 25);
  };

  const simulateDoubleBlink = () => {
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      // Blink 1: frames 3-6 (100ms)
      // Open: frames 7-12 (150ms)
      // Blink 2: frames 13-16 (100ms)
      // Open: frames 17+
      let earVal = 0.32;
      if (frame >= 3 && frame <= 6) earVal = 0.12;
      else if (frame >= 13 && frame <= 16) earVal = 0.11;

      setCurrentEAR(earVal);
      earHistoryRef.current.push(earVal);
      if (earHistoryRef.current.length > 60) earHistoryRef.current.shift();

      stateMachineRef.current?.processFrame(
        { leftEAR: earVal, rightEAR: earVal, avgEAR: earVal, isEyesClosed: earVal < config.earThreshold },
        Date.now()
      );

      if (frame > 26) clearInterval(interval);
    }, 25);
  };

  const simulateLongBlink = () => {
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      const earVal = frame >= 3 && frame <= 28 ? 0.1 : 0.32;
      setCurrentEAR(earVal);
      earHistoryRef.current.push(earVal);
      if (earHistoryRef.current.length > 60) earHistoryRef.current.shift();

      stateMachineRef.current?.processFrame(
        { leftEAR: earVal, rightEAR: earVal, avgEAR: earVal, isEyesClosed: earVal < config.earThreshold },
        Date.now()
      );

      if (frame > 35) clearInterval(interval);
    }, 25);
  };

  // Calibration Wizard Actions
  const startCalibration = () => {
    setCalibrationStep('measuring_open');
    setCountdown(3);
    setOpenEarSamples([]);
    setClosedEarSamples([]);

    let remaining = 3;
    const timer = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        // Transition to measuring closed
        setCalibrationStep('measuring_closed');
        let closedRemaining = 3;
        setCountdown(closedRemaining);

        const closedTimer = setInterval(() => {
          closedRemaining -= 1;
          setCountdown(closedRemaining);
          if (closedRemaining <= 0) {
            clearInterval(closedTimer);
            finishCalibration();
          }
        }, 1000);
      }
    }, 1000);
  };

  const finishCalibration = () => {
    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0.3);
    const openVal = openEarSamples.length > 5 ? mean(openEarSamples) : 0.32;
    const closedVal = closedEarSamples.length > 5 ? mean(closedEarSamples) : 0.14;

    setMeasuredOpenEar(Number(openVal.toFixed(3)));
    setMeasuredClosedEar(Number(closedVal.toFixed(3)));

    // Optimal formula: closed + 35% of dynamic range
    const recommendedThreshold = Number((closedVal + 0.35 * (openVal - closedVal)).toFixed(3));
    onConfigChange({
      ...config,
      earThreshold: recommendedThreshold,
    });
    setCalibrationStep('done');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Live HUD & Video Preview (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Main Camera / Visualizer Container */}
        <div className="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl aspect-4/3 flex items-center justify-center">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover hidden"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {!isCameraActive && (
            <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center mb-4 text-cyan-400">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-slate-100 mb-1">
                Local Computer Vision Feed
              </h3>
              <p className="text-sm text-slate-400 mb-5 leading-relaxed">
                Processes video locally via MediaPipe FaceLandmarker WebAssembly. Zero video frames leave your device.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={startCamera}
                  className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg shadow-md transition-all flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Enable Webcam
                </button>
                <button
                  onClick={() => triggerSyntheticBlinkSequence('double')}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Test Simulator
                </button>
              </div>
              {cameraError && (
                <div className="mt-4 p-3 bg-red-950/60 border border-red-900/60 rounded-lg text-xs text-red-300 flex items-start gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>
          )}

          {/* Live HUD Overlays when Camera is running */}
          {isCameraActive && (
            <>
              {/* Top status bar inside HUD */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
                <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800/80 text-xs font-mono">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      currentEAR < config.earThreshold ? 'bg-red-500' : 'bg-cyan-400'
                    }`}
                  />
                  <span className="text-slate-300">EAR:</span>
                  <span className="font-semibold text-cyan-300 tabular-nums">{currentEAR.toFixed(3)}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-400">THR: {config.earThreshold.toFixed(2)}</span>
                </div>

                <div className="pointer-events-auto flex items-center gap-2">
                  <button
                    onClick={() => setIsAudioMuted(!isAudioMuted)}
                    className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                    title={isAudioMuted ? 'Unmute Audio Cues' : 'Mute Audio Cues'}
                  >
                    {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={stopCamera}
                    className="px-2.5 py-1.5 rounded-lg bg-red-950/80 border border-red-800/80 text-red-200 hover:bg-red-900 text-xs font-medium transition-colors flex items-center gap-1.5"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    Stop Camera
                  </button>
                </div>
              </div>

              {/* State Machine Status Badge */}
              <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
                <div className="bg-slate-950/85 backdrop-blur-md px-3.5 py-2 rounded-lg border border-slate-800 text-xs">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Detection State</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`font-semibold ${
                        currentState === 'TRIGGERED'
                          ? 'text-emerald-400'
                          : currentState.includes('BLINK')
                          ? 'text-amber-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {currentState}
                    </span>
                    <span className="text-slate-400 text-[11px]">· {stateMessage}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Real-time Rolling EAR Graph & Live Metrics */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Eye Aspect Ratio (EAR) Real-Time Waveform
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-amber-400 flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 border-t border-dashed border-amber-400" />
                Threshold ({config.earThreshold.toFixed(2)})
              </span>
              <span className="text-cyan-400 flex items-center gap-1">
                <span className="inline-block w-3 h-0.5 bg-cyan-400" />
                Current EAR
              </span>
            </div>
          </div>
          <div className="h-20 w-full bg-slate-950 rounded-lg p-1 border border-slate-800/80">
            <canvas ref={earHistoryCanvasRef} width={600} height={70} className="w-full h-full" />
          </div>
        </div>

        {/* Simulator Buttons Strip */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Instant Algorithm Test Simulator
              </span>
            </div>
            <span className="text-xs text-slate-400">Generates exact synthetic landmark sequences</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => triggerSyntheticBlinkSequence('double')}
              className="py-2.5 px-3 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/60 rounded-lg text-xs font-semibold text-cyan-300 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              Simulate Double-Blink
            </button>
            <button
              onClick={() => triggerSyntheticBlinkSequence('single')}
              className="py-2.5 px-3 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              Simulate Single Blink
            </button>
            <button
              onClick={() => triggerSyntheticBlinkSequence('long')}
              className="py-2.5 px-3 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-colors flex items-center justify-center gap-2"
            >
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Simulate Long Blink
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Calibration Wizard & Threshold Tuner (5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        {/* Switch Verification Counter Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase font-mono text-slate-400">Total Switch Triggers</div>
            <div className="text-2xl font-bold font-mono text-cyan-400 tabular-nums mt-0.5">
              {triggerCount}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase font-mono text-slate-400">Last Verified</div>
            <div className="text-sm font-mono text-slate-300 mt-0.5">
              {lastTriggerTime || 'None yet'}
            </div>
          </div>
        </div>

        {/* Guided Calibration Wizard Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Automated Calibration Wizard
            </h4>
            <span className="text-xs text-slate-400">Step-by-step personal EAR</span>
          </div>

          {calibrationStep === 'idle' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Everyone's eye shape is unique. This 6-second calibration measures your relaxed open eyes and closed eyes to calculate your optimal EAR threshold.
              </p>
              <button
                onClick={startCalibration}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Start 2-Step Calibration
              </button>
            </div>
          )}

          {calibrationStep === 'measuring_open' && (
            <div className="p-4 bg-cyan-950/40 border border-cyan-800/80 rounded-lg text-center space-y-2">
              <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wide">
                Step 1: Keep Eyes Naturally Open
              </div>
              <div className="text-3xl font-bold font-mono text-white tabular-nums">{countdown}s</div>
              <p className="text-xs text-slate-400">Look straight at the webcam or screen naturally.</p>
            </div>
          )}

          {calibrationStep === 'measuring_closed' && (
            <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-lg text-center space-y-2">
              <div className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
                Step 2: Close Eyes Gently
              </div>
              <div className="text-3xl font-bold font-mono text-amber-300 tabular-nums">{countdown}s</div>
              <p className="text-xs text-slate-400">Hold your eyelids closed without squinting.</p>
            </div>
          )}

          {calibrationStep === 'done' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 mb-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Calibration Completed!
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                  <div>Open Baseline: <span className="text-cyan-400">{measuredOpenEar}</span></div>
                  <div>Closed Baseline: <span className="text-amber-400">{measuredClosedEar}</span></div>
                </div>
                <div className="mt-2 text-xs text-emerald-200">
                  Applied Threshold: <strong className="text-white">{config.earThreshold.toFixed(3)}</strong>
                </div>
              </div>
              <button
                onClick={() => setCalibrationStep('idle')}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
              >
                Recalibrate
              </button>
            </div>
          )}
        </div>

        {/* Fine-Tuning Parameter Sliders */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-sm font-semibold text-slate-200">Fine-Tuning Controls</h4>
            <button
              onClick={() => onConfigChange(DEFAULT_CONFIG)}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Reset to Defaults
            </button>
          </div>

          {/* Slider 1: EAR Threshold */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Blink EAR Threshold</span>
              <span className="font-mono text-cyan-400 tabular-nums">{config.earThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.12"
              max="0.32"
              step="0.01"
              value={config.earThreshold}
              onChange={(e) =>
                onConfigChange({ ...config, earThreshold: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.12 (Requires tight closure)</span>
              <span>0.32 (Sensitive)</span>
            </div>
          </div>

          {/* Slider 2: Double-Blink Window */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Double-Blink Max Interval</span>
              <span className="font-mono text-cyan-400 tabular-nums">{config.doubleBlinkWindowMs}ms</span>
            </div>
            <input
              type="range"
              min="250"
              max="800"
              step="20"
              value={config.doubleBlinkWindowMs}
              onChange={(e) =>
                onConfigChange({ ...config, doubleBlinkWindowMs: parseInt(e.target.value, 10) })
              }
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>250ms (Rapid succession)</span>
              <span>800ms (Relaxed pacing)</span>
            </div>
          </div>

          {/* Slider 3: Min Blink Duration */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Min Blink Duration (Noise Filter)</span>
              <span className="font-mono text-cyan-400 tabular-nums">{config.minBlinkDurationMs}ms</span>
            </div>
            <input
              type="range"
              min="40"
              max="140"
              step="10"
              value={config.minBlinkDurationMs}
              onChange={(e) =>
                onConfigChange({ ...config, minBlinkDurationMs: parseInt(e.target.value, 10) })
              }
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">
              Discards momentary webcam packet drops or eyelid twitches shorter than this duration.
            </p>
          </div>

          {/* Feature Toggles */}
          <div className="pt-2 border-t border-slate-800 space-y-2.5">
            <label className="flex items-center justify-between text-xs cursor-pointer">
              <span className="text-slate-300">Enable Intentional Double-Blink</span>
              <input
                type="checkbox"
                checked={config.enableDoubleBlink}
                onChange={(e) => onConfigChange({ ...config, enableDoubleBlink: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 rounded"
              />
            </label>
            <label className="flex items-center justify-between text-xs cursor-pointer">
              <span className="text-slate-300">Enable Sustained Long Blink ({config.longBlinkDurationMs}ms)</span>
              <input
                type="checkbox"
                checked={config.enableLongBlink}
                onChange={(e) => onConfigChange({ ...config, enableLongBlink: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 rounded"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
