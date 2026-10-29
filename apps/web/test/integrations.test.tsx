import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import IntegrationsPage from '../src/app/integrations/page';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/integrations',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getStoreConnections: vi.fn().mockResolvedValue([
        {
          id: 'conn-1',
          workspaceId: 'ws-1',
          platform: 'SHOPIFY',
          storeName: 'Nordic Apparel Store',
          storeUrl: 'https://nordic-apparel.myshopify.com',
          apiKeyMasked: '••••••••1234',
          syncStatus: 'SUCCESS',
          syncedProducts: 48,
          lastSyncAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
      authorizeShopify: vi.fn().mockResolvedValue({
        authUrl: 'https://nordic-apparel.myshopify.com/admin/oauth/authorize?test=1',
        shop: 'nordic-apparel.myshopify.com',
      }),
      connectStore: vi.fn(),
      syncStoreCatalog: vi.fn(),
      disconnectStore: vi.fn(),
    },
  };
});

describe('IntegrationsPage', () => {
  it('renders Ecommerce Store Integrations with connected stores and connect modal trigger', async () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <IntegrationsPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Ecommerce Store Integrations')).toBeDefined();
    expect(screen.getByText('Connect Store')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Nordic Apparel Store')).toBeDefined();
      expect(screen.getByText('48 items')).toBeDefined();
      expect(screen.getByText('Sync Catalog')).toBeDefined();
      expect(screen.getByTitle('Disconnect Store')).toBeDefined();
      expect(screen.getByText('Developer Hub & Custom API')).toBeDefined();
    });
  });

  it('opens modal and displays platform selector with Shopify, WooCommerce, and Custom API', async () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <IntegrationsPage />
      </AuthProvider>,
    );

    const connectButton = screen.getAllByText('Connect Store')[0]!;
    fireEvent.click(connectButton);

    expect(screen.getByText('Connect Ecommerce Store')).toBeDefined();
    expect(screen.getByText('Custom API')).toBeDefined();
    expect(screen.getByText('Shopify')).toBeDefined();
    expect(screen.getByText('WooCommerce')).toBeDefined();
  });

  it('renders Shopify 1-Click OAuth mode by default and allows toggling to manual token', async () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <IntegrationsPage />
      </AuthProvider>,
    );

    const connectButton = screen.getAllByText('Connect Store')[0]!;
    fireEvent.click(connectButton);

    // Verify 1-Click OAuth elements are present by default
    expect(screen.getByText('1-Click OAuth (Recommended)')).toBeDefined();
    expect(screen.getByText('Manual Token (Custom App)')).toBeDefined();
    expect(screen.getByText('Shopify Store Domain')).toBeDefined();
    expect(screen.getByText('Authorize with Shopify')).toBeDefined();

    // Toggle to Manual Token mode
    fireEvent.click(screen.getByText('Manual Token (Custom App)'));
    expect(screen.getByText('Shopify Admin API Access Token')).toBeDefined();
    expect(screen.getByText('Shopify API Version')).toBeDefined();

    // Toggle back to OAuth mode
    fireEvent.click(screen.getByText('1-Click OAuth (Recommended)'));
    expect(screen.getByText('Shopify Store Domain')).toBeDefined();
  });
});
