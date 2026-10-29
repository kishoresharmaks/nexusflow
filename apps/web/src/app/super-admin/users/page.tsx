'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  api,
  SuperAdminUserItem,
  SuperAdminUsersResponse,
  SuperAdminUserDetails,
} from '../../../lib/api';
import {
  Users,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Eye,
  KeyRound,
  LogOut,
  UserX,
  UserCheck,
  Building2,
  Clock,
  Laptop,
} from 'lucide-react';

export default function SuperAdminUsersPage() {
  const [usersResponse, setUsersResponse] = useState<SuperAdminUsersResponse | null>(null);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Inspector Modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<SuperAdminUserDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Action Modals
  const [suspendModalUser, setSuspendModalUser] = useState<SuperAdminUserItem | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  const [confirmReactivateUser, setConfirmReactivateUser] = useState<SuperAdminUserItem | null>(null);
  const [confirmRevokeUser, setConfirmRevokeUser] = useState<SuperAdminUserItem | null>(null);
  const [confirmResetUser, setConfirmResetUser] = useState<SuperAdminUserItem | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSuperAdminUsers({
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setUsersResponse(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch user directory.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const openUserDetails = async (userId: string) => {
    setSelectedUserId(userId);
    setIsLoadingDetails(true);
    try {
      const details = await api.getSuperAdminUserDetails(userId);
      setUserDetails(details);
    } catch (err) {
      setError((err as Error).message || 'Failed to load user details.');
      setSelectedUserId(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendModalUser || !suspensionReason.trim()) return;
    setIsSubmittingAction(true);
    setError(null);
    try {
      await api.suspendSuperAdminUser(suspendModalUser.id, suspensionReason.trim());
      setSuccessMessage(`Account for ${suspendModalUser.email} has been suspended.`);
      setSuspendModalUser(null);
      setSuspensionReason('');
      await fetchUsers();
    } catch (err) {
      setError((err as Error).message || 'Failed to suspend account.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleReactivate = async () => {
    if (!confirmReactivateUser) return;
    setIsSubmittingAction(true);
    setError(null);
    try {
      await api.reactivateSuperAdminUser(confirmReactivateUser.id);
      setSuccessMessage(`Account for ${confirmReactivateUser.email} has been reinstated.`);
      setConfirmReactivateUser(null);
      await fetchUsers();
    } catch (err) {
      setError((err as Error).message || 'Failed to reactivate account.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!confirmRevokeUser) return;
    setIsSubmittingAction(true);
    setError(null);
    try {
      const res = await api.revokeSuperAdminUserSessions(confirmRevokeUser.id);
      setSuccessMessage(`Terminated ${res.revokedCount} active session(s) for ${confirmRevokeUser.email}.`);
      setConfirmRevokeUser(null);
      await fetchUsers();
    } catch (err) {
      setError((err as Error).message || 'Failed to revoke sessions.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!confirmResetUser) return;
    setIsSubmittingAction(true);
    setError(null);
    try {
      const res = await api.triggerSuperAdminUserPasswordReset(confirmResetUser.id);
      setSuccessMessage(res.message || `Password reset link dispatched to ${confirmResetUser.email}.`);
      setConfirmResetUser(null);
    } catch (err) {
      setError((err as Error).message || 'Failed to trigger password reset.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const totalUsers = usersResponse?.pagination.total ?? 0;
  const activeUsersCount = usersResponse?.users.filter((u) => !u.isSuspended).length ?? 0;
  const suspendedUsersCount = usersResponse?.users.filter((u) => u.isSuspended).length ?? 0;
  const adminUsersCount = usersResponse?.users.filter((u) => !!u.platformAdmin).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              User Accounts & Identities
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
              Tenant Directory
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centrally oversee registered platform identities, enforce account suspensions, invalidate suspicious sessions, and inspect workspace memberships.
          </p>
        </div>

        <button
          onClick={() => void fetchUsers()}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Directory</span>
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
            <span className="font-medium text-slate-500">Total Registered</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">{totalUsers}</div>
          <p className="text-[11px] text-slate-500 mt-1">Platform user identities</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Active Accounts</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-emerald-700 mt-2">{activeUsersCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Good standing on page</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-rose-500/5 blur-2xl group-hover:bg-rose-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Suspended</span>
            <div className="h-7 w-7 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <UserX className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-rose-700 mt-2">{suspendedUsersCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Authentication revoked</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs group hover:border-slate-300 transition-all">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-500/5 blur-2xl group-hover:bg-violet-500/10 transition-all" />
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium text-slate-500">Platform Admins</span>
            <div className="h-7 w-7 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600">
              <Shield className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-violet-700 mt-2">{adminUsersCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Privileged super administrators</p>
        </div>
      </div>

      {/* Filter Controls — Waymark Bar */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or user ID..."
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
            setStatusFilter(e.target.value as 'all' | 'active' | 'suspended');
            setPage(1);
          }}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="suspended">Suspended Only</option>
        </select>
      </div>

      {/* Directory Table — Waymark Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-mono tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Workspaces</th>
                <th className="py-3 px-4">Sessions</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    <span>Loading user accounts from database...</span>
                  </td>
                </tr>
              ) : !usersResponse?.users || usersResponse.users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">No users match the search criteria.</p>
                  </td>
                </tr>
              ) : (
                usersResponse.users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* User Identity */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs uppercase shrink-0">
                          {u.name.slice(0, 2) || 'NF'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900">{u.name}</span>
                            {u.platformAdmin && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {u.platformAdmin.role}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 text-[11px] font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Workspaces */}
                    <td className="py-3.5 px-4">
                      {u.workspaces.length === 0 ? (
                        <span className="text-slate-400 italic">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {u.workspaces.slice(0, 2).map((ws) => (
                            <span
                              key={ws.id}
                              className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 border border-slate-200 text-slate-700 font-medium"
                            >
                              {ws.name} ({ws.role.toLowerCase()})
                            </span>
                          ))}
                          {u.workspaces.length > 2 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 border border-slate-200 text-slate-500">
                              +{u.workspaces.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Sessions */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            u.activeSessionsCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                        <span className="font-mono text-slate-700">
                          {u.activeSessionsCount} active
                        </span>
                        <span className="text-slate-400 text-[10px] font-mono">
                          ({u.totalSessions} total)
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {u.isSuspended ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200" title={u.suspensionReason || 'No reason provided'}>
                          <UserX className="h-3 w-3" />
                          <span>Suspended</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Active</span>
                        </span>
                      )}
                    </td>

                    {/* Registered */}
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => void openUserDetails(u.id)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all shadow-xs cursor-pointer"
                          title="View Identity & Session Inspector"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => setConfirmRevokeUser(u)}
                          disabled={u.activeSessionsCount === 0}
                          className="p-1.5 text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                          title="Revoke All Active Sessions"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => setConfirmResetUser(u)}
                          className="p-1.5 text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-all shadow-xs cursor-pointer"
                          title="Dispatch Password Reset"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>

                        {u.isSuspended ? (
                          <button
                            onClick={() => setConfirmReactivateUser(u)}
                            className="p-1.5 text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all shadow-xs cursor-pointer"
                            title="Reactivate User"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setSuspendModalUser(u)}
                            className="p-1.5 text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all shadow-xs cursor-pointer"
                            title="Suspend Account"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {usersResponse?.pagination && usersResponse.pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
            <div>
              Showing page <span className="font-bold text-slate-900">{usersResponse.pagination.page}</span> of{' '}
              <span className="font-bold text-slate-900">{usersResponse.pagination.totalPages}</span> ({usersResponse.pagination.total} total users)
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
                onClick={() => setPage((p) => Math.min(usersResponse.pagination.totalPages, p + 1))}
                disabled={page >= usersResponse.pagination.totalPages || isLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-700 shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL 1: User Details Drawer/Modal --- */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-sm uppercase">
                  {userDetails?.user.name.slice(0, 2) || 'NF'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>{userDetails?.user.name || 'Loading...'}</span>
                    {userDetails?.platformAdmin && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {userDetails.platformAdmin.role}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">{userDetails?.user.email}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedUserId(null);
                  setUserDetails(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isLoadingDetails ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                <span>Loading identity metadata & sessions...</span>
              </div>
            ) : userDetails ? (
              <div className="space-y-6 text-xs">
                {/* Account Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Account Status</span>
                    <span className={`font-semibold font-mono text-xs ${userDetails.user.isSuspended ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {userDetails.user.isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Email Verification</span>
                    <span className="font-semibold font-mono text-xs text-slate-900">
                      {userDetails.user.isEmailVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Workspaces</span>
                    <span className="font-semibold font-mono text-xs text-slate-900">{userDetails.workspaces.length} tenant(s)</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono">Sessions on Record</span>
                    <span className="font-semibold font-mono text-xs text-slate-900">{userDetails.sessions.length} logged</span>
                  </div>
                </div>

                {userDetails.user.isSuspended && userDetails.user.suspensionReason && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                    <div className="font-semibold text-[11px] mb-1 flex items-center gap-1.5 text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Suspension Reason (Audited)</span>
                    </div>
                    <p className="text-[11px] font-mono">{userDetails.user.suspensionReason}</p>
                    <span className="text-[10px] text-rose-600 block mt-1">
                      Suspended on: {new Date(userDetails.user.suspendedAt || '').toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Workspace Memberships */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Workspace Memberships</span>
                  </h4>
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono">
                        <tr>
                          <th className="py-2.5 px-3">Workspace Name</th>
                          <th className="py-2.5 px-3">Slug</th>
                          <th className="py-2.5 px-3">Role</th>
                          <th className="py-2.5 px-3">Plan</th>
                          <th className="py-2.5 px-3">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {userDetails.workspaces.map((m) => (
                          <tr key={m.membershipId} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-medium text-slate-900">{m.workspace.name}</td>
                            <td className="py-2 px-3 font-mono text-slate-500">{m.workspace.slug}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {m.role}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-700 font-mono font-semibold">{m.workspace.planTier}</td>
                            <td className="py-2 px-3 text-slate-500 font-mono">{new Date(m.joinedAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Active & Recent Sessions */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                    <Laptop className="h-3.5 w-3.5 text-purple-600" />
                    <span>Active & Recent Sessions</span>
                  </h4>
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono">
                        <tr>
                          <th className="py-2.5 px-3">IP Address</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Created</th>
                          <th className="py-2.5 px-3">Expires</th>
                          <th className="py-2.5 px-3">User Agent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {userDetails.sessions.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-mono text-slate-700">{s.ipAddress || 'Unknown IP'}</td>
                            <td className="py-2 px-3">
                              {s.isValid ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  VALID
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-slate-100 text-slate-500">
                                  {s.revokedAt ? 'REVOKED' : 'EXPIRED'}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-mono">{new Date(s.createdAt).toLocaleString()}</td>
                            <td className="py-2 px-3 text-slate-500 font-mono">{new Date(s.expiresAt).toLocaleString()}</td>
                            <td className="py-2 px-3 text-slate-500 truncate max-w-[180px] font-mono text-[10px]" title={s.userAgent || ''}>
                              {s.userAgent || 'None'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit Trail for this user */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-mono">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    <span>Recent Security & Audit Events</span>
                  </h4>
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    {userDetails.recentAuditLogs.length === 0 ? (
                      <p className="p-4 text-center text-slate-400 italic">No administrative actions on record for this user.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {userDetails.recentAuditLogs.map((log) => (
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
                  setSelectedUserId(null);
                  setUserDetails(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Suspend Account Modal --- */}
      {suspendModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-rose-200 p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Suspend Account</h3>
                <p className="text-xs text-rose-600 font-mono">{suspendModalUser.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Suspending this account will immediately revoke all active browser sessions, invalidate tokens, and prevent subsequent logins. This action is cryptographically logged.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Audited Suspension Reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Terms of Service violation, payment fraud, compromised credentials..."
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuspendModalUser(null);
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
                {isSubmittingAction ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                <span>Confirm Suspension</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Reactivate Account Confirmation --- */}
      {confirmReactivateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-emerald-200 p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reactivate Account</h3>
                <p className="text-xs text-emerald-700 font-mono">{confirmReactivateUser.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will lift the suspension and allow the user to authenticate again with their credentials.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmReactivateUser(null)}
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
                {isSubmittingAction ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                <span>Confirm Reactivation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Revoke Sessions Confirmation --- */}
      {confirmRevokeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-amber-200 p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <LogOut className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Revoke All Active Sessions</h3>
                <p className="text-xs text-amber-700 font-mono">{confirmRevokeUser.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will invalidate all current active sessions for this user across all browsers and devices. The user will be required to re-authenticate.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRevokeUser(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRevokeSessions()}
                disabled={isSubmittingAction}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                {isSubmittingAction ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                <span>Terminate Sessions</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 5: Trigger Password Reset --- */}
      {confirmResetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-sky-200 p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-sky-600">
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
                <KeyRound className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Dispatch Password Reset</h3>
                <p className="text-xs text-sky-700 font-mono">{confirmResetUser.email}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will generate a single-use cryptographically signed reset token and dispatch instructions to the user&apos;s registered email address.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetUser(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handlePasswordReset()}
                disabled={isSubmittingAction}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                {isSubmittingAction ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                <span>Dispatch Reset Email</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
