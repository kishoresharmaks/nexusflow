'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { ProtectedRoute } from '../../components/protected-route';
import {
  api,
  type AnalyticsOverview,
  type DailyMetricPoint,
  type BestTimeRecommendation,
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
} from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsContent />
    </ProtectedRoute>
  );
}

function AnalyticsContent() {
  const { currentWorkspace } = useAuth();
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [timeseries, setTimeseries] = useState<DailyMetricPoint[]>([]);
  const [bestTimes, setBestTimes] = useState<BestTimeRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    setError(null);
    try {
      const [ov, ts, bt] = await Promise.all([
        api.getAnalyticsOverview(currentWorkspace.id, periodDays),
        api.getAnalyticsTimeseries(currentWorkspace.id, periodDays),
        api.getAnalyticsBestTimes(currentWorkspace.id),
      ]);
      setOverview(ov);
      setTimeseries(ts);
      setBestTimes(bt);
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
      if (res.data) {
        const blob = new Blob([res.data], {
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
      }
    } catch (err) {
      alert(`Export failed: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const maxClicks = Math.max(...timeseries.map((t) => t.clicks), 1);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between pb-6 border-b border-[#E4E7EC] gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-[#E85D2A] flex items-center justify-center shrink-0">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[#17202A]">
                Attribution &amp; Performance Analytics
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
                Live Data
              </span>
            </div>
            <p className="text-sm text-[#667085] mt-1">
              Track product clicks, conversions, revenue attribution, and discover peak publishing
              windows.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {/* Period Selector */}
          <div className="flex bg-[#F9FAFB] p-1 rounded-lg border border-[#E4E7EC] text-xs font-semibold">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriodDays(days)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  periodDays === days
                    ? 'bg-white text-[#17202A] shadow-sm border border-[#E4E7EC]'
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
            className="flex items-center gap-1.5 px-3 py-2 border border-[#E4E7EC] rounded-lg text-xs font-medium text-[#344054] hover:bg-[#F9FAFB] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => void handleExport('csv')}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#E85D2A] text-white rounded-lg text-xs font-semibold hover:bg-[#D44D1E] transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
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
            className="text-red-600 hover:text-red-800 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Total Revenue */}
        <div className="p-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Attributed Revenue
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-[#17202A]">
            $
            {((overview?.totalRevenueCents ?? 0) / 100).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-[#667085] mt-1 flex items-center gap-1">
            <span className="text-emerald-600 font-semibold">
              +{overview?.growth?.revenue ?? 0}%
            </span>{' '}
            vs previous period
          </div>
        </div>

        {/* Conversions & AOV */}
        <div className="p-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Store Conversions
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-[#17202A]">
            {overview?.totalConversions ?? 0}{' '}
            <span className="text-xs font-normal text-[#667085]">orders</span>
          </div>
          <div className="text-xs text-[#667085] mt-1">
            Avg Order Value:{' '}
            <span className="font-semibold text-[#17202A]">
              ${((overview?.averageOrderValueCents ?? 0) / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Clicks & CTR */}
        <div className="p-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-xs font-semibold uppercase tracking-wider">Tracked Clicks</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <MousePointer className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-[#17202A]">
            {(overview?.totalClicks ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#667085] mt-1 flex items-center gap-1">
            <Percent className="h-3 w-3 text-[#E85D2A]" />
            Click-Through Rate (CTR):{' '}
            <span className="font-semibold text-[#17202A]">
              {overview?.clickThroughRate ?? 0}%
            </span>
          </div>
        </div>

        {/* Impressions & CVR */}
        <div className="p-5 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="flex items-center justify-between text-[#667085]">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Impressions &amp; CVR
            </span>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 text-[#17202A]">
            {(overview?.totalImpressions ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-[#667085] mt-1">
            Conversion Rate (CVR):{' '}
            <span className="font-semibold text-[#17202A]">{overview?.conversionRate ?? 0}%</span>
          </div>
        </div>
      </div>

      {/* Timeseries Graph and Best Times Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Timeseries Daily Activity Bar Graph */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 text-[#17202A]">
                <BarChart3 className="h-5 w-5 text-[#E85D2A]" />
                Daily Traffic &amp; Conversion Velocity
              </h2>
              <p className="text-xs text-[#667085]">
                Daily link clicks, impressions, and store orders across the selected timeframe.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E85D2A] inline-block" /> Clicks
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" /> Orders
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-56 flex items-end gap-1.5 pt-6 border-b border-[#E4E7EC] pb-2 overflow-x-auto">
            {timeseries.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-[#667085]">
                No activity recorded yet for this period.
              </div>
            ) : (
              timeseries.map((point) => {
                const heightPercent = Math.max(Math.round((point.clicks / maxClicks) * 100), 6);
                return (
                  <div
                    key={point.date}
                    className="flex-1 min-w-[20px] flex flex-col items-center gap-1 group relative"
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-12 bg-white text-[#17202A] border border-[#E4E7EC] text-[11px] rounded px-2 py-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                      <div>{point.date}</div>
                      <div className="font-semibold text-[#E85D2A]">
                        {point.clicks} clicks • {point.conversions} orders
                      </div>
                    </div>

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        point.conversions > 0
                          ? 'bg-gradient-to-t from-[#E85D2A] to-emerald-400'
                          : 'bg-[#E85D2A]/80 group-hover:bg-[#E85D2A]'
                      }`}
                    />
                    <span className="text-[10px] text-[#667085] rotate-45 origin-left truncate max-w-[24px]">
                      {point.date.slice(5)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Best Time to Post Recommendations */}
        <div className="p-6 rounded-2xl border border-[#E4E7EC] bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold text-[#17202A]">Recommended Post Times</h2>
            </div>
            <p className="text-xs text-[#667085] mb-4">
              AI-evaluated peak engagement and conversion windows based on historical performance.
            </p>

            <div className="space-y-3">
              {bestTimes.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] hover:bg-[#F2F4F7] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-2 text-[#17202A]">
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

          <div className="mt-4 pt-4 border-t border-[#E4E7EC] text-xs text-[#667085] flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-[#E85D2A]" />
            Times shown in UTC. Automatically adjusted when scheduling posts.
          </div>
        </div>
      </div>
    </div>
  );
}
