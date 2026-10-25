/**
 * Production-ready Manifest V3 Chrome Extension code artifacts for AccessScan
 */

export interface ExtensionFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const EXTENSION_FILES: ExtensionFile[] = [
  {
    name: 'manifest.json',
    path: 'manifest.json',
    language: 'json',
    description: 'Manifest V3 configuration with Offscreen document, WASM CSP, and userMedia permissions',
    content: `{
  "manifest_version": 3,
  "name": "AccessScan - Assistive Switch Browser",
  "version": "1.0.0",
  "description": "Sequential switch-accessible web navigation with local Eye Blink-to-Select vision detection.",
  "permissions": [
    "offscreen",
    "storage",
    "tabs",
    "activeTab"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "AccessScan Settings & Calibration"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "web_accessible_resources": [
    {
      "resources": ["models/*", "wasm/*"],
      "matches": ["<all_urls>"]
    }
  ]
}`,
  },
  {
    name: 'background.js',
    path: 'background.js',
    language: 'javascript',
    description: 'Service Worker: Manages Offscreen Document lifecycle and relays switch select messages to active tabs',
    content: `/**
 * AccessScan Background Service Worker (Manifest V3)
 * Manages the headless Offscreen Document for webcam capture and MediaPipe vision.
 */

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// 1. Ensure Offscreen Document exists when vision scanning is requested
async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Continuously access webcam to calculate Eye Aspect Ratio (EAR) for assistive switch activation.'
  });
  console.log('[AccessScan] Offscreen vision document created.');
}

// 2. Check if offscreen document is already open
async function hasOffscreenDocument() {
  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
    });
    return contexts.length > 0;
  }
  return false;
}

// 3. Close offscreen document to release camera when inactive
async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
    console.log('[AccessScan] Offscreen document closed. Camera released.');
  }
}

// 4. Initialize offscreen document on extension launch / install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[AccessScan] Extension installed.');
  // Default configuration
  chrome.storage.sync.set({
    scanningActive: true,
    earThreshold: 0.22,
    doubleBlinkWindowMs: 480,
    minBlinkDurationMs: 60,
    enableDoubleBlink: true,
    enableLongBlink: false
  });
  await ensureOffscreenDocument();
});

// 5. Message router: Handle incoming messages from Offscreen or Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // A. Blink trigger detected in offscreen vision runner
  if (message.type === 'SWITCH_SELECT') {
    // Forward the switch activation directly to the active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SWITCH_TRIGGERED',
          source: message.source || 'blink',
          gesture: message.gesture,
          timestamp: Date.now()
        }).catch((err) => {
          // Tab might not have content script loaded (e.g. chrome:// internal pages)
          console.warn('[AccessScan] Active tab unreachable:', err.message);
        });
      }
    });
    sendResponse({ received: true });
    return true;
  }

  // B. Toggle scanning state from popup or keyboard shortcut
  if (message.type === 'TOGGLE_SCANNING') {
    if (message.enabled) {
      ensureOffscreenDocument();
    } else {
      closeOffscreenDocument();
    }
    sendResponse({ status: 'updated' });
    return true;
  }
});
`,
  },
  {
    name: 'offscreen.html',
    path: 'offscreen.html',
    language: 'html',
    description: 'Headless DOM environment containing the hidden webcam video element and MediaPipe runner',
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AccessScan Vision Engine</title>
</head>
<body>
  <!-- Hidden video stream for webcam frames -->
  <video id="webcam" autoplay playsinline muted style="display:none; width:320px; height:240px;"></video>
  <script type="module" src="offscreen.js"></script>
</body>
</html>
`,
  },
  {
    name: 'offscreen.js',
    path: 'offscreen.js',
    language: 'javascript',
    description: 'Local Computer Vision Engine: Runs MediaPipe FaceLandmarker WASM, calculates EAR, and detects intentional double-blinks',
    content: `/**
 * AccessScan Offscreen Document Vision Engine
 * Runs 100% locally in the browser sandbox.
 */

// Import MediaPipe Tasks Vision (bundled locally in extension /wasm/ and /models/)
import { FilesetResolver, FaceLandmarker } from './libs/tasks-vision.js';

let faceLandmarker = null;
let video = null;
let isRunning = false;

// Configurable parameters with sensible accessibility defaults
let CONFIG = {
  earThreshold: 0.22,
  minBlinkDurationMs: 60,
  maxBlinkDurationMs: 350,
  doubleBlinkWindowMs: 480,
  refractoryPeriodMs: 650,
  enableDoubleBlink: true,
  enableLongBlink: false,
  longBlinkDurationMs: 550
};

// Double-Blink State Machine Tracker
let blinkState = 'IDLE'; // 'IDLE' | 'FIRST_CLOSING' | 'FIRST_OPENED' | 'SECOND_CLOSING' | 'REFRACTORY'
let firstBlinkStart = 0;
let firstBlinkEnd = 0;
let secondBlinkStart = 0;
let refractoryStart = 0;

// Load user settings from chrome.storage
chrome.storage.sync.get(CONFIG, (items) => {
  CONFIG = { ...CONFIG, ...items };
});

chrome.storage.onChanged.addListener((changes) => {
  for (let [key, { newValue }] of Object.entries(changes)) {
    if (key in CONFIG) CONFIG[key] = newValue;
  }
});

// Euclidean distance helper
function dist(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Calculate EAR using 6 contour landmarks per eye
function calculateEAR(landmarks) {
  // Left eye landmarks: 33 (outer), 133 (inner), 160, 158 (top), 144, 153 (bottom)
  const l_v1 = dist(landmarks[160], landmarks[144]);
  const l_v2 = dist(landmarks[158], landmarks[153]);
  const l_h  = dist(landmarks[33], landmarks[133]);
  const leftEAR = (l_v1 + l_v2) / (2.0 * l_h);

  // Right eye landmarks: 362 (inner), 263 (outer), 385, 387 (top), 380, 373 (bottom)
  const r_v1 = dist(landmarks[385], landmarks[380]);
  const r_v2 = dist(landmarks[387], landmarks[373]);
  const r_h  = dist(landmarks[362], landmarks[263]);
  const rightEAR = (r_v1 + r_v2) / (2.0 * r_h);

  return (leftEAR + rightEAR) / 2.0;
}

// Intentional Blink State Machine processor
function evaluateBlink(avgEAR, now) {
  const isClosed = avgEAR < CONFIG.earThreshold;

  // 1. Refractory cooldown
  if (blinkState === 'REFRACTORY') {
    if (now - refractoryStart > CONFIG.refractoryPeriodMs && !isClosed) {
      blinkState = 'IDLE';
    }
    return;
  }

  // 2. Double-blink state machine
  switch (blinkState) {
    case 'IDLE':
      if (isClosed) {
        firstBlinkStart = now;
        blinkState = 'FIRST_CLOSING';
      }
      break;

    case 'FIRST_CLOSING':
      if (!isClosed) {
        const duration = now - firstBlinkStart;
        if (duration >= CONFIG.minBlinkDurationMs && duration <= CONFIG.maxBlinkDurationMs) {
          firstBlinkEnd = now;
          blinkState = 'FIRST_OPENED';
        } else {
          // Duration too short (noise) or too long -> discard
          blinkState = 'IDLE';
        }
      }
      break;

    case 'FIRST_OPENED':
      // Timeout check: if user didn't initiate second blink in time, reset
      if (now - firstBlinkEnd > CONFIG.doubleBlinkWindowMs) {
        blinkState = 'IDLE';
        break;
      }
      if (isClosed) {
        secondBlinkStart = now;
        blinkState = 'SECOND_CLOSING';
      }
      break;

    case 'SECOND_CLOSING':
      if (!isClosed) {
        const duration = now - secondBlinkStart;
        if (duration >= CONFIG.minBlinkDurationMs && duration <= CONFIG.maxBlinkDurationMs) {
          // Intentional Double-Blink Verified!
          triggerSwitchSelect('double-blink');
          refractoryStart = now;
          blinkState = 'REFRACTORY';
        } else {
          blinkState = 'IDLE';
        }
      }
      break;
  }
}

function triggerSwitchSelect(gesture) {
  console.log('[AccessScan Vision] Switch Triggered via gesture:', gesture);
  chrome.runtime.sendMessage({
    type: 'SWITCH_SELECT',
    source: 'blink',
    gesture: gesture,
    timestamp: Date.now()
  });
}

// Initialize webcam and model pipeline
async function initVisionEngine() {
  video = document.getElementById('webcam');

  // Request camera stream (downscaled for high FPS and low CPU load)
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 320 },
      height: { ideal: 240 },
      frameRate: { ideal: 30 }
    },
    audio: false
  });
  video.srcObject = stream;
  await video.play();

  // Initialize MediaPipe FaceLandmarker with local WebAssembly
  const vision = await FilesetResolver.forVisionTasks('./wasm');
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: './models/face_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numFaces: 1
  });

  isRunning = true;
  requestAnimationFrame(processVideoFrame);
  console.log('[AccessScan] Vision pipeline active and scanning frames.');
}

