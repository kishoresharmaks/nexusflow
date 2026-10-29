import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import WorkspaceSettingsPage from '../src/app/settings/workspace/page';
import { AuthProvider } from '../src/context/auth-context';
import { api } from '../src/lib/api';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/workspace',
}));

describe('Workspace Regional & Localization Settings', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockUser = { id: 'u1', name: 'Store Admin', email: 'admin@store.com' };
  const mockWs = {
    id: 'ws-123',
    name: 'Bharat Store',
    slug: 'bharat-store',
    role: 'OWNER',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    currency: 'INR',
  };

  it('renders timezone, currency, and locale inputs with initial workspace values', () => {
    render(
      <AuthProvider initialToken="token-123" initialUser={mockUser} initialWorkspace={mockWs}>
        <WorkspaceSettingsPage />
      </AuthProvider>,
    );

    expect(screen.getByDisplayValue('Bharat Store')).toBeDefined();
    expect(screen.getByDisplayValue('bharat-store')).toBeDefined();

    // Timezone selector has Asia/Kolkata selected
    const tzSelect = screen.getByLabelText(/Operational Timezone/i) as HTMLSelectElement;
    expect(tzSelect.value).toBe('Asia/Kolkata');

    // Currency selector has INR selected
    const curSelect = screen.getByLabelText(/Default Store Currency/i) as HTMLSelectElement;
    expect(curSelect.value).toBe('INR');

    // Locale selector has en-IN selected
    const locSelect = screen.getByLabelText(/Regional Locale & Number Formatting/i) as HTMLSelectElement;
    expect(locSelect.value).toBe('en-IN');

    // Live preview shows formatted sample price with ₹ symbol
    expect(screen.getByText(/₹885.95/i)).toBeDefined();
  });

  it('auto-suggests locale when currency changes', () => {
    render(
      <AuthProvider initialToken="token-123" initialUser={mockUser} initialWorkspace={mockWs}>
        <WorkspaceSettingsPage />
      </AuthProvider>,
    );

    const curSelect = screen.getByLabelText(/Default Store Currency/i) as HTMLSelectElement;
    const locSelect = screen.getByLabelText(/Regional Locale & Number Formatting/i) as HTMLSelectElement;

    // Change currency to EUR
    fireEvent.change(curSelect, { target: { value: 'EUR' } });
    expect(curSelect.value).toBe('EUR');
    expect(locSelect.value).toBe('de-DE');

    // Sample price updates to EUR
    expect(screen.getByText(/885,95|885.95/)).toBeDefined();
  });

  it('detects browser timezone on button click', async () => {
    render(
      <AuthProvider initialToken="token-123" initialUser={mockUser} initialWorkspace={mockWs}>
        <WorkspaceSettingsPage />
      </AuthProvider>,
    );

    const detectBtn = screen.getByRole('button', { name: /Detect My Timezone/i });
    fireEvent.click(detectBtn);

    expect(await screen.findByText(/Detected browser timezone:/i)).toBeDefined();
  });

  it('submits updated regional settings via api.updateWorkspaceSettings', async () => {
    const updateSpy = vi.spyOn(api, 'updateWorkspaceSettings').mockResolvedValueOnce({
      id: 'ws-123',
      name: 'Bharat Store Global',
      slug: 'bharat-store',
      timezone: 'Europe/London',
      locale: 'en-GB',
      currency: 'GBP',
    });

    render(
      <AuthProvider initialToken="token-123" initialUser={mockUser} initialWorkspace={mockWs}>
        <WorkspaceSettingsPage />
      </AuthProvider>,
    );

    const nameInput = screen.getByLabelText(/Workspace Business Name/i);
    fireEvent.change(nameInput, { target: { value: 'Bharat Store Global' } });

    const tzSelect = screen.getByLabelText(/Operational Timezone/i);
    fireEvent.change(tzSelect, { target: { value: 'Europe/London' } });

    const curSelect = screen.getByLabelText(/Default Store Currency/i);
    fireEvent.change(curSelect, { target: { value: 'GBP' } });

    const submitBtn = screen.getByRole('button', { name: /Save Workspace Settings/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('ws-123', {
        name: 'Bharat Store Global',
        timezone: 'Europe/London',
        locale: 'en-GB',
        currency: 'GBP',
      });
    });

    expect(
      await screen.findByText(/Workspace localization and business parameters updated successfully/i),
    ).toBeDefined();
  });
});
