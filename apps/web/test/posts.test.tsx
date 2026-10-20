import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import PostsPage from '../src/app/posts/page';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/posts',
}));

describe('PostsPage', () => {
  it('renders Posts & Pipeline with status filters, search input, and create CTA', () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <PostsPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Posts & Pipeline')).toBeDefined();
    expect(screen.getByText('All Posts')).toBeDefined();
    expect(screen.getByText('Drafts')).toBeDefined();
    expect(screen.getByText('Awaiting Approval')).toBeDefined();
    expect(screen.getByText('Scheduled')).toBeDefined();
    expect(screen.getByText('Published')).toBeDefined();
    expect(screen.getByText(/Create Post in Composer/i)).toBeDefined();
  });
});
