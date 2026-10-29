'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/auth-context';
import {
  api,
  type AnalyticsOverview,
  type PostItem,
  type ProductItem,
  type StoreConnectionItem,
  type SocialAccountItem,
} from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/formatters';
import {
  DollarSign,
  ShoppingBag,
  MousePointer,
  Send,
  Package,
  Sparkles,
  Clock,
  ArrowRight,
  PenSquare,
  Plus,
  CheckCircle2,
  AlertCircle,
  Store,
  Share2,
  RefreshCw,
  TrendingUp,
  Layers,
} from 'lucide-react';

export function DashboardOverview() {
  const { user, currentWorkspace } = useAuth();

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [stores, setStores] = useState<StoreConnectionItem[]>([]);
  const [socials, setSocials] = useState<SocialAccountItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Email verification indicator state
  const [resendLoading, setResendLoading] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    isDevOutbox?: boolean | undefined;
    devVerificationUrl?: string | undefined;
  } | null>(null);

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendFeedback(null);
    try {
      const res = await api.resendVerification();
      setResendFeedback({
        type: 'success',
        message: res.message || 'Verification link sent to your email.',
        ...(res.isDevOutbox !== undefined ? { isDevOutbox: res.isDevOutbox } : {}),
        ...(res.devVerificationUrl !== undefined ? { devVerificationUrl: res.devVerificationUrl } : {}),
      });
    } catch (err: unknown) {
      setResendFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to send verification email.',
      });
    } finally {
      setResendLoading(false);
    }
  };

  const loadDashboardData = useCallback(async (isMountedCheck?: () => boolean) => {
    if (!currentWorkspace?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      const [overviewRes, postsRes, productsRes, storesRes, socialsRes] =
        await Promise.allSettled([
          api.getAnalyticsOverview(currentWorkspace.id, 30),
          api.getPosts(currentWorkspace.id),
          api.getProducts(currentWorkspace.id),
          api.getStoreConnections(currentWorkspace.id),
          api.getSocialAccounts(currentWorkspace.id),
        ]);

      if (isMountedCheck && !isMountedCheck()) return;

      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value);
      if (postsRes.status === 'fulfilled') setPosts(postsRes.value.items);
      if (productsRes.status === 'fulfilled') setProducts(productsRes.value.items);
      if (storesRes.status === 'fulfilled') setStores(storesRes.value);
      if (socialsRes.status === 'fulfilled') setSocials(socialsRes.value);
    } catch (err: unknown) {
      if (isMountedCheck && !isMountedCheck()) return;
      setError(err instanceof Error ? err.message : 'Failed to load dashboard overview data.');
    } finally {
      if (!isMountedCheck || isMountedCheck()) {
        setIsLoading(false);
      }
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    let mounted = true;
    void loadDashboardData(() => mounted);
    return () => {
      mounted = false;
    };
  }, [loadDashboardData]);

  // Derived Pipeline metrics
  const draftPosts = posts.filter((p) => p.status === 'DRAFT');
  const awaitingPosts = posts.filter((p) => p.status === 'AWAITING_APPROVAL');
  const scheduledPosts = posts.filter((p) => p.status === 'SCHEDULED');
  const publishedPosts = posts.filter((p) => p.status === 'PUBLISHED');

  const connectedStore = stores.find((s) => s.syncStatus === 'SUCCESS' || s.syncStatus === 'IDLE');
  const activeSocials = socials.filter((s) => s.status === 'ACTIVE');

  const currency = currentWorkspace?.currency || 'USD';
  const totalRevenue = (overview?.totalRevenueCents ?? 0) / 100;
  const totalConversions = overview?.totalConversions || 0;
  const totalClicks = overview?.totalClicks || 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/* Email Verification Banner */}
        {user && !user.isEmailVerified && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 sm:p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-amber-100 p-2 text-[#B54708] shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-amber-900">Email not verified</h2>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-[#B54708]">
                      Pending Verification
                    </span>
                  </div>
                  <p className="text-xs text-amber-800">
                    Your account email <strong className="font-semibold">{user.email}</strong> is not verified yet. Verify your email to secure ownership, enable invitations, and receive critical alerts.
                  </p>
                  {resendFeedback && (
                    <div className="mt-2 space-y-1.5">
                      <p className={`text-xs font-semibold ${
                        resendFeedback.type === 'success' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {resendFeedback.message}
                      </p>
                      {resendFeedback.devVerificationUrl && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Link
                            href={resendFeedback.devVerificationUrl}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verify Email Now →
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 sm:self-center">
                <button
                  type="button"
                  onClick={() => void handleResendVerification()}
                  disabled={resendLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-amber-300 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100/70 shadow-2xs transition-all disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${resendLoading ? 'animate-pulse' : ''}`} />
                  {resendLoading ? 'Sending link…' : 'Resend verification email'}
                </button>
                <Link
                  href="/settings/team"
                  className="inline-flex items-center rounded-xl bg-amber-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-900 shadow-2xs transition-all"
                >
                  Team &amp; Access
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Welcome Header */}
        <section className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-display">
                Overview
              </h1>
              <span className="text-slate-300 font-light hidden sm:inline">•</span>
              <span className="text-sm font-semibold text-slate-700 hidden sm:inline">
                Welcome back, {user?.name || 'Commerce Merchant'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-[#FF4F17] border border-orange-200/60 uppercase">
                {currentWorkspace?.role || 'MEMBER'}
              </span>
              {user?.isEmailVerified && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Email verified
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Workspace:{' '}
              <span className="font-semibold text-slate-800">
                {currentWorkspace?.name || 'Your Workspace'}
              </span>{' '}
              • Catalog-to-social marketing hub &amp; verified attribution.
            </p>
          </div>

          {/* Quick Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/composer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#FF4F17] to-[#FF5E24] hover:from-[#E8430D] hover:to-[#EB531B] shadow-md shadow-[#FF4F17]/25 hover:shadow-lg transition-all"
            >
              <PenSquare className="w-4 h-4" />
              <span>Open Composer</span>
            </Link>
            <button
              type="button"
              onClick={() => void loadDashboardData()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
              title="Refresh dashboard metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </section>

        {/* Dynamic Data-State Context Strip (Truth-in-Engineering) */}
        <section className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 text-xs shadow-2xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-50 text-[#FF4F17] border border-orange-200/60">
              Workspace Scope
            </span>
            <span className="font-medium text-slate-700">
              Deterministic product grounding, publishing pipeline &amp; verified attribution.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectedStore ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
              <span>
                Store Sync:{' '}
                <strong className="font-semibold text-slate-700">
                  {connectedStore ? `${connectedStore.platform} (${connectedStore.syncStatus})` : 'Not connected'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  activeSocials.length > 0 ? 'bg-blue-500' : 'bg-slate-300'
                }`}
              />
              <span>
                Channels:{' '}
                <strong className="font-semibold text-slate-700">
                  {activeSocials.length > 0 ? `${activeSocials.length} active` : 'None linked'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1 text-slate-600 font-medium hidden md:flex">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Encrypted Account Security</span>
            </div>
          </div>
        </section>

        {/* Workspace Quick Start Checklist (Shown when workspace has no products, posts, or stores) */}
        {products.length === 0 && posts.length === 0 && stores.length === 0 && !isLoading && (
          <section className="rounded-3xl border border-orange-200/80 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/40 p-5 sm:p-6 shadow-xs animate-in fade-in duration-200">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-100 text-[#FF4F17]">
                    Workspace Quick Start
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Get your catalog marketing workflow rolling
                  </h3>
                </div>
                <p className="text-xs text-slate-600 max-w-2xl">
                  Connect your store or import your catalog, link your social media profiles, and start drafting catalog-grounded social content in minutes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Link
                  href="/integrations"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#FF4F17] text-white hover:bg-[#E8430D] shadow-xs transition-colors"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>1. Connect Store</span>
                </Link>
                <Link
                  href="/social-accounts"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>2. Connect Channels</span>
                </Link>
                <Link
                  href="/ai-studio"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>3. Launch AI Studio</span>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between text-xs text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadDashboardData()}
              className="underline font-bold hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Executive KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Attributed Revenue */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">Attributed Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
              {isLoading ? '...' : formatCurrency(totalRevenue, currency)}
            </div>
            <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Closed-loop attribution</span>
            </div>
          </div>

          {/* Card 2: Store Conversions */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">Store Orders</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
              {isLoading ? '...' : totalConversions}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 font-medium truncate">
              {totalConversions > 0 ? `${totalConversions} verified order conversions` : 'Awaiting first campaign order'}
            </div>
          </div>

          {/* Card 3: Tracked Clicks */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">Tracked Clicks</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                <MousePointer className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
              {isLoading ? '...' : totalClicks}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 font-medium">
              {totalClicks > 0 ? `${totalClicks} recorded UTM visits` : 'Outbound UTM traffic'}
            </div>
          </div>

          {/* Card 4: Catalog Products */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">Catalog SKUs</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
              {isLoading ? '...' : products.length}
            </div>
            <div className="mt-2 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{products.length > 0 ? `${products.length} grounded SKUs ready` : 'Grounded inventory'}</span>
            </div>
          </div>

          {/* Card 5: Live Published Posts */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">Published Posts</span>
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF4F17] border border-orange-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Send className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
              {isLoading ? '...' : publishedPosts.length}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 font-medium">
              {publishedPosts.length > 0 ? `${publishedPosts.length} across active channels` : 'Across active channels'}
            </div>
          </div>
        </section>

        {/* Content Pipeline Progress Board */}
        <section className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF4F17] border border-orange-200/60 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Publishing Pipeline</h2>
                <p className="text-xs text-slate-500">
                  Four-stage state machine enforcing human review prior to multi-channel execution.
                </p>
              </div>
            </div>
            <Link
              href="/posts"
              className="text-xs font-bold text-[#FF4F17] hover:text-[#E8430D] inline-flex items-center gap-1 transition-colors"
            >
              <span>View All Posts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
            {/* Stage 1: Drafts */}
            <Link
              href="/posts?status=DRAFT"
              className="p-4 rounded-2xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/70 hover:border-slate-300 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  1. Drafts
                </span>
                <span className="text-xl font-extrabold text-slate-900 group-hover:text-[#FF4F17] transition-colors">
                  {draftPosts.length}
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-2 font-medium">
                Editable copy awaiting review
              </div>
            </Link>

            {/* Stage 2: Awaiting Approval */}
            <Link
              href="/posts?status=AWAITING_APPROVAL"
              className="p-4 rounded-2xl bg-amber-50/40 hover:bg-amber-50/80 border border-amber-200/60 hover:border-amber-300 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  2. Awaiting Review
                </span>
                <span className="text-xl font-extrabold text-amber-800 group-hover:text-[#FF4F17] transition-colors">
                  {awaitingPosts.length}
                </span>
              </div>
              <div className="text-xs text-amber-700 mt-2 font-medium">
                Pending merchant signoff
              </div>
            </Link>

            {/* Stage 3: Scheduled */}
            <Link
              href="/posts?status=SCHEDULED"
              className="p-4 rounded-2xl bg-blue-50/40 hover:bg-blue-50/80 border border-blue-200/60 hover:border-blue-300 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  3. Scheduled
                </span>
                <span className="text-xl font-extrabold text-blue-800 group-hover:text-[#FF4F17] transition-colors">
                  {scheduledPosts.length}
                </span>
              </div>
              <div className="text-xs text-blue-700 mt-2 font-medium">
                Schedule intent saved
              </div>
            </Link>

            {/* Stage 4: Published */}
            <Link
              href="/posts?status=PUBLISHED"
              className="p-4 rounded-2xl bg-emerald-50/40 hover:bg-emerald-50/80 border border-emerald-200/60 hover:border-emerald-300 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  4. Published
                </span>
                <span className="text-xl font-extrabold text-emerald-800 group-hover:text-[#FF4F17] transition-colors">
                  {publishedPosts.length}
                </span>
              </div>
              <div className="text-xs text-emerald-700 mt-2 font-medium">
                Posts with published status
              </div>
            </Link>
          </div>
        </section>

        {/* Lower Two-Column Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2/3): Recent Content & Pipeline */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Recent Campaign Posts</h3>
              <Link
                href="/composer"
                className="text-xs font-bold text-[#FF4F17] hover:text-[#E8430D] inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Post</span>
              </Link>
            </div>

            {posts.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#FF4F17] flex items-center justify-center mx-auto">
                  <PenSquare className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-slate-800">No posts in this workspace yet</div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Generate your first catalog-grounded social post in AI Studio or open the channel composer.
                </p>
                <Link
                  href="/composer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#FF4F17] text-white hover:bg-[#E8430D] transition-colors shadow-xs"
                >
                  <PenSquare className="w-3.5 h-3.5" />
                  <span>Open Composer</span>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {posts.slice(0, 5).map((p) => (
                  <div key={p.id} className="py-3.5 flex items-start justify-between gap-4 group">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-relaxed">
                        {p.content || 'Untitled marketing post'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(p.scheduledAt || p.createdAt)}
                        </span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          {p.socialAccount ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                              {p.socialAccount.provider}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">All Channels</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          p.status === 'PUBLISHED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.status === 'SCHEDULED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : p.status === 'AWAITING_APPROVAL'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column (1/3): Integrations Health & Shortcuts */}
          <div className="space-y-6">
            {/* Store Connection Health */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-orange-500" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Store Connection
                  </h3>
                </div>
                <Link
                  href="/integrations"
                  className="text-[11px] font-bold text-[#FF4F17] hover:underline"
                >
                  Manage
                </Link>
              </div>

              {connectedStore ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {connectedStore.storeName}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {connectedStore.platform}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sync status: {connectedStore.syncStatus}</span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <div className="text-xs text-slate-600 font-medium">No store connected yet</div>
                  <Link
                    href="/integrations"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FF4F17] text-white hover:bg-[#E8430D] transition-colors"
                  >
                    <span>Connect Shopify or WooCommerce</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Social Accounts Status */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Social Accounts
                  </h3>
                </div>
                <Link
                  href="/social-accounts"
                  className="text-[11px] font-bold text-[#FF4F17] hover:underline"
                >
                  Manage
                </Link>
              </div>

              {activeSocials.length > 0 ? (
                <div className="space-y-2">
                  {activeSocials.map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-800">{s.displayName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">
                        {s.provider}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <div className="text-xs text-slate-600 font-medium">No social channels connected</div>
                  <Link
                    href="/social-accounts"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-900 transition-colors"
                  >
                    <span>Connect Instagram or LinkedIn</span>
                  </Link>
                </div>
              )}
            </div>

            {/* AI Studio Fast Trigger */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-200" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                  Grounded AI Studio
                </span>
              </div>
              <h4 className="text-base font-extrabold leading-snug font-display">
                Draft content from your catalog context
              </h4>
              <p className="text-xs text-indigo-100 leading-relaxed">
                Use the product fields available in your workspace as drafting context, then review every draft before approval.
              </p>
              <Link
                href="/ai-studio"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white text-indigo-800 hover:bg-indigo-50 transition-colors shadow-xs"
              >
                <span>Launch AI Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
