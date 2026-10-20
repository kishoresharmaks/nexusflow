import { vi } from 'vitest';
import React from 'react';

// Mock Next.js Link component to avoid requestIdleCallback prefetch timeouts in JSDOM
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }) => React.createElement('a', { href, ...props }, children),
}));
