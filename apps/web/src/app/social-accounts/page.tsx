'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { api, type SocialAccountItem, type SocialProviderType } from '../../lib/api';
import { ProtectedRoute } from '../../components/protected-route';
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Trash2,
  Lock,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Sparkles,
  Tag,
  X,
  ExternalLink,
  Send,
  ShieldCheck,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Provider config — LinkedIn uses server-side OAuth redirect, all others
// use the manual token entry modal as a placeholder until OAuth is wired.
// ---------------------------------------------------------------------------

interface ProviderConfig {
  provider: SocialProviderType;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  defaultScopes: string[];
  /** When true, clicking Connect redirects to the backend OAuth endpoint */
  useServerOAuth: boolean;
}

const SUPPORTED_PROVIDERS: ProviderConfig[] = [
  {
    provider: 'META_INSTAGRAM',
    name: 'Instagram Business',
    icon: Instagram,
    color: '#E1306C',
    description:
      'Publish photos, carousels, and reels with official Meta Graph API compliance. Uses secure server-side OAuth 2.0 — no manual token entry required.',
    defaultScopes: [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
    ],
    useServerOAuth: true,
  },
  {
    provider: 'META_FACEBOOK',
    name: 'Facebook Pages',
    icon: Facebook,
    color: '#1877F2',
    description: 'Publish updates, product links, and multimedia to brand pages.',
    defaultScopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    useServerOAuth: false,
  },
  {
    provider: 'LINKEDIN',
    name: 'LinkedIn Profile',
    icon: Linkedin,
    color: '#0A66C2',
    description:
      'Share thought leadership, company milestones, and catalog announcements. Uses secure server-side OAuth 2.0 — no manual token entry required.',
    defaultScopes: ['openid', 'profile', 'w_member_social'],
    useServerOAuth: true,
  },
  {
    provider: 'TWITTER',
    name: 'X (Twitter)',
    icon: Twitter,
    color: '#17202A',
    description: 'Post real-time commerce alerts, promotions, and 280-char announcements.',
    defaultScopes: ['tweet.read', 'tweet.write', 'users.read'],
    useServerOAuth: false,
  },
  {
    provider: 'TIKTOK',
    name: 'TikTok Business',
    icon: Sparkles,
    color: '#000000',
    description: 'Direct post API integrations for video and photo carousel marketing.',
    defaultScopes: ['video.publish'],
    useServerOAuth: false,
  },
  {
    provider: 'PINTEREST',
    name: 'Pinterest Business',
    icon: Tag,
    color: '#BD081C',
    description: 'Drive high-intent buyer discovery with shoppable product pins.',
    defaultScopes: ['boards:read', 'pins:write'],
    useServerOAuth: false,
  },
];

// ---------------------------------------------------------------------------
// LinkedIn & Instagram connection status fetched separately from main accounts
// ---------------------------------------------------------------------------
interface LinkedInStatus {
  connected: boolean;
  account: {
    id: string;
    displayName: string;
    username: string | null;
    providerAccountId: string;
    scopes: string[];
    status: string;
    tokenExpiresAt: string | null;
    createdAt: string;
  } | null;
  canPublish: boolean;
}

