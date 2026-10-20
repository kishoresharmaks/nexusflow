import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePage from '../src/app/page';
import { AuthProvider } from '../src/context/auth-context';

describe('HomePage', () => {
  it('renders CommercePilot heading, phases status, and feature cards', () => {
    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    expect(screen.getByText(/AI-Powered Commerce Marketing & Publishing SaaS/i)).toBeDefined();
    expect(screen.getByText(/SaaS Release/i)).toBeDefined();
    expect(screen.getByText(/Platform Capabilities/i)).toBeDefined();
    expect(screen.getByText(/Enterprise Reliability, Compliance & Security/i)).toBeDefined();
    expect(screen.getAllByText(/Open Composer/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Posts & Pipeline/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Social Accounts/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Multi-Channel Composer')).toBeDefined();
    expect(screen.getByText(/Posts & Approval Pipeline/i)).toBeDefined();
    expect(screen.getAllByText(/Store Integrations/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Campaigns & Tracking/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Attribution & Analytics/i).length).toBeGreaterThanOrEqual(1);
  });
});
