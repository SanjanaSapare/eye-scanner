import React, { useState } from 'react';
import {
  Eye,
  Sliders,
  FileCode,
  BookOpen,
  Download,
  Sparkles,
  CheckCircle,
  Accessibility,
} from 'lucide-react';
import { CalibrationLab } from './components/CalibrationLab.tsx';
import { SwitchSandbox } from './components/SwitchSandbox.tsx';
import { ExtensionExplorer } from './components/ExtensionExplorer.tsx';
import { ArchitectureGuide } from './components/ArchitectureGuide.tsx';
import { BlinkDetectorConfig, DEFAULT_CONFIG } from './services/blinkDetector.ts';
import { EXTENSION_FILES } from './data/extensionCode.ts';

type ActiveTab = 'lab' | 'sandbox' | 'explorer' | 'guide';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('lab');
  const [config, setConfig] = useState<BlinkDetectorConfig>(DEFAULT_CONFIG);

  // Cross-component trigger signals: when a blink occurs in CalibrationLab, it triggers the SwitchSandbox too!
  const [externalTriggerCount, setExternalTriggerCount] = useState<number>(0);
  const [lastTriggerSource, setLastTriggerSource] = useState<string>('Webcam Double-Blink');
  const [globalBanner, setGlobalBanner] = useState<string | null>(null);

  const handleBlinkTriggered = (source: string) => {
    setExternalTriggerCount((c) => c + 1);
    setLastTriggerSource(source);
    setGlobalBanner(`Switch Activated via ${source}!`);
    setTimeout(() => setGlobalBanner(null), 2500);
  };

  const downloadAllExtensionFiles = () => {
    EXTENSION_FILES.forEach((file, index) => {
      setTimeout(() => {
        const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }, index * 200);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (4 single-line links) — Zone 3 (1 primary CTA) */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-cyan-600 flex items-center justify-center text-white shadow-md shadow-cyan-900/20">
              <Eye className="w-5 h-5" />
            </div>
            <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
              AccessScan Vision Lab
            </span>
          </div>

          {/* Zone 2: 4 clean single-line nav links / segmented buttons */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('lab')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-2 ${
                activeTab === 'lab'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Vision & Calibration Lab
            </button>

            <button
              onClick={() => setActiveTab('sandbox')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-2 ${
                activeTab === 'sandbox'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Switch-Access Sandbox
            </button>

            <button
              onClick={() => setActiveTab('explorer')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-2 ${
                activeTab === 'explorer'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Manifest V3 Files
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-2 ${
                activeTab === 'guide'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Architecture Manual
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={downloadAllExtensionFiles}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Export MV3 Extension
            </button>
          </div>
        </div>
      </header>

      {/* Global Toast for Switch Trigger */}
      {globalBanner && (
        <div className="bg-cyan-900/90 border-b border-cyan-700 py-2 px-4 text-center text-xs font-semibold text-cyan-200 flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4 text-cyan-400" />
          <span>{globalBanner}</span>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Mobile Nav Tabs */}
        <div className="flex md:hidden overflow-x-auto gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 mb-6">
          <button
            onClick={() => setActiveTab('lab')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap ${
              activeTab === 'lab' ? 'bg-cyan-600 text-white' : 'text-slate-400'
            }`}
          >
            Vision Lab
          </button>
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap ${
              activeTab === 'sandbox' ? 'bg-cyan-600 text-white' : 'text-slate-400'
            }`}
          >
            Simulator
          </button>
          <button
            onClick={() => setActiveTab('explorer')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap ${
              activeTab === 'explorer' ? 'bg-cyan-600 text-white' : 'text-slate-400'
            }`}
          >
            MV3 Files
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap ${
              activeTab === 'guide' ? 'bg-cyan-600 text-white' : 'text-slate-400'
            }`}
          >
            Architecture
          </button>
        </div>

        {/* Tab 1: Vision Lab & Calibration */}
        {activeTab === 'lab' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-100">
                  Webcam Vision & EAR Calibration Console
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>Manifest V3 Offscreen Engine</span>
                  <span aria-hidden="true">·</span>
                  <span>MediaPipe Tasks Vision WASM</span>
                  <span aria-hidden="true">·</span>
                  <span>Double-Blink State Machine</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('sandbox')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  Test on Simulated Webpage &rarr;
                </button>
              </div>
            </div>

            <CalibrationLab
              onBlinkTriggered={handleBlinkTriggered}
              config={config}
              onConfigChange={setConfig}
            />
          </div>
        )}

        {/* Tab 2: Switch-Access Simulator */}
        {activeTab === 'sandbox' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-100">
                  Sequential Switch-Access Webpage Simulator
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>Sequential Focus Ring</span>
                  <span aria-hidden="true">·</span>
                  <span>Blink-to-Select Trigger</span>
                  <span aria-hidden="true">·</span>
                  <span>Physical Spacebar Fallback</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('lab')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  &larr; Return to Vision Lab
                </button>
              </div>
            </div>

            <SwitchSandbox
              externalTriggerSignal={externalTriggerCount}
              lastTriggerSource={lastTriggerSource}
            />
          </div>
        )}

        {/* Tab 3: Manifest V3 Extension Source Files */}
        {activeTab === 'explorer' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h1 className="text-xl font-bold text-slate-100">
                Complete Manifest V3 Chrome Extension Codebase
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span>6 Production Files</span>
                <span aria-hidden="true">·</span>
                <span>Offscreen Document Architecture</span>
                <span aria-hidden="true">·</span>
                <span>Zero External Network Calls</span>
              </div>
            </div>

            <ExtensionExplorer />
          </div>
        )}

        {/* Tab 4: Architecture Manual & Engineering Guide */}
        {activeTab === 'guide' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h1 className="text-xl font-bold text-slate-100">
                Technical Architecture & Implementation Manual
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span>Library Benchmarks</span>
                <span aria-hidden="true">·</span>
                <span>EAR Mathematical Formulas</span>
                <span aria-hidden="true">·</span>
                <span>State Machine Specifications</span>
              </div>
            </div>

            <ArchitectureGuide />
          </div>
        )}
      </main>

      {/* Clean Accessible Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Accessibility className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-300">AccessScan Assistive Tech</span>
            <span>·</span>
            <span>WCAG 2.2 Compliant Switch Navigation</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Runs 100% Client-Side in Google Chrome MV3</span>
            <span>·</span>
            <span className="font-mono text-slate-400">MediaPipe Vision Tasks WASM</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
