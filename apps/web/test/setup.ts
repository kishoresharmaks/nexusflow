import { vi, afterEach } from 'vitest';
import React from 'react';
import { cleanup } from '@testing-library/react';

// Automatically cleanup DOM after each test in JSDOM
afterEach(() => {
  cleanup();
});

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


// Mock ResizeObserver for JSDOM
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver as any;
  (global as any).ResizeObserver = MockResizeObserver;
}

// Mock matchMedia for JSDOM
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as any;
}
