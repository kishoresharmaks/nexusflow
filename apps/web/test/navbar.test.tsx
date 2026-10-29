import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

    expect(screen.getAllByText('NexusFlow').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Features')).toBeDefined();
    expect(screen.getByText('How It Works')).toBeDefined();
    expect(screen.getByText('Pricing')).toBeDefined();
    expect(screen.getByText('FAQs')).toBeDefined();
    expect(screen.getByText('Sign In')).toBeDefined();
    expect(screen.getAllByText(/1-Click Demo/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Start Free Trial/i).length).toBeGreaterThanOrEqual(1);
  });

  it('opens and closes public mobile drawer with full item list and CTAs', () => {
    render(
      <AuthProvider>
        <Navbar />
      </AuthProvider>,
    );

    const toggleBtn = screen.getByLabelText('Toggle navigation menu');
    expect(toggleBtn).toBeDefined();

    // Open mobile menu
    fireEvent.click(toggleBtn);
    expect(screen.getAllByText('Start Free Trial').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('1-Click Demo').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Resources').length).toBeGreaterThanOrEqual(1);

    // Close mobile menu
    fireEvent.click(toggleBtn);
  });

  it('toggles resources dropdown on desktop', () => {
    render(
      <AuthProvider>
        <Navbar />
      </AuthProvider>,
    );

    const resourcesBtn = screen.getByRole('button', { name: /Resources/i });
    expect(resourcesBtn).toBeDefined();

    fireEvent.click(resourcesBtn);
    expect(screen.getByText(/Developer Hub & API/i)).toBeDefined();
    expect(screen.getByText(/Workflow Engine/i)).toBeDefined();
    expect(screen.getByText(/Security & Governance/i)).toBeDefined();
  });

  it('renders app navigation and workspace switcher after login with properly aligned items', () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store', role: 'ADMIN' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <Navbar />
      </AuthProvider>,
    );

    expect(screen.getAllByText('NexusFlow').length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getByText('Settings')).toBeDefined();
    expect(screen.getByText('Logout')).toBeDefined();
    expect(screen.getByText('New Post')).toBeDefined();
  });

  it('opens and closes workspace creation modal', () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <Navbar />
      </AuthProvider>,
    );

    const createWsBtn = screen.getByTitle('Create New Workspace');
    fireEvent.click(createWsBtn);

    expect(screen.getByText('Create New Workspace')).toBeDefined();
    expect(screen.getByPlaceholderText(/Nordic Home Store/i)).toBeDefined();

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);
    expect(screen.queryByPlaceholderText(/Nordic Home Store/i)).toBeNull();
  });
});
