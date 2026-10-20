'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import {
  api,
  type BillingPlanItem,
  type SubscriptionItem,
  type BillingUsageItem,
  type BillingEventItem,
} from '../../lib/api';
import { ProtectedRoute } from '../../components/protected-route';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Calendar,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  X,
  Check,
  Sliders,
  Users,
  Share2,
  FileText,
} from 'lucide-react';

const FALLBACK_PLANS: BillingPlanItem[] = [
  {
    id: 'FREE',
    name: 'Free Trial',
    description: 'Perfect for evaluating CommercePilot with your initial catalog.',
    priceCents: 0,
    currency: 'USD',
    billingInterval: 'month',
    maxMonthlyPosts: 10,
    maxMonthlyAiWords: 5000,
    maxSocialAccounts: 1,
    maxTeamMembers: 1,
    features: [
      'Single channel publishing',
      'Basic catalog import',
      '5,000 AI words/month',
      'Human review workflow',
    ],
  },
  {
    id: 'STARTER',
    name: 'Starter Merchant',
    description: 'Essential multi-channel publishing for emerging ecommerce stores.',
    priceCents: 2900,
    currency: 'USD',
    billingInterval: 'month',
    maxMonthlyPosts: 50,
    maxMonthlyAiWords: 50000,
    maxSocialAccounts: 3,
    maxTeamMembers: 3,
    features: [
      'Up to 3 connected social channels',
      '50 scheduled posts/month',
      '50,000 grounded AI words/month',
      'Brand voice customization',
      'CSV catalog sync',
      'Email support',
    ],
  },
  {
    id: 'GROWTH',
    name: 'Growth Brand',
    description: 'High-volume content automation with approval chains and analytics.',
    priceCents: 7900,
    currency: 'USD',
    billingInterval: 'month',
    maxMonthlyPosts: 200,
    maxMonthlyAiWords: 200000,
    maxSocialAccounts: 10,
    maxTeamMembers: 10,
    features: [
      'Up to 10 connected social channels',
      '200 scheduled posts/month',
      '200,000 grounded AI words/month',
      'Multi-tier review & approval policies',
      'Private S3 media library',
      'Priority publishing queue',
      'Dedicated account support',
    ],
  },
  {
    id: 'PRO',
    name: 'Scale & Agency',
    description: 'Uncapped marketing automation for multi-brand agencies and top retailers.',
    priceCents: 19900,
    currency: 'USD',
    billingInterval: 'month',
    maxMonthlyPosts: 1000,
    maxMonthlyAiWords: 1000000,
    maxSocialAccounts: 25,
    maxTeamMembers: 50,
    features: [
      'Up to 25 connected social channels',
      '1,000 scheduled posts/month',
      '1,000,000 AI words/month',
      'Custom webhook triggers',
      'Multi-workspace agency management',
      'SLA-backed publishing delivery',
      '24/7 dedicated support',
    ],
  },
];

