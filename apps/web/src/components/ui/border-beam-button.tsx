'use client';

import React, { forwardRef } from 'react';
import type { ComponentProps, CSSProperties } from 'react';
import {
  BorderBeam,
  type BorderBeamProps,
  type BorderBeamSize,
} from 'border-beam';
import { cn } from '../../lib/utils';

export interface BorderBeamButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  beamSize?: BorderBeamSize;
  borderBeamClassName?: string;
  borderBeamStyle?: CSSProperties;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  colorVariant?: BorderBeamProps['colorVariant'];
  duration?: number;
  active?: boolean;
  borderRadius?: number;
}

export const BorderBeamButton = forwardRef<HTMLDivElement, BorderBeamButtonProps>(
  function BorderBeamButton(
    {
      beamSize = 'sm',
      borderBeamClassName,
      borderBeamStyle,
      colorVariant = 'sunset',
      duration = 8,
      active = true,
      borderRadius = 9999,
      variant = 'default',
      className,
      children,
      ...buttonProps
    },
    ref
  ) {
    const variantStyles = {
      default:
        'bg-[#1D1D1F] text-white hover:bg-black border border-black/10 shadow-sm',
      outline:
        'bg-white text-[#1D1D1F] hover:bg-slate-50 border border-slate-200/90 shadow-xs',
      secondary:
        'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-slate-200 border border-slate-200/80',
      ghost: 'bg-transparent text-[#1D1D1F] hover:bg-black/5',
    }[variant];

    const beamProps: Record<string, any> = {
      active,
      borderRadius,
      colorVariant,
      duration,
      size: beamSize,
      ref,
      className: cn(
        'overflow-visible inline-flex w-fit min-w-0 flex-col items-stretch leading-none rounded-full',
        borderBeamClassName
      ),
    };
    if (borderBeamStyle) {
      beamProps.style = borderBeamStyle;
    }

    return (
      <BorderBeam {...(beamProps as any)}>
        <button
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F17] disabled:pointer-events-none disabled:opacity-50',
            variantStyles,
            className
          )}
          {...buttonProps}
        >
          {children}
        </button>
      </BorderBeam>
    );
  }
);

BorderBeamButton.displayName = 'BorderBeamButton';
