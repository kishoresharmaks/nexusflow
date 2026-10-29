'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { api, type ProductItem, type BrandProfileItem, type QuotaStatus } from '../../lib/api';
import { ProtectedRoute } from '../../components/protected-route';
import { formatCurrency } from '../../lib/formatters';
import {
  Sparkles,
  Package,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Save,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Hash,
  Share2,
  Info,
  Check,
  AlertCircle,
  X,
} from 'lucide-react';

const CHANNELS = [
  { id: 'INSTAGRAM', name: 'Instagram', maxChars: 2200, icon: '📸' },
  { id: 'TIKTOK', name: 'TikTok', maxChars: 2200, icon: '🎵' },
  { id: 'FACEBOOK', name: 'Facebook', maxChars: 63206, icon: '👥' },
  { id: 'LINKEDIN', name: 'LinkedIn', maxChars: 3000, icon: '💼' },
  { id: 'TWITTER', name: 'X / Twitter', maxChars: 280, icon: '🐦' },
  { id: 'PINTEREST', name: 'Pinterest', maxChars: 500, icon: '📌' },
];

const DEFAULT_BRAND_VOICES = [
  {
    id: 'bv-1',
    name: 'Elevated & Sophisticated',
    tone: 'Understated luxury, poetic, design-focused',
    prohibited: ['cheap', 'miracle', 'revolutionary', 'discount'],
    hashtags: ['#ElevatedLiving', '#QuietLuxury', '#TimelessDesign'],
  },
  {
    id: 'bv-2',
    name: 'Warm & Community-Driven',
    tone: 'Friendly, relatable, conversational, encouraging',
    prohibited: ['urgent', 'buy now or cry', 'limited'],
    hashtags: ['#EthicalFashion', '#SlowLiving', '#ConsciousCloset'],
  },
  {
    id: 'bv-3',
    name: 'Energetic & Trendsetting',
    tone: 'Vibrant, bold, direct, fast-paced',
    prohibited: ['old-fashioned', 'boring'],
    hashtags: ['#StreetwearStyle', '#NewDrop', '#OutfitInspo'],
  },
];

