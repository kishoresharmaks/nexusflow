'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import {
  api,
  type ProductItem,
  type SocialAccountItem,
  type MediaAssetItem,
  type SocialProviderType,
} from '../../lib/api';
import { ProtectedRoute } from '../../components/protected-route';
import {
  Sparkles,
  Send,
  Calendar,
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Image as ImageIcon,
  Tag,
  ThumbsUp,
  MessageCircle,
  Share2,
  Heart,
  Repeat2,
} from 'lucide-react';

const PLATFORM_CONFIGS: Record<
  SocialProviderType,
  {
    name: string;
    maxChars: number;
    maxHashtags: number;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }
> = {
  META_INSTAGRAM: {
    name: 'Instagram',
    maxChars: 2200,
    maxHashtags: 30,
    icon: Instagram,
    accentColor: '#E1306C',
  },
  META_FACEBOOK: {
    name: 'Facebook',
    maxChars: 5000,
    maxHashtags: 50,
    icon: Facebook,
    accentColor: '#1877F2',
  },
  LINKEDIN: {
    name: 'LinkedIn',
    maxChars: 3000,
    maxHashtags: 20,
    icon: Linkedin,
    accentColor: '#0A66C2',
  },
  TWITTER: {
    name: 'X (Twitter)',
    maxChars: 280,
    maxHashtags: 10,
    icon: Twitter,
    accentColor: '#17202A',
  },
  TIKTOK: {
    name: 'TikTok',
    maxChars: 2200,
    maxHashtags: 30,
    icon: Sparkles,
    accentColor: '#000000',
  },
  PINTEREST: {
    name: 'Pinterest',
    maxChars: 500,
    maxHashtags: 20,
    icon: Tag,
    accentColor: '#BD081C',
  },
  YOUTUBE: {
    name: 'YouTube',
    maxChars: 5000,
    maxHashtags: 15,
    icon: Share2,
    accentColor: '#FF0000',
  },
};

