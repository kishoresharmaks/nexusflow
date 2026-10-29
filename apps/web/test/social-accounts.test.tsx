import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import SocialAccountsPage from '../src/app/social-accounts/page';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/social-accounts',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../src/lib/api', () => ({
  api: {
    getSocialAccounts: vi.fn().mockResolvedValue([]),
    getLinkedInStatus: vi.fn().mockResolvedValue({
      connected: false,
      account: null as {
        id: string;
        displayName: string;
        username: string | null;
        providerAccountId: string;
        scopes: string[];
        status: string;
        tokenExpiresAt: string | null;
        createdAt: string;
        hasRefreshToken?: boolean;
      } | null,
      canPublish: false,
    }),
    getInstagramStatus: vi
      .fn()
      .mockResolvedValue({ connected: false, account: null, canPublish: false }),
  },
}));

describe('SocialAccountsPage', () => {
  it('renders Social Accounts with supported providers, security notice, and connect buttons', () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <SocialAccountsPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Social Accounts')).toBeDefined();
    expect(screen.getByText(/End-to-End Account Protection/i)).toBeDefined();
    expect(screen.getByText('Instagram Business')).toBeDefined();
    expect(screen.getByText('Facebook Pages')).toBeDefined();
    expect(screen.getByText('LinkedIn Profile')).toBeDefined();
    expect(screen.getByText('X (Twitter)')).toBeDefined();
    expect(screen.getByText('TikTok Business')).toBeDefined();
  });

  it('renders Reconnect button and validity period for standard LinkedIn account without refresh token', async () => {
    const { api } = await import('../src/lib/api');
    vi.mocked(api.getLinkedInStatus).mockResolvedValueOnce({
      connected: true,
      canPublish: true,
      account: {
        id: 'acc_li_standard',
        displayName: 'Harini U S',
        username: 'Harini U S',
        providerAccountId: 'urn:li:person:123',
        scopes: ['openid', 'profile', 'w_member_social'],
        status: 'ACTIVE',
        tokenExpiresAt: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        hasRefreshToken: false,
      },
    });

    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <SocialAccountsPage />
      </AuthProvider>,
    );

    expect(await screen.findByText('Harini U S')).toBeDefined();
    expect(screen.getByText(/Standard 60-day token/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Reconnect/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Refresh Token/i })).toBeNull();
  });

  it('renders Refresh Token button when LinkedIn account has programmatic refresh token', async () => {
    const { api } = await import('../src/lib/api');
    vi.mocked(api.getLinkedInStatus).mockResolvedValueOnce({
      connected: true,
      canPublish: true,
      account: {
        id: 'acc_li_enterprise',
        displayName: 'Enterprise Partner',
        username: 'Enterprise Partner',
        providerAccountId: 'urn:li:person:999',
        scopes: ['openid', 'profile', 'w_member_social'],
        status: 'ACTIVE',
        tokenExpiresAt: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        hasRefreshToken: true,
      },
    });

    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <SocialAccountsPage />
      </AuthProvider>,
    );

    expect(await screen.findByText('Enterprise Partner')).toBeDefined();
    expect(screen.getByRole('button', { name: /Refresh Token/i })).toBeDefined();
  });
});
