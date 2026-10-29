'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { ProtectedRoute } from './protected-route';
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  Share2,
  CreditCard,
  History,
  Lock,
  AlertTriangle,
} from 'lucide-react';

interface SettingsLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}

const SETTINGS_NAV = [
  { href: '/settings', label: 'Overview', icon: LayoutDashboard },
  { href: '/settings/workspace', label: 'Workspace', icon: Building2 },
  { href: '/settings/team', label: 'Team & access', icon: Users },
  { href: '/settings/governance', label: 'Governance', icon: ShieldCheck },
  { href: '/settings/integrations', label: 'Integrations', icon: Share2 },
  { href: '/settings/billing', label: 'Billing & usage', icon: CreditCard },
  { href: '/settings/audit-log', label: 'Audit log', icon: History },
  { href: '/settings/data', label: 'Data & privacy', icon: Lock },
];

export function SettingsLayout({
  title,
  description,
  children,
  headerAction,
}: SettingsLayoutProps) {
  const pathname = usePathname();
  const { currentWorkspace } = useAuth();

  const isOwner = currentWorkspace?.role === 'OWNER';
  const isAdmin = currentWorkspace?.role === 'ADMIN';
  const isAuthorized = isOwner || isAdmin;

  return (
    <ProtectedRoute
      fallbackTitle="Workspace Settings Access"
      fallbackDescription="Sign in with an authorized Owner or Admin account to manage workspace settings."
    >
      {!isAuthorized ? (
        <main className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#17202A]">Access Denied</h1>
          <p className="mt-2 text-sm text-[#667085] max-w-md mx-auto">
            Workspace administration is restricted to workspace Owners and Admins. Your current role is{' '}
            <span className="font-semibold text-[#17202A]">{currentWorkspace?.role ?? 'None'}</span>.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-[#E85D2A] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#d44c1b] transition-all"
            >
              Return to Dashboard
            </Link>
          </div>
        </main>
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Main settings header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-[#E4E7EC] gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#E85D2A]">
                  Workspace Administration
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F2F4F7] text-[#344054]">
                  {currentWorkspace?.role === 'OWNER' ? 'Owner' : 'Admin'}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[#17202A] mt-1">{title}</h1>
              <p className="text-xs text-[#667085] mt-0.5">{description}</p>
            </div>
            {headerAction && <div>{headerAction}</div>}
          </div>

          {/* Sub-navigation tabs */}
          <div className="mt-6 border-b border-[#E4E7EC] overflow-x-auto no-scrollbar">
            <nav className="flex space-x-2 pb-px" aria-label="Settings sub navigation">
              {SETTINGS_NAV.map((tab) => {
                const Icon = tab.icon;
                const isActive =
                  tab.href === '/settings'
                    ? pathname === '/settings'
                    : pathname.startsWith(tab.href);

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`inline-flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                      isActive
                        ? 'border-[#E85D2A] text-[#E85D2A] bg-[#FFF8F5]'
                        : 'border-transparent text-[#667085] hover:text-[#17202A] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Main content body */}
          <div className="mt-6">{children}</div>
        </div>
      )}
    </ProtectedRoute>
  );
}
