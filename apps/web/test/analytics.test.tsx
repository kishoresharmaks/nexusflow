import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import AnalyticsPage from '../src/app/analytics/page';
import { AuthProvider } from '../src/context/auth-context';
import { api } from '../src/lib/api';

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
          formattedTime: 'Tuesday at 2:00 PM UTC',
          confidenceScore: 94,
          reason: 'Peak click-through and purchase conversion window',
        },
      ]),
      getAnalyticsCampaigns: vi.fn().mockResolvedValue([
        {
          id: 'camp-1',
          name: 'Summer Splash 2026',
          utmCampaign: 'summer_splash',
          postsCount: 6,
          clicks: 210,
          conversions: 12,
          revenueCents: 85000,
          conversionRate: 5.71,
          averageOrderValueCents: 7083,
        },
      ]),
      getAnalyticsChannels: vi.fn().mockResolvedValue([
        {
          channel: 'Instagram',
          clicks: 280,
          conversions: 11,
          revenueCents: 77000,
          conversionRate: 3.93,
          sharePercentage: 62.2,
        },
        {
          channel: 'LinkedIn',
          clicks: 170,
          conversions: 7,
          revenueCents: 48000,
          conversionRate: 4.12,
          sharePercentage: 37.8,
        },
      ]),
      getAnalyticsProducts: vi.fn().mockResolvedValue([
        {
          id: 'prod-1',
          title: 'Linen Summer Shirt',
          sku: 'SHIRT-LINEN-01',
          priceCents: 4500,
          currency: 'USD',
          imageUrl: null,
          clicks: 140,
          conversions: 9,
          revenueCents: 40500,
          conversionRate: 6.43,
        },
      ]),
      getAnalyticsRecentConversions: vi.fn().mockResolvedValue([
        {
          id: 'conv-1',
          orderId: 'ORD-99881',
          orderTotalCents: 8500,
          currency: 'USD',
          campaignId: 'camp-1',
          campaignName: 'Summer Splash 2026',
          attributionSource: 'Instagram',
          targetUrl: 'https://mystore.com/summer',
          occurredAt: '2026-10-21T14:30:00Z',
        },
      ]),
      exportAnalyticsReport: vi.fn().mockResolvedValue({
        format: 'csv',
        filename: 'analytics-report.csv',
        data: 'Date,Clicks,Conversions\n2026-10-19,42,3',
      }),
    },
  };
});

describe('AnalyticsPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders Attribution & Performance Analytics with KPI cards, period toggles, and recommendations', async () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store', currency: 'USD' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <AnalyticsPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Attribution & Performance Analytics')).toBeDefined();
    expect(screen.getByText('Last 7 Days')).toBeDefined();
    expect(screen.getByText('Last 14 Days')).toBeDefined();
    expect(screen.getByText('Last 30 Days')).toBeDefined();
    expect(screen.getByText('Last 90 Days')).toBeDefined();
    expect(screen.getByText('Refresh')).toBeDefined();
    expect(screen.getByText('Export CSV')).toBeDefined();

    // Verify 5 KPI cards after data load
    await waitFor(() => {
      expect(screen.getByText('Attributed Revenue')).toBeDefined();
      expect(screen.getByText('Store Conversions')).toBeDefined();
      expect(screen.getByText('Tracked Clicks')).toBeDefined();
      expect(screen.getByText(/Click-Through Rate \(CTR\)/i)).toBeDefined();
      expect(screen.getByText(/Conversion Rate \(CVR\)/i)).toBeDefined();
    });

    // Verify chart section & recommendations
    expect(screen.getByText(/Daily Traffic & Conversion Velocity/i)).toBeDefined();
    expect(screen.getByText(/Recommended Post Times/i)).toBeDefined();

    // Verify Multi-metric tabs
    expect(screen.getByText('Revenue ($)')).toBeDefined();
    expect(screen.getByText('Orders (#)')).toBeDefined();
    expect(screen.getByText('Clicks (#)')).toBeDefined();
    expect(screen.getByText('Conversion Rate (%)')).toBeDefined();

    // Switch metric to Orders (#)
    fireEvent.click(screen.getByText('Orders (#)'));

    // Verify Channel Breakdown
    expect(screen.getByText(/Channel & Traffic Source Distribution/i)).toBeDefined();
    expect(screen.getAllByText('Instagram').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('LinkedIn')).toBeDefined();

    // Verify Campaign Matrix
    expect(screen.getByText(/Campaign Attribution Performance Matrix/i)).toBeDefined();
    expect(screen.getAllByText('Summer Splash 2026').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('summer_splash')).toBeDefined();

    // Verify Top Products
    expect(screen.getByText(/Top Converting Products/i)).toBeDefined();
    expect(screen.getByText('Linen Summer Shirt')).toBeDefined();
    expect(screen.getByText(/SHIRT-LINEN-01/i)).toBeDefined();

    // Verify Recent Orders
    expect(screen.getByText(/Recent Attributed Orders/i)).toBeDefined();
    expect(screen.getByText('#ORD-99881')).toBeDefined();
  });

  it('triggers report export when Export CSV is clicked', async () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <AnalyticsPage />
      </AuthProvider>,
    );

    const exportBtn = screen.getByText('Export CSV');
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(api.exportAnalyticsReport).toHaveBeenCalledWith('ws-1', 'csv');
    });
  });
});
