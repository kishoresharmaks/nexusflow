'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { ProtectedRoute } from '../../components/protected-route';
import {
  api,
  type CampaignItem,
  type CreateCampaignPayload,
  type GenerateUtmUrlPayload,
  type TrackingLinkItem,
} from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';
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
  Edit2,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  ExternalLink,
  Link as LinkIcon,
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
  const [trackingLinks, setTrackingLinks] = useState<TrackingLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignItem | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isCreatingTrackingLink, setIsCreatingTrackingLink] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Campaign Form State
  const [campaignForm, setCampaignForm] = useState<CreateCampaignPayload>({
    name: '',
    description: '',
    utmCampaign: '',
    startDate: '',
    endDate: '',
  });

  // Edit Campaign Form State
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    utmCampaign: string;
    startDate: string;
    endDate: string;
  }>({
    name: '',
    description: '',
    utmCampaign: '',
    startDate: '',
    endDate: '',
  });

  // UTM Generator State
  const [utmForm, setUtmForm] = useState<GenerateUtmUrlPayload & { campaignId?: string }>({
    baseUrl: 'https://example.com/products/summer-collection',
    utmSource: 'instagram',
    utmMedium: 'stories',
    utmCampaign: '',
    utmContent: 'promo_reel_v1',
    utmTerm: '',
    campaignId: '',
  });
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [createdTrackingLink, setCreatedTrackingLink] = useState<TrackingLinkItem | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isTrackingCopied, setIsTrackingCopied] = useState<boolean>(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    setError(null);
    try {
      const [campList, linkList] = await Promise.all([
        api.getCampaigns(currentWorkspace.id),
        api.getTrackingLinks(currentWorkspace.id),
      ]);
      setCampaigns(campList);
      setTrackingLinks(linkList);

      if (campList.length > 0 && !utmForm.utmCampaign) {
        const first = campList[0];
        setUtmForm((prev) => ({
          ...prev,
          campaignId: first?.id || '',
          utmCampaign:
            first?.utmCampaign || first?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '',
        }));
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to load campaigns.');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, utmForm.utmCampaign]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Update generated URL preview on form change
  useEffect(() => {
    if (!currentWorkspace || !utmForm.baseUrl) return;
    try {
      const url = new URL(utmForm.baseUrl);
      url.searchParams.set('utm_source', utmForm.utmSource);
      url.searchParams.set('utm_medium', utmForm.utmMedium);
      if (utmForm.utmCampaign) url.searchParams.set('utm_campaign', utmForm.utmCampaign);
      if (utmForm.utmContent) url.searchParams.set('utm_content', utmForm.utmContent);
      if (utmForm.utmTerm) url.searchParams.set('utm_term', utmForm.utmTerm);
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
        ...(campaignForm.startDate ? { startDate: new Date(campaignForm.startDate).toISOString() } : {}),
        ...(campaignForm.endDate ? { endDate: new Date(campaignForm.endDate).toISOString() } : {}),
        ...(campaignForm.utmCampaign ? { utmCampaign: campaignForm.utmCampaign } : {}),
      });

      setSuccessMessage(`Created campaign "${created.name}"!`);
      setIsModalOpen(false);
      setCampaignForm({ name: '', description: '', utmCampaign: '', startDate: '', endDate: '' });
      await loadData();
    } catch (err) {
      setError((err as Error).message || 'Failed to create campaign.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditModal = (camp: CampaignItem) => {
    setEditingCampaign(camp);
    setEditForm({
      name: camp.name,
      description: camp.description || '',
      utmCampaign: camp.utmCampaign || '',
      startDate: camp.startDate ? camp.startDate.slice(0, 10) : '',
      endDate: camp.endDate ? camp.endDate.slice(0, 10) : '',
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !editingCampaign) return;

    setIsUpdating(true);
    setError(null);
    try {
      const updated = await api.updateCampaign(currentWorkspace.id, editingCampaign.id, {
        name: editForm.name,
        description: editForm.description,
        utmCampaign: editForm.utmCampaign,
        ...(editForm.startDate ? { startDate: new Date(editForm.startDate).toISOString() } : {}),
        ...(editForm.endDate ? { endDate: new Date(editForm.endDate).toISOString() } : {}),
      });

      setSuccessMessage(`Updated campaign "${updated.name}"!`);
      setIsEditModalOpen(false);
      setEditingCampaign(null);
      await loadData();
    } catch (err) {
      setError((err as Error).message || 'Failed to update campaign.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!currentWorkspace) return;
    if (!confirm(`Are you sure you want to delete campaign "${name}"?`)) return;

    try {
      await api.deleteCampaign(currentWorkspace.id, id);
      setSuccessMessage(`Deleted campaign "${name}".`);
      await loadData();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete campaign.');
    }
  };

  const handleCreateTrackingLink = async () => {
    if (!currentWorkspace || !utmForm.baseUrl) return;
    setIsCreatingTrackingLink(true);
    setError(null);
    try {
      const link = await api.createTrackingLink(currentWorkspace.id, {
        destinationUrl: utmForm.baseUrl,
        utmSource: utmForm.utmSource,
        utmMedium: utmForm.utmMedium,
        utmCampaign: utmForm.utmCampaign || undefined,
        utmContent: utmForm.utmContent || undefined,
        utmTerm: utmForm.utmTerm || undefined,
        campaignId: utmForm.campaignId || undefined,
      });

      setCreatedTrackingLink(link);
      setSuccessMessage(`Public tracking link generated: ${link.shortCode}`);
      // Refresh tracking links list
      const updatedLinks = await api.getTrackingLinks(currentWorkspace.id);
      setTrackingLinks(updatedLinks);
    } catch (err) {
      setError((err as Error).message || 'Failed to generate tracking link.');
    } finally {
      setIsCreatingTrackingLink(false);
    }
  };

  const copyToClipboard = async (
    text: string,
    rowLinkId?: string,
    isTrackingGen: boolean = false,
  ) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      if (rowLinkId) {
        setCopiedLinkId(rowLinkId);
        setTimeout(() => setCopiedLinkId(null), 2000);
        setSuccessMessage(`Copied link to clipboard: ${text}`);
      } else if (isTrackingGen) {
        setIsTrackingCopied(true);
        setTimeout(() => setIsTrackingCopied(false), 2000);
        setSuccessMessage(`Copied tracking link to clipboard!`);
      } else {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        setSuccessMessage(`Copied URL to clipboard!`);
      }
    } catch (err) {
      setError('Failed to copy to clipboard: ' + (err as Error).message);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between pb-6 border-b border-[#E4E7EC] gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-[#E85D2A] flex items-center justify-center shrink-0 shadow-sm">
            <Flag className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[#17202A]">
                Marketing Campaigns & Attribution Engine
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
                Verified Attribution
              </span>
            </div>
            <p className="text-sm text-[#667085] mt-1">
              Organize multi-channel marketing campaigns, generate public tracked redirect links, and attribute verified store orders with zero fake metrics.
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

      {/* Grid: Campaigns List + UTM & Tracking Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Campaigns List (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2 text-[#17202A]">
              <span>Active Campaigns</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#E85D2A]/10 text-[#E85D2A] font-bold">
                {campaigns.length}
              </span>
            </h2>
            <button
              onClick={() => void loadData()}
              className="text-xs text-[#667085] hover:text-[#17202A] flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-[#667085] border-2 border-dashed border-[#E4E7EC] rounded-2xl bg-white">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#E85D2A]" />
              Loading campaigns and attribution metrics...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-[#E4E7EC] rounded-2xl bg-white">
              <Flag className="h-10 w-10 text-[#667085] mx-auto mb-3" />
              <h3 className="font-semibold text-base text-[#17202A]">No campaigns created yet</h3>
              <p className="text-xs text-[#667085] max-w-sm mx-auto mt-1 mb-4">
                Create a campaign to organize seasonal sales, product drops, or multi-channel acquisition funnels.
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
              {campaigns.map((camp) => {
                const clicks = camp.metrics?.clicks ?? camp._count?.trackedClicks ?? 0;
                const conversions = camp.metrics?.conversions ?? camp._count?.conversions ?? 0;
                const revenueCents = camp.metrics?.revenueCents ?? 0;
                const conversionRate = camp.metrics?.conversionRate ?? 0;

                return (
                  <div
                    key={camp.id}
                    className="p-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm flex flex-col justify-between hover:border-[#D0D5DD] transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#F9FAFB] text-[#667085] border border-[#E4E7EC]">
                          {camp.utmCampaign || 'auto-slug'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(camp)}
                            className="p-1 text-[#667085] hover:text-[#17202A] transition-colors"
                            title="Edit Campaign"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => void handleDeleteCampaign(camp.id, camp.name)}
                            className="p-1 text-[#667085] hover:text-red-600 transition-colors"
                            title="Delete Campaign"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-base font-bold mt-2 text-[#17202A]">{camp.name}</h3>
                      {camp.description && (
                        <p className="text-xs text-[#667085] mt-1 line-clamp-2">
                          {camp.description}
                        </p>
                      )}

                      {/* Performance Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-[#F9FAFB] rounded-xl border border-[#F2F4F7] text-xs">
                        <div className="flex items-center gap-2">
                          <MousePointer className="h-4 w-4 text-[#E85D2A] shrink-0" />
                          <div>
                            <p className="text-[10px] text-[#667085] uppercase font-semibold">Clicks</p>
                            <p className="text-xs font-bold text-[#17202A]">{clicks}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4 text-[#027A48] shrink-0" />
                          <div>
                            <p className="text-[10px] text-[#667085] uppercase font-semibold">Orders</p>
                            <p className="text-xs font-bold text-[#17202A]">{conversions}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-[#175CD3] shrink-0" />
                          <div>
                            <p className="text-[10px] text-[#667085] uppercase font-semibold">Revenue</p>
                            <p className="text-xs font-bold text-[#17202A]">
                              {formatCurrency(
                                revenueCents,
                                currentWorkspace?.currency || 'USD',
                                currentWorkspace?.locale || 'en-US',
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-[#7A5AF8] shrink-0" />
                          <div>
                            <p className="text-[10px] text-[#667085] uppercase font-semibold">Conv. Rate</p>
                            <p className="text-xs font-bold text-[#17202A]">{conversionRate}%</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E4E7EC] flex items-center justify-between text-xs text-[#667085]">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-[#667085]" />
                        <strong className="text-[#17202A]">{camp._count?.posts ?? 0}</strong> posts
                      </span>

                      <button
                        onClick={() => {
                          setUtmForm((prev) => ({
                            ...prev,
                            campaignId: camp.id,
                            utmCampaign: camp.utmCampaign || camp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                          }));
                        }}
                        className="text-[11px] font-semibold text-[#E85D2A] hover:underline flex items-center gap-1"
                      >
                        <LinkIcon className="h-3 w-3" /> Track Link
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Generated Tracking Links Table */}
          {trackingLinks.length > 0 && (
            <div className="mt-8 bg-white border border-[#E4E7EC] rounded-2xl p-5 shadow-sm">
              <h3 className="text-base font-bold text-[#17202A] mb-3 flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-[#E85D2A]" />
                <span>Active Tracked Redirect Links ({trackingLinks.length})</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E7EC] text-[#667085] font-semibold">
                      <th className="pb-2">Short Link</th>
                      <th className="pb-2">Target Destination</th>
                      <th className="pb-2">Campaign</th>
                      <th className="pb-2">Channel</th>
                      <th className="pb-2 text-right">Live Clicks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F4F7]">
                    {trackingLinks.slice(0, 10).map((link) => {
                      const linkTargetUrl =
                        link.shortUrl ||
                        (typeof window !== 'undefined'
                          ? `${window.location.protocol}//${window.location.hostname}:4000/api/v1/t/${link.shortCode}`
                          : `/api/v1/t/${link.shortCode}`);
                      const isRowCopied = copiedLinkId === link.id;

                      return (
                        <tr key={link.id} className="hover:bg-[#F9FAFB]">
                          <td className="py-2.5 font-mono text-[#E85D2A] font-semibold">
                            <button
                              type="button"
                              onClick={() => void copyToClipboard(linkTargetUrl, link.id)}
                              className="cursor-pointer hover:underline flex items-center gap-1.5 text-left focus:outline-none group"
                              title={`Click to copy: ${linkTargetUrl}`}
                            >
                              <span>/t/{link.shortCode}</span>
                              {isRowCopied ? (
                                <Check className="h-3.5 w-3.5 text-[#027A48]" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-[#667085] group-hover:text-[#17202A]" />
                              )}
                              {isRowCopied && (
                                <span className="text-[10px] text-[#027A48] font-semibold bg-[#ECFDF3] px-1.5 py-0.5 rounded border border-[#A6F4C5]">
                                  Copied!
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 max-w-[200px] truncate text-[#667085]" title={link.destinationUrl}>
                            {link.destinationUrl}
                          </td>
                          <td className="py-2.5 font-medium text-[#17202A]">
                            {link.campaign?.name || link.utmCampaign || '—'}
                          </td>
                          <td className="py-2.5 capitalize text-[#667085]">
                            {link.utmSource} / {link.utmMedium}
                          </td>
                          <td className="py-2.5 text-right font-bold text-[#17202A]">
                            {link.clickCount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* UTM & Public Tracking Link Generator Utility (Right Col) */}
        <div className="p-6 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-[#E85D2A]" />
            <h2 className="text-lg font-bold text-[#17202A]">Tracking Link Builder</h2>
          </div>
          <p className="text-xs text-[#667085] mb-4">
            Generate safe public tracking URLs that automatically log visitor clicks and attribute Shopify order revenue.
          </p>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                Link to Campaign
              </label>
              <select
                value={utmForm.campaignId || ''}
                onChange={(e) => {
                  const campId = e.target.value;
                  const matched = campaigns.find((c) => c.id === campId);
                  setUtmForm({
                    ...utmForm,
                    campaignId: campId,
                    utmCampaign: matched?.utmCampaign || matched?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '',
                  });
                }}
                className="w-full px-2.5 py-2 border border-[#E4E7EC] rounded-xl bg-white text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs cursor-pointer"
              >
                <option value="">No campaign attached</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.utmCampaign || 'auto'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#344054] mb-1">
                Destination Store URL
              </label>
              <input
                type="url"
                value={utmForm.baseUrl}
                onChange={(e) => setUtmForm({ ...utmForm, baseUrl: e.target.value })}
                placeholder="https://yourstore.com/products/item"
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
                Campaign Slug (utm_campaign)
              </label>
              <input
                type="text"
                placeholder="e.g. spring-sale-2026"
                value={utmForm.utmCampaign}
                onChange={(e) => setUtmForm({ ...utmForm, utmCampaign: e.target.value })}
                className="w-full px-3 py-2 border border-[#E4E7EC] rounded-xl bg-white text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Content Tag (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. variant_a"
                  value={utmForm.utmContent}
                  onChange={(e) => setUtmForm({ ...utmForm, utmContent: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E4E7EC] rounded-xl bg-white text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#344054] mb-1">
                  Term / Keyword (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. snowboards"
                  value={utmForm.utmTerm || ''}
                  onChange={(e) => setUtmForm({ ...utmForm, utmTerm: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E4E7EC] rounded-xl bg-white text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
                />
              </div>
            </div>

            {/* Public Redirect Generator Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCreateTrackingLink}
                disabled={isCreatingTrackingLink || !utmForm.baseUrl}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#17202A] text-white rounded-xl font-semibold text-xs hover:bg-[#2C3847] transition-all disabled:opacity-50 shadow-sm"
              >
                {isCreatingTrackingLink ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {isCreatingTrackingLink ? 'Generating Link...' : 'Generate Public Tracking Link'}
              </button>
            </div>

            {/* Generated Public Short Tracking Link */}
            {createdTrackingLink && (
              <div className="p-3 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] mt-2 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#027A48]">
                  <span>Tracked Redirect URL</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-[#A6F4C5]">
                    {createdTrackingLink.shortCode}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#027A48] break-all select-all bg-white p-2 rounded-lg border border-[#A6F4C5]/50">
                  {createdTrackingLink.shortUrl}
                </div>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(createdTrackingLink.shortUrl, undefined, true)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-[#027A48] text-white rounded-lg font-semibold text-xs hover:bg-[#015C38] transition-all"
                >
                  {isTrackingCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {isTrackingCopied ? 'Tracking Link Copied!' : 'Copy Tracked Link'}
                </button>
              </div>
            )}

            {/* Tagged Raw URL Preview Box */}
            <div className="pt-2 border-t border-[#F2F4F7]">
              <label className="block font-semibold text-[#344054] mb-1 flex items-center justify-between">
                <span>Standard Tagged Destination URL</span>
                <span className="text-[10px] text-[#667085]">Direct UTM</span>
              </label>
              <div className="p-2.5 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] font-mono text-[11px] break-all select-all text-[#17202A] leading-relaxed">
                {generatedUrl || 'Enter valid destination URL above'}
              </div>

              <button
                type="button"
                onClick={() => void copyToClipboard(generatedUrl, undefined, false)}
                disabled={!generatedUrl}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-[#F2F4F7] text-[#344054] rounded-xl font-semibold text-xs hover:bg-[#E4E7EC] transition-all disabled:opacity-50"
              >
                {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
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
                    Set up a campaign to coordinate posts and attribute verified customer revenue.
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                      Start Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={campaignForm.startDate}
                      onChange={(e) => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                      className="w-full rounded-xl border border-[#E4E7EC] px-3 py-2 text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={campaignForm.endDate}
                      onChange={(e) => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
                      className="w-full rounded-xl border border-[#E4E7EC] px-3 py-2 text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
                    />
                  </div>
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

      {/* Edit Campaign Modal */}
      {isEditModalOpen && editingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-[#E4E7EC] relative animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-[#F2F4F7] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#E85D2A] flex items-center justify-center shrink-0">
                  <Edit2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#17202A]">Edit Campaign</h3>
                  <p className="text-xs text-[#667085] mt-0.5">
                    Update campaign details, dates, and tracking identifiers.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-[#667085] hover:text-[#17202A] hover:bg-[#F2F4F7] transition-all shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCampaign}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full rounded-xl border border-[#E4E7EC] px-4 py-2.5 text-sm text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full rounded-xl border border-[#E4E7EC] px-4 py-2.5 text-sm text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="w-full rounded-xl border border-[#E4E7EC] px-3 py-2 text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      className="w-full rounded-xl border border-[#E4E7EC] px-3 py-2 text-xs text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    UTM Campaign Slug
                  </label>
                  <input
                    type="text"
                    value={editForm.utmCampaign}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        utmCampaign: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
                      })
                    }
                    className="w-full rounded-xl border border-[#E4E7EC] px-4 py-2.5 text-sm text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 font-mono shadow-xs"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="bg-[#F9FAFB] border-t border-[#F2F4F7] px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="border border-[#E4E7EC] text-[#344054] rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#F9FAFB] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-[#E85D2A] text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#D44D1E] transition-all flex items-center gap-2"
                >
                  {isUpdating && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
