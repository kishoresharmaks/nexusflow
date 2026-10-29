'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  api,
  SuperAdminAiSummary,
  SuperAdminAiUsageItem,
  SuperAdminTopAiTenant,
} from '../../../lib/api';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Building2,
  DollarSign,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function SuperAdminAiProvidersPage() {
  const [summary, setSummary] = useState<SuperAdminAiSummary | null>(null);
  const [topTenants, setTopTenants] = useState<SuperAdminTopAiTenant[]>([]);
  const [usageLogs, setUsageLogs] = useState<SuperAdminAiUsageItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [featureFilter, setFeatureFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummaryAndTop = useCallback(async () => {
    try {
      const [summaryData, topData] = await Promise.all([
        api.getSuperAdminAiSummary(),
        api.getSuperAdminTopAiTenants(),
      ]);
      setSummary(summaryData);
      setTopTenants(topData);
    } catch (err) {
      console.warn('Failed to load AI telemetry:', err);
    }
  }, []);

  const fetchUsageLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSuperAdminAiUsage({
        page,
        limit: 20,
        provider: providerFilter !== 'ALL' ? providerFilter : undefined,
        feature: featureFilter !== 'ALL' ? featureFilter : undefined,
      });
      setUsageLogs(data.usage);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch AI usage ledger.');
    } finally {
      setIsLoading(false);
    }
  }, [page, providerFilter, featureFilter]);

  useEffect(() => {
    void fetchSummaryAndTop();
  }, [fetchSummaryAndTop]);

  useEffect(() => {
    void fetchUsageLogs();
  }, [fetchUsageLogs]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatUsd = (microcents: number) => {
    const usd = microcents / 100_000_000;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(usd);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              AI Provider Infrastructure & Token Quotas
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-50 text-violet-700 border border-violet-200 uppercase tracking-wider">
              AI Fleet Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time LLM token consumption telemetry, model expenditure breakdowns, and tenant usage distribution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void fetchSummaryAndTop();
              void fetchUsageLogs();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-800 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold transition-all shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
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

      {/* Overview KPI Cards — Waymark Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl group-hover:bg-violet-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Total AI Requests</span>
            <div className="h-7 w-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">
            {summary ? formatNumber(summary.totalRequests) : '...'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Tracked across all platform workspaces
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Tokens Processed</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-indigo-400 mt-2">
            {summary ? formatNumber(summary.totalTokens) : '...'}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            Prompt: {summary ? formatNumber(summary.promptTokens) : 0} • Comp: {summary ? formatNumber(summary.completionTokens) : 0}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Estimated Cost</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-emerald-400 mt-2">
            {summary ? formatUsd(summary.totalCostEstimateMicrocents) : '...'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Calculated from official provider token tariffs
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Active Providers</span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">
            {summary ? Object.keys(summary.providerBreakdown).length : 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            OpenAI, Anthropic & Google Gemini
          </p>
        </div>
      </div>

      {/* Provider Breakdown Cards */}
      {summary && Object.keys(summary.providerBreakdown).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
            Provider Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(summary.providerBreakdown).map(([provider, stats]) => (
              <div
                key={provider}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all space-y-3"
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-violet-500/10 blur-2xl group-hover:bg-violet-500/20 transition-all" />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm tracking-wide">{provider}</span>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                    {stats.requests} reqs
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-500">Total Tokens:</span>
                    <span className="text-slate-900 font-medium">{formatNumber(stats.totalTokens)}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-slate-500">Prompt / Comp:</span>
                    <span className="text-slate-700">
                      {formatNumber(stats.promptTokens)} / {formatNumber(stats.completionTokens)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 font-mono font-semibold">
                    <span className="text-slate-700">Est. Cost:</span>
                    <span className="text-emerald-400">{formatUsd(stats.costMicrocents)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Consuming Tenants — Waymark Glass Table */}
      <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-md overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-slate-900">Top 10 AI-Consuming Tenants</h2>
            <p className="text-xs text-slate-500">Workspaces ranked by cumulative token expenditure</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-mono text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Tenant Workspace</th>
                <th className="px-5 py-3">Plan Tier</th>
                <th className="px-5 py-3">Total Tokens</th>
                <th className="px-5 py-3">Estimated Cost</th>
                <th className="px-5 py-3 text-right">Request Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topTenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    No tenant AI usage recorded yet.
                  </td>
                </tr>
              ) : (
                topTenants.map((tenant, idx) => (
                  <tr key={tenant.workspaceId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-slate-500 font-bold text-xs w-4">
                          #{idx + 1}
                        </span>
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
                          <Building2 className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{tenant.workspaceName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">/{tenant.workspaceSlug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200 border border-slate-700">
                        {tenant.planTier}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-medium text-indigo-300">
                      {formatNumber(tenant.totalTokens)}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-semibold text-emerald-400">
                      {formatUsd(tenant.costEstimateMicrocents)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-slate-700">
                      {tenant.requestCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent AI Usage Events Ledger */}
      <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-md overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 bg-white backdrop-blur-xl">
          <div>
            <h2 className="font-bold text-sm text-slate-900">Live AI Generation Ledger</h2>
            <p className="text-xs text-slate-500">Granular audit log of all tokenized model inferences</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
            >
              <option value="ALL">All Providers</option>
              <option value="OPENAI">OpenAI</option>
              <option value="ANTHROPIC">Anthropic</option>
              <option value="GEMINI">Google Gemini</option>
            </select>
            <select
              value={featureFilter}
              onChange={(e) => {
                setFeatureFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
            >
              <option value="ALL">All Features</option>
              <option value="CAPTION_GENERATION">Caption Generation</option>
              <option value="HASHTAG_SUGGESTION">Hashtags</option>
              <option value="STORE_ANALYSIS">Store Analysis</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-mono text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Workspace</th>
                <th className="px-5 py-3">Provider & Model</th>
                <th className="px-5 py-3">Feature</th>
                <th className="px-5 py-3">Tokens (P / C)</th>
                <th className="px-5 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading AI usage ledger...
                  </td>
                </tr>
              ) : usageLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    No AI usage records found.
                  </td>
                </tr>
              ) : (
                usageLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-medium text-slate-900">
                        {log.workspace?.name || log.workspaceId}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-50 text-violet-700 border border-violet-200">
                          {log.provider}
                        </span>
                        <span className="font-mono text-slate-700 text-[11px]">{log.model}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200 border border-slate-700 font-medium">
                        {log.feature}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-700">
                      {formatNumber(log.promptTokens + log.completionTokens)}{' '}
                      <span className="text-slate-500 text-[10px]">
                        ({formatNumber(log.promptTokens)} / {formatNumber(log.completionTokens)})
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-emerald-400">
                      {formatUsd(log.costEstimateMicrocents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div>
            Showing {usageLogs.length} of {total} events
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold text-slate-700 font-mono">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-200 disabled:opacity-40 hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
