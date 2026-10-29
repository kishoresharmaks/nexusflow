import { beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import HomePage from '../src/app/page';
import { AuthProvider } from '../src/context/auth-context';
import { ThemeProvider } from '../src/context/theme-context';

describe('HomePage', () => {
  beforeEach(cleanup);

  it('renders an honest public marketing page without fabricated performance claims', () => {
    render(<AuthProvider><ThemeProvider><HomePage /></ThemeProvider></AuthProvider>);
    expect(screen.getByRole('heading', { name: /turn product facts into marketing drafts/i })).toBeDefined();
    expect(screen.getByText(/early access/i)).toBeDefined();
    expect(screen.getByText(/no promised performance outcomes/i)).toBeDefined();
    expect(screen.queryByText(/calculate your time saved/i)).toBeNull();
    expect(screen.queryByText(/trusted by ecommerce leaders/i)).toBeNull();
  });

  it('exposes FAQ state to assistive technology', () => {
    render(<AuthProvider><ThemeProvider><HomePage /></ThemeProvider></AuthProvider>);
    const publishingQuestion = screen.getByRole('button', { name: /does nexusflow publish to every social network/i });
    expect(publishingQuestion.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(publishingQuestion);
    expect(publishingQuestion.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/official provider api/i)).toBeDefined();
  });

  it('renders the authenticated dashboard instead of the public landing page', () => {
    render(<AuthProvider initialToken="test-jwt-token" initialUser={{ id: 'u1', name: 'Kishore', email: 'kishore@example.com' }} initialWorkspace={{ id: 'w1', name: "Kishore's Workspace", slug: 'kishore-ws', role: 'OWNER' }}><ThemeProvider><HomePage /></ThemeProvider></AuthProvider>);
    expect(screen.getAllByText('Overview').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/turn product facts into marketing drafts/i)).toBeNull();
  });

  it('switches to v3 Apple UI with Cult UI iPhone showcase and back to Classic v1', () => {
    render(<AuthProvider><ThemeProvider><HomePage /></ThemeProvider></AuthProvider>);
    // Look for the v3 Apple UI button
    const v3Button = screen.getByRole('button', { name: /v3 apple/i });
    expect(v3Button).toBeDefined();

    // Click to switch to v3 Apple UI
    fireEvent.click(v3Button);

    // v3 Apple UI elements should be visible
    expect(screen.getByRole('heading', { name: /pro commerce marketing/i })).toBeDefined();
    expect(screen.getByText(/enterprise platform v3/i)).toBeDefined();
    expect(screen.getByText(/omnichannel campaign studio/i)).toBeDefined();
    expect(screen.getByText(/real-time creative engine/i)).toBeDefined();

    // Switch back to Classic v1
    const returnV1Btn = screen.getAllByRole('button', { name: /classic v1/i })[0]!;
    fireEvent.click(returnV1Btn);

    // Classic v1 UI should be restored
    expect(screen.getByRole('heading', { name: /turn product facts into marketing drafts/i })).toBeDefined();
  });
});
