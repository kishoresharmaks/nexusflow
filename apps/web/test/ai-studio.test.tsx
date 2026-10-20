import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import AiStudioPage from '../src/app/ai-studio/page';
import { AuthProvider } from '../src/context/auth-context';

describe('AiStudioPage', () => {
  it('renders AI Content Studio with catalog grounding, brand voice, and draft post controls', () => {
    const mockUser = { id: 'user-1', name: 'Demo Merchant', email: 'demo@store.com' };
    const mockWs = { id: 'ws-1', name: 'Demo Store', slug: 'demo-store' };

    render(
      <AuthProvider initialToken="mock-token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
        <AiStudioPage />
      </AuthProvider>,
    );

    // Header & Grounded status
    expect(screen.getByText('AI Content Studio')).toBeDefined();
    expect(screen.getAllByText(/Catalog Grounded/i).length).toBeGreaterThanOrEqual(1);

    // Step 1: Catalog Grounding
    expect(screen.getByText(/1\. Ground in Catalog Product/i)).toBeDefined();
    expect(screen.getByText(/No Products in Catalog/i)).toBeDefined();

    // Step 2: Channels
    expect(screen.getByText(/2\. Select Marketing Channel/i)).toBeDefined();
    expect(screen.getByText('Instagram')).toBeDefined();
    expect(screen.getByText('TikTok')).toBeDefined();
    expect(screen.getByText('LinkedIn')).toBeDefined();

    // Step 3: Brand Voice Guardrails
    expect(screen.getByText(/3\. Brand Voice & Guardrails/i)).toBeDefined();

    // Output & PostStatus.DRAFT guarantee
    expect(screen.getByText('Editable Draft Post')).toBeDefined();
    expect(screen.getByText('PostStatus: DRAFT')).toBeDefined();
    expect(screen.getByText(/Strict Fact Grounding Enforced/i)).toBeDefined();
    expect(screen.getByText(/Save as Draft/i)).toBeDefined();
  });
});