interface InstagramStatus {
  connected: boolean;
  account: {
    id: string;
    displayName: string;
    username: string | null;
    providerAccountId: string;
    scopes: string[];
    status: string;
    tokenExpiresAt: string | null;
    createdAt: string;
  } | null;
  canPublish: boolean;
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function SocialAccountsPage() {
  return (
    <ProtectedRoute
      fallbackTitle="Social Accounts Access"
      fallbackDescription="Sign in to your workspace to connect social channels and configure publishing credentials."
    >
      <SocialAccountsContent />
    </ProtectedRoute>
  );
}

function SocialAccountsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentWorkspace, token } = useAuth();

  const [accounts, setAccounts] = useState<SocialAccountItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // LinkedIn-specific state
  const [linkedInStatus, setLinkedInStatus] = useState<LinkedInStatus | null>(null);
  const [isLoadingLinkedIn, setIsLoadingLinkedIn] = useState<boolean>(false);
  const [isDisconnectingLinkedIn, setIsDisconnectingLinkedIn] = useState<boolean>(false);
  const [isRefreshingLinkedIn, setIsRefreshingLinkedIn] = useState<boolean>(false);
  const [isPublishingLinkedIn, setIsPublishingLinkedIn] = useState<boolean>(false);
  const [linkedInPostContent, setLinkedInPostContent] = useState<string>('');
  const [showLinkedInPublisher, setShowLinkedInPublisher] = useState<boolean>(false);

  // Instagram-specific state
  const [instagramStatus, setInstagramStatus] = useState<InstagramStatus | null>(null);
  const [isLoadingInstagram, setIsLoadingInstagram] = useState<boolean>(false);
  const [isDisconnectingInstagram, setIsDisconnectingInstagram] = useState<boolean>(false);
  const [isRefreshingInstagram, setIsRefreshingInstagram] = useState<boolean>(false);
  const [isPublishingInstagram, setIsPublishingInstagram] = useState<boolean>(false);
  const [instagramPostContent, setInstagramPostContent] = useState<string>('');
  const [instagramMediaUrl, setInstagramMediaUrl] = useState<string>('');
  const [showInstagramPublisher, setShowInstagramPublisher] = useState<boolean>(false);

  // Manual-token modal state (for non-OAuth providers)
  const [connectingProvider, setConnectingProvider] = useState<SocialProviderType | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Track whether we've already processed the callback query params on mount
  const callbackProcessed = useRef<boolean>(false);
  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load non-LinkedIn accounts
  // ---------------------------------------------------------------------------
  const loadAccounts = useCallback(async () => {
    if (!currentWorkspace?.id || !token) return;
    if (isMounted.current) setIsLoading(true);
    try {
      const list = await api.getSocialAccounts(currentWorkspace.id);
      if (isMounted.current) setAccounts(list);
    } catch (err: unknown) {
      if (isMounted.current) {
        setStatusMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to load social accounts.',
        });
      }
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [currentWorkspace?.id, token]);

  // ---------------------------------------------------------------------------
  // Load LinkedIn status from dedicated endpoint (doesn't expose tokens)
  // ---------------------------------------------------------------------------
  const loadLinkedInStatus = useCallback(async () => {
    if (!currentWorkspace?.id || !token) return;
    if (isMounted.current) setIsLoadingLinkedIn(true);
    try {
      const status = await api.getLinkedInStatus(currentWorkspace.id);
      if (isMounted.current) setLinkedInStatus(status);
    } catch {
      // Non-critical — if it fails just show not connected
      if (isMounted.current) setLinkedInStatus({ connected: false, account: null, canPublish: false });
    } finally {
      if (isMounted.current) setIsLoadingLinkedIn(false);
    }
  }, [currentWorkspace?.id, token]);

  // ---------------------------------------------------------------------------
  // Load Instagram status from dedicated endpoint (doesn't expose tokens)
  // ---------------------------------------------------------------------------
  const loadInstagramStatus = useCallback(async () => {
    if (!currentWorkspace?.id || !token) return;
    if (isMounted.current) setIsLoadingInstagram(true);
    try {
      const status = await api.getInstagramStatus(currentWorkspace.id);
      if (isMounted.current) setInstagramStatus(status);
    } catch {
      // Non-critical — if it fails just show not connected
      if (isMounted.current) setInstagramStatus({ connected: false, account: null, canPublish: false });
    } finally {
      if (isMounted.current) setIsLoadingInstagram(false);
    }
  }, [currentWorkspace?.id, token]);

  // ---------------------------------------------------------------------------
  // Handle OAuth callback query params on mount (after LinkedIn/Instagram redirect)
  // Runs once: reads ?linkedin=... or ?instagram=... from the URL, shows the
  // appropriate banner, removes the params, and refreshes data.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (callbackProcessed.current) return;
    if (!searchParams) return;

    const linkedinParam = searchParams.get('linkedin');
    const instagramParam = searchParams.get('instagram');
    if (!linkedinParam && !instagramParam) return;

    callbackProcessed.current = true;

    const memberName = searchParams.get('name');
    const errorParam = searchParams.get('error');

    if (linkedinParam === 'connected') {
      setStatusMessage({
        type: 'success',
        text: memberName
          ? `LinkedIn connected successfully! Signed in as ${decodeURIComponent(memberName)}. Token encrypted with AES-256-GCM.`
          : 'LinkedIn connected successfully! Token encrypted with AES-256-GCM.',
      });
    } else if (linkedinParam === 'denied') {
      setStatusMessage({
        type: 'info',
        text: 'LinkedIn authorization was cancelled. You can try again any time.',
      });
    } else if (linkedinParam === 'failed') {
      setStatusMessage({
        type: 'error',
        text: errorParam
          ? `LinkedIn connection failed: ${decodeURIComponent(errorParam)}`
          : 'LinkedIn connection failed. Please try again.',
      });
    } else if (instagramParam === 'connected') {
      setStatusMessage({
        type: 'success',
        text: memberName
          ? `Instagram connected successfully! Linked to ${decodeURIComponent(memberName)}. Token encrypted with AES-256-GCM.`
          : 'Instagram connected successfully! Token encrypted with AES-256-GCM.',
      });
    } else if (instagramParam === 'denied') {
      setStatusMessage({
        type: 'info',
        text: 'Instagram authorization was cancelled. You can try again any time.',
      });
    } else if (instagramParam === 'failed') {
      setStatusMessage({
        type: 'error',
        text: errorParam
          ? `Instagram connection failed: ${decodeURIComponent(errorParam)}`
          : 'Instagram connection failed. Please try again.',
      });
    }

    // Clean up URL params without triggering a navigation
    const cleanUrl = window.location.pathname;
    router.replace(cleanUrl);
  }, [searchParams, router]);

  useEffect(() => {
    void loadAccounts();
    void loadLinkedInStatus();
    void loadInstagramStatus();
  }, [loadAccounts, loadLinkedInStatus, loadInstagramStatus]);

  // ---------------------------------------------------------------------------
  // LinkedIn: Start OAuth redirect
  // ---------------------------------------------------------------------------
  const handleLinkedInConnect = () => {
    if (!currentWorkspace?.id || !token) {
      setStatusMessage({ type: 'error', text: 'Please sign in to connect LinkedIn.' });
      return;
    }
    // Full page navigation to backend OAuth init endpoint
    window.location.assign(api.getLinkedInConnectUrl(currentWorkspace.id, token));
  };

  // ---------------------------------------------------------------------------
  // LinkedIn: Disconnect
  // ---------------------------------------------------------------------------
  const handleLinkedInDisconnect = async () => {
    if (!currentWorkspace?.id) return;
    if (
      !confirm(
        'Disconnect LinkedIn? Any posts scheduled for this account will fail. You can reconnect at any time.',
      )
    )
      return;

    setIsDisconnectingLinkedIn(true);
    setStatusMessage(null);
    try {
      await api.disconnectLinkedIn(currentWorkspace.id, linkedInStatus?.account?.id);
      setStatusMessage({ type: 'success', text: 'LinkedIn account disconnected successfully.' });
      setShowLinkedInPublisher(false);
      setLinkedInPostContent('');
      await loadLinkedInStatus();
      await loadAccounts();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to disconnect LinkedIn.',
      });
    } finally {
      setIsDisconnectingLinkedIn(false);
    }
  };

  // ---------------------------------------------------------------------------
  // LinkedIn: Refresh access token
  // ---------------------------------------------------------------------------
  const handleLinkedInRefresh = async () => {
    if (!currentWorkspace?.id || !linkedInStatus?.account?.id) return;

    setIsRefreshingLinkedIn(true);
    setStatusMessage(null);
    try {
      const res = await api.refreshLinkedInToken(currentWorkspace.id, linkedInStatus.account.id);
      setStatusMessage({
        type: 'success',
        text: res.message || 'LinkedIn access token refreshed successfully.',
      });
      await loadLinkedInStatus();
      await loadAccounts();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to refresh LinkedIn token.',
      });
    } finally {
      setIsRefreshingLinkedIn(false);
    }
  };

  // ---------------------------------------------------------------------------
  // LinkedIn: Publish post
  // ---------------------------------------------------------------------------
  const handleLinkedInPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace?.id || !linkedInPostContent.trim()) return;

    setIsPublishingLinkedIn(true);
    setStatusMessage(null);
    try {
      const result = await api.publishLinkedInPost(currentWorkspace.id, linkedInPostContent.trim());
      setStatusMessage({
        type: 'success',
        text: `Post published to LinkedIn! Provider Post ID: ${result.providerPostId}`,
      });
      setLinkedInPostContent('');
      setShowLinkedInPublisher(false);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to publish post to LinkedIn.',
      });
    } finally {
      setIsPublishingLinkedIn(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Instagram: Start OAuth redirect
  // ---------------------------------------------------------------------------
  const handleInstagramConnect = () => {
    if (!currentWorkspace?.id || !token) {
      setStatusMessage({ type: 'error', text: 'Please sign in to connect Instagram.' });
      return;
    }
    window.location.assign(api.getInstagramConnectUrl(currentWorkspace.id, token));
  };

  // ---------------------------------------------------------------------------
  // Instagram: Disconnect
  // ---------------------------------------------------------------------------
  const handleInstagramDisconnect = async () => {
    if (!currentWorkspace?.id) return;
    if (
      !confirm(
        'Disconnect Instagram? Any scheduled feed posts will fail. You can reconnect at any time.',
      )
    )
      return;

    setIsDisconnectingInstagram(true);
    setStatusMessage(null);
    try {
      await api.disconnectInstagram(currentWorkspace.id, instagramStatus?.account?.id);
      setStatusMessage({ type: 'success', text: 'Instagram account disconnected successfully.' });
      setShowInstagramPublisher(false);
      setInstagramPostContent('');
      setInstagramMediaUrl('');
      await loadInstagramStatus();
      await loadAccounts();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to disconnect Instagram.',
      });
    } finally {
      setIsDisconnectingInstagram(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Instagram: Refresh access token
  // ---------------------------------------------------------------------------
  const handleInstagramRefresh = async () => {
    if (!currentWorkspace?.id || !instagramStatus?.account?.id) return;

    setIsRefreshingInstagram(true);
    setStatusMessage(null);
    try {
      const res = await api.refreshInstagramToken(currentWorkspace.id, instagramStatus.account.id);
      setStatusMessage({
        type: 'success',
        text: res.message || 'Instagram access token refreshed successfully.',
      });
      await loadInstagramStatus();
      await loadAccounts();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to refresh Instagram token.',
      });
    } finally {
      setIsRefreshingInstagram(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Instagram: Publish post
  // ---------------------------------------------------------------------------
  const handleInstagramPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace?.id || !instagramPostContent.trim()) return;
    if (!instagramMediaUrl.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Instagram requires a valid image URL to publish a feed post.',
      });
      return;
    }

    setIsPublishingInstagram(true);
    setStatusMessage(null);
    try {
      const result = await api.publishInstagramPost(
        currentWorkspace.id,
        instagramPostContent.trim(),
        [instagramMediaUrl.trim()],
      );
      setStatusMessage({
        type: 'success',
        text: `Post published to Instagram! Media ID: ${result.providerPostId}`,
      });
      setInstagramPostContent('');
      setInstagramMediaUrl('');
      setShowInstagramPublisher(false);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to publish post to Instagram.',
      });
    } finally {
      setIsPublishingInstagram(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Manual token modal handlers (for non-OAuth providers)
  // ---------------------------------------------------------------------------
  const handleOpenConnect = (provider: SocialProviderType) => {
    const provConfig = SUPPORTED_PROVIDERS.find((p) => p.provider === provider);
    setConnectingProvider(provider);
    setDisplayName(`${currentWorkspace?.name || 'Brand'} ${provConfig?.name || ''}`);
    setAccountId('');
    setAccessToken('');
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace?.id || !connectingProvider) return;

    setIsConnecting(true);
    setStatusMessage(null);
    try {
      const provConfig = SUPPORTED_PROVIDERS.find((p) => p.provider === connectingProvider);
      await api.connectSocialAccount(currentWorkspace.id, {
        provider: connectingProvider,
        providerAccountId: accountId.trim(),
        displayName: displayName.trim(),
        accessToken: accessToken.trim(),
        scopes: provConfig?.defaultScopes ?? [],
      });

      setStatusMessage({
        type: 'success',
        text: `Successfully connected ${provConfig?.name}! Tokens encrypted with AES-256-GCM.`,
      });
      setConnectingProvider(null);
      await loadAccounts();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to connect account.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (accId: string, accName: string) => {
    if (!currentWorkspace?.id) return;
    if (
      !confirm(
        `Are you sure you want to disconnect ${accName}? Scheduled posts for this account will fail.`,
      )
    ) {
      return;
    }

    try {
      await api.disconnectSocialAccount(currentWorkspace.id, accId);
      setStatusMessage({ type: 'success', text: `Disconnected ${accName} successfully.` });
      await loadAccounts();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to disconnect account.',
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const statusBannerClasses = {
    success: 'bg-[#16803C]/10 border-[#16803C]/20 text-[#16803C]',
    error: 'bg-[#B42318]/10 border-[#B42318]/20 text-[#B42318]',
    info: 'bg-[#0A66C2]/10 border-[#0A66C2]/20 text-[#0A66C2]',
  };

  const charCount = linkedInPostContent.length;
  const charLimit = 3000;
  const charRemaining = charLimit - charCount;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-[#E4E7EC] mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#17202A]">Social Accounts</h1>
          <p className="text-xs text-[#667085] mt-1">
            Connect and manage verified social publishing profiles with encrypted token storage.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadAccounts();
            void loadLinkedInStatus();
            void loadInstagramStatus();
          }}
          disabled={isLoading}
          className="p-2 border border-[#D0D5DD] rounded-lg text-[#667085] hover:text-[#17202A] hover:bg-[#F2F4F7] transition-all self-start sm:self-auto mt-4 sm:mt-0"
          title="Refresh Accounts"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-xl text-xs flex items-center justify-between border ${statusBannerClasses[statusMessage.type]}`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : statusMessage.type === 'info' ? (
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 ml-4 flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Security Callout */}
      <div className="mb-8 p-4 bg-[#F8F9FC] border border-[#D5D9EB] rounded-xl flex items-start space-x-3 text-xs text-[#344054]">
        <Lock className="w-4 h-4 text-[#0A66C2] flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-[#17202A]">Bank-Grade Token Encryption at Rest</p>
          <p className="mt-0.5 text-[#667085]">
            All OAuth tokens and API secrets are protected with authenticated AES-256-GCM
            encryption. Decrypted tokens are never exposed in browser payloads or application logs.
          </p>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SUPPORTED_PROVIDERS.map((prov) => {
          const Icon = prov.icon;

          // LinkedIn and Instagram use their own status fetches; all others use the accounts list
          const isLinkedIn = prov.provider === 'LINKEDIN';
          const isInstagram = prov.provider === 'META_INSTAGRAM';
          const connectedAccount =
            isLinkedIn || isInstagram
              ? null
              : accounts.find((a) => a.provider === prov.provider && a.status === 'ACTIVE');

          if (isLinkedIn) {
            // ---------------------------------------------------------------
            // LinkedIn card — server-side OAuth flow
            // ---------------------------------------------------------------
            const li = linkedInStatus;
            const isActive = li?.connected && li.account?.status === 'ACTIVE';
            const canPublish = li?.canPublish ?? false;
            const isExpired =
              li?.account?.tokenExpiresAt && new Date(li.account.tokenExpiresAt) < new Date();

            return (
              <div
                key="LINKEDIN"
                className="bg-white border border-[#0A66C2]/20 rounded-xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden"
              >
                {/* LinkedIn blue top bar accent */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#0A66C2]" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: '#0A66C2' }}
                      >
                        <Linkedin className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#17202A]">{prov.name}</h3>
                        <span className="text-[10px] text-[#667085] uppercase tracking-wider font-semibold">
                          Server-side OAuth 2.0
                        </span>
                      </div>
                    </div>

                    {isLoadingLinkedIn ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F2F4F7] text-[#667085]">
                        <RefreshCw className="w-2.5 h-2.5 mr-1 animate-spin" /> Loading…
                      </span>
                    ) : isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F2F4F7] text-[#667085]">
                        Not Connected
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#667085] leading-relaxed">{prov.description}</p>

                  {/* Connected — show account info */}
                  {isActive && li?.account && (
                    <div className="p-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#0A66C2] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                          {li.account.displayName.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-semibold text-[#17202A] truncate">
                          {li.account.displayName}
                        </p>
                      </div>
                      <p className="text-[10px] text-[#667085] pl-8">
                        Connected {new Date(li.account.createdAt).toLocaleDateString()}
                        {li.account.scopes.includes('w_member_social') && (
                          <span className="ml-2 inline-flex items-center text-[#0A66C2] font-medium">
                            <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Can Publish
                          </span>
                        )}
                      </p>
                      {isExpired && (
                        <p className="text-[10px] text-[#B45309] flex items-center gap-1 pl-8">
                          <Clock className="w-2.5 h-2.5" /> Token expired — reconnect to resume publishing.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 mt-4 border-t border-[#F2F4F7] flex flex-wrap items-center gap-2">
                  {isActive ? (
                    <>
                      {/* Publish button */}
                      {canPublish && (
                        <button
                          type="button"
                          onClick={() => setShowLinkedInPublisher((s) => !s)}
                          className="inline-flex items-center px-3 py-1.5 bg-[#0A66C2] text-white text-xs font-semibold rounded-lg hover:bg-[#004182] transition-all"
                        >
                          <Send className="w-3.5 h-3.5 mr-1" />
                          {showLinkedInPublisher ? 'Close Publisher' : 'Publish Post'}
                        </button>
                      )}
                      {/* Reconnect (expired) */}
                      {isExpired && (
                        <button
                          type="button"
                          onClick={handleLinkedInConnect}
                          className="inline-flex items-center px-3 py-1.5 bg-[#17202A] text-white text-xs font-semibold rounded-lg hover:bg-black transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" /> Reconnect
                        </button>
                      )}
                      {/* Refresh Token */}
                      <button
                        type="button"
                        onClick={() => void handleLinkedInRefresh()}
                        disabled={isRefreshingLinkedIn}
                        className="inline-flex items-center px-2.5 py-1.5 border border-[#D0D5DD] bg-white text-[#344054] text-xs font-semibold rounded-lg hover:bg-[#F9FAFB] transition-all disabled:opacity-50"
                        title="Exchange stored refresh token for a new access token"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 mr-1 ${isRefreshingLinkedIn ? 'animate-spin' : ''}`}
                        />
                        {isRefreshingLinkedIn ? 'Refreshing…' : 'Refresh Token'}
                      </button>
                      {/* Disconnect */}
                      <button
                        type="button"
                        onClick={() => void handleLinkedInDisconnect()}
                        disabled={isDisconnectingLinkedIn}
                        className="inline-flex items-center text-xs font-semibold text-[#B42318] hover:underline disabled:opacity-50 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        {isDisconnectingLinkedIn ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLinkedInConnect}
                      className="inline-flex items-center px-3 py-1.5 bg-[#0A66C2] text-white text-xs font-semibold rounded-lg hover:bg-[#004182] transition-all ml-auto"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Connect LinkedIn
                    </button>
                  )}
                </div>

                {/* LinkedIn Inline Publisher */}
                {isActive && canPublish && showLinkedInPublisher && (
                  <div className="mt-4 border-t border-[#BFDBFE] pt-4">
                    <form onSubmit={(e) => void handleLinkedInPublish(e)}>
                      <label className="block text-xs font-semibold text-[#344054] mb-2">
                        Post to LinkedIn Profile
                      </label>
                      <textarea
                        value={linkedInPostContent}
                        onChange={(e) => setLinkedInPostContent(e.target.value)}
                        placeholder="What do you want to share with your LinkedIn network?"
                        rows={4}
                        maxLength={charLimit}
                        required
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] transition-all resize-none"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span
                          className={`text-[10px] font-medium ${
                            charRemaining < 100
                              ? 'text-[#B45309]'
                              : charRemaining < 0
                                ? 'text-[#B42318]'
                                : 'text-[#667085]'
                          }`}
                        >
                          {charRemaining} characters remaining
                        </span>
                        <button
                          type="submit"
                          disabled={
                            isPublishingLinkedIn ||
                            !linkedInPostContent.trim() ||
                            charCount > charLimit
                          }
                          className="inline-flex items-center px-4 py-1.5 bg-[#0A66C2] text-white text-xs font-bold rounded-lg hover:bg-[#004182] transition-all disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          {isPublishingLinkedIn ? 'Publishing…' : 'Publish Now'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          }

          if (isInstagram) {
            // ---------------------------------------------------------------
            // Instagram Business card — server-side OAuth flow
            // ---------------------------------------------------------------
            const ig = instagramStatus;
            const isActive = ig?.connected && ig.account?.status === 'ACTIVE';
            const canPublish = ig?.canPublish ?? false;
            const isExpired =
              ig?.account?.tokenExpiresAt && new Date(ig.account.tokenExpiresAt) < new Date();
            const charLimit = 2200;
            const charCount = instagramPostContent.length;
            const charRemaining = charLimit - charCount;

            return (
              <div
                key="META_INSTAGRAM"
                className="bg-white border border-[#E1306C]/20 rounded-xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden"
              >
                {/* Instagram gradient top bar accent */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737]" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                        style={{
                          background:
                            'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                        }}
                      >
                        <Instagram className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#17202A]">{prov.name}</h3>
                        <span className="text-[10px] text-[#667085] uppercase tracking-wider font-semibold">
                          Server-side OAuth 2.0
                        </span>
                      </div>
                    </div>

                    {isLoadingInstagram ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F2F4F7] text-[#667085]">
                        <RefreshCw className="w-2.5 h-2.5 mr-1 animate-spin" /> Loading…
                      </span>
                    ) : isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F2F4F7] text-[#667085]">
                        Not Connected
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#667085] leading-relaxed">{prov.description}</p>

                  {/* Connected — show account info */}
                  {isActive && ig?.account && (
                    <div className="p-2.5 bg-[#FDF2F8] border border-[#FBCFE8] rounded-lg text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                          style={{
                            background:
                              'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                          }}
                        >
                          {ig.account.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#17202A] truncate">
                            {ig.account.displayName}
                          </p>
                          {ig.account.username && (
                            <p className="text-[10px] text-[#E1306C] truncate font-medium">
                              @{ig.account.username}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-[#667085] pl-8">
                        Connected {new Date(ig.account.createdAt).toLocaleDateString()}
                        {ig.account.scopes.includes('instagram_content_publish') && (
                          <span className="ml-2 inline-flex items-center text-[#E1306C] font-medium">
                            <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Can Publish
                          </span>
                        )}
                      </p>
                      {isExpired && (
                        <p className="text-[10px] text-[#B45309] flex items-center gap-1 pl-8">
                          <Clock className="w-2.5 h-2.5" /> Token expired — reconnect to resume publishing.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 mt-4 border-t border-[#F2F4F7] flex flex-wrap items-center gap-2">
                  {isActive ? (
                    <>
                      {/* Publish button */}
                      {canPublish && (
                        <button
                          type="button"
                          onClick={() => setShowInstagramPublisher((s) => !s)}
                          className="inline-flex items-center px-3 py-1.5 bg-[#E1306C] text-white text-xs font-semibold rounded-lg hover:bg-[#C13584] transition-all"
                        >
                          <Send className="w-3.5 h-3.5 mr-1" />
                          {showInstagramPublisher ? 'Close Publisher' : 'Publish Post'}
                        </button>
                      )}
                      {/* Reconnect (expired) */}
                      {isExpired && (
                        <button
                          type="button"
                          onClick={handleInstagramConnect}
                          className="inline-flex items-center px-3 py-1.5 bg-[#17202A] text-white text-xs font-semibold rounded-lg hover:bg-black transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" /> Reconnect
                        </button>
                      )}
                      {/* Refresh Token */}
                      <button
                        type="button"
                        onClick={() => void handleInstagramRefresh()}
                        disabled={isRefreshingInstagram}
                        className="inline-flex items-center px-2.5 py-1.5 border border-[#D0D5DD] bg-white text-[#344054] text-xs font-semibold rounded-lg hover:bg-[#F9FAFB] transition-all disabled:opacity-50"
                        title="Extend 60-day Meta access token"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 mr-1 ${isRefreshingInstagram ? 'animate-spin' : ''}`}
                        />
                        {isRefreshingInstagram ? 'Refreshing…' : 'Refresh Token'}
                      </button>
                      {/* Disconnect */}
                      <button
                        type="button"
                        onClick={() => void handleInstagramDisconnect()}
                        disabled={isDisconnectingInstagram}
                        className="inline-flex items-center text-xs font-semibold text-[#B42318] hover:underline disabled:opacity-50 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        {isDisconnectingInstagram ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleInstagramConnect}
                      className="inline-flex items-center px-3 py-1.5 bg-[#E1306C] text-white text-xs font-semibold rounded-lg hover:bg-[#C13584] transition-all ml-auto"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Connect Instagram
                    </button>
                  )}
                </div>

                {/* Instagram Inline Publisher */}
                {isActive && canPublish && showInstagramPublisher && (
                  <div className="mt-4 border-t border-[#FBCFE8] pt-4">
                    <form onSubmit={(e) => void handleInstagramPublish(e)} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#344054] mb-1">
                          Media Image URL <span className="text-[#B42318]">*</span>
                        </label>
                        <input
                          type="url"
                          value={instagramMediaUrl}
                          onChange={(e) => setInstagramMediaUrl(e.target.value)}
                          placeholder="https://example.com/product-image.jpg"
                          required
                          className="w-full text-xs px-3 py-2 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E1306C]/20 focus:border-[#E1306C] transition-all"
                        />
                        <span className="text-[10px] text-[#667085] mt-0.5 block">
                          Instagram feed requires a public image or video URL.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#344054] mb-1">
                          Caption
                        </label>
                        <textarea
                          value={instagramPostContent}
                          onChange={(e) => setInstagramPostContent(e.target.value)}
                          placeholder="Write your Instagram caption and hashtags..."
                          rows={3}
                          maxLength={charLimit}
                          required
                          className="w-full text-xs px-3 py-2 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E1306C]/20 focus:border-[#E1306C] transition-all resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-medium ${
                            charRemaining < 100
                              ? 'text-[#B45309]'
                              : charRemaining < 0
                                ? 'text-[#B42318]'
                                : 'text-[#667085]'
                          }`}
                        >
                          {charRemaining} characters remaining
                        </span>
                        <button
                          type="submit"
                          disabled={
                            isPublishingInstagram ||
                            !instagramPostContent.trim() ||
                            !instagramMediaUrl.trim() ||
                            charCount > charLimit
                          }
                          className="inline-flex items-center px-4 py-1.5 bg-[#E1306C] text-white text-xs font-bold rounded-lg hover:bg-[#C13584] transition-all disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          {isPublishingInstagram ? 'Publishing…' : 'Publish Now'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          }

          // ---------------------------------------------------------------
          // All other providers — manual-token card
          // ---------------------------------------------------------------
          return (
            <div
              key={prov.provider}
              className="bg-white border border-[#E4E7EC] rounded-xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: prov.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#17202A]">{prov.name}</h3>
                      <span className="text-[10px] text-[#667085] uppercase tracking-wider font-semibold">
                        {prov.provider}
                      </span>
                    </div>
                  </div>

                  {connectedAccount ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
                      <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F2F4F7] text-[#667085]">
                      Not Connected
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#667085] leading-relaxed">{prov.description}</p>

                {connectedAccount && (
                  <div className="p-2.5 bg-[#F7F8FA] border border-[#E4E7EC] rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-[#17202A] truncate">
                      {connectedAccount.displayName}
                    </p>
                    <p className="text-[10px] text-[#667085]">
                      ID: {connectedAccount.providerAccountId} • Connected{' '}
                      {new Date(connectedAccount.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-[#F2F4F7] flex items-center justify-between">
                {connectedAccount ? (
                  <button
                    type="button"
                    onClick={() => void handleDisconnect(connectedAccount.id, connectedAccount.displayName)}
                    className="inline-flex items-center text-xs font-semibold text-[#B42318] hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenConnect(prov.provider)}
                    className="inline-flex items-center px-3 py-1.5 bg-[#17202A] text-white text-xs font-semibold rounded-lg hover:bg-black transition-all ml-auto"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Connect Account
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Token Connect Modal (non-OAuth providers) */}
      {connectingProvider && (
        <div className="fixed inset-0 bg-[#17202A]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#E4E7EC] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 pb-4 border-b border-[#F2F4F7] flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF9F5] border border-[#E85D2A]/20 flex items-center justify-center text-[#E85D2A]">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17202A]">
                    Connect {SUPPORTED_PROVIDERS.find((p) => p.provider === connectingProvider)?.name}
                  </h3>
                  <p className="text-xs text-[#667085] mt-0.5">
                    Authorize social publishing permissions for this workspace.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConnectingProvider(null)}
                className="text-[#98A2B3] hover:text-[#344054] p-1.5 rounded-lg hover:bg-[#F2F4F7] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleConnectSubmit(e)}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Account Display Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Official Brand Page"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Provider Account ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 17841400... or organization URN"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all shadow-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Access Token
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter OAuth access token"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all shadow-xs font-mono"
                  />
                  <div className="mt-2 p-2.5 rounded-lg bg-[#F9FAFB] border border-[#E4E7EC] flex items-center gap-2 text-[11px] text-[#667085]">
                    <Lock className="w-3.5 h-3.5 text-[#16803C] shrink-0" />
                    <span>Tokens are encrypted at rest with AES-256-GCM.</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#F2F4F7] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setConnectingProvider(null)}
                  className="px-4 py-2 border border-[#D0D5DD] bg-white text-[#344054] rounded-xl text-xs font-semibold hover:bg-[#F2F4F7] shadow-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="px-4 py-2 bg-[#E85D2A] text-white rounded-xl text-xs font-bold hover:bg-[#d04e1f] shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isConnecting ? 'Encrypting & Saving…' : 'Save & Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
