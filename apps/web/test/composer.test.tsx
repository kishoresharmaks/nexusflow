import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ComposerPage from '../src/app/composer/page';
import { AuthProvider } from '../src/context/auth-context';
import { api } from '../src/lib/api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/composer',
}));

describe('ComposerPage', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
  const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store', currency: 'INR', locale: 'en-IN' };

  it('renders Channel-Aware Composer with platform selectors, caption editor, and live preview', () => {
    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <ComposerPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Channel-Aware Composer')).toBeDefined();
    expect(screen.getByText('Instagram')).toBeDefined();
    expect(screen.getByText('LinkedIn')).toBeDefined();
    expect(screen.getByText('Facebook')).toBeDefined();
    expect(screen.getByText('X (Twitter)')).toBeDefined();
    expect(screen.getByText(/Post Caption & Copy/i)).toBeDefined();
    expect(screen.getByText(/Save as Draft/i)).toBeDefined();
    expect(screen.getByText(/Request Approval/i)).toBeDefined();
    expect(screen.getByText(/Publish Now/i)).toBeDefined();
    expect(screen.getByText(/Live Preview: Instagram/i)).toBeDefined();
  });

  it('immediately updates preview image and caption when switching linked products', async () => {
    const mockProducts = [
      {
        id: 'prod-1',
        title: 'The Collection Snowboard: Liquid',
        priceCents: 74995,
        currency: 'INR',
        inventoryCount: 50,
        images: ['https://cdn.shopify.com/liquid-board.jpg'],
        tags: ['Snowboard'],
      },
      {
        id: 'prod-2',
        title: 'The Inventory Not Tracked Snowboard',
        priceCents: 94995,
        currency: 'INR',
        inventoryCount: 10,
        images: ['https://cdn.shopify.com/untracked-board.jpg'],
        tags: ['Snowboard'],
      },
    ];

    vi.spyOn(api, 'getProducts').mockResolvedValueOnce({
      items: mockProducts as any,
      meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
    });
    vi.spyOn(api, 'getSocialAccounts').mockResolvedValueOnce([]);
    vi.spyOn(api, 'getMediaAssets').mockResolvedValueOnce([]);
    vi.spyOn(api, 'getCampaigns').mockResolvedValueOnce([
      {
        id: 'camp-1',
        workspaceId: 'ws-1',
        name: 'Winter Sale 2026',
        utmCampaign: 'winter-sale-2026',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <ComposerPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/The Collection Snowboard: Liquid/)).toBeDefined();
    });

    const select = screen.getByLabelText(/Link Product from Catalog/i) as HTMLSelectElement;

    // 1. Select product 1 ("Liquid")
    fireEvent.change(select, { target: { value: 'prod-1' } });

    // Preview image is Liquid board
    const previewImg1 = screen.getByAltText('Post media') as HTMLImageElement;
    expect(previewImg1.src).toContain('liquid-board.jpg');
    const textarea = screen.getByPlaceholderText(/Write engaging copy/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('The Collection Snowboard: Liquid');

    // 2. Switch to product 2 ("The Inventory Not Tracked Snowboard")
    fireEvent.change(select, { target: { value: 'prod-2' } });

    // Preview image must IMMEDIATELY update to untracked-board.jpg
    const previewImg2 = screen.getByAltText('Post media') as HTMLImageElement;
    expect(previewImg2.src).toContain('untracked-board.jpg');
    expect(previewImg2.src).not.toContain('liquid-board.jpg');

    // Caption also updates to product 2
    expect(textarea.value).toContain('The Inventory Not Tracked Snowboard');
  });

  it('allows selecting a campaign and renders the campaign attribution badge in preview', async () => {
    vi.spyOn(api, 'getProducts').mockResolvedValueOnce({
      items: [],
      meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
    });
    vi.spyOn(api, 'getSocialAccounts').mockResolvedValueOnce([]);
    vi.spyOn(api, 'getMediaAssets').mockResolvedValueOnce([]);
    vi.spyOn(api, 'getCampaigns').mockResolvedValueOnce([
      {
        id: 'camp-100',
        workspaceId: 'ws-1',
        name: 'Summer Clearance Drop',
        utmCampaign: 'summer-clearance',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <ComposerPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Summer Clearance Drop/)).toBeDefined();
    });

    const campaignSelect = screen.getByLabelText(/Link Campaign/i) as HTMLSelectElement;
    fireEvent.change(campaignSelect, { target: { value: 'camp-100' } });

    // Campaign badge appears in preview
    await waitFor(() => {
      expect(screen.getByText(/Campaign:/i)).toBeDefined();
      expect(screen.getByText('Summer Clearance Drop')).toBeDefined();
    });
  });
});
