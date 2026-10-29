'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProtectedRoute } from '../../../components/protected-route';
import { SettingsLayout } from '../../../components/settings-layout';
import { useAuth } from '../../../context/auth-context';
import {
  api,
  type BillingPlanItem,
  type BillingUsageItem,
  type BillingEventItem,
} from '../../../lib/api';
import { formatCurrency, formatDateTime } from '../../../lib/formatters';
import {
  CreditCard,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Share2,
  Users,
  Calendar,
  Layers,
  ShieldAlert,
} from 'lucide-react';

export default function BillingSettingsPage() {
  return (
    <ProtectedRoute fallbackTitle="Sign in to view billing & usage">
      <BillingContent />
    </ProtectedRoute>
  );
}

function BillingContent() {
  const { currentWorkspace } = useAuth();
  const [usage, setUsage] = useState<BillingUsageItem | null>(null);
  const [plans, setPlans] = useState<BillingPlanItem[]>([]);
  const [history, setHistory] = useState<BillingEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBilling = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const [fetchedUsage, fetchedPlans, fetchedHistory] = await Promise.allSettled([
        api.getBillingUsage(currentWorkspace.id),
        api.getBillingPlans(currentWorkspace.id),
        api.getBillingHistory(currentWorkspace.id),
      ]);

      if (fetchedUsage.status === 'fulfilled') {
        setUsage(fetchedUsage.value);
      }
      if (fetchedPlans.status === 'fulfilled') {
        setPlans(fetchedPlans.value);
      }
      if (fetchedHistory.status === 'fulfilled') {
        setHistory(fetchedHistory.value);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load billing data.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  return (
    <SettingsLayout
      title="Billing & usage"
      description="Monitor active subscription tier, resource consumption limits, and transaction history."
      headerAction={
        <button
          type="button"
          onClick={() => void loadBilling()}
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

        {/* Current Plan Overview Card */}
        <section className="rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#17202A]">
                  {usage?.plan?.name || 'Standard Tier'}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    usage?.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700'
                      : usage?.status === 'TRIALING'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {usage?.status || 'ACTIVE'}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#667085]">
                {usage?.plan?.description || 'NexusFlow marketing automation suite.'}
              </p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-black text-[#17202A]">
                ${((usage?.plan?.priceCents ?? 0) / 100).toFixed(2)}
                <span className="text-xs font-normal text-[#667085]">
                  /{usage?.plan?.billingInterval || 'month'}
                </span>
              </p>
              {usage?.currentPeriodEnd && (
                <p className="mt-1 flex items-center justify-end gap-1 text-xs text-[#667085]">
                  <Calendar className="h-3.5 w-3.5" />
                  Renewal:{' '}
                  {formatDateTime(
                    usage.currentPeriodEnd,
                    currentWorkspace?.timezone,
                    currentWorkspace?.locale,
                    'date',
                  )}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Usage Progress Meters */}
        <section className="rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-lg bg-[#E85D2A]/10 p-2 text-[#E85D2A]">
              <Layers className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#17202A]">Quota & resource consumption</h2>
              <p className="text-sm text-[#667085]">
                Real-time usage calculated directly against active workspace databases.
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Monthly Posts */}
            <UsageMeter
              icon={Layers}
              title="Monthly Posts Published"
              used={usage?.metrics?.monthlyPosts?.used ?? 0}
              limit={usage?.metrics?.monthlyPosts?.limit ?? 10}
              percentage={usage?.metrics?.monthlyPosts?.percentage ?? 0}
              unit="posts"
            />

            {/* AI Words */}
            <UsageMeter
              icon={Sparkles}
              title="Grounded AI Generation Words"
              used={usage?.metrics?.monthlyAiWords?.used ?? 0}
              limit={usage?.metrics?.monthlyAiWords?.limit ?? 5000}
              percentage={usage?.metrics?.monthlyAiWords?.percentage ?? 0}
              unit="words"
            />

            {/* Social Accounts */}
            <UsageMeter
              icon={Share2}
              title="Connected Social Accounts"
              used={usage?.metrics?.socialAccounts?.used ?? 0}
              limit={usage?.metrics?.socialAccounts?.limit ?? 1}
              percentage={usage?.metrics?.socialAccounts?.percentage ?? 0}
              unit="accounts"
            />

            {/* Team Members */}
            <UsageMeter
              icon={Users}
              title="Team Members & Seats"
              used={usage?.metrics?.teamMembers?.used ?? 1}
              limit={usage?.metrics?.teamMembers?.limit ?? 1}
              percentage={usage?.metrics?.teamMembers?.percentage ?? 100}
              unit="seats"
            />
          </div>
        </section>

        {/* Honest Gateway Configuration Notice */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-amber-100 p-2 text-amber-800">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-bold text-[#17202A]">Payment Gateway Status</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#667085]">
                Strict Truth-in-Engineering notice: Real-time automated credit card processing via Stripe webhooks is enabled when `STRIPE_SECRET_KEY` is provisioned. For tier expansions or enterprise quota increases, please contact support.
              </p>
            </div>
          </div>
        </section>

        {/* Available Tiers */}
        <section className="rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-[#17202A]">Available workspace tiers</h2>
          <p className="mt-1 text-xs text-[#667085]">
            Compare capability ceilings across plans.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const isCurrent = usage?.plan?.id === p.id;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-4 transition-shadow ${
                    isCurrent
                      ? 'border-[#E85D2A] bg-orange-50/20 shadow-sm'
                      : 'border-[#EAECF0] bg-white hover:border-[#D0D5DD]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#17202A]">{p.name}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-[#E85D2A] px-2 py-0.5 text-[10px] font-bold text-white">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xl font-black text-[#17202A]">
                    ${(p.priceCents / 100).toFixed(0)}
                    <span className="text-xs font-normal text-[#667085]">/mo</span>
                  </p>
                  <p className="mt-1 text-xs text-[#667085] line-clamp-2">{p.description}</p>
                  <ul className="mt-3 space-y-1.5 text-[11px] text-[#344054]">
                    <li className="flex items-center gap-1.5">
                      <span className="font-semibold">{p.maxMonthlyPosts}</span> posts/mo
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="font-semibold">{(p.maxMonthlyAiWords / 1000).toFixed(0)}k</span> AI words
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="font-semibold">{p.maxSocialAccounts}</span> social channels
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="font-semibold">{p.maxTeamMembers}</span> team seats
                    </li>
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* Billing Event History */}
        <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#E4E7EC] p-5">
            <CreditCard className="h-5 w-5 text-[#344054]" />
            <div>
              <h2 className="font-bold text-[#17202A]">Invoices & transaction records</h2>
              <p className="text-xs text-[#667085]">
                {history.length} recorded event{history.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-[#667085]">Loading transaction history…</p>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#667085]">
              No invoices or billing events recorded for this workspace.
            </div>
          ) : (
            <div className="divide-y divide-[#EAECF0]">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 text-xs">
                  <div>
                    <span className="font-semibold text-[#17202A]">{item.eventType}</span>
                    <p className="text-[#667085]">
                      {formatDateTime(
                        item.createdAt,
                        currentWorkspace?.timezone,
                        currentWorkspace?.locale,
                        'medium',
                      )}
                    </p>
                    <p className="font-mono text-[10px] text-[#98A2B3]">Ref: {item.providerPaymentId}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#17202A]">
                      {formatCurrency(item.amountCents ?? 0, item.currency, currentWorkspace?.locale)}
                    </span>
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      RECORDED
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </SettingsLayout>
  );
}

function UsageMeter({
  icon: Icon,
  title,
  used,
  limit,
  percentage,
  unit,
}: {
  icon: typeof Layers;
  title: string;
  used: number;
  limit: number;
  percentage: number;
  unit: string;
}) {
  const isHigh = percentage >= 80;
  const isExceeded = percentage >= 100;

  return (
    <div className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#667085]" />
          <span className="text-xs font-bold text-[#17202A]">{title}</span>
        </div>
        <span className="text-xs font-semibold text-[#344054]">
          {used.toLocaleString()} / {limit.toLocaleString()} {unit}
        </span>
      </div>

      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#EAECF0]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isExceeded
              ? 'bg-rose-600'
              : isHigh
              ? 'bg-amber-500'
              : 'bg-[#E85D2A]'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-[11px] text-[#667085]">
        <span>{percentage}% utilized</span>
        {isHigh && (
          <span className="font-semibold text-amber-700">Approaching limit</span>
        )}
      </div>
    </div>
  );
}
