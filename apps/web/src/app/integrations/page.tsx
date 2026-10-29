'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { ProtectedRoute } from '../../components/protected-route';
import { api, type StoreConnectionItem, type ConnectStorePayload } from '../../lib/api';
import { formatDateTime } from '../../lib/formatters';
import {
  ShoppingBag,
  Store,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Lock,
  X,
  Check,
  Code2,
  Terminal,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function IntegrationsPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="p-8 text-center text-sm text-[#667085]">Loading integrations...</div>}>
        <IntegrationsContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function IntegrationsContent() {
  const { currentWorkspace } = useAuth();
  const [stores, setStores] = useState<StoreConnectionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Shopify OAuth state
  const [shopifyAuthMode, setShopifyAuthMode] = useState<'OAUTH' | 'MANUAL'>('OAUTH');
  const [shopifyDomain, setShopifyDomain] = useState<string>('');
  const [isAuthorizingOAuth, setIsAuthorizingOAuth] = useState<boolean>(false);

  // Connect form state
  const [formData, setFormData] = useState<ConnectStorePayload>({
    platform: 'SHOPIFY',
    storeName: '',
    storeUrl: '',
    apiKey: '',
    apiSecret: '',
    apiVersion: '2026-01',
  });

  const searchParams = useSearchParams();

  const loadStores = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await api.getStoreConnections(currentWorkspace.id);
      setStores(list);
    } catch (err) {
      setError((err as Error).message || 'Failed to load store connections.');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  // Handle post-OAuth redirect query parameters (?status=success&platform=shopify&store=...)
  useEffect(() => {
    if (!searchParams) return;
    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const store = searchParams.get('store');
    const errorParam = searchParams.get('error');

    if (status === 'success' && platform === 'shopify') {
      setSuccessMessage(
        `Successfully connected ${store || 'Shopify store'} via OAuth! Catalog synchronization started.`,
      );
      void loadStores();
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('status');
        url.searchParams.delete('platform');
        url.searchParams.delete('store');
        window.history.replaceState({}, document.title, url.pathname);
      }
    } else if (status === 'error') {
      setError(errorParam ? decodeURIComponent(errorParam) : 'Shopify OAuth connection failed.');
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('status');
        url.searchParams.delete('error');
        window.history.replaceState({}, document.title, url.pathname);
      }
    }
  }, [searchParams, loadStores]);

  const handleShopifyOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    if (!shopifyDomain.trim()) {
      setError('Please enter your Shopify store domain (e.g. your-store.myshopify.com)');
      return;
    }

    setIsAuthorizingOAuth(true);
    setError(null);
    try {
      const res = await api.authorizeShopify(currentWorkspace.id, shopifyDomain.trim());
      if (res.authUrl) {
        window.location.href = res.authUrl;
      } else {
        throw new Error('Did not receive authorization URL from server.');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to start Shopify authorization.');
      setIsAuthorizingOAuth(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;

    setIsConnecting(true);
    setError(null);
    try {
      await api.connectStore(currentWorkspace.id, {
        platform: formData.platform,
        storeName: formData.storeName.trim(),
        storeUrl: formData.storeUrl.trim(),
        apiKey: formData.apiKey.trim(),
        ...(formData.apiSecret?.trim() ? { apiSecret: formData.apiSecret.trim() } : {}),
        ...(formData.apiVersion?.trim() ? { apiVersion: formData.apiVersion.trim() } : {}),
      });

      setSuccessMessage(`Successfully connected ${formData.storeName}!`);
      setIsModalOpen(false);
      setFormData({
        platform: 'SHOPIFY',
        storeName: '',
        storeUrl: '',
        apiKey: '',
        apiSecret: '',
        apiVersion: '2024-01',
      });
      await loadStores();
    } catch (err) {
      setError((err as Error).message || 'Failed to connect store.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async (connectionId: string) => {
    if (!currentWorkspace) return;
    setSyncingId(connectionId);
    setError(null);
    try {
      const res = await api.syncStore(currentWorkspace.id, connectionId);
      setSuccessMessage(res.message || `Successfully synced ${res.synced} products.`);
      await loadStores();
    } catch (err) {
      setError((err as Error).message || 'Store sync failed.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (connectionId: string, storeName: string) => {
    if (!currentWorkspace) return;
    if (!confirm(`Are you sure you want to disconnect ${storeName}? Synchronized products will remain in your catalog.`)) return;

    try {
      await api.disconnectStore(currentWorkspace.id, connectionId);
      setSuccessMessage(`Disconnected ${storeName}.`);
      await loadStores();
    } catch (err) {
      setError((err as Error).message || 'Failed to disconnect store.');
    }
  };

  const getPlatformBadge = (platform: StoreConnectionItem['platform']) => {
    switch (platform) {
      case 'SHOPIFY':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'WOOCOMMERCE':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'CUSTOM':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl space-y-6">
      {/* Header with Navigation Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#E4E7EC] gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#FFF9F5] border border-[#E85D2A]/20 flex items-center justify-center text-[#E85D2A]">
              <Store className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17202A]">
              Ecommerce Store Integrations
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#16803C]/10 text-[#16803C]">
              Catalog Grounding
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#667085] mt-1 max-w-2xl">
            Connect Shopify, WooCommerce, or custom storefronts to continuously synchronize catalogs, prices,
            and stock into grounded marketing content.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/integrations/developer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#D0D5DD] bg-white text-[#344054] rounded-xl text-xs font-semibold hover:bg-[#F9FAFB] shadow-xs transition-all shrink-0 min-h-[44px] sm:min-h-9"
          >
            <Code2 className="h-4 w-4 text-[#E85D2A]" />
            Developer Hub & Custom API
          </Link>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#E85D2A] text-white rounded-xl text-xs font-bold hover:bg-[#d04e1f] shadow-xs transition-all shrink-0 cursor-pointer min-h-[44px] sm:min-h-9"
          >
            <Plus className="h-4 w-4" />
            Connect Store
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div role="alert" className="p-4 rounded-xl border border-[#FECDCA] bg-[#FEF3F2] text-[#B42318] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[#B42318] hover:opacity-75 p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div role="status" className="p-4 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] text-[#027A48] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-[#027A48] hover:opacity-75 p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Developer Hub Banner */}
      <div className="p-4 sm:p-5 rounded-2xl border border-blue-200 bg-blue-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#17202A] flex items-center gap-2">
              Building a custom storefront, Medusa, or ERP integration?
            </h3>
            <p className="text-xs text-[#475467] mt-0.5 leading-relaxed">
              Use our Push Ingestion REST API, test payload sandbox, and interactive schema validator to directly sync products from any custom platform.
            </p>
          </div>
        </div>
        <Link
          href="/integrations/developer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shrink-0"
        >
          Open Developer Console <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Store Connections Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#17202A] flex items-center gap-2">
            <span>Connected Storefronts</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F2F4F7] text-[#344054]">
              {stores.length}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => void loadStores()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#667085] hover:text-[#17202A] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-[#667085] bg-white border border-[#E4E7EC] rounded-2xl shadow-xs">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#E85D2A]" />
            <p className="text-xs">Loading store connections…</p>
          </div>
        ) : stores.length === 0 ? (
          <div className="p-8 sm:p-12 text-center border-2 border-dashed border-[#E4E7EC] rounded-2xl bg-white shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[#FFF9F5] text-[#E85D2A] flex items-center justify-center mx-auto mb-3">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-[#17202A]">No ecommerce stores connected</h3>
            <p className="text-xs text-[#667085] max-w-md mx-auto mt-1 mb-5">
              Connect your Shopify, WooCommerce, or Custom store to automatically ground your AI marketing copy in live products and prices.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#E85D2A] text-white rounded-xl text-xs font-bold hover:bg-[#d04e1f] transition-all shadow-xs cursor-pointer min-h-[44px] sm:min-h-9"
              >
                <Plus className="h-4 w-4" /> Connect A Store
              </button>
              <Link
                href="/integrations/developer"
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#D0D5DD] bg-white text-[#344054] rounded-xl text-xs font-semibold hover:bg-[#F9FAFB] shadow-xs transition-all min-h-[44px] sm:min-h-9"
              >
                <Code2 className="h-4 w-4" /> Custom Ingest Docs
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stores.map((store) => (
              <div
                key={store.id}
                className="p-5 sm:p-6 rounded-2xl border border-[#E4E7EC] bg-white shadow-xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getPlatformBadge(store.platform)}`}>
                      {store.platform}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        store.syncStatus === 'SUCCESS'
                          ? 'bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]'
                          : store.syncStatus === 'SYNCING'
                            ? 'bg-[#EFF8FF] text-[#175CD3] border border-[#B2DDFF] animate-pulse'
                            : store.syncStatus === 'FAILED'
                              ? 'bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]'
                              : 'bg-[#F2F4F7] text-[#475467] border border-[#E4E7EC]'
                      }`}
                    >
                      {store.syncStatus}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#17202A] mt-3 truncate">{store.storeName}</h3>
                  <a
                    href={store.storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#667085] flex items-center gap-1 mt-1 hover:text-[#17202A] transition-colors truncate"
                  >
                    <span className="truncate">{store.storeUrl}</span> <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#F2F4F7] text-xs">
                    <div>
                      <span className="text-[#667085] block text-[11px]">Synced Products</span>
                      <span className="font-bold text-[#17202A] text-sm">
                        {store.syncedProducts} items
                      </span>
                    </div>
                    <div>
                      <span className="text-[#667085] block text-[11px]">Credential Status</span>
                      <span className="font-mono text-[#344054] text-[11px]">
                        {store.apiKeyMasked}
                      </span>
                    </div>
                  </div>

                  {store.errorMessage && (
                    <div className="mt-3 p-2.5 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs leading-relaxed">
                      {store.errorMessage}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between pt-5 mt-5 border-t border-[#F2F4F7] gap-3">
                  <span className="text-[11px] text-[#667085]">
                    Last sync:{' '}
                    {store.lastSyncAt
                      ? formatDateTime(
                          store.lastSyncAt,
                          currentWorkspace?.timezone,
                          currentWorkspace?.locale,
                          'medium',
                        )
                      : 'Never'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSync(store.id)}
                      disabled={syncingId === store.id || store.syncStatus === 'SYNCING'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF9F5] hover:bg-[#FFF2EA] text-[#E85D2A] border border-[#E85D2A]/30 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer min-h-[36px]"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${syncingId === store.id ? 'animate-spin' : ''}`}
                      />
                      {syncingId === store.id ? 'Syncing…' : 'Sync Catalog'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDisconnect(store.id, store.storeName)}
                      className="p-2 text-[#98A2B3] hover:text-[#B42318] hover:bg-[#FEF3F2] rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Disconnect Store"
                      aria-label={`Disconnect ${store.storeName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Architecture Callout */}
      <div className="mt-8 p-4 sm:p-5 rounded-2xl border border-[#E4E7EC] bg-white flex flex-col md:flex-row items-start md:items-center gap-4 shadow-xs">
        <div className="h-10 w-10 rounded-xl bg-[#FFF9F5] border border-[#E85D2A]/20 text-[#E85D2A] flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-[#17202A] flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-[#16803C]" />
            Enterprise Credential &amp; Data Privacy
          </h4>
          <p className="text-[11px] text-[#667085] mt-0.5 leading-relaxed">
            All store connections and access keys are securely encrypted at rest. Sensitive credentials remain confidential and are never exposed in browser payloads or public logs.
          </p>
        </div>
      </div>

      {/* ================= CONNECT STORE POPUP MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17202A]/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-[#E4E7EC] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-[#F2F4F7] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF9F5] border border-[#E85D2A]/20 flex items-center justify-center text-[#E85D2A] shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#17202A]">Connect Ecommerce Store</h2>
                  <p className="text-xs text-[#667085] mt-0.5">
                    Authorize real-time product and catalog synchronization.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#98A2B3] hover:text-[#344054] p-2 rounded-lg hover:bg-[#F2F4F7] transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={(e) => {
                if (formData.platform === 'SHOPIFY' && shopifyAuthMode === 'OAUTH') {
                  void handleShopifyOAuth(e);
                } else {
                  void handleConnect(e);
                }
              }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Platform Selector (3 options) */}
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Store Platform
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['SHOPIFY', 'WOOCOMMERCE', 'CUSTOM'] as const).map((plt) => (
                      <button
                        type="button"
                        key={plt}
                        onClick={() => setFormData({ ...formData, platform: plt })}
                        className={`p-2.5 sm:p-3 rounded-xl border text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                          formData.platform === plt
                            ? 'border-2 border-[#E85D2A] bg-[#FFF9F5] text-[#E85D2A] shadow-xs'
                            : 'border border-[#E4E7EC] bg-[#F9FAFB] hover:bg-[#F2F4F7] text-[#475467]'
                        }`}
                      >
                        {formData.platform === plt && <Check className="w-3.5 h-3.5" />}
                        {plt === 'CUSTOM' ? 'Custom API' : plt === 'SHOPIFY' ? 'Shopify' : 'WooCommerce'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shopify OAuth vs Manual Mode Switcher */}
                {formData.platform === 'SHOPIFY' && (
                  <div className="flex items-center p-1 bg-[#F2F4F7] rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setShopifyAuthMode('OAUTH')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        shopifyAuthMode === 'OAUTH'
                          ? 'bg-white text-[#17202A] shadow-xs'
                          : 'text-[#667085] hover:text-[#17202A]'
                      }`}
                    >
                      1-Click OAuth (Recommended)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShopifyAuthMode('MANUAL')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        shopifyAuthMode === 'MANUAL'
                          ? 'bg-white text-[#17202A] shadow-xs'
                          : 'text-[#667085] hover:text-[#17202A]'
                      }`}
                    >
                      Manual Token (Custom App)
                    </button>
                  </div>
                )}

                {/* Shopify OAuth Form View */}
                {formData.platform === 'SHOPIFY' && shopifyAuthMode === 'OAUTH' ? (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Official Shopify OAuth 2.0</strong>: Connect securely without copying API tokens.
                        You will be redirected to Shopify to approve catalog read permissions.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                        Shopify Store Domain
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. your-store.myshopify.com or your-store"
                        value={shopifyDomain}
                        onChange={(e) => setShopifyDomain(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-xs sm:text-sm text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] shadow-xs transition-all font-mono"
                      />
                      <p className="text-[11px] text-[#667085] mt-1">
                        Enter your store handle or full .myshopify.com domain.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Store Name */}
                    <div>
                      <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                        Store Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={
                          formData.platform === 'CUSTOM'
                            ? 'e.g. Medusa Headless Store or ERP Catalog'
                            : 'e.g. Flagship Store or Brand Official'
                        }
                        value={formData.storeName}
                        onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-xs sm:text-sm text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] shadow-xs transition-all"
                      />
                    </div>

                    {/* Store URL */}
                    <div>
                      <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                        {formData.platform === 'CUSTOM' ? 'Catalog API Endpoint URL' : 'Store URL'}
                      </label>
                      <input
                        type="url"
                        required
                        placeholder={
                          formData.platform === 'SHOPIFY'
                            ? 'https://your-store.myshopify.com'
                            : formData.platform === 'WOOCOMMERCE'
                            ? 'https://store.example.com'
                            : 'https://api.yourstore.com/catalog/products'
                        }
                        value={formData.storeUrl}
                        onChange={(e) => setFormData({ ...formData, storeUrl: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-xs sm:text-sm text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] shadow-xs transition-all font-mono"
                      />
                      <p className="text-[11px] text-[#667085] mt-1">
                        {formData.platform === 'SHOPIFY'
                          ? 'Must be your official .myshopify.com admin domain or custom domain.'
                          : formData.platform === 'WOOCOMMERCE'
                          ? 'The full URL where your WooCommerce WordPress instance is hosted.'
                          : 'The HTTP GET endpoint returning an array of product items or { products: [...] }.'}
                      </p>
                    </div>

                    {/* API Key / Token */}
                    <div>
                      <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                        {formData.platform === 'SHOPIFY'
                          ? 'Shopify Admin API Access Token'
                          : formData.platform === 'WOOCOMMERCE'
                          ? 'WooCommerce Consumer Key (ck_...)'
                          : 'Authorization Bearer Token / API Key'}
                      </label>
                      <input
                        type="password"
                        required
                        placeholder={
                          formData.platform === 'SHOPIFY'
                            ? 'shpat_xxxxxxxxxxxx'
                            : formData.platform === 'WOOCOMMERCE'
                            ? 'ck_xxxxxxxxxxxx'
                            : 'Bearer token or API Secret'
                        }
                        value={formData.apiKey}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-xs sm:text-sm text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] shadow-xs transition-all font-mono"
                      />
                    </div>

                    {/* WooCommerce Consumer Secret or Custom Secret */}
                    {(formData.platform === 'WOOCOMMERCE' || formData.platform === 'CUSTOM') && (
                      <div>
                        <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                          {formData.platform === 'WOOCOMMERCE'
                            ? 'WooCommerce Consumer Secret (cs_...)'
                            : 'Optional Custom Secret / Header (x-api-secret)'}
                        </label>
                        <input
                          type="password"
                          required={formData.platform === 'WOOCOMMERCE'}
                          placeholder={
                            formData.platform === 'WOOCOMMERCE' ? 'cs_xxxxxxxxxxxx' : 'Optional secondary secret'
                          }
                          value={formData.apiSecret || ''}
                          onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-xs sm:text-sm text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] shadow-xs transition-all font-mono"
                        />
                      </div>
                    )}

                    {/* Shopify API Version */}
                    {formData.platform === 'SHOPIFY' && (
                      <div>
                        <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                          Shopify API Version
                        </label>
                        <select
                          value={formData.apiVersion || '2026-01'}
                          onChange={(e) => setFormData({ ...formData, apiVersion: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-xs sm:text-sm text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] shadow-xs transition-all"
                        >
                          <option value="2026-01">2026-01 (Supported)</option>
                          <option value="2026-04">2026-04</option>
                          <option value="2026-07">2026-07</option>
                          <option value="2026-10">2026-10 (Latest)</option>
                          <option value="2024-01">2024-01 (Legacy)</option>
                          <option value="2024-04">2024-04 (Legacy)</option>
                          <option value="2023-10">2023-10 (Legacy)</option>
                        </select>
                      </div>
                    )}
                  </>
                )}

                {formData.platform === 'CUSTOM' && (
                  <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-200 text-[11px] text-orange-800 flex items-start gap-2">
                    <Info className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <span>
                      Need to push products directly from a custom backend or webhook instead of pull-sync? Visit the{' '}
                      <Link href="/integrations/developer" className="font-bold underline text-orange-900">
                        Developer Hub
                      </Link>{' '}
                      to use the Push Ingestion API.
                    </span>
                  </div>
                )}
              </div>

              {/* Modal Sticky Footer */}
              <div className="p-4 sm:p-6 border-t border-[#F2F4F7] bg-[#FCFCFD] flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#D0D5DD] text-[#344054] rounded-xl text-xs font-semibold hover:bg-white transition-all shadow-xs min-h-[44px] sm:min-h-9 cursor-pointer"
                >
                  Cancel
                </button>
                {formData.platform === 'SHOPIFY' && shopifyAuthMode === 'OAUTH' ? (
                  <button
                    type="submit"
                    disabled={isAuthorizingOAuth || !shopifyDomain.trim()}
                    className="px-5 py-2 bg-[#E85D2A] text-white rounded-xl text-xs font-bold hover:bg-[#d04e1f] transition-all shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer min-h-[44px] sm:min-h-9"
                  >
                    {isAuthorizingOAuth ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Redirecting to Shopify...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Authorize with Shopify
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="px-5 py-2 bg-[#E85D2A] text-white rounded-xl text-xs font-bold hover:bg-[#d04e1f] transition-all shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer min-h-[44px] sm:min-h-9"
                  >
                    {isConnecting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    {isConnecting ? 'Verifying & Connecting…' : 'Connect Store'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
