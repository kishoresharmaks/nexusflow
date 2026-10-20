import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ComposerPage from '../src/app/composer/page';
import { AuthProvider } from '../src/context/auth-context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/composer',
}));

describe('ComposerPage', () => {
  it('renders Channel-Aware Composer with platform selectors, caption editor, and live preview', () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <ComposerPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Channel-Aware Composer')).toBeDefined();
    expect(screen.getByText('Instagram')).toBeDefined();
    expect(screen.getByText('LinkedIn')).toBeDefined();
    expect(screen.getByText('Facebook')).toBeDefined();
    expect(screen.getByText('X (Twitter)')).toBeDefined();
    expect(screen.getByText(/Post Caption & Copy/i)).toBeDefined();
    expect(screen.getByText(/Save as Draft/i)).toBeDefined();
    expect(screen.getByText(/Request Approval/i)).toBeDefined();
    expect(screen.getByText(/Publish Now/i)).toBeDefined();
    expect(screen.getByText(/Live Preview: Instagram/i)).toBeDefined();
  });
});