function processVideoFrame() {
  if (!isRunning) return;

  if (video.readyState >= 2 && faceLandmarker) {
    const results = faceLandmarker.detectForVideo(video, performance.now());
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      const landmarks = results.faceLandmarks[0];
      const avgEAR = calculateEAR(landmarks);
      evaluateBlink(avgEAR, Date.now());
    }
  }

  requestAnimationFrame(processVideoFrame);
}

initVisionEngine().catch((err) => {
  console.error('[AccessScan] Vision engine initialization failed:', err);
});
`,
  },
  {
    name: 'content.js',
    path: 'content.js',
    language: 'javascript',
    description: 'Injected Content Script: Sequential DOM element scanner, keyboard switch listener, and handleSwitchActivation() integration',
    content: `/**
 * AccessScan Content Script
 * Sequential DOM scanner and switch activation handler.
 */

// State variables for DOM scanning
let scanningInterval = null;
let currentIndex = -1;
let scanSpeedMs = 1500;
let interactiveElements = [];
let highlightBox = null;

// 1. Create high-contrast accessibility highlight box
function createHighlightBox() {
  if (highlightBox) return highlightBox;
  highlightBox = document.createElement('div');
  highlightBox.id = 'access-scan-highlight-box';
  highlightBox.style.position = 'absolute';
  highlightBox.style.pointerEvents = 'none';
  highlightBox.style.zIndex = '2147483647';
  highlightBox.style.boxShadow = '0 0 0 4px #06b6d4, 0 0 12px rgba(6,182,212,0.8)';
  highlightBox.style.borderRadius = '4px';
  highlightBox.style.transition = 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)';
  highlightBox.style.display = 'none';
  document.body.appendChild(highlightBox);
  return highlightBox;
}

