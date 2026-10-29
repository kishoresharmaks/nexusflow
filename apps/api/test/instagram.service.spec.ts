import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstagramIntegrationService } from '../src/integrations/instagram/instagram.service';
import { SocialProvider, SocialAccountStatus, PostStatus } from '@commercepilot/database';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  encryptToken,
  decryptToken,
  createOAuthState,
  decodeAndVerifyOAuthState,
} from '../src/social/crypto.util';
import type { PrismaService } from '../src/database/prisma.service';
import type { AuditService } from '../src/audit/audit.service';

describe('Instagram Integration — Service Unit Tests', () => {
  let service: InstagramIntegrationService;
  let mockPrisma: any;
  let mockAudit: any;

  const workspaceId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439099';

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      socialAccount: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      post: {
        create: vi.fn(),
        update: vi.fn(),
      },
      publishAttempt: {
        create: vi.fn(),
      },
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue({ id: 'audit-ig-1' }),
    };

    service = new InstagramIntegrationService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('getAuthorizationUrl', () => {
    it('generates a valid Meta OAuth URL with Instagram scopes and signed state', async () => {
      const result = await service.getAuthorizationUrl(workspaceId, userId);

      expect(result.authUrl).toMatch(/https:\/\/www\.facebook\.com\/v\d+\.\d+\/dialog\/oauth/);
      expect(result.authUrl).toContain('response_type=code');
      expect(result.authUrl).toContain('instagram_basic');
      expect(result.authUrl).toContain('instagram_content_publish');
      expect(result.authUrl).toContain('pages_show_list');
      expect(result.state).toBeDefined();

      const decoded = decodeAndVerifyOAuthState(result.state);
      expect(decoded.valid).toBe(true);
      expect(decoded.workspaceId).toBe(workspaceId);
      expect(decoded.userId).toBe(userId);
    });

    it('respects a custom redirectUri if provided', async () => {
      const customRedirect = 'https://app.commercepilot.io/api/integrations/instagram/callback';
      const result = await service.getAuthorizationUrl(workspaceId, userId, customRedirect);

      expect(result.authUrl).toContain(encodeURIComponent(customRedirect));
    });
  });

  describe('handleCallback', () => {
    it('redirects to denied URL when Meta returns error', async () => {
      const result = await service.handleCallback({
        error: 'access_denied',
        errorDescription: 'User cancelled Meta authorization dialog',
      });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toContain('instagram=denied');
      expect(result.redirectUrl).toContain('access_denied');
      expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
    });

    it('fails when code or state is missing', async () => {
      const result = await service.handleCallback({
        code: undefined,
        state: undefined,
      });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toContain('instagram=failed');
      expect(result.redirectUrl).toContain('missing_parameters');
    });

    it('fails when state is tampered or signature is invalid', async () => {
      const validState = createOAuthState(workspaceId, userId);
      const tamperedState = validState.slice(0, -6) + 'bad000';

      const result = await service.handleCallback({
        code: 'mock_code_12345',
        state: tamperedState,
      });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toContain('instagram=failed');
      expect(result.redirectUrl).toContain('invalid_state');
    });

    it('exchanges mock code, encrypts access token with AES-256-GCM, and upserts Instagram SocialAccount', async () => {
      const validState = createOAuthState(workspaceId, userId);

      mockPrisma.socialAccount.upsert.mockResolvedValue({
        id: 'acc_ig_123',
        workspaceId,
        provider: SocialProvider.META_INSTAGRAM,
        providerAccountId: 'ig_9999999',
        displayName: 'Test Brand Instagram',
        username: 'testbrand_ig',
        status: SocialAccountStatus.ACTIVE,
      });

      const outcome = await service.handleCallback({
        code: 'mock_authorization_code_abc',
        state: validState,
        clientIp: '127.0.0.1',
      });

      expect(outcome.success).toBe(true);
      expect(outcome.workspaceId).toBe(workspaceId);
      expect(outcome.accountId).toBe('acc_ig_123');
      expect(outcome.redirectUrl).toContain('instagram=connected');

      expect(mockPrisma.socialAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId_provider_providerAccountId: expect.objectContaining({
              workspaceId,
              provider: SocialProvider.META_INSTAGRAM,
            }),
          }),
          create: expect.objectContaining({
            provider: SocialProvider.META_INSTAGRAM,
            status: SocialAccountStatus.ACTIVE,
            encryptedAccessToken: expect.any(String),
          }),
        }),
      );

      const upsertArgs = mockPrisma.socialAccount.upsert.mock.calls[0][0];
      const encryptedToken = upsertArgs.create.encryptedAccessToken;
      const decrypted = decryptToken(encryptedToken);
      expect(decrypted).toContain('mock_meta_ig_token');

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOCIAL_ACCOUNT_CONNECTED',
          resourceType: 'SocialAccount',
          resourceId: 'acc_ig_123',
        }),
      );
    });
  });

  describe('getStatus', () => {
    it('returns connected: false when no active Instagram account is found', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue(null);

      const status = await service.getStatus(workspaceId);

      expect(status.connected).toBe(false);
      expect(status.account).toBeNull();
      expect(status.canPublish).toBe(false);
    });

    it('returns safe display info without exposing encrypted token when connected', async () => {
      const futureDate = new Date(Date.now() + 60 * 24 * 3600 * 1000);
      mockPrisma.socialAccount.findFirst.mockResolvedValue({
        id: 'acc_ig_1',
        workspaceId,
        provider: SocialProvider.META_INSTAGRAM,
        displayName: 'Acme Brand Instagram',
        username: 'acme_official',
        providerAccountId: 'ig_7777777',
        scopes: ['instagram_basic', 'instagram_content_publish'],
        status: SocialAccountStatus.ACTIVE,
        encryptedAccessToken: encryptToken('secret_token'),
        tokenExpiresAt: futureDate,
        createdAt: new Date('2026-01-01'),
      });

      const status = await service.getStatus(workspaceId);

      expect(status.connected).toBe(true);
      expect(status.canPublish).toBe(true);
      expect(status.account).toBeDefined();
      expect(status.account?.displayName).toBe('Acme Brand Instagram');
      expect(status.account?.username).toBe('acme_official');
      expect((status.account as any)?.encryptedAccessToken).toBeUndefined();
    });

    it('returns canPublish: false if token is expired', async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);
      mockPrisma.socialAccount.findFirst.mockResolvedValue({
        id: 'acc_ig_1',
        workspaceId,
        provider: SocialProvider.META_INSTAGRAM,
        displayName: 'Acme Brand Instagram',
        scopes: ['instagram_basic', 'instagram_content_publish'],
        status: SocialAccountStatus.ACTIVE,
        tokenExpiresAt: pastDate,
        createdAt: new Date(),
      });

      const status = await service.getStatus(workspaceId);

      expect(status.connected).toBe(true);
      expect(status.canPublish).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('marks Instagram account DISCONNECTED and records audit log', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue({
        id: 'acc_ig_to_disconnect',
        workspaceId,
        provider: SocialProvider.META_INSTAGRAM,
        displayName: 'Old Instagram Account',
        status: SocialAccountStatus.ACTIVE,
      });
      mockPrisma.socialAccount.update.mockResolvedValue({});

      const result = await service.disconnect(workspaceId, userId, 'acc_ig_to_disconnect');

      expect(result.success).toBe(true);
      expect(mockPrisma.socialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc_ig_to_disconnect' },
        data: { status: SocialAccountStatus.DISCONNECTED },
      });
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOCIAL_ACCOUNT_DISCONNECTED',
          resourceType: 'SocialAccount',
          resourceId: 'acc_ig_to_disconnect',
        }),
      );
    });

    it('throws NotFoundException if account does not exist in workspace', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue(null);

      await expect(service.disconnect(workspaceId, userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('publishPost', () => {
    const mockActiveAccount = {
      id: 'acc_ig_publish',
      workspaceId,
      provider: SocialProvider.META_INSTAGRAM,
      displayName: 'Fashion Brand Instagram',
      providerAccountId: 'ig_17841400000000001',
      scopes: ['instagram_basic', 'instagram_content_publish'],
      status: SocialAccountStatus.ACTIVE,
      encryptedAccessToken: encryptToken('test_access_token'),
    };

    it('throws BadRequestException when content is empty', async () => {
      await expect(
        service.publishPost(workspaceId, userId, '   ', ['https://example.com/item.jpg']),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when content exceeds 2,200 characters', async () => {
      const longContent = 'A'.repeat(2201);
      await expect(
        service.publishPost(workspaceId, userId, longContent, ['https://example.com/item.jpg']),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when mediaUrls array is empty (Instagram requires media)', async () => {
      await expect(
        service.publishPost(workspaceId, userId, 'Caption without image', []),
      ).rejects.toThrow('Instagram Feed posts require at least one image or video media URL.');
    });

    it('throws BadRequestException when no active Instagram account is connected', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.publishPost(workspaceId, userId, 'Summer collection out now!', [
          'https://example.com/img.png',
        ]),
      ).rejects.toThrow('No active Instagram account connected for this workspace.');
    });

    it('throws BadRequestException when account lacks instagram_content_publish scope', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue({
        ...mockActiveAccount,
        scopes: ['instagram_basic'],
      });

      await expect(
        service.publishPost(workspaceId, userId, 'Caption', ['https://example.com/photo.png']),
      ).rejects.toThrow(
        'The connected Instagram account lacks the required instagram_content_publish permission.',
      );
    });

    it('creates post, marks PUBLISHED, records publish attempt, and records audit in mock/test mode', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue(mockActiveAccount);

      const mockDraftPost = {
        id: 'post_ig_1',
        workspaceId,
        socialAccountId: mockActiveAccount.id,
        content: 'Check out our new summer sandals! #fashion #summer',
        mediaUrls: ['https://example.com/sandals.jpg'],
        status: PostStatus.PUBLISHING,
      };

      mockPrisma.post.create.mockResolvedValue(mockDraftPost);
      mockPrisma.post.update.mockResolvedValue({
        ...mockDraftPost,
        status: PostStatus.PUBLISHED,
        providerPostId: 'ig_post_123456789',
        publishedAt: new Date(),
      });
      mockPrisma.publishAttempt.create.mockResolvedValue({ id: 'att_ig_1' });

      const outcome = await service.publishPost(
        workspaceId,
        userId,
        'Check out our new summer sandals! #fashion #summer',
        ['https://example.com/sandals.jpg'],
      );

      expect(outcome.success).toBe(true);
      expect(outcome.providerPostId).toContain('ig_post_');
      expect(mockPrisma.post.create).toHaveBeenCalled();
      expect(mockPrisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockDraftPost.id },
          data: expect.objectContaining({
            status: PostStatus.PUBLISHED,
          }),
        }),
      );
      expect(mockPrisma.publishAttempt.create).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'POST_PUBLISHED',
          resourceType: 'Post',
        }),
      );
    });
  });

  describe('refreshToken', () => {
    it('successfully refreshes token and updates tokenExpiresAt', async () => {
      const account = {
        id: 'acc_ig_111',
        workspaceId,
        provider: SocialProvider.META_INSTAGRAM,
        displayName: 'Instagram Brand User',
        status: SocialAccountStatus.ACTIVE,
        encryptedAccessToken: encryptToken('test_old_meta_token'),
        tokenExpiresAt: new Date(Date.now() - 3600000),
      };

      mockPrisma.socialAccount.findFirst.mockResolvedValue(account);
      mockPrisma.socialAccount.update.mockResolvedValue({
        ...account,
        tokenExpiresAt: new Date(Date.now() + 5184000 * 1000),
      });

      const outcome = await service.refreshToken(workspaceId, account.id, userId);

      expect(outcome.success).toBe(true);
      expect(outcome.accountId).toBe(account.id);
      expect(outcome.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(mockPrisma.socialAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: account.id },
          data: expect.objectContaining({
            status: SocialAccountStatus.ACTIVE,
          }),
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOCIAL_ACCOUNT_REFRESHED',
          resourceType: 'SocialAccount',
          resourceId: account.id,
        }),
      );
    });

    it('throws NotFoundException when no active Instagram account is found', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue(null);

      await expect(service.refreshToken(workspaceId, 'non_existent_id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('refreshExpiringTokens', () => {
    it('scans and refreshes Instagram accounts expiring within threshold', async () => {
      const expiringAccounts = [
        {
          id: 'acc_ig_expiring_1',
          workspaceId,
          provider: SocialProvider.META_INSTAGRAM,
          status: SocialAccountStatus.ACTIVE,
          encryptedAccessToken: encryptToken('test_token_1'),
        },
      ];

      mockPrisma.socialAccount.findMany.mockResolvedValue(expiringAccounts);
      mockPrisma.socialAccount.findFirst.mockResolvedValue(expiringAccounts[0]);
      mockPrisma.socialAccount.update.mockResolvedValue({});

      const result = await service.refreshExpiringTokens(7);

      expect(result.scanned).toBe(1);
      expect(result.refreshed).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockPrisma.socialAccount.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pricing Plan Entitlements Integration', () => {
    it('enforces social account quota when starting Instagram authorization', async () => {
      const mockEntitlements = {
        enforceCanConnectSocialAccount: vi
          .fn()
          .mockRejectedValue(new ForbiddenException('Social account channel limit reached')),
        enforceCanCreatePost: vi.fn(),
      };

      const entitlementsBoundService = new InstagramIntegrationService(
        mockPrisma as unknown as PrismaService,
        mockAudit as unknown as AuditService,
        undefined,
        mockEntitlements as any,
      );

      mockPrisma.socialAccount.findFirst.mockResolvedValue(null);

      await expect(
        entitlementsBoundService.getAuthorizationUrl(workspaceId, userId),
      ).rejects.toThrow(ForbiddenException);

      expect(mockEntitlements.enforceCanConnectSocialAccount).toHaveBeenCalledWith(workspaceId);
    });

    it('enforces monthly post quota when publishing via Instagram', async () => {
      const mockEntitlements = {
        enforceCanConnectSocialAccount: vi.fn(),
        enforceCanCreatePost: vi
          .fn()
          .mockRejectedValue(new ForbiddenException('Monthly post limit reached')),
      };

      const entitlementsBoundService = new InstagramIntegrationService(
        mockPrisma as unknown as PrismaService,
        mockAudit as unknown as AuditService,
        undefined,
        mockEntitlements as any,
      );

      const account = {
        id: 'acc_ig_quota',
        workspaceId,
        provider: SocialProvider.META_INSTAGRAM,
        displayName: 'Instagram Test Account',
        providerAccountId: 'ig_12345',
        scopes: ['instagram_basic', 'instagram_content_publish'],
        status: SocialAccountStatus.ACTIVE,
        encryptedAccessToken: encryptToken('test_access_token'),
      };

      mockPrisma.socialAccount.findFirst.mockResolvedValue(account);

      await expect(
        entitlementsBoundService.publishPost(workspaceId, userId, 'Test caption', [
          'https://example.com/banner.jpg',
        ]),
      ).rejects.toThrow(ForbiddenException);

      expect(mockEntitlements.enforceCanCreatePost).toHaveBeenCalledWith(workspaceId);
    });
  });
});
