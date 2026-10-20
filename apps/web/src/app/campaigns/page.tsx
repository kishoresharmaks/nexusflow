'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { ProtectedRoute } from '../../components/protected-route';
import {
  api,
  type CampaignItem,
  type CreateCampaignPayload,
  type GenerateUtmUrlPayload,
} from '../../lib/api';
import {
  Flag,
  Plus,
  Trash2,
  Copy,
  Check,
  MousePointer,
  Calendar,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';

export default function CampaignsPage() {
  return (
    <ProtectedRoute>
      <CampaignsContent />
    </ProtectedRoute>
  );
}

function CampaignsContent() {
  const { currentWorkspace } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Campaign Form State
  const [campaignForm, setCampaignForm] = useState<CreateCampaignPayload>({
    name: '',
    description: '',
    utmCampaign: '',
  });

  // UTM Generator State
  const [utmForm, setUtmForm] = useState<GenerateUtmUrlPayload>({
    baseUrl: 'https://example.com/products/summer-collection',
    utmSource: 'instagram',
    utmMedium: 'stories',
    utmCampaign: '',
    utmContent: 'promo_reel_v1',
  });
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const loadCampaigns = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await api.getCampaigns(currentWorkspace.id);
      setCampaigns(list);
      if (list.length > 0 && !utmForm.utmCampaign) {
        setUtmForm((prev) => ({
          ...prev,
          utmCampaign:
            list[0]?.utmCampaign || list[0]?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '',
        }));
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to load campaigns.');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, utmForm.utmCampaign]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  // Update generated URL on UTM form change
  useEffect(() => {
    if (!currentWorkspace || !utmForm.baseUrl) return;
    try {
      const url = new URL(utmForm.baseUrl);
      url.searchParams.set('utm_source', utmForm.utmSource);
      url.searchParams.set('utm_medium', utmForm.utmMedium);
      if (utmForm.utmCampaign) url.searchParams.set('utm_campaign', utmForm.utmCampaign);
      if (utmForm.utmContent) url.searchParams.set('utm_content', utmForm.utmContent);
      setGeneratedUrl(url.toString());
    } catch {
      setGeneratedUrl('');
    }
  }, [utmForm, currentWorkspace]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;

    setIsCreating(true);
    setError(null);
    try {
      const created = await api.createCampaign(currentWorkspace.id, {
        name: campaignForm.name,
        ...(campaignForm.description ? { description: campaignForm.description } : {}),
        ...(campaignForm.utmCampaign ? { utmCampaign: campaignForm.utmCampaign } : {}),
      });

      setSuccessMessage(`Created campaign "${created.name}"!`);
      setIsModalOpen(false);
      setCampaignForm({ name: '', description: '', utmCampaign: '' });
      await loadCampaigns();
    } catch (err) {
      setError((err as Error).message || 'Failed to create campaign.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!currentWorkspace) return;
    if (!confirm(`Are you sure you want to delete campaign "${name}"?`)) return;

    try {
      await api.deleteCampaign(currentWorkspace.id, id);
      setSuccessMessage(`Deleted campaign "${name}".`);
      await loadCampaigns();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete campaign.');
    }
  };

  const copyToClipboard = () => {
    if (!generatedUrl) return;
    void navigator.clipboard.writeText(generatedUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between pb-6 border-b border-[#E4E7EC] gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-[#E85D2A] flex items-center justify-center shrink-0">
            <Flag className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[#17202A]">
                Marketing Campaigns & Attribution Links
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
                Live Attribution
              </span>
            </div>
            <p className="text-sm text-[#667085] mt-1">
              Organize multi-channel promotions, auto-generate standard UTM tracking parameters, and
              attribute customer orders.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setError(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#E85D2A] text-white rounded-xl text-sm font-semibold hover:bg-[#D44D1E] transition-all shrink-0 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Create Campaign
        </button>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-600 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mt-6 p-4 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] text-[#027A48] flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-[#027A48] hover:text-[#015C38] transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Grid: Campaigns List + UTM Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Campaigns List (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-[#17202A]">
            <span>Active Campaigns</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#E85D2A]/10 text-[#E85D2A] font-bold">
              {campaigns.length}
            </span>
          </h2>

          {isLoading ? (
            <div className="p-12 text-center text-[#667085] border-2 border-dashed border-[#E4E7EC] rounded-2xl bg-white">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#E85D2A]" />
              Loading campaigns...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-[#E4E7EC] rounded-2xl bg-white">
              <Flag className="h-10 w-10 text-[#667085] mx-auto mb-3" />
              <h3 className="font-semibold text-base text-[#17202A]">No campaigns created yet</h3>
              <p className="text-xs text-[#667085] max-w-sm mx-auto mt-1 mb-4">
                Create a campaign to organize seasonal sales, product drops, or multi-channel
                acquisition funnels.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-[#E85D2A] text-white rounded-xl text-xs font-semibold hover:bg-[#D44D1E] transition-all"
              >
                Create Campaign
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {campaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="p-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#F9FAFB] text-[#667085] border border-[#E4E7EC]">
                        {camp.utmCampaign}
                      </span>
                      <button
                        onClick={() => void handleDeleteCampaign(camp.id, camp.name)}
                        className="p-1 text-[#667085] hover:text-red-600 transition-colors"
                        title="Delete Campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <h3 className="text-base font-bold mt-2.5 text-[#17202A]">{camp.name}</h3>
                    {camp.description && (
                      <p className="text-xs text-[#667085] mt-1 line-clamp-2">
                        {camp.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#E4E7EC] flex items-center justify-between text-xs text-[#667085]">
                    <span className="flex items-center gap-1.5">
                      <MousePointer className="h-3.5 w-3.5 text-[#E85D2A]" />
                      <strong className="text-[#17202A]">
                        {camp._count?.trackedClicks ?? 0}
                      </strong>{' '}
                      clicks
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#667085]" />
                      <strong className="text-[#17202A]">{camp._count?.posts ?? 0}</strong> posts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* UTM Tag Generator Utility (Right Col) */}
        <div className="p-6 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-[#E85D2A]" />
            <h2 className="text-lg font-bold text-[#17202A]">UTM Link Builder</h2>
          </div>
          <p className="text-xs text-[#667085] mb-4">
            Build attribution URLs that identify which channel, post, and campaign produced store
            revenue.
          </p>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                Destination Store URL
              </label>
              <input
                type="url"
                value={utmForm.baseUrl}
                onChange={(e) => setUtmForm({ ...utmForm, baseUrl: e.target.value })}
                className="w-full px-3 py-2 border border-[#E4E7EC] rounded-xl bg-white text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Source (utm_source)
                </label>
                <select
                  value={utmForm.utmSource}
                  onChange={(e) => setUtmForm({ ...utmForm, utmSource: e.target.value })}
                  className="w-full px-2.5 py-2 border border-[#E4E7EC] rounded-xl bg-white text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
                >
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="twitter">Twitter / X</option>
                  <option value="tiktok">TikTok</option>
                  <option value="pinterest">Pinterest</option>
                  <option value="newsletter">Newsletter</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Medium (utm_medium)
                </label>
                <select
                  value={utmForm.utmMedium}
                  onChange={(e) => setUtmForm({ ...utmForm, utmMedium: e.target.value })}
                  className="w-full px-2.5 py-2 border border-[#E4E7EC] rounded-xl bg-white text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
                >
                  <option value="stories">Stories</option>
                  <option value="post">Feed Post</option>
                  <option value="reel">Reel / Video</option>
                  <option value="carousel">Carousel</option>
                  <option value="bio_link">Link in Bio</option>
                  <option value="cpc">Paid Ad (CPC)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                Campaign (utm_campaign)
              </label>
              <input
                type="text"
                placeholder="e.g. spring-sale-2026"
                value={utmForm.utmCampaign}
                onChange={(e) => setUtmForm({ ...utmForm, utmCampaign: e.target.value })}
                className="w-full px-3 py-2 border border-[#E4E7EC] rounded-xl bg-white text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                Content Tag (utm_content)
              </label>
              <input
                type="text"
                placeholder="e.g. variant_a, hero_photo"
                value={utmForm.utmContent}
                onChange={(e) => setUtmForm({ ...utmForm, utmContent: e.target.value })}
                className="w-full px-3 py-2 border border-[#E4E7EC] rounded-xl bg-white text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
              />
            </div>

            {/* Generated URL Box */}
            <div className="pt-2">
              <label className="block font-semibold text-[#344054] mb-1 flex items-center justify-between">
                <span>Tagged Attribution URL</span>
                <span className="text-[10px] text-[#E85D2A]">URL Validated</span>
              </label>
              <div className="p-2.5 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] font-mono text-[11px] break-all select-all text-[#17202A] leading-relaxed">
                {generatedUrl || 'Enter valid base URL above'}
              </div>

              <button
                type="button"
                onClick={copyToClipboard}
                disabled={!generatedUrl}
                className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-[#E85D2A] text-white rounded-xl font-semibold text-xs hover:bg-[#D44D1E] transition-all disabled:opacity-50"
              >
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {isCopied ? 'Copied to Clipboard!' : 'Copy Tagged URL'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Campaign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-[#E4E7EC] relative animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-[#F2F4F7] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#E85D2A] flex items-center justify-center shrink-0">
                  <Flag className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17202A]">Create Marketing Campaign</h3>
                  <p className="text-xs text-[#667085] mt-0.5">
                    Set up a campaign to coordinate posts and track attribution across channels.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#667085] hover:text-[#17202A] hover:bg-[#F2F4F7] transition-all shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Summer Clearance Drop 2026"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    className="w-full rounded-xl border border-[#E4E7EC] px-4 py-2.5 text-sm text-[#17202A] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Goals, target products, or promotion terms..."
                    value={campaignForm.description}
                    onChange={(e) =>
                      setCampaignForm({ ...campaignForm, description: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#E4E7EC] px-4 py-2.5 text-sm text-[#17202A] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Custom UTM Slug (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated from name if blank"
                    value={campaignForm.utmCampaign}
                    onChange={(e) =>
                      setCampaignForm({
                        ...campaignForm,
                        utmCampaign: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
                      })
                    }
                    className="w-full rounded-xl border border-[#E4E7EC] px-4 py-2.5 text-sm text-[#17202A] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 font-mono shadow-xs"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="bg-[#F9FAFB] border-t border-[#F2F4F7] px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="border border-[#E4E7EC] text-[#344054] rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#F9FAFB] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-[#E85D2A] text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#D44D1E] transition-all flex items-center gap-2"
                >
                  {isCreating && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {isCreating ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
