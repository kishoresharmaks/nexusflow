'use client';

import React from 'react';

export interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
}

export function ShimmerButton({
  children,
  shimmerColor = '#FF4F17',
  borderRadius = '1rem',
  background = 'rgba(15, 23, 42, 1)',
  className = '',
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      style={
        {
          borderRadius,
          background,
        } as React.CSSProperties
      }
      className={`group relative inline-flex items-center justify-center overflow-hidden border border-slate-700/80 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:border-orange-500/50 hover:shadow-orange-500/10 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {/* Shimmer sweep */}
      <div
        className="pointer-events-none absolute -inset-[100%] animate-[spin_4s_linear_infinite] opacity-0 group-hover:opacity-40 transition-opacity duration-500"
        style={{
          background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${shimmerColor} 120deg, transparent 180deg)`,
        }}
      />
      {/* Inner pill */}
      <div
        className="absolute inset-[1px] rounded-[inherit] transition-colors duration-300 group-hover:bg-slate-900/90"
        style={{ background }}
      />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
