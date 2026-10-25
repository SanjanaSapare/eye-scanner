import React from 'react';
import {
  BookOpen,
  CheckCircle2,
  Cpu,
  Layers,
  Shield,
  Eye,
  Sliders,
  Terminal,
  ExternalLink,
  Zap,
} from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-2">
          AccessScan: Blink-to-Select Engineering Reference Manual
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Comprehensive guide for architecting an assistive, local computer-vision switch trigger inside a Manifest V3 Chrome Extension.
        </p>
      </div>

      {/* 1. Library Recommendation */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-cyan-400">
          <Cpu className="w-5 h-5" />
          <h3 className="text-base font-semibold text-slate-100">
            1. Library Recommendation: Google MediaPipe Face Landmarker (WebAssembly)
          </h3>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          For a Manifest V3 Chrome Extension, <strong className="text-cyan-400">Google MediaPipe Face Landmarker via @mediapipe/tasks-vision</strong> is the clear industry recommendation over TensorFlow.js, clmtrackr, or tracking.js.
        </p>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
            <thead className="bg-slate-950 text-slate-300 font-mono">
              <tr>
                <th className="p-3 border-b border-slate-800">Criteria</th>
                <th className="p-3 border-b border-slate-800 text-cyan-400">MediaPipe Tasks Vision</th>
                <th className="p-3 border-b border-slate-800 text-slate-400">TensorFlow.js (FaceMesh)</th>
                <th className="p-3 border-b border-slate-800 text-slate-400">clmtrackr / tracking.js</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              <tr>
                <td className="p-3 font-medium">Inference Speed (FPS)</td>
                <td className="p-3 text-emerald-400 font-mono font-semibold">45–60 FPS (WebGL / WASM SIMD)</td>
                <td className="p-3 font-mono">20–30 FPS</td>
                <td className="p-3 font-mono text-red-400">10–15 FPS (High jitter)</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Landmark Density</td>
                <td className="p-3 text-cyan-400 font-semibold">478 3D sub-pixel points</td>
                <td className="p-3">468 points</td>
                <td className="p-3 text-slate-500">71 points (Insufficient for EAR)</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Memory / CPU Overhead</td>
                <td className="p-3 text-emerald-400 font-semibold">Low (~15MB RAM, ~4% CPU)</td>
                <td className="p-3">High (~80MB RAM, ~18% CPU)</td>
                <td className="p-3">Moderate</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">MV3 Offline Compatibility</td>
                <td className="p-3 text-emerald-400 font-semibold">100% Local (Bundled WASM)</td>
                <td className="p-3">Requires extensive shims</td>
                <td className="p-3 text-slate-500">Outdated</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs text-slate-300">
          <div className="font-semibold text-slate-200">Why this matters for AccessScan:</div>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Sub-pixel eyelid coordinates allow detecting minute eyelid closures even with eyeglasses or drooping lids.</li>
            <li>Runs on integrated laptop GPUs and low-end Chromebooks commonly used in educational and clinical assistive setups.</li>
            <li>Zero external API dependencies: complies with Chrome Web Store strict MV3 privacy policies.</li>
          </ul>
        </div>
      </section>

      {/* 2. Architecture & Manifest V3 Setup */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-cyan-400">
          <Shield className="w-5 h-5" />
          <h3 className="text-base font-semibold text-slate-100">
            2. Manifest V3 Architecture & Offscreen Document Setup
          </h3>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          Manifest V3 enforces two strict rules that make computer vision unique:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              Constraint 1: No getUserMedia in Service Workers
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              In MV3, background scripts are short-lived Service Workers without DOM access or camera streaming capabilities.
            </p>
          </div>
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
            <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">
              Constraint 2: Do Not Run Camera in Content Script
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Injecting the webcam stream directly into host web pages prompts camera permissions on every single domain and can lag the target page.
            </p>
          </div>
        </div>

        {/* The Solution: Chrome Offscreen API */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-200">
            The Solution: The Chrome Offscreen API (<code className="text-cyan-400">chrome.offscreen</code>)
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            The background service worker creates a hidden, sandboxed HTML document (<code className="text-slate-200">offscreen.html</code>) with the reason <code className="text-cyan-300">USER_MEDIA</code>. This provides a full DOM environment with video streaming, WebGL, and WebAssembly while remaining completely invisible to the user.
          </p>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300">
            <pre>
{`await chrome.offscreen.createDocument({
  url: 'offscreen.html',
  reasons: [chrome.offscreen.Reason.USER_MEDIA],
  justification: 'Access webcam to calculate EAR for assistive switch activation.'
});`}
            </pre>
          </div>
        </div>
      </section>

      {/* 3. The Blink Detection Algorithm (EAR) */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-cyan-400">
          <Eye className="w-5 h-5" />
          <h3 className="text-base font-semibold text-slate-100">
            3. The Eye Aspect Ratio (EAR) & Double-Blink State Machine
          </h3>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          Soukupová & Čech (2016) defined the Eye Aspect Ratio (EAR) using 6 landmark coordinates per eye. As the eye closes, the vertical numerator rapidly approaches zero while the horizontal denominator remains constant:
        </p>

        {/* Mathematical Formula Display */}
        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-center font-mono text-sm text-cyan-300">
          EAR = ( ||p2 - p6|| + ||p3 - p5|| ) / ( 2 * ||p1 - p4|| )
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <div className="font-semibold text-slate-200">Left Eye Landmark Indices (MediaPipe):</div>
            <div className="text-slate-400 font-mono">
              Corners: p1=33 (outer), p4=133 (inner)<br />
              Top: p2=160, p3=158<br />
              Bottom: p6=144, p5=153
            </div>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <div className="font-semibold text-slate-200">Right Eye Landmark Indices (MediaPipe):</div>
            <div className="text-slate-400 font-mono">
              Corners: p1=362 (inner), p4=263 (outer)<br />
              Top: p2=385, p3=387<br />
              Bottom: p6=380, p5=373
            </div>
          </div>
        </div>

        {/* State Machine Diagram */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-200">Double-Blink State Machine Architecture</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            A natural blink lasts 100ms–200ms and occurs spontaneously. To prevent accidental page activations, the state machine requires two deliberate closures within a configurable time window:
          </p>

          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
            <pre>
{`[ IDLE ]
   │
   ▼ (EAR < BLINK_THRESHOLD)
[ FIRST_BLINK_CLOSING ]
   │
   ▼ (EAR >= BLINK_THRESHOLD within MIN_DURATION...MAX_DURATION)
[ FIRST_BLINK_OPENED ]
   │
   ├─▶ (Time > DOUBLE_BLINK_TIME_WINDOW) ──▶ [ Reset to IDLE (Natural single blink) ]
   │
   ▼ (EAR < BLINK_THRESHOLD within window)
[ SECOND_BLINK_CLOSING ]
   │
   ▼ (EAR >= BLINK_THRESHOLD)
[ TRIGGER SWITCH ACTIVATION! ]
   │
   ▼ (Cooldown REFRACTORY_PERIOD ~600ms)
[ IDLE ]`}
            </pre>
          </div>
        </div>

        {/* Tunable Variables */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-200">Primary Tunable Variables</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="font-mono text-cyan-400 font-semibold">BLINK_THRESHOLD = 0.22</span>
              <p className="text-slate-400 mt-0.5">Below this EAR, eyelids are considered closed.</p>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="font-mono text-cyan-400 font-semibold">DOUBLE_BLINK_TIME_WINDOW = 480ms</span>
              <p className="text-slate-400 mt-0.5">Maximum elapsed time allowed between blinks.</p>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="font-mono text-cyan-400 font-semibold">MIN_BLINK_DURATION = 60ms</span>
              <p className="text-slate-400 mt-0.5">Filters out webcam dropped frames or micro-twitches.</p>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="font-mono text-cyan-400 font-semibold">REFRACTORY_PERIOD = 650ms</span>
              <p className="text-slate-400 mt-0.5">Prevents triple-blinks from double-firing the switch.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Integration with Existing Logic */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-cyan-400">
          <Zap className="w-5 h-5" />
          <h3 className="text-base font-semibold text-slate-100">
            4. Integration with Existing Content Script Logic
          </h3>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          In AccessScan, your content script sequentially highlights DOM elements and activates them via <code className="text-slate-200">handleSwitchActivation()</code>. The blink engine triggers this seamlessly via Chrome runtime messaging:
        </p>

        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
          <pre>
{`// content.js - Listen for vision events alongside physical switch:
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SWITCH_TRIGGERED') {
    // Triggers the EXACT same code path as pressing the Spacebar!
    handleSwitchActivation(message.source || 'blink');
    sendResponse({ status: 'activated' });
  }
});

// Existing physical switch fallback:
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !isTypingInInput(document.activeElement)) {
    e.preventDefault();
    handleSwitchActivation('physical-spacebar');
  }
});`}
          </pre>
        </div>
      </section>

      {/* 5. Fallback & Calibration UX */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-cyan-400">
          <Sliders className="w-5 h-5" />
          <h3 className="text-base font-semibold text-slate-100">
            5. Fallback & Calibration UX Strategy
          </h3>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="font-semibold text-cyan-300">Personalized 2-Step Calibration Wizard:</span>
            <p className="text-slate-400 leading-relaxed">
              Because resting EAR ranges from 0.25 to 0.40 depending on facial structure and camera angles, hardcoding 0.20 can cause false negatives. A 6-second onboarding prompt asks the user to look forward (records <code className="text-slate-200">EAR_open</code>) and close eyes (records <code className="text-slate-200">EAR_closed</code>), then computes <code className="text-cyan-300">Threshold = EAR_closed + 0.35 * (EAR_open - EAR_closed)</code>.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="font-semibold text-emerald-300">Auditory & Visual Biofeedback:</span>
            <p className="text-slate-400 leading-relaxed">
              Users with motor limitations cannot quickly glance at telemetry. Subtle high-frequency audio tones confirm when the first blink registers, followed by a resonant chime when the second blink confirms the switch selection.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="font-semibold text-amber-300">Graceful Fallback Matrix:</span>
            <p className="text-slate-400 leading-relaxed">
              If lighting is insufficient or the user experiences fatigue, the physical switch (Spacebar or adaptive USB switch) remains permanently active simultaneously. Either input invokes <code className="text-slate-200">handleSwitchActivation()</code> without requiring any mode toggling.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
