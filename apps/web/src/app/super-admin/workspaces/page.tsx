'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  api,
  SuperAdminWorkspaceItem,
  SuperAdminWorkspacesResponse,
  SuperAdminWorkspaceDetails,
} from '../../../lib/api';
import {
  Building2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Sliders,
  Store,
  Users,
  Clock,
  Ban,
  RotateCcw,
  Trash2,
} from 'lucide-react';

export default function SuperAdminWorkspacesPage() {
  const [workspacesResponse, setWorkspacesResponse] = useState<SuperAdminWorkspacesResponse | null>(null);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Inspector Modal
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaceDetails, setWorkspaceDetails] = useState<SuperAdminWorkspaceDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Limits Modal
  const [limitsWorkspace, setLimitsWorkspace] = useState<SuperAdminWorkspaceItem | null>(null);
  const [selectedPlanTier, setSelectedPlanTier] = useState<string>('FREE');
  const [quotaPosts, setQuotaPosts] = useState<number>(100);
  const [quotaMembers, setQuotaMembers] = useState<number>(5);
  const [quotaSocialAccounts, setQuotaSocialAccounts] = useState<number>(3);
  const [quotaAiTokens, setQuotaAiTokens] = useState<number>(500000);

  // Action Modals
  const [suspendModalWorkspace, setSuspendModalWorkspace] = useState<SuperAdminWorkspaceItem | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string>('');
  const [confirmReactivateWorkspace, setConfirmReactivateWorkspace] = useState<SuperAdminWorkspaceItem | null>(null);
  // Purge Modal State
  const [purgeModalWorkspace, setPurgeModalWorkspace] = useState<SuperAdminWorkspaceItem | null>(null);
  const [purgeConfirmSlug, setPurgeConfirmSlug] = useState<string>('');
  const [purgeReason, setPurgeReason] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  const handlePurgeWorkspace = async () => {
    if (!purgeModalWorkspace) return;
    if (purgeConfirmSlug.trim() !== purgeModalWorkspace.slug.trim()) {
      setError(`Confirmation slug must match "${purgeModalWorkspace.slug}".`);
      return;
    }
    setIsSubmittingAction(true);
    setError(null);
    try {
      const res = await api.purgeSuperAdminWorkspace(
        purgeModalWorkspace.id,
        purgeConfirmSlug.trim(),
        purgeReason.trim() || undefined,
      );
      setSuccessMessage(`Workspace "${res.workspaceName}" was permanently purged (GDPR/CCPA cascade complete).`);
      setPurgeModalWorkspace(null);
      setPurgeConfirmSlug('');
      setPurgeReason('');
      await fetchWorkspaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to permanently purge workspace.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSuperAdminWorkspaces({
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        planTier: planFilter !== 'ALL' ? planFilter : undefined,
      });
      setWorkspacesResponse(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch workspaces.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter, planFilter]);

  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  const openWorkspaceDetails = async (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setIsLoadingDetails(true);
    try {
      const details = await api.getSuperAdminWorkspaceDetails(workspaceId);
      setWorkspaceDetails(details);
    } catch (err) {
      setError((err as Error).message || 'Failed to load workspace details.');
      setSelectedWorkspaceId(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const openLimitsModal = (ws: SuperAdminWorkspaceItem) => {
    setLimitsWorkspace(ws);
    setSelectedPlanTier(ws.planTier || 'FREE');
    const q = (ws.customQuotas || {}) as Record<string, number>;
    setQuotaPosts(q.maxPostsPerMonth ?? (ws.planTier === 'ENTERPRISE' ? 2500 : ws.planTier === 'GROWTH' ? 500 : 100));
    setQuotaMembers(q.maxMembers ?? (ws.planTier === 'ENTERPRISE' ? 50 : ws.planTier === 'GROWTH' ? 15 : 3));
    setQuotaSocialAccounts(q.maxSocialAccounts ?? (ws.planTier === 'ENTERPRISE' ? 25 : ws.planTier === 'GROWTH' ? 10 : 3));
    setQuotaAiTokens(q.monthlyAiTokens ?? (ws.planTier === 'ENTERPRISE' ? 5000000 : ws.planTier === 'GROWTH' ? 1000000 : 200000));
  };

  const handleSaveLimits = async () => {
    if (!limitsWorkspace) return;
    setIsSubmittingAction(true);
    setError(null);
    try {
      await api.updateSuperAdminWorkspaceLimits(limitsWorkspace.id, {
        planTier: selectedPlanTier,
        customQuotas: {
          maxPostsPerMonth: Number(quotaPosts),
          maxMembers: Number(quotaMembers),
          maxSocialAccounts: Number(quotaSocialAccounts),
          monthlyAiTokens: Number(quotaAiTokens),
        },
      });
      setSuccessMessage(`Plan tier & quotas updated for ${limitsWorkspace.name}.`);
      setLimitsWorkspace(null);
      await fetchWorkspaces();
    } catch (err) {
      setError((err as Error).message || 'Failed to update workspace limits.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendModalWorkspace || !suspensionReason.trim()) return;
    setIsSubmittingAction(true);
    setError(null);
    try {
      await api.suspendSuperAdminWorkspace(suspendModalWorkspace.id, suspensionReason.trim());
      setSuccessMessage(`Tenant ${suspendModalWorkspace.name} has been suspended.`);
      setSuspendModalWorkspace(null);
      setSuspensionReason('');
      await fetchWorkspaces();
    } catch (err) {
      setError((err as Error).message || 'Failed to suspend workspace.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleReactivate = async () => {
    if (!confirmReactivateWorkspace) return;
    setIsSubmittingAction(true);
    setError(null);
    try {
      await api.reactivateSuperAdminWorkspace(confirmReactivateWorkspace.id);
      setSuccessMessage(`Tenant ${confirmReactivateWorkspace.name} has been reactivated.`);
      setConfirmReactivateWorkspace(null);
      await fetchWorkspaces();
    } catch (err) {
      setError((err as Error).message || 'Failed to reactivate workspace.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const totalWorkspaces = workspacesResponse?.pagination.total ?? 0;
  const activeCount = workspacesResponse?.workspaces.filter((w) => w.status === 'ACTIVE').length ?? 0;
  const suspendedCount = workspacesResponse?.workspaces.filter((w) => w.status === 'SUSPENDED').length ?? 0;
  const storesCount = workspacesResponse?.workspaces.reduce((acc, w) => acc + (w.stats.totalStores || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Tenant Workspaces & Multi-Tenancy
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
              Tenant Fleet
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global management of platform tenants, plan tier allocations, custom quota limits, and emergency workspace suspensions.
          </p>
        </div>

        <button
          onClick={() => void fetchWorkspaces()}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Workspaces</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-800 hover:text-rose-950 font-bold text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-800 hover:text-emerald-950 font-bold text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Metric Highlights — Waymark Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Total Tenants</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">{totalWorkspaces}</div>
          <p className="text-[11px] text-slate-500 mt-1">Registered workspace organizations</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Active Tenants</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-emerald-700 mt-2">{activeCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Healthy and in good standing</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-rose-500/5 blur-2xl group-hover:bg-rose-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Suspended</span>
            <div className="h-7 w-7 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Ban className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-rose-700 mt-2">{suspendedCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Tenant access blocked</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-sky-500/5 blur-2xl group-hover:bg-sky-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Connected Stores</span>
            <div className="h-7 w-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-sky-700 mt-2">{storesCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Live catalog connections</p>
        </div>
      </div>

      {/* Filters Bar — Waymark Bar */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by workspace name or slug..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="SUSPENDED">Suspended Only</option>
          <option value="ARCHIVED">Archived Only</option>
        </select>

        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        >
          <option value="ALL">All Plans</option>
          <option value="FREE">Free</option>
          <option value="STARTER">Starter</option>
          <option value="GROWTH">Growth</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
      </div>

      {/* Workspaces Table — Waymark Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-mono tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Workspace</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">Plan & Quotas</th>
                <th className="py-3 px-4">Telemetry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    <span>Loading tenant records from database...</span>
                  </td>
                </tr>
              ) : !workspacesResponse?.workspaces || workspacesResponse.workspaces.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">No workspaces found matching filters.</p>
                  </td>
                </tr>
              ) : (
                workspacesResponse.workspaces.map((ws) => (
                  <tr key={ws.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Workspace identity */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs uppercase shrink-0">
                          {ws.name.slice(0, 2) || 'NF'}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{ws.name}</div>
                          <div className="text-slate-500 text-[11px] font-mono">{ws.slug}</div>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-4">
                      {ws.owner ? (
                        <div>
                          <div className="font-medium text-slate-800">{ws.owner.name}</div>
                          <div className="text-slate-500 text-[11px] font-mono">{ws.owner.email}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No owner assigned</span>
                      )}
                    </td>

                    {/* Plan */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          ws.planTier === 'ENTERPRISE'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : ws.planTier === 'GROWTH'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : ws.planTier === 'STARTER'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {ws.planTier}
                        </span>
                        {ws.customQuotas && (
                          <span className="text-[10px] text-indigo-600 font-mono font-medium">Custom limits active</span>
                        )}
                      </div>
                    </td>

                    {/* Telemetry */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col text-[11px] text-slate-600 gap-0.5">
                        <span className="font-mono">{ws.stats.totalMembers} member(s) • {ws.stats.totalStores} store(s)</span>
                        <span className="text-slate-400 text-[10px] font-mono">
                          {ws.stats.totalPosts} post(s) • {ws.stats.totalCampaigns} campaign(s)
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {ws.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Active</span>
                        </span>
                      ) : ws.status === 'SUSPENDED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200" title={ws.suspensionReason || 'No reason specified'}>
                          <Ban className="h-3 w-3" />
                          <span>Suspended</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <span>{ws.status}</span>
                        </span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(ws.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => void openWorkspaceDetails(ws.id)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all shadow-xs cursor-pointer"
                          title="View Tenant Inspector"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => openLimitsModal(ws)}
                          className="p-1.5 text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all shadow-xs cursor-pointer"
                          title="Edit Plan Limits & Quotas"
                        >
                          <Sliders className="h-3.5 w-3.5" />
                        </button>

                        {ws.status === 'SUSPENDED' ? (
                          <button
                            onClick={() => setConfirmReactivateWorkspace(ws)}
                            className="p-1.5 text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all shadow-xs cursor-pointer"
                            title="Reactivate Tenant"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setSuspendModalWorkspace(ws)}
                            className="p-1.5 text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all shadow-xs cursor-pointer"
                            title="Suspend Tenant"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setPurgeModalWorkspace(ws);
                            setPurgeConfirmSlug('');
                            setPurgeReason('');
                          }}
                          className="p-1.5 text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all shadow-xs cursor-pointer"
                          title="Permanent GDPR Purge"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {workspacesResponse?.pagination && workspacesResponse.pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
            <div>
              Showing page <span className="font-bold text-slate-900">{workspacesResponse.pagination.page}</span> of{' '}
              <span className="font-bold text-slate-900">{workspacesResponse.pagination.totalPages}</span> ({workspacesResponse.pagination.total} total workspaces)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-700 shadow-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>

              <button
                onClick={() => setPage((p) => Math.min(workspacesResponse.pagination.totalPages, p + 1))}
                disabled={page >= workspacesResponse.pagination.totalPages || isLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-700 shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL 1: Tenant Inspector Modal --- */}
      {selectedWorkspaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm uppercase">
                  {workspaceDetails?.workspace.name.slice(0, 2) || 'NF'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>{workspaceDetails?.workspace.name || 'Loading...'}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {workspaceDetails?.workspace.planTier}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: {workspaceDetails?.workspace.id} • Slug: {workspaceDetails?.workspace.slug}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedWorkspaceId(null);
                  setWorkspaceDetails(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isLoadingDetails ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                <span>Loading tenant telemetry and roster...</span>
              </div>
            ) : workspaceDetails ? (
              <div className="space-y-6 text-xs">
                {/* Highlights */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Tenant Status</span>
                    <span className={`font-semibold font-mono text-xs ${workspaceDetails.workspace.status === 'ACTIVE' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {workspaceDetails.workspace.status}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">AI Tokens Consumed</span>
                    <span className="font-semibold font-mono text-xs text-slate-900">
                      {workspaceDetails.stats.ai.totalTokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Total Products</span>
                    <span className="font-semibold font-mono text-xs text-slate-900">{workspaceDetails.stats.totalProducts}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Posts Breakdown</span>
                    <span className="font-semibold font-mono text-xs text-slate-900">
                      {workspaceDetails.stats.postsByStatus.PUBLISHED} pub / {workspaceDetails.stats.postsByStatus.SCHEDULED} sched
                    </span>
                  </div>
                </div>

                {workspaceDetails.workspace.status === 'SUSPENDED' && workspaceDetails.workspace.suspensionReason && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                    <div className="font-semibold text-[11px] mb-1 flex items-center gap-1.5 text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Tenant Suspension Reason (Audited)</span>
                    </div>
                    <p className="text-[11px] font-mono">{workspaceDetails.workspace.suspensionReason}</p>
                    <span className="text-[10px] text-rose-600 block mt-1">
                      Suspended on: {new Date(workspaceDetails.workspace.suspendedAt || '').toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Connected Stores */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                    <Store className="h-3.5 w-3.5 text-sky-600" />
                    <span>Store Connections ({workspaceDetails.stores.length})</span>
                  </h4>
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    {workspaceDetails.stores.length === 0 ? (
                      <p className="p-4 text-center text-slate-400 italic">No ecommerce stores connected.</p>
                    ) : (
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono">
                          <tr>
                            <th className="py-2.5 px-3">Platform</th>
                            <th className="py-2.5 px-3">Store Name</th>
                            <th className="py-2.5 px-3">Store URL</th>
                            <th className="py-2.5 px-3">Sync Status</th>
                            <th className="py-2.5 px-3">Products</th>
                            <th className="py-2.5 px-3">Last Synced</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {workspaceDetails.stores.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-semibold text-slate-900">{s.platform}</td>
                              <td className="py-2 px-3 text-slate-700">{s.storeName}</td>
                              <td className="py-2 px-3 font-mono text-slate-500">{s.storeUrl}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                                  s.syncStatus === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {s.syncStatus}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-900 font-mono">{s.syncedProducts}</td>
                              <td className="py-2 px-3 text-slate-500 font-mono">
                                {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : 'Never'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Members Roster */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Members Roster ({workspaceDetails.members.length})</span>
                  </h4>
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono">
                        <tr>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Email</th>
                          <th className="py-2.5 px-3">Role</th>
                          <th className="py-2.5 px-3">User Status</th>
                          <th className="py-2.5 px-3">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {workspaceDetails.members.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-medium text-slate-900">{m.user.name}</td>
                            <td className="py-2 px-3 font-mono text-slate-500">{m.user.email}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {m.role}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                                m.user.isSuspended ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {m.user.isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-mono">{new Date(m.joinedAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit trail */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    <span>Recent Administrative Overrides</span>
                  </h4>
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    {workspaceDetails.recentAuditLogs.length === 0 ? (
                      <p className="p-4 text-center text-slate-400 italic">No platform overrides recorded for this tenant.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {workspaceDetails.recentAuditLogs.map((log) => (
                          <div key={log.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50/50">
                            <div>
                              <span className="font-mono text-slate-900 text-[11px] font-semibold">{log.action}</span>
                              <span className="text-slate-500 text-[10px] block font-mono">Actor: {log.actorEmail}</span>
                              {log.reason && <span className="text-slate-500 text-[10px] block italic">{log.reason}</span>}
                            </div>
                            <span className="text-slate-400 text-[10px] font-mono">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="border-t border-slate-200 pt-4 flex justify-end">
              <button
                onClick={() => {
                  setSelectedWorkspaceId(null);
                  setWorkspaceDetails(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Limits & Custom Quotas Editor --- */}
      {limitsWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Plan Limits & Quotas</h3>
                <p className="text-xs text-indigo-700 font-mono">{limitsWorkspace.name} ({limitsWorkspace.slug})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Update this tenant&apos;s base plan tier or assign custom operational quotas overriding standard billing plan caps.
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Plan Tier
                </label>
                <select
                  value={selectedPlanTier}
                  onChange={(e) => setSelectedPlanTier(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="FREE">FREE</option>
                  <option value="STARTER">STARTER</option>
                  <option value="GROWTH">GROWTH</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Max Posts / Month
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quotaPosts}
                    onChange={(e) => setQuotaPosts(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Max Team Members
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quotaMembers}
                    onChange={(e) => setQuotaMembers(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Max Social Accounts
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quotaSocialAccounts}
                    onChange={(e) => setQuotaSocialAccounts(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Monthly AI Tokens
                  </label>
                  <input
                    type="number"
                    min={10000}
                    step={50000}
                    value={quotaAiTokens}
                    onChange={(e) => setQuotaAiTokens(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setLimitsWorkspace(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveLimits()}
                disabled={isSubmittingAction}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                {isSubmittingAction ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sliders className="h-3.5 w-3.5" />}
                <span>Save Limits & Quotas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Suspend Workspace Modal --- */}
      {suspendModalWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-rose-200 p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Suspend Workspace</h3>
                <p className="text-xs text-rose-600 font-mono">{suspendModalWorkspace.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Suspending this tenant will immediately block API and dashboard access for ALL workspace members. Background scheduled posts and sync jobs will be paused.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Audited Suspension Reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Delinquent account, billing chargeback, suspicious activity..."
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuspendModalWorkspace(null);
                  setSuspensionReason('');
                }}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSuspend()}
                disabled={!suspensionReason.trim() || isSubmittingAction}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                {isSubmittingAction ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                <span>Confirm Suspension</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Reactivate Workspace Modal --- */}
      {confirmReactivateWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-emerald-200 p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <RotateCcw className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reactivate Workspace</h3>
                <p className="text-xs text-emerald-700 font-mono">{confirmReactivateWorkspace.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will restore tenant access for all members and allow scheduled publishing to resume.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmReactivateWorkspace(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleReactivate()}
                disabled={isSubmittingAction}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                {isSubmittingAction ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                <span>Confirm Reactivation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent GDPR/CCPA Purge Modal */}
      {purgeModalWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden">
            <div className="p-6 bg-red-50/70 border-b border-red-100 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-950 font-display">Permanent GDPR/CCPA Workspace Purge</h3>
                <p className="text-xs text-red-800 mt-0.5">
                  Irreversible action: This will hard-delete <strong>{purgeModalWorkspace.name}</strong> and all linked products, campaigns, posts, media assets, and credentials forever.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type <span className="font-mono text-red-600 font-bold bg-red-50 px-1 py-0.5 rounded">{purgeModalWorkspace.slug}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={purgeConfirmSlug}
                  onChange={(e) => setPurgeConfirmSlug(e.target.value)}
                  placeholder={purgeModalWorkspace.slug}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audit Reason (optional / compliance ticket):
                </label>
                <input
                  type="text"
                  value={purgeReason}
                  onChange={(e) => setPurgeReason(e.target.value)}
                  placeholder="e.g. GDPR Right to be Forgotten request #4102"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>Compliance Notice</span>
                </div>
                <p>An immutable cryptographic entry will be written to the Platform Admin Audit Log recording your operator identity, timestamp, and target workspace metadata.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSubmittingAction}
                onClick={() => setPurgeModalWorkspace(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={purgeConfirmSlug.trim() !== purgeModalWorkspace.slug.trim() || isSubmittingAction}
                onClick={() => void handlePurgeWorkspace()}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSubmittingAction ? 'Purging permanently...' : 'Hard Delete Workspace'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
