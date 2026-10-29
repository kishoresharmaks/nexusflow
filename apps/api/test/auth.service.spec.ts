import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../src/auth/auth.service';
import { WorkspaceRole } from '@commercepilot/database';
import { ConflictException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../src/database/prisma.service';
import type { AuditService } from '../src/audit/audit.service';
import { hash } from '@node-rs/argon2';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockEmail: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      membership: {
        create: vi.fn(),
      },
      session: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      platformSetting: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      workspaceInvitation: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    mockEmail = {
      sendVerificationEmail: vi.fn().mockResolvedValue({ id: 'mail_1' }),
      sendPasswordResetEmail: vi.fn().mockResolvedValue({ id: 'mail_2' }),
      sendSecurityAlertEmail: vi.fn().mockResolvedValue({ id: 'mail_3' }),
    };

    authService = new AuthService(
      mockPrisma as PrismaService,
      mockAudit as AuditService,
      mockEmail as any,
    );
  });

  describe('register', () => {
    it('should register a new user and create their default personal workspace with an active session', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user_123',
        email: 'seller@example.com',
        name: 'Jane Seller',
        isEmailVerified: false,
      });
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.create.mockResolvedValue({
        id: 'ws_123',
        name: "Jane Seller's Workspace",
        slug: 'jane-seller-123456',
      });
      mockPrisma.membership.create.mockResolvedValue({
        id: 'mem_123',
        userId: 'user_123',
        workspaceId: 'ws_123',
        role: WorkspaceRole.OWNER,
      });
      mockPrisma.session.create.mockResolvedValue({
        id: 'sess_123',
      });

      const res = await authService.register(
        { email: 'seller@example.com', password: 'Password123!', name: 'Jane Seller' },
        '127.0.0.1',
      );

      expect(res.user.email).toBe('seller@example.com');
      expect(res.workspace?.id).toBe('ws_123');
      expect(res.workspace?.role).toBe(WorkspaceRole.OWNER);
      expect(typeof res.sessionToken).toBe('string');
      expect(res.sessionToken.length).toBeGreaterThan(20);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTH_REGISTER',
          workspaceId: 'ws_123',
          userId: 'user_123',
        }),
      );
    });

    it('should throw ConflictException if email is already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing_id' });

      await expect(
        authService.register({
          email: 'duplicate@example.com',
          password: 'Password123!',
          name: 'Jane',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException if allow_public_registrations is disabled and no invite provided', async () => {
      mockPrisma.platformSetting.findUnique.mockImplementation(({ where }: any) => {
        if (where.key === 'allow_public_registrations') {
          return Promise.resolve({ key: 'allow_public_registrations', value: { enabled: false } });
        }
        return Promise.resolve(null);
      });

      await expect(
        authService.register({
          email: 'newuser@example.com',
          password: 'Password123!',
          name: 'Restricted User',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow registration when public registration is disabled if a valid invitationToken is present', async () => {
      mockPrisma.platformSetting.findUnique.mockImplementation(({ where }: any) => {
        if (where.key === 'allow_public_registrations') {
          return Promise.resolve({ key: 'allow_public_registrations', value: { enabled: false } });
        }
        return Promise.resolve(null);
      });

      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue({
        id: 'invite_1',
        emailNormalized: 'invited@example.com',
        tokenHash: 'hashed_token_123',
        expiresAt: new Date(Date.now() + 86400000),
      });

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user_invited',
        email: 'invited@example.com',
        name: 'Invited Member',
      });
      mockPrisma.workspace.create.mockResolvedValue({ id: 'ws_inv', name: "Invited Member's Workspace", slug: 'slug-inv' });
      mockPrisma.membership.create.mockResolvedValue({ id: 'mem_inv' });
      mockPrisma.session.create.mockResolvedValue({ id: 'sess_inv' });

      const res = await authService.register({
        email: 'invited@example.com',
        password: 'Password123!',
        name: 'Invited Member',
        invitationToken: 'valid_token_123',
      });

      expect(res.user.email).toBe('invited@example.com');
    });
  });

  describe('login', () => {
    it('should authenticate user with valid password and return session token', async () => {
      const hashed = await hash('ValidPassword123!');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        email: 'seller@example.com',
        name: 'Jane Seller',
        passwordHash: hashed,
        isEmailVerified: true,
        memberships: [
          {
            role: WorkspaceRole.OWNER,
            workspace: { id: 'ws_123', name: 'Main', slug: 'main' },
          },
        ],
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'sess_123' });

      const res = await authService.login({
        email: 'seller@example.com',
        password: 'ValidPassword123!',
      });

      expect(res.user.email).toBe('seller@example.com');
      expect(res.workspaces?.[0]?.id).toBe('ws_123');
      expect(typeof res.sessionToken).toBe('string');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTH_LOGIN' }),
      );
    });

    it('should reject invalid password with UnauthorizedException', async () => {
      const hashed = await hash('CorrectPassword123!');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        email: 'seller@example.com',
        passwordHash: hashed,
      });

      await expect(
        authService.login({
          email: 'seller@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject nonexistent email with UnauthorizedException', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'notfound@example.com',
          password: 'AnyPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke active session token and record audit event', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess_123',
        userId: 'user_123',
        revokedAt: null,
        user: {
          memberships: [{ workspaceId: 'ws_123' }],
        },
      });
      mockPrisma.session.update.mockResolvedValue({});

      const res = await authService.logout('raw_token_xyz');
      expect(res.success).toBe(true);
      expect(mockPrisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('resetPassword', () => {
    it('should update password and revoke all active sessions for the user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user_123',
        memberships: [{ workspaceId: 'ws_123' }],
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.session.updateMany.mockResolvedValue({ count: 3 });

      const res = await authService.resetPassword({
        token: 'valid_token',
        newPassword: 'NewPassword123!',
      });

      expect(res.message).toContain('Password has been reset successfully');
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user_123', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw BadRequestException if token is invalid or expired', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.resetPassword({
          token: 'invalid_or_expired_token',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateSession', () => {
    it('should return null if session is expired', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess_123',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // Expired in past
      });

      const session = await authService.validateSession('token');
      expect(session).toBeNull();
    });

    it('should return null if session has been revoked', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'sess_123',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      });

      const session = await authService.validateSession('token');
      expect(session).toBeNull();
    });
  });
});
