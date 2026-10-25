# AccessScan: Blink-to-Select Vision Engine for Manifest V3

A complete architectural specification, computer vision pipeline, and interactive companion web laboratory for **AccessScan**—an assistive switch-access Chrome extension (Manifest V3) that empowers users with severe motor impairments to control web navigation through intentional double-blinks.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural parameters have been established based on your project requirements and clarifications:

- **Confirmed Decision 1 (Primary Gesture Trigger)**: **Double-blink with adjustable time window** (default 200ms–500ms between blinks) configured as the primary selector, with optional toggle for sustained long blink (>500ms).
- **Confirmed Decision 2 (Companion Experience)**: **Live webcam calibration lab and full extension code explorer**, enabling real-time visual testing of EAR (Eye Aspect Ratio), sensitivity tuning, and a 1-click exporter for all Manifest V3 extension files.
- **Confirmed Decision 3 (Model Strategy)**: **Self-contained local bundle with Google MediaPipe Vision Tasks (FaceLandmarker via WebAssembly)** running 100% locally in the browser with zero external network dependencies, privacy-first camera handling, and optimal frame rates.

---

## 1. Overview & Core Concept

### What It Does
**AccessScan** is a switch-accessible web navigation tool designed for individuals with quadriplegia, ALS, cerebral palsy, and other severe motor disabilities. While standard switch access relies on physical buttons (e.g. Buddy Buttons, Jelly Bean switches, or spacebar input) to step through and activate DOM elements, **Blink-to-Select** upgrades this by using the user's webcam and local computer vision.

When a user intentionally performs a deliberate **double-blink** (two rapid blinks within a calibrated timing window), the vision engine generates a switch activation event that triggers `handleSwitchActivation()`, selecting the highlighted element in the active tab without requiring any physical movement.

### Target Audience & Accessibility Persona
- **Users**: Individuals with severe physical limitations who retain reliable voluntary eyelid control.
- **Environment**: Modern Chromium browsers on laptop or desktop webcams, under standard domestic or clinical lighting conditions.
- **Privacy & Safety**: Zero frames leave the user's computer. The camera stream is isolated strictly to a headless extension sandbox (Chrome Offscreen Document) and terminates automatically when inactive.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Companion & Calibration Lab View**:
   - The user opens the calibration interface.
   - The system requests webcam access and initializes the MediaPipe Face Mesh / Face Landmarker model locally.
   - The user sees a real-time HUD with their face mesh, eye landmark points (6 key points per eye), and dynamic real-time EAR gauge charts.
   - The user tests natural blinks vs. intentional double-blinks with instant auditory/visual feedback.
   - Calibration wizard lets them record their personal baseline "Eyes Open EAR" and "Eyes Closed EAR" to auto-tune the threshold.

2. **AccessScan Extension File Explorer & Documentation**:
   - Tabbed or multi-panel code viewer presenting each ready-to-use Manifest V3 component:
     - `manifest.json` (declarations, permissions, CSP, offscreen reasons)
     - `background.js` (service worker managing offscreen document lifecycle and tab routing)
     - `offscreen.html` & `offscreen.js` (isolated camera feed, MediaPipe WASM runner, EAR processor)
     - `content.js` (DOM element highlighter, scanning loop, and message listener dispatching to `handleSwitchActivation`)
     - `calibration.html` / `popup.html` (user options, slider controls, visual switch indicator)
   - 1-click "Copy File" and "Export Extension ZIP" options.

3. **Interactive Switch-Access Sandbox**:
   - An embedded mock webpage (simulating an accessible web form, navigation menu, and action grid).
   - Demonstrates the sequential scanning ring advancing through interactive items every 1.5 seconds.
   - The live webcam blink engine or manual spacebar triggers selection in real time, validating the end-to-end integration.

### Visual Identity & Theme
- **Aesthetic Direction**: High-contrast, clean, utilitarian accessibility engineering console.
- **Palette**: Deep slate canvas (`#0b0f19`), crisp cool-slate containers (`#111827`), high-contrast accessible teal/cyan primary accent (`#06b6d4` / `#0ea5e9`), signal amber for threshold margins (`#f59e0b`), and electric emerald for verified switch triggers (`#10b981`).
- **Typography**: Clean sans headers with tabular numerals (`tabular-nums font-mono`) for precision EAR values, frame timestamps, and detection latency.

---

## 3. Key Product Decisions & Technical Deep Dive

### 1. Library Recommendation: Google MediaPipe Face Landmarker (WebAssembly)
- **Recommendation**: `@mediapipe/tasks-vision` (or `@tensorflow-models/face-landmarks-detection` with MediaPipe runtime).
- **Why it wins for Manifest V3**:
  1. **Blazing Fast on CPU/GPU**: Runs at 30–60 FPS on standard integrated laptop GPUs using WebGL / WebAssembly SIMD (~3MB binary, ~1.5MB model).
  2. **Sub-pixel Eyelid Precision**: Provides 478 3D facial landmarks with dedicated eye contours (landmarks 33, 160, 158, 133, 153, 144 for left eye; 362, 385, 387, 263, 373, 380 for right eye).
  3. **Zero Server Dependency**: Operates entirely offline in compliance with Chrome Web Store strict MV3 privacy requirements.

