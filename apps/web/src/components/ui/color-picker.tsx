'use client';

import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ColorPickerProps {
  value?: string;
  onChange?: (color: string) => void;
  className?: string;
  presets?: string[];
}

const DEFAULT_PRESETS = [
  '#FF4F17', // NexusFlow Orange
  '#0071E3', // Apple Blue
  '#34C759', // Emerald
  '#AF52DE', // Purple
  '#FF9500', // Amber
  '#1D1D1F', // Apple Obsidian
];

export function ColorPicker({
  value = '#FF4F17',
  onChange,
  className,
  presets = DEFAULT_PRESETS,
}: ColorPickerProps) {
  const [selectedColor, setSelectedColor] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (color: string) => {
    setSelectedColor(color);
    if (onChange) onChange(color);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-xs font-semibold text-[#1D1D1F] shadow-xs transition-all cursor-pointer"
      >
        <span
          className="w-4 h-4 rounded-full shadow-inner border border-black/10"
          style={{ backgroundColor: selectedColor }}
        />
        <span className="font-mono">{selectedColor}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[#86868B]" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
          {presets.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleSelect(color)}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xs border border-black/10 cursor-pointer"
              style={{ backgroundColor: color }}
            >
              {selectedColor.toLowerCase() === color.toLowerCase() && (
                <Check className="w-3.5 h-3.5 text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
