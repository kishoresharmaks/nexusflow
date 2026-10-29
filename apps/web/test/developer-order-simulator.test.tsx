import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import DevelopersPublicPage from '../src/app/developers/page';
import SocialAccountsPage from '../src/app/social-accounts/page';
import { AuthProvider } from '../src/context/auth-context';
import { api } from '../src/lib/api';

vi.mock('next/navigation', () => ({
  usePathname: () => '/developers',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('Order Webhook Simulator & Social Token Refresh UI', () => {
  const mockUser = { id: 'user-1', name: 'Dev Merchant', email: 'dev@merchant.com' };
  const mockWs = { id: 'ws-1', name: 'Flagship Store', slug: 'flagship-store' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Developer Hub: Order Webhook Simulator', () => {
    it('switches to Order Webhook Simulator tab and renders simulation controls', async () => {
      render(
        <AuthProvider initialToken="token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
          <DevelopersPublicPage />
        </AuthProvider>,
      );

      // Verify Tab button exists and switch to it
      const webhookTabBtn = screen.getByText('Order Webhook Simulator');
      expect(webhookTabBtn).toBeDefined();
      fireEvent.click(webhookTabBtn);

      // Verify simulator elements rendered
      expect(screen.getByText('Order Webhook Ingestion & Attribution Endpoint')).toBeDefined();
      expect(screen.getByText('Interactive Order Webhook Simulator')).toBeDefined();
      expect(screen.getByText('Order Webhook Attribution Specification')).toBeDefined();
      expect(screen.getByText('Simulate Order Webhook')).toBeDefined();
    });

    it('executes order webhook simulation and displays verified attribution diagnostics', async () => {
      vi.spyOn(api, 'simulateOrderWebhook').mockResolvedValueOnce({
        success: true,
        httpStatus: 200,
        provider: 'shopify',
        eventType: 'orders/paid',
        orderId: '8492001',
        hmacSignature: 'valid_hmac_sha256_mock_sig_9921',
        hmacValid: true,
        idempotencyStatus: 'processed',
        orderTotalCents: 14950,
        currency: 'USD',
        attribution: {
          campaignId: 'camp-summer',
          campaignName: 'Summer Launch 2026',
          source: 'click:60b8d29f1c9d440000a11111',
        },
        message: "Order 8492001 callback verified via HMAC-SHA256 and credited to 'Summer Launch 2026'.",
      });

      render(
        <AuthProvider initialToken="token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
          <DevelopersPublicPage />
        </AuthProvider>,
      );

      // Switch to Webhooks tab
      fireEvent.click(screen.getByText('Order Webhook Simulator'));

      // Click Simulate Order Webhook
      const simulateBtn = screen.getByText('Simulate Order Webhook');
      fireEvent.click(simulateBtn);

      await waitFor(() => {
        expect(screen.getByText('Webhook Verified & Processed')).toBeDefined();
        expect(screen.getByText('HTTP 200')).toBeDefined();
        expect(screen.getByText('✓ Valid Cryptographic Match')).toBeDefined();
        expect(screen.getByText('Summer Launch 2026')).toBeDefined();
        expect(screen.getByText(/USD \$149\.50/i)).toBeDefined();
      });
    });

    it('simulates tampered signature rejection with HTTP 401', async () => {
      vi.spyOn(api, 'simulateOrderWebhook').mockResolvedValueOnce({
        success: false,
        httpStatus: 401,
        provider: 'shopify',
        eventType: 'orders/paid',
        orderId: '9999999',
        hmacSignature: 'invalid_tampered_sig_xyz',
        hmacValid: false,
        idempotencyStatus: 'failed',
        orderTotalCents: 0,
        currency: 'USD',
        attribution: {},
        error: 'Invalid cryptographic HMAC signature.',
        message: 'HMAC signature verification failed. The payload or secret key did not match the computed digest.',
      });

      render(
        <AuthProvider initialToken="token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
          <DevelopersPublicPage />
        </AuthProvider>,
      );

      fireEvent.click(screen.getByText('Order Webhook Simulator'));

      // Select Tampered Preset
      const tamperedPresetBtn = screen.getByText('Tampered Signature (Negative Security Test)');
      fireEvent.click(tamperedPresetBtn);

      // Click Simulate Order Webhook
      fireEvent.click(screen.getByText('Simulate Order Webhook'));

      await waitFor(() => {
        expect(screen.getByText('Webhook Rejected')).toBeDefined();
        expect(screen.getByText('HTTP 401')).toBeDefined();
        expect(screen.getByText('✗ Signature Mismatch')).toBeDefined();
      });
    });
  });

  describe('Social Accounts: Automated Token Refresh Action', () => {
    it('triggers automated token refresh cron check from social accounts page', async () => {
      vi.spyOn(api, 'getSocialAccounts').mockResolvedValue([]);
      vi.spyOn(api, 'getLinkedInStatus').mockResolvedValue({
        connected: true,
        account: null,
        canPublish: true,
      });
      vi.spyOn(api, 'getInstagramStatus').mockResolvedValue({
        connected: true,
        account: null,
        canPublish: true,
      });

      vi.spyOn(api, 'refreshExpiringSocialTokens').mockResolvedValueOnce({
        scanned: 3,
        refreshed: 3,
        failed: 0,
        expired: 0,
        results: [
          { id: 'acc-1', displayName: 'Acme IG', provider: 'META_INSTAGRAM', status: 'refreshed' },
        ],
      });

      render(
        <AuthProvider initialToken="token-xyz" initialUser={mockUser} initialWorkspace={mockWs}>
          <SocialAccountsPage />
        </AuthProvider>,
      );

      const cronBtn = await screen.findByText('Run Token Refresh Cron');
      expect(cronBtn).toBeDefined();

      fireEvent.click(cronBtn);

      await waitFor(() => {
        expect(api.refreshExpiringSocialTokens).toHaveBeenCalledWith(mockWs.id, 7);
        expect(screen.getByText(/Automated token refresh cron check completed: 3 refreshed/i)).toBeDefined();
      });
    });
  });
});
