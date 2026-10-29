import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SuperAdminSettingsPage from '../src/app/super-admin/settings/page';
import { api } from '../src/lib/api';

describe('Super Admin Email Delivery & Diagnostics UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(api, 'getSuperAdminPlatformSettings').mockResolvedValue([]);
    vi.spyOn(api, 'getSuperAdminAnnouncements').mockResolvedValue([]);
    vi.spyOn(api, 'getSuperAdminEmailStatus').mockResolvedValue({
      activeProvider: 'smtp',
      isConfigured: true,
      fromAddress: 'NexusFlow <noreply@nexusflow.test>',
      availableProviders: ['local', 'smtp', 'brevo', 'msg91', 'resend'],
      outboxCount: 3,
    });
  });

  it('switches to Email Delivery tab and displays active provider card and provider fleet', async () => {
    const statusSpy = vi.spyOn(api, 'getSuperAdminEmailStatus').mockResolvedValue({
      activeProvider: 'smtp',
      isConfigured: true,
      fromAddress: 'NexusFlow <noreply@nexusflow.test>',
      availableProviders: ['local', 'smtp', 'brevo', 'msg91', 'resend'],
      outboxCount: 3,
    });

    render(<SuperAdminSettingsPage />);

    await waitFor(() => {
      expect(statusSpy).toHaveBeenCalled();
    });

    // Click on Email Delivery tab
    const emailTabBtn = await screen.findByRole('button', { name: /Email Delivery & Providers/i });
    fireEvent.click(emailTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Active Provider')).toBeDefined();
      expect(screen.getByRole('heading', { name: 'SMTP', level: 3 })).toBeDefined();
      expect(screen.getByText('Operational')).toBeDefined();
      expect(screen.getByText('NexusFlow <noreply@nexusflow.test>')).toBeDefined();
    });

    // Verify all providers rendered in fleet list
    expect(screen.getByText('SMTP Relay')).toBeDefined();
    expect(screen.getAllByText('Brevo (Sendinblue)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MSG91').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Resend').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Local Outbox').length).toBeGreaterThan(0);
  });

  it('triggers provider connection check and displays verification result', async () => {
    const verifySpy = vi.spyOn(api, 'verifySuperAdminEmailConnection').mockResolvedValue({
      ok: true,
      provider: 'smtp',
      message: 'SMTP connection established to smtp.mailgun.org:587',
      latencyMs: 34,
    });

    render(<SuperAdminSettingsPage />);

    const emailTabBtn = await screen.findByRole('button', { name: /Email Delivery & Providers/i });
    fireEvent.click(emailTabBtn);

    const verifyBtn = screen.getByRole('button', { name: /Run Connection Test/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(verifySpy).toHaveBeenCalled();
      expect(screen.getByText('Connection Verified')).toBeDefined();
      expect(screen.getByText('SMTP connection established to smtp.mailgun.org:587')).toBeDefined();
      expect(screen.getByText('34ms')).toBeDefined();
    });
  });

  it('submits transactional test email and renders delivery feedback card', async () => {
    const sendTestSpy = vi.spyOn(api, 'sendSuperAdminTestEmail').mockResolvedValue({
      id: 'msg_smtp_mock_888',
      provider: 'smtp',
      timestamp: new Date().toISOString(),
      latencyMs: 62,
    });

    render(<SuperAdminSettingsPage />);

    const emailTabBtn = await screen.findByRole('button', { name: /Email Delivery & Providers/i });
    fireEvent.click(emailTabBtn);

    const emailInput = screen.getByPlaceholderText('admin@yourcompany.com');
    fireEvent.change(emailInput, { target: { value: 'tester@enterprise.com' } });

    const sendBtn = screen.getByRole('button', { name: /Send Test Email/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(sendTestSpy).toHaveBeenCalledWith('tester@enterprise.com', 'smtp');
      expect(screen.getByText('Delivered via SMTP')).toBeDefined();
      expect(screen.getByText(/ID: msg_smtp_mock_888/i)).toBeDefined();
      expect(screen.getByText('62ms')).toBeDefined();
    });
  });
});
