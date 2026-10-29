'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProtectedRoute } from '../../../components/protected-route';
import { SettingsLayout } from '../../../components/settings-layout';
import { useAuth } from '../../../context/auth-context';
import { api, type PaginatedAuditLogs } from '../../../lib/api';
import { formatDateTime } from '../../../lib/formatters';
import {
  RefreshCw,
  Filter,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileCode,
} from 'lucide-react';

export default function AuditLogPage() {
  return (
    <ProtectedRoute fallbackTitle="Sign in to view workspace audit log">
      <AuditLogContent />
    </ProtectedRoute>
  );
}

function AuditLogContent() {
  const { currentWorkspace } = useAuth();
  const [data, setData] = useState<PaginatedAuditLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');

  // Metadata inspection modal
  const [selectedLog, setSelectedLog] = useState<PaginatedAuditLogs['items'][number] | null>(null);

  const loadLogs = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getWorkspaceAuditLogs(currentWorkspace.id, {
        page,
        limit,
        action: actionFilter || undefined,
        resourceType: resourceTypeFilter || undefined,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load workspace audit logs.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, page, limit, actionFilter, resourceTypeFilter]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void loadLogs();
  };

  const resetFilters = () => {
    setActionFilter('');
    setResourceTypeFilter('');
    setPage(1);
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes('delete') || action.includes('remove') || action.includes('revoke')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.includes('update') || action.includes('change') || action.includes('policy')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (action.includes('create') || action.includes('invite') || action.includes('publish')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  return (
    <SettingsLayout
      title="Audit log"
      description="Immutable, tenant-isolated audit trail capturing all administrative mutations and security events."
      headerAction={
        <button
          type="button"
          onClick={() => void loadLogs()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      }
    >
      <div className="space-y-6">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter bar */}
        <section className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-sm">
          <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="action-filter" className="sr-only">Action</label>
              <input
                id="action-filter"
                type="text"
                placeholder="Filter by action (e.g. workspace.update, invite.send)"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
              />
            </div>

            <div className="w-[180px]">
              <label htmlFor="resource-filter" className="sr-only">Resource type</label>
              <select
                id="resource-filter"
                value={resourceTypeFilter}
                onChange={(e) => {
                  setResourceTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
              >
                <option value="">All resource types</option>
                <option value="workspace">Workspace</option>
                <option value="approval_policy">Approval Policy</option>
                <option value="membership">Membership</option>
                <option value="invitation">Invitation</option>
                <option value="post">Post</option>
                <option value="social_account">Social Account</option>
                <option value="store_connection">Store Connection</option>
              </select>
            </div>

            <div className="w-[120px]">
              <label htmlFor="limit-select" className="sr-only">Items per page</label>
              <select
                id="limit-select"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E85D2A] px-4 py-2 text-sm font-bold text-white hover:bg-[#D04E1F]"
            >
              <Filter className="h-4 w-4" /> Filter
            </button>

            {(actionFilter || resourceTypeFilter) && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold text-[#667085] hover:text-[#17202A]"
              >
                Clear filters
              </button>
            )}
          </form>
        </section>

        {/* Audit Log Table */}
        <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E7EC] bg-[#F9FAFB] text-[#475467]">
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Actor</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Resource</th>
                  <th className="py-3 px-4 font-semibold">IP Address</th>
                  <th className="py-3 px-4 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAECF0] text-[#344054]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-[#667085]">
                      Loading audit entries…
                    </td>
                  </tr>
                ) : !data || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-[#667085]">
                      No audit events found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  data.items.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-[#17202A]">
                          {formatDateTime(log.createdAt, currentWorkspace?.timezone, currentWorkspace?.locale, 'medium')}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.user ? (
                          <div>
                            <p className="font-semibold text-[#17202A]">{log.user.name}</p>
                            <p className="text-[11px] text-[#667085]">{log.user.email}</p>
                          </div>
                        ) : log.userId ? (
                          <span className="font-mono text-[#667085]">{log.userId.slice(-6)}</span>
                        ) : (
                          <span className="italic text-[#98A2B3]">System</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getActionBadgeClass(
                            log.action,
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-[#17202A]">{log.resourceType}</span>
                        {log.resourceId && (
                          <span className="ml-1 text-[11px] font-mono text-[#667085]">
                            #{log.resourceId.slice(-6)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-[#667085]">
                        {log.ipAddress || '—'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 rounded border border-[#D0D5DD] bg-white px-2 py-1 text-xs font-semibold text-[#344054] hover:bg-[#F2F4F7]"
                        >
                          <Eye className="h-3 w-3" /> Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.meta && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E4E7EC] bg-[#F9FAFB] p-4 text-xs text-[#667085]">
              <div>
                Showing {(data.meta.page - 1) * data.meta.limit + (data.items.length > 0 ? 1 : 0)} to{' '}
                {Math.min(data.meta.page * data.meta.limit, data.meta.total)} of {data.meta.total} events
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={data.meta.page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 font-semibold text-[#344054] hover:bg-white disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <span>
                  Page {data.meta.page} of {Math.max(1, data.meta.totalPages)}
                </span>
                <button
                  type="button"
                  disabled={data.meta.page >= data.meta.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 font-semibold text-[#344054] hover:bg-white disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Metadata Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#EAECF0] pb-3">
                <div className="flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-[#E85D2A]" />
                  <h3 className="font-bold text-[#17202A]">Audit Event Details</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg p-1 text-[#667085] hover:bg-[#F2F4F7]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#F9FAFB] p-3">
                  <div>
                    <span className="font-semibold text-[#667085]">Action:</span>{' '}
                    <span className="font-mono text-[#17202A]">{selectedLog.action}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#667085]">Resource:</span>{' '}
                    <span className="font-mono text-[#17202A]">
                      {selectedLog.resourceType} {selectedLog.resourceId || ''}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#667085]">Timestamp:</span>{' '}
                    <span>{new Date(selectedLog.createdAt).toISOString()}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#667085]">IP Address:</span>{' '}
                    <span className="font-mono">{selectedLog.ipAddress || 'None'}</span>
                  </div>
                </div>

                <div>
                  <p className="mb-1 font-semibold text-[#344054]">
                    Redacted Event Metadata (Secrets & Tokens Automatically Masked):
                  </p>
                  <pre className="max-h-72 overflow-auto rounded-lg border border-[#E4E7EC] bg-[#1E293B] p-3 font-mono text-[11px] text-emerald-400">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
