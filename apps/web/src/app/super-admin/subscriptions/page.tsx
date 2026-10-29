'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  api,
  BillingPlanItem,
  SuperAdminBillingSummary,
  SuperAdminSubscriptionItem,
} from '../../../lib/api';
import {
  CreditCard,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  XCircle,
  Building2,
  Plus,
  Edit3,
  Trash2,
  Layers,
  Sliders,
  Check,
  X,
  Shield,
} from 'lucide-react';

export default function SuperAdminSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'plans'>('subscriptions');

  // Summary & Subscriptions State
  const [summary, setSummary] = useState<SuperAdminBillingSummary | null>(null);
  const [subscriptions, setSubscriptions] = useState<SuperAdminSubscriptionItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Plans Catalog State
  const [plans, setPlans] = useState<BillingPlanItem[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(false);

  // Modals State
  const [cancelModalSub, setCancelModalSub] = useState<SuperAdminSubscriptionItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isImmediateCancel, setIsImmediateCancel] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Change Workspace Plan Modal
  const [changePlanSub, setChangePlanSub] = useState<SuperAdminSubscriptionItem | null>(null);
  const [targetPlanTier, setTargetPlanTier] = useState<string>('STARTER');
  const [isChangingPlan, setIsChangingPlan] = useState<boolean>(false);

  // Create Plan Modal
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState<boolean>(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState<boolean>(false);
  const [createPlanForm, setCreatePlanForm] = useState({
    id: '',
    name: '',
    description: '',
    priceDollars: '29',
    billingInterval: 'month' as 'month' | 'year',
    maxMonthlyPosts: '50',
    maxMonthlyAiWords: '50000',
    maxSocialAccounts: '3',
    maxTeamMembers: '3',
    features: '50 Grounded Posts / mo\n50k AI Words / mo\n3 Social Channels\n3 Team Seats\nCatalog Freshness Verification',
  });

  // Edit Plan Modal
  const [editingPlan, setEditingPlan] = useState<BillingPlanItem | null>(null);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState<boolean>(false);
  const [editPlanForm, setEditPlanForm] = useState({
    name: '',
    description: '',
    priceDollars: '0',
    billingInterval: 'month' as 'month' | 'year',
    maxMonthlyPosts: '0',
    maxMonthlyAiWords: '0',
    maxSocialAccounts: '0',
    maxTeamMembers: '0',
    features: '',
    isActive: true,
  });

  // Delete Plan Modal
  const [deletingPlan, setDeletingPlan] = useState<BillingPlanItem | null>(null);
  const [isDeletingPlan, setIsDeletingPlan] = useState<boolean>(false);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await api.getSuperAdminBillingSummary();
      setSummary(data);
    } catch (err) {
      console.warn('Failed to fetch billing summary:', err);
    }
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getSuperAdminSubscriptions({
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      setSubscriptions(data.subscriptions);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch subscriptions.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter]);

  const fetchPlans = useCallback(async () => {
    setIsLoadingPlans(true);
    try {
      const data = await api.getSuperAdminPlans();
      if (Array.isArray(data)) {
        setPlans(data);
      }
    } catch (err) {
      console.warn('Failed to load plans:', err);
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    void fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  // Cancel Subscription Submit
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalSub || !cancelReason.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.cancelSuperAdminSubscription(cancelModalSub.id, {
        reason: cancelReason.trim(),
        immediate: isImmediateCancel,
      });
      setSuccessMessage(
        `Subscription for ${cancelModalSub.workspace.name} has been ${
          isImmediateCancel ? 'immediately canceled and downgraded' : 'scheduled for cancellation at period end'
        }.`,
      );
      setCancelModalSub(null);
      setCancelReason('');
      setIsImmediateCancel(false);
      void fetchSummary();
      void fetchSubscriptions();
    } catch (err) {
      setError((err as Error).message || 'Failed to cancel subscription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Change Workspace Plan Submit
  const handleChangePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changePlanSub) return;

    setIsChangingPlan(true);
    setError(null);
    try {
      await api.updateSuperAdminWorkspaceLimits(changePlanSub.workspace.id, {
        planTier: targetPlanTier,
      });
      setSuccessMessage(
        `Successfully changed plan for workspace "${changePlanSub.workspace.name}" to ${targetPlanTier}.`,
      );
      setChangePlanSub(null);
      void fetchSubscriptions();
      void fetchSummary();
    } catch (err) {
      setError((err as Error).message || 'Failed to update workspace plan tier.');
    } finally {
      setIsChangingPlan(false);
    }
  };

  // Create Plan Submit
  const handleCreatePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createPlanForm.id.trim() || !createPlanForm.name.trim()) return;

    setIsCreatingPlan(true);
    setError(null);
    try {
      const priceCents = Math.round(parseFloat(createPlanForm.priceDollars || '0') * 100);
      const featureList = createPlanForm.features
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);

      const created = await api.createSuperAdminPlan({
        id: createPlanForm.id.trim().toUpperCase(),
        name: createPlanForm.name.trim(),
        description: createPlanForm.description.trim(),
        priceCents,
        billingInterval: createPlanForm.billingInterval,
        maxMonthlyPosts: parseInt(createPlanForm.maxMonthlyPosts, 10) || 0,
        maxMonthlyAiWords: parseInt(createPlanForm.maxMonthlyAiWords, 10) || 0,
        maxSocialAccounts: parseInt(createPlanForm.maxSocialAccounts, 10) || 0,
        maxTeamMembers: parseInt(createPlanForm.maxTeamMembers, 10) || 0,
        features: featureList,
        isActive: true,
      });

      setPlans((prev) => [...prev.filter((p) => p.id !== created.id), created]);
      setSuccessMessage(`Plan "${created.name}" (${created.id}) created successfully.`);
      setIsCreatePlanOpen(false);
      setCreatePlanForm({
        id: '',
        name: '',
        description: '',
        priceDollars: '29',
        billingInterval: 'month',
        maxMonthlyPosts: '50',
        maxMonthlyAiWords: '50000',
        maxSocialAccounts: '3',
        maxTeamMembers: '3',
        features: '50 Grounded Posts / mo\n50k AI Words / mo\n3 Social Channels\n3 Team Seats',
      });
    } catch (err) {
      setError((err as Error).message || 'Failed to create plan.');
    } finally {
      setIsCreatingPlan(false);
    }
  };

  // Open Edit Plan Modal
  const openEditPlan = (plan: BillingPlanItem) => {
    setEditingPlan(plan);
    setEditPlanForm({
      name: plan.name,
      description: plan.description || '',
      priceDollars: (plan.priceCents / 100).toString(),
      billingInterval: plan.billingInterval || 'month',
      maxMonthlyPosts: plan.maxMonthlyPosts.toString(),
      maxMonthlyAiWords: plan.maxMonthlyAiWords.toString(),
      maxSocialAccounts: plan.maxSocialAccounts.toString(),
      maxTeamMembers: plan.maxTeamMembers.toString(),
      features: (plan.features || []).join('\n'),
      isActive: true,
    });
  };

  // Update Plan Submit
  const handleUpdatePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setIsUpdatingPlan(true);
    setError(null);
    try {
      const priceCents = Math.round(parseFloat(editPlanForm.priceDollars || '0') * 100);
      const featureList = editPlanForm.features
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);

      const updated = await api.updateSuperAdminPlan(editingPlan.id, {
        name: editPlanForm.name.trim(),
        description: editPlanForm.description.trim(),
        priceCents,
        billingInterval: editPlanForm.billingInterval,
        maxMonthlyPosts: parseInt(editPlanForm.maxMonthlyPosts, 10) || 0,
        maxMonthlyAiWords: parseInt(editPlanForm.maxMonthlyAiWords, 10) || 0,
        maxSocialAccounts: parseInt(editPlanForm.maxSocialAccounts, 10) || 0,
        maxTeamMembers: parseInt(editPlanForm.maxTeamMembers, 10) || 0,
        features: featureList,
        isActive: editPlanForm.isActive,
      });

      setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccessMessage(`Plan "${updated.name}" (${updated.id}) updated successfully.`);
      setEditingPlan(null);
    } catch (err) {
      setError((err as Error).message || 'Failed to update plan.');
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  // Delete Plan Submit
  const handleDeletePlanSubmit = async () => {
    if (!deletingPlan) return;

    setIsDeletingPlan(true);
    setError(null);
    try {
      await api.deleteSuperAdminPlan(deletingPlan.id);
      setPlans((prev) => prev.filter((p) => p.id !== deletingPlan.id));
      setSuccessMessage(`Plan "${deletingPlan.name}" (${deletingPlan.id}) removed from custom catalog.`);
      setDeletingPlan(null);
    } catch (err) {
      setError((err as Error).message || 'Failed to delete plan.');
    } finally {
      setIsDeletingPlan(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Active
          </span>
        );
      case 'TRIALING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Clock className="h-3 w-3" /> Trialing
          </span>
        );
      case 'PAST_DUE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3 w-3" /> Past Due
          </span>
        );
      case 'CANCELED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="h-3 w-3" /> Canceled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
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
              Platform Billing & Subscriptions
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
              Monetization Fleet
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage multi-tenant subscriptions, track recurring revenue (MRR/ARR), and administer plan lifecycles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'plans' && (
            <button
              onClick={() => setIsCreatePlanOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add New Plan</span>
            </button>
          )}
          <button
            onClick={() => {
              void fetchSummary();
              void fetchSubscriptions();
              void fetchPlans();
            }}
            disabled={isLoading || isLoadingPlans}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading || isLoadingPlans ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'subscriptions'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Tenant Subscriptions</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
            {total}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'plans'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Subscription Plans & Entitlements</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] font-mono bg-indigo-50 text-indigo-700">
            {plans.length}
          </span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-slate-900 text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs flex items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-slate-900 text-xs font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: TENANT SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <>
          {/* Revenue & Subscription KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-all" />
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium text-slate-500">Estimated MRR</span>
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">
                {summary ? formatCurrency(summary.mrrCents) : '...'}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                ARR: {summary ? formatCurrency(summary.arrCents) : '...'}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-sky-500/10 blur-2xl group-hover:bg-sky-500/20 transition-all" />
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium text-slate-500">Active Subscriptions</span>
                <div className="h-7 w-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-700">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight text-emerald-700 mt-2">
                {summary ? summary.subscriptions.active : '...'}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                Trialing: {summary ? summary.subscriptions.trialing : 0} • Past due: {summary ? summary.subscriptions.pastDue : 0}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all" />
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium text-slate-500">Total Historical Revenue</span>
                <div className="h-7 w-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-700">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">
                {summary ? formatCurrency(summary.totalRevenueCents) : '...'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Captured from real billing event charges
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 backdrop-blur-xl group hover:border-slate-300 transition-all">
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl group-hover:bg-amber-500/20 transition-all" />
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium text-slate-500">Plan Distribution</span>
                <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700">
                  <CreditCard className="h-4 w-4" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                  Free: {summary?.planDistribution['FREE'] ?? 0}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                  Starter: {summary?.planDistribution['STARTER'] ?? 0}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                  Growth: {(summary?.planDistribution['GROWTH'] ?? summary?.planDistribution['PROFESSIONAL']) ?? 0}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                  Pro: {(summary?.planDistribution['PRO'] ?? summary?.planDistribution['ENTERPRISE']) ?? 0}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Active workspaces by tier
              </p>
            </div>
          </div>

          {/* Subscriptions Table Card */}
          <div className="rounded-2xl border border-slate-200 bg-white backdrop-blur-md overflow-hidden">
            {/* Table Filters */}
            <div className="p-3 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 bg-white">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by workspace or plan..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all"
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="TRIALING">Trialing</option>
                  <option value="PAST_DUE">Past Due</option>
                  <option value="CANCELED">Canceled</option>
                </select>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-mono text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Workspace Tenant</th>
                    <th className="px-5 py-3.5">Plan ID</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Current Period</th>
                    <th className="px-5 py-3.5">Renewal Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-700" />
                        Loading subscriptions...
                      </td>
                    </tr>
                  ) : subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                        No subscriptions found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase shrink-0">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{sub.workspace.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">/{sub.workspace.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono font-medium text-slate-800">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {sub.planId}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {getStatusBadge(sub.status)}
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-mono text-[11px]">
                          <div>
                            {new Date(sub.currentPeriodStart).toLocaleDateString()} –{' '}
                            {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {sub.cancelAtPeriodEnd ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-700 border border-amber-500/20">
                              Cancels at Period End
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                              Auto-renews
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => {
                                setChangePlanSub(sub);
                                setTargetPlanTier(sub.planId.toUpperCase());
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Sliders className="h-3 w-3" /> Change Plan
                            </button>
                            {sub.status !== 'CANCELED' ? (
                              <button
                                onClick={() => setCancelModalSub(sub)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-mono">Inactive</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
              <div>
                Showing {subscriptions.length} of {total} subscriptions
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 transition shadow-xs cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-semibold text-slate-700 font-mono">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 transition shadow-xs cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: SUBSCRIPTION PLANS & ENTITLEMENTS */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white border border-indigo-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-indigo-600" />
                Platform Subscription Plans & Entitlements Hub
              </h2>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                Configure plan pricing, quota ceilings (posts, AI words, social channels, seats), and features. Changes instantly reflect across public pricing endpoints and workspace enforcement gates.
              </p>
            </div>
            <button
              onClick={() => setIsCreatePlanOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer self-start sm:self-center shrink-0"
            >
              <Plus className="h-4 w-4" /> Add New Plan Tier
            </button>
          </div>

          {isLoadingPlans ? (
            <div className="p-12 text-center text-slate-500 rounded-2xl border border-slate-200 bg-white">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading subscription plans...
            </div>
          ) : plans.length === 0 ? (
            <div className="p-12 text-center text-slate-500 rounded-2xl border border-slate-200 bg-white space-y-3">
              <Layers className="h-8 w-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">No Custom Plans Defined</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Currently running on system default plans (Free, Starter, Growth, Scale). Click below to create a custom plan tier.
              </p>
              <button
                onClick={() => setIsCreatePlanOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Create Plan
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs relative group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {plan.id}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {plan.billingInterval === 'year' ? 'Annual Billing' : 'Monthly Billing'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 min-h-[36px] line-clamp-2">
                      {plan.description || 'No description provided.'}
                    </p>

                    <div className="mt-4 pb-4 border-b border-slate-100">
                      <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                        ${(plan.priceCents / 100).toFixed(0)}
                        <span className="text-xs font-normal text-slate-500 font-sans ml-1">
                          /{plan.billingInterval === 'year' ? 'yr' : 'mo'}
                        </span>
                      </div>
                    </div>

                    {/* Entitlement Badges */}
                    <div className="py-4 space-y-2 border-b border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Monthly Posts:</span>
                        <span className="font-semibold text-slate-900 font-mono">
                          {plan.maxMonthlyPosts.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">AI Words Ceiling:</span>
                        <span className="font-semibold text-slate-900 font-mono">
                          {plan.maxMonthlyAiWords.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Social Accounts:</span>
                        <span className="font-semibold text-slate-900 font-mono">
                          {plan.maxSocialAccounts}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Team Seats:</span>
                        <span className="font-semibold text-slate-900 font-mono">
                          {plan.maxTeamMembers}
                        </span>
                      </div>
                    </div>

                    {/* Feature Checklist */}
                    <div className="pt-4">
                      <p className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-500 mb-2">
                        Included Features
                      </p>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {(plan.features || []).map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openEditPlan(plan)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-slate-500" /> Edit Plan
                    </button>
                    {plan.id !== 'FREE' ? (
                      <button
                        onClick={() => setDeletingPlan(plan)}
                        className="inline-flex items-center justify-center p-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
                        title="Delete Plan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="p-2 text-slate-400" title="Free tier is immutable system baseline">
                        <Shield className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE PLAN MODAL */}
      {isCreatePlanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
                  <Plus className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Add New Subscription Plan</h3>
              </div>
              <button
                onClick={() => setIsCreatePlanOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlanSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Plan Code ID (Unique, e.g. ENTERPRISE) *
                  </label>
                  <input
                    type="text"
                    required
                    value={createPlanForm.id}
                    onChange={(e) => setCreatePlanForm((f) => ({ ...f, id: e.target.value.toUpperCase() }))}
                    placeholder="ENTERPRISE"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={createPlanForm.name}
                    onChange={(e) => setCreatePlanForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Enterprise Plus"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={createPlanForm.description}
                  onChange={(e) => setCreatePlanForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="For large brands and multi-brand agencies"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price (USD $) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={createPlanForm.priceDollars}
                    onChange={(e) => setCreatePlanForm((f) => ({ ...f, priceDollars: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Billing Interval *
                  </label>
                  <select
                    value={createPlanForm.billingInterval}
                    onChange={(e) =>
                      setCreatePlanForm((f) => ({
                        ...f,
                        billingInterval: e.target.value as 'month' | 'year',
                      }))
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="month">Monthly (/mo)</option>
                    <option value="year">Annual (/yr)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Monthly Posts
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={createPlanForm.maxMonthlyPosts}
                    onChange={(e) => setCreatePlanForm((f) => ({ ...f, maxMonthlyPosts: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    AI Words Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={createPlanForm.maxMonthlyAiWords}
                    onChange={(e) => setCreatePlanForm((f) => ({ ...f, maxMonthlyAiWords: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Social Channels
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={createPlanForm.maxSocialAccounts}
                    onChange={(e) => setCreatePlanForm((f) => ({ ...f, maxSocialAccounts: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Team Seats
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={createPlanForm.maxTeamMembers}
                    onChange={(e) => setCreatePlanForm((f) => ({ ...f, maxTeamMembers: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Features (one per line)
                </label>
                <textarea
                  rows={4}
                  value={createPlanForm.features}
                  onChange={(e) => setCreatePlanForm((f) => ({ ...f, features: e.target.value }))}
                  placeholder="50 Grounded Posts / mo&#10;50k AI Words / mo&#10;3 Social Channels"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatePlanOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPlan}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {isCreatingPlan ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Creating...
                    </>
                  ) : (
                    'Save New Plan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PLAN MODAL */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Edit Subscription Plan</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Plan Code: {editingPlan.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePlanSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={editPlanForm.name}
                  onChange={(e) => setEditPlanForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editPlanForm.description}
                  onChange={(e) => setEditPlanForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price (USD $) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={editPlanForm.priceDollars}
                    onChange={(e) => setEditPlanForm((f) => ({ ...f, priceDollars: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Billing Interval *
                  </label>
                  <select
                    value={editPlanForm.billingInterval}
                    onChange={(e) =>
                      setEditPlanForm((f) => ({
                        ...f,
                        billingInterval: e.target.value as 'month' | 'year',
                      }))
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="month">Monthly (/mo)</option>
                    <option value="year">Annual (/yr)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Monthly Posts
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editPlanForm.maxMonthlyPosts}
                    onChange={(e) => setEditPlanForm((f) => ({ ...f, maxMonthlyPosts: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    AI Words Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editPlanForm.maxMonthlyAiWords}
                    onChange={(e) => setEditPlanForm((f) => ({ ...f, maxMonthlyAiWords: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Social Channels
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editPlanForm.maxSocialAccounts}
                    onChange={(e) => setEditPlanForm((f) => ({ ...f, maxSocialAccounts: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Team Seats
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editPlanForm.maxTeamMembers}
                    onChange={(e) => setEditPlanForm((f) => ({ ...f, maxTeamMembers: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Features (one per line)
                </label>
                <textarea
                  rows={4}
                  value={editPlanForm.features}
                  onChange={(e) => setEditPlanForm((f) => ({ ...f, features: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPlan}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {isUpdatingPlan ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PLAN MODAL */}
      {deletingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Remove Plan Tier</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove the plan <strong className="text-slate-900 font-mono">{deletingPlan.name} ({deletingPlan.id})</strong>? Workspaces currently subscribed to this tier will keep their current period until reassigned.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingPlan(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePlanSubmit}
                disabled={isDeletingPlan}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isDeletingPlan ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Deleting...
                  </>
                ) : (
                  'Confirm Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE WORKSPACE PLAN MODAL */}
      {changePlanSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in">
          <div className="bg-white border border-indigo-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-indigo-600">
              <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200">
                <Sliders className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Change Tenant Subscription Plan</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Select a new plan tier for tenant <strong className="text-slate-900">{changePlanSub.workspace.name}</strong> (currently on <span className="font-mono text-indigo-700 font-semibold">{changePlanSub.planId}</span>).
            </p>

            <form onSubmit={handleChangePlanSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Plan Tier
                </label>
                <select
                  value={targetPlanTier}
                  onChange={(e) => setTargetPlanTier(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="FREE">FREE (Baseline - 5 posts/mo, 10k AI words)</option>
                  <option value="STARTER">STARTER ($29/mo - 50 posts/mo, 50k AI words, 3 channels)</option>
                  <option value="GROWTH">GROWTH ($79/mo - 200 posts/mo, 200k AI words, 10 channels)</option>
                  <option value="PRO">PRO / SCALE ($199/mo - 1,000 posts/mo, 1M AI words, 25 channels)</option>
                  {plans
                    .filter((p) => !['FREE', 'STARTER', 'GROWTH', 'PRO'].includes(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id} - ${p.priceCents / 100}/{p.billingInterval})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setChangePlanSub(null)}
                  disabled={isChangingPlan}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPlan}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {isChangingPlan ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Updating...
                    </>
                  ) : (
                    'Confirm Plan Change'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {cancelModalSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in">
          <div className="bg-white border border-rose-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 backdrop-blur-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Cancel Workspace Subscription</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              You are about to cancel the subscription for tenant{' '}
              <strong className="text-slate-900">{cancelModalSub.workspace.name}</strong> ({cancelModalSub.planId}).
              This action will be permanently recorded in the security audit log.
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cancellation Reason (Required)
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Requested by customer via support ticket #1248"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500/40 focus:border-rose-500/50"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="immediateCancel"
                  checked={isImmediateCancel}
                  onChange={(e) => setIsImmediateCancel(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="immediateCancel" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Immediate cancellation (instantly downgrades workspace to Free tier)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCancelModalSub(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !cancelReason.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Processing...
                    </>
                  ) : (
                    'Confirm Cancellation'
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
