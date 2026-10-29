'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  api,
  SuperAdminIntegrationsSummary,
  SuperAdminStoreConnectionItem,
  SuperAdminSocialAccountItem,
} from '../../../lib/api';
import {
  Store,
  Share2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ShieldAlert,
  Sliders,
  ExternalLink,
  Info,
} from 'lucide-react';

export default function SuperAdminIntegrationsPage() {
  const [activeTab, setActiveTab] = useState<'stores' | 'social'>('stores');
  const [summary, setSummary] = useState<SuperAdminIntegrationsSummary | null>(null);

  // Stores State
  const [stores, setStores] = useState<SuperAdminStoreConnectionItem[]>([]);
  const [storesTotal, setStoresTotal] = useState<number>(0);
  const [storesTotalPages, setStoresTotalPages] = useState<number>(1);
  const [storesPage, setStoresPage] = useState<number>(1);
  const [storesSearch, setStoresSearch] = useState<string>('');
  const [storesPlatform, setStoresPlatform] = useState<string>('ALL');
  const [storesSyncStatus, setStoresSyncStatus] = useState<string>('ALL');
  const [isLoadingStores, setIsLoadingStores] = useState<boolean>(true);

  // Social State
  const [socialAccounts, setSocialAccounts] = useState<SuperAdminSocialAccountItem[]>([]);
  const [socialTotal, setSocialTotal] = useState<number>(0);
  const [socialTotalPages, setSocialTotalPages] = useState<number>(1);
  const [socialPage, setSocialPage] = useState<number>(1);
  const [socialSearch, setSocialSearch] = useState<string>('');
  const [socialProvider, setSocialProvider] = useState<string>('ALL');
  const [socialStatus, setSocialStatus] = useState<string>('ALL');
  const [isLoadingSocial, setIsLoadingSocial] = useState<boolean>(true);

  // Feedback State
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  // Modals
  const [errorModalStore, setErrorModalStore] = useState<SuperAdminStoreConnectionItem | null>(null);
  const [statusOverrideAccount, setStatusOverrideAccount] = useState<SuperAdminSocialAccountItem | null>(null);
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DISCONNECTED'>('REVOKED');
  const [overrideReason, setOverrideReason] = useState<string>('');

  const fetchSummary = useCallback(async () => {
    try {
      const data = await api.getSuperAdminIntegrationsSummary();
      setSummary(data);
    } catch (err) {
      // Non-blocking telemetry
      console.warn('Failed to load integration summary:', err);
    }
  }, []);

  const fetchStores = useCallback(async () => {
    setIsLoadingStores(true);
    setError(null);
    try {
      const data = await api.getSuperAdminIntegrationStores({
        page: storesPage,
        limit: 20,
        search: storesSearch.trim() || undefined,
        platform: storesPlatform !== 'ALL' ? storesPlatform : undefined,
        syncStatus: storesSyncStatus !== 'ALL' ? storesSyncStatus : undefined,
      });
      setStores(data.stores);
      setStoresTotal(data.pagination.total);
      setStoresTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch store connections.');
    } finally {
      setIsLoadingStores(false);
    }
  }, [storesPage, storesSearch, storesPlatform, storesSyncStatus]);

  const fetchSocial = useCallback(async () => {
    setIsLoadingSocial(true);
    setError(null);
    try {
      const data = await api.getSuperAdminIntegrationSocial({
        page: socialPage,
        limit: 20,
        search: socialSearch.trim() || undefined,
        provider: socialProvider !== 'ALL' ? socialProvider : undefined,
        status: socialStatus !== 'ALL' ? socialStatus : undefined,
      });
      setSocialAccounts(data.accounts);
      setSocialTotal(data.pagination.total);
      setSocialTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch social accounts.');
    } finally {
      setIsLoadingSocial(false);
    }
  }, [socialPage, socialSearch, socialProvider, socialStatus]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (activeTab === 'stores') {
      void fetchStores();
    } else {
      void fetchSocial();
    }
  }, [activeTab, fetchStores, fetchSocial]);

  const handleForceSync = async (store: SuperAdminStoreConnectionItem) => {
    setIsSubmittingAction(true);
    setError(null);
    try {
      await api.triggerSuperAdminStoreSync(store.id);
      setSuccessMessage(`Triggered resync for ${store.storeName} (${store.platform}).`);
      await Promise.all([fetchStores(), fetchSummary()]);
    } catch (err) {
      setError((err as Error).message || 'Failed to trigger store sync.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleUpdateSocialStatus = async () => {
    if (!statusOverrideAccount) return;
    setIsSubmittingAction(true);
    setError(null);
    try {
      await api.updateSuperAdminSocialStatus(
        statusOverrideAccount.id,
        newStatus,
        overrideReason.trim() || undefined,
      );
      setSuccessMessage(`Account status updated to ${newStatus} for ${statusOverrideAccount.displayName}.`);
      setStatusOverrideAccount(null);
      setOverrideReason('');
      await Promise.all([fetchSocial(), fetchSummary()]);
    } catch (err) {
      setError((err as Error).message || 'Failed to update social account status.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Integration Fleet & Diagnostics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/60 text-blue-400 border border-blue-800/50 uppercase tracking-wider">
              Fleet Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Fleet-wide diagnostic telemetry for all ecommerce catalog syncs and connected social OAuth credentials across all tenants.
          </p>
        </div>

        <button
          onClick={() => {
            void fetchSummary();
            if (activeTab === 'stores') void fetchStores();
            else void fetchSocial();
          }}
          disabled={isLoadingStores || isLoadingSocial}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-all shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${(isLoadingStores || isLoadingSocial) ? 'animate-spin' : ''}`} />
          <span>Refresh Fleet Data</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-slate-900 font-bold text-xs">✕</button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-300 hover:text-slate-900 font-bold text-xs">✕</button>
        </div>
      )}

      {/* Metric Cards — Waymark Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-sky-500/10 blur-2xl group-hover:bg-sky-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Connected Stores</span>
            <div className="h-7 w-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">{summary?.stores.total ?? 0}</div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            {summary?.stores.healthy ?? 0} healthy • {summary?.stores.failing ?? 0} failing
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-rose-500/10 blur-2xl group-hover:bg-rose-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Sync Issues</span>
            <div className="h-7 w-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono tracking-tight mt-2 ${(summary?.stores.failing ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {summary?.stores.failing ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {(summary?.stores.failing ?? 0) === 0 ? 'All sync pipelines nominal' : 'Action required'}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Social Accounts</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Share2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">{summary?.social.total ?? 0}</div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            {summary?.social.active ?? 0} active credentials
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Expiring Soon (&lt;7d)</span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono tracking-tight mt-2 ${(summary?.social.expiringSoon ?? 0) > 0 ? 'text-amber-400' : 'text-slate-700'}`}>
            {summary?.social.expiringSoon ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            {summary?.social.expired ?? 0} already expired
          </p>
        </div>
      </div>

      {/* Tabs — Waymark Pill Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs">
        <button
          onClick={() => setActiveTab('stores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all cursor-pointer ${
            activeTab === 'stores'
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-800/40'
          }`}
        >
          <Store className="h-4 w-4" />
          <span>Ecommerce Stores Fleet ({summary?.stores.total ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('social')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all cursor-pointer ${
            activeTab === 'social'
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-800/40'
          }`}
        >
          <Share2 className="h-4 w-4" />
          <span>Social Channels Fleet ({summary?.social.total ?? 0})</span>
        </button>
      </div>

      {/* Tab 1: Stores Fleet */}
      {activeTab === 'stores' && (
        <div className="space-y-4">
          {/* Stores Filter Bar — Waymark Glass Bar */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200 backdrop-blur-xl flex flex-wrap items-center gap-3 text-xs">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search store name or domain..."
                value={storesSearch}
                onChange={(e) => {
                  setStoresSearch(e.target.value);
                  setStoresPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all"
              />
            </div>

            <select
              value={storesPlatform}
              onChange={(e) => {
                setStoresPlatform(e.target.value);
                setStoresPage(1);
              }}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
            >
              <option value="ALL">All Platforms</option>
              <option value="SHOPIFY">Shopify</option>
              <option value="WOOCOMMERCE">WooCommerce</option>
              <option value="CUSTOM">Custom API</option>
            </select>

            <select
              value={storesSyncStatus}
              onChange={(e) => {
                setStoresSyncStatus(e.target.value);
                setStoresPage(1);
              }}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
            >
              <option value="ALL">All Sync Statuses</option>
              <option value="SUCCESS">Success Only</option>
              <option value="FAILED">Failed Only</option>
              <option value="SYNCING">Syncing</option>
              <option value="IDLE">Idle</option>
            </select>
          </div>

          {/* Stores Table — Waymark Glass Table */}
          <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-mono tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Platform & Store</th>
                    <th className="py-3 px-4">Tenant Workspace</th>
                    <th className="py-3 px-4">Sync Status</th>
                    <th className="py-3 px-4">Products</th>
                    <th className="py-3 px-4">Last Sync</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingStores ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-400" />
                        <span>Loading store connections fleet...</span>
                      </td>
                    </tr>
                  ) : stores.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <Store className="h-8 w-8 mx-auto mb-2 text-slate-600 opacity-50" />
                        <p className="font-medium text-slate-500">No store connections match criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    stores.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Store Info */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shrink-0 ${
                              s.platform === 'SHOPIFY'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : s.platform === 'WOOCOMMERCE'
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                : 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                            }`}>
                              {s.platform}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-900">{s.storeName}</div>
                              <a
                                href={s.storeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-500 hover:text-indigo-400 text-[11px] font-mono flex items-center gap-1"
                              >
                                <span>{s.storeUrl}</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          </div>
                        </td>

                        {/* Tenant Workspace */}
                        <td className="py-3.5 px-4">
                          <div>
                            <div className="font-medium text-slate-800">{s.workspace.name}</div>
                            <div className="text-slate-500 text-[11px] font-mono">
                              {s.workspace.slug} • {s.workspace.planTier}
                            </div>
                          </div>
                        </td>

                        {/* Sync Status */}
                        <td className="py-3.5 px-4">
                          {s.syncStatus === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Success</span>
                            </span>
                          ) : s.syncStatus === 'FAILED' ? (
                            <button
                              onClick={() => setErrorModalStore(s)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-500/20 transition-colors cursor-pointer"
                              title="Inspect error message"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              <span>Failed (Inspect)</span>
                            </button>
                          ) : s.syncStatus === 'SYNCING' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-sky-50 text-sky-700 border border-sky-200">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>Syncing</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 border border-slate-700">
                              <span>Idle</span>
                            </span>
                          )}
                        </td>

                        {/* Synced Products */}
                        <td className="py-3.5 px-4 font-mono text-slate-900">
                          {s.syncedProducts.toLocaleString()}
                        </td>

                        {/* Last Sync */}
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : 'Never'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => void handleForceSync(s)}
                            disabled={isSubmittingAction || s.syncStatus === 'SYNCING'}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-800 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer"
                            title="Trigger Manual Resync"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Resync</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {storesTotalPages > 1 && (
              <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                <div>Showing page <span className="font-bold text-slate-900 font-mono">{storesPage}</span> of {storesTotalPages} ({storesTotal} stores)</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStoresPage((p) => Math.max(1, p - 1))}
                    disabled={storesPage <= 1 || isLoadingStores}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-200 hover:border-slate-300 disabled:opacity-30 rounded-lg text-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Prev</span>
                  </button>
                  <button
                    onClick={() => setStoresPage((p) => Math.min(storesTotalPages, p + 1))}
                    disabled={storesPage >= storesTotalPages || isLoadingStores}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-200 hover:border-slate-300 disabled:opacity-30 rounded-lg text-slate-700 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Social Channels Fleet */}
      {activeTab === 'social' && (
        <div className="space-y-4">
          {/* Social Filter Bar — Waymark Glass Bar */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200 backdrop-blur-xl flex flex-wrap items-center gap-3 text-xs">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search account name or handle..."
                value={socialSearch}
                onChange={(e) => {
                  setSocialSearch(e.target.value);
                  setSocialPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all"
              />
            </div>

            <select
              value={socialProvider}
              onChange={(e) => {
                setSocialProvider(e.target.value);
                setSocialPage(1);
              }}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
            >
              <option value="ALL">All Providers</option>
              <option value="META_INSTAGRAM">Instagram</option>
              <option value="LINKEDIN">LinkedIn</option>
              <option value="META_FACEBOOK">Facebook</option>
              <option value="TIKTOK">TikTok</option>
              <option value="PINTEREST">Pinterest</option>
              <option value="TWITTER">X / Twitter</option>
              <option value="YOUTUBE">YouTube</option>
            </select>

            <select
              value={socialStatus}
              onChange={(e) => {
                setSocialStatus(e.target.value);
                setSocialPage(1);
              }}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="EXPIRED">Expired</option>
              <option value="REVOKED">Revoked</option>
              <option value="DISCONNECTED">Disconnected</option>
            </select>
          </div>

          {/* Social Table — Waymark Glass Table */}
          <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-mono tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Provider & Account</th>
                    <th className="py-3 px-4">Tenant Workspace</th>
                    <th className="py-3 px-4">Token Status</th>
                    <th className="py-3 px-4">Expiration</th>
                    <th className="py-3 px-4">Scopes Granted</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingSocial ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-400" />
                        <span>Loading social accounts fleet...</span>
                      </td>
                    </tr>
                  ) : socialAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <Share2 className="h-8 w-8 mx-auto mb-2 text-slate-600 opacity-50" />
                        <p className="font-medium text-slate-500">No social accounts match criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    socialAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Provider & Identity */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shrink-0 ${
                              acc.provider === 'META_INSTAGRAM'
                                ? 'bg-pink-500/10 text-pink-300 border-pink-500/30'
                                : acc.provider === 'LINKEDIN'
                                ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 border-slate-700'
                            }`}>
                              {acc.provider.replace('META_', '')}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-900">{acc.displayName}</div>
                              <div className="text-slate-500 text-[11px] font-mono">
                                {acc.username ? `@${acc.username}` : acc.providerAccountId}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Tenant Workspace */}
                        <td className="py-3.5 px-4">
                          <div>
                            <div className="font-medium text-slate-800">{acc.workspace.name}</div>
                            <div className="text-slate-500 text-[11px] font-mono">
                              {acc.workspace.slug} • {acc.workspace.planTier}
                            </div>
                          </div>
                        </td>

                        {/* Token Status */}
                        <td className="py-3.5 px-4">
                          {acc.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Active</span>
                            </span>
                          ) : acc.status === 'EXPIRED' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="h-3 w-3" />
                              <span>Expired</span>
                            </span>
                          ) : acc.status === 'REVOKED' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200">
                              <ShieldAlert className="h-3 w-3" />
                              <span>Revoked</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 border border-slate-700">
                              <span>{acc.status}</span>
                            </span>
                          )}
                        </td>

                        {/* Expiration Countdown */}
                        <td className="py-3.5 px-4">
                          {acc.tokenExpiresAt ? (
                            <div>
                              <span className={`font-mono text-[11px] font-semibold ${
                                acc.isExpiringSoon ? 'text-amber-400' : 'text-slate-700'
                              }`}>
                                {acc.daysUntilExpiration !== null && acc.daysUntilExpiration !== undefined
                                  ? acc.daysUntilExpiration > 0
                                    ? `In ${acc.daysUntilExpiration} day(s)`
                                    : 'Expired'
                                  : 'Active'}
                              </span>
                              <span className="text-slate-500 text-[10px] block font-mono">
                                {new Date(acc.tokenExpiresAt).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic font-mono">Non-expiring / Refreshable</span>
                          )}
                        </td>

                        {/* Scopes */}
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-mono" title={acc.scopes.join(', ')}>
                            {acc.scopes.length} scope(s)
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setStatusOverrideAccount(acc);
                              setNewStatus(acc.status === 'ACTIVE' ? 'REVOKED' : 'ACTIVE');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-800 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            title="Status Override / Flag"
                          >
                            <Sliders className="h-3.5 w-3.5" />
                            <span>Override</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {socialTotalPages > 1 && (
              <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                <div>Showing page <span className="font-bold text-slate-900 font-mono">{socialPage}</span> of {socialTotalPages} ({socialTotal} accounts)</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSocialPage((p) => Math.max(1, p - 1))}
                    disabled={socialPage <= 1 || isLoadingSocial}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-200 hover:border-slate-300 disabled:opacity-30 rounded-lg text-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Prev</span>
                  </button>
                  <button
                    onClick={() => setSocialPage((p) => Math.min(socialTotalPages, p + 1))}
                    disabled={socialPage >= socialTotalPages || isLoadingSocial}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-200 hover:border-slate-300 disabled:opacity-30 rounded-lg text-slate-700 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 1: Store Error Inspector --- */}
      {errorModalStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-rose-500/30 p-6 space-y-4 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Catalog Sync Diagnostic</h3>
                <p className="text-xs text-rose-300 font-mono">{errorModalStore.storeName} ({errorModalStore.platform})</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <span className="text-slate-500 font-semibold block">Last Reported Error:</span>
              <div className="p-3 rounded-xl bg-white border border-slate-200 text-rose-300 font-mono text-[11px] whitespace-pre-wrap">
                {errorModalStore.errorMessage || 'No specific error message was recorded by the adapter.'}
              </div>

              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
                <span>
                  Tip: If credentials have changed or expired, instruct the workspace owner to re-authenticate the store under Workspace Settings &gt; Integrations.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => setErrorModalStore(null)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  const s = errorModalStore;
                  setErrorModalStore(null);
                  void handleForceSync(s);
                }}
                disabled={isSubmittingAction}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-sky-600/20 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retry Sync Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Social Status Override --- */}
      {statusOverrideAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-indigo-500/30 p-6 space-y-4 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center gap-3 text-indigo-400">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <Sliders className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Override Account Status</h3>
                <p className="text-xs text-indigo-300 font-mono">{statusOverrideAccount.displayName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-700">
              Administrative status overrides are cryptographically logged. Use this when a provider reports token invalidation, policy violation, or when restoring a reconnected handle.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Target Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DISCONNECTED')}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="REVOKED">REVOKED</option>
                  <option value="DISCONNECTED">DISCONNECTED</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Reason / Note (Audited)</label>
                <input
                  type="text"
                  placeholder="e.g. Meta Graph API token invalidation notice..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => {
                  setStatusOverrideAccount(null);
                  setOverrideReason('');
                }}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleUpdateSocialStatus()}
                disabled={isSubmittingAction}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                {isSubmittingAction ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sliders className="h-3.5 w-3.5" />}
                <span>Save Override</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
