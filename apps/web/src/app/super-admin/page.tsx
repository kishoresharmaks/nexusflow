'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  api,
  SuperAdminDashboardOverview,
  SuperAdminGrowthPoint,
  SuperAdminHealth,
  PlatformAdminItem,
} from '../../lib/api';
import {
  Users,
  Building2,
  Cpu,
  ShieldCheck,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Layers,
  UserPlus,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';

export default function SuperAdminDashboardPage() {
  const [overview, setOverview] = useState<SuperAdminDashboardOverview | null>(null);
  const [growth, setGrowth] = useState<SuperAdminGrowthPoint[]>([]);
  const [health, setHealth] = useState<SuperAdminHealth | null>(null);
  const [admins, setAdmins] = useState<PlatformAdminItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Grant Admin Modal
  const [isGrantModalOpen, setIsGrantModalOpen] = useState<boolean>(false);
  const [grantEmail, setGrantEmail] = useState<string>('');
  const [grantRole, setGrantRole] = useState<'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN'>('SUPPORT_ADMIN');
  const [grantReason, setGrantReason] = useState<string>('');
  const [isSubmittingGrant, setIsSubmittingGrant] = useState<boolean>(false);
  const [grantMessage, setGrantMessage] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewData, growthData, healthData, adminsList] = await Promise.all([
        api.getSuperAdminOverview(),
        api.getSuperAdminGrowth(14),
        api.getSuperAdminHealth(),
        api.getSuperAdminList(),
      ]);
      setOverview(overviewData);
      setGrowth(growthData);
      setHealth(healthData);
      setAdmins(adminsList);
    } catch (err) {
      setError((err as Error).message || 'Failed to load platform telemetry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingGrant(true);
    setError(null);
    setGrantMessage(null);
    try {
      const granted = await api.grantSuperAdmin({
        email: grantEmail,
        role: grantRole,
        reason: grantReason || undefined,
      });
      setGrantMessage(`Successfully granted ${granted.role} privileges to ${grantEmail}!`);
      setGrantEmail('');
      setGrantReason('');
      setIsGrantModalOpen(false);
      await loadDashboard();
    } catch (err) {
      setError((err as Error).message || 'Failed to grant platform administrator privileges.');
    } finally {
      setIsSubmittingGrant(false);
    }
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
    return tokens.toLocaleString();
  };

  const formatCost = (microcents: number) => {
    const dollars = microcents / 100_000_000;
    return `$${dollars.toFixed(4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Waymark Modern Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Platform Overview &amp; Telemetry
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Operator
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Real-time platform telemetry across all registered tenants, AI usage ledgers, and privileged operations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsGrantModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/10 transition-all shrink-0 cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Grant Admin Access</span>
          </button>

          <button
            onClick={() => void loadDashboard()}
            disabled={isLoading}
            className="p-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-xs cursor-pointer"
            title="Refresh telemetry"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-800 font-semibold hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {grantMessage && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{grantMessage}</span>
          </div>
          <button onClick={() => setGrantMessage(null)} className="text-emerald-800 font-semibold hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Bento-Grid KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Users Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total users</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {overview?.users.total ?? '—'}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-emerald-600 font-medium">
              {overview?.users.active ?? 0} active
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-600 font-medium">
              {overview?.users.suspended ?? 0} suspended
            </span>
          </div>
        </div>

        {/* Workspaces Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total workspaces</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {overview?.workspaces.total ?? '—'}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-emerald-600 font-medium">
              {overview?.workspaces.active ?? 0} active
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-600 font-medium">
              {overview?.workspaces.suspended ?? 0} suspended
            </span>
          </div>
        </div>

        {/* AI Metering Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">AI Generation</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {overview ? formatTokens(overview.aiUsage.totalTokens) : '—'}{' '}
            <span className="text-xs font-normal text-slate-500">tokens</span>
          </p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>{overview?.aiUsage.totalRequests ?? 0} calls</span>
            <span className="text-amber-700 font-semibold">
              Est: {overview ? formatCost(overview.aiUsage.costEstimateMicrocents) : '$0'}
            </span>
          </div>
        </div>

        {/* Content & Stores Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Content &amp; Stores</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {overview?.content.totalPosts ?? '—'}{' '}
            <span className="text-xs font-normal text-slate-500">posts</span>
          </p>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{overview?.content.totalCampaigns ?? 0} campaigns</span>
            <span className="text-slate-300">•</span>
            <span>{overview?.content.totalStoreConnections ?? 0} stores</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Growth Visualizer & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Velocity Visualizer */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Platform Growth (Last 14 Days)</h3>
                <p className="text-[11px] text-slate-500">Tenant acquisition and registration velocity</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="text-slate-600 text-[11px]">Users</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                <span className="text-slate-600 text-[11px]">Workspaces</span>
              </div>
            </div>
          </div>

          {growth.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              No recent growth telemetry recorded yet.
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              <div className="flex items-end gap-2 h-44 w-full pt-4 border-b border-slate-200 pb-2">
                {growth.map((point) => {
                  const maxVal = Math.max(...growth.map((g) => Math.max(g.users, g.workspaces)), 1);
                  const userHeight = Math.max(8, (point.users / maxVal) * 120);
                  const wsHeight = Math.max(8, (point.workspaces / maxVal) * 120);

                  return (
                    <div
                      key={point.date}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative"
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-800 text-[10px] text-white px-2 py-1 rounded shadow-xl pointer-events-none whitespace-nowrap z-20 font-mono">
                        {point.date}: {point.users} users, {point.workspaces} ws
                      </div>

                      <div className="w-full flex items-end justify-center gap-1">
                        <div
                          style={{ height: `${userHeight}px` }}
                          className="w-1/2 bg-blue-500/80 rounded-t group-hover:bg-blue-600 transition-all shadow-xs"
                        />
                        <div
                          style={{ height: `${wsHeight}px` }}
                          className="w-1/2 bg-purple-500/80 rounded-t group-hover:bg-purple-600 transition-all shadow-xs"
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 mt-2 truncate max-w-[28px]">
                        {point.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Operational Infrastructure Health Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Infrastructure Health</h3>
                  <p className="text-[11px] text-slate-500">Live service heartbeat</p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Verified
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">MongoDB Replica / Cluster</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Latency: {health?.database.latencyMs ?? '—'}ms
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                  {health?.database.status ?? 'ONLINE'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Shopify &amp; Custom Stores</p>
                  <p className="text-[11px] text-slate-500">
                    {health?.integrations.stores.healthy ?? 0} active, {health?.integrations.stores.failing ?? 0} error
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                  MONITORED
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Social Tokens (Meta / LinkedIn)</p>
                  <p className="text-[11px] text-slate-500">
                    {health?.integrations.socialAccounts.healthy ?? 0} active, {health?.integrations.socialAccounts.attentionRequired ?? 0} attention
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  AES-256-GCM
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Last Probe</span>
            <span className="font-mono text-slate-600">
              {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : 'Just now'}
            </span>
          </div>
        </div>
      </div>

      {/* Platform Administrators & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Platform Administrators List */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-indigo-600" />
              <span>Platform Administrators ({admins.length})</span>
            </h3>
          </div>

          <div className="space-y-2.5">
            {admins.map((adm) => (
              <div
                key={adm.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-900">{adm.user.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{adm.user.email}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {adm.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Platform Audit Log Feed */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Privileged Operations</h3>
                <p className="text-[11px] text-slate-500">Audit trail of critical administrative actions</p>
              </div>
            </div>
            <Link
              href="/super-admin/audit-logs"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View All Logs</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {!overview?.recentActivity || overview.recentActivity.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No recent administrative actions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="pb-2.5">Actor</th>
                    <th className="pb-2.5">Action</th>
                    <th className="pb-2.5">Target</th>
                    <th className="pb-2.5">Outcome</th>
                    <th className="pb-2.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.recentActivity.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 font-mono text-slate-700">
                        {log.actorEmail}
                      </td>
                      <td className="py-2.5 font-semibold text-slate-900">
                        <span className="font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500">
                        {log.targetType} {log.targetId ? `(${log.targetId.slice(-6)})` : ''}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.outcome === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {log.outcome}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-slate-500 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Grant Administrator Modal */}
      {isGrantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl p-6 text-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Grant Platform Administrator</h3>
                  <p className="text-[11px] text-slate-500">Promote an existing registered account</p>
                </div>
              </div>
              <button
                onClick={() => setIsGrantModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGrantAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Registered Account Email
                </label>
                <input
                  type="email"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="operator@commercepilot.com"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Platform Role Assignment
                </label>
                <select
                  value={grantRole}
                  onChange={(e) => setGrantRole(e.target.value as 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN')}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                >
                  <option value="SUPPORT_ADMIN">SUPPORT_ADMIN (Users &amp; Tenant Operations)</option>
                  <option value="BILLING_ADMIN">BILLING_ADMIN (Plans &amp; Subscription Limits)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Full Platform Privileges)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reason for Role Elevation
                </label>
                <input
                  type="text"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="e.g. Senior operations team onboarding"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsGrantModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGrant}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/10 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmittingGrant ? 'Authorizing...' : 'Grant Privileges'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
