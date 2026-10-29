'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api, SuperAdminJobsOverview } from '../../../lib/api';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Server,
  Layers,
  FileSpreadsheet,
  Send,
} from 'lucide-react';

export default function SuperAdminJobsPage() {
  const [overview, setOverview] = useState<SuperAdminJobsOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showRetryConfirm, setShowRetryConfirm] = useState<boolean>(false);

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSuperAdminJobsOverview();
      setOverview(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch background jobs telemetry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    setError(null);
    setShowRetryConfirm(false);
    try {
      const res = await api.retrySuperAdminFailedJobs();
      setSuccessMessage(
        `Successfully re-enqueued ${res.retriedPosts} failed posts and ${res.retriedImports} catalog imports for processing.`,
      );
      void fetchOverview();
    } catch (err) {
      setError((err as Error).message || 'Failed to trigger job retry.');
    } finally {
      setIsRetrying(false);
    }
  };

  const getQueueStatusBadge = (status: 'HEALTHY' | 'IDLE' | 'DEGRADED') => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Active
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3 w-3" /> Degraded
          </span>
        );
      case 'IDLE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 border border-slate-700">
            <Clock className="h-3 w-3" /> Idle
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Background Jobs & Worker Telemetry
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase tracking-wider">
              Worker Infrastructure
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Monitor BullMQ queues, inspect failed post deliveries and catalog ingestion jobs, and trigger audited workload retries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchOverview()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-800 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold transition-all shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowRetryConfirm(true)}
            disabled={isRetrying || isLoading || (overview?.workload.failedPosts === 0 && overview?.workload.failedImports === 0)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-all shadow-sm shrink-0 disabled:opacity-40 cursor-pointer"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>Retry Failed Workload</span>
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

      {/* Telemetry Summary Cards — Waymark Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-sky-500/10 blur-2xl group-hover:bg-sky-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Redis Broker</span>
            <div className="h-7 w-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                overview?.redisStatus === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-xl font-bold font-mono tracking-tight text-slate-900">
              {overview?.redisStatus === 'ONLINE' ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            Mode: <span>{overview?.workerMode === 'BULLMQ_DISTRIBUTED' ? 'BullMQ Distributed' : 'Direct DB Fallback'}</span>
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-rose-500/10 blur-2xl group-hover:bg-rose-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Failed Post Deliveries</span>
            <div className="h-7 w-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-rose-400 mt-2">
            {overview ? overview.workload.failedPosts : '...'}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            Waiting: {overview ? overview.workload.scheduledPosts : 0} • In-flight: {overview ? overview.workload.publishingPosts : 0}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Failed Ingestions</span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-amber-400 mt-2">
            {overview ? overview.workload.failedImports : '...'}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            Pending / In-progress: {overview ? overview.workload.pendingImports : 0}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Registered Queues</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">
            {overview ? overview.queues.length : 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            BullMQ workers actively bound
          </p>
        </div>
      </div>

      {/* Queues Table — Waymark Glass Table */}
      <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-md overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-slate-900">Platform Queue Fleet</h2>
            <p className="text-xs text-slate-500">BullMQ distributed job queues monitoring and depth</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-mono text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Queue Name</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Waiting (Depth)</th>
                <th className="px-5 py-3.5">Active In-flight</th>
                <th className="px-5 py-3.5">Failed Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-indigo-400" />
                    Inspecting queues...
                  </td>
                </tr>
              ) : overview?.queues.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    No active queues registered.
                  </td>
                </tr>
              ) : (
                overview?.queues.map((q) => (
                  <tr key={q.name} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{q.displayName}</div>
                      <div className="text-[10px] font-mono text-slate-500">{q.name}</div>
                    </td>
                    <td className="px-5 py-3.5">{getQueueStatusBadge(q.status)}</td>
                    <td className="px-5 py-3.5 font-mono font-medium text-slate-700">{q.waiting}</td>
                    <td className="px-5 py-3.5 font-mono text-sky-400">{q.active}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-rose-400">
                      {q.failed > 0 ? q.failed : 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Failures Inspector — Waymark Glass Table */}
      <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-md overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-slate-900">Recent Workload Failures</h2>
            <p className="text-xs text-slate-500">Root-cause diagnostics for failed background tasks</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-mono text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Failed At</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Target Workload</th>
                <th className="px-5 py-3.5">Error Message / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!overview || overview.recentFailures.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                    Clean operational health. No recent workload errors recorded.
                  </td>
                </tr>
              ) : (
                overview.recentFailures.map((fail) => (
                  <tr key={fail.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(fail.failedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          fail.type === 'POST_PUBLISH'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {fail.type === 'POST_PUBLISH' ? 'POST PUBLISHING' : 'CATALOG IMPORT'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900 max-w-xs truncate">
                      {fail.targetName}
                    </td>
                    <td className="px-5 py-3.5 text-rose-300 font-mono text-[11px] max-w-md break-all">
                      {fail.errorMessage}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retry Confirmation Modal */}
      {showRetryConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in">
          <div className="bg-white border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 backdrop-blur-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Retry Failed Workload</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              This action will reset the status of all failed posts ({overview?.workload.failedPosts ?? 0}) back to{' '}
              <strong className="text-slate-900">SCHEDULED</strong> and failed catalog imports (
              {overview?.workload.failedImports ?? 0}) back to <strong className="text-slate-900">PENDING</strong> for
              immediate re-execution.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowRetryConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRetryFailed()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-md shadow-amber-600/20 flex items-center gap-1.5 cursor-pointer font-bold"
              >
                Confirm & Re-enqueue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
