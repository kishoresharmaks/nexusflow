'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { V3Navbar } from './v3-navbar';
import { DirectionAwareTabs } from './ui/direction-aware-tabs';
import { NexusDynamicIsland } from './ui/nexus-dynamic-island';
import { BorderBeamButton } from './ui/border-beam-button';

import { usePathname } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/theme-context';
import {
  Package,
  Sparkles,
  Image as ImageIcon,
  LayoutDashboard,
  Building2,
  Check,
  Zap,
  Plus,
  Send,
  PenSquare,
  Share2,
  CreditCard,
  Settings,
  LogOut,
  LogIn,
  Store,
  Target,
  BarChart3,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  LayoutGrid,
  Link2,
  Tag,
  FileText,
  HelpCircle,
  ShieldCheck,
  FileCode2,
  SlidersHorizontal,
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const { isV3, toggleTheme, setTheme } = useTheme();
  const {
    user,
    token,
    workspaces,
    currentWorkspace,
    switchWorkspace,
    createWorkspace,
    logout,
    quickDemoLogin,
    isLoading,
  } = useAuth();

  const [showWorkspaceModal, setShowWorkspaceModal] = useState<boolean>(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState<string>('');
  const [isCreatingWs, setIsCreatingWs] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [resourcesOpen, setResourcesOpen] = useState<boolean>(false);
  const [manageOpen, setManageOpen] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [workspaceOpen, setWorkspaceOpen] = useState<boolean>(false);

  const resourcesDropdownRef = useRef<HTMLDivElement>(null);
  const manageDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        resourcesDropdownRef.current &&
        !resourcesDropdownRef.current.contains(target)
      ) {
        setResourcesOpen(false);
      }
      if (
        manageDropdownRef.current &&
        !manageDropdownRef.current.contains(target)
      ) {
        setManageOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(target)
      ) {
        setUserMenuOpen(false);
      }
      if (
        workspaceDropdownRef.current &&
        !workspaceDropdownRef.current.contains(target)
      ) {
        setWorkspaceOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Suppress normal workspace navbar in Super Admin console
  if (pathname?.startsWith('/super-admin')) {
    return null;
  }

  // Primary authenticated workflow links (always visible in desktop pill)
  const primaryAppLinks = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/catalog', label: 'Catalog', icon: Package },
    { href: '/ai-studio', label: 'AI Studio', icon: Sparkles },
    { href: '/posts', label: 'Posts & Pipeline', icon: Send },
    { href: '/campaigns', label: 'Campaigns', icon: Target },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  // Secondary management links (organized in "Manage ⌵" dropdown: Stores, Social Accounts, Media)
  // Billing and Settings live strictly in the Account/User dropdown to prevent duplicate options
  const manageAppLinks = [
    {
      href: '/integrations',
      label: 'Stores',
      fullLabel: 'Store Connections',
      desc: 'Shopify, WooCommerce, Custom API',
      icon: Store,
      color: 'bg-orange-50 text-[#FF4F17] border-orange-200/60',
    },
    {
      href: '/social-accounts',
      label: 'Social Accounts',
      fullLabel: 'Social Accounts',
      desc: 'Instagram, LinkedIn, FB, Twitter, Pinterest',
      icon: Share2,
      color: 'bg-blue-50 text-blue-600 border-blue-200/60',
    },
    {
      href: '/media',
      label: 'Media',
      fullLabel: 'Media Library',
      desc: 'Private S3 storage & photo assets',
      icon: ImageIcon,
      color: 'bg-purple-50 text-purple-600 border-purple-200/60',
    },
  ];

  // Public visitor marketing navigation (No redundant FAQs link in main pill)
  const publicNavLinks = [
    { href: '/#features', label: 'Features', icon: LayoutGrid },
    { href: '/#how-it-works', label: 'How It Works', icon: Settings },
    { href: '/#integrations', label: 'Integrations', icon: Link2 },
    { href: '/#pricing', label: 'Pricing', icon: Tag },
  ];

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setIsCreatingWs(true);
    try {
      await createWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setShowWorkspaceModal(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setIsCreatingWs(false);
    }
  };

  const isManageActive = manageAppLinks.some(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
  );



  // When visiting the public v3 landing page, LandingPageV3 renders the unified V3Navbar directly
  if (!token && isV3 && pathname === '/') {
    return null;
  }

  // When visiting /login, /register, or other public routes in v3 theme, render the unified V3Navbar
  if (!token && isV3) {
    return <V3Navbar onSwitchToV1={() => setTheme('classic')} />;
  }

  return (
    <header className="sticky top-0 z-[100] isolate w-full pt-2.5 pb-1.5 px-2 sm:px-4 lg:px-6">
      <div className="max-w-7xl mx-auto relative">
        {token ? (
          /* ================= AUTHENTICATED FLOATING PILL (NON-SCROLLING, RESPONSIVE) ================= */
          <nav className="bg-white/95 backdrop-blur-md rounded-full border border-slate-200/90 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)] px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between transition-all w-full min-w-0">
            {/* Left: Brand & Workspace Switcher */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
              <Link href="/" className="flex items-center space-x-1.5 shrink-0 group">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-[#FF4F17] to-[#FF6B35] flex items-center justify-center text-white font-extrabold text-xs shadow-sm group-hover:scale-105 transition-transform">
                  NF
                </div>
                <span className="text-sm font-extrabold tracking-tight text-slate-900 font-display hidden sm:inline lg:hidden xl:inline">
                  NexusFlow
                </span>
              </Link>

              <div className="h-4 w-px bg-slate-200 hidden sm:block lg:hidden xl:block shrink-0" />

              {/* Workspace Switcher Custom Dropdown (No separate outside button) */}
              {currentWorkspace && (
                <div className="relative" ref={workspaceDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setManageOpen(false);
                      setUserMenuOpen(false);
                      setWorkspaceOpen((prev) => !prev);
                    }}
                    className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90 rounded-full px-2 sm:px-2.5 py-1 text-xs shadow-2xs shrink min-w-0 max-w-[105px] xs:max-w-[125px] sm:max-w-[145px] xl:max-w-[170px] transition-colors cursor-pointer group"
                    aria-expanded={workspaceOpen}
                    aria-haspopup="true"
                    title={currentWorkspace.name}
                  >
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0 group-hover:text-[#FF4F17] transition-colors" />
                    <span className="font-semibold text-slate-800 text-xs truncate">
                      {currentWorkspace.name}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 text-slate-400 shrink-0 transition-transform duration-200 ${
                        workspaceOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Card */}
                  <div
                    className={`absolute top-full left-0 mt-2.5 w-64 bg-white rounded-2xl border border-slate-200/90 shadow-2xl shadow-slate-900/15 p-2 z-[110] transition-all duration-150 ring-1 ring-slate-900/5 before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 ${
                      workspaceOpen
                        ? 'opacity-100 scale-100 pointer-events-auto block'
                        : 'opacity-0 scale-95 pointer-events-none hidden'
                    }`}
                  >
                    <div className="absolute -top-1.5 left-6 w-3 h-3 bg-white border-t border-l border-slate-200/90 rotate-45" />

                    {/* Header */}
                    <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Workspaces
                    </div>

                    {/* Workspaces list */}
                    <div className="max-h-56 overflow-y-auto space-y-1 py-1">
                      {workspaces.map((w) => {
                        const isCurrent = w.id === currentWorkspace.id;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              switchWorkspace(w.id);
                              setWorkspaceOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors text-left cursor-pointer ${
                              isCurrent
                                ? 'bg-orange-50 text-[#FF4F17]'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  isCurrent
                                    ? 'bg-orange-100 text-[#FF4F17]'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {w.name.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="truncate">{w.name}</span>
                            </div>
                            {isCurrent && (
                              <Check className="w-3.5 h-3.5 text-[#FF4F17] shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Inside Dropdown: + Create New Workspace (Integrated inside menu) */}
                    <div className="pt-1 mt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setWorkspaceOpen(false);
                          setShowWorkspaceModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-[#FF4F17] hover:bg-orange-50/70 transition-colors cursor-pointer group"
                        title="Create New Workspace"
                      >
                        <div className="w-6 h-6 rounded-lg bg-orange-100/80 text-[#FF4F17] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                        <span>New Workspace</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Center: Primary Workflow Navigation + Manage Dropdown (Adaptive Desktop Pill) */}
            <div className="hidden lg:flex items-center gap-0.5 xl:gap-1 justify-center flex-1 min-w-0 mx-1 xl:mx-2">
              {primaryAppLinks.map((link) => {
                const Icon = link.icon;
                const isActive =
                  link.href === '/'
                    ? pathname === '/'
                    : pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center px-2 xl:px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all gap-1 xl:gap-1.5 ${
                      isActive
                        ? 'bg-orange-50 text-[#FF4F17] border border-orange-200/70 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent font-medium'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-[#FF4F17]' : 'text-slate-400'
                      }`}
                    />
                    {link.href === '/posts' ? (
                      <span>
                        <span className="hidden 2xl:inline">Posts &amp; Pipeline</span>
                        <span className="inline 2xl:hidden">Posts</span>
                      </span>
                    ) : (
                      <span>{link.label}</span>
                    )}
                  </Link>
                );
              })}

              {/* Manage Dropdown (Stores, Social Accounts, Media) */}
              <div
                className="relative"
                ref={manageDropdownRef}
                onMouseEnter={() => {
                  setUserMenuOpen(false);
                  setWorkspaceOpen(false);
                  setManageOpen(true);
                }}
                onMouseLeave={() => setManageOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    setWorkspaceOpen(false);
                    setManageOpen((prev) => !prev);
                  }}
                  className={`inline-flex items-center px-2 xl:px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all gap-1 cursor-pointer ${
                    isManageActive || manageOpen
                      ? 'bg-orange-50 text-[#FF4F17] border border-orange-200/70 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent font-medium'
                  }`}
                  aria-expanded={manageOpen}
                  aria-haspopup="true"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>Manage</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      manageOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Card */}
                <div
                  className={`absolute top-full right-0 mt-2.5 w-72 bg-white rounded-2xl border border-slate-200/90 shadow-2xl shadow-slate-900/15 p-2 z-[110] transition-all duration-150 ring-1 ring-slate-900/5 before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 ${
                    manageOpen ? 'opacity-100 scale-100 pointer-events-auto block' : 'opacity-0 scale-95 pointer-events-none hidden'
                  }`}
                >
                  <div className="absolute -top-1.5 right-6 w-3 h-3 bg-white border-t border-l border-slate-200/90 rotate-45" />
                  <div className="relative z-10 space-y-1">
                    {manageAppLinks.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setManageOpen(false)}
                          className={`flex items-start gap-3 p-2 rounded-xl transition-colors group ${
                            isActive ? 'bg-orange-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${item.color}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-[#FF4F17] transition-colors flex items-center gap-1.5">
                              <span>{item.label}</span>
                              <span className="text-[10px] font-normal text-slate-400 hidden group-hover:inline">
                                ({item.fullLabel})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 leading-tight mt-0.5 truncate">
                              {item.desc}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Quick Action (+ New Post) & Account Menu */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
              {/* Single Clear Action: New Post / Composer */}
              <Link
                href="/composer"
                title="Composer"
                className="inline-flex items-center gap-1.5 px-2.5 xl:px-3.5 py-1 xl:py-1.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#FF4F17] to-[#FF5E24] hover:from-[#E8430D] hover:to-[#EB531B] shadow-sm shadow-[#FF4F17]/20 transition-all shrink-0 group"
              >
                <PenSquare className="w-3.5 h-3.5 group-hover:rotate-6 transition-transform" />
                <span className="hidden sm:inline">New Post</span>
                <span className="sm:hidden">New</span>
                <span className="sr-only">Composer</span>
              </Link>

              {/* User Account Dropdown Pill */}
              <div
                className="relative hidden sm:block"
                ref={userMenuRef}
              >
                <button
                  type="button"
                  onClick={() => {
                    setManageOpen(false);
                    setWorkspaceOpen(false);
                    setUserMenuOpen((prev) => !prev);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-700 px-1.5 xl:px-2.5 py-1 rounded-full bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200/80 font-semibold shadow-2xs transition-all cursor-pointer shrink-0"
                  title="Account Settings & Logout"
                >
                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'NF'}
                  </div>
                  <span className="truncate max-w-[65px] xl:max-w-[90px] font-semibold hidden xl:inline">
                    {user?.name || 'Account'}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform ${
                      userMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* User Menu Card */}
                <div
                  className={`absolute top-full right-0 mt-2.5 w-60 bg-white rounded-2xl border border-slate-200/90 shadow-2xl shadow-slate-900/15 p-2 z-[110] transition-all duration-150 ring-1 ring-slate-900/5 before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 ${
                    userMenuOpen
                      ? 'opacity-100 scale-100 pointer-events-auto block'
                      : 'opacity-0 scale-95 pointer-events-none hidden'
                  }`}
                >
                    <div className="absolute -top-1.5 right-6 w-3 h-3 bg-white border-t border-l border-slate-200/90 rotate-45" />
                    <div className="p-2 border-b border-slate-100">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {user?.name || 'Merchant'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {user?.email}
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-orange-50 text-[#FF4F17] border border-orange-200/60">
                          {currentWorkspace?.role || 'MEMBER'}
                        </span>
                      </div>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-400" />
                        <span>Settings</span>
                      </Link>
                      <Link
                        href="/billing"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        <span>Billing</span>
                      </Link>
                    </div>

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          void logout();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </div>

              {/* Mobile Menu Hamburger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1.5 sm:p-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </nav>
        ) : (
          /* ================= PUBLIC VISITOR FLOATING PILL (UI UX PRO MAX ADAPTIVE THEME) ================= */
          <nav
            className={`rounded-full px-3.5 sm:px-6 py-2.5 flex items-center justify-between transition-all duration-300 ${
              isV3
                ? 'bg-[#F5F5F7]/85 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_25px_rgba(0,0,0,0.04)] text-[#1D1D1F]'
                : 'bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.04)] text-slate-900'
            }`}
          >
            {/* Left: Brand Squircle & Text Logo */}
            <div className="flex items-center space-x-2 shrink-0">
              <Link href="/" className="flex items-center space-x-2 shrink-0 group">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FF4F17] to-[#FF6B35] flex items-center justify-center text-white font-extrabold text-sm shadow-sm group-hover:scale-105 transition-transform">
                  NF
                </div>
                <span
                  className={`text-base sm:text-lg font-extrabold tracking-tight font-display ${
                    isV3 ? 'text-[#1D1D1F]' : 'text-slate-900'
                  }`}
                >
                  NexusFlow
                </span>
              </Link>
            </div>

            {/* Center: Public Marketing Navigation & Resources Dropdown */}
            <div
              className={`hidden md:flex items-center space-x-1 lg:space-x-2 text-sm font-medium ${
                isV3 ? 'text-[#515154]' : 'text-slate-600'
              }`}
            >
              {publicNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 rounded-full transition-colors font-medium text-xs sm:text-sm ${
                    isV3
                      ? 'text-[#515154] hover:text-[#1D1D1F] hover:bg-black/5'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Resources Dropdown (Houses FAQs & Guides - No duplicates!) */}
              <div
                className="relative"
                ref={resourcesDropdownRef}
                onMouseEnter={() => setResourcesOpen(true)}
                onMouseLeave={() => setResourcesOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setResourcesOpen((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs sm:text-sm cursor-pointer group ${
                    resourcesOpen
                      ? isV3
                        ? 'text-white bg-white/10 font-semibold shadow-2xs'
                        : 'text-slate-900 bg-slate-100/90 font-semibold shadow-2xs'
                      : isV3
                        ? 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
                  }`}
                  aria-expanded={resourcesOpen}
                  aria-haspopup="true"
                >
                  <span>Resources</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      resourcesOpen
                        ? isV3
                          ? 'rotate-180 text-orange-400'
                          : 'rotate-180 text-slate-800'
                        : isV3
                          ? 'text-slate-400 group-hover:text-white'
                          : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  />
                </button>

                <div
                  className={`absolute top-full left-1/2 -translate-x-1/2 mt-2.5 w-72 rounded-2xl p-2 z-[110] transition-all duration-150 ring-1 ring-slate-900/5 before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 ${
                    isV3
                      ? 'bg-[#0B0F19]/95 backdrop-blur-xl border border-white/15 shadow-2xl text-white shadow-black/80'
                      : 'bg-white border border-slate-200/90 shadow-2xl shadow-slate-900/15'
                  } ${
                    resourcesOpen
                      ? 'opacity-100 scale-100 pointer-events-auto block'
                      : 'opacity-0 scale-95 pointer-events-none hidden'
                  }`}
                >
                  {/* Upward caret notch */}
                  <div
                    className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 border-t border-l rotate-45 ${
                      isV3 ? 'bg-[#0B0F19] border-white/15' : 'bg-white border-slate-200/90'
                    }`}
                  />

                  <div className="relative z-10 space-y-1">
                    <Link
                      href="/developers"
                      onClick={() => setResourcesOpen(false)}
                      className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors group ${
                        isV3 ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-[#FF8913] border border-orange-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <FileCode2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div
                          className={`text-xs font-bold transition-colors ${
                            isV3
                              ? 'text-white group-hover:text-[#FF8913]'
                              : 'text-slate-900 group-hover:text-[#FF4F17]'
                          }`}
                        >
                          Developer Hub &amp; API
                        </div>
                        <div
                          className={`text-[11px] leading-tight mt-0.5 ${
                            isV3 ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          REST endpoints, SDKs &amp; webhooks
                        </div>
                      </div>
                    </Link>

                    <Link
                      href="/#how-it-works"
                      onClick={() => setResourcesOpen(false)}
                      className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors group ${
                        isV3 ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div
                          className={`text-xs font-bold transition-colors ${
                            isV3
                              ? 'text-white group-hover:text-indigo-400'
                              : 'text-slate-900 group-hover:text-indigo-600'
                          }`}
                        >
                          Workflow Engine
                        </div>
                        <div
                          className={`text-[11px] leading-tight mt-0.5 ${
                            isV3 ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          Catalog-to-social pipeline guide
                        </div>
                      </div>
                    </Link>

                    <Link
                      href="/#faqs"
                      onClick={() => setResourcesOpen(false)}
                      className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors group ${
                        isV3 ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <HelpCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div
                          className={`text-xs font-bold transition-colors ${
                            isV3
                              ? 'text-white group-hover:text-emerald-400'
                              : 'text-slate-900 group-hover:text-emerald-600'
                          }`}
                        >
                          FAQs
                        </div>
                        <div
                          className={`text-[11px] leading-tight mt-0.5 ${
                            isV3 ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          Common questions &amp; answers
                        </div>
                      </div>
                    </Link>

                    <Link
                      href="/settings/governance"
                      onClick={() => setResourcesOpen(false)}
                      className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors group ${
                        isV3 ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                          isV3
                            ? 'bg-slate-800 text-slate-300 border border-white/10'
                            : 'bg-slate-100 text-slate-700 border border-slate-200/80'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div
                          className={`text-xs font-bold transition-colors ${
                            isV3 ? 'text-white group-hover:text-slate-200' : 'text-slate-900'
                          }`}
                        >
                          Security &amp; Governance
                        </div>
                        <div
                          className={`text-[11px] leading-tight mt-0.5 ${
                            isV3 ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          Zero token leakage &amp; compliance
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Unauthenticated Actions & Version Switcher */}
            <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
              {/* Theme Version Switcher Pill */}
              <button
                type="button"
                onClick={toggleTheme}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isV3
                    ? 'border border-orange-500/40 bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 shadow-sm shadow-orange-500/20'
                    : 'border border-orange-300 bg-orange-50 text-[#B54708] hover:bg-orange-100'
                }`}
                title={isV3 ? 'Switch to Classic v1' : 'Explore v3 Apple UI'}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FF8913] animate-pulse" />
                <span className="hidden sm:inline">
                  {isV3 ? 'Switch to Classic v1' : 'Explore v3 Apple UI'}
                </span>
                <span className="sm:hidden">{isV3 ? 'Classic' : 'v3 Apple'}</span>
              </button>

              <Link
                href="/login"
                className={`hidden sm:inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full transition-all ${
                  isV3
                    ? 'text-[#515154] hover:text-[#1D1D1F] hover:bg-black/5'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <LogIn className="w-4 h-4 text-slate-400" />
                <span>Sign In</span>
              </Link>

              <button
                type="button"
                onClick={() => void quickDemoLogin()}
                disabled={isLoading}
                className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-2xs whitespace-nowrap ${
                  isV3
                    ? 'border border-orange-200 bg-white hover:bg-orange-50 text-[#FF4F17] shadow-xs'
                    : 'border border-[#FF4F17]/35 bg-white hover:bg-[#FF4F17]/5 text-[#FF4F17]'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-[#FF8913] fill-[#FF8913]/20" />
                <span className="hidden xs:inline">1-Click Demo</span>
                <span className="xs:hidden">Demo</span>
              </button>

              <Link
                href="/register"
                className={`hidden sm:inline-flex items-center gap-1.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold text-white transition-all whitespace-nowrap ${
                  isV3
                    ? 'bg-gradient-to-r from-[#FF8913] to-[#FF6B2C] shadow-lg shadow-orange-500/25 hover:brightness-110'
                    : 'bg-gradient-to-r from-[#FF4F17] to-[#FF5E24] hover:from-[#E8430D] hover:to-[#EB531B] shadow-md shadow-[#FF4F17]/20 hover:shadow-lg hover:shadow-[#FF4F17]/30'
                }`}
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              {/* Mobile Menu Hamburger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`md:hidden p-2 rounded-full transition-colors ${
                  isV3 ? 'text-slate-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'
                }`}
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </nav>
        )}

        {/* ================= MOBILE / COMPACT MENU SLIDE-DOWN SHEET ================= */}
        {mobileMenuOpen && (
          <div
            className={`lg:hidden mt-2 rounded-3xl border shadow-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150 ${
              isV3
                ? 'bg-[#0B0F19]/95 backdrop-blur-xl border-white/15 text-white'
                : 'bg-white border-slate-200/90'
            }`}
          >
            {token ? (
              /* Authenticated Mobile Navigation Drawer */
              <div className="space-y-4">
                {/* Active User Card */}
                {user && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF4F17] flex items-center justify-center text-xs font-bold shrink-0">
                        {user.name ? user.name.slice(0, 2).toUpperCase() : 'NF'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {user.name || 'Merchant'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {currentWorkspace?.name || user.email}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100/70 text-[#FF4F17] border border-orange-200">
                      {currentWorkspace?.role || 'MEMBER'}
                    </span>
                  </div>
                )}

                {/* Workspace Switcher */}
                {currentWorkspace && (
                  <div className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        <span>Workspace:</span>
                      </div>
                      <select
                        value={currentWorkspace.id}
                        onChange={(e) => {
                          switchWorkspace(e.target.value);
                          setMobileMenuOpen(false);
                        }}
                        className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-800"
                      >
                        {workspaces.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowWorkspaceModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold text-[#FF4F17] bg-orange-50 hover:bg-orange-100 border border-orange-200/60 transition-colors cursor-pointer"
                      title="Create New Workspace (Mobile)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Workspace</span>
                    </button>
                  </div>
                )}

                {/* Section 1: Core Daily Workflow */}
                <div className="space-y-1">
                  <div className="px-2 pt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Core Workflow
                  </div>
                  <div className="space-y-0.5">
                    {primaryAppLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive =
                        link.href === '/'
                          ? pathname === '/'
                          : pathname === link.href || pathname.startsWith(`${link.href}/`);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center justify-between py-2 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'bg-orange-50/80 text-[#FF4F17] font-bold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`w-4 h-4 ${
                                isActive ? 'text-[#FF4F17]' : 'text-slate-400'
                              }`}
                            />
                            <span>{link.label}</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Channels & Integrations */}
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <div className="px-2 pt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Channels &amp; Assets
                  </div>
                  <div className="space-y-0.5">
                    {manageAppLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive =
                        pathname === link.href || pathname.startsWith(`${link.href}/`);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center justify-between py-2 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'bg-orange-50/80 text-[#FF4F17] font-bold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`w-4 h-4 ${
                                isActive ? 'text-[#FF4F17]' : 'text-slate-400'
                              }`}
                            />
                            <span>{link.label}</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Section 3: Workspace & Account */}
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <div className="px-2 pt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Workspace &amp; Account
                  </div>
                  <div className="space-y-0.5">
                    <Link
                      href="/billing"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between py-2 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                        pathname === '/billing'
                          ? 'bg-orange-50/80 text-[#FF4F17] font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <CreditCard
                          className={`w-4 h-4 ${
                            pathname === '/billing' ? 'text-[#FF4F17]' : 'text-slate-400'
                          }`}
                        />
                        <span>Billing</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    </Link>

                    {(currentWorkspace?.role === 'OWNER' || currentWorkspace?.role === 'ADMIN') && (
                      <Link
                        href="/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between py-2 px-2.5 rounded-xl text-xs font-semibold transition-all ${
                          pathname === '/settings' || pathname.startsWith('/settings/')
                            ? 'bg-orange-50/80 text-[#FF4F17] font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Settings
                            className={`w-4 h-4 ${
                              pathname === '/settings' ? 'text-[#FF4F17]' : 'text-slate-400'
                            }`}
                          />
                          <span>Settings</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Mobile Drawer Bottom Actions */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <Link
                    href="/composer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-3 rounded-2xl text-xs font-bold text-center bg-gradient-to-r from-[#FF4F17] to-[#FF5E24] text-white flex items-center justify-center gap-2 shadow-md shadow-[#FF4F17]/20"
                  >
                    <PenSquare className="w-4 h-4" />
                    <span>Create New Post</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void logout();
                    }}
                    className="w-full py-2.5 rounded-2xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Public Mobile Navigation Drawer */
              <div className="space-y-4">
                <div className="divide-y divide-slate-100">
                  {publicNavLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-between py-3 px-2 text-sm font-semibold text-slate-800 hover:text-[#FF4F17] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span>{link.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </Link>
                    );
                  })}

                  <Link
                    href="/developers"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between py-3 px-2 text-sm font-semibold text-slate-800 hover:text-[#FF4F17] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <span>Developer Hub &amp; API</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </Link>

                  <Link
                    href="/#faqs"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between py-3 px-2 text-sm font-semibold text-slate-800 hover:text-[#FF4F17] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </div>
                      <span>FAQs</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </Link>

                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between py-3 px-2 text-sm font-semibold text-slate-800 hover:text-[#FF4F17] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        <LogIn className="w-3.5 h-3.5" />
                      </div>
                      <span>Sign In</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </Link>
                </div>

                <div className="pt-2 space-y-2.5">
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold text-center bg-gradient-to-r from-[#FF4F17] to-[#FF5E24] text-white flex items-center justify-center gap-2 shadow-md shadow-[#FF4F17]/25"
                  >
                    <span>Start Free Trial</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void quickDemoLogin();
                    }}
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold text-center bg-white text-[#FF4F17] border border-[#FF4F17]/35 flex items-center justify-center gap-2 hover:bg-[#FF4F17]/5 transition-colors"
                  >
                    <Zap className="w-4 h-4 text-[#FF4F17] fill-[#FF4F17]/20" />
                    <span>1-Click Demo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= WORKSPACE CREATION MODAL ================= */}
      {showWorkspaceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#FF4F17]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Workspace</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Separate catalogs, media, and marketing quotas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkspaceModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nordic Home Store or Summer Apparel"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="w-full text-xs sm:text-sm rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF4F17]/20 focus:border-[#FF4F17] transition-all shadow-xs"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Products, brand profiles, and publishing channels will be isolated within this workspace.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowWorkspaceModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWs || !newWorkspaceName.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#FF4F17] to-[#FF5E24] hover:from-[#E8430D] hover:to-[#EB531B] text-white shadow-md shadow-[#FF4F17]/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isCreatingWs ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
