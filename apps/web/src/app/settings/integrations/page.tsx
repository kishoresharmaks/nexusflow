'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '../../../components/protected-route';
import { SettingsLayout } from '../../../components/settings-layout';
import { useAuth } from '../../../context/auth-context';
import {
  api,
  type SocialAccountItem,
  type StoreConnectionItem,
  type SocialProviderType,
} from '../../../lib/api';
import { formatDateTime } from '../../../lib/formatters';
import {
  Share2,
  ShoppingBag,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  Instagram,
  Linkedin,
  Facebook,
  Twitter,
  Clock,
  Key,
  Copy,
  Check,
  Code2,
} from 'lucide-react';

const providerLabels: Record<SocialProviderType, { name: string; icon: typeof Share2; color: string }> = {
  META_INSTAGRAM: { name: 'Instagram Business', icon: Instagram, color: '#E1306C' },
  META_FACEBOOK: { name: 'Facebook Page', icon: Facebook, color: '#1877F2' },
  LINKEDIN: { name: 'LinkedIn Company / Profile', icon: Linkedin, color: '#0A66C2' },
  TWITTER: { name: 'X / Twitter', icon: Twitter, color: '#0F1419' },
  TIKTOK: { name: 'TikTok', icon: Share2, color: '#000000' },
  PINTEREST: { name: 'Pinterest', icon: Share2, color: '#BD081C' },
  YOUTUBE: { name: 'YouTube', icon: Share2, color: '#FF0000' },
};

