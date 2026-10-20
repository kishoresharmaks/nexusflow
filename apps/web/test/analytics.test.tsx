import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AnalyticsPage from '../src/app/analytics/page';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/analytics',
}));

vi.mock('../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getAnalyticsOverview: vi.fn().mockResolvedValue({
        periodDays: 30,
        totalPosts: 24,
        totalImpressions: 12000,
        totalClicks: 450,
        totalEngagements: 680,
        totalConversions: 18,
        totalRevenueCents: 125000,
        clickThroughRate: 3.75,
        conversionRate: 4.0,
        averageOrderValueCents: 6944,
        growth: {
          impressions: 8.5,
          clicks: 12.0,
          conversions: 5.2,
          revenue: 15.2,
        },
      }),
      getAnalyticsTimeseries: vi.fn().mockResolvedValue([
        {
          date: '2026-10-18',
          clicks: 25,
          impressions: 500,
          engagements: 30,
          conversions: 2,
          revenueCents: 14000,
        },
        {
          date: '2026-10-19',
          clicks: 42,
          impressions: 800,
          engagements: 55,
          conversions: 3,
          revenueCents: 21000,
        },
      ]),
      getAnalyticsBestTimes: vi.fn().mockResolvedValue([
        {
          dayOfWeek: 'Tuesday',
          hourUtc: 14,
          formattedTime: 'Tuesday 2:00 PM UTC',
          confidenceScore: 94,
          reason: 'Peak click-through and purchase conversion window',
        },
      ]),
      exportAnalyticsReport: vi.fn().mockResolvedValue({
        format: 'csv',
        filename: 'analytics-report.csv',
        data: 'date,clicks,impressions\n2026-10-19,42,800',
      }),
    },
  };
});

describe('AnalyticsPage', () => {
  it('renders Attribution & Performance Analytics with KPI cards, period toggles, and recommendations', async () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <AnalyticsPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Attribution & Performance Analytics')).toBeDefined();
    expect(screen.getByText('Last 7 Days')).toBeDefined();
    expect(screen.getByText('Last 30 Days')).toBeDefined();
    expect(screen.getByText('Last 90 Days')).toBeDefined();
    expect(screen.getByText('Refresh')).toBeDefined();
    expect(screen.getByText('Export CSV')).toBeDefined();

    // Verify KPI cards after data load
    await waitFor(() => {
      expect(screen.getByText('Attributed Revenue')).toBeDefined();
      expect(screen.getByText('Tracked Clicks')).toBeDefined();
      expect(screen.getByText('Store Conversions')).toBeDefined();
      expect(screen.getByText(/Click-Through Rate \(CTR\)/i)).toBeDefined();
    });

    // Verify chart section & recommendations
    expect(screen.getByText(/Daily Traffic & Conversion Velocity/i)).toBeDefined();
    expect(screen.getByText(/Recommended Post Times/i)).toBeDefined();
  });
});
