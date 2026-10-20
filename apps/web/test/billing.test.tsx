import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import BillingPage from '../src/app/billing/page';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/billing',
}));

vi.mock('../src/lib/api', () => ({
  api: {
    getBillingPlans: vi.fn().mockResolvedValue([]),
    getBillingSubscription: vi.fn().mockResolvedValue(null),
    getBillingUsage: vi.fn().mockResolvedValue({
      metrics: {
        monthlyPosts: { used: 0, limit: 10, percentage: 0 },
        monthlyAiWords: { used: 0, limit: 5000, percentage: 0 },
        socialAccounts: { used: 0, limit: 2, percentage: 0 },
        teamMembers: { used: 1, limit: 1, percentage: 100 },
      },
    }),
    getBillingHistory: vi.fn().mockResolvedValue([]),
  },
}));

describe('BillingPage', () => {
  it('renders Billing & Subscriptions hub with plan tiers, usage meters, and history', () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <BillingPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Billing & Subscriptions')).toBeDefined();
    expect(screen.getByText(/PCI & Webhook Verified/i)).toBeDefined();
    expect(screen.getByText(/Cycle Usage & Entitlements/i)).toBeDefined();
    expect(screen.getByText(/Subscription Plans & Upgrade Tiers/i)).toBeDefined();
  });
});
