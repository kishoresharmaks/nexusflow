import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CustomStoreController } from '../src/integrations/stores/custom-store.controller';
import { CustomStoreAdapter } from '../src/integrations/stores/custom-store.adapter';
import { StorePlatform, StoreSyncStatus } from '@commercepilot/database';

describe('CustomStoreController', () => {
  let controller: CustomStoreController;
  let mockPrisma: any;
  let mockAudit: any;
  let customAdapter: CustomStoreAdapter;

  const mockUser = {
    id: 'user-admin-1',
    name: 'Admin User',
    email: 'admin@workspace.com',
  };

  beforeEach(() => {
    mockPrisma = {
      product: {
        findFirst: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'prod-new' }),
        update: vi.fn().mockResolvedValue({ id: 'prod-updated' }),
      },
      storeConnection: {
        upsert: vi.fn().mockResolvedValue({ id: 'store-conn-1' }),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }: any) => ({
          id: 'store-conn-new',
          ...data,
          lastSyncAt: null,
          syncedProducts: 0,
        })),
      },
      auditEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'audit-1',
            createdAt: new Date('2026-10-21T00:00:00Z'),
            metadata: {
              storeName: 'Test Ingest',
              totalReceived: 5,
              created: 3,
              updated: 2,
            },
            user: { name: 'Admin User', email: 'admin@workspace.com' },
          },
        ]),
      },
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    customAdapter = new CustomStoreAdapter();

    controller = new CustomStoreController(
      mockPrisma as any,
      mockAudit as any,
      customAdapter,
    );
  });

  describe('ingestProducts', () => {
    it('throws BadRequestException if products array is empty', async () => {
      await expect(
        controller.ingestProducts('ws-1', { products: [] } as any, mockUser as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates new products and updates existing products', async () => {
      // First product is new, second is existing
      mockPrisma.product.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-prod-2' });

      const dto = {
        products: [
          {
            sourceId: 'NEW-01',
            title: 'New Product',
            priceCents: 1500,
            currency: 'USD',
          },
          {
            sourceId: 'EXISTING-02',
            title: 'Updated Product',
            priceCents: 2000,
            currency: 'USD',
          },
        ],
        storeName: 'My Custom Ingestion',
      };

      const result = await controller.ingestProducts('ws-1', dto, mockUser as any);

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);

      expect(mockPrisma.product.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.product.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.storeConnection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId_platform_storeUrl: {
              workspaceId: 'ws-1',
              platform: StorePlatform.CUSTOM,
              storeUrl: 'https://custom-api.workspace/ws-1',
            },
          }),
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          action: 'store.custom_ingested',
        }),
      );
    });
  });

  describe('validatePayload', () => {
    it('returns error when payload is empty or null', () => {
      const result = controller.validatePayload({ payload: null } as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Payload is empty or null.');
    });

    it('successfully validates a valid products array', () => {
      const validPayload = [
        {
          sourceId: 'P-1',
          title: 'Valid T-Shirt',
          priceCents: 2500,
        },
      ];

      const result = controller.validatePayload({ payload: validPayload });
      expect(result.valid).toBe(true);
      expect(result.normalizedCount).toBe(1);
      expect(result.sample[0].title).toBe('Valid T-Shirt');
    });
  });

  describe('getIngestHistory', () => {
    it('returns formatted ingestion history from audit events', async () => {
      const history = await controller.getIngestHistory('ws-1');
      expect(history).toHaveLength(1);
      expect(history[0].storeName).toBe('Test Ingest');
      expect(history[0].total).toBe(5);
      expect(history[0].created).toBe(3);
      expect(history[0].actor?.name).toBe('Admin User');
    });
  });

  describe('getCredentials & rotateWebhookSecret', () => {
    it('generates and returns masked developer credentials when not yet provisioned', async () => {
      const res = await controller.getCredentials('ws-1');
      expect(res.success).toBe(true);
      expect(res.apiKeyMasked).toContain('nxf_live_');
      expect(res.webhookSecretMasked).toContain('whsec_');
      expect(res.pushEndpoint).toContain('/api/v1/workspaces/ws-1/integrations/custom/products');
      expect(res.webhookEndpoint).toContain('/api/v1/workspaces/ws-1/integrations/custom/orders');
    });

    it('rotates webhook secret, saves encrypted token, and logs audit record', async () => {
      const res = await controller.rotateWebhookSecret('ws-1', mockUser as any);
      expect(res.success).toBe(true);
      expect(res.webhookSecret).toContain('whsec_');
      expect(mockPrisma.storeConnection.upsert).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          action: 'store.custom_secret_rotated',
        }),
      );
    });
  });
});
