import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import IntegrationsPage from '../src/app/integrations/page';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/integrations',
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
    });
  });
});
