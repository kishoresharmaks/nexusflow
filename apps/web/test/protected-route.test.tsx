import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ProtectedRoute } from '../src/components/protected-route';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/protected',
}));

describe('ProtectedRoute Component', () => {
  afterEach(() => {
    cleanup();
  });
  it('blocks unauthenticated visitors and renders Authentication Required gate with Sign In link', () => {
    render(
      <AuthProvider>
        <ProtectedRoute>
          <div data-testid="secret-content">Secret Workspace Data</div>
        </ProtectedRoute>
      </AuthProvider>,
    );

    expect(screen.queryByTestId('secret-content')).toBeNull();
    expect(screen.getByText('Authentication Required')).toBeDefined();
    expect(screen.getByText(/Sign In to Your Workspace/i)).toBeDefined();
    expect(screen.getByText(/Create Free Account/i)).toBeDefined();
    expect(screen.getByText(/Instant 1-Click Demo Login/i)).toBeDefined();
  });

  it('allows authenticated users through to render private content', () => {
    const mockUser = { id: 'user-1', name: 'Alice Merchant', email: 'alice@store.com' };
    const mockWs = { id: 'ws-1', name: 'Alice Store', slug: 'alice-store' };

    render(
      <AuthProvider initialToken="token-123" initialUser={mockUser} initialWorkspace={mockWs}>
        <ProtectedRoute>
          <div data-testid="secret-content">Secret Workspace Data</div>
        </ProtectedRoute>
      </AuthProvider>,
    );

    expect(screen.getByTestId('secret-content')).toBeDefined();
    expect(screen.getByText('Secret Workspace Data')).toBeDefined();
    expect(screen.queryByText('Authentication Required')).toBeNull();
  });
});