export default function BillingPage() {
  const { currentWorkspace } = useAuth();
  const workspaceId = currentWorkspace?.id;

  const [plans, setPlans] = useState<BillingPlanItem[]>(FALLBACK_PLANS);
  const [subscription, setSubscription] = useState<SubscriptionItem | null>(null);
  const [usage, setUsage] = useState<BillingUsageItem | null>(null);
  const [history, setHistory] = useState<BillingEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Checkout modal
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanItem | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [_checkoutResult, setCheckoutResult] = useState<{
    sessionId: string;
    orderId: string;
  } | null>(null);

  // Cancel dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);

  const loadBillingData = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const [fetchedPlans, fetchedSub, fetchedUsage, fetchedHistory] = await Promise.allSettled([
        api.getBillingPlans(workspaceId),
        api.getBillingSubscription(workspaceId),
        api.getBillingUsage(workspaceId),
        api.getBillingHistory(workspaceId),
      ]);

      if (fetchedPlans.status === 'fulfilled') setPlans(fetchedPlans.value);
      if (fetchedSub.status === 'fulfilled') setSubscription(fetchedSub.value);
      if (fetchedUsage.status === 'fulfilled') setUsage(fetchedUsage.value);
      if (fetchedHistory.status === 'fulfilled') setHistory(fetchedHistory.value);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    let mounted = true;
    const fetchBilling = async () => {
      if (!workspaceId) return;
      setIsLoading(true);
      try {
        const [fetchedPlans, fetchedSub, fetchedUsage, fetchedHistory] = await Promise.allSettled([
          api.getBillingPlans(workspaceId),
          api.getBillingSubscription(workspaceId),
          api.getBillingUsage(workspaceId),
          api.getBillingHistory(workspaceId),
        ]);

        if (!mounted) return;
        if (fetchedPlans.status === 'fulfilled') setPlans(fetchedPlans.value);
        if (fetchedSub.status === 'fulfilled') setSubscription(fetchedSub.value);
        if (fetchedUsage.status === 'fulfilled') setUsage(fetchedUsage.value);
        if (fetchedHistory.status === 'fulfilled') setHistory(fetchedHistory.value);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void fetchBilling();
    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  const handleStartCheckout = async (plan: BillingPlanItem) => {
    if (!workspaceId) return;
    setSelectedPlan(plan);
    setIsCheckingOut(true);
    try {
      const res = await api.createBillingCheckout(workspaceId, plan.id);
      setCheckoutResult({
        sessionId: res.sessionId,
        orderId: res.orderId,
      });
      setFeedbackMsg({ text: `Checkout initiated for ${plan.name}.` });
    } catch (err: unknown) {
      setFeedbackMsg({
        text: err instanceof Error ? err.message : 'Failed to create checkout session.',
        isError: true,
      });
      setSelectedPlan(null);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleConfirmActivatePlan = async () => {
    if (!workspaceId || !selectedPlan) return;
    setIsCheckingOut(true);
    try {
      const updated = await api.activateBillingPlan(workspaceId, selectedPlan.id);
      setSubscription(updated);
      setFeedbackMsg({ text: `Successfully subscribed to ${selectedPlan.name}!` });
      setSelectedPlan(null);
      setCheckoutResult(null);
      await loadBillingData();
    } catch (err: unknown) {
      setFeedbackMsg({
        text: err instanceof Error ? err.message : 'Failed to activate plan subscription.',
        isError: true,
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!workspaceId) return;
    setIsCanceling(true);
    try {
      const updated = await api.cancelBillingSubscription(
        workspaceId,
        cancelReason || 'User requested cancel',
      );
      setSubscription(updated);
      setFeedbackMsg({
        text: 'Your subscription will be canceled at the end of the current billing cycle.',
      });
      setShowCancelDialog(false);
      setCancelReason('');
    } catch (err: unknown) {
      setFeedbackMsg({
        text: err instanceof Error ? err.message : 'Failed to cancel subscription.',
        isError: true,
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const currentPlanId = subscription?.planId || 'FREE';
  const currentPlan = plans.find((p) => p.id === currentPlanId) || FALLBACK_PLANS[0];

  return (
    <ProtectedRoute
      fallbackTitle="Billing & Subscriptions Access"
      fallbackDescription="Sign in to view workspace subscriptions, plan entitlements, and payment history."
    >
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                Billing & Subscriptions
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                PCI & Webhook Verified
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your workspace plan, track consumption quotas, and review billing receipts.
            </p>
          </div>

          <button
            onClick={() => void loadBillingData()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl border border-input bg-background hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {feedbackMsg && (
          <div
            className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-3 animate-in fade-in ${
              feedbackMsg.isError
                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Current Active Plan Overview Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Current Plan
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                  subscription?.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : subscription?.status === 'PAST_DUE'
                      ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {subscription?.status || 'ACTIVE'}
              </span>
            </div>

            <div>
              <h2 className="text-3xl font-black text-foreground">{currentPlan?.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">{currentPlan?.description}</p>
            </div>

            <div className="pt-2 border-t border-border/50 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Pricing
                </span>
                <span className="font-semibold text-foreground">
                  {currentPlan?.priceCents === 0
                    ? '$0 / Free'
                    : `$${((currentPlan?.priceCents ?? 0) / 100).toFixed(0)}/mo`}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Renewal Date
                </span>
                <span className="font-medium text-foreground">
                  {subscription?.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                    : 'Ongoing'}
                </span>
              </div>
              {subscription?.cancelAtPeriodEnd && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  Cancels on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
                </div>
              )}
            </div>

            {currentPlanId !== 'FREE' && !subscription?.cancelAtPeriodEnd && (
              <button
                onClick={() => setShowCancelDialog(true)}
                className="w-full text-xs font-medium text-destructive hover:underline pt-2 text-center block cursor-pointer"
              >
                Cancel Subscription
              </button>
            )}
          </div>

          {/* Usage Meters */}
          <div className="lg:col-span-2 rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Cycle Usage & Entitlements</h3>
                <p className="text-xs text-muted-foreground">
                  Real-time resource meters for current billing cycle.
                </p>
              </div>
              <Sliders className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {/* Posts */}
              <div className="space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <FileText className="w-3.5 h-3.5 text-primary" /> Scheduled Posts
                  </span>
                  <span className="text-muted-foreground font-semibold">
                    {usage?.metrics?.monthlyPosts?.used ?? 0} /{' '}
                    {usage?.metrics?.monthlyPosts?.limit ?? currentPlan?.maxMonthlyPosts}
                  </span>
                </div>
                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${usage?.metrics?.monthlyPosts?.percentage ?? 0}%` }}
                  />
                </div>
              </div>

              {/* AI Words */}
              <div className="space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Grounded AI Words
                  </span>
                  <span className="text-muted-foreground font-semibold">
                    {(usage?.metrics?.monthlyAiWords?.used ?? 0).toLocaleString()} /{' '}
                    {(
                      usage?.metrics?.monthlyAiWords?.limit ?? currentPlan?.maxMonthlyAiWords
                    )?.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{ width: `${usage?.metrics?.monthlyAiWords?.percentage ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Social Accounts */}
              <div className="space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Share2 className="w-3.5 h-3.5 text-blue-500" /> Connected Channels
                  </span>
                  <span className="text-muted-foreground font-semibold">
                    {usage?.metrics?.socialAccounts?.used ?? 0} /{' '}
                    {usage?.metrics?.socialAccounts?.limit ?? currentPlan?.maxSocialAccounts}
                  </span>
                </div>
                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${usage?.metrics?.socialAccounts?.percentage ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Team Members */}
              <div className="space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Users className="w-3.5 h-3.5 text-emerald-500" /> Team Seats
                  </span>
                  <span className="text-muted-foreground font-semibold">
                    {usage?.metrics.teamMembers.used ?? 1} /{' '}
                    {usage?.metrics.teamMembers.limit ?? currentPlan?.maxTeamMembers}
                  </span>
                </div>
                <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${usage?.metrics.teamMembers.percentage ?? 20}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Plan Tiers Selection */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Subscription Plans & Upgrade Tiers
            </h2>
            <p className="text-xs text-muted-foreground">
              Choose the volume and automation tier tailored to your commerce catalog scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const isPopular = plan.id === 'GROWTH';

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 relative ${
                    isCurrent
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-md'
                      : isPopular
                        ? 'border-amber-500/40 bg-card shadow-lg hover:border-amber-500/70'
                        : 'border-border/80 bg-card hover:border-border shadow-sm'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-0.5 text-[10px] font-bold text-white shadow uppercase tracking-wider">
                      Most Popular
                    </span>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 min-h-[32px]">
                        {plan.description}
                      </p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-foreground">
                        {plan.priceCents === 0 ? '$0' : `$${(plan.priceCents / 100).toFixed(0)}`}
                      </span>
                      <span className="text-xs text-muted-foreground">/ month</span>
                    </div>

                    <div className="pt-3 border-t border-border/50 space-y-2.5 text-xs">
                      {plan.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2 text-foreground/90">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl text-xs font-semibold bg-muted text-muted-foreground border border-border/50 cursor-default"
                      >
                        Current Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleStartCheckout(plan)}
                        className={`w-full py-2.5 rounded-xl text-xs font-semibold shadow transition-all cursor-pointer ${
                          isPopular
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        }`}
                      >
                        Upgrade to {plan.name}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Billing History Table */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Payment History & Receipts
              </h2>
              <p className="text-xs text-muted-foreground">
                Verified payment events recorded via cryptographic webhooks.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
            {history.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No billing events recorded for this workspace yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Payment ID</th>
                      <th className="px-6 py-3">Event</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {history.map((event) => (
                      <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3.5 font-medium text-foreground">
                          {new Date(event.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-muted-foreground">
                          {event.providerPaymentId}
                        </td>
                        <td className="px-6 py-3.5 font-medium">{event.eventType}</td>
                        <td className="px-6 py-3.5 font-semibold text-foreground">
                          ${(event.amountCents / 100).toFixed(2)} {event.currency}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Paid
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Checkout Modal */}
        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Subscription Upgrade</h3>
                    <p className="text-xs text-muted-foreground">Upgrade to {selectedPlan.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border/60 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan Tier</span>
                  <span className="font-bold text-foreground">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing Interval</span>
                  <span className="font-medium text-foreground">Monthly</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2 text-sm font-bold">
                  <span>Total Due Today</span>
                  <span>${(selectedPlan.priceCents / 100).toFixed(2)} USD</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => void handleConfirmActivatePlan()}
                  disabled={isCheckingOut}
                  className="w-full py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground shadow hover:bg-primary/90 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isCheckingOut ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Confirm & Activate Subscription
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-muted-foreground">
                  Live payment orders verify signatures and reconcile subscription status via HMAC
                  webhooks.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cancellation Modal */}
        {showCancelDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
              <div className="flex items-center gap-3 text-destructive">
                <div className="p-2 rounded-xl bg-destructive/10">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Cancel Subscription</h3>
                  <p className="text-xs text-muted-foreground">
                    Your access remains active until the end of the billing period.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Reason for canceling (Optional)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Tell us what could be improved..."
                  rows={3}
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelDialog(false)}
                  className="px-4 py-2 rounded-xl border border-input text-xs font-medium hover:bg-accent"
                >
                  Keep Subscription
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmCancel()}
                  disabled={isCanceling}
                  className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold shadow hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isCanceling ? 'Canceling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
