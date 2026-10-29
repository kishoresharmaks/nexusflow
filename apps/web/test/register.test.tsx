import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import RegisterPage from '../src/app/register/page';
import { AuthProvider } from '../src/context/auth-context';
import { api } from '../src/lib/api';

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/register',
  useSearchParams: () => mockSearchParams,
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('renders registration form with full name, email, password, and workspace fields when public registration is allowed', async () => {
    vi.spyOn(api, 'getPublicAuthConfig').mockResolvedValue({
      allowPublicRegistrations: true,
      maintenanceMode: { enabled: false },
    });

    render(
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Account' })).toBeDefined();
    });

    expect(screen.getByPlaceholderText('Sarah Jenkins')).toBeDefined();
    expect(screen.getByPlaceholderText('sarah@flagshipstore.com')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeDefined();
    expect(screen.getByRole('button', { name: /Create Free Workspace/i })).toBeDefined();
    expect(screen.getByText(/Enterprise-grade workspace isolation/i)).toBeDefined();
  });

  it('renders restricted access view and hides form when public registration is disabled', async () => {
    vi.spyOn(api, 'getPublicAuthConfig').mockResolvedValue({
      allowPublicRegistrations: false,
      maintenanceMode: { enabled: false },
    });

    render(
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Public Registration is Disabled')).toBeDefined();
    });

    expect(screen.getByText('Registration Restricted')).toBeDefined();
    expect(screen.getByText(/New user self-service signups have been temporarily restricted/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /Sign In to Existing Account/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /Return to Homepage/i })).toBeDefined();

    // Verify self-registration inputs are NOT shown
    expect(screen.queryByPlaceholderText('Sarah Jenkins')).toBeNull();
    expect(screen.queryByPlaceholderText('sarah@flagshipstore.com')).toBeNull();
  });

  it('renders registration form when public registration is disabled but user has a valid invitation token in URL', async () => {
    mockSearchParams = new URLSearchParams({ invitation: 'invite_secret_token_123' });

    vi.spyOn(api, 'getPublicAuthConfig').mockResolvedValue({
      allowPublicRegistrations: false,
      maintenanceMode: { enabled: false },
    });

    render(
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Registering via verified team invitation token/i)).toBeDefined();
    });

    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeDefined();
    expect(screen.getByPlaceholderText('Sarah Jenkins')).toBeDefined();
  });
});