// 2. Discover all visible, interactive DOM elements
function findInteractiveElements() {
  const selector = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
  const nodes = Array.from(document.querySelectorAll(selector));

  // Filter only visible elements with real dimensions
  return nodes.filter((el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
  });
}

// 3. Highlight current element
function highlightElement(el) {
  if (!el) return;
  const box = createHighlightBox();
  const rect = el.getBoundingClientRect();
  box.style.display = 'block';
  box.style.top = (rect.top + window.scrollY - 2) + 'px';
  box.style.left = (rect.left + window.scrollX - 2) + 'px';
  box.style.width = (rect.width + 4) + 'px';
  box.style.height = (rect.height + 4) + 'px';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 4. Sequential stepping engine
function startScanning() {
  stopScanning();
  interactiveElements = findInteractiveElements();
  if (interactiveElements.length === 0) return;

  currentIndex = 0;
  highlightElement(interactiveElements[currentIndex]);

  scanningInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % interactiveElements.length;
    highlightElement(interactiveElements[currentIndex]);
  }, scanSpeedMs);
}

function stopScanning() {
  if (scanningInterval) clearInterval(scanningInterval);
  if (highlightBox) highlightBox.style.display = 'none';
}

/**
 * 5. CORE INTEGRATION: handleSwitchActivation()
 * Executed identically whether triggered by physical Spacebar or Blink-to-Select vision engine!
 */
