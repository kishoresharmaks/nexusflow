import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processTokenRefresh } from '../src/processors/token-refresh.processor';
import { FallbackScheduler } from '../src/processors/fallback-scheduler';
import { prisma, SocialProvider, SocialAccountStatus } from '@commercepilot/database';
import { encryptToken, decryptToken } from '../src/crypto.util';

vi.mock('@commercepilot/database', () => ({
  prisma: {
    socialAccount: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    post: {
      findMany: vi.fn(),
    },
  },
  SocialProvider: {
    META_INSTAGRAM: 'META_INSTAGRAM',
    LINKEDIN: 'LINKEDIN',
    TWITTER: 'TWITTER',
  },
  SocialAccountStatus: {
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
    REVOKED: 'REVOKED',
  },
  PostStatus: {
    SCHEDULED: 'SCHEDULED',
    PUBLISHED: 'PUBLISHED',
  },
}));

describe('Token Refresh Processor & Fallback Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['NODE_ENV'] = 'test';
  });

  describe('processTokenRefresh', () => {
    it('scans and refreshes expiring Instagram accounts', async () => {
      const plainUserToken = 'mock_meta_user_token_abc';
      const plainPageToken = 'mock_meta_page_token_xyz';
      const encryptedRefreshToken = encryptToken(plainUserToken);
      const encryptedAccessToken = encryptToken(plainPageToken);

      const mockAccount = {
        id: 'acc_ig_1',
        workspaceId: 'ws_1',
        provider: SocialProvider.META_INSTAGRAM,
        providerAccountId: 'ig_page_123',
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: new Date(Date.now() + 2 * 24 * 3600 * 1000), // expires in 2 days
        status: SocialAccountStatus.ACTIVE,
      };

      vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([mockAccount as any]);
      vi.mocked(prisma.socialAccount.update).mockResolvedValueOnce({
        ...mockAccount,
        status: SocialAccountStatus.ACTIVE,
      } as any);

      const res = await processTokenRefresh({ daysThreshold: 7 });

      expect(res.scanned).toBe(1);
      expect(res.refreshed).toBe(1);
      expect(res.failed).toBe(0);
      expect(res.expired).toBe(0);
      expect(res.details[0]?.status).toBe('refreshed');
      expect(prisma.socialAccount.update).toHaveBeenCalledTimes(1);
      expect(prisma.socialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc_ig_1' },
          data: expect.objectContaining({
            status: SocialAccountStatus.ACTIVE,
          }),
        }),
      );
    });

    it('scans and refreshes expiring LinkedIn accounts', async () => {
      const encryptedRefreshToken = encryptToken('mock_li_refresh_token_123');
      const encryptedAccessToken = encryptToken('mock_li_access_token_123');

      const mockAccount = {
        id: 'acc_li_1',
        workspaceId: 'ws_1',
        provider: SocialProvider.LINKEDIN,
        providerAccountId: 'li_user_456',
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: new Date(Date.now() + 3 * 24 * 3600 * 1000), // expires in 3 days
        status: SocialAccountStatus.ACTIVE,
      };

      vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([mockAccount as any]);
      vi.mocked(prisma.socialAccount.update).mockResolvedValueOnce({
        ...mockAccount,
        status: SocialAccountStatus.ACTIVE,
      } as any);

      const res = await processTokenRefresh({ workspaceId: 'ws_1', forceRefresh: true });

      expect(res.scanned).toBe(1);
      expect(res.refreshed).toBe(1);
      expect(res.details[0]?.provider).toBe(SocialProvider.LINKEDIN);
      expect(res.details[0]?.status).toBe('refreshed');
    });

    it('gracefully transitions account to EXPIRED if refresh token is revoked', async () => {
      process.env['NODE_ENV'] = 'development';
      delete process.env['MOCK_SOCIAL'];
      process.env['TOKEN_ENCRYPTION_KEY'] =
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      // Simulate a fetch call failure with invalid_grant / revoked
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":{"message":"Error validating access token: Session has expired or is revoked.","code":190,"error_subcode":463}}',
      } as any);

      process.env['INSTAGRAM_CLIENT_ID'] = 'test_client_id';
      process.env['INSTAGRAM_CLIENT_SECRET'] = 'test_client_secret';

      const mockAccount = {
        id: 'acc_ig_revoked',
        workspaceId: 'ws_1',
        provider: SocialProvider.META_INSTAGRAM,
        providerAccountId: 'ig_page_999',
        encryptedAccessToken: encryptToken('real_token_123'),
        encryptedRefreshToken: encryptToken('revoked_refresh_token_123'),
        tokenExpiresAt: new Date(Date.now() - 1000),
        status: SocialAccountStatus.ACTIVE,
      };

      vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([mockAccount as any]);
      vi.mocked(prisma.socialAccount.update).mockResolvedValueOnce({
        ...mockAccount,
        status: SocialAccountStatus.EXPIRED,
      } as any);

      try {
        const res = await processTokenRefresh({ accountId: 'acc_ig_revoked', forceRefresh: true });

        expect(res.scanned).toBe(1);
        expect(res.expired).toBe(1);
        expect(res.details[0]?.status).toBe('expired');
        expect(prisma.socialAccount.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'acc_ig_revoked' },
            data: { status: SocialAccountStatus.EXPIRED },
          }),
        );
      } finally {
        global.fetch = originalFetch;
        process.env['NODE_ENV'] = 'test';
        delete process.env['INSTAGRAM_CLIENT_ID'];
        delete process.env['INSTAGRAM_CLIENT_SECRET'];
      }
    });
  });

  describe('FallbackScheduler Token Polling', () => {
    it('invokes token refresh via FallbackScheduler and stops cleanly', async () => {
      vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.post.findMany).mockResolvedValueOnce([]);

      const scheduler = new FallbackScheduler(50000, 50000);
      const count = await scheduler.pollExpiringTokens(7);

      expect(count).toBe(0);
      scheduler.stop();
    });
  });
});
