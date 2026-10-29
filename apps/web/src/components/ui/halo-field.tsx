"use client"

/**
 * Form field layout aligned with shadcn `Field` — label, description, error, and control
 * slots for {@link HaloInput} / {@link HaloTextarea} (general-purpose; not tied to
 * search or composer).
 */
import React, { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface HaloFieldProps extends HTMLAttributes<HTMLDivElement> {
  invalid?: boolean | undefined;
}

export const HaloField = forwardRef<HTMLDivElement, HaloFieldProps>(
  function HaloField({ className, invalid, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="halo-field"
        aria-invalid={invalid ? true : undefined}
        className={cn('group/halo-field flex flex-col w-full gap-1.5', className)}
        {...props}
      />
    );
  }
);
HaloField.displayName = 'HaloField';

export const HaloFieldLabel = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  function HaloFieldLabel({ className, ...props }, ref) {
    return (
      <label
        ref={ref}
        data-slot="halo-field-label"
        className={cn(
          'text-xs font-semibold text-[#1D1D1F] tracking-tight flex items-center justify-between select-none',
          className
        )}
        {...props}
      />
    );
  }
);
HaloFieldLabel.displayName = 'HaloFieldLabel';

export const HaloFieldDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function HaloFieldDescription({ className, ...props }, ref) {
    return (
      <p
        ref={ref}
        data-slot="halo-field-description"
        className={cn('text-[11px] text-[#6E6E73] leading-relaxed', className)}
        {...props}
      />
    );
  }
);
HaloFieldDescription.displayName = 'HaloFieldDescription';

export const HaloFieldError = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function HaloFieldError({ className, ...props }, ref) {
    return (
      <p
        ref={ref}
        data-slot="halo-field-error"
        className={cn('text-[11px] font-medium text-rose-600 flex items-center gap-1 mt-0.5', className)}
        {...props}
      />
    );
  }
);
HaloFieldError.displayName = 'HaloFieldError';
