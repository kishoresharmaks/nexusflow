'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { api, type WorkspaceAdminSummary } from '../../lib/api';
import { SettingsLayout } from '../../components/settings-layout';
import {
  Users,
  Package,
  Share2,
  Send,
  Calendar,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  ArrowRight,
  RefreshCw,
  Activity,
  CreditCard,
  Globe,
} from 'lucide-react';
import {
  formatCurrency,
  formatDateTime,
} from '../../lib/formatters';

export default function SettingsOverviewPage() {
  const { currentWorkspace } = useAuth();
  const [summary, setSummary] = useState<WorkspaceAdminSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getWorkspaceAdminSummary(currentWorkspace.id);
      setSummary(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace admin summary.');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <SettingsLayout
      title="Admin Overview"
      description="Operational health, pending actions, and usage status across your workspace."
      headerAction={
        <button
          type="button"
          onClick={() => void loadSummary()}
          disabled={isLoading}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-[#D0D5DD] rounded-lg text-xs font-semibold text-[#344054] hover:bg-[#F2F4F7] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      }
    >
      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="font-bold underline ml-4 hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-[#E85D2A] animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#667085]">Computing workspace health and operational metrics…</p>
        </div>
      ) : summary ? (
        <div className="space-y-8">
          {/* Top metadata strip */}
          <div className="bg-white border border-[#E4E7EC] rounded-2xl p-5 shadow-xs grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
            <div>
              <span className="text-[#667085] block text-[11px]">Workspace</span>
              <span className="font-bold text-[#17202A] text-sm truncate block mt-0.5">
                {summary.workspace.name}
              </span>
            </div>
            <div>
              <span className="text-[#667085] block text-[11px]">Subscription Plan</span>
              <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#175CD3] border border-[#BFDBFE]">
                {summary.plan.planName} ({summary.plan.status})
              </span>
            </div>
            <div>
              <span className="text-[#667085] block text-[11px]">Timezone</span>
              <span className="font-semibold text-[#17202A] block mt-0.5">
                {summary.workspace.timezone || 'UTC'}
              </span>
            </div>
            <div>
              <span className="text-[#667085] block text-[11px]">Default Currency</span>
              <span className="font-semibold text-[#17202A] block mt-0.5">
                {summary.workspace.currency} ({summary.workspace.locale})
              </span>
            </div>
            <div>
              <span className="text-[#667085] block text-[11px]">Created</span>
              <span className="font-semibold text-[#17202A] block mt-0.5">
                {formatDateTime(summary.workspace.createdAt, summary.workspace.timezone, summary.workspace.locale, 'date')}
              </span>
            </div>
          </div>

          {/* Actionable items cards */}
          {summary.actionCards.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <AlertCircle className="w-4 h-4 text-[#E85D2A]" />
                <h2 className="text-sm font-bold text-[#17202A]">Items Requiring Attention</h2>
                <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#FEF3F2] text-[#B42318]">
                  {summary.actionCards.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary.actionCards.map((card) => {
                  const isUrgent = card.level === 'urgent';
                  const isWarning = card.level === 'warning';
                  const borderColor = isUrgent
                    ? 'border-red-200 bg-red-50/60'
                    : isWarning
                      ? 'border-amber-200 bg-amber-50/60'
                      : 'border-blue-200 bg-blue-50/60';
                  const iconColor = isUrgent
                    ? 'text-red-600'
                    : isWarning
                      ? 'text-amber-600'
                      : 'text-blue-600';
                  const Icon = isUrgent ? AlertTriangle : isWarning ? AlertCircle : Info;

                  return (
                    <div
                      key={card.id}
                      className={`p-4 rounded-xl border ${borderColor} flex flex-col justify-between shadow-xs transition-all hover:shadow-sm`}
                    >
                      <div>
                        <div className="flex items-start space-x-2.5 mb-1.5">
                          <Icon className={`w-4 h-4 ${iconColor} shrink-0 mt-0.5`} />
                          <h3 className="text-xs font-bold text-[#17202A]">{card.title}</h3>
                        </div>
                        <p className="text-[11px] text-[#475467] pl-6 leading-relaxed">
                          {card.description}
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-black/5 flex justify-end">
                        <Link
                          href={card.actionHref}
                          className="inline-flex items-center space-x-1 text-xs font-bold text-[#17202A] hover:text-[#E85D2A] transition-all"
                        >
                          <span>{card.actionLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compact counts */}
          <div>
            <h2 className="text-sm font-bold text-[#17202A] mb-3">Workspace Operational Counts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 shadow-xs">
                <div className="flex items-center space-x-2 text-[#667085] text-xs mb-1">
                  <Users className="w-4 h-4 text-[#0A66C2]" />
                  <span>Team Members</span>
                </div>
                <div className="text-xl font-bold text-[#17202A]">{summary.counts.teamMembers}</div>
                {summary.counts.pendingInvitations > 0 && (
                  <span className="text-[10px] text-[#667085] block mt-0.5">
                    +{summary.counts.pendingInvitations} invited
                  </span>
                )}
              </div>

              <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 shadow-xs">
                <div className="flex items-center space-x-2 text-[#667085] text-xs mb-1">
                  <Package className="w-4 h-4 text-[#16803C]" />
                  <span>Catalog Items</span>
                </div>
                <div className="text-xl font-bold text-[#17202A]">
                  {summary.counts.activeProducts}
                </div>
                <span className="text-[10px] text-[#667085] block mt-0.5">
                  {summary.counts.connectedStores} store connected
                </span>
              </div>

              <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 shadow-xs">
                <div className="flex items-center space-x-2 text-[#667085] text-xs mb-1">
                  <Share2 className="w-4 h-4 text-[#E1306C]" />
                  <span>Social Accounts</span>
                </div>
                <div className="text-xl font-bold text-[#17202A]">
                  {summary.counts.connectedSocialAccounts}
                </div>
                <span className="text-[10px] text-[#667085] block mt-0.5">Active profiles</span>
              </div>

              <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 shadow-xs">
                <div className="flex items-center space-x-2 text-[#667085] text-xs mb-1">
                  <Clock className="w-4 h-4 text-[#B45309]" />
                  <span>Awaiting Review</span>
                </div>
                <div className="text-xl font-bold text-[#17202A]">
                  {summary.counts.draftsAwaitingApproval}
                </div>
                <span className="text-[10px] text-[#667085] block mt-0.5">Approval queue</span>
              </div>

              <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 shadow-xs">
                <div className="flex items-center space-x-2 text-[#667085] text-xs mb-1">
                  <Calendar className="w-4 h-4 text-[#7E56D9]" />
                  <span>Scheduled</span>
                </div>
                <div className="text-xl font-bold text-[#17202A]">{summary.counts.scheduledPosts}</div>
                <span className="text-[10px] text-[#667085] block mt-0.5">Publish pipeline</span>
              </div>

              <div className="bg-white border border-[#E4E7EC] rounded-xl p-4 shadow-xs">
                <div className="flex items-center space-x-2 text-[#667085] text-xs mb-1">
                  <Send className="w-4 h-4 text-[#E85D2A]" />
                  <span>Published</span>
                </div>
                <div className="text-xl font-bold text-[#17202A]">{summary.counts.publishedPosts}</div>
                {summary.counts.failedPosts > 0 && (
                  <span className="text-[10px] text-[#B42318] block mt-0.5">
                    {summary.counts.failedPosts} failed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Entitlement meters */}
          <div className="bg-white border border-[#E4E7EC] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-[#E85D2A]" />
                <h2 className="text-sm font-bold text-[#17202A]">Entitlement Quota Usage</h2>
              </div>
              <Link
                href="/settings/billing"
                className="text-xs font-bold text-[#E85D2A] hover:underline"
              >
                Manage Billing & Upgrades →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              {/* Monthly posts meter */}
              <div>
                <div className="flex justify-between items-center mb-1 text-[11px]">
                  <span className="text-[#344054] font-semibold">Monthly Posts</span>
                  <span className="text-[#667085]">
                    {summary.plan.limits.currentPosts} / {summary.plan.limits.maxPosts}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#F2F4F7] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      summary.plan.limits.currentPosts >= summary.plan.limits.maxPosts
                        ? 'bg-[#B42318]'
                        : summary.plan.limits.currentPosts >= summary.plan.limits.maxPosts * 0.8
                          ? 'bg-[#B45309]'
                          : 'bg-[#E85D2A]'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (summary.plan.limits.currentPosts / summary.plan.limits.maxPosts) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Social accounts meter */}
              <div>
                <div className="flex justify-between items-center mb-1 text-[11px]">
                  <span className="text-[#344054] font-semibold">Social Channels</span>
                  <span className="text-[#667085]">
                    {summary.plan.limits.currentSocialAccounts} /{' '}
                    {summary.plan.limits.maxSocialAccounts}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#F2F4F7] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0A66C2] rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (summary.plan.limits.currentSocialAccounts /
                          summary.plan.limits.maxSocialAccounts) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Team members meter */}
              <div>
                <div className="flex justify-between items-center mb-1 text-[11px]">
                  <span className="text-[#344054] font-semibold">Team Seats</span>
                  <span className="text-[#667085]">
                    {summary.plan.limits.currentTeamMembers} / {summary.plan.limits.maxTeamMembers}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#F2F4F7] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#16803C] rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (summary.plan.limits.currentTeamMembers /
                          summary.plan.limits.maxTeamMembers) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Regional Localization Card */}
          <div className="bg-white border border-[#E4E7EC] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-[#E85D2A]" />
                <h2 className="text-sm font-bold text-[#17202A]">Regional & Localization Settings</h2>
              </div>
              <Link
                href="/settings/workspace"
                className="text-xs font-bold text-[#E85D2A] hover:underline"
              >
                Configure Localization →
              </Link>
            </div>
            <p className="text-xs text-[#667085] mb-4">
              Operational timezone and currency settings applied across product pricing, AI content generation, and scheduled posts.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E4E7EC]">
                <span className="text-[10px] text-[#667085] block font-semibold uppercase tracking-wider">
                  Operational Timezone
                </span>
                <span className="font-bold text-[#17202A] text-sm block mt-1">
                  {summary.workspace.timezone || 'UTC'}
                </span>
                <span className="text-[10px] text-[#667085] mt-0.5 block">
                  Current time: {formatDateTime(new Date(), summary.workspace.timezone, summary.workspace.locale, 'short')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E4E7EC]">
                <span className="text-[10px] text-[#667085] block font-semibold uppercase tracking-wider">
                  Store Currency
                </span>
                <span className="font-bold text-[#17202A] text-sm block mt-1">
                  {summary.workspace.currency}
                </span>
                <span className="text-[10px] text-[#667085] mt-0.5 block">
                  Sample Price: {formatCurrency(88595, summary.workspace.currency, summary.workspace.locale)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E4E7EC]">
                <span className="text-[10px] text-[#667085] block font-semibold uppercase tracking-wider">
                  Formatting Locale
                </span>
                <span className="font-bold text-[#17202A] text-sm block mt-1">
                  {summary.workspace.locale}
                </span>
                <span className="text-[10px] text-[#667085] mt-0.5 block">
                  Numbers & dates localized
                </span>
              </div>
            </div>
          </div>

          {/* Recent activity timeline */}
          <div className="bg-white border border-[#E4E7EC] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-[#E85D2A]" />
                <h2 className="text-sm font-bold text-[#17202A]">Recent Security & Governance Events</h2>
              </div>
              <Link
                href="/settings/audit-log"
                className="text-xs font-bold text-[#E85D2A] hover:underline"
              >
                View Full Audit Log →
              </Link>
            </div>

            {summary.recentActivity.length === 0 ? (
              <p className="text-xs text-[#667085] py-4 text-center">
                No recent workspace audit events recorded.
              </p>
            ) : (
              <div className="divide-y divide-[#F2F4F7]">
                {summary.recentActivity.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F2F4F7] text-[#344054]">
                        {log.action}
                      </span>
                      <span className="font-medium text-[#17202A]">
                        {log.actor?.name || log.actor?.email || 'System'}
                      </span>
                      <span className="text-[#667085] hidden sm:inline text-[11px]">
                        ({log.resourceType})
                      </span>
                    </div>
                    <span className="text-[11px] text-[#667085]">
                      {formatDateTime(log.createdAt, summary.workspace.timezone, summary.workspace.locale, 'medium')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </SettingsLayout>
  );
}
