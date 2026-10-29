'use client';

import React from 'react';

export interface BadgeGlowProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'orange' | 'blue' | 'emerald' | 'slate';
  pulse?: boolean;
  className?: string;
}

export function BadgeGlow({
  children,
  variant = 'orange',
  pulse = true,
  className = '',
  ...props
}: BadgeGlowProps) {
  const variantStyles = {
    orange: 'border-orange-500/30 bg-orange-500/10 text-orange-400 shadow-[0_0_12px_rgba(255,79,23,0.15)]',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    slate: 'border-slate-700 bg-slate-800/60 text-slate-300 shadow-[0_0_12px_rgba(100,116,139,0.1)]',
  };

  const dotColors = {
    orange: 'bg-[#FF4F17]',
    blue: 'bg-blue-400',
    emerald: 'bg-emerald-400',
    slate: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md transition-all ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColors[variant]}`}
          />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColors[variant]}`} />
        </span>
      )}
      <span>{children}</span>
    </span>
  );
}
