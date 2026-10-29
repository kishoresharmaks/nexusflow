import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomStoreController } from '../src/integrations/stores/custom-store.controller';
import { WebhooksService } from '../src/webhooks/webhooks.service';
import { SocialController } from '../src/social/social.controller';
import { SocialService } from '../src/social/social.service';
import { SuperAdminController } from '../src/super-admin/super-admin.controller';
import { SuperAdminService } from '../src/super-admin/super-admin.service';

describe('Order Webhook Simulator & Token Refresh APIs', () => {
  let customStoreController: CustomStoreController;
  let mockWebhooksService: any;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockCustomStoreAdapter: any;

  let socialController: SocialController;
  let mockSocialService: any;

  let superAdminController: SuperAdminController;
  let mockSuperAdminService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      product: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      storeConnection: { upsert: vi.fn() },
      auditEvent: { findMany: vi.fn() },
    };
    mockAuditService = { record: vi.fn(), logAction: vi.fn() };
    mockCustomStoreAdapter = { normalizePayload: vi.fn() };

    mockWebhooksService = {
      processCustomOrderWebhook: vi.fn(),
      simulateOrderWebhook: vi.fn(),
    };

    customStoreController = new CustomStoreController(
      mockPrisma,
      mockAuditService,
      mockCustomStoreAdapter,
      mockWebhooksService,
    );

    mockSocialService = {
      refreshExpiringTokens: vi.fn(),
    };
    socialController = new SocialController(mockSocialService);

    mockSuperAdminService = {
      triggerTokenRefreshJob: vi.fn(),
    };
    superAdminController = new SuperAdminController(mockSuperAdminService);
  });

  describe('CustomStoreController.simulateOrderWebhook', () => {
    it('simulates order webhook with cryptographic HMAC verification and attribution diagnostics', async () => {
      const workspaceId = '60b8d29f1c9d440000a11111';
      const orderPayload = {
        order_id: 'ORD-TEST-1001',
        total_price: 149.5,
        currency: 'USD',
        landing_site: 'https://store.example.com/checkout?cp_click_id=60b8d29f1c9d440000a22222',
        customer: { email: 'buyer@example.com' },
      };

      mockWebhooksService.simulateOrderWebhook.mockResolvedValueOnce({
        success: true,
        httpStatus: 200,
        provider: 'shopify',
        eventType: 'orders/paid',
        orderId: 'ORD-TEST-1001',
        hmacSignature: 'valid_hmac_base64_sig',
        hmacValid: true,
        idempotencyStatus: 'processed',
        orderTotalCents: 14950,
        currency: 'USD',
        attribution: {
          campaignId: 'camp-123',
          campaignName: 'Summer Launch 2026',
          source: 'click:60b8d29f1c9d440000a22222',
        },
        message: 'Order callback verified and attributed.',
      });

      const res = await customStoreController.simulateOrderWebhook(workspaceId, {
        provider: 'shopify',
        eventType: 'orders/paid',
        payload: orderPayload,
        secret: 'test-secret',
      });

      expect(res.success).toBe(true);
      expect(res.hmacValid).toBe(true);
      expect(res.idempotencyStatus).toBe('processed');
      expect(res.orderTotalCents).toBe(14950);
      expect(res.attribution?.campaignName).toBe('Summer Launch 2026');
      expect(mockWebhooksService.simulateOrderWebhook).toHaveBeenCalledWith(
        workspaceId,
        expect.objectContaining({
          provider: 'shopify',
          eventType: 'orders/paid',
          secret: 'test-secret',
        }),
      );
    });

    it('rejects simulation if payload is empty', async () => {
      await expect(
        customStoreController.simulateOrderWebhook('ws-1', {} as any),
      ).rejects.toThrow('Request body must include a `payload` object.');
    });

    it('processes custom order callback directly via ingestOrder', async () => {
      const workspaceId = '60b8d29f1c9d440000a11111';
      const payload = {
        orderId: 'HEADLESS-ORD-99',
        orderTotalCents: 8500,
        currency: 'USD',
        attribution: { cp_click_id: 'click-777' },
      };

      mockWebhooksService.processCustomOrderWebhook.mockResolvedValueOnce({
        status: 'processed',
        orderId: 'HEADLESS-ORD-99',
        eventType: 'order.created',
        conversionId: 'conv-99',
        orderTotalCents: 8500,
        currency: 'USD',
        attributionSource: 'click:click-777',
        hmacVerified: true,
      });

      const req = { body: payload } as any;
      const res = await customStoreController.ingestOrder(
        workspaceId,
        payload,
        'hmac-signature-123',
        undefined,
        req,
      );

      expect(res.status).toBe('processed');
      expect(res.orderTotalCents).toBe(8500);
      expect(mockWebhooksService.processCustomOrderWebhook).toHaveBeenCalledWith(
        workspaceId,
        payload,
        JSON.stringify(payload),
        'hmac-signature-123',
      );
    });
  });

  describe('SocialController.refreshExpiringTokens', () => {
    it('triggers workspace social token refresh with custom threshold days', async () => {
      const workspaceId = '60b8d29f1c9d440000a11111';
      mockSocialService.refreshExpiringTokens.mockResolvedValueOnce({
        scanned: 2,
        refreshed: 2,
        failed: 0,
        expired: 0,
        results: [
          { id: 'acc-1', displayName: 'Acme IG', provider: 'META_INSTAGRAM', status: 'refreshed' },
          { id: 'acc-2', displayName: 'Acme LI', provider: 'LINKEDIN', status: 'refreshed' },
        ],
      });

      const res = await socialController.refreshExpiringTokens(workspaceId, '14');

      expect(res.scanned).toBe(2);
      expect(res.refreshed).toBe(2);
      expect(mockSocialService.refreshExpiringTokens).toHaveBeenCalledWith(workspaceId, 14);
    });
  });

  describe('SuperAdminController.triggerTokenRefresh', () => {
    it('triggers platform-wide automated OAuth token refresh maintenance job', async () => {
      mockSuperAdminService.triggerTokenRefreshJob.mockResolvedValueOnce({
        scanned: 10,
        refreshed: 9,
        failed: 1,
        message: 'Token refresh maintenance completed.',
      });

      const req = { user: { id: 'admin-1', email: 'admin@nexusflow.io' } } as any;
      const res = await superAdminController.triggerTokenRefresh(req);

      expect(res.scanned).toBe(10);
      expect(res.refreshed).toBe(9);
      expect(mockSuperAdminService.triggerTokenRefreshJob).toHaveBeenCalledWith({
        id: 'admin-1',
        email: 'admin@nexusflow.io',
      });
    });
  });
});
