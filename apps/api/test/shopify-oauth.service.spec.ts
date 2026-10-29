import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import crypto from 'crypto';
import { ShopifyOAuthService } from '../src/integrations/stores/shopify-oauth/shopify-oauth.service';
import {
  createShopifyOAuthState,
  createShopifyOAuthStateWithTimestamp,
  verifyAndConsumeShopifyOAuthState,
  resetConsumedNoncesForTesting,
} from '../src/integrations/stores/shopify-oauth/shopify-oauth-state.util';
import { WorkspaceRole, StorePlatform, StoreSyncStatus } from '@commercepilot/database';

describe('Shopify OAuth 2.0 & State Security', () => {
  const mockClientId = 'test-shopify-client-id-123';
  const mockClientSecret = 'shpss_test_secret_abc123xyz789';
  const mockCallbackUrl = 'http://localhost:4000/api/v1/integrations/stores/shopify/callback';
  const mockFrontendUrl = 'http://localhost:3000';
  const mockWorkspaceId = 'ws-507f1f77bcf86cd799439011';

  let service: ShopifyOAuthService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockStoreService: any;
  let mockConfigService: any;

  beforeEach(() => {
    resetConsumedNoncesForTesting();

    mockPrisma = {
      membership: {
        findFirst: vi.fn(),
      },
      storeConnection: {
        upsert: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn().mockResolvedValue({ id: mockWorkspaceId, currency: 'USD', locale: 'en-US' }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    mockAudit = {
      record: vi.fn(),
    };

    mockStoreService = {
      syncStore: vi.fn().mockResolvedValue({ synced: 10, status: StoreSyncStatus.SUCCESS }),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        switch (key) {
          case 'shopify.clientId':
            return mockClientId;
          case 'shopify.clientSecret':
            return mockClientSecret;
          case 'shopify.callbackUrl':
            return mockCallbackUrl;
          case 'shopify.scopes':
            return 'read_products,read_inventory';
          case 'shopify.apiVersion':
            return '2026-01';
          case 'shopify.frontendUrl':
            return mockFrontendUrl;
          default:
            return undefined;
        }
      }),
    };

    service = new ShopifyOAuthService(
      mockPrisma,
      mockAudit,
      mockStoreService,
      mockConfigService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Shop Domain Normalization & Security', () => {
    it('normalizes bare shop name to .myshopify.com domain', () => {
      expect(service.normalizeShop('my-cool-brand')).toBe('my-cool-brand.myshopify.com');
    });

    it('strips https:// protocols and trailing paths', () => {
      expect(service.normalizeShop('https://nordic-store.myshopify.com/admin')).toBe(
        'nordic-store.myshopify.com',
      );
    });

    it('rejects invalid or potentially malicious domain inputs', () => {
      expect(() => service.normalizeShop('evil.com')).toThrow();
      expect(() => service.normalizeShop('attacker.myshopify.com.evil.com')).toThrow();
      expect(() => service.normalizeShop('store<script>.myshopify.com')).toThrow();
      expect(() => service.normalizeShop('')).toThrow();
    });
  });

  describe('Cryptographic State Nonce & Replay Protection', () => {
    const wsId = 'ws-507f1f77bcf86cd799439011';
    const uId = 'user-507f191e810c19729de860ea';
    const shop = 'valid-store.myshopify.com';

    it('generates a valid signed state token and verifies successfully on first use', () => {
      const state = createShopifyOAuthState(wsId, uId, shop);
      expect(state).toContain('.');

      const result = verifyAndConsumeShopifyOAuthState(state, shop);
      expect(result.valid).toBe(true);
      expect(result.workspaceId).toBe(wsId);
      expect(result.userId).toBe(uId);
      expect(result.shop).toBe(shop);
    });

    it('strictly prevents replay attacks by rejecting a consumed state nonce on second use', () => {
      const state = createShopifyOAuthState(wsId, uId, shop);

      // First use succeeds
      const firstResult = verifyAndConsumeShopifyOAuthState(state, shop);
      expect(firstResult.valid).toBe(true);

      // Replay attempt must be rejected
      const replayResult = verifyAndConsumeShopifyOAuthState(state, shop);
      expect(replayResult.valid).toBe(false);
      expect(replayResult.reason).toContain('replay attack detected');
    });

    it('rejects state token when expected shop does not match', () => {
      const state = createShopifyOAuthState(wsId, uId, 'shop-a.myshopify.com');
      const result = verifyAndConsumeShopifyOAuthState(state, 'shop-b.myshopify.com');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('does not match expected shop');
    });

    it('rejects state tokens with tampered signatures', () => {
      const state = createShopifyOAuthState(wsId, uId, shop);
      const [payload, sig] = state.split('.');
      const tamperedState = `${payload}.${sig}invalid`;

      const result = verifyAndConsumeShopifyOAuthState(tamperedState, shop);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid state signature');
    });

    it('rejects state tokens with future timestamp skew', () => {
      const futureState = createShopifyOAuthStateWithTimestamp(
        wsId,
        uId,
        shop,
        Date.now() + 100_000, // 100 seconds in future
      );

      const result = verifyAndConsumeShopifyOAuthState(futureState, shop);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('future');
    });
  });

  describe('Shopify HMAC-SHA256 Signature Verification', () => {
    function computeValidHmac(params: Record<string, string>, secret: string): string {
      const sorted = Object.keys(params)
        .filter((k) => k !== 'hmac' && k !== 'signature')
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&');
      return crypto.createHmac('sha256', secret).update(sorted).digest('hex');
    }

    it('verifies valid Shopify HMAC signature correctly', () => {
      const params: Record<string, string> = {
        code: 'shopify_auth_code_987654',
        shop: 'test-store.myshopify.com',
        state: 'valid_state_param',
        timestamp: '1700000000',
      };
      params['hmac'] = computeValidHmac(params, mockClientSecret);

      const isValid = service.verifyShopifyHmac(params);
      expect(isValid).toBe(true);
    });

    it('rejects tampered parameters where HMAC does not match', () => {
      const params: Record<string, string> = {
        code: 'shopify_auth_code_987654',
        shop: 'test-store.myshopify.com',
        state: 'valid_state_param',
        timestamp: '1700000000',
      };
      params['hmac'] = computeValidHmac(params, mockClientSecret);

      // Tamper with code
      params['code'] = 'tampered_code_xyz';

      const isValid = service.verifyShopifyHmac(params);
      expect(isValid).toBe(false);
    });

    it('rejects query missing hmac parameter', () => {
      const isValid = service.verifyShopifyHmac({
        code: '123',
        shop: 'test.myshopify.com',
      });
      expect(isValid).toBe(false);
    });
  });

  describe('Authorization URL Generation', () => {
    it('generates a full authorization URL with all required query parameters', async () => {
      const res = await service.generateAuthorizeUrl(
        'ws-1',
        'user-1',
        'https://nordic-apparel.myshopify.com',
      );

      expect(res.shop).toBe('nordic-apparel.myshopify.com');
      expect(res.authUrl).toContain('https://nordic-apparel.myshopify.com/admin/oauth/authorize?');
      expect(res.authUrl).toContain(`client_id=${mockClientId}`);
      expect(res.authUrl).toContain('scope=read_products%2Cread_inventory');
      expect(res.authUrl).toContain(`redirect_uri=${encodeURIComponent(mockCallbackUrl)}`);
      expect(res.authUrl).toContain('state=');
    });
  });

  describe('Full OAuth Callback Flow', () => {
    const wsId = 'ws-507f1f77bcf86cd799439011';
    const uId = 'user-507f191e810c19729de860ea';
    const shop = 'nordic-apparel.myshopify.com';

    function computeHmac(params: Record<string, string>, secret: string): string {
      const sorted = Object.keys(params)
        .filter((k) => k !== 'hmac' && k !== 'signature')
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&');
      return crypto.createHmac('sha256', secret).update(sorted).digest('hex');
    }

    it('rejects callback when HMAC is invalid and redirects to frontend error', async () => {
      const redirectUrl = await service.handleCallback({
        code: 'code123',
        shop,
        state: 'some-state',
        hmac: 'invalid_hmac_hex',
        timestamp: '1700000000',
      });

      expect(redirectUrl).toContain(`${mockFrontendUrl}/integrations?status=error`);
      expect(redirectUrl).toContain('Invalid%20Shopify%20cryptographic%20signature');
    });

    it('rejects callback when state is invalid/expired and redirects to frontend error', async () => {
      const params: Record<string, string> = {
        code: 'code123',
        shop,
        state: 'invalid.state',
        timestamp: '1700000000',
      };
      params['hmac'] = computeHmac(params, mockClientSecret);

      const redirectUrl = await service.handleCallback(params);
      expect(redirectUrl).toContain(`${mockFrontendUrl}/integrations?status=error`);
    });

    it('rejects callback if user lacks OWNER or ADMIN role in workspace', async () => {
      const state = createShopifyOAuthState(wsId, uId, shop);
      const params: Record<string, string> = {
        code: 'code123',
        shop,
        state,
        timestamp: String(Date.now()),
      };
      params['hmac'] = computeHmac(params, mockClientSecret);

      // User has VIEWER role
      mockPrisma.membership.findFirst.mockResolvedValue({
        workspaceId: wsId,
        userId: uId,
        role: WorkspaceRole.VIEWER,
      });

      const redirectUrl = await service.handleCallback(params);
      expect(redirectUrl).toContain(`${mockFrontendUrl}/integrations?status=error`);
      expect(redirectUrl).toContain('administrative%20permissions');
    });

    it('successfully exchanges code, encrypts token, upserts connection, and triggers sync', async () => {
      const state = createShopifyOAuthState(wsId, uId, shop);
      const params: Record<string, string> = {
        code: 'valid_auth_code_123',
        shop,
        state,
        timestamp: String(Date.now()),
      };
      params['hmac'] = computeHmac(params, mockClientSecret);

      // User has ADMIN role
      mockPrisma.membership.findFirst.mockResolvedValue({
        workspaceId: wsId,
        userId: uId,
        role: WorkspaceRole.ADMIN,
      });

      // Mock token exchange fetch
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/admin/oauth/access_token')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                access_token: 'shpca_real_test_token_abcdef',
                scope: 'read_products,read_inventory',
              }),
          });
        }
        if (url.includes('/admin/api/2026-01/shop.json')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                shop: {
                  id: 12345,
                  name: 'Nordic Apparel Store',
                  currency: 'EUR',
                  myshopify_domain: shop,
                },
              }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch url: ${url}`));
      });
      vi.stubGlobal('fetch', mockFetch);

      mockPrisma.storeConnection.upsert.mockResolvedValue({
        id: 'store-conn-123',
        workspaceId: wsId,
        platform: StorePlatform.SHOPIFY,
        storeName: 'Nordic Apparel Store',
        storeUrl: `https://${shop}`,
        encryptedApiKey: 'encrypted:tag:ciphertext',
        syncStatus: StoreSyncStatus.IDLE,
      });

      const redirectUrl = await service.handleCallback(params);

      expect(redirectUrl).toContain(`${mockFrontendUrl}/integrations?status=success`);
      expect(redirectUrl).toContain('store=Nordic%20Apparel%20Store');

      // Verify token was encrypted before being passed to upsert
      expect(mockPrisma.storeConnection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId_platform_storeUrl: {
              workspaceId: wsId,
              platform: StorePlatform.SHOPIFY,
              storeUrl: `https://${shop}`,
            },
          },
          create: expect.objectContaining({
            platform: StorePlatform.SHOPIFY,
            storeName: 'Nordic Apparel Store',
            encryptedApiKey: expect.stringMatching(/^.+:.+:.+$/), // AES-256-GCM iv:tag:ciphertext
          }),
        }),
      );

      // Verify audit logging
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: wsId,
          userId: uId,
          action: 'store.connected',
        }),
      );

      // Verify initial sync was triggered
      expect(mockStoreService.syncStore).toHaveBeenCalledWith(wsId, 'store-conn-123', uId);
    });
  });
});
