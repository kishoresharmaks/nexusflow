import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _count: {
            posts: 12,
            trackedClicks: 340,
          },
        },
      ]),
      createCampaign: vi.fn(),
      generateUtmUrl: vi.fn(),
      deleteCampaign: vi.fn(),
    },
  };
});

describe('CampaignsPage', () => {
  it('renders Marketing Campaigns with campaign cards, creation trigger, and UTM builder', async () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <CampaignsPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Marketing Campaigns & Attribution Links')).toBeDefined();
    expect(screen.getByText('Create Campaign')).toBeDefined();

    // Verify campaign cards after data load
    await waitFor(() => {
      expect(screen.getByText('Spring Clearance 2026')).toBeDefined();
      expect(screen.getByText(/spring_clearance_2026/i)).toBeDefined();
      expect(screen.getByText('12')).toBeDefined();
      expect(screen.getByText('340')).toBeDefined();
    });

    // Verify UTM link builder section
    expect(screen.getByText('UTM Link Builder')).toBeDefined();
    expect(screen.getByText(/Destination Store URL/i)).toBeDefined();
    expect(screen.getByText(/Source \(utm_source\)/i)).toBeDefined();
  });
});
