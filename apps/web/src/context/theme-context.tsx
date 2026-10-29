'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'classic' | 'v3';

interface ThemeContextValue {
  theme: ThemeMode;
  isBetaV2: boolean;
  isV3: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'cp_landing_version';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('classic');

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlV = params.get('v');
        if (urlV === '3' || urlV === 'v3') {
          setThemeState('v3');
          return;
        }
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'v3') {
          setThemeState('v3');
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Update document classes and body background when theme changes
  // For v3, Apple Light Theme: crisp #F5F5F7 backdrop with deep #1D1D1F text
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'v3') {
      root.classList.remove('dark', 'theme-beta-v2');
      root.classList.add('theme-v3-apple', 'light');
      body.classList.remove('bg-[#07090E]', 'text-slate-100', 'bg-black', 'bg-[#F7F8FA]');
      body.classList.add('bg-[#F5F5F7]', 'text-[#1D1D1F]');
    } else {
      root.classList.remove('dark', 'theme-beta-v2', 'theme-v3-apple', 'light');
      body.classList.remove('bg-[#07090E]', 'text-slate-100', 'bg-black', 'bg-[#F5F5F7]');
      body.classList.add('bg-[#F7F8FA]', 'text-[#17202A]');
    }
  }, [theme]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, mode === 'v3' ? 'v3' : 'v1');
      }
    } catch {
      // ignore
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'classic' ? 'v3' : 'classic');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isBetaV2: false,
        isV3: theme === 'v3',
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'classic' as ThemeMode,
      isBetaV2: false,
      isV3: false,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