export default function AiStudioPage() {
  const { currentWorkspace, token } = useAuth();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('INSTAGRAM');
  const [selectedBrandVoiceId, setSelectedBrandVoiceId] = useState<string>('bv-1');
  const [brandProfiles, setBrandProfiles] = useState<BrandProfileItem[]>([]);
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quota status
  const [quota, setQuota] = useState<QuotaStatus>({
    usedTokens: 0,
    limitTokens: 100000,
    remainingTokens: 100000,
    percentUsed: 0,
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
  });

  // Generated draft content state (editable)
  const [caption, setCaption] = useState<string>('');
  const [callToAction, setCallToAction] = useState<string>('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState<string>('');

  // Load products and quota from backend API
  const loadWorkspaceData = useCallback(async () => {
    if (!currentWorkspace?.id || !token) return;
    try {
      const [prodsRes, quotaRes, brandsRes] = await Promise.allSettled([
        api.getProducts(currentWorkspace.id, { limit: 50 }),
        api.getQuotaUsage(currentWorkspace.id),
        api.getBrandProfiles(currentWorkspace.id),
      ]);

      if (prodsRes.status === 'fulfilled') {
        setProducts(prodsRes.value.items);
        if (prodsRes.value.items.length > 0) {
          setSelectedProductId(prodsRes.value.items[0]?.id || '');
        }
      }

      if (quotaRes.status === 'fulfilled') {
        setQuota(quotaRes.value);
      }

      if (brandsRes.status === 'fulfilled' && brandsRes.value.length > 0) {
        setBrandProfiles(brandsRes.value);
      }
    } catch {
      // handled via empty state
    }
  }, [currentWorkspace?.id, token]);

  useEffect(() => {
    if (currentWorkspace?.id && token) {
      void loadWorkspaceData();
    }
  }, [loadWorkspaceData, currentWorkspace?.id, token]);

  const selectedProduct =
    products.find((p) => p.id === selectedProductId) || products[0] || null;
  const selectedChannelInfo = CHANNELS.find((c) => c.id === selectedChannel) || CHANNELS[0]!;
  const selectedVoice =
    DEFAULT_BRAND_VOICES.find((v) => v.id === selectedBrandVoiceId) || DEFAULT_BRAND_VOICES[0]!;

  const totalChars =
    caption.length +
    (callToAction ? `\n\n${callToAction}` : '').length +
    `\n\n${hashtags.join(' ')}`.length;
  const isOverCharLimit = totalChars > selectedChannelInfo.maxChars;

  // Prohibited words check
  const activeViolations = selectedVoice.prohibited.filter((word) =>
    new RegExp(`\\b${word}\\b`, 'i').test(`${caption} ${callToAction}`),
  );

  const handleGenerate = async () => {
    if (!currentWorkspace?.id || !selectedProduct) return;
    setIsGenerating(true);
    setSavedDraftId(null);
    setErrorMessage(null);

    try {
      const result = await api.generateContent(currentWorkspace.id, {
        productId: selectedProduct.id,
        channel: selectedChannel,
        customInstructions: customInstructions || undefined,
        createDraftPost: true, // Invariant: Saved as PostStatus.DRAFT
      });

      setCaption(result.caption);
      setCallToAction(result.callToAction);
      setHashtags(result.hashtags);
      if (result.draftPost) {
        setSavedDraftId(result.draftPost.id);
      }

      // Refresh quota status
      try {
        const updatedQuota = await api.getQuotaUsage(currentWorkspace.id);
        setQuota(updatedQuota);
      } catch {
        // Handled silently
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'AI content generation failed. Please check provider configuration.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const fullText = `${caption}\n\n${callToAction}\n\n${hashtags.join(' ')}`.trim();
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDraft = async () => {
    if (!currentWorkspace?.id) return;
    const fullText = [caption, callToAction, hashtags.join(' ')].filter(Boolean).join('\n\n').trim();
    if (!fullText) {
      setErrorMessage('Cannot save an empty draft.');
      return;
    }

    setErrorMessage(null);
    try {
      const post = await api.createPost(currentWorkspace.id, {
        content: fullText,
        productId: selectedProduct?.id,
      });
      setSavedDraftId(post.id);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save draft post to database.');
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTagInput.trim()) {
      e.preventDefault();
      const formatted = newTagInput.trim().startsWith('#')
        ? newTagInput.trim()
        : `#${newTagInput.trim()}`;
      if (!hashtags.includes(formatted)) {
        setHashtags([...hashtags, formatted]);
      }
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setHashtags(hashtags.filter((t) => t !== tagToRemove));
  };

  return (
    <ProtectedRoute
      fallbackTitle="AI Content Studio Access"
      fallbackDescription="Sign in to generate grounded marketing copy and manage brand voice profiles."
    >
      <main className="min-h-screen px-4 py-8 md:px-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E4E7EC] gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-[#17202A]">AI Content Studio</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#16803C]/10 text-[#16803C] flex items-center">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Catalog Grounded
              </span>
            </div>
            <p className="text-xs text-[#667085] mt-0.5">
              Generate high-converting marketing copy grounded strictly in catalog product facts.
            </p>
          </div>

          {/* Quota & Token Meter */}
          <div className="flex items-center space-x-4 bg-white px-4 py-2 rounded-lg border border-[#E4E7EC] shadow-sm">
            <div className="text-right">
              <div className="text-xs font-semibold text-[#17202A]">
                {quota.usedTokens.toLocaleString()} / {quota.limitTokens.toLocaleString()} Tokens
              </div>
              <div className="text-[10px] text-[#667085]">
                Monthly Quota ({Math.max(0, 100 - quota.percentUsed).toFixed(1)}% remaining)
              </div>
            </div>
            <div className="w-20 bg-[#F2F4F7] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#16803C] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(1, quota.percentUsed))}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Main Grid: Controls (Left) and Grounded Output Preview (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Generation Controls */}
          <div className="lg:col-span-5 space-y-6">
            {/* Step 1: Select Product from Catalog */}
            <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#17202A] flex items-center mb-3">
                <Package className="w-4 h-4 mr-2 text-[#E85D2A]" />
                1. Ground in Catalog Product
              </h2>

              {products.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-[#D0D5DD] bg-[#F7F8FA] text-center space-y-3">
                  <Package className="w-8 h-8 text-[#667085] mx-auto" />
                  <div>
                    <p className="text-xs font-semibold text-[#17202A]">No Products in Catalog</p>
                    <p className="text-[11px] text-[#667085] mt-0.5">
                      Add products or sync your store before generating AI copy.
                    </p>
                  </div>
                  <Link
                    href="/catalog"
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E85D2A] text-white hover:bg-[#d04e1f] transition-all"
                  >
                    Go to Product Catalog
                  </Link>
                </div>
              ) : selectedProduct ? (
                <>
                  <label className="block text-xs font-medium text-[#344054] mb-1">
                    Select product to ground copy in:
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-[#D0D5DD] px-3 py-2 bg-white text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({formatCurrency(p.priceCents, p.currency, currentWorkspace?.locale)})
                      </option>
                    ))}
                  </select>

                  {/* Grounding Facts Card */}
                  <div className="mt-3 p-3 rounded-lg bg-[#F7F8FA] border border-[#E4E7EC] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#17202A]">{selectedProduct.title}</span>
                      <span className="font-mono text-[#E85D2A] font-bold">
                        {formatCurrency(selectedProduct.priceCents, selectedProduct.currency, currentWorkspace?.locale)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#667085] leading-relaxed">
                      {selectedProduct.description || 'Verified product from catalog'}
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t border-[#E4E7EC] text-[11px]">
                      <span className="text-[#344054]">
                        Stock:{' '}
                        <span
                          className={
                            selectedProduct.inventoryCount > 0
                              ? 'font-semibold text-[#16803C]'
                              : 'font-semibold text-[#B54708]'
                          }
                        >
                          {selectedProduct.inventoryCount > 0
                            ? `${selectedProduct.inventoryCount} units`
                            : 'Out of stock'}
                        </span>
                      </span>
                      <span className="font-mono text-[#667085] text-[10px]">
                        SKU: {selectedProduct.sku || 'N/A'}
                      </span>
                    </div>

                    {/* Stale Warning Banner (>48h) */}
                    {selectedProduct.isStale && (
                      <div className="mt-2 p-2.5 rounded-md bg-[#FFF9F5] border border-[#FECDCA] text-[#B54708] flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#B54708]" />
                        <div className="text-[11px] leading-tight">
                          <span className="font-semibold">Stale Catalog Data Warning:</span> Last
                          verified &gt;48 hours ago. Price or inventory status may be outdated. Verify
                          before publishing.
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Step 2: Target Channel */}
            <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#17202A] flex items-center mb-3">
                <Share2 className="w-4 h-4 mr-2 text-[#E85D2A]" />
                2. Select Marketing Channel
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChannel(ch.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs transition-all ${
                      selectedChannel === ch.id
                        ? 'border-[#E85D2A] bg-[#FFF9F5] text-[#E85D2A] font-semibold ring-1 ring-[#E85D2A]'
                        : 'border-[#E4E7EC] bg-white text-[#344054] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <span className="text-base mb-1">{ch.icon}</span>
                    <span>{ch.name}</span>
                    <span className="text-[9px] text-[#667085] mt-0.5">{ch.maxChars} chars</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Brand Voice Profile */}
            <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#17202A] flex items-center mb-3">
                <Sliders className="w-4 h-4 mr-2 text-[#E85D2A]" />
                3. Brand Voice &amp; Guardrails
              </h2>
              <label className="block text-xs font-medium text-[#344054] mb-1">
                Active Brand Profile:
              </label>
              <select
                value={selectedBrandVoiceId}
                onChange={(e) => setSelectedBrandVoiceId(e.target.value)}
                className="w-full text-xs rounded-lg border border-[#D0D5DD] px-3 py-2 bg-white text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20"
              >
                {brandProfiles.length > 0
                  ? brandProfiles.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))
                  : DEFAULT_BRAND_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
              </select>

              <div className="mt-3 space-y-2 text-xs">
                <div className="text-[11px] text-[#667085]">
                  <span className="font-medium text-[#344054]">Tone:</span> {selectedVoice.tone}
                </div>
                <div className="flex items-center flex-wrap gap-1">
                  <span className="text-[10px] text-[#667085] mr-1">Prohibited Words:</span>
                  {selectedVoice.prohibited.map((w) => (
                    <span
                      key={w}
                      className="px-1.5 py-0.5 rounded bg-[#FEF3F2] text-[#B42318] text-[10px] font-mono"
                    >
                      ✕ {w}
                    </span>
                  ))}
                </div>
              </div>

              {/* Custom Instructions */}
              <div className="mt-4">
                <label className="block text-xs font-medium text-[#344054] mb-1">
                  Custom Focus / Campaign Angle (Optional):
                </label>
                <input
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g., Focus on weekend styling and lightweight comfort..."
                  className="w-full text-xs rounded-lg border border-[#D0D5DD] px-3 py-2 bg-white text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20"
                />
              </div>

              {/* Generate Action Button */}
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
                className="mt-5 w-full flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#E85D2A] text-white hover:bg-[#d04e1f] transition-all shadow-sm disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Grounding copy in catalog facts...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Grounded Content
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Output Editor, Review & Draft Approval */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-xl border border-[#E4E7EC] p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-[#E4E7EC]">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-[#17202A]">Editable Draft Post</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#B54708]/10 text-[#B54708]">
                    PostStatus: DRAFT
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB] transition-all"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-[#16803C]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1 text-[#667085]" />
                        Copy Text
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#17202A] text-white hover:bg-[#2c3e50] transition-all shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5 mr-1 text-white" />
                    Save as Draft
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="mt-3 p-3 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="text-[#B42318] hover:text-[#912018]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Saved Notification */}
              {savedDraftId && (
                <div className="mt-3 p-3 rounded-lg bg-[#ECFDF3] border border-[#A6F4C5] text-[#027A48] flex items-center space-x-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Draft post saved successfully with ID{' '}
                    <code className="font-mono font-bold">{savedDraftId}</code>. Status is{' '}
                    <strong>DRAFT</strong> awaiting human review.
                  </span>
                </div>
              )}

              {/* Prohibited Words Alert */}
              {activeViolations.length > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] flex items-center space-x-2 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>Brand Voice Violation Detected:</strong> The prohibited word(s){' '}
                    <strong>&quot;{activeViolations.join(', ')}&quot;</strong> were detected. Please
                    remove them before approval.
                  </span>
                </div>
              )}

              {/* Character Count & Integrity Rules */}
              <div className="mt-4 flex items-center justify-between text-xs text-[#667085]">
                <span className="flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-[#16803C]" />
                  Strict Fact Grounding Enforced
                </span>
                <span
                  className={`font-mono font-medium ${
                    isOverCharLimit ? 'text-[#B42318] font-bold' : 'text-[#344054]'
                  }`}
                >
                  {totalChars} / {selectedChannelInfo.maxChars} chars
                  {isOverCharLimit && ' (Limit Exceeded!)'}
                </span>
              </div>

              {/* Post Caption Field */}
              <div className="mt-3">
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Post Caption:
                </label>
                <textarea
                  rows={5}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full text-xs rounded-lg border border-[#D0D5DD] p-3 text-[#17202A] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20"
                />
              </div>

              {/* Call to Action Field */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Call to Action (CTA):
                </label>
                <input
                  type="text"
                  value={callToAction}
                  onChange={(e) => setCallToAction(e.target.value)}
                  className="w-full text-xs rounded-lg border border-[#D0D5DD] px-3 py-2 text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20"
                />
              </div>

              {/* Hashtags Management */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Hashtags ({hashtags.length}):
                </label>
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg border border-[#D0D5DD] bg-[#FAFAFA]">
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E85D2A]/10 text-[#E85D2A]"
                    >
                      <Hash className="w-3 h-3 mr-0.5 text-[#E85D2A]" />
                      {tag.replace(/^#/, '')}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-[#E85D2A] hover:text-[#B54708]"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Type tag & press enter..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    className="flex-1 min-w-[140px] text-xs bg-transparent border-none outline-none text-[#17202A] placeholder-[#98A2B3]"
                  />
                </div>
              </div>

              {/* Social Platform Live Preview Card */}
              <div className="mt-6 pt-5 border-t border-[#E4E7EC]">
                <h3 className="text-xs font-semibold text-[#344054] uppercase tracking-wider mb-3">
                  Live Channel Preview ({selectedChannelInfo.name})
                </h3>
                <div className="bg-[#F8F9FA] rounded-xl border border-[#E4E7EC] p-4 max-w-md mx-auto shadow-inner">
                  {/* Simulated Social Header */}
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[#E85D2A] flex items-center justify-center text-white text-xs font-bold">
                      CP
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#17202A]">commercepilot.store</div>
                      <div className="text-[10px] text-[#667085] flex items-center">
                        <span>Sponsored</span> &bull; <span>Catalog Grounded</span>
                      </div>
                    </div>
                  </div>

                  {/* Preview Image */}
                  {selectedProduct && selectedProduct.images && selectedProduct.images.length > 0 && (
                    <div className="rounded-lg overflow-hidden border border-[#E4E7EC] mb-3 aspect-video bg-[#EAECF0] relative">
                      <img
                        src={selectedProduct.images[0]}
                        alt={selectedProduct.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 bg-[#17202A]/80 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-mono">
                        {formatCurrency(selectedProduct.priceCents, selectedProduct.currency, currentWorkspace?.locale)}
                      </div>
                    </div>
                  )}

                  {/* Simulated Body */}
                  <div className="text-xs text-[#17202A] space-y-2 whitespace-pre-wrap">
                    <p>{caption || 'Draft caption will appear here after generation...'}</p>
                    {callToAction && <p className="font-semibold text-[#E85D2A]">{callToAction}</p>}
                    {hashtags.length > 0 && <p className="text-[#175CD3] text-[11px]">{hashtags.join(' ')}</p>}
                  </div>
                </div>
              </div>

              {/* Quality Guardrail Note */}
              <div className="mt-5 p-3 rounded-lg bg-[#F7F8FA] border border-[#E4E7EC] flex items-start space-x-2 text-xs text-[#667085]">
                <Info className="w-4 h-4 text-[#175CD3] flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Quality Guardrail:</strong> Generated content is saved as an editable
                  draft. Posts are never published automatically without human review, channel
                  selection, and explicit approval in your publishing pipeline.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
