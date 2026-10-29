import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DevelopersPublicPage from '../src/app/developers/page';
import DeveloperIntegrationsPage from '../src/app/integrations/developer/page';
import { AuthProvider } from '../src/context/auth-context';
import { api } from '../src/lib/api';

vi.mock('next/navigation', () => ({
  usePathname: () => '/developers',
}));

describe('DeveloperIntegrationsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Developer Hub with API endpoints, code snippets, and sandbox', async () => {
    const mockUser = { id: 'user-1', name: 'Dev User', email: 'dev@store.com' };
    const mockWs = { id: 'ws-1', name: 'Flagship Store', slug: 'flagship-store' };

    vi.spyOn(api, 'getCustomIngestHistory').mockResolvedValueOnce([
      {
        id: 'hist-1',
        timestamp: new Date().toISOString(),
        storeName: 'Medusa B2B Catalog',
        total: 10,
        created: 8,
        updated: 2,
        actor: { name: 'Dev User', email: 'dev@store.com' },
      },
    ]);

    render(
      <AuthProvider initialToken="token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <DeveloperIntegrationsPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Custom Store Developer Hub')).toBeDefined();
    expect(screen.getByText('Push Ingestion Endpoint')).toBeDefined();
    expect(screen.getByText('Interactive Ingestion Sandbox')).toBeDefined();
    expect(screen.getByText('Catalog Field Specification')).toBeDefined();

    // Verify language switcher buttons exist
    expect(screen.getByText('cURL')).toBeDefined();
    expect(screen.getByText('Node.js')).toBeDefined();
    expect(screen.getByText('Python')).toBeDefined();
    expect(screen.getByText('PHP')).toBeDefined();

    // Verify presets exist
    expect(screen.getByText('Minimal Product')).toBeDefined();
    expect(screen.getByText('Multi-Product Batch')).toBeDefined();

    // Verify history loaded
    await waitFor(() => {
      expect(screen.getByText('Medusa B2B Catalog')).toBeDefined();
      expect(screen.getByText(/10 items/i)).toBeDefined();
    });
  });

  it('triggers schema validation when Validate Schema button is clicked', async () => {
    const mockUser = { id: 'user-1', name: 'Dev User', email: 'dev@store.com' };
    const mockWs = { id: 'ws-1', name: 'Flagship Store', slug: 'flagship-store' };

    vi.spyOn(api, 'getCustomIngestHistory').mockResolvedValueOnce([]);
    const validateSpy = vi.spyOn(api, 'validateCustomPayload').mockResolvedValueOnce({
      valid: true,
      normalizedCount: 1,
      errors: [],
      sample: [
        {
          sourceId: 'PROD-HEADPHONES-900',
          title: 'Wireless Active Noise-Canceling Headphones',
          priceCents: 19900,
          currency: 'USD',
          inventoryCount: 45,
          images: [],
          tags: [],
        },
      ],
    });

    render(
      <AuthProvider initialToken="token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <DeveloperIntegrationsPage />
      </AuthProvider>,
    );

    const validateBtn = screen.getAllByText('Validate Schema')[0]!;
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalled();
      expect(screen.getByText(/Payload Validated: 1 product\(s\) ready for ingest/i)).toBeDefined();
    });
  });

  it('renders publicly without authentication and validates payloads via client sandbox', async () => {
    const validateSpy = vi.spyOn(api, 'validateCustomPayload');

    render(
      <AuthProvider initialToken={null} initialUser={null} initialWorkspace={null}>
        <DevelopersPublicPage />
      </AuthProvider>,
    );

    // Verify it is NOT blocked by authentication gate
    expect(screen.queryByText(/Authentication Required/i)).toBeNull();

    // Verify header and public badge
    expect(screen.getByText('Custom Store Developer Hub')).toBeDefined();
    expect(screen.getByText('Public Documentation')).toBeDefined();
    expect(screen.getByText(/Public Developer Documentation/i)).toBeDefined();

    // Verify public guidance buttons
    expect(screen.getByText('Sign In')).toBeDefined();
    expect(screen.getByText('Launch Live Workspace Demo')).toBeDefined();

    // Click "Validate Schema" in public sandbox - does client-side validation without calling backend
    const validateBtn = screen.getAllByText('Validate Schema')[0]!;
    fireEvent.click(validateBtn);

    await waitFor(() => {
      // Backend API must not be called when unauthenticated
      expect(validateSpy).not.toHaveBeenCalled();
      // Client validation succeeds
      expect(screen.getByText(/Payload Validated: 1 product\(s\) ready for ingest/i)).toBeDefined();
    });
  });

  it('allows public access through the /integrations/developer route alias', () => {
    render(
      <AuthProvider initialToken={null} initialUser={null} initialWorkspace={null}>
        <DeveloperIntegrationsPage />
      </AuthProvider>,
    );

    expect(screen.queryByText(/Authentication Required/i)).toBeNull();
    expect(screen.getByText('Custom Store Developer Hub')).toBeDefined();
    expect(screen.getByText('Push Ingestion Endpoint')).toBeDefined();
  });

  it('displays the live hosted JSON URL and loads JSON from hosted URL into sandbox', async () => {
    const mockSampleCatalog = {
      storeName: 'Test Hosted Catalog',
      products: [
        {
          sourceId: 'HOSTED-01',
          title: 'Hosted Headphones Test',
          priceCents: 9999,
          currency: 'USD',
          inventoryCount: 20,
        },
      ],
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      return new Response(JSON.stringify(mockSampleCatalog), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    render(
      <AuthProvider initialToken={null} initialUser={null} initialWorkspace={null}>
        <DevelopersPublicPage />
      </AuthProvider>,
    );

    // Verify GET JSON pill exists and contains /sample-catalog.json
    expect(screen.getByText('GET JSON')).toBeDefined();
    expect(screen.getAllByText(/sample-catalog\.json/i).length).toBeGreaterThan(0);

    // Verify the URL loader bar exists
    expect(screen.getByText('Load Catalog JSON from Hosted URL')).toBeDefined();
    expect(screen.getByText('Fetch & Load JSON')).toBeDefined();

    // Click "Fetch & Load JSON"
    const fetchBtn = screen.getByText('Fetch & Load JSON');
    fireEvent.click(fetchBtn);

    await waitFor(
      () => {
        expect(fetchSpy).toHaveBeenCalled();
        
        expect(screen.getByText(/Successfully loaded live catalog JSON feed from:/i)).toBeDefined();
      },
      { timeout: 3000 },
    );
  });
});









