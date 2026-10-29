'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  api,
  SuperAdminPlatformSetting,
  SuperAdminAnnouncement,
  SuperAdminEmailStatus,
  SuperAdminEmailVerificationResult,
  SuperAdminEmailTestResult,
} from '../../../lib/api';
import {
  Settings,
  Megaphone,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Radio,
  Mail,
  Send,
  Server,
  ShieldCheck,
} from 'lucide-react';

export default function SuperAdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'announcements' | 'email'>('settings');

  // Settings state
  const [settings, setSettings] = useState<SuperAdminPlatformSetting[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Announcements state
  const [announcements, setAnnouncements] = useState<SuperAdminAnnouncement[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState<boolean>(true);

  // Email state
  const [emailStatus, setEmailStatus] = useState<SuperAdminEmailStatus | null>(null);
  const [isLoadingEmail, setIsLoadingEmail] = useState<boolean>(false);
  const [testEmailTo, setTestEmailTo] = useState<string>('');
  const [testEmailProvider, setTestEmailProvider] = useState<string>('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false);
  const [testEmailResult, setTestEmailResult] = useState<SuperAdminEmailTestResult | null>(null);
  const [isVerifyingConnection, setIsVerifyingConnection] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<SuperAdminEmailVerificationResult | null>(null);

  // Feedback state
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Announcement Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [annTitle, setAnnTitle] = useState<string>('');
  const [annContent, setAnnContent] = useState<string>('');
  const [annAudience, setAnnAudience] = useState<string>('ALL');
  const [annIsPublished, setAnnIsPublished] = useState<boolean>(true);
  const [annExpiresAt, setAnnExpiresAt] = useState<string>('');
  const [isSubmittingAnn, setIsSubmittingAnn] = useState<boolean>(false);

  const fetchSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    setError(null);
    try {
      const data = await api.getSuperAdminPlatformSettings();
      setSettings(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch platform settings.');
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    setIsLoadingAnnouncements(true);
    setError(null);
    try {
      const data = await api.getSuperAdminAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch broadcast announcements.');
    } finally {
      setIsLoadingAnnouncements(false);
    }
  }, []);

  const fetchEmailStatus = useCallback(async () => {
    setIsLoadingEmail(true);
    try {
      const data = await api.getSuperAdminEmailStatus();
      setEmailStatus(data);
      setTestEmailProvider((prev) => prev || data.activeProvider);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch email status.');
    } finally {
      setIsLoadingEmail(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
    void fetchAnnouncements();
    void fetchEmailStatus();
  }, [fetchSettings, fetchAnnouncements, fetchEmailStatus]);

  const handleVerifyEmail = async () => {
    setIsVerifyingConnection(true);
    setVerificationResult(null);
    setError(null);
    try {
      const res = await api.verifySuperAdminEmailConnection(testEmailProvider || undefined);
      setVerificationResult(res);
    } catch (err) {
      setError((err as Error).message || 'Failed to verify email connection.');
    } finally {
      setIsVerifyingConnection(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailTo.trim()) {
      setError('Please provide a recipient email address.');
      return;
    }
    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    setError(null);
    try {
      const res = await api.sendSuperAdminTestEmail(testEmailTo.trim(), testEmailProvider || undefined);
      setTestEmailResult(res);
      setSuccessMessage(`Test email dispatched successfully via ${res.provider.toUpperCase()} (${res.latencyMs}ms).`);
      void fetchEmailStatus();
    } catch (err) {
      setError((err as Error).message || 'Failed to dispatch test email.');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleUpdateSetting = async (
    key: string,
    newValue: Record<string, unknown> | string | number | boolean,
  ) => {
    setSavingKey(key);
    setError(null);
    try {
      await api.updateSuperAdminPlatformSetting(key, { value: newValue });
      setSuccessMessage(`Platform setting "${key}" updated successfully.`);
      void fetchSettings();
    } catch (err) {
      setError((err as Error).message || `Failed to update setting "${key}".`);
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    setIsSubmittingAnn(true);
    setError(null);
    try {
      await api.createSuperAdminAnnouncement({
        title: annTitle.trim(),
        content: annContent.trim(),
        audience: annAudience,
        isPublished: annIsPublished,
        expiresAt: annExpiresAt ? new Date(annExpiresAt).toISOString() : undefined,
      });
      setSuccessMessage('Broadcast announcement published successfully.');
      setShowCreateModal(false);
      setAnnTitle('');
      setAnnContent('');
      setAnnAudience('ALL');
      setAnnIsPublished(true);
      setAnnExpiresAt('');
      void fetchAnnouncements();
    } catch (err) {
      setError((err as Error).message || 'Failed to publish announcement.');
    } finally {
      setIsSubmittingAnn(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this announcement?')) return;
    setError(null);
    try {
      await api.deleteSuperAdminAnnouncement(id);
      setSuccessMessage('Announcement deleted.');
      void fetchAnnouncements();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete announcement.');
    }
  };

  // Helper to extract typed values safely
  const getSettingObj = (key: string): Record<string, unknown> => {
    const s = settings.find((item) => item.key === key);
    if (s && typeof s.value === 'object' && s.value !== null) {
      return s.value as Record<string, unknown>;
    }
    return {};
  };

  const maintenanceMode = Boolean(getSettingObj('maintenance_mode').enabled);
  const publicRegistrations = Boolean(getSettingObj('allow_public_registrations').enabled ?? true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Platform Settings & Broadcasts
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
              Governance Fleet
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global system switches, emergency maintenance controls, and multi-tenant broadcast banners.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'announcements' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Announcement</span>
            </button>
          )}
          <button
            onClick={() => {
              void fetchSettings();
              void fetchAnnouncements();
            }}
            disabled={isLoadingSettings || isLoadingAnnouncements}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-800 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold transition-all shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoadingSettings || isLoadingAnnouncements ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-300 hover:text-slate-900 text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs flex items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-300 hover:text-slate-900 text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Switcher — Waymark Pill Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-800/40'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>System Settings & Feature Flags ({settings.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'announcements'
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-800/40'
          }`}
        >
          <Megaphone className="h-4 w-4" />
          <span>Broadcast Announcements ({announcements.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'email'
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-800/40'
          }`}
        >
          <Mail className="h-4 w-4" />
          <span>Email Delivery & Providers ({emailStatus?.activeProvider?.toUpperCase() || 'LOCAL'})</span>
        </button>
      </div>

      {/* Tab 1: System Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Quick Critical Switches — Waymark Bento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Maintenance Mode */}
            <div
              className={`p-5 rounded-2xl border transition-all shadow-lg backdrop-blur-xl relative overflow-hidden group ${
                maintenanceMode
                  ? 'bg-rose-950/20 border-rose-500/40'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-rose-500/10 blur-2xl group-hover:bg-rose-500/20 transition-all" />
              <div className="flex items-start justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">Platform Maintenance Mode</span>
                    {maintenanceMode && (
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    When enabled, consumer workspace access is immediately suspended while operator panels remain accessible.
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleUpdateSetting('maintenance_mode', {
                      enabled: !maintenanceMode,
                      message: 'NexusFlow is undergoing scheduled maintenance.',
                    })
                  }
                  disabled={savingKey === 'maintenance_mode'}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    maintenanceMode
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-700'
                  }`}
                >
                  {savingKey === 'maintenance_mode' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : maintenanceMode ? (
                    'Disable Maintenance'
                  ) : (
                    'Enable Maintenance'
                  )}
                </button>
              </div>
            </div>

            {/* Public Registration Switch */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-lg backdrop-blur-xl relative overflow-hidden group">
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all" />
              <div className="flex items-start justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">Allow Public Registrations</span>
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        publicRegistrations
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {publicRegistrations ? 'Open' : 'Restricted'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Control whether new users can self-register or if workspace creation requires operator invitation.
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleUpdateSetting('allow_public_registrations', {
                      enabled: !publicRegistrations,
                    })
                  }
                  disabled={savingKey === 'allow_public_registrations'}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-700 hover:text-slate-900 transition-all shrink-0 cursor-pointer"
                >
                  {savingKey === 'allow_public_registrations' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : publicRegistrations ? (
                    'Restrict Signups'
                  ) : (
                    'Allow Signups'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Settings Ledger Table — Waymark Glass Table */}
          <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm text-slate-900">Platform Settings Repository</h2>
                <p className="text-xs text-slate-500">Persisted runtime configuration variables and schema flags</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-mono text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Setting Key</th>
                    <th className="px-5 py-3.5">Description</th>
                    <th className="px-5 py-3.5">Value (JSON / Primitive)</th>
                    <th className="px-5 py-3.5">Scope</th>
                    <th className="px-5 py-3.5">Version & Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingSettings ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                        <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-indigo-400" />
                        Loading platform settings...
                      </td>
                    </tr>
                  ) : settings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                        No platform settings recorded.
                      </td>
                    </tr>
                  ) : (
                    settings.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-indigo-400">
                          {item.key}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 max-w-xs">
                          {item.description || '—'}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[11px] text-slate-800 max-w-xs break-all">
                          {typeof item.value === 'object'
                            ? JSON.stringify(item.value)
                            : String(item.value)}
                        </td>
                        <td className="px-5 py-3.5">
                          {item.isPublic ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              Public
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 border border-slate-700">
                              Internal
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                          <div>v{item.version} by {item.updatedBy || 'system'}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(item.updatedAt).toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Broadcast Announcements */}
      {activeTab === 'announcements' && (
        <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-md overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-slate-900">Broadcast Banners Fleet</h2>
              <p className="text-xs text-slate-500">In-app notifications broadcast to all workspace tenants</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-mono text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Title & Content</th>
                  <th className="px-5 py-3.5">Audience</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Created By</th>
                  <th className="px-5 py-3.5">Expiration</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingAnnouncements ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-indigo-400" />
                      Loading announcements...
                    </td>
                  </tr>
                ) : announcements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                      <Radio className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                      No broadcast announcements found. Click &quot;New Announcement&quot; to publish one.
                    </td>
                  </tr>
                ) : (
                  announcements.map((ann) => (
                    <tr key={ann.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 max-w-sm">
                        <div className="font-bold text-slate-900 text-sm">{ann.title}</div>
                        <div className="text-slate-500 text-xs mt-0.5 line-clamp-2">{ann.content}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 border border-slate-700">
                          {ann.audience}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {ann.isPublished ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200 border border-slate-700">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">{ann.createdBy}</td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                        {ann.expiresAt ? new Date(ann.expiresAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => void handleDeleteAnnouncement(ann.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-slate-900 hover:bg-rose-500/20 transition-all cursor-pointer"
                          title="Delete announcement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Multi-Provider Email Delivery & Diagnostics */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          {/* Email Provider Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Active Provider Card */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Active Provider
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                  emailStatus?.isConfigured
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {emailStatus?.isConfigured ? 'Operational' : 'Needs Config'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 uppercase">
                    {(emailStatus?.activeProvider || 'LOCAL').toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-500">Transactional Relay</p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <div>Sender: <span className="font-mono text-slate-800">{emailStatus?.fromAddress || '—'}</span></div>
                <div>Local Outbox Count: <span className="font-mono font-bold text-slate-900">{emailStatus?.outboxCount ?? 0}</span></div>
              </div>
            </div>

            {/* Supported Provider Fleet */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Supported Provider Fleet
                </span>
                {isLoadingEmail && (
                  <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                {[
                  { id: 'smtp', label: 'SMTP Relay', note: 'Nodemailer TLS/SSL' },
                  { id: 'brevo', label: 'Brevo (Sendinblue)', note: 'v3 REST API' },
                  { id: 'msg91', label: 'MSG91', note: 'v5 Email API' },
                  { id: 'resend', label: 'Resend', note: 'REST API' },
                  { id: 'local', label: 'Local Outbox', note: 'Standard Buffer' },
                ].map((p) => {
                  const isActive = (emailStatus?.activeProvider || 'local') === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        isActive
                          ? 'border-indigo-400 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-400'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                        <span>{p.label}</span>
                        {isActive && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">{p.note}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Verification & Live Test Tool */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Connection Health Check */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Provider Connection Health</h3>
                  <p className="text-xs text-slate-500">Ping credentials and verify socket/REST handshake</p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Provider to Verify
                  </label>
                  <select
                    value={testEmailProvider}
                    onChange={(e) => setTestEmailProvider(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                  >
                    <option value="">Active Default ({emailStatus?.activeProvider?.toUpperCase() || 'LOCAL'})</option>
                    <option value="smtp">SMTP Relay (nodemailer)</option>
                    <option value="brevo">Brevo (Sendinblue)</option>
                    <option value="msg91">MSG91</option>
                    <option value="resend">Resend</option>
                    <option value="local">Local In-Memory Outbox</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => void handleVerifyEmail()}
                  disabled={isVerifyingConnection}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isVerifyingConnection ? 'animate-spin' : ''}`} />
                  <span>{isVerifyingConnection ? 'Verifying Handshake…' : 'Run Connection Test'}</span>
                </button>

                {verificationResult && (
                  <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                    verificationResult.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span>{verificationResult.ok ? 'Connection Verified' : 'Connection Failed'}</span>
                      <span className="font-mono text-[11px]">{verificationResult.latencyMs}ms</span>
                    </div>
                    <p>{verificationResult.message}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Live Test Email Sender */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Transactional Dispatch Sandbox</h3>
                  <p className="text-xs text-slate-500">Send an authentic test email to any recipient</p>
                </div>
              </div>

              <form onSubmit={handleSendTestEmail} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Recipient Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    placeholder="admin@yourcompany.com"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSendingTestEmail || !testEmailTo.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isSendingTestEmail ? 'Dispatching Message…' : 'Send Test Email'}</span>
                </button>

                {testEmailResult && (
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span>Delivered via {testEmailResult.provider.toUpperCase()}</span>
                      <span className="font-mono text-[11px]">{testEmailResult.latencyMs}ms</span>
                    </div>
                    <div className="font-mono text-[11px] truncate">ID: {testEmailResult.id}</div>
                    <div className="text-[10px] text-emerald-700">{new Date(testEmailResult.timestamp).toLocaleString()}</div>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 backdrop-blur-2xl">
            <div className="flex items-center gap-3 text-indigo-400">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <Megaphone className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Create Broadcast Announcement</h3>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="e.g., Scheduled Maintenance Notification"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Content Message
                </label>
                <textarea
                  required
                  rows={4}
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Broadcast message shown on all workspace dashboards..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Audience Scope
                  </label>
                  <select
                    value={annAudience}
                    onChange={(e) => setAnnAudience(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                  >
                    <option value="ALL">All Tenants</option>
                    <option value="FREE">Free Tier Only</option>
                    <option value="PAID">Paid Tiers Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={annExpiresAt}
                    onChange={(e) => setAnnExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="publishNow"
                  checked={annIsPublished}
                  onChange={(e) => setAnnIsPublished(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="publishNow" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Publish immediately to active tenant dashboards
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmittingAnn}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAnn || !annTitle.trim() || !annContent.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white transition disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-indigo-500/20 cursor-pointer font-bold"
                >
                  {isSubmittingAnn ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Publishing...
                    </>
                  ) : (
                    'Broadcast Announcement'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      
    </div>
  );
}
