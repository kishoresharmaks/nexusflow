import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialService } from '../src/social/social.service';
import { encryptToken, decryptToken, createOAuthState, verifyOAuthState } from '../src/social/crypto.util';
import { SocialProvider, SocialAccountStatus } from '@commercepilot/database';
import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../src/database/prisma.service';
import type { AuditService } from '../src/audit/audit.service';

describe('SocialCryptoUtil', () => {
  it('encrypts and decrypts tokens successfully with AES-256-GCM', () => {
    const rawToken = 'EAABwzLixnjYBAOkK1938jsdf92834jlsdf9';
    const encrypted = encryptToken(rawToken);

    expect(encrypted).not.toBe(rawToken);
    expect(encrypted.split(':').length).toBe(3); // iv:tag:ciphertext

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it('fails decryption if token format or tag is tampered', () => {
    const rawToken = 'secret-token';
    const encrypted = encryptToken(rawToken);
    const parts = encrypted.split(':');

    // Tamper with ciphertext
    const tampered = `${parts[0]}:${parts[1]}:tamperedCiphertext`;
    expect(() => decryptToken(tampered)).toThrow();
  });

  it('creates and verifies cryptographically signed OAuth state parameter', () => {
    const workspaceId = '507f1f77bcf86cd799439011';
    const userId = '507f1f77bcf86cd799439099';

    const state = createOAuthState(workspaceId, userId);
    expect(state).toContain('.');

    const verification = verifyOAuthState(state, workspaceId, userId);
    expect(verification.valid).toBe(true);

    // Fails on workspace mismatch
    const wrongWorkspace = verifyOAuthState(state, '507f1f77bcf86cd799439022', userId);
    expect(wrongWorkspace.valid).toBe(false);
    expect(wrongWorkspace.reason).toContain('workspace');

    // Fails on user mismatch
    const wrongUser = verifyOAuthState(state, workspaceId, '507f1f77bcf86cd799439088');
    expect(wrongUser.valid).toBe(false);
    expect(wrongUser.reason).toContain('user');

    // Fails on tampered signature
    const tamperedState = `${state}tampered`;
    const tamperedVerification = verifyOAuthState(tamperedState, workspaceId, userId);
    expect(tamperedVerification.valid).toBe(false);
  });
});

describe('SocialService', () => {
  let service: SocialService;
  let mockPrisma: any;
  let mockAudit: any;

  const validWorkspaceId = '507f1f77bcf86cd799439011';
  const validAccountId = '507f1f77bcf86cd799439012';
  const validUserId = '507f1f77bcf86cd799439099';

  beforeEach(() => {
    mockPrisma = {
      socialAccount: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    mockAudit = {
      record: vi.fn(),
    };

    service = new SocialService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  it('connectAccount encrypts tokens before persisting and sanitizes return payload', async () => {
    mockPrisma.socialAccount.findFirst.mockResolvedValue(null);
    mockPrisma.socialAccount.create.mockImplementation((args: any) => ({
      id: validAccountId,
      ...args.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await service.connectAccount(
      validWorkspaceId,
      {
        provider: SocialProvider.META_INSTAGRAM,
        providerAccountId: 'ig-12345',
        displayName: 'Acme Instagram',
        accessToken: 'plain-access-token-xyz',
      },
      validUserId,
    );

    expect(result.id).toBe(validAccountId);
    expect(result.displayName).toBe('Acme Instagram');
    // Ensure tokens are NOT leaked in output
    expect((result as any).encryptedAccessToken).toBeUndefined();
    expect((result as any).accessToken).toBeUndefined();

    // Verify DB call stored encrypted token
    const createCall = mockPrisma.socialAccount.create.mock.calls[0][0];
    expect(createCall.data.encryptedAccessToken).toBeDefined();
    expect(createCall.data.encryptedAccessToken).not.toBe('plain-access-token-xyz');
    expect(mockAudit.record).toHaveBeenCalled();
  });

  it('getAccounts strips encrypted tokens for all returned accounts', async () => {
    mockPrisma.socialAccount.findMany.mockResolvedValue([
      {
        id: validAccountId,
        workspaceId: validWorkspaceId,
        provider: SocialProvider.META_INSTAGRAM,
        providerAccountId: 'ig-123',
        displayName: 'Instagram Brand',
        encryptedAccessToken: encryptToken('secret'),
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        scopes: ['instagram_basic', 'instagram_content_publish'],
        status: SocialAccountStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const accounts = await service.getAccounts(validWorkspaceId);
    expect(accounts.length).toBe(1);
    expect((accounts[0] as any).encryptedAccessToken).toBeUndefined();
    expect(accounts[0]?.displayName).toBe('Instagram Brand');
  });

  it('disconnectAccount marks status as DISCONNECTED and records audit event', async () => {
    mockPrisma.socialAccount.findFirst.mockResolvedValue({
      id: validAccountId,
      workspaceId: validWorkspaceId,
      provider: SocialProvider.META_INSTAGRAM,
      displayName: 'Acme Instagram',
      status: SocialAccountStatus.ACTIVE,
    });

    mockPrisma.socialAccount.update.mockResolvedValue({
      id: validAccountId,
      status: SocialAccountStatus.DISCONNECTED,
    });

    const result = await service.disconnectAccount(
      validWorkspaceId,
      validAccountId,
      validUserId,
    );

    expect(result.success).toBe(true);
    expect(mockPrisma.socialAccount.update).toHaveBeenCalledWith({
      where: { id: validAccountId },
      data: { status: SocialAccountStatus.DISCONNECTED },
    });
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SOCIAL_ACCOUNT_DISCONNECTED' }),
    );
  });

  it('getMetaOAuthUrl returns signed OAuth URL bound to workspace and user', () => {
    const res = service.getMetaOAuthUrl(validWorkspaceId, validUserId);
    expect(res.authUrl).toContain('facebook.com/v19.0/dialog/oauth');
    expect(res.authUrl).toContain('instagram_content_publish');
    expect(res.state).toBeDefined();
    expect(res.expiresInSeconds).toBe(600);
  });

  it('handleMetaOAuthCallback validates state and creates account for test flow', async () => {
    mockPrisma.socialAccount.findFirst.mockResolvedValue(null);
    mockPrisma.socialAccount.create.mockImplementation((args: any) => ({
      id: validAccountId,
      ...args.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const validState = createOAuthState(validWorkspaceId, validUserId);
    const accounts = await service.handleMetaOAuthCallback(
      validWorkspaceId,
      validUserId,
      'test-code-123',
      validState,
    );

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.provider).toBe(SocialProvider.META_INSTAGRAM);
    expect(accounts[0]?.displayName).toBe('Test Brand Instagram');
  });

  it('handleMetaOAuthCallback rejects tampered state', async () => {
    await expect(
      service.handleMetaOAuthCallback(
        validWorkspaceId,
        validUserId,
        'test-code-123',
        'invalid.state.payload',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('checkAccountHealth detects active vs expired token status', async () => {
    // 1. Active account
    mockPrisma.socialAccount.findFirst.mockResolvedValueOnce({
      id: validAccountId,
      workspaceId: validWorkspaceId,
      provider: SocialProvider.META_INSTAGRAM,
      displayName: 'Acme IG',
      status: SocialAccountStatus.ACTIVE,
      tokenExpiresAt: new Date(Date.now() + 86400000), // tomorrow
    });

    const activeHealth = await service.checkAccountHealth(validWorkspaceId, validAccountId);
    expect(activeHealth.isValid).toBe(true);
    expect(activeHealth.status).toBe(SocialAccountStatus.ACTIVE);

    // 2. Expired account
    mockPrisma.socialAccount.findFirst.mockResolvedValueOnce({
      id: validAccountId,
      workspaceId: validWorkspaceId,
      provider: SocialProvider.META_INSTAGRAM,
      displayName: 'Acme IG',
      status: SocialAccountStatus.ACTIVE,
      tokenExpiresAt: new Date(Date.now() - 86400000), // yesterday
    });

    const expiredHealth = await service.checkAccountHealth(validWorkspaceId, validAccountId);
    expect(expiredHealth.isValid).toBe(false);
    expect(expiredHealth.status).toBe(SocialAccountStatus.EXPIRED);
    expect(mockPrisma.socialAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: validAccountId },
        data: { status: SocialAccountStatus.EXPIRED },
      }),
    );
  });
});
