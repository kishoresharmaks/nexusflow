import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import RegisterPage from '../src/app/register/page';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/register',
}));

describe('RegisterPage', () => {
  it('renders registration form with full name, email, password, and workspace fields', () => {
    render(
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeDefined();
    expect(screen.getByPlaceholderText('Sarah Jenkins')).toBeDefined();
    expect(screen.getByPlaceholderText('sarah@flagshipstore.com')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeDefined();
    expect(screen.getByRole('button', { name: /Create Free Workspace/i })).toBeDefined();
    expect(screen.getByText(/Enterprise-grade MongoDB multi-tenant isolation/i)).toBeDefined();
  });
});
