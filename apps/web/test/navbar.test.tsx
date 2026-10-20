import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { Navbar } from '../src/components/navbar';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('Navbar', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders public navigation before login (marketing links, sign in, free trial)', () => {
    render(
      <AuthProvider>
        <Navbar />
      </AuthProvider>,
    );

    expect(screen.getAllByText('CommercePilot').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Features')).toBeDefined();
    expect(screen.getByText('How It Works')).toBeDefined();
    expect(screen.getByText('Pricing')).toBeDefined();
    expect(screen.getByText('FAQs')).toBeDefined();
    expect(screen.getByText('Sign In')).toBeDefined();
    expect(screen.getByText(/1-Click Demo/i)).toBeDefined();
    expect(screen.getByText(/Start Free Trial/i)).toBeDefined();
  });

  it('renders app navigation and workspace switcher after login', () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <Navbar />
      </AuthProvider>,
    );

    expect(screen.getAllByText('CommercePilot').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Catalog')).toBeDefined();
    expect(screen.getByText('Stores')).toBeDefined();
    expect(screen.getByText('AI Studio')).toBeDefined();
    expect(screen.getByText('Composer')).toBeDefined();
    expect(screen.getByText('Posts & Pipeline')).toBeDefined();
    expect(screen.getByText('Campaigns')).toBeDefined();
    expect(screen.getByText('Analytics')).toBeDefined();
    expect(screen.getByText('Social Accounts')).toBeDefined();
    expect(screen.getByText('Media')).toBeDefined();
    expect(screen.getByText('Billing')).toBeDefined();
    expect(screen.getByText('Logout')).toBeDefined();
  });
});
