'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { ProtectedRoute } from '../../components/protected-route';
import { formatCurrency } from '../../lib/formatters';
import {
  api,
  type AnalyticsOverview,
  type DailyMetricPoint,
  type BestTimeRecommendation,
  type CampaignAnalyticsItem,
  type ChannelAnalyticsItem,
  type ProductAnalyticsItem,
  type RecentConversionItem,
} from '../../lib/api';
import {
  TrendingUp,
  DollarSign,
  MousePointer,
  Eye,
  ShoppingBag,
  Download,
  Calendar,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
  BarChart3,
  Percent,
  X,
  Share2,
  Tag,
  Package,
  Layers,
  ArrowUpRight,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsContent />
    </ProtectedRoute>
  );
}

type TrendMetric = 'revenue' | 'orders' | 'clicks' | 'cvr';

function AnalyticsContent() {
  const { currentWorkspace } = useAuth();
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [timeseries, setTimeseries] = useState<DailyMetricPoint[]>([]);
  const [bestTimes, setBestTimes] = useState<BestTimeRecommendation[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignAnalyticsItem[]>([]);
  const [channels, setChannels] = useState<ChannelAnalyticsItem[]>([]);
  const [products, setProducts] = useState<ProductAnalyticsItem[]>([]);
  const [recentConversions, setRecentConversions] = useState<RecentConversionItem[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<TrendMetric>('revenue');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    setError(null);
    try {
      const [ov, ts, bt, camps, chs, prods, convs] = await Promise.all([
        api.getAnalyticsOverview(currentWorkspace.id, periodDays),
        api.getAnalyticsTimeseries(currentWorkspace.id, periodDays),
        api.getAnalyticsBestTimes(currentWorkspace.id),
        api.getAnalyticsCampaigns(currentWorkspace.id, periodDays),
        api.getAnalyticsChannels(currentWorkspace.id, periodDays),
        api.getAnalyticsProducts(currentWorkspace.id, periodDays),
        api.getAnalyticsRecentConversions(currentWorkspace.id, periodDays, 10),
      ]);
      setOverview(ov);
      setTimeseries(ts);
      setBestTimes(bt);
      setCampaigns(camps);
      setChannels(chs);
      setProducts(prods);
      setRecentConversions(convs);
    } catch (err) {
      setError((err as Error).message || 'Failed to load analytics data.');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, periodDays]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleExport = async (format: 'csv' | 'json') => {
    if (!currentWorkspace) return;
    setIsExporting(true);
    try {
      const res = await api.exportAnalyticsReport(currentWorkspace.id, format);
      const dataStr =
        format === 'csv'
          ? res.data || ''
          : JSON.stringify(res, null, 2);

      const blob = new Blob([dataStr], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `analytics-report-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const currency = currentWorkspace?.currency || 'USD';
  const locale = currentWorkspace?.locale;

  // Chart calculation metrics
  const metricValues = useMemo(() => {
    return timeseries.map((t) => {
      if (selectedMetric === 'revenue') return t.revenueCents / 100;
      if (selectedMetric === 'orders') return t.conversions;
      if (selectedMetric === 'clicks') return t.clicks;
      // cvr
      return t.clicks > 0 ? Number(((t.conversions / t.clicks) * 100).toFixed(2)) : 0;
    });
  }, [timeseries, selectedMetric]);

  const maxVal = Math.max(...metricValues, 1);
  const minVal = Math.min(...metricValues, 0);

  // SVG Area coordinates
  const svgPoints = useMemo(() => {
    if (timeseries.length === 0) return '';
    const width = 800;
    const height = 180;
    const step = width / Math.max(timeseries.length - 1, 1);

    return metricValues
      .map((val, idx) => {
        const x = idx * step;
        const normalized = (val - minVal) / Math.max(maxVal - minVal, 1);
        const y = height - normalized * (height - 30) - 15;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [metricValues, minVal, maxVal, timeseries.length]);

  const svgAreaPath = useMemo(() => {
    if (!svgPoints) return '';
    const pointsArr = svgPoints.split(' ');
    const firstX = pointsArr[0]?.split(',')[0] || '0';
    const lastX = pointsArr[pointsArr.length - 1]?.split(',')[0] || '800';
    return `M ${firstX},180 L ${svgPoints} L ${lastX},180 Z`;
  }, [svgPoints]);

  const totalPeriodClicks = overview?.totalClicks ?? 0;
  const totalPeriodRevenue = overview?.totalRevenueCents ?? 0;
  const revenuePerClick =
    totalPeriodClicks > 0
      ? formatCurrency(Math.round(totalPeriodRevenue / totalPeriodClicks), currency, locale)
      : '$0.00';

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between pb-6 border-b border-[#E4E7EC] gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-[#E85D2A] flex items-center justify-center shrink-0 shadow-md shadow-[#E85D2A]/20">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[#17202A] tracking-tight">
                Attribution &amp; Performance Analytics
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5] flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Data
              </span>
            </div>
            <p className="text-sm text-[#667085] mt-1">
              Multi-touch conversion tracking, campaign attribution, top products, and empirical posting windows.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {/* Period Selector */}
          <div className="flex bg-[#F9FAFB] p-1 rounded-xl border border-[#E4E7EC] text-xs font-semibold shadow-inner">
            {[7, 14, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriodDays(days)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  periodDays === days
                    ? 'bg-white text-[#17202A] shadow-sm border border-[#E4E7EC] font-bold'
                    : 'text-[#667085] hover:text-[#17202A]'
                }`}
              >
                Last {days} Days
              </button>
            ))}
          </div>

          <button
            onClick={() => void loadData()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-[#E4E7EC] rounded-xl text-xs font-semibold text-[#344054] bg-white hover:bg-[#F9FAFB] transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#E85D2A]' : ''}`} />
            Refresh
          </button>

          <div className="flex items-center rounded-xl overflow-hidden border border-[#E85D2A]/30 shadow-sm">
            <button
              onClick={() => void handleExport('csv')}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#E85D2A] text-white text-xs font-semibold hover:bg-[#D44D1E] transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              onClick={() => void handleExport('json')}
              disabled={isExporting}
              className="px-2.5 py-2 bg-[#D44D1E] hover:bg-[#b83d15] text-white text-xs font-semibold border-l border-white/20 transition-all cursor-pointer"
              title="Export as JSON"
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-600 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 transition-colors cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 5 Hero Bento KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
        {/* Total Attributed Revenue */}
        <div className="p-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Attributed Revenue
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-[#17202A] tracking-tight">
            {formatCurrency(overview?.totalRevenueCents ?? 0, currency, locale)}
          </div>
          <div className="text-xs text-[#667085] mt-1 flex items-center gap-1">
            <span
              className={`font-semibold ${
                (overview?.growth?.revenue ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {(overview?.growth?.revenue ?? 0) >= 0 ? '+' : ''}
              {overview?.growth?.revenue ?? 0}%
            </span>{' '}
            vs prev period
          </div>
        </div>

        {/* Store Conversions & AOV */}
        <div className="p-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Store Conversions
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-[#17202A] tracking-tight">
            {overview?.totalConversions ?? 0}{' '}
            <span className="text-xs font-normal text-[#667085]">orders</span>
          </div>
          <div className="text-xs text-[#667085] mt-1 truncate">
            Avg Order:{' '}
            <span className="font-semibold text-[#17202A]">
              {formatCurrency(overview?.averageOrderValueCents ?? 0, currency, locale)}
            </span>
          </div>
        </div>

        {/* Tracked Clicks */}
        <div className="p-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Tracked Clicks
            </span>
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <MousePointer className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-[#17202A] tracking-tight">
            {(overview?.totalClicks ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#667085] mt-1 flex items-center gap-1">
            <span
              className={`font-semibold ${
                (overview?.growth?.clicks ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {(overview?.growth?.clicks ?? 0) >= 0 ? '+' : ''}
              {overview?.growth?.clicks ?? 0}%
            </span>{' '}
            traffic velocity
          </div>
        </div>

        {/* CTR & Impressions */}
        <div className="p-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Click-Through Rate (CTR)
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-[#17202A] tracking-tight">
            {overview?.clickThroughRate ?? 0}%
          </div>
          <div className="text-xs text-[#667085] mt-1 truncate">
            From {(overview?.totalImpressions ?? 0).toLocaleString()} impressions
          </div>
        </div>

        {/* Conversion Rate & RPC */}
        <div className="p-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Conversion Rate (CVR)
            </span>
            <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-[#17202A] tracking-tight">
            {overview?.conversionRate ?? 0}%
          </div>
          <div className="text-xs text-[#667085] mt-1 truncate">
            RPC: <span className="font-semibold text-[#17202A]">{revenuePerClick}</span> / click
          </div>
        </div>
      </div>

      {/* Interactive Multi-Metric Trend Chart */}
      <div className="mt-8 p-6 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E4E7EC] gap-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-[#17202A]">
              <BarChart3 className="h-5 w-5 text-[#E85D2A]" />
              Daily Traffic &amp; Conversion Velocity
            </h2>
            <p className="text-xs text-[#667085] mt-0.5">
              Multi-dimensional timeseries metrics across your marketing campaigns.
            </p>
          </div>

          {/* Metric Selector Pills */}
          <div className="flex bg-[#F9FAFB] p-1 rounded-xl border border-[#E4E7EC] text-xs font-semibold shrink-0">
            {[
              { id: 'revenue', label: 'Revenue ($)', icon: DollarSign },
              { id: 'orders', label: 'Orders (#)', icon: ShoppingBag },
              { id: 'clicks', label: 'Clicks (#)', icon: MousePointer },
              { id: 'cvr', label: 'Conversion Rate (%)', icon: Percent },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMetric(m.id as TrendMetric)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  selectedMetric === m.id
                    ? 'bg-white text-[#17202A] shadow-sm border border-[#E4E7EC] font-bold'
                    : 'text-[#667085] hover:text-[#17202A]'
                }`}
              >
                <m.icon className="h-3 w-3" />
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Responsive Area Chart */}
        <div className="pt-6">
          <div className="relative w-full h-52">
            <svg
              viewBox="0 0 800 180"
              preserveAspectRatio="none"
              className="w-full h-full overflow-visible"
            >
              <defs>
                <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E85D2A" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#E85D2A" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="45" x2="800" y2="45" stroke="#F2F4F7" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="90" x2="800" y2="90" stroke="#F2F4F7" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="135" x2="800" y2="135" stroke="#F2F4F7" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="180" x2="800" y2="180" stroke="#E4E7EC" strokeWidth="1" />

              {/* Area & Stroke */}
              {svgPoints && (
                <>
                  <path d={svgAreaPath} fill="url(#metricGradient)" />
                  <polyline
                    fill="none"
                    stroke="#E85D2A"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={svgPoints}
                  />
                </>
              )}
            </svg>

            {/* Hover Points Overlay */}
            <div className="absolute inset-0 flex items-stretch">
              {timeseries.map((pt, idx) => {
                const val = metricValues[idx] ?? 0;
                return (
                  <div
                    key={pt.date}
                    className="flex-1 h-full relative group cursor-pointer"
                  >
                    <div className="hidden group-hover:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-[#E85D2A]/40" />
                    <div className="hidden group-hover:block absolute top-2 left-1/2 -translate-x-1/2 bg-[#17202A] text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap z-30 font-mono">
                      <div className="text-slate-300 font-sans text-[10px]">{pt.date}</div>
                      <div className="font-bold text-[#E85D2A]">
                        {selectedMetric === 'revenue' && formatCurrency(pt.revenueCents, currency, locale)}
                        {selectedMetric === 'orders' && `${pt.conversions} orders`}
                        {selectedMetric === 'clicks' && `${pt.clicks} clicks`}
                        {selectedMetric === 'cvr' && `${val.toFixed(2)}% CVR`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date Axis & Summary Strip */}
          <div className="flex items-center justify-between pt-3 text-xs text-[#667085] border-t border-[#E4E7EC] mt-2">
            <span>{timeseries[0]?.date || 'Start of period'}</span>
            <div className="flex items-center gap-4 text-xs font-semibold text-[#17202A]">
              <span>
                Total: <span className="font-mono text-[#E85D2A]">
                  {selectedMetric === 'revenue' && formatCurrency(overview?.totalRevenueCents ?? 0, currency, locale)}
                  {selectedMetric === 'orders' && `${overview?.totalConversions ?? 0}`}
                  {selectedMetric === 'clicks' && `${overview?.totalClicks ?? 0}`}
                  {selectedMetric === 'cvr' && `${overview?.conversionRate ?? 0}%`}
                </span>
              </span>
              <span>
                Daily Avg:{' '}
                <span className="font-mono text-slate-700">
                  {timeseries.length > 0
                    ? (
                        metricValues.reduce((a, b) => a + b, 0) / timeseries.length
                      ).toFixed(selectedMetric === 'revenue' ? 2 : 1)
                    : 0}
                </span>
              </span>
            </div>
            <span>{timeseries[timeseries.length - 1]?.date || 'Today'}</span>
          </div>
        </div>
      </div>

      {/* Two-Column Middle Section: Channels & AI Posting Times */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Channel & Traffic Source Distribution */}
        <div className="p-6 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-[#E85D2A]" />
                <h2 className="text-base font-bold text-[#17202A]">
                  Channel &amp; Traffic Source Distribution
                </h2>
              </div>
              <span className="text-xs font-semibold text-[#667085]">
                {channels.reduce((s, c) => s + c.clicks, 0)} clicks tracked
              </span>
            </div>

            <div className="space-y-4 mt-5">
              {channels.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#667085]">
                  No channel traffic recorded yet. Publish posts with tracking links to populate.
                </div>
              ) : (
                channels.map((ch) => (
                  <div key={ch.channel} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#17202A] flex items-center gap-1.5">
                        {ch.channel}
                        <span className="text-[10px] font-normal text-[#667085]">
                          ({ch.sharePercentage}%)
                        </span>
                      </span>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className="text-slate-600">{ch.clicks} clicks</span>
                        <span className="text-emerald-600 font-bold">
                          {formatCurrency(ch.revenueCents, currency, locale)}
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-[#F2F4F7] overflow-hidden">
                      <div
                        style={{ width: `${Math.max(ch.sharePercentage, 2)}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          ch.channel === 'Instagram'
                            ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                            : ch.channel === 'LinkedIn'
                            ? 'bg-blue-600'
                            : ch.channel === 'Facebook'
                            ? 'bg-indigo-600'
                            : 'bg-[#E85D2A]'
                        }`}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#E4E7EC] text-xs text-[#667085] flex items-center justify-between">
            <span>Attributed via UTM link parameters &amp; platform referrers</span>
            <Link
              href="/campaigns"
              className="text-[#E85D2A] hover:underline font-semibold flex items-center gap-1"
            >
              Manage Campaigns <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Recommended Post Times */}
        <div className="p-6 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h2 className="text-base font-bold text-[#17202A]">Recommended Post Times</h2>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                AI Empirical
              </span>
            </div>

            <p className="text-xs text-[#667085] mt-2 mb-4">
              Peak engagement and purchase conversion windows based on historical link traffic and audience activity.
            </p>

            <div className="space-y-3">
              {bestTimes.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] hover:bg-[#F2F4F7] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs flex items-center gap-2 text-[#17202A]">
                      <Clock className="h-3.5 w-3.5 text-[#E85D2A]" />
                      {item.formattedTime}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                      {item.confidenceScore}% Match
                    </span>
                  </div>
                  <p className="text-xs text-[#667085] mt-1.5 leading-relaxed">{item.reason}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#E4E7EC] text-xs text-[#667085] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#E85D2A]" /> Times shown in UTC
            </span>
            <Link
              href="/composer"
              className="px-3 py-1.5 rounded-lg bg-[#E85D2A] text-white font-semibold hover:bg-[#D44D1E] transition-all flex items-center gap-1 text-xs"
            >
              <span>Schedule Post</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Campaign Attribution Performance Matrix */}
      <div className="mt-8 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E4E7EC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#E85D2A]" />
              <h2 className="text-base font-bold text-[#17202A]">
                Campaign Attribution Performance Matrix
              </h2>
            </div>
            <p className="text-xs text-[#667085] mt-0.5">
              Full attribution breakdown of revenue, orders, and clicks per active marketing campaign.
            </p>
          </div>
          <Link
            href="/campaigns"
            className="text-xs font-semibold text-[#E85D2A] hover:underline flex items-center gap-1 shrink-0"
          >
            Create New Campaign <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E7EC] bg-[#F9FAFB] text-[#475467] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Campaign</th>
                <th className="py-3 px-4">UTM Tag</th>
                <th className="py-3 px-4 text-center">Posts</th>
                <th className="py-3 px-4 text-right">Clicks</th>
                <th className="py-3 px-4 text-right">Orders</th>
                <th className="py-3 px-4 text-right">CVR (%)</th>
                <th className="py-3 px-4 text-right">Revenue</th>
                <th className="py-3 px-4 text-right">AOV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-[#667085]">
                    No campaigns created yet. Start a campaign to track multi-channel attribution.
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#17202A]">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-[#E85D2A] shrink-0" />
                        <span className="truncate max-w-[200px]">{camp.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#475467]">
                      {camp.utmCampaign || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">{camp.postsCount}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-800">
                      {camp.clicks}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-bold">
                      {camp.conversions}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          camp.conversionRate > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'text-slate-500'
                        }`}
                      >
                        {camp.conversionRate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(camp.revenueCents, currency, locale)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#667085]">
                      {formatCurrency(camp.averageOrderValueCents, currency, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-Column Bottom Section: Top Products & Recent Attributed Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Top Converting Products */}
        <div className="p-6 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#E85D2A]" />
                <h2 className="text-base font-bold text-[#17202A]">Top Converting Products</h2>
              </div>
              <Link
                href="/catalog"
                className="text-xs font-semibold text-[#E85D2A] hover:underline flex items-center gap-1"
              >
                View Catalog <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-3.5 mt-4">
              {products.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#667085]">
                  No products with attributed traffic yet. Connect your catalog and link products in posts.
                </div>
              ) : (
                products.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] hover:bg-white hover:shadow-sm transition-all text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.title}
                          className="h-10 w-10 rounded-lg object-cover border border-[#E4E7EC] shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-[#E4E7EC] flex items-center justify-center text-slate-500 shrink-0">
                          <Package className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-[#17202A] truncate max-w-[200px]" title={prod.title}>
                          {prod.title}
                        </div>
                        <div className="text-[10px] text-[#667085] font-mono">
                          {prod.sku || 'SKU-NONE'} • {formatCurrency(prod.priceCents, prod.currency, locale)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-slate-900 font-mono">
                        {formatCurrency(prod.revenueCents, prod.currency, locale)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {prod.conversions} orders ({prod.clicks} clicks)
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent Attributed Orders Stream */}
        <div className="p-6 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-bold text-[#17202A]">Recent Attributed Orders</h2>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Verified Conversions
              </span>
            </div>

            <div className="space-y-3 mt-4">
              {recentConversions.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#667085]">
                  No attributed store orders recorded yet. As customers click your tracked links and buy, orders will stream here in real-time.
                </div>
              ) : (
                recentConversions.map((conv) => (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] hover:bg-white hover:shadow-sm transition-all text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#17202A]">#{conv.orderId}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {conv.attributionSource}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#667085] mt-0.5 truncate">
                        Campaign: <span className="font-semibold text-slate-700">{conv.campaignName}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold font-mono text-emerald-700">
                        {formatCurrency(conv.orderTotalCents, conv.currency, locale)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(conv.occurredAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#E4E7EC] text-xs text-[#667085] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Cryptographic webhook &amp; 1st-party cookie attribution
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
