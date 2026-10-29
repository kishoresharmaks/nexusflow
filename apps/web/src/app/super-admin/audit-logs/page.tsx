'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api, SuperAdminAuditLogsResponse } from '../../../lib/api';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  User,
  X,
  Lock,
} from 'lucide-react';

export default function SuperAdminAuditLogsPage() {
  const [logsResponse, setLogsResponse] = useState<SuperAdminAuditLogsResponse | null>(null);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('');
  const [actorEmailFilter, setActorEmailFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector Modal
  const [selectedLog, setSelectedLog] = useState<SuperAdminAuditLogsResponse['data'][number] | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSuperAdminAuditLogs({
        page,
        limit,
        action: actionFilter || undefined,
        targetType: targetTypeFilter || undefined,
        actorEmail: actorEmailFilter || undefined,
      });
      setLogsResponse(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch platform audit logs.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, actionFilter, targetTypeFilter, actorEmailFilter]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const totalLogs = logsResponse?.total ?? 0;
  const currentLogs = logsResponse?.data ?? [];
  const successCount = currentLogs.filter((l) => l.outcome === 'SUCCESS').length;
  const failureCount = currentLogs.filter((l) => l.outcome !== 'SUCCESS').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Security & Audit Trail
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
              Immutable Ledger
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete cryptographic audit trail of all platform-wide administrative interventions, role grants, and tenant configuration overrides.
          </p>
        </div>

        <button
          onClick={() => void fetchLogs()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-800/90 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all shrink-0 hover:text-slate-900"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bento Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Audit Records</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{totalLogs.toLocaleString()}</div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="text-indigo-400 font-medium">Platform Events</span>
            <span>recorded across all tenants</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Successful Events (Page)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{successCount}</div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="text-emerald-400 font-medium">{currentLogs.length > 0 ? Math.round((successCount / currentLogs.length) * 100) : 100}%</span>
            <span>nominal authorization rate</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Flagged / Rejected</span>
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{failureCount}</div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="text-rose-400 font-medium">{failureCount} events</span>
            <span>required escalation or failed</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Ledger Security</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-emerald-400 font-mono flex items-center gap-2 mt-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            VERIFIED
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-cyan-400 inline" />
            <span>Cryptographic append-only</span>
          </div>
        </div>
      </div>

      {/* Floating Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 backdrop-blur-xl flex flex-wrap items-center gap-3 text-xs shadow-xl">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by actor email..."
            value={actorEmailFilter}
            onChange={(e) => {
              setActorEmailFilter(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono transition-all"
          />
        </div>

        <div className="w-52">
          <input
            type="text"
            placeholder="Filter action (e.g. admin.grant)"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono transition-all"
          />
        </div>

        <div className="w-44">
          <select
            value={targetTypeFilter}
            onChange={(e) => {
              setTargetTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer transition-all"
          >
            <option value="">All Targets</option>
            <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
            <option value="USER">USER</option>
            <option value="WORKSPACE">WORKSPACE</option>
            <option value="SETTINGS">SETTINGS</option>
          </select>
        </div>

        {(actionFilter || targetTypeFilter || actorEmailFilter) && (
          <button
            onClick={() => {
              setActionFilter('');
              setTargetTypeFilter('');
              setActorEmailFilter('');
              setPage(1);
            }}
            className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all border border-slate-700/50"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-white/40 uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Timestamp (UTC)</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target Type</th>
                <th className="py-3.5 px-4">Outcome</th>
                <th className="py-3.5 px-4">Reason / Notes</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (!logsResponse || logsResponse.data.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-400" />
                    <span>Loading security audit trail...</span>
                  </td>
                </tr>
              ) : !logsResponse || logsResponse.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                logsResponse.data.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                          <User className="h-3 w-3" />
                        </div>
                        <span className="truncate max-w-[180px]">{log.actorEmail}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-[11px] font-mono text-slate-700">
                        {log.targetType}
                      </span>
                      {log.targetId && (
                        <span className="text-slate-500 font-mono text-[10px] ml-1.5">
                          #{log.targetId.slice(-6)}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          log.outcome === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {log.outcome}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={log.reason || '—'}>
                      {log.reason || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                        title="View Full Metadata"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {logsResponse && logsResponse.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-white/40">
            <span>
              Showing {logsResponse.data.length} of {logsResponse.total} events (Page {page} of{' '}
              {logsResponse.totalPages})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(logsResponse.totalPages, p + 1))}
                disabled={page >= logsResponse.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Detail Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="bg-[#0A0E17]/95 border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Audit Event Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-white rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Event ID</span>
                  <p className="font-mono text-slate-700 text-[11px] truncate">{selectedLog.id}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Timestamp</span>
                  <p className="font-mono text-slate-700 text-[11px]">
                    {new Date(selectedLog.createdAt).toISOString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Actor</span>
                  <p className="font-mono text-slate-700 text-[11px] truncate">{selectedLog.actorEmail}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Target</span>
                  <p className="font-mono text-slate-700 text-[11px] truncate">
                    {selectedLog.targetType} ({selectedLog.targetId || 'N/A'})
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                  Reason / Justification
                </span>
                <p className="p-3 bg-white rounded-xl border border-slate-200 text-slate-700">
                  {selectedLog.reason || 'None provided'}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">
                  Metadata Payload
                </span>
                <pre className="p-3.5 bg-white/90 rounded-xl border border-slate-200 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-48 leading-relaxed">
                  {JSON.stringify(selectedLog.metadata, null, 2) || '{}'}
                </pre>
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all border border-slate-700/50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
