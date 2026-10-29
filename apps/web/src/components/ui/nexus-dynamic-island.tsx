'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Database, ShieldCheck } from 'lucide-react';

export function NexusDynamicIsland() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Resting Compact Dynamic Island Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1D1D1F] hover:bg-black text-white border border-black/10 shadow-sm transition-all duration-200 cursor-pointer select-none shrink-0"
        title="Click to inspect real-time system telemetry"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[11px] font-semibold text-slate-200">Catalog Engine</span>
        <span className="text-slate-600 text-[10px]">•</span>
        <span className="text-[11px] font-mono font-bold text-[#FF4F17] flex items-center gap-1">
          <Database className="w-3 h-3" />
          Grounded
        </span>
      </button>

      {/* Floating Real-Time Telemetry Card (Overlay Popover - Zero Nav Collision) */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2.5 w-84 sm:w-96 bg-black border border-white/15 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[120] text-left animate-in fade-in zoom-in-95 duration-150 text-white">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-[#FF4F17]/20 flex items-center justify-center text-[#FF4F17]">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">NexusFlow Real-Time Telemetry</h4>
                <p className="text-[10px] text-slate-400">Active Catalog &amp; Social Engine</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              All Systems Operational
            </span>
          </div>

          <div className="my-3 grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <p className="text-[10px] text-slate-400 font-mono">Catalog Sync</p>
              <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">Verified</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <p className="text-[10px] text-slate-400 font-mono">Security</p>
              <p className="text-xs font-bold text-indigo-400 font-mono mt-0.5">Encrypted</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <p className="text-[10px] text-slate-400 font-mono">Rate Limit</p>
              <p className="text-xs font-bold text-cyan-400 font-mono mt-0.5">Optimal</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Maker-Checker Enforced
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white font-semibold underline cursor-pointer"
            >
              Collapse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
