'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu, X, ChevronRight } from 'lucide-react';
import { DirectionAwareTabs } from './ui/direction-aware-tabs';
import { NexusDynamicIsland } from './ui/nexus-dynamic-island';
import { BorderBeamButton } from './ui/border-beam-button';

export interface V3NavbarProps {
  onSwitchToV1?: (() => void) | undefined;
}

export function V3Navbar({ onSwitchToV1 }: V3NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/[0.06] bg-[#F5F5F7]/85 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8 gap-4">
        {/* Brand Left */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
              
            </div>
            <span className="font-display text-base font-bold tracking-tight text-[#1D1D1F] whitespace-nowrap">
              NexusFlow
            </span>
          </Link>
          <span className="hidden sm:inline-flex text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-black/[0.04] text-[#515154] border border-black/[0.06] whitespace-nowrap">
            Enterprise Platform v3
          </span>
        </div>

        {/* Centered Cult UI DirectionAwareTabs for Apple Navigation */}
        <div className="hidden lg:flex items-center justify-center flex-1 min-w-0 max-w-md mx-2">
          <DirectionAwareTabs
            tabs={[
              { id: 0, label: 'Overview', content: null },
              { id: 1, label: 'Studio', content: null },
              { id: 2, label: 'Architecture', content: null },
              { id: 3, label: 'Pricing', content: null },
              { id: 4, label: 'Developers', content: null },
            ]}
            showContent={false}
            className="bg-[#E5E5EA]/70 border border-black/[0.04] p-1 shadow-inner"
            activeTabClassName="text-[#1D1D1F] font-bold"
            onTabChange={(tabId) => {
              const targets = ['/', '/#hardware-showcase', '/#architecture', '/#pricing', '/developers'];
              const target = targets[tabId];
              if (pathname === '/' && target?.startsWith('/#')) {
                const el = document.querySelector(target.replace('/', ''));
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              } else if (target) {
                window.location.href = target;
              }
            }}
          />
        </div>

        {/* Right Actions with Cult UI Border Beam Button & Dynamic Island Overlay */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Dynamic Island Floating Telemetry Trigger */}
          <div className="hidden xl:block">
            <NexusDynamicIsland />
          </div>

          {onSwitchToV1 && (
            <button
              type="button"
              onClick={onSwitchToV1}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-full text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Switch to Classic v1"
            >
              Classic v1
            </button>
          )}

          {pathname === '/login' ? (
            <Link
              href="/register"
              className="text-xs sm:text-sm font-semibold text-[#FF4F17] hover:underline px-2.5 py-1.5 whitespace-nowrap shrink-0"
            >
              Create Account
            </Link>
          ) : pathname === '/register' ? (
            <Link
              href="/login"
              className="text-xs sm:text-sm font-semibold text-[#FF4F17] hover:underline px-2.5 py-1.5 whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-xs sm:text-sm font-semibold text-[#515154] hover:text-[#1D1D1F] transition-colors px-2.5 py-1.5 whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>
          )}

          <Link href="/register" className="hidden xs:inline-block shrink-0">
            <BorderBeamButton
              variant="default"
              colorVariant="sunset"
              beamSize="sm"
              className="text-xs sm:text-sm px-4 sm:px-5 py-2 font-bold bg-[#1D1D1F] text-white hover:bg-black whitespace-nowrap"
            >
              <span>Start Pilot</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </BorderBeamButton>
          </Link>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-[#1D1D1F] hover:bg-black/5 transition-colors shrink-0"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Slide-Down Sheet */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-black/[0.06] bg-[#F5F5F7]/95 backdrop-blur-2xl px-5 py-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="divide-y divide-black/[0.06]">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between py-2.5 text-sm font-semibold text-[#1D1D1F] hover:text-[#FF4F17]"
            >
              <span>Overview</span>
              <ChevronRight className="w-4 h-4 text-[#86868B]" />
            </Link>
            <Link
              href="/#hardware-showcase"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between py-2.5 text-sm font-semibold text-[#1D1D1F] hover:text-[#FF4F17]"
            >
              <span>Campaign Studio</span>
              <ChevronRight className="w-4 h-4 text-[#86868B]" />
            </Link>
            <Link
              href="/#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between py-2.5 text-sm font-semibold text-[#1D1D1F] hover:text-[#FF4F17]"
            >
              <span>Architecture &amp; Governance</span>
              <ChevronRight className="w-4 h-4 text-[#86868B]" />
            </Link>
            <Link
              href="/#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between py-2.5 text-sm font-semibold text-[#1D1D1F] hover:text-[#FF4F17]"
            >
              <span>Subscription Plans</span>
              <ChevronRight className="w-4 h-4 text-[#86868B]" />
            </Link>
            <Link
              href="/developers"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between py-2.5 text-sm font-semibold text-[#1D1D1F] hover:text-[#FF4F17]"
            >
              <span>Developer Hub &amp; API</span>
              <ChevronRight className="w-4 h-4 text-[#86868B]" />
            </Link>
          </div>

          <div className="pt-2 border-t border-black/[0.06] space-y-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 rounded-full text-xs font-semibold text-center bg-white text-[#1D1D1F] hover:bg-slate-100 block border border-black/[0.06] shadow-xs"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 rounded-full text-xs font-bold text-center bg-[#1D1D1F] text-white hover:bg-black block shadow-xs"
            >
              Start 14-Day Pilot →
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
