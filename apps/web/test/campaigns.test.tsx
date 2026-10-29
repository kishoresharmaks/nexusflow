import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import CampaignsPage from '../src/app/campaigns/page';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/campaigns',
}));

vi.mock('../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getCampaigns: vi.fn().mockResolvedValue([
        {
          id: 'camp-1',
          workspaceId: 'ws-1',
          name: 'Spring Clearance 2026',
          utmCampaign: 'spring_clearance_2026',
          description: 'End of season discounts on all apparel',
          startDate: '2026-03-01T00:00:00.000Z',
          endDate: '2026-03-31T00:00:00.000Z',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: {
            posts: 12,
            trackedClicks: 340,
            conversions: 18,
          },
          metrics: {
            clicks: 340,
            conversions: 18,
            revenueCents: 154000,
            conversionRate: 5.29,
          },
        },
      ]),
      getTrackingLinks: vi.fn().mockResolvedValue([
        {
          id: 'link-1',
          workspaceId: 'ws-1',
          campaignId: 'camp-1',
          shortCode: 'spr2026',
          shortUrl: 'http://localhost:4000/api/v1/t/spr2026',
          destinationUrl: 'https://example.com/products/summer-collection',
          utmSource: 'instagram',
          utmMedium: 'stories',
          utmCampaign: 'spring_clearance_2026',
          clickCount: 142,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          campaign: { id: 'camp-1', name: 'Spring Clearance 2026', utmCampaign: 'spring_clearance_2026' },
        },
      ]),
      createCampaign: vi.fn().mockResolvedValue({
        id: 'camp-2',
        name: 'Fall Drop 2026',
        utmCampaign: 'fall-drop-2026',
      }),
      updateCampaign: vi.fn().mockResolvedValue({
        id: 'camp-1',
        name: 'Spring Clearance 2026 Extended',
        utmCampaign: 'spring_clearance_2026',
      }),
      createTrackingLink: vi.fn().mockResolvedValue({
        id: 'link-2',
        shortCode: 'a1b2c3d4',
        shortUrl: 'http://localhost:4000/api/v1/t/a1b2c3d4',
        destinationUrl: 'https://example.com/products/summer-collection',
        utmSource: 'instagram',
        utmMedium: 'stories',
        utmCampaign: 'spring_clearance_2026',
        clickCount: 0,
      }),
      deleteCampaign: vi.fn().mockResolvedValue({ success: true }),
    },
  };
});

describe('CampaignsPage', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders Marketing Campaigns with verified attribution metrics, active links, and tracking builder', async () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store', currency: 'USD', locale: 'en-US' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <CampaignsPage />
      </AuthProvider>,
    );

    expect(screen.getByText(/Marketing Campaigns & Attribution/i)).toBeDefined();
    expect(screen.getByText('Create Campaign')).toBeDefined();

    // Verify campaign cards and metrics
    await waitFor(() => {
      expect(screen.getAllByText('Spring Clearance 2026').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/spring_clearance_2026/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('340')).toBeDefined(); // clicks
      expect(screen.getByText('18')).toBeDefined(); // orders
      expect(screen.getByText('5.29%')).toBeDefined(); // conversion rate
    });

    // Verify tracking link builder section
    expect(screen.getByText('Tracking Link Builder')).toBeDefined();
    expect(screen.getByText(/Destination Store URL/i)).toBeDefined();
    expect(screen.getByText(/Generate Public Tracking Link/i)).toBeDefined();

    // Verify active tracking links table
    expect(screen.getByText(/Active Tracked Redirect Links/i)).toBeDefined();
    expect(screen.getByText(/\/t\/spr2026/i)).toBeDefined();
    expect(screen.getByText('142')).toBeDefined();
  });

  it('opens and populates the Edit Campaign modal when clicking edit', async () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <CampaignsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Spring Clearance 2026').length).toBeGreaterThanOrEqual(1);
    });

    const editBtn = screen.getAllByTitle('Edit Campaign')[0]!;
    fireEvent.click(editBtn);

    expect(screen.getByText('Edit Campaign')).toBeDefined();
    expect(screen.getByDisplayValue('Spring Clearance 2026')).toBeDefined();
    expect(screen.getAllByDisplayValue('spring_clearance_2026').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Save Changes')).toBeDefined();
  });
});