function handleSwitchActivation(source = 'unknown') {
  if (currentIndex < 0 || currentIndex >= interactiveElements.length) return;

  const target = interactiveElements[currentIndex];
  console.log('[AccessScan] Switch activated via:', source, 'on element:', target);

  // Visual pulse on the highlight box
  if (highlightBox) {
    highlightBox.style.boxShadow = '0 0 0 6px #10b981, 0 0 20px rgba(16,185,129,0.9)';
    setTimeout(() => {
      if (highlightBox) {
        highlightBox.style.boxShadow = '0 0 0 4px #06b6d4, 0 0 12px rgba(6,182,212,0.8)';
      }
    }, 300);
  }

  // Trigger click or focus
  target.focus();
  target.click();

  // If input or textarea, user can now interact
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    // Optionally pause scan while typing
  }
}

// 6. Listen for Chrome runtime messages from Background Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SWITCH_TRIGGERED') {
    handleSwitchActivation(message.source || 'blink');
    sendResponse({ handled: true });
  }
});

// 7. Physical Switch fallback (Spacebar keydown)
window.addEventListener('keydown', (e) => {
  // If user hits Spacebar and is not actively typing in a text field
  const activeEl = document.activeElement;
  const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

  if (e.code === 'Space' && !isTyping) {
    e.preventDefault();
    handleSwitchActivation('physical-switch-spacebar');
  }
});

// Auto-start scanning on page load
startScanning();
`,
  },
  {
    name: 'popup.html',
    path: 'popup.html',
    language: 'html',
    description: 'Extension options and calibration popup with live sensitivity sliders and blink testing',
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AccessScan Calibration</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      width: 320px;
      margin: 0;
      padding: 16px;
      background: #0f172a;
      color: #f1f5f9;
    }
    h2 { margin: 0 0 8px 0; font-size: 16px; color: #38bdf8; }
    p { font-size: 12px; color: #94a3b8; margin: 0 0 16px 0; }
    .control { margin-bottom: 12px; }
    label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
    input[type=range] { width: 100%; accent-color: #06b6d4; }
    .btn {
      width: 100%;
      background: #0284c7;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      margin-top: 8px;
    }
    .btn:hover { background: #0369a1; }
    .status-badge {
      padding: 8px;
      background: #1e293b;
      border-radius: 6px;
      font-size: 12px;
      text-align: center;
      margin-top: 12px;
      border: 1px solid #334155;
    }
  </style>
</head>
<body>
  <h2>AccessScan Calibration</h2>
  <p>Tune Eye Aspect Ratio (EAR) sensitivity for Blink-to-Select.</p>

  <div class="control">
    <label>
      <span>EAR Closure Threshold</span>
      <span id="val-ear">0.22</span>
    </label>
    <input type="range" id="input-ear" min="0.12" max="0.32" step="0.01" value="0.22">
  </div>

  <div class="control">
    <label>
      <span>Double-Blink Max Window</span>
      <span id="val-window">480ms</span>
    </label>
    <input type="range" id="input-window" min="250" max="800" step="10" value="480">
  </div>

  <button class="btn" id="btn-calibrate">Open Full Screen Calibration</button>
  <div class="status-badge" id="test-indicator">Blink twice to test trigger</div>

  <script src="popup.js"></script>
</body>
</html>
`,
  },
  {
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    description: 'Deployment and installation guide for Google Chrome Manifest V3',
    content: `# AccessScan Manifest V3 Chrome Extension

## How to Install in Google Chrome
1. Open Chrome and navigate to \`chrome://extensions/\`.
2. Toggle **Developer mode** on (top right switch).
3. Click **Load unpacked** and select this directory.
4. AccessScan will appear in your extensions toolbar. Click the icon to view or calibrate your camera sensitivity!

## Architecture Summary
- **Offscreen Document (\`offscreen.html\`)**: Captures webcam stream without asking permissions on every website or burdening the active browsing tab.
- **MediaPipe Tasks Vision**: Executes sub-pixel 3D face mesh landmarker in local WebAssembly.
- **Eye Aspect Ratio (EAR)**: Computes eyelid aperture across frames.
- **Double-Blink State Machine**: Rejects accidental single blinks and isolates intentional double-blinks.
- **Content Script (\`content.js\`)**: Injects sequential switch scanning box and activates \`handleSwitchActivation()\`.
`,
  },
];
