import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import MediaLibraryPage from '../src/app/media/page';
import { AuthProvider } from '../src/context/auth-context';

describe('MediaLibraryPage', () => {
  it('renders Media Library with private S3 upload zone, tenant isolation banner, and media assets', () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <MediaLibraryPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Media Library')).toBeDefined();
    expect(screen.getByText('Creative Assets')).toBeDefined();
    expect(screen.getByText('Strict Tenant Storage Isolation')).toBeDefined();
    expect(screen.getByText(/Upload Product Photos & Video/i)).toBeDefined();
  });
});
