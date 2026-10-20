import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StoreConnectionsService } from '../src/integrations/stores/store-connections.service';
import { StorePlatform, StoreSyncStatus } from '@commercepilot/database';

describe('StoreConnectionsService', () => {
  let service: StoreConnectionsService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockAdapterFactory: any;
  let mockShopifyAdapter: any;

  beforeEach(() => {
    mockPrisma = {
      storeConnection: {
        upsert: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
        update: vi.fn(),
      },
      product: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    mockShopifyAdapter = {
      platform: StorePlatform.SHOPIFY,
      testConnection: vi.fn().mockResolvedValue(true),
      fetchProducts: vi.fn().mockResolvedValue([
        {
          sourceId: 'sh_101',
          sku: 'SH-1',
          title: 'Shopify T-Shirt',
          priceCents: 2500,
          currency: 'USD',
          inventoryCount: 50,
          images: [],
          tags: ['apparel'],
        },
      ]),
    };

    mockAdapterFactory = {
      getAdapter: vi.fn().mockReturnValue(mockShopifyAdapter),
    };

    service = new StoreConnectionsService(
      mockPrisma as any,
      mockAudit as any,
      mockAdapterFactory as any,
    );
  });

  it('connects a store, encrypting credentials and masking output', async () => {
    mockPrisma.storeConnection.upsert.mockResolvedValue({
      id: 'conn_1',
      workspaceId: 'ws_1',
      platform: StorePlatform.SHOPIFY,
      storeName: 'Test Store',
      storeUrl: 'https://test-store.myshopify.com',
      encryptedApiKey: 'encrypted_key',
      encryptedSecret: null,
      apiVersion: '2024-01',
      syncStatus: StoreSyncStatus.IDLE,
      syncedProducts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.connectStore(
      'ws_1',
      {
        platform: StorePlatform.SHOPIFY,
        storeName: 'Test Store',
        storeUrl: 'https://test-store.myshopify.com',
        apiKey: 'shpat_test_1234567890',
        apiVersion: '2024-01',
      },
      'usr_1',
    );

    expect(result.id).toBe('conn_1');
    expect(result.apiKeyMasked).toBe('••••••••');
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'store.connected' }),
    );
  });

  it('rejects connection if adapter testConnection fails', async () => {
    mockShopifyAdapter.testConnection.mockResolvedValue(false);

    await expect(
      service.connectStore(
        'ws_1',
        {
          platform: StorePlatform.SHOPIFY,
          storeName: 'Invalid Store',
          storeUrl: 'https://invalid.myshopify.com',
          apiKey: 'bad_key',
        },
        'usr_1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('synchronizes products and upserts into workspace catalog', async () => {
    // Return connection with a valid encrypted key
    const { encryptToken } = await import('../src/social/crypto.util');
    const encryptedKey = encryptToken('shpat_test_key_valid');

    mockPrisma.storeConnection.findFirst.mockResolvedValue({
      id: 'conn_1',
      workspaceId: 'ws_1',
      platform: StorePlatform.SHOPIFY,
      storeName: 'Test Store',
      storeUrl: 'https://test-store.myshopify.com',
      encryptedApiKey: encryptedKey,
      encryptedSecret: null,
      apiVersion: '2024-01',
    });

    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({ id: 'prod_1' });
    mockPrisma.storeConnection.update.mockResolvedValue({});

    const syncResult = await service.syncStore('ws_1', 'conn_1', 'usr_1');

    expect(syncResult.synced).toBe(1);
    expect(syncResult.status).toBe(StoreSyncStatus.SUCCESS);
    expect(mockPrisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          source: StorePlatform.SHOPIFY,
          sourceId: 'sh_101',
          priceCents: 2500,
        }),
      }),
    );
  });

  it('throws NotFoundException when syncing non-existent store', async () => {
    mockPrisma.storeConnection.findFirst.mockResolvedValue(null);

    await expect(service.syncStore('ws_1', 'non_existent_id')).rejects.toThrow(NotFoundException);
  });
});
