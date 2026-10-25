import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Bell,
  Sliders,
  Bed,
  Lightbulb,
  Music,
  MessageSquare,
  CheckCircle,
  HelpCircle,
  Volume2,
  Tv,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SwitchSandboxProps {
  externalTriggerSignal?: number; // increments when webcam double-blink occurs
  lastTriggerSource?: string;
}

interface SandboxItem {
  id: string;
  category: string;
  title: string;
  iconName: string;
  actionText: string;
}

export const SwitchSandbox: React.FC<SwitchSandboxProps> = ({
  externalTriggerSignal = 0,
  lastTriggerSource = 'Webcam Double-Blink',
}) => {
  // Scanning State
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scanSpeedMs, setScanSpeedMs] = useState<number>(1500);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  // Simulated Device States
  const [nurseCalled, setNurseCalled] = useState<boolean>(false);
  const [bedAngle, setBedAngle] = useState<number>(15);
  const [lightsOn, setLightsOn] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [tvOn, setTvOn] = useState<boolean>(false);
  const [lastMessageSent, setLastMessageSent] = useState<string>('Welcome to AccessScan');

  // Activation history log
  const [actionLogs, setActionLogs] = useState<
    { id: string; time: string; item: string; source: string }[]
  >([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString(),
      item: 'System Initialized',
      source: 'Auto-scan started',
    },
  ]);

  const items: SandboxItem[] = [
    { id: 'nurse', category: 'Assistance', title: 'Call Care Nurse', iconName: 'bell', actionText: 'Nurse Alert Dispatched' },
    { id: 'bed_up', category: 'Bed Control', title: 'Raise Bed Head (+10°)', iconName: 'bed', actionText: 'Bed Head Raised' },
    { id: 'bed_down', category: 'Bed Control', title: 'Lower Bed Head (-10°)', iconName: 'bed', actionText: 'Bed Head Lowered' },
    { id: 'lights', category: 'Environment', title: 'Toggle Room Lights', iconName: 'lightbulb', actionText: 'Room Lights Toggled' },
    { id: 'tv', category: 'Entertainment', title: 'Toggle Television', iconName: 'tv', actionText: 'TV Power Toggled' },
    { id: 'audio', category: 'Media', title: 'Audiobook: Chapter 4', iconName: 'music', actionText: 'Audiobook Playback Toggled' },
    { id: 'msg_water', category: 'Communication', title: 'Message: "Water Please"', iconName: 'message', actionText: 'Sent: "Water Please"' },
    { id: 'msg_family', category: 'Communication', title: 'Message: "Call Family"', iconName: 'message', actionText: 'Sent: "Call Family"' },
  ];

  // Sequential scanning interval
  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      setHighlightedIndex((prev) => (prev + 1) % items.length);
    }, scanSpeedMs);
    return () => clearInterval(interval);
  }, [isScanning, scanSpeedMs, items.length]);

  // Physical switch (Spacebar) listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        triggerSelection('Physical Switch (Spacebar)');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [highlightedIndex, items]);

  // External trigger (from webcam double blink in companion lab)
  const lastSignalRef = useRef(externalTriggerSignal);
  useEffect(() => {
    if (externalTriggerSignal > 0 && externalTriggerSignal !== lastSignalRef.current) {
      lastSignalRef.current = externalTriggerSignal;
      triggerSelection(lastTriggerSource);
    }
  }, [externalTriggerSignal, lastTriggerSource]);

  // The Exact handleSwitchActivation logic
  const triggerSelection = (source: string) => {
    const currentItem = items[highlightedIndex];
    if (!currentItem) return;

    // Execute simulated action
    switch (currentItem.id) {
      case 'nurse':
        setNurseCalled((prev) => !prev);
        break;
      case 'bed_up':
        setBedAngle((prev) => Math.min(prev + 10, 60));
        break;
      case 'bed_down':
        setBedAngle((prev) => Math.max(prev - 10, 0));
        break;
      case 'lights':
        setLightsOn((prev) => !prev);
        break;
      case 'tv':
        setTvOn((prev) => !prev);
        break;
      case 'audio':
        setIsPlayingAudio((prev) => !prev);
        break;
      case 'msg_water':
        setLastMessageSent('Caregiver notified: Water requested');
        break;
      case 'msg_family':
        setLastMessageSent('Family call requested via SMS');
        break;
    }

    // Feedback notification
    setActiveNotification(`${currentItem.title} activated!`);
    setTimeout(() => setActiveNotification(null), 2500);

    // Log entry
    setActionLogs((prev) => [
      {
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        item: currentItem.title,
        source: source,
      },
      ...prev.slice(0, 14),
    ]);

    confetti({
      particleCount: 20,
      spread: 40,
      origin: { y: 0.8 },
      colors: ['#06b6d4', '#10b981'],
    });
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'bell':
        return <Bell className="w-5 h-5" />;
      case 'bed':
        return <Bed className="w-5 h-5" />;
      case 'lightbulb':
        return <Lightbulb className="w-5 h-5" />;
      case 'tv':
        return <Tv className="w-5 h-5" />;
      case 'music':
        return <Music className="w-5 h-5" />;
      case 'message':
        return <MessageSquare className="w-5 h-5" />;
      default:
        return <CheckCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sandbox Controller Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsScanning(!isScanning)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
              isScanning
                ? 'bg-amber-950/60 border border-amber-800/80 text-amber-300 hover:bg-amber-900/80'
                : 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/80'
            }`}
          >
            {isScanning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isScanning ? 'Pause Auto-Scan' : 'Resume Auto-Scan'}
          </button>

          <button
            onClick={() => triggerSelection('Manual Button Click')}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <CheckCircle className="w-4 h-4" />
            Trigger Select Now (or Press Spacebar)
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Scan Interval:</span>
            <input
              type="range"
              min="800"
              max="3000"
              step="100"
              value={scanSpeedMs}
              onChange={(e) => setScanSpeedMs(parseInt(e.target.value, 10))}
              className="w-28 accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-cyan-400 tabular-nums">{(scanSpeedMs / 1000).toFixed(1)}s</span>
          </div>

          <div className="text-slate-500 hidden sm:block">|</div>

          <div className="text-slate-400 hidden sm:flex items-center gap-1">
            <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-300 font-mono">
              Spacebar
            </kbd>
            <span>also activates</span>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {activeNotification && (
        <div className="bg-emerald-950/80 border border-emerald-700/80 p-3 rounded-xl text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{activeNotification}</span>
          </div>
          <span className="text-[10px] text-emerald-300/80 uppercase tracking-wide">Switch Activated</span>
        </div>
      )}

      {/* Grid of Interactive Assistive Elements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item, index) => {
          const isHighlighted = isScanning && highlightedIndex === index;
          return (
            <div
              key={item.id}
              onClick={() => {
                setHighlightedIndex(index);
                triggerSelection('Direct Touch / Mouse Click');
              }}
              className={`relative p-5 rounded-xl border transition-all duration-200 cursor-pointer ${
                isHighlighted
                  ? 'bg-cyan-950/50 border-cyan-400 ring-4 ring-cyan-500/40 shadow-xl scale-[1.02]'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              {/* High-Contrast Scanning Ring Indicator */}
              {isHighlighted && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-cyan-400 text-slate-950 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase font-mono">
                  <span>Focused</span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    isHighlighted
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-cyan-400'
                  }`}
                >
                  {getIcon(item.iconName)}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                    {item.category}
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100">{item.title}</h4>
                </div>
              </div>

              {/* Dynamic Status Display per item */}
              <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
                <span>Current State:</span>
                <span className="font-medium text-slate-200">
                  {item.id === 'nurse' && (nurseCalled ? 'Alert Active' : 'Idle')}
                  {item.id.startsWith('bed') && `${bedAngle}° Incline`}
                  {item.id === 'lights' && (lightsOn ? 'ON (100%)' : 'OFF')}
                  {item.id === 'tv' && (tvOn ? 'Power ON' : 'Standby')}
                  {item.id === 'audio' && (isPlayingAudio ? 'Playing' : 'Paused')}
                  {item.id.startsWith('msg') && 'Ready to send'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Switch Activation Log & System Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Device Status Board (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Environment & Assistance Status
          </h4>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
              <span className="text-slate-400">Nurse Call System:</span>
              <span className={nurseCalled ? 'text-red-400 font-semibold' : 'text-slate-300'}>
                {nurseCalled ? 'EMERGENCY CALL DISPATCHED' : 'Normal / Standby'}
              </span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
              <span className="text-slate-400">Bed Head Elevation:</span>
              <span className="font-mono text-cyan-400">{bedAngle}° Angle</span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
              <span className="text-slate-400">Room Lighting:</span>
              <span className={lightsOn ? 'text-amber-400 font-medium' : 'text-slate-400'}>
                {lightsOn ? 'Illuminated' : 'Darkened'}
              </span>
            </div>
            <div className="flex justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/80">
              <span className="text-slate-400">Recent Outgoing Message:</span>
              <span className="text-slate-200 truncate max-w-[200px]">{lastMessageSent}</span>
            </div>
          </div>
        </div>

        {/* Switch Trigger History Log (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Real-Time Switch Activation Audit Log
            </h4>
            <span className="text-xs text-slate-400 font-mono">
              {actionLogs.length} events logged
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {actionLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      log.source.includes('Blink')
                        ? 'bg-cyan-400'
                        : log.source.includes('Spacebar')
                        ? 'bg-emerald-400'
                        : 'bg-slate-500'
                    }`}
                  />
                  <span className="font-medium text-slate-200">{log.item}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                  <span>{log.source}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-500">{log.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