function IntegrationsContent() {
  const { currentWorkspace } = useAuth();
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountItem[]>([]);
  const [stores, setStores] = useState<StoreConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Developer credentials state
  const [devCreds, setDevCreds] = useState<{
    apiKeyMasked: string;
    webhookSecretMasked: string;
    pushEndpoint: string;
    webhookEndpoint: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [rotatingSecret, setRotatingSecret] = useState(false);
  const [newlyRotatedSecret, setNewlyRotatedSecret] = useState<string | null>(null);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const [socials, storeList] = await Promise.all([
        api.getSocialAccounts(currentWorkspace.id),
        api.getStoreConnections(currentWorkspace.id),
      ]);
      setSocialAccounts(socials);
      setStores(storeList);
      try {
        const creds = await api.getCustomStoreCredentials(currentWorkspace.id);
        setDevCreds(creds);
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load integrations.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCopy = (field: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRotateSecret = async () => {
    if (!currentWorkspace) return;
    setRotatingSecret(true);
    setError(null);
    try {
      const res = await api.rotateCustomStoreWebhookSecret(currentWorkspace.id);
      setNewlyRotatedSecret(res.webhookSecret);
      setShowRotateConfirm(false);
      setMessage(res.message);
      if (devCreds) {
        setDevCreds({ ...devCreds, webhookSecretMasked: `${res.webhookSecret.slice(0, 6)}••••${res.webhookSecret.slice(-4)}` });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate webhook secret.');
    } finally {
      setRotatingSecret(false);
    }
  };

  const handleDisconnectSocial = async (accountId: string, displayName: string) => {
    if (!currentWorkspace) return;
    if (!confirm(`Are you sure you want to disconnect ${displayName}? Scheduled posts will fail.`)) return;
    setActionLoading(accountId);
    setError(null);
    setMessage(null);
    try {
      await api.disconnectSocialAccount(currentWorkspace.id, accountId);
      setMessage(`Successfully disconnected ${displayName}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect social account.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnectStore = async (storeId: string, storeName: string) => {
    if (!currentWorkspace) return;
    if (!confirm(`Are you sure you want to disconnect ${storeName}? Product syncing will stop.`)) return;
    setActionLoading(storeId);
    setError(null);
    setMessage(null);
    try {
      await api.disconnectStore(currentWorkspace.id, storeId);
      setMessage(`Successfully disconnected ${storeName}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect store.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncStore = async (storeId: string, storeName: string) => {
    if (!currentWorkspace) return;
    setActionLoading(`sync-${storeId}`);
    setError(null);
    setMessage(null);
    try {
      await api.syncStore(currentWorkspace.id, storeId);
      setMessage(`Sync initiated for ${storeName}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger store sync.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <SettingsLayout
      title="Integrations & security"
      description="Manage connected social channels, ecommerce storefronts, OAuth credential security, and sync status."
      headerAction={
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading || !!actionLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      }
    >
      <div className="space-y-6">
        {message && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Security & Token Storage Card */}
        <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-[#17202A]">Secure Credential Protection</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#475467]">
                All channel connections and access permissions are securely encrypted and protected.
                Sensitive credentials are never exposed in browser views, storage, or shared logs,
                and scheduled publishing runs through protected background services.
              </p>
            </div>
          </div>
        </section>

        {/* Connected Social Accounts */}
        <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E7EC] p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-[#E85D2A]/10 p-2 text-[#E85D2A]">
                <Share2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold text-[#17202A]">Connected social channels</h2>
                <p className="text-xs text-[#667085]">
                  {socialAccounts.length} channel{socialAccounts.length === 1 ? '' : 's'} linked to this workspace
                </p>
              </div>
            </div>
            <Link
              href="/social-accounts"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
            >
              Connect new channel <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-[#667085]">Loading connected accounts…</p>
          ) : socialAccounts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-[#17202A]">No social channels connected</p>
              <p className="mt-1 text-xs text-[#667085]">
                Connect your official Instagram or LinkedIn business accounts to publish catalog campaigns.
              </p>
              <Link
                href="/social-accounts"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#E85D2A] px-4 py-2 text-xs font-bold text-white hover:bg-[#D04E1F]"
              >
                Connect account
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#EAECF0]">
              {socialAccounts.map((account) => {
                const conf = providerLabels[account.provider] || {
                  name: account.provider,
                  icon: Share2,
                  color: '#667085',
                };
                const IconComponent = conf.icon;
                const isExpired = account.status === 'EXPIRED';

                return (
                  <div key={account.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white font-bold"
                        style={{ backgroundColor: conf.color }}
                      >
                        <IconComponent className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[#17202A]">
                            {account.displayName}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              account.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : account.status === 'EXPIRED'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {account.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#667085] truncate">
                          {conf.name} · ID: {account.providerAccountId}
                        </p>
                        {account.tokenExpiresAt && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#667085]">
                            <Clock className="h-3 w-3" />
                            {isExpired ? 'Token expired: ' : 'Token expires: '}
                            {formatDateTime(
                              account.tokenExpiresAt,
                              currentWorkspace?.timezone,
                              currentWorkspace?.locale,
                              'date',
                            )}
                          </p>
                        )}
                        {account.scopes && account.scopes.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {account.scopes.map((scope) => (
                              <span
                                key={scope}
                                className="rounded bg-[#F2F4F7] px-1.5 py-0.5 text-[10px] text-[#344054] font-mono"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={actionLoading === account.id}
                        onClick={() => void handleDisconnectSocial(account.id, account.displayName)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#FDA29B] bg-white px-3 py-1.5 text-xs font-semibold text-[#B42318] hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {actionLoading === account.id ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Connected Ecommerce Stores */}
        <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E7EC] p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold text-[#17202A]">Connected storefronts</h2>
                <p className="text-xs text-[#667085]">
                  {stores.length} store connection{stores.length === 1 ? '' : 's'} powering catalog grounding
                </p>
              </div>
            </div>
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
            >
              Connect new store <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-[#667085]">Loading stores…</p>
          ) : stores.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-[#17202A]">No storefronts connected</p>
              <p className="mt-1 text-xs text-[#667085]">
                Link a Shopify or WooCommerce store to ingest product catalogs and ensure real-time price grounding.
              </p>
              <Link
                href="/integrations"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#E85D2A] px-4 py-2 text-xs font-bold text-white hover:bg-[#D04E1F]"
              >
                Connect storefront
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#EAECF0]">
              {stores.map((store) => (
                <div key={store.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[#17202A]">{store.storeName}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {store.platform}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          store.syncStatus === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700'
                            : store.syncStatus === 'SYNCING'
                            ? 'bg-blue-50 text-blue-700 animate-pulse'
                            : store.syncStatus === 'FAILED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {store.syncStatus}
                      </span>
                    </div>
                    <p className="text-xs text-[#667085] truncate mt-0.5">{store.storeUrl}</p>
                    {store.lastSyncAt && (
                      <p className="text-[11px] text-[#667085] mt-1">
                        Last synced:{' '}
                        {formatDateTime(
                          store.lastSyncAt,
                          currentWorkspace?.timezone,
                          currentWorkspace?.locale,
                          'medium',
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actionLoading === `sync-${store.id}`}
                      onClick={() => void handleSyncStore(store.id, store.storeName)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${
                          actionLoading === `sync-${store.id}` ? 'animate-spin' : ''
                        }`}
                      />
                      {actionLoading === `sync-${store.id}` ? 'Syncing…' : 'Trigger sync'}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === store.id}
                      onClick={() => void handleDisconnectStore(store.id, store.storeName)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#FDA29B] bg-white px-3 py-1.5 text-xs font-semibold text-[#B42318] hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>


        {/* Developer Push API & Order Webhook Keys */}
        <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <Key className="w-5 h-5" />
              </span>
              <div>
                <h2 className="font-bold text-[#17202A] text-base">Custom Store REST Push API & Webhook Signing Secret</h2>
                <p className="mt-0.5 text-xs text-[#667085]">
                  Credentials for custom headless storefronts, ERPs, and automated order conversion webhooks.
                </p>
              </div>
            </div>
            <Link
              href="/developers"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all self-start sm:self-auto shadow-2xs"
            >
              <Code2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Open Developer Hub & Docs</span>
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {/* Push Endpoint */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700">Catalog Push Ingestion Endpoint</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  POST JSON
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={devCreds?.pushEndpoint || `https://api.nexusflow.app/api/v1/workspaces/${currentWorkspace?.id}/integrations/custom/products`}
                  className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopy('pushEndpoint', devCreds?.pushEndpoint || '')}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1 shrink-0"
                  title="Copy Endpoint"
                >
                  {copiedField === 'pushEndpoint' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'pushEndpoint' ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Order Webhook Endpoint */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700">Order Webhook Ingestion Endpoint (Attribution & Conversions)</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  POST JSON + HMAC
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={devCreds?.webhookEndpoint || `https://api.nexusflow.app/api/v1/workspaces/${currentWorkspace?.id}/integrations/custom/orders`}
                  className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopy('webhookEndpoint', devCreds?.webhookEndpoint || '')}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1 shrink-0"
                  title="Copy Endpoint"
                >
                  {copiedField === 'webhookEndpoint' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'webhookEndpoint' ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Webhook HMAC Signing Secret */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-800">Webhook HMAC Signing Secret</span>
                  <p className="text-[11px] text-slate-500">
                    Sign raw payload bodies using HMAC-SHA256 and transmit via <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">x-nexusflow-hmac</code> header.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRotateConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-all self-start sm:self-auto cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Rotate Webhook Secret</span>
                </button>
              </div>

              {newlyRotatedSecret ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      New Secret Generated — Copy Immediately
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('newSecret', newlyRotatedSecret)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                    >
                      {copiedField === 'newSecret' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'newSecret' ? 'Copied!' : 'Copy Secret'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={newlyRotatedSecret}
                    className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-900 select-all"
                  />
                  <p className="text-[10px] text-emerald-700">For security, this unmasked value will only be displayed once.</p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={devCreds?.webhookSecretMasked || 'whsec_••••••••••••••••'}
                    className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-500 select-all"
                  />
                  <span className="text-[11px] font-semibold text-slate-500 px-2 py-1 bg-slate-100 rounded-lg shrink-0">
                    Encrypted at rest
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Rotate Webhook Secret Confirmation Modal */}
        {showRotateConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-amber-200 overflow-hidden">
              <div className="p-6 bg-amber-50/70 border-b border-amber-100 flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-amber-950 font-display">Rotate Webhook Signing Secret?</h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Rotating this secret will immediately invalidate the current signing secret. Any external webhooks signed with the old secret will be rejected with HTTP 401 Unauthorized.
                  </p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={rotatingSecret}
                  onClick={() => setShowRotateConfirm(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={rotatingSecret}
                  onClick={() => void handleRotateSecret()}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${rotatingSecret ? 'animate-spin' : ''}`} />
                  <span>{rotatingSecret ? 'Rotating…' : 'Rotate Secret Now'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Platform Compliance Status Matrix */}
        <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <h2 className="font-bold text-[#17202A]">Provider API & Compliance Registry</h2>
          <p className="mt-1 text-xs text-[#667085]">
            Strict Truth-in-Engineering status of official third-party social media integrations.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#17202A]">Meta Instagram</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Live & Verified
                </span>
              </div>
              <p className="mt-2 text-xs text-[#475467]">
                Meta Graph API v20.0 compliant OAuth 2.0. Supports single image, carousel, and video publishing with container polling.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#17202A]">LinkedIn</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Live & Verified
                </span>
              </div>
              <p className="mt-2 text-xs text-[#475467]">
                Official LinkedIn Community Management & REST API v2. Supports text, image, and multi-image posts for organization pages and member profiles.
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-4 opacity-75">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#667085]">TikTok Content Posting</span>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                  Pending App Review
                </span>
              </div>
              <p className="mt-2 text-xs text-[#667085]">
                Direct Share API implementation in progress. Awaiting production app audit verification from ByteDance.
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-4 opacity-75">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#667085]">Pinterest</span>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                  Pending Credentials
                </span>
              </div>
              <p className="mt-2 text-xs text-[#667085]">
                Pinterest Pins API v5 adapter ready. Pending enterprise client credentials configuration.
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-4 opacity-75">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#667085]">YouTube Shorts</span>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                  Planned
                </span>
              </div>
              <p className="mt-2 text-xs text-[#667085]">
                YouTube Data API v3 video upload quota tier verification scheduled for next phase.
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-4 opacity-75">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#667085]">X / Twitter</span>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                  Tier Pending
                </span>
              </div>
              <p className="mt-2 text-xs text-[#667085]">
                X API v2 media upload and tweet creation requires upgraded platform tier subscription.
              </p>
            </div>
          </div>
        </section>
      </div>
    </SettingsLayout>
  );
}

export default function IntegrationsSettingsPage() {
  return (
    <ProtectedRoute fallbackTitle="Sign in to view integrations">
      <IntegrationsContent />
    </ProtectedRoute>
  );
}
