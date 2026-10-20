'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { ProtectedRoute } from '../../components/protected-route';
import { api, type StoreConnectionItem, type ConnectStorePayload } from '../../lib/api';
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
  Building2,
  Check,
} from 'lucide-react';

export default function IntegrationsPage() {
  return (
    <ProtectedRoute>
      <IntegrationsContent />
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

  // Connect form state
  const [formData, setFormData] = useState<ConnectStorePayload>({
    platform: 'SHOPIFY',
    storeName: '',
    storeUrl: '',
    apiKey: '',
    apiSecret: '',
    apiVersion: '2024-01',
  });

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

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;

    setIsConnecting(true);
    setError(null);
    try {
      await api.connectStore(currentWorkspace.id, {
        platform: formData.platform,
        storeName: formData.storeName,
        storeUrl: formData.storeUrl,
        apiKey: formData.apiKey,
        ...(formData.apiSecret ? { apiSecret: formData.apiSecret } : {}),
        ...(formData.apiVersion ? { apiVersion: formData.apiVersion } : {}),
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
    if (!confirm(`Are you sure you want to disconnect ${storeName}?`)) return;

    try {
      await api.disconnectStore(currentWorkspace.id, connectionId);
      setSuccessMessage(`Disconnected ${storeName}.`);
      await loadStores();
    } catch (err) {
      setError((err as Error).message || 'Failed to disconnect store.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#E4E7EC] gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-[#FFF9F5] border border-[#E85D2A]/20 flex items-center justify-center text-[#E85D2A]">
              <Store className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#17202A]">
              Ecommerce Store Integrations
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#16803C]/10 text-[#16803C]">
              Real-Time Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#667085] mt-1">
            Connect your Shopify or WooCommerce store to continuously synchronize catalogs, prices,
            and stock into grounded marketing content.
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#E85D2A] text-white rounded-xl text-xs font-bold hover:bg-[#d04e1f] shadow-xs transition-all shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Connect Store
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl border border-[#FECDCA] bg-[#FEF3F2] text-[#B42318] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-[#B42318] hover:opacity-75 p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] text-[#027A48] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-[#027A48] hover:opacity-75 p-1 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Store Connections List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#17202A] flex items-center gap-2">
            <span>Connected Stores</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F2F4F7] text-[#344054]">
              {stores.length}
            </span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-[#667085] bg-white border border-[#E4E7EC] rounded-2xl shadow-xs">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#E85D2A]" />
            <p className="text-xs">Loading store connections...</p>
          </div>
        ) : stores.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-[#E4E7EC] rounded-2xl bg-white shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[#FFF9F5] text-[#E85D2A] flex items-center justify-center mx-auto mb-3">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-[#17202A]">No ecommerce stores connected</h3>
            <p className="text-xs text-[#667085] max-w-md mx-auto mt-1 mb-5">
              Connect your Shopify or WooCommerce store to automatically import products into your
              marketing catalog.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#E85D2A] text-white rounded-xl text-xs font-bold hover:bg-[#d04e1f] transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Connect Your First Store
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {stores.map((store) => (
              <div
                key={store.id}
                className="p-6 rounded-2xl border border-[#E4E7EC] bg-white shadow-xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-[#FFF9F5] text-[#E85D2A] border border-[#E85D2A]/20">
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

                  <h3 className="text-base font-bold text-[#17202A] mt-3">{store.storeName}</h3>
                  <a
                    href={store.storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#667085] flex items-center gap-1 mt-1 hover:text-[#17202A] transition-colors"
                  >
                    {store.storeUrl} <ExternalLink className="h-3 w-3" />
                  </a>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#F2F4F7] text-xs">
                    <div>
                      <span className="text-[#667085] block text-[11px]">Synced Products</span>
                      <span className="font-bold text-[#17202A] text-sm">
                        {store.syncedProducts} items
                      </span>
                    </div>
                    <div>
                      <span className="text-[#667085] block text-[11px]">API Key Status</span>
                      <span className="font-mono text-[#344054] text-[11px]">
                        {store.apiKeyMasked}
                      </span>
                    </div>
                  </div>

                  {store.errorMessage && (
                    <div className="mt-3 p-2.5 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs">
                      {store.errorMessage}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-5 mt-5 border-t border-[#F2F4F7]">
                  <span className="text-[11px] text-[#667085]">
                    Last sync:{' '}
                    {store.lastSyncAt ? new Date(store.lastSyncAt).toLocaleString() : 'Never'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleSync(store.id)}
                      disabled={syncingId === store.id || store.syncStatus === 'SYNCING'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF9F5] hover:bg-[#FFF2EA] text-[#E85D2A] border border-[#E85D2A]/30 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${syncingId === store.id ? 'animate-spin' : ''}`}
                      />
                      {syncingId === store.id ? 'Syncing...' : 'Sync Catalog'}
                    </button>

                    <button
                      onClick={() => void handleDisconnect(store.id, store.storeName)}
                      className="p-1.5 text-[#98A2B3] hover:text-[#B42318] hover:bg-[#FEF3F2] rounded-lg transition-colors cursor-pointer"
                      title="Disconnect Store"
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
      <div className="mt-8 p-5 rounded-2xl border border-[#E4E7EC] bg-white flex flex-col md:flex-row items-start md:items-center gap-4 shadow-xs">
        <div className="h-10 w-10 rounded-xl bg-[#FFF9F5] border border-[#E85D2A]/20 text-[#E85D2A] flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-[#17202A] flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-[#16803C]" />
            Tenant-Isolated AES-256-GCM Credential Encryption
          </h4>
          <p className="text-[11px] text-[#667085] mt-0.5 leading-relaxed">
            All store access tokens are encrypted with authenticated AES-256-GCM cipher before
            being stored. API keys are never exposed to client responses or browser storage.
          </p>
        </div>
      </div>

      {/* ================= CONNECT STORE POPUP MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17202A]/60 p-4 backdrop-blur-sm">
          <div className="bg-white border border-[#E4E7EC] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-[#F2F4F7] flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF9F5] border border-[#E85D2A]/20 flex items-center justify-center text-[#E85D2A]">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#17202A]">Connect Ecommerce Store</h2>
                  <p className="text-xs text-[#667085] mt-0.5">
                    Authorize real-time product and inventory synchronization.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#98A2B3] hover:text-[#344054] p-1.5 rounded-lg hover:bg-[#F2F4F7] transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConnect}>
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Platform Selector */}
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Store Platform
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['SHOPIFY', 'WOOCOMMERCE'] as const).map((plt) => (
                      <button
                        type="button"
                        key={plt}
                        onClick={() => setFormData({ ...formData, platform: plt })}
                        className={`p-3 rounded-xl border text-xs font-bold text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          formData.platform === plt
                            ? 'border-2 border-[#E85D2A] bg-[#FFF9F5] text-[#E85D2A] shadow-xs'
                            : 'border border-[#E4E7EC] bg-[#F9FAFB] hover:bg-[#F2F4F7] text-[#475467]'
                        }`}
                      >
                        {formData.platform === plt && <Check className="w-3.5 h-3.5" />}
                        {plt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Store Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Store Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Flagship Store or TVS Motor Official"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-xs sm:text-sm text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] shadow-xs transition-all"
                  />
                </div>

                {/* Store URL */}
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Store URL
                  </label>
                  <input
                    type="url"
                    required
                    placeholder={
                      formData.platform === 'SHOPIFY'
                        ? 'https://your-store.myshopify.com'
                        : 'https://store.example.com'
                    }
                    value={formData.storeUrl}
                    onChange={(e) => setFormData({ ...formData, storeUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-xs sm:text-sm text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] shadow-xs transition-all font-mono"
                  />
                  <p className="text-[11px] text-[#667085] mt-1">
                    {formData.platform === 'SHOPIFY'
                      ? 'Must be your official .myshopify.com admin domain or custom domain.'
                      : 'The full URL where your WooCommerce WordPress instance is hosted.'}
                  </p>
                </div>

                {/* API Key / Token */}
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    {formData.platform === 'SHOPIFY'
                      ? 'Shopify Admin API Access Token'
                      : 'WooCommerce Consumer Key (ck_...)'}
                  </label>
                  <input
                    type="password"
                    required
                    placeholder={
                      formData.platform === 'SHOPIFY' ? 'shpat_xxxxxxxxxxxx' : 'ck_xxxxxxxxxxxx'
                    }
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-xs sm:text-sm text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] shadow-xs transition-all font-mono"
                  />
                </div>

                {/* WooCommerce Consumer Secret */}
                {formData.platform === 'WOOCOMMERCE' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                      WooCommerce Consumer Secret (cs_...)
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="cs_xxxxxxxxxxxx"
                      value={formData.apiSecret}
                      onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-xs sm:text-sm text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] shadow-xs transition-all font-mono"
                    />
                  </div>
                )}

                {/* Security Guarantee Banner */}
                <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E4E7EC] flex items-center gap-2.5 text-xs text-[#667085]">
                  <Lock className="w-4 h-4 text-[#16803C] shrink-0" />
                  <span>
                    Credentials are encrypted with AES-256-GCM authenticated cipher prior to
                    storage.
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#F2F4F7] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#D0D5DD] bg-white text-[#344054] rounded-xl text-xs font-semibold hover:bg-[#F2F4F7] shadow-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="px-4 py-2 bg-[#E85D2A] text-white rounded-xl text-xs font-bold hover:bg-[#d04e1f] shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isConnecting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {isConnecting ? 'Verifying & Connecting...' : 'Verify & Connect Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
