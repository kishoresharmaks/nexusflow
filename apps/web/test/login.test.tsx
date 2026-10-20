import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import LoginPage from '../src/app/login/page';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/login',
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue('/'),
  }),
}));

describe('LoginPage', () => {
  it('renders login form with email, password, and demo login buttons', () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeDefined();
    expect(screen.getByPlaceholderText('merchant@brand.com')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDefined();
    expect(screen.getByText(/1-Click Quick Demo Sign In/i)).toBeDefined();
    expect(screen.getByText(/Argon2id password hashing/i)).toBeDefined();
  });
});
