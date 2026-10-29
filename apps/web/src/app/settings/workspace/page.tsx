'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/auth-context';
import { api } from '../../../lib/api';
import { SettingsLayout } from '../../../components/settings-layout';
import {
  Building2,
  Save,
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  Sparkles,
  Upload,
  Trash2,
  ImageIcon,
} from 'lucide-react';
import {
  COMMON_TIMEZONES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALES,
  formatCurrency,
  formatDateTime,
  getBrowserTimezone,
  getDefaultLocaleForCurrency,
  isValidTimezone,
} from '../../../lib/formatters';

export default function WorkspaceSettingsPage() {
  const { currentWorkspace, refreshWorkspaces } = useAuth();

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [locale, setLocale] = useState('en-US');
  const [currency, setCurrency] = useState('USD');

  const [isSaving, setIsSaving] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Keep a reference to current preview timestamp
  const [previewDate] = useState(() => new Date());

  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name || '');
      setSlug(currentWorkspace.slug || '');
      if (currentWorkspace.timezone) setTimezone(currentWorkspace.timezone);
      if (currentWorkspace.locale) setLocale(currentWorkspace.locale);
      if (currentWorkspace.currency) setCurrency(currentWorkspace.currency);
      setLogoUrl(currentWorkspace.logoUrl ?? null);
    }
  }, [currentWorkspace]);

  const handleCurrencyChange = (newCurrency: string) => {
    const oldCurrency = currency;
    setCurrency(newCurrency);
    // If locale was default for old currency, automatically update to default for new currency
    const oldDefaultLocale = getDefaultLocaleForCurrency(oldCurrency);
    if (locale === oldDefaultLocale || !locale) {
      setLocale(getDefaultLocaleForCurrency(newCurrency));
    }
  };

  const handleDetectBrowserTimezone = () => {
    const detectedTz = getBrowserTimezone();
    if (isValidTimezone(detectedTz)) {
      setTimezone(detectedTz);
      setStatusMessage({
        type: 'success',
        text: `Detected browser timezone: ${detectedTz}`,
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: `Detected timezone (${detectedTz}) is not recognized. Please select from the dropdown.`,
      });
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace?.id) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setStatusMessage({ type: 'error', text: 'Unsupported image format. Please select a PNG, JPEG, or WebP file.' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'Image exceeds maximum size limit of 5MB.' });
      return;
    }

    setUploadingLogo(true);
    setStatusMessage(null);
    try {
      const asset = await api.uploadLocalMediaAsset(currentWorkspace.id, file);
      setLogoUrl(asset.url ?? null);
      await api.updateWorkspaceSettings(currentWorkspace.id, { logoUrl: asset.url ?? null });
      await refreshWorkspaces();
      setStatusMessage({ type: 'success', text: 'Workspace brand logo uploaded successfully.' });
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to upload workspace logo.' });
    } finally {
      if (isMountedRef.current) {
        setUploadingLogo(false);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentWorkspace?.id) return;
    setUploadingLogo(true);
    setStatusMessage(null);
    try {
      setLogoUrl(null);
      await api.updateWorkspaceSettings(currentWorkspace.id, { logoUrl: null });
      await refreshWorkspaces();
      setStatusMessage({ type: 'success', text: 'Workspace logo removed.' });
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to remove workspace logo.' });
    } finally {
      if (isMountedRef.current) {
        setUploadingLogo(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace?.id) return;

    setIsSaving(true);
    setStatusMessage(null);
    try {
      await api.updateWorkspaceSettings(currentWorkspace.id, {
        name: name.trim(),
        timezone,
        locale: locale.trim() || 'en-US',
        currency,
      });

      setStatusMessage({
        type: 'success',
        text: 'Workspace localization and business parameters updated successfully.',
      });
      await refreshWorkspaces();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update workspace settings.',
      });
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  // Ensure current timezone is available in the options
  const timezoneOptions = [...COMMON_TIMEZONES];
  if (timezone && !timezoneOptions.some((tz) => tz.id === timezone)) {
    timezoneOptions.unshift({
      id: timezone,
      label: `${timezone} (Current)`,
      region: 'Custom',
    });
  }

  // Ensure current locale is available in the options
  const localeOptions = [...SUPPORTED_LOCALES];
  if (locale && !localeOptions.some((l) => l.code === locale)) {
    localeOptions.unshift({
      code: locale,
      label: `${locale} (Custom)`,
    });
  }

  return (
    <SettingsLayout
      title="Workspace Configuration"
      description="Manage business parameters, timezone localization, and display preferences across the NexusFlow portal."
    >
      <div className="max-w-2xl">
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
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="font-semibold">{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 ml-4 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General business profile */}
          <div className="bg-white border border-[#E4E7EC] rounded-2xl p-6 shadow-xs space-y-5">
            <h2 className="text-sm font-bold text-[#17202A] flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-[#E85D2A]" />
              <span>Workspace Profile</span>
            </h2>

            {/* Workspace Logo / Brand Avatar */}
            <div>
              <label className="block text-xs font-bold text-[#17202A] mb-2">
                Workspace Brand Logo / Avatar
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="relative">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={`${name} Logo`}
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF4F17]/10 to-orange-100 border border-orange-200/70 flex items-center justify-center text-[#FF4F17] font-extrabold text-xl shadow-2xs font-display">
                      {name ? name.slice(0, 2).toUpperCase() : 'WS'}
                    </div>
                  )}
                  {uploadingLogo && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs rounded-2xl flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-[#FF4F17] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => void handleLogoFileChange(e)}
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>{uploadingLogo ? 'Uploading…' : logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        disabled={uploadingLogo}
                        onClick={() => void handleRemoveLogo()}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    PNG, JPG or WebP up to 5MB. Displayed across the portal, navigation, and export documents.
                  </p>
                </div>
              </div>
            </div>

            {/* Workspace Name */}
            <div>
              <label htmlFor="ws-name" className="block text-xs font-bold text-[#17202A] mb-1">
                Workspace Business Name
              </label>
              <input
                id="ws-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all"
                placeholder="e.g. Acme Commerce Brand"
              />
              <p className="text-[11px] text-[#667085] mt-1">
                Display name shown in headers, team invitations, and social publisher tags.
              </p>
            </div>

            {/* Slug (Read-only) */}
            <div>
              <label htmlFor="ws-slug" className="block text-xs font-bold text-[#17202A] mb-1">
                Workspace URL Identifier (Slug)
              </label>
              <input
                id="ws-slug"
                type="text"
                value={slug}
                disabled
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] text-[#667085] cursor-not-allowed font-mono"
              />
              <p className="text-[11px] text-[#667085] mt-1">
                Permanent URL slug for workspace isolation. Contact support for workspace rename migrations.
              </p>
            </div>
          </div>

          {/* Regional & Localization Settings */}
          <div className="bg-white border border-[#E4E7EC] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#17202A] flex items-center space-x-2">
                <Globe className="w-4 h-4 text-[#E85D2A]" />
                <span>Regional & Localization Management</span>
              </h2>
              <span className="text-[11px] text-[#667085]">Used across Catalog, Studio & Analytics</span>
            </div>

            {/* Timezone */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="ws-tz" className="block text-xs font-bold text-[#17202A]">
                  Operational Timezone
                </label>
                <button
                  type="button"
                  onClick={handleDetectBrowserTimezone}
                  className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#E85D2A] hover:underline"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Detect My Timezone</span>
                </button>
              </div>
              <select
                id="ws-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all"
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label}
                  </option>
                ))}
              </select>

              {/* Timezone warning callout */}
              <div className="mt-2.5 p-3 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 flex items-start space-x-2">
                <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  <span className="font-bold">Important schedule notice:</span> Changing timezone
                  determines how future schedule pickers and calendar views interpret your local times.
                  All backend database records remain stored in immutable UTC.
                </p>
              </div>
            </div>

            {/* Currency & Locale */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ws-currency" className="block text-xs font-bold text-[#17202A] mb-1">
                  Default Store Currency
                </label>
                <select
                  id="ws-currency"
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name} ({c.symbol})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#667085] mt-1">
                  Used for catalog pricing, AI ad copy, and revenue analytics.
                </p>
              </div>

              <div>
                <label htmlFor="ws-locale" className="block text-xs font-bold text-[#17202A] mb-1">
                  Regional Locale & Number Formatting
                </label>
                <select
                  id="ws-locale"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all"
                >
                  {localeOptions.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#667085] mt-1">
                  Controls commas, decimals, and date formatting.
                </p>
              </div>
            </div>

            {/* Live Localization Preview */}
            <div className="mt-4 p-4 rounded-xl bg-[#F9FAFB] border border-[#E4E7EC]">
              <div className="text-[11px] font-bold text-[#344054] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E85D2A]" />
                <span>Live Portal Formatting Preview</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-[#E4E7EC]">
                  <span className="text-[10px] text-[#667085] block">Sample Catalog Price (88,595 cents)</span>
                  <span className="text-base font-bold text-[#17202A] mt-0.5 block">
                    {formatCurrency(88595, currency, locale)}
                  </span>
                  <span className="text-[10px] text-[#667085]">
                    Formatted using {currency} with {locale} rules
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-[#E4E7EC]">
                  <span className="text-[10px] text-[#667085] block">Current Operational Time</span>
                  <span className="text-sm font-semibold text-[#17202A] mt-0.5 block truncate">
                    {formatDateTime(previewDate, timezone, locale, 'medium')}
                  </span>
                  <span className="text-[10px] text-[#667085]">
                    Timezone: {timezone}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#E85D2A] text-white text-xs font-bold rounded-xl hover:bg-[#d44c1b] transition-all shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving Changes…' : 'Save Workspace Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </SettingsLayout>
  );
}