### 2. Manifest V3 Chrome Extension Architecture
Manifest V3 forbids persistent background scripts and prohibits `navigator.mediaDevices.getUserMedia()` inside Background Service Workers. Running heavy video streams directly in the content script can degrade host webpage responsiveness and trigger permissions friction on every visited site.

The gold-standard MV3 architecture utilizes an **Offscreen Document**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MANIFEST V3 EXTENSION                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │   Background Service  │  Launches   │     Offscreen Document     │  │
│  │         Worker        │────────────▶│       (offscreen.html)     │  │
│  │    (background.js)    │             │                            │  │
│  └───────────┬───────────┘             │  • getUserMedia (Webcam)   │  │
│              │                         │  • MediaPipe Vision WASM   │  │
│              │ Relays Blink Event      │  • EAR Calculation Engine  │  │
│              │                         │  • Double-Blink Detector   │  │
│              ▼                         └─────────────┬──────────────┘  │
│  ┌───────────────────────┐                           │                 │
│  │  Active Content Tab   │◀──────────────────────────┘                 │
│  │     (content.js)      │   chrome.runtime.sendMessage /              │
│  │                       │   chrome.tabs.sendMessage                  │
│  │ • Sequential Scanner  │                                             │
│  │ • Switch Activation   │                                             │
│  └───────────────────────┘                                             │
└────────────────────────────────────────────────────────────────────────┘
```

1. **`chrome.offscreen.createDocument`**: Created by the background worker with reasons `["USER_MEDIA"]` and justification `"Access webcam for assistive blink detection"`.
2. **Headless Execution**: The offscreen document runs in its own private sandboxed DOM context, keeping the user's active browsing tab completely unburdened.
3. **Low-Latency Messaging**: When an intentional double-blink is verified, the offscreen script dispatches `chrome.runtime.sendMessage({ type: "SWITCH_SELECT", source: "blink" })`.
4. **Content Script Dispatch**: The active tab's content script receives the message and triggers `handleSwitchActivation()`.

### 3. The Eye Aspect Ratio (EAR) & Double-Blink State Machine

#### EAR Mathematical Formula
For each eye, EAR measures the vertical eyelid opening relative to the horizontal eye width:

$$\text{EAR} = \frac{|p_2 - p_6| + |p_3 - p_5|}{2 \times |p_1 - p_4|}$$

Where:
- $p_1, p_4$ are the inner and outer eye corners (horizontal axis).
- $p_2, p_6$ and $p_3, p_5$ are the upper and lower eyelid landmark pairs (vertical axis).

#### Intentional Double-Blink vs. Natural Blink State Machine
A natural involuntary blink lasts between $100\text{ms}$ and $200\text{ms}$, occurring every few seconds with single closures. An intentional double-blink is two deliberate eyelid closures performed back-to-back within a defined temporal window:

```
[ IDLE ] ──(EAR < THRESHOLD)──▶ [ FIRST_BLINK_CLOSING ]
                                         │
                             (Duration 60ms - 350ms)
                                         ▼
                                [ FIRST_BLINK_OPENED ]
                                         │
                             (Wait 80ms - 450ms for Blink 2)
                                         ▼
                                [ SECOND_BLINK_CLOSING ]
                                         │
                             (Duration 60ms - 350ms)
                                         ▼
                              [ TRIGGER SWITCH EVENT ]
                                         │
                             (Refractory Cooldown ~600ms)
                                         ▼
                                      [ IDLE ]
```

---

## 4. Implementation Structure & Components

### Web Companion Application Features:
1. **Interactive Camera & Mesh Playground**:
   - Live video stream toggle with optional camera selection.
   - Canvas overlay rendering face bounds, iris, and EAR landmark lines.
   - Real-time rolling EAR chart showing both left and right eye metrics.
2. **Tunable Calibration System**:
   - `BLINK_THRESHOLD` (default ~0.21, calibrated based on user's open/closed EAR ratio).
   - `MIN_BLINK_DURATION` (e.g., 60ms to reject micro-flutters/noise).
   - `MAX_BLINK_DURATION` (e.g., 350ms to reject slow restful eyelid drooping).
   - `DOUBLE_BLINK_WINDOW` (e.g., 450ms maximum interval between blinks).
   - `REFRACTORY_PERIOD` (e.g., 600ms to prevent accidental triple-triggering).
3. **Simulated Switch-Access Webpage**:
   - Sequential scanning ring that cycles through buttons, links, and text inputs.
   - Shows audio and visual feedback whenever a switch activation occurs (via Spacebar or Blink).
4. **Complete Manifest V3 Chrome Extension Code Center**:
   - Interactive syntax-highlighted code viewer for all 6 required files.
   - Copyable files with complete inline comments and installation instructions for `chrome://extensions`.

---

## 5. Verification Plan

- **Compilation & Syntax**: Run `compile_applet` to confirm clean TypeScript and zero build errors.
- **Webcam Compatibility**: Test camera feed initialization, fallback if camera is blocked/denied, and synthetic landmark simulator if no physical camera is attached.
- **EAR Calculation & Detection**: Verify the state machine transitions between Idle, Single Blink, and Intentional Double Blink, triggering selection events without false positives.
- **Extension Code Completeness**: Validate that all Manifest V3 code snippets strictly adhere to MV3 APIs (`chrome.offscreen`, `chrome.runtime`, CSP, service workers).
