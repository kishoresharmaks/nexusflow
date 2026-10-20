import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkedInIntegrationService } from '../src/integrations/linkedin/linkedin.service';
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

describe('LinkedIn Integration — Service Unit Tests', () => {
  let service: LinkedInIntegrationService;
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
      record: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    service = new LinkedInIntegrationService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('getAuthorizationUrl', () => {
    it('generates a valid LinkedIn OAuth URL with required scopes and signed state', async () => {
      const result = await service.getAuthorizationUrl(workspaceId, userId);

      expect(result.authUrl).toContain('https://www.linkedin.com/oauth/v2/authorization');
      expect(result.authUrl).toContain('response_type=code');
      expect(result.authUrl).toContain('scope=openid+profile+w_member_social');
      expect(result.state).toBeDefined();

      // State is cryptographically signed and decodable
      const decoded = decodeAndVerifyOAuthState(result.state);
      expect(decoded.valid).toBe(true);
      expect(decoded.workspaceId).toBe(workspaceId);
      expect(decoded.userId).toBe(userId);
    });

    it('respects a custom redirectUri if provided', async () => {
      const customRedirect = 'https://app.commercepilot.io/api/integrations/linkedin/callback';
      const result = await service.getAuthorizationUrl(workspaceId, userId, customRedirect);

      expect(result.authUrl).toContain(encodeURIComponent(customRedirect));
    });
  });

  describe('handleCallback', () => {
    it('redirects to denied URL when LinkedIn returns error', async () => {
      const result = await service.handleCallback({
        error: 'user_cancelled_login',
        errorDescription: 'User cancelled authentication flow',
      });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toContain('linkedin=denied');
      expect(result.redirectUrl).toContain('user_cancelled_login');
      expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
    });

    it('fails when code or state is missing', async () => {
      const result = await service.handleCallback({
        code: undefined,
        state: undefined,
      });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toContain('linkedin=failed');
      expect(result.redirectUrl).toContain('missing_parameters');
    });

    it('fails when state is tampered or signature is invalid', async () => {
      const validState = createOAuthState(workspaceId, userId);
      const tamperedState = `${validState}tampered`;

      const result = await service.handleCallback({
        code: 'mock-code-123',
        state: tamperedState,
      });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toContain('linkedin=failed');
      expect(result.redirectUrl).toContain('invalid_state');
      expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
    });

    it('successfully processes callback in test mode, encrypts tokens, and upserts social account', async () => {
      const validState = createOAuthState(workspaceId, userId);
      const mockSavedAccount = {
        id: 'acc_li_123',
        workspaceId,
        provider: SocialProvider.LINKEDIN,
        providerAccountId: 'li_mock_member_782bb4',
        displayName: 'CommercePilot LinkedIn Member',
        username: 'CommercePilot LinkedIn Member',
        encryptedAccessToken: encryptToken('mock_li_token_123'),
        scopes: ['openid', 'profile', 'w_member_social'],
        status: SocialAccountStatus.ACTIVE,
      };

      mockPrisma.socialAccount.upsert.mockResolvedValue(mockSavedAccount);

      const result = await service.handleCallback({
        code: 'mock-auth-code',
        state: validState,
        clientIp: '127.0.0.1',
      });

      expect(result.success).toBe(true);
      expect(result.workspaceId).toBe(workspaceId);
      expect(result.accountId).toBe(mockSavedAccount.id);
      expect(result.memberName).toBe('CommercePilot LinkedIn Member');
      expect(result.redirectUrl).toContain('linkedin=connected');

      // Verify Prisma upsert was called with encrypted token and correct workspaceId
      expect(mockPrisma.socialAccount.upsert).toHaveBeenCalledTimes(1);
      const upsertArgs = mockPrisma.socialAccount.upsert.mock.calls[0][0];
      expect(upsertArgs.where.workspaceId_provider_providerAccountId.workspaceId).toBe(workspaceId);
      expect(upsertArgs.where.workspaceId_provider_providerAccountId.provider).toBe(
        SocialProvider.LINKEDIN,
      );
      expect(upsertArgs.create.providerAccountId).toBe('li_mock_member_782bb4');
      expect(upsertArgs.create.encryptedAccessToken).not.toContain('mock_li_token_'); // encrypted!

      // Verify audit record was created
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          userId,
          action: 'SOCIAL_ACCOUNT_CONNECTED',
          resourceType: 'SocialAccount',
          resourceId: mockSavedAccount.id,
        }),
      );
    });
  });

  describe('getStatus', () => {
    it('returns connected: false when no active account exists in workspace', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue(null);

      const status = await service.getStatus(workspaceId);

      expect(status.connected).toBe(false);
      expect(status.account).toBeNull();
      expect(status.canPublish).toBe(false);
    });

    it('returns safe account details without exposing encrypted tokens or secrets', async () => {
      const activeAccount = {
        id: 'acc_li_456',
        workspaceId,
        provider: SocialProvider.LINKEDIN,
        displayName: 'Jane Doe',
        username: 'jane-doe',
        providerAccountId: 'urn:li:person:999888',
        scopes: ['openid', 'profile', 'w_member_social'],
        status: SocialAccountStatus.ACTIVE,
        encryptedAccessToken: 'iv:tag:cipher-must-never-leak',
        encryptedRefreshToken: 'iv:tag:refresh-must-never-leak',
        tokenExpiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
      };

      mockPrisma.socialAccount.findFirst.mockResolvedValue(activeAccount);

      const status = await service.getStatus(workspaceId);

      expect(status.connected).toBe(true);
      expect(status.canPublish).toBe(true);
      expect(status.account).toBeDefined();
      expect(status.account?.displayName).toBe('Jane Doe');
      expect(status.account?.scopes).toContain('w_member_social');

      // Crucial security check: no token fields present in output
      expect((status.account as any).encryptedAccessToken).toBeUndefined();
      expect((status.account as any).encryptedRefreshToken).toBeUndefined();
    });
  });

  describe('disconnect', () => {
    it('updates status to DISCONNECTED and logs audit event', async () => {
      const activeAccount = {
        id: 'acc_li_789',
        workspaceId,
        provider: SocialProvider.LINKEDIN,
        displayName: 'Test Company',
        status: SocialAccountStatus.ACTIVE,
      };

      mockPrisma.socialAccount.findFirst.mockResolvedValue(activeAccount);
      mockPrisma.socialAccount.update.mockResolvedValue({
        ...activeAccount,
        status: SocialAccountStatus.DISCONNECTED,
      });

      const outcome = await service.disconnect(workspaceId, userId, activeAccount.id, '192.168.1.1');

      expect(outcome.success).toBe(true);
      expect(mockPrisma.socialAccount.update).toHaveBeenCalledWith({
        where: { id: activeAccount.id },
        data: { status: SocialAccountStatus.DISCONNECTED },
      });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          userId,
          action: 'SOCIAL_ACCOUNT_DISCONNECTED',
          resourceType: 'SocialAccount',
          resourceId: activeAccount.id,
        }),
      );
    });

    it('throws NotFoundException when no active account exists to disconnect', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue(null);

      await expect(service.disconnect(workspaceId, userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('publishPost', () => {
    it('rejects post when content is empty', async () => {
      await expect(service.publishPost(workspaceId, userId, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects post when content exceeds 3000 characters', async () => {
      const longContent = 'A'.repeat(3001);
      await expect(service.publishPost(workspaceId, userId, longContent)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects post when no active account exists in workspace', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue(null);

      await expect(service.publishPost(workspaceId, userId, 'Valid content')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('successfully publishes post in test mode and records post with PublishAttempt', async () => {
      const account = {
        id: 'acc_li_111',
        workspaceId,
        provider: SocialProvider.LINKEDIN,
        displayName: 'LinkedIn Test Account',
        providerAccountId: 'urn:li:person:12345',
        scopes: ['openid', 'profile', 'w_member_social'],
        status: SocialAccountStatus.ACTIVE,
        encryptedAccessToken: encryptToken('test_access_token'),
      };

      mockPrisma.socialAccount.findFirst.mockResolvedValue(account);

      const mockDraftPost = {
        id: 'post_123',
        workspaceId,
        status: PostStatus.PUBLISHING,
      };

      const mockPublishedPost = {
        ...mockDraftPost,
        status: PostStatus.PUBLISHED,
        providerPostId: 'urn:li:share:999',
      };

      mockPrisma.post.create.mockResolvedValue(mockDraftPost);
      mockPrisma.post.update.mockResolvedValue(mockPublishedPost);
      mockPrisma.publishAttempt.create.mockResolvedValue({ id: 'att_1' });

      const outcome = await service.publishPost(
        workspaceId,
        userId,
        'Announcing CommercePilot v1 on LinkedIn!',
      );

      expect(outcome.success).toBe(true);
      expect(outcome.providerPostId).toContain('urn:li:share:');
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

  describe('Pricing Plan Entitlements Integration', () => {
    it('enforces social account quota when starting authorization', async () => {
      const mockEntitlements = {
        enforceCanConnectSocialAccount: vi
          .fn()
          .mockRejectedValue(new ForbiddenException('Social account channel limit reached')),
        enforceCanCreatePost: vi.fn(),
      };

      const entitlementsBoundService = new LinkedInIntegrationService(
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

    it('enforces monthly post quota when publishing via LinkedIn', async () => {
      const mockEntitlements = {
        enforceCanConnectSocialAccount: vi.fn(),
        enforceCanCreatePost: vi
          .fn()
          .mockRejectedValue(new ForbiddenException('Monthly post limit reached')),
      };

      const entitlementsBoundService = new LinkedInIntegrationService(
        mockPrisma as unknown as PrismaService,
        mockAudit as unknown as AuditService,
        undefined,
        mockEntitlements as any,
      );

      const account = {
        id: 'acc_li_111',
        workspaceId,
        provider: SocialProvider.LINKEDIN,
        displayName: 'LinkedIn Test Account',
        providerAccountId: 'urn:li:person:12345',
        scopes: ['openid', 'profile', 'w_member_social'],
        status: SocialAccountStatus.ACTIVE,
        encryptedAccessToken: encryptToken('test_access_token'),
      };

      mockPrisma.socialAccount.findFirst.mockResolvedValue(account);

      await expect(
        entitlementsBoundService.publishPost(workspaceId, userId, 'Test post'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockEntitlements.enforceCanCreatePost).toHaveBeenCalledWith(workspaceId);
    });
  });

  describe('refreshToken', () => {
    it('successfully refreshes token when refresh token is present', async () => {
      const account = {
        id: 'acc_li_111',
        workspaceId,
        provider: SocialProvider.LINKEDIN,
        displayName: 'LinkedIn Test User',
        status: SocialAccountStatus.ACTIVE,
        encryptedAccessToken: encryptToken('test_old_access_token'),
        encryptedRefreshToken: encryptToken('test_old_refresh_token'),
        tokenExpiresAt: new Date(Date.now() - 3600000), // Expired 1 hr ago
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

    it('throws NotFoundException when no active LinkedIn account is found', async () => {
      mockPrisma.socialAccount.findFirst.mockResolvedValue(null);

      await expect(service.refreshToken(workspaceId, 'non_existent_id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when account has no encrypted refresh token', async () => {
      const accountWithoutRefresh = {
        id: 'acc_li_222',
        workspaceId,
        provider: SocialProvider.LINKEDIN,
        displayName: 'LinkedIn Test User',
        status: SocialAccountStatus.ACTIVE,
        encryptedAccessToken: encryptToken('test_access_token'),
        encryptedRefreshToken: null,
      };

      mockPrisma.socialAccount.findFirst.mockResolvedValue(accountWithoutRefresh);

      await expect(service.refreshToken(workspaceId, accountWithoutRefresh.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refreshExpiringTokens', () => {
    it('scans and refreshes accounts expiring within threshold', async () => {
      const expiringAccounts = [
        {
          id: 'acc_1',
          workspaceId,
          provider: SocialProvider.LINKEDIN,
          status: SocialAccountStatus.ACTIVE,
          encryptedRefreshToken: encryptToken('test_refresh_1'),
          encryptedAccessToken: encryptToken('test_access_1'),
        },
        {
          id: 'acc_2',
          workspaceId,
          provider: SocialProvider.LINKEDIN,
          status: SocialAccountStatus.ACTIVE,
          encryptedRefreshToken: encryptToken('test_refresh_2'),
          encryptedAccessToken: encryptToken('test_access_2'),
        },
      ];

      mockPrisma.socialAccount.findMany.mockResolvedValue(expiringAccounts);
      mockPrisma.socialAccount.findFirst
        .mockResolvedValueOnce(expiringAccounts[0])
        .mockResolvedValueOnce(expiringAccounts[1]);
      mockPrisma.socialAccount.update.mockResolvedValue({});

      const result = await service.refreshExpiringTokens(7);

      expect(result.scanned).toBe(2);
      expect(result.refreshed).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockPrisma.socialAccount.update).toHaveBeenCalledTimes(2);
    });
  });
});
