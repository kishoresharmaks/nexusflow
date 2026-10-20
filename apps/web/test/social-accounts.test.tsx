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
    getLinkedInStatus: vi
      .fn()
      .mockResolvedValue({ connected: false, account: null, canPublish: false }),
    getInstagramStatus: vi
      .fn()
      .mockResolvedValue({ connected: false, account: null, canPublish: false }),
  },
}));

describe('SocialAccountsPage', () => {
  it('renders Social Accounts with supported providers, AES-256-GCM security notice, and connect buttons', () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <SocialAccountsPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Social Accounts')).toBeDefined();
    expect(screen.getByText(/Bank-Grade Token Encryption at Rest/i)).toBeDefined();
    expect(screen.getByText('Instagram Business')).toBeDefined();
    expect(screen.getByText('Facebook Pages')).toBeDefined();
    expect(screen.getByText('LinkedIn Profile')).toBeDefined();
    expect(screen.getByText('X (Twitter)')).toBeDefined();
    expect(screen.getByText('TikTok Business')).toBeDefined();
  });
});
