import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { WebhooksService } from '../src/webhooks/webhooks.service';

describe('WebhooksService - Shopify Order Webhooks & Attribution', () => {
  let service: WebhooksService;
  let mockPrisma: any;
  let mockConfig: any;
  const testSecret = 'shopify-secret-key-12345';

  beforeEach(() => {
    mockPrisma = {
      webhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'wh_evt_1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      storeConnection: {
        findFirst: vi.fn(),
      },
      conversionEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      trackedClick: {
        findFirst: vi.fn(),
      },
      campaign: {
        findFirst: vi.fn(),
      },
      subscription: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      billingEvent: {
        create: vi.fn(),
      },
    };

    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'SHOPIFY_CLIENT_SECRET') return testSecret;
        return undefined;
      }),
    };

    service = new WebhooksService(mockPrisma as any, mockConfig as any);
  });

  describe('Shopify HMAC Signature Verification', () => {
    it('verifies valid Base64 encoded HMAC-SHA256 signature', () => {
      const rawBody = JSON.stringify({ id: 12345678, test: true });
      const validSignature = crypto
        .createHmac('sha256', testSecret)
        .update(rawBody, 'utf8')
        .digest('base64');

      expect(service.verifyShopifySignature(rawBody, validSignature)).toBe(true);
    });

    it('verifies valid Hex encoded HMAC-SHA256 signature as fallback', () => {
      const rawBody = JSON.stringify({ id: 12345678, test: true });
      const validHex = crypto
        .createHmac('sha256', testSecret)
        .update(rawBody, 'utf8')
        .digest('hex');

      expect(service.verifyShopifySignature(rawBody, validHex)).toBe(true);
    });

    it('rejects tampered raw payload or signature mismatch', () => {
      const rawBody = JSON.stringify({ id: 12345678 });
      const tamperedBody = JSON.stringify({ id: 12345678, malicious: true });
      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(rawBody, 'utf8')
        .digest('base64');

      expect(service.verifyShopifySignature(tamperedBody, signature)).toBe(false);
      expect(service.verifyShopifySignature(rawBody, 'invalid-base64-signature==')).toBe(false);
    });

    it('throws UnauthorizedException when signature verification fails', async () => {
      const payload = { id: 888999 };
      const rawBody = JSON.stringify(payload);

      await expect(
        service.processShopifyOrderWebhook(
          'orders/paid',
          'nordic-apparel.myshopify.com',
          payload,
          rawBody,
          'bad-hmac-signature',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Shopify Order Ingestion & Attribution Extraction', () => {
    it('idempotently skips already processed Shopify order webhook events', async () => {
      const payload = { id: 777666 };
      const rawBody = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', testSecret).update(rawBody, 'utf8').digest('base64');

      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        id: 'existing_wh',
        provider: 'shopify',
        providerEventId: '777666',
        processed: true,
      });

      const result = await service.processShopifyOrderWebhook(
        'orders/paid',
        'democheck-h0uyfpis.myshopify.com',
        payload,
        rawBody,
        signature,
      );

      expect(result.status).toBe('already_processed');
      expect(result.eventId).toBe('777666');
      expect(mockPrisma.conversionEvent.create).not.toHaveBeenCalled();
    });

    it('attributes Shopify order with cp_click_id in landing_site to corresponding campaign', async () => {
      const clickId = '6ad84b652e8c5aa86fd2fdcc';
      const orderPayload = {
        id: 9911223344,
        total_price: '749.95',
        currency: 'INR',
        landing_site: `/products/the-liquid-board?utm_source=instagram&utm_medium=stories&utm_campaign=winter-drop&cp_click_id=${clickId}`,
        created_at: '2026-10-21T06:00:00Z',
      };
      const rawBody = JSON.stringify(orderPayload);
      const signature = crypto.createHmac('sha256', testSecret).update(rawBody, 'utf8').digest('base64');

      // 1. WebhookEvent not yet recorded
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);

      // 2. Resolve Workspace from StoreConnection
      mockPrisma.storeConnection.findFirst.mockResolvedValue({
        id: 'store_1',
        workspaceId: 'ws_abc123',
        storeUrl: 'https://democheck-h0uyfpis.myshopify.com',
      });

      // 3. ConversionEvent does not yet exist
      mockPrisma.conversionEvent.findUnique.mockResolvedValue(null);

      // 4. Resolve TrackedClick by cp_click_id
      mockPrisma.trackedClick.findFirst.mockResolvedValue({
        id: clickId,
        workspaceId: 'ws_abc123',
        campaignId: 'camp_liquid_launch',
      });

      mockPrisma.conversionEvent.create.mockResolvedValue({
        id: 'conv_1',
        workspaceId: 'ws_abc123',
        orderId: '9911223344',
      });

      const result = await service.processShopifyOrderWebhook(
        'orders/paid',
        'democheck-h0uyfpis.myshopify.com',
        orderPayload,
        rawBody,
        signature,
      );

      expect(result.status).toBe('processed');
      expect(result.eventId).toBe('9911223344');

      // Verify ConversionEvent created with correct cents conversion and campaign association
      expect(mockPrisma.conversionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: 'ws_abc123',
          orderId: '9911223344',
          orderTotalCents: 74995, // 749.95 * 100
          currency: 'INR',
          campaignId: 'camp_liquid_launch',
          clickId,
          attributionSource: `click:${clickId}`,
        }),
      });
    });

    it('attributes Shopify order with cp_click_id in note_attributes when landing_site is stripped', async () => {
      const clickId = '6ad84b652e8c5aa86fd2fd99';
      const orderPayload = {
        id: 5544332211,
        total_price: '120.00',
        currency: 'USD',
        landing_site: '/checkout',
        note_attributes: [
          { name: 'theme', value: 'dawn' },
          { name: 'cp_click_id', value: clickId },
        ],
      };
      const rawBody = JSON.stringify(orderPayload);
      const signature = crypto.createHmac('sha256', testSecret).update(rawBody, 'utf8').digest('base64');

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.storeConnection.findFirst.mockResolvedValue({
        id: 'store_1',
        workspaceId: 'ws_usd_store',
      });
      mockPrisma.conversionEvent.findUnique.mockResolvedValue(null);
      mockPrisma.trackedClick.findFirst.mockResolvedValue({
        id: clickId,
        workspaceId: 'ws_usd_store',
        campaignId: 'camp_holiday_2026',
      });

      const result = await service.processShopifyOrderWebhook(
        'orders/paid',
        'nordic-apparel.myshopify.com',
        orderPayload,
        rawBody,
        signature,
      );

      expect(result.status).toBe('processed');
      expect(mockPrisma.conversionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: 'ws_usd_store',
          orderId: '5544332211',
          orderTotalCents: 12000,
          currency: 'USD',
          campaignId: 'camp_holiday_2026',
          clickId,
        }),
      });
    });

    it('falls back to utm_campaign matching when cp_click_id is not present', async () => {
      const orderPayload = {
        id: 1122334455,
        total_price: '49.50',
        currency: 'EUR',
        landing_site: '/collections/all?utm_source=facebook&utm_campaign=black-friday-2026',
      };
      const rawBody = JSON.stringify(orderPayload);
      const signature = crypto.createHmac('sha256', testSecret).update(rawBody, 'utf8').digest('base64');

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.storeConnection.findFirst.mockResolvedValue({
        id: 'store_eur',
        workspaceId: 'ws_eur',
      });
      mockPrisma.conversionEvent.findUnique.mockResolvedValue(null);
      mockPrisma.campaign.findFirst.mockResolvedValue({
        id: 'camp_bf_2026',
        workspaceId: 'ws_eur',
        utmCampaign: 'black-friday-2026',
      });

      const result = await service.processShopifyOrderWebhook(
        'orders/create',
        'eur-store.myshopify.com',
        orderPayload,
        rawBody,
        signature,
      );

      expect(result.status).toBe('processed');
      expect(mockPrisma.conversionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: 'ws_eur',
          orderId: '1122334455',
          orderTotalCents: 4950,
          currency: 'EUR',
          campaignId: 'camp_bf_2026',
          attributionSource: 'utm:black-friday-2026',
        }),
      });
    });
  });
});
