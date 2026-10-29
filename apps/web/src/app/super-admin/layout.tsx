'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { api, SuperAdminProfile, SuperAdminHealth } from '../../lib/api';
import {
  ShieldAlert,
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Store,
  Cpu,
  Activity,
  Settings,
  LogOut,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Lock,
  ChevronRight,
} from 'lucide-react';

interface NavGroup {
  group: string;
  items: Array<{
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }>;
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout, isLoading: isAuthLoading } = useAuth();

  const [adminProfile, setAdminProfile] = useState<SuperAdminProfile | null>(null);
  const [health, setHealth] = useState<SuperAdminHealth | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLoginPage = pathname === '/super-admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setIsLoading(false);
      return;
    }

    if (!isAuthLoading && !token) {
      router.push('/super-admin/login');
      return;
    }

    if (!token) return;

    let isMounted = true;
    setIsLoading(true);

    Promise.all([api.getSuperAdminProfile(), api.getSuperAdminHealth()])
      .then(([profile, healthData]) => {
        if (!isMounted) return;
        setAdminProfile(profile);
        setHealth(healthData);
        setAccessDenied(false);
        setErrorMsg(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = (err as Error).message || 'Platform admin access denied.';
        if (msg.includes('403') || msg.includes('admin') || msg.includes('Forbidden')) {
          setAccessDenied(true);
        } else if (msg.includes('401') || msg.includes('Unauthorized')) {
          router.push('/super-admin/login');
        } else {
          setErrorMsg(msg);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, isAuthLoading, router, isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isAuthLoading || (isLoading && !adminProfile && !accessDenied && !errorMsg)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shadow-xs">
              <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin" />
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium tracking-wide">
            Verifying Platform Administrator Credentials...
          </p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-6 shadow-xl text-center">
          <div className="w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Platform Access Denied</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Your account ({user?.email || 'authenticated user'}) does not have active platform-level
            administrator privileges. Workspace owner or admin roles do not grant Super Admin console access.
          </p>
          <div className="flex flex-col gap-2.5">
            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" /> Return to Workspace Dashboard
            </Link>
            <button
              onClick={() => {
                logout();
                router.push('/super-admin/login');
              }}
              className="w-full px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Sign In with Platform Admin Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navGroups: NavGroup[] = [
    {
      group: 'Core Platform',
      items: [
        { href: '/super-admin', label: 'Platform Overview', icon: LayoutDashboard },
        { href: '/super-admin/audit-logs', label: 'Security & Audit Logs', icon: ShieldAlert },
      ],
    },
    {
      group: 'Tenants & Accounts',
      items: [
        { href: '/super-admin/users', label: 'Users & Accounts', icon: Users },
        { href: '/super-admin/workspaces', label: 'Workspaces & Tenants', icon: Building2 },
        { href: '/super-admin/subscriptions', label: 'Plans & Billing', icon: CreditCard },
      ],
    },
    {
      group: 'Infrastructure & Fleet',
      items: [
        { href: '/super-admin/integrations', label: 'Integrations Health', icon: Store },
        { href: '/super-admin/ai-providers', label: 'AI & Token Quotas', icon: Cpu },
        { href: '/super-admin/jobs', label: 'Background Jobs', icon: Activity },
      ],
    },
    {
      group: 'Configuration',
      items: [
        { href: '/super-admin/settings', label: 'Platform Settings', icon: Settings },
      ],
    },
  ];

  // Helper to extract active route label for breadcrumbs
  const currentNav = navGroups.flatMap(g => g.items).find(i => i.href === pathname);
  const activeLabel = currentNav?.label || 'Console';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row antialiased selection:bg-indigo-500/20 selection:text-indigo-900">
      {/* Waymark Modern Operator Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 z-40 shadow-xs">
        <div>
          {/* Brand & Console Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#E85D2A] via-indigo-600 to-purple-600 p-[1px] shadow-sm shrink-0">
                <div className="h-full w-full rounded-[11px] bg-white flex items-center justify-center text-indigo-600">
                  <ShieldAlert className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 block truncate">
                  NexusFlow
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    Super Admin Console
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Grouped Navigation Links */}
          <nav className="p-3 space-y-4">
            {navGroups.map((group) => (
              <div key={group.group} className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
                  {group.group}
                </div>
                {group.items.map((link) => {
                  const isActive = pathname === link.href;
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                            isActive
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-100 text-slate-500 group-hover:text-slate-700 group-hover:bg-slate-200/80'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="truncate">{link.label}</span>
                      </div>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Operator Profile & App Exit Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/60 space-y-2.5">
          {adminProfile && (
            <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  Operator
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {adminProfile.role}
                </span>
              </div>
              <p className="font-semibold text-slate-900 truncate">{adminProfile.user.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{adminProfile.user.email}</p>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Link
              href="/"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold transition-all border border-slate-200 shadow-xs"
              title="Return to regular workspace dashboard"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Workspace App</span>
            </Link>

            <button
              onClick={() => {
                logout();
                router.push('/super-admin/login');
              }}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-200 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Administrative Work Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Waymark Top Telemetry Header Bar */}
        <header className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-white/95 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-400 tracking-wide uppercase text-[10px]">
              Platform Governance
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-semibold text-slate-900">
              {activeLabel === 'Platform Overview' ? 'Dashboard' : activeLabel}
            </span>
            <span className="hidden sm:inline-block text-slate-300">•</span>
            <span className="hidden sm:inline-block font-mono text-[11px] text-slate-500 truncate">
              {pathname}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {health && (
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 shadow-xs">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-slate-700">
                  DB: {health.database.latencyMs}ms ({health.database.status.toLowerCase()})
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-700">
                  Stores: {health.integrations.stores.healthy} sync
                </span>
              </div>
            )}
            <button
              onClick={() => {
                setIsLoading(true);
                Promise.all([api.getSuperAdminProfile(), api.getSuperAdminHealth()])
                  .then(([p, h]) => {
                    setAdminProfile(p);
                    setHealth(h);
                  })
                  .finally(() => setIsLoading(false));
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh operational health"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
