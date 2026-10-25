import React, { useState } from 'react';
import {
  FileCode,
  Copy,
  Check,
  Download,
  FolderTree,
  Terminal,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { EXTENSION_FILES, ExtensionFile } from '../data/extensionCode.ts';

export const ExtensionExplorer: React.FC = () => {
  const [activeFile, setActiveFile] = useState<ExtensionFile>(EXTENSION_FILES[0]);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const handleCopy = (content: string, name: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(name);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const handleDownloadSingle = (file: ExtensionFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    // Downloads each file sequentially
    EXTENSION_FILES.forEach((file, index) => {
      setTimeout(() => {
        handleDownloadSingle(file);
      }, index * 200);
    });
  };

  return (
    <div className="space-y-6">
      {/* Extension Architecture Overview Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-cyan-400" />
              AccessScan Manifest V3 Project Source Explorer
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Production-ready, battle-tested Manifest V3 code structure implementing local WebAssembly vision.
            </p>
          </div>
          <button
            onClick={handleDownloadAll}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download All Extension Files
          </button>
        </div>

        {/* 3-Pillar Architectural Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300 mb-1">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              1. Offscreen Sandbox
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Bypasses MV3 service worker limitations by hosting <code className="text-cyan-300">getUserMedia</code> in a headless isolated DOM context.
            </p>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 mb-1">
              <Cpu className="w-4 h-4 text-emerald-400" />
              2. Local WASM Runtime
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Enforces <code className="text-emerald-300">'wasm-unsafe-eval'</code> CSP, running MediaPipe sub-pixel face landmarks with zero network latency.
            </p>
          </div>

          <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 mb-1">
              <Layers className="w-4 h-4 text-amber-400" />
              3. Message Bridge
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Dispatches <code className="text-amber-300">SWITCH_SELECT</code> to active tabs, activating <code className="text-slate-200">handleSwitchActivation()</code> seamlessly.
            </p>
          </div>
        </div>
      </div>

      {/* Code Viewer Layout: Sidebar (3 cols) + Editor (9 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* File Tree Sidebar */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
          <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
            Extension Files
          </div>
          {EXTENSION_FILES.map((file) => {
            const isActive = activeFile.name === file.name;
            return (
              <button
                key={file.name}
                onClick={() => setActiveFile(file)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-mono flex items-center justify-between transition-colors ${
                  isActive
                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span className="truncate">{file.name}</span>
                </div>
                <span className="text-[10px] text-slate-500 uppercase">{file.language}</span>
              </button>
            );
          })}
        </div>

        {/* Code View Panel */}
        <div className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          {/* File Header Bar */}
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-slate-200">{activeFile.path}</span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 hidden sm:inline">{activeFile.description}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(activeFile.content, activeFile.name)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                {copiedFile === activeFile.name ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleDownloadSingle(activeFile)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors border border-slate-700"
                title="Download this file"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Syntax / Code Pre Block with Line Numbers */}
          <div className="p-4 bg-slate-950 overflow-x-auto max-h-[580px] font-mono text-xs leading-relaxed text-slate-300">
            <pre className="grid grid-cols-[auto_1fr] gap-x-4">
              <span className="select-none text-right text-slate-600 font-mono pr-2 border-r border-slate-800">
                {activeFile.content
                  .split('\n')
                  .map((_, i) => i + 1)
                  .join('\n')}
              </span>
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
