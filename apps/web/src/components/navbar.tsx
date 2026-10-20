'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import {
  Package,
  Sparkles,
  Image as ImageIcon,
  LayoutDashboard,
  Building2,
  User,
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
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
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

  // Authenticated internal app navigation
  const appNavLinks = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/catalog', label: 'Catalog', icon: Package },
    { href: '/integrations', label: 'Stores', icon: Store },
    { href: '/ai-studio', label: 'AI Studio', icon: Sparkles },
    { href: '/composer', label: 'Composer', icon: PenSquare },
    { href: '/posts', label: 'Posts & Pipeline', icon: Send },
    { href: '/campaigns', label: 'Campaigns', icon: Target },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/social-accounts', label: 'Social Accounts', icon: Share2 },
    { href: '/media', label: 'Media', icon: ImageIcon },
    { href: '/billing', label: 'Billing', icon: CreditCard },
    ...(currentWorkspace?.role === 'OWNER' || currentWorkspace?.role === 'ADMIN'
      ? [{ href: '/settings/team', label: 'Settings', icon: Settings }]
      : []),
  ];

  // Public visitor marketing navigation
  const publicNavLinks = [
    { href: '/#features', label: 'Features' },
    { href: '/#how-it-works', label: 'How It Works' },
    { href: '/#pricing', label: 'Pricing' },
    { href: '/#faqs', label: 'FAQs' },
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

  return (
    <nav className="bg-white border-b border-[#E4E7EC] sticky top-0 z-50 shadow-xs">
      {token ? (
        /* ================= AUTHENTICATED 2-TIER WORKSPACE NAVBAR ================= */
        <div>
          {/* Top Tier: Brand, Active Workspace Switcher & User Actions */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              {/* Left: Brand Identity & Active Workspace */}
              <div className="flex items-center space-x-3 sm:space-x-4">
                <Link href="/" className="flex items-center space-x-2.5 shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-[#E85D2A] flex items-center justify-center text-white font-bold text-sm shadow-xs">
                    CP
                  </div>
                  <span className="text-base font-bold tracking-tight text-[#17202A]">
                    CommercePilot
                  </span>
                </Link>

                <div className="h-5 w-px bg-[#E4E7EC] hidden sm:block" />

                {/* Workspace Switcher */}
                {currentWorkspace && (
                  <div className="flex items-center space-x-1.5 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl px-2.5 py-1 text-xs shadow-2xs">
                    <Building2 className="w-3.5 h-3.5 text-[#667085] shrink-0" />
                    <select
                      value={currentWorkspace.id}
                      onChange={(e) => switchWorkspace(e.target.value)}
                      className="bg-transparent border-none outline-none font-semibold text-[#17202A] text-xs cursor-pointer max-w-[130px] sm:max-w-[160px] truncate"
                    >
                      {workspaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowWorkspaceModal(true)}
                      className="text-[#667085] hover:text-[#E85D2A] p-0.5 rounded transition-colors"
                      title="Create New Workspace"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Quick CTA, User Profile & Logout */}
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Link
                  href="/composer"
                  className="hidden md:inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#E85D2A] hover:bg-[#d04e1f] shadow-xs transition-all"
                >
                  <PenSquare className="w-3.5 h-3.5 mr-1.5" />
                  New Post
                </Link>

                {/* User Session Profile Badge */}
                <div className="hidden sm:flex items-center text-xs text-[#344054] px-2.5 py-1.5 rounded-xl bg-[#F2F4F7] font-medium border border-[#E4E7EC]/60">
                  <User className="w-3.5 h-3.5 mr-1.5 text-[#667085]" />
                  <span className="truncate max-w-[120px] font-semibold">
                    {user?.name || 'Account'}
                  </span>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex items-center px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#667085] hover:text-[#B42318] hover:bg-[#FEF3F2] border border-transparent hover:border-[#FECDCA] transition-all"
                  title="Log Out"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1 text-[#667085]" />
                  Logout
                </button>

                {/* Mobile Menu Hamburger */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-1.5 rounded-xl text-[#667085] hover:bg-[#F2F4F7] transition-colors"
                  aria-label="Toggle navigation menu"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Subnav Row: Horizontal App Routes (Scrollable on smaller screens) */}
          <div className="border-t border-[#F2F4F7] bg-[#FCFCFD]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center space-x-1 sm:space-x-1.5 py-1 overflow-x-auto scrollbar-none">
                {appNavLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all shrink-0 ${
                        isActive
                          ? 'bg-white text-[#E85D2A] shadow-xs border border-[#E4E7EC] font-bold'
                          : 'text-[#667085] hover:text-[#17202A] hover:bg-[#F2F4F7] font-semibold'
                      }`}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 mr-1.5 ${
                          isActive ? 'text-[#E85D2A]' : 'text-[#667085]'
                        }`}
                      />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= PUBLIC VISITOR NAVBAR (1-TIER) ================= */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand Identity & Public Marketing Links */}
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-2.5 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-[#E85D2A] flex items-center justify-center text-white font-bold text-sm shadow-xs">
                  CP
                </div>
                <span className="text-base font-bold tracking-tight text-[#17202A]">
                  CommercePilot
                </span>
              </Link>

              <div className="hidden md:flex items-center space-x-6 text-sm font-medium text-[#475467]">
                {publicNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="hover:text-[#E85D2A] transition-colors font-medium text-xs sm:text-sm"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right: Unauthenticated Visitor CTAs */}
            <div className="flex items-center space-x-2.5">
              <Link
                href="/login"
                className="inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold text-[#344054] hover:bg-[#F2F4F7] transition-all"
              >
                <LogIn className="w-3.5 h-3.5 mr-1.5 text-[#667085]" />
                Sign In
              </Link>

              <button
                type="button"
                onClick={() => void quickDemoLogin()}
                disabled={isLoading}
                className="hidden sm:inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#E85D2A]/30 text-[#E85D2A] bg-[#FFF9F5] hover:bg-[#FFF2EA] transition-all disabled:opacity-50 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 mr-1 text-[#E85D2A]" />
                1-Click Demo
              </button>

              <Link
                href="/register"
                className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-[#E85D2A] text-white hover:bg-[#d04e1f] transition-all shadow-xs"
              >
                Start Free Trial
              </Link>

              {/* Mobile Menu Hamburger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-[#667085] hover:bg-[#F2F4F7] transition-colors"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E4E7EC] bg-white px-4 pt-3 pb-6 space-y-3 shadow-lg">
          {token ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1.5">
                {appNavLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center p-2.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#E85D2A]/10 text-[#E85D2A] font-bold'
                          : 'text-[#475467] hover:bg-[#F2F4F7]'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
              <div className="pt-3 border-t border-[#E4E7EC]">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void logout();
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-[#B42318] bg-[#FEF3F2] flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {publicNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-[#344054] hover:bg-[#F2F4F7]"
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 border-t border-[#E4E7EC] flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void quickDemoLogin();
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-center bg-[#FFF9F5] text-[#E85D2A] border border-[#E85D2A]/30 flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Try 1-Click Demo
                </button>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-center bg-[#E85D2A] text-white"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Workspace Modal */}
      {showWorkspaceModal && (
        <div className="fixed inset-0 bg-[#17202A]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#E4E7EC] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 pb-4 border-b border-[#F2F4F7] flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF9F5] border border-[#E85D2A]/20 flex items-center justify-center text-[#E85D2A]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17202A]">Create New Workspace</h3>
                  <p className="text-xs text-[#667085] mt-0.5">
                    Separate catalogs, media, and marketing quotas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWorkspaceModal(false)}
                className="text-[#98A2B3] hover:text-[#344054] p-1.5 rounded-lg hover:bg-[#F2F4F7] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nordic Home Store or Summer Apparel"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="w-full text-xs sm:text-sm rounded-xl border border-[#D0D5DD] px-3.5 py-2.5 text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all shadow-xs"
                    autoFocus
                  />
                  <p className="text-[11px] text-[#667085] mt-1.5">
                    Products, brand profiles, and publishing channels will be isolated within this workspace.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#F2F4F7] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowWorkspaceModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F2F4F7] shadow-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWs || !newWorkspaceName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E85D2A] text-white hover:bg-[#d04e1f] shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isCreatingWs ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