export default function ComposerPage() {
  const router = useRouter();
  const { currentWorkspace, token } = useAuth();

  const [selectedPlatform, setSelectedPlatform] = useState<SocialProviderType>('META_INSTAGRAM');
  const [content, setContent] = useState<string>('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountItem[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAssetItem[]>([]);

  const [_isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [scheduleDateTime, setScheduleDateTime] = useState<string>('');
  const [showScheduleInput, setShowScheduleInput] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!currentWorkspace?.id || !token) return;

    let mounted = true;
    const loadResources = async () => {
      setIsLoading(true);
      try {
        const [prodRes, accRes, mediaRes] = await Promise.all([
          api.getProducts(currentWorkspace.id, { limit: 50 }),
          api.getSocialAccounts(currentWorkspace.id),
          api.getMediaAssets(currentWorkspace.id),
        ]);

        if (!mounted) return;
        setProducts(prodRes.items);
        setSocialAccounts(accRes);
        setMediaAssets(mediaRes);

        // Pre-select account matching platform if exists
        const matchingAcc = accRes.find((a) => a.provider === selectedPlatform);
        if (matchingAcc) {
          setSelectedAccountId(matchingAcc.id);
        }
      } catch (err: unknown) {
        if (mounted) {
          setStatusMessage({
            type: 'error',
            text: err instanceof Error ? err.message : 'Failed to load composer data',
          });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadResources();
    return () => {
      mounted = false;
    };
  }, [currentWorkspace?.id, token, selectedPlatform]);

  const config = PLATFORM_CONFIGS[selectedPlatform];
  const charCount = content.length;
  const isOverCharLimit = charCount > config.maxChars;

  const hashtagCount = (content.match(/#[a-zA-Z0-9_]+/g) || []).length;
  const isOverHashtagLimit = hashtagCount > config.maxHashtags;

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleSaveDraft = async () => {
    if (!currentWorkspace?.id) return;
    if (!content.trim()) {
      setStatusMessage({ type: 'error', text: 'Content cannot be empty.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const post = await api.createPost(currentWorkspace.id, {
        content: content.trim(),
        mediaUrls,
        productId: selectedProductId || undefined,
        socialAccountId: selectedAccountId || undefined,
      });

      setStatusMessage({
        type: 'success',
        text: `Post draft saved successfully (ID: ${post.id.slice(-6)}).`,
      });
      setTimeout(() => router.push('/posts'), 1200);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save draft post.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!currentWorkspace?.id) return;
    if (!content.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const post = await api.createPost(currentWorkspace.id, {
        content: content.trim(),
        mediaUrls,
        productId: selectedProductId || undefined,
        socialAccountId: selectedAccountId || undefined,
      });

      await api.requestPostApproval(currentWorkspace.id, post.id);

      setStatusMessage({
        type: 'success',
        text: 'Post submitted for approval. Redirecting to pipeline...',
      });
      setTimeout(() => router.push('/posts'), 1200);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to submit post for approval.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSchedulePost = async () => {
    if (!currentWorkspace?.id) return;
    if (!scheduleDateTime) {
      setStatusMessage({ type: 'error', text: 'Please pick a scheduled date and time.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const post = await api.createPost(currentWorkspace.id, {
        content: content.trim(),
        mediaUrls,
        productId: selectedProductId || undefined,
        socialAccountId: selectedAccountId || undefined,
      });

      await api.schedulePost(
        currentWorkspace.id,
        post.id,
        new Date(scheduleDateTime).toISOString(),
      );

      setStatusMessage({
        type: 'success',
        text: 'Post scheduled successfully! Redirecting...',
      });
      setTimeout(() => router.push('/posts'), 1200);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to schedule post.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishNow = async () => {
    if (!currentWorkspace?.id) return;
    if (!content.trim()) return;

    if (
      !confirm('Are you sure you want to publish this post immediately to the connected channel?')
    ) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const post = await api.createPost(currentWorkspace.id, {
        content: content.trim(),
        mediaUrls,
        productId: selectedProductId || undefined,
        socialAccountId: selectedAccountId || undefined,
      });

      const res = await api.publishPostNow(currentWorkspace.id, post.id);

      setStatusMessage({
        type: 'success',
        text: `Post published successfully! Provider ID: ${res.post.providerPostId || 'Verified'}`,
      });
      setTimeout(() => router.push('/posts'), 1500);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Publishing failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute
      fallbackTitle="Composer Workspace Access"
      fallbackDescription="Please sign in to compose, preview, and schedule multi-channel social posts."
    >
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-[#E4E7EC] mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <Link
                href="/posts"
                className="text-xs text-[#667085] hover:text-[#17202A] inline-flex items-center"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to Posts
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-[#17202A] mt-1">Channel-Aware Composer</h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Craft, preview, link catalog products, and schedule posts across all verified social
              networks.
            </p>
          </div>

          {/* Platform Selector Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 mt-4 sm:mt-0">
            {(Object.keys(PLATFORM_CONFIGS) as SocialProviderType[]).map((pKey) => {
              const p = PLATFORM_CONFIGS[pKey];
              const Icon = p.icon;
              const isSelected = selectedPlatform === pKey;
              return (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => setSelectedPlatform(pKey)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'bg-[#17202A] text-white border-[#17202A] shadow-sm'
                      : 'bg-white text-[#667085] border-[#D0D5DD] hover:border-[#17202A]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5" />
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl text-xs flex items-center justify-between border ${
              statusMessage.type === 'success'
                ? 'bg-[#16803C]/10 border-[#16803C]/20 text-[#16803C]'
                : 'bg-[#B42318]/10 border-[#B42318]/20 text-[#B42318]'
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Editor & Live Preview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form & Controls (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Post Content Box */}
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#344054]">
                  Post Caption & Copy
                </label>
                <div className="flex items-center space-x-3 text-xs">
                  <span
                    className={`font-semibold ${
                      isOverCharLimit ? 'text-[#B42318]' : 'text-[#667085]'
                    }`}
                  >
                    {charCount} / {config.maxChars} chars
                  </span>
                  <span
                    className={`font-semibold ${
                      isOverHashtagLimit ? 'text-[#B42318]' : 'text-[#667085]'
                    }`}
                  >
                    {hashtagCount} / {config.maxHashtags} hashtags
                  </span>
                </div>
              </div>

              <textarea
                rows={7}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Write engaging copy for ${config.name}... e.g. "Discover our eco-friendly linen collection. #sustainable #style"`}
                className={`w-full p-3.5 border rounded-lg text-sm outline-none transition-all ${
                  isOverCharLimit || isOverHashtagLimit
                    ? 'border-[#B42318] focus:ring-1 focus:ring-[#B42318]'
                    : 'border-[#D0D5DD] focus:border-[#E85D2A] focus:ring-1 focus:ring-[#E85D2A]'
                }`}
              />

              {/* Quick Actions to Ground Product */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#667085] mb-1">
                    Link Product from Catalog
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value);
                      const prod = products.find((p) => p.id === e.target.value);
                      if (prod && !content) {
                        setContent(
                          `Meet the ${prod.title}! Priced at $${(prod.priceCents / 100).toFixed(
                            2,
                          )}. ${prod.description || ''} #shop #new`,
                        );
                        if (prod.images[0]) {
                          setMediaUrls([prod.images[0]]);
                        }
                      }
                    }}
                    className="w-full text-xs p-2 bg-[#F7F8FA] border border-[#D0D5DD] rounded-lg outline-none cursor-pointer"
                  >
                    <option value="">No product linked</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (${(p.priceCents / 100).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#667085] mb-1">
                    Target Social Account
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F7F8FA] border border-[#D0D5DD] rounded-lg outline-none cursor-pointer"
                  >
                    <option value="">Auto-select workspace account</option>
                    {socialAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.displayName} ({a.provider})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Media Asset Picker */}
              <div className="pt-2 border-t border-[#F2F4F7]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-[#667085] flex items-center">
                    <ImageIcon className="w-3 h-3 mr-1" /> Attached Media ({mediaUrls.length})
                  </span>
                  <Link href="/media" className="text-[11px] text-[#E85D2A] hover:underline">
                    Upload New to Media Library
                  </Link>
                </div>

                {mediaAssets.length > 0 ? (
                  <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                    {mediaAssets.map((asset) => {
                      const isAttached = mediaUrls.includes(asset.url || asset.storageKey);
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => {
                            const assetUrl = asset.url || asset.storageKey;
                            if (isAttached) {
                              setMediaUrls(mediaUrls.filter((u) => u !== assetUrl));
                            } else {
                              setMediaUrls([...mediaUrls, assetUrl]);
                            }
                          }}
                          className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                            isAttached
                              ? 'border-[#E85D2A] ring-2 ring-[#E85D2A]/20'
                              : 'border-[#E4E7EC] opacity-75 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={api.resolveMediaUrl(asset.url || 'https://placehold.co/100x100?text=Asset')}
                            alt={asset.originalFilename}
                            className="w-full h-full object-cover"
                          />
                          {isAttached && (
                            <div className="absolute inset-0 bg-[#E85D2A]/30 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#667085] italic">
                    No uploaded assets found in Media Library.
                  </p>
                )}
              </div>
            </div>

            {/* Workflow & Scheduling Section */}
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#344054]">
                Publishing &amp; Scheduling Options
              </h3>

              {showScheduleInput && (
                <div className="p-3.5 bg-[#F7F8FA] border border-[#D0D5DD] rounded-lg space-y-2">
                  <label className="block text-xs font-semibold text-[#17202A]">
                    Select Publish Date &amp; Time (UTC)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-[#D0D5DD] rounded-md outline-none"
                  />
                  <p className="text-[11px] text-[#667085]">
                    Scheduled posts are queued with automatic delivery verification and timezone alignment.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting || !content.trim()}
                  onClick={handleSaveDraft}
                  className="inline-flex items-center px-4 py-2 border border-[#D0D5DD] text-xs font-semibold rounded-lg text-[#344054] hover:bg-[#F2F4F7] disabled:opacity-50 transition-all"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || !content.trim()}
                  onClick={handleRequestApproval}
                  className="inline-flex items-center px-4 py-2 border border-[#0A66C2] text-xs font-semibold rounded-lg text-[#0A66C2] hover:bg-[#0A66C2]/10 disabled:opacity-50 transition-all"
                >
                  Request Approval
                </button>

                {showScheduleInput ? (
                  <button
                    type="button"
                    disabled={isSubmitting || !scheduleDateTime}
                    onClick={handleSchedulePost}
                    className="inline-flex items-center px-4 py-2 bg-[#17202A] text-white text-xs font-semibold rounded-lg hover:bg-black disabled:opacity-50 transition-all"
                  >
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    Confirm Schedule
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowScheduleInput(true)}
                    className="inline-flex items-center px-4 py-2 border border-[#D0D5DD] text-xs font-semibold rounded-lg text-[#344054] hover:bg-[#F2F4F7] transition-all"
                  >
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    Schedule...
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSubmitting || !content.trim() || isOverCharLimit}
                  onClick={handlePublishNow}
                  className="inline-flex items-center px-4 py-2 bg-[#E85D2A] text-white text-xs font-semibold rounded-lg hover:bg-[#D44D1E] shadow-sm disabled:opacity-50 transition-all ml-auto"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Publish Now
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Social Platform Mockup Preview (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                Live Preview: {config.name}
              </span>
              <span className="text-[11px] text-[#16803C] font-semibold flex items-center">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Pixel-Accurate Spec
              </span>
            </div>

            {/* INSTAGRAM MOCKUP */}
            {selectedPlatform === 'META_INSTAGRAM' && (
              <div className="bg-white border border-[#DBDBDB] rounded-xl shadow-sm overflow-hidden max-w-sm mx-auto">
                <div className="p-3 flex items-center justify-between border-b border-[#F2F4F7]">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[1.5px]">
                      <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-[10px] font-bold">
                        CP
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#262626]">
                        {currentWorkspace?.slug || 'commerce_brand'}
                      </p>
                      <p className="text-[10px] text-[#8E8E8E]">Sponsored</p>
                    </div>
                  </div>
                  <span className="text-xs text-[#8E8E8E]">•••</span>
                </div>

                {/* Media Image */}
                <div className="w-full aspect-square bg-[#F7F8FA] flex items-center justify-center overflow-hidden">
                  {mediaUrls[0] ? (
                    <img
                      src={api.resolveMediaUrl(mediaUrls[0])}
                      alt="Post media"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-6">
                      <ImageIcon className="w-10 h-10 text-[#C7C7C7] mx-auto mb-2" />
                      <p className="text-xs text-[#8E8E8E]">
                        Select media to complete Instagram Feed preview
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Icons */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-[#262626]">
                      <Heart className="w-5 h-5 hover:text-red-500 cursor-pointer" />
                      <MessageCircle className="w-5 h-5 cursor-pointer" />
                      <Send className="w-5 h-5 cursor-pointer" />
                    </div>
                    <Tag className="w-4 h-4 text-[#8E8E8E]" />
                  </div>
                  <p className="text-[11px] font-bold text-[#262626]">1,248 likes</p>
                  <div className="text-xs text-[#262626] leading-relaxed whitespace-pre-line">
                    <span className="font-bold mr-1.5">
                      {currentWorkspace?.slug || 'commerce_brand'}
                    </span>
                    {content || 'Your engaging Instagram caption will appear here with hashtags.'}
                  </div>
                </div>
              </div>
            )}

            {/* LINKEDIN MOCKUP */}
            {selectedPlatform === 'LINKEDIN' && (
              <div className="bg-white border border-[#E0E0E0] rounded-xl shadow-sm p-4 space-y-3 max-w-sm mx-auto">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#0A66C2] text-white flex items-center justify-center font-bold text-xs">
                    CP
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#191919]">
                      {currentWorkspace?.name || 'CommercePilot Seller'}
                    </p>
                    <p className="text-[10px] text-[#666666]">
                      Official Verified Company • Just now
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#191919] whitespace-pre-line leading-relaxed">
                  {content || 'Professional announcement copy grounded in catalog inventory.'}
                </p>

                {mediaUrls[0] && (
                  <div className="w-full aspect-video rounded-lg overflow-hidden border border-[#E0E0E0]">
                    <img
                      src={api.resolveMediaUrl(mediaUrls[0])}
                      alt="Attached media"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="pt-2 border-t border-[#EAEAEA] flex items-center justify-between text-xs text-[#666666]">
                  <button className="flex items-center space-x-1 hover:text-[#0A66C2]">
                    <ThumbsUp className="w-3.5 h-3.5" /> <span>Like</span>
                  </button>
                  <button className="flex items-center space-x-1 hover:text-[#0A66C2]">
                    <MessageCircle className="w-3.5 h-3.5" /> <span>Comment</span>
                  </button>
                  <button className="flex items-center space-x-1 hover:text-[#0A66C2]">
                    <Repeat2 className="w-3.5 h-3.5" /> <span>Repost</span>
                  </button>
                </div>
              </div>
            )}

            {/* X (TWITTER) MOCKUP */}
            {selectedPlatform === 'TWITTER' && (
              <div className="bg-white border border-[#CFD9DE] rounded-xl shadow-sm p-4 space-y-2.5 max-w-sm mx-auto">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">
                    X
                  </div>
                  <div>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-bold text-[#0F1419]">
                        {currentWorkspace?.name || 'Commerce Brand'}
                      </span>
                      <span className="text-[11px] text-[#536471]">
                        @{currentWorkspace?.slug || 'brand'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#0F1419] whitespace-pre-line leading-relaxed">
                  {content || 'Short, high-converting tweet within 280 characters.'}
                </p>

                {mediaUrls[0] && (
                  <div className="w-full aspect-video rounded-xl overflow-hidden border border-[#CFD9DE]">
                    <img
                      src={api.resolveMediaUrl(mediaUrls[0])}
                      alt="Tweet media"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="pt-2 border-t border-[#EFF3F4] flex items-center justify-between text-[#536471] text-xs">
                  <MessageCircle className="w-3.5 h-3.5 cursor-pointer hover:text-[#1D9BF0]" />
                  <Repeat2 className="w-3.5 h-3.5 cursor-pointer hover:text-[#00BA7C]" />
                  <Heart className="w-3.5 h-3.5 cursor-pointer hover:text-[#F91880]" />
                  <Share2 className="w-3.5 h-3.5 cursor-pointer hover:text-[#1D9BF0]" />
                </div>
              </div>
            )}

            {/* FACEBOOK MOCKUP */}
            {selectedPlatform === 'META_FACEBOOK' && (
              <div className="bg-white border border-[#CED0D4] rounded-xl shadow-sm p-4 space-y-3 max-w-sm mx-auto">
                <div className="flex items-center space-x-2">
                  <div className="w-9 h-9 rounded-full bg-[#1877F2] text-white flex items-center justify-center font-bold text-xs">
                    f
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#050505]">
                      {currentWorkspace?.name || 'CommercePilot Brand'}
                    </p>
                    <p className="text-[10px] text-[#65676B]">Just now • 🌍</p>
                  </div>
                </div>

                <p className="text-xs text-[#050505] whitespace-pre-line leading-relaxed">
                  {content || 'Facebook page promotional post with clear call-to-action.'}
                </p>

                {mediaUrls[0] && (
                  <div className="w-full aspect-video rounded-lg overflow-hidden">
                    <img
                      src={api.resolveMediaUrl(mediaUrls[0])}
                      alt="Facebook media"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="pt-2 border-t border-[#CED0D4] flex items-center justify-between text-xs text-[#65676B]">
                  <button className="flex items-center space-x-1 hover:text-[#1877F2]">
                    <ThumbsUp className="w-3.5 h-3.5" /> <span>Like</span>
                  </button>
                  <button className="flex items-center space-x-1 hover:text-[#1877F2]">
                    <MessageCircle className="w-3.5 h-3.5" /> <span>Comment</span>
                  </button>
                  <button className="flex items-center space-x-1 hover:text-[#1877F2]">
                    <Share2 className="w-3.5 h-3.5" /> <span>Share</span>
                  </button>
                </div>
              </div>
            )}

            {/* TIKTOK / PINTEREST / OTHER MOCKUP FALLBACK */}
            {['TIKTOK', 'PINTEREST', 'YOUTUBE'].includes(selectedPlatform) && (
              <div className="bg-white border border-[#E4E7EC] rounded-xl shadow-sm p-4 space-y-3 max-w-sm mx-auto">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs"
                    style={{ backgroundColor: config.accentColor }}
                  >
                    {config.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#17202A]">{config.name} Post</p>
                    <p className="text-[10px] text-[#667085]">Channel Preview</p>
                  </div>
                </div>
                <p className="text-xs text-[#17202A] whitespace-pre-line leading-relaxed">
                  {content || `Content preview for ${config.name}.`}
                </p>
              </div>
            )}

            {/* Linked Product Card Summary */}
            {selectedProduct && (
              <div className="p-3 bg-[#F7F8FA] border border-[#E4E7EC] rounded-xl flex items-center space-x-3 text-xs max-w-sm mx-auto">
                <div className="w-10 h-10 rounded-lg bg-white border border-[#D0D5DD] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {selectedProduct.images[0] ? (
                    <img
                      src={selectedProduct.images[0]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Tag className="w-4 h-4 text-[#667085]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#17202A] truncate">{selectedProduct.title}</p>
                  <p className="text-[10px] text-[#667085]">
                    SKU: {selectedProduct.sku || 'N/A'} • $
                    {(selectedProduct.priceCents / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
