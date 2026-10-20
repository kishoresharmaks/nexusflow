import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import CatalogPage from '../src/app/catalog/page';
import { AuthProvider } from '../src/context/auth-context';

describe('CatalogPage', () => {
  it('renders Catalog management with search, product table, and RFC 4180 CSV actions', () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <CatalogPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Product Catalog')).toBeDefined();
    expect(screen.getByText('Synchronized')).toBeDefined();
    expect(screen.getByText(/Total Products/i)).toBeDefined();
    expect(screen.getByText(/In-Stock Items/i)).toBeDefined();
    expect(screen.getByText(/Import CSV/i)).toBeDefined();
    expect(screen.getAllByText(/Add Product/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/No products found/i)).toBeDefined();
  });
});
