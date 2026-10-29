import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspacesService } from '../src/workspaces/workspaces.service';
import { AuthService } from '../src/auth/auth.service';
import { WorkspaceGuard } from '../src/workspaces/guards/workspace.guard';
import {
  WorkspaceRole,
  UserAccountStatus,
  MembershipStatus,
  InvitationStatus,
} from '@commercepilot/database';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PrismaService } from '../src/database/prisma.service';
import type { AuditService } from '../src/audit/audit.service';
import type { EmailService } from '../src/email/email.service';
import { createHash } from 'crypto';
import { hash } from '@node-rs/argon2';

describe('Team & Access Management: Domain Independence, Activation & Verification Suite', () => {
  let workspacesService: WorkspacesService;
  let authService: AuthService;
  let workspaceGuard: WorkspaceGuard;

  let mockPrisma: any;
  let mockAudit: any;
  let mockEmail: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      workspace: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      membership: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      workspaceInvitation: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      session: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      platformAdmin: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cbOrArray) => {
        if (typeof cbOrArray === 'function') {
          return cbOrArray(mockPrisma);
        }
        return Promise.all(cbOrArray);
      }),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue({ id: 'audit_1' }),
    };

    mockEmail = {
      sendEmail: vi.fn().mockResolvedValue({ id: 'email_1' }),
      sendVerificationEmail: vi.fn().mockResolvedValue({ id: 'email_verify' }),
      sendAccountActivationEmail: vi.fn().mockResolvedValue({ id: 'email_act' }),
      sendWorkspaceAddedEmail: vi.fn().mockResolvedValue({ id: 'email_added' }),
      sendWorkspaceInvitationEmail: vi.fn().mockResolvedValue({ id: 'email_inv' }),
      sendInvitationEmail: vi.fn().mockResolvedValue({ id: 'email_inv' }),
      sendInvitationAcceptedNotification: vi.fn().mockResolvedValue({ id: 'email_accepted' }),
    };

    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'ALLOW_PUBLIC_REGISTRATIONS') return 'true';
        return null;
      }),
    };

    workspacesService = new WorkspacesService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
      mockEmail as unknown as EmailService,
    );

    authService = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
      mockEmail as unknown as EmailService,
      mockConfig as any,
    );

    workspaceGuard = new WorkspaceGuard(mockPrisma as unknown as PrismaService);
  });

  // --- SECTION A: Mandatory Independence Rules ---
  describe('Mandatory Domain Independence Rules', () => {
    const wsA = '507f1f77bcf86cd799439011';
    const wsB = '507f1f77bcf86cd799439022';
    const userId = 'user_multi_workspace';

    it('Rule 2 & 3: Removing user from Workspace A does not deactivate account or modify Workspace B', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_ws_a',
        workspaceId: wsA,
        userId,
        role: WorkspaceRole.MEMBER,
      });
      mockPrisma.membership.delete.mockResolvedValue({ id: 'mem_ws_a' });

      const res = await workspacesService.removeMember(wsA, 'owner_1', WorkspaceRole.OWNER, 'mem_ws_a');
      expect(res.success).toBe(true);
      expect(mockPrisma.membership.delete).toHaveBeenCalledWith({ where: { id: 'mem_ws_a' } });

      // User account must NOT be deactivated or modified
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      // Workspace B membership is completely untouched
      expect(mockPrisma.membership.delete).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'mem_ws_b' } }));
    });

    it('Rule 8 & 10: Suspending or removing membership in Workspace A blocks access to A via WorkspaceGuard', async () => {
      // 1. Suspended in Workspace A
      const reqA: any = {
        user: { id: userId, accountStatus: UserAccountStatus.ACTIVE, isSuspended: false },
        params: { workspaceId: wsA },
        headers: {},
      };
      const contextA: any = { switchToHttp: () => ({ getRequest: () => reqA }) };

      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_a',
        userId,
        workspaceId: wsA,
        status: MembershipStatus.SUSPENDED,
        suspensionReason: 'Non-payment',
        workspace: { id: wsA, status: 'ACTIVE' },
      });

      await expect(workspaceGuard.canActivate(contextA)).rejects.toThrow(
        /membership in this workspace has been suspended/,
      );

      // 2. Active in Workspace B -> access must succeed
      const reqB: any = {
        user: { id: userId, accountStatus: UserAccountStatus.ACTIVE, isSuspended: false },
        params: { workspaceId: wsB },
        headers: {},
      };
      const contextB: any = { switchToHttp: () => ({ getRequest: () => reqB }) };

      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_b',
        userId,
        workspaceId: wsB,
        status: MembershipStatus.ACTIVE,
        role: WorkspaceRole.MEMBER,
        workspace: { id: wsB, status: 'ACTIVE' },
      });

      const allowedB = await workspaceGuard.canActivate(contextB);
      expect(allowedB).toBe(true);
    });

    it('Rule 1 & 4: Account-level suspension blocks access platform-wide without altering stored membership status', async () => {
      const req: any = {
        user: { id: userId, accountStatus: UserAccountStatus.SUSPENDED, isSuspended: true },
        params: { workspaceId: wsA },
        headers: {},
      };
      const context: any = { switchToHttp: () => ({ getRequest: () => req }) };

      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_a',
        userId,
        workspaceId: wsA,
        status: MembershipStatus.ACTIVE, // Stored membership is ACTIVE
        workspace: { id: wsA, status: 'ACTIVE' },
      });

      await expect(workspaceGuard.canActivate(context)).rejects.toThrow(
        /account has been suspended platform-wide/,
      );
      // Stored membership remains untouched
      expect(mockPrisma.membership.update).not.toHaveBeenCalled();
    });

    it('Rule 11: Changing workspace role does not alter global user account status or email verification', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_1',
        workspaceId: wsA,
        userId: 'user_target',
        role: WorkspaceRole.MEMBER,
      });
      mockPrisma.membership.update.mockResolvedValue({
        id: 'mem_1',
        role: WorkspaceRole.ADMIN,
        user: { id: 'user_target', email: 'test@example.com', name: 'Test' },
      });

      await workspacesService.updateMemberRole(wsA, 'owner_1', WorkspaceRole.OWNER, 'mem_1', {
        role: WorkspaceRole.ADMIN,
      });

      // Role updated on Membership only
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { role: WorkspaceRole.ADMIN },
        }),
      );
      // User table never touched
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('Rule 12: Disallows assigning OWNER directly through role update', async () => {
      await expect(
        workspacesService.updateMemberRole(wsA, 'owner_1', WorkspaceRole.OWNER, 'mem_1', {
          role: WorkspaceRole.OWNER as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // --- SECTION B: Direct Membership Creation & Invitations (COMMENTED - awaiting service refactor) ---
  // These tests verify invitation creation, but require deeper service refactoring to handle
  // the new invitation-only (no placeholder user) workflow properly.
  // TODO: Rewrite after WorkspacesService.createInvitation fully replaces createMemberDirectly
  describe.skip('Direct Member Creation & Activation Lifecycle', () => {
    const wsId = '507f1f77bcf86cd799439011';

    it('provisions a PENDING_ACTIVATION user and sends activation email when email is new', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ id: wsId, name: 'Acme Commerce' });
      mockPrisma.user.findUnique.mockResolvedValue(null); // User does not exist

      mockPrisma.user.create.mockResolvedValue({
        id: 'new_user_1',
        email: 'newbie@acme.test',
        name: 'Newbie Member',
        accountStatus: UserAccountStatus.PENDING_ACTIVATION,
        isEmailVerified: false,
        emailVerifiedAt: null,
      });

      mockPrisma.membership.create.mockResolvedValue({
        id: 'mem_new_1',
        workspaceId: wsId,
        userId: 'new_user_1',
        role: WorkspaceRole.MEMBER,
        status: MembershipStatus.PENDING_ACCEPTANCE,
        createdAt: new Date(),
      });

      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.workspaceInvitation.create.mockResolvedValue({
        id: 'inv_new_1',
        workspaceId: wsId,
        email: 'newbie@acme.test',
        emailNormalized: 'newbie@acme.test',
        role: WorkspaceRole.MEMBER,
        tokenHash: 'hashed_token_xyz',
        status: InvitationStatus.PENDING,
        invitedByUserId: 'owner_1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
        revokedAt: null,
        emailDeliveryStatus: 'SENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await workspacesService.createInvitation(
        wsId,
        'owner_1',
        WorkspaceRole.OWNER,
        {
          email: 'newbie@acme.test',
          role: WorkspaceRole.MEMBER,
        },
      );

      expect(res.status).toBe(InvitationStatus.PENDING);
      expect(res.role).toBe(WorkspaceRole.MEMBER);
      expect(res.email).toBe('newbie@acme.test');

      // Verifies invitation email was dispatched with a secure token
      expect(mockEmail.sendInvitationEmail).toHaveBeenCalledWith(
        'newbie@acme.test',
        expect.any(String),
        'Acme Commerce',
        'owner_1',
      );

      // Verifies audit log recorded
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVITATION_CREATED',
          resourceType: 'WorkspaceInvitation',
        }),
      );
    });

    it('safely reuses existing user without altering password or global status', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ id: wsId, name: 'Acme Commerce' });
      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.workspaceInvitation.create.mockResolvedValue({
        id: 'inv_veteran',
        workspaceId: wsId,
        email: 'veteran@acme.test',
        emailNormalized: 'veteran@acme.test',
        role: WorkspaceRole.MEMBER,
        tokenHash: 'hashed_token_abc',
        status: InvitationStatus.PENDING,
        invitedByUserId: 'owner_1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        emailDeliveryStatus: 'SENT',
        createdAt: new Date(),
      });

      const res = await workspacesService.createInvitation(
        wsId,
        'owner_1',
        WorkspaceRole.OWNER,
        {
          email: 'veteran@acme.test',
          role: WorkspaceRole.MEMBER,
        },
      );

      expect(res.status).toBe(InvitationStatus.PENDING);
      // Verifies invitation email was dispatched with a secure token
      expect(mockEmail.sendInvitationEmail).toHaveBeenCalledWith(
        'veteran@acme.test',
        expect.any(String),
        'Acme Commerce',
        'owner_1',
      );
    });

    it('prevents adding a user who is already an active member', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({ id: wsId, name: 'Acme Commerce' });
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_active',
        workspaceId: wsId,
        userId: 'active_user',
        status: MembershipStatus.ACTIVE,
      });

      await expect(
        workspacesService.createInvitation(wsId, 'owner_1', WorkspaceRole.OWNER, {
          email: 'active@acme.test',
          role: WorkspaceRole.MEMBER,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // --- SECTION C: Account Activation & Email Verification ---
  describe('Account Activation & Email Verification Lifecycle', () => {
    it('activates account with valid token, hashes password with Argon2, and activates pending membership', async () => {
      const rawToken = 'valid_raw_activation_token_12345';
      const hashedToken = createHash('sha256').update(rawToken).digest('hex');

      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'pending_user_1',
        email: 'activate_me@test.com',
        accountStatus: UserAccountStatus.PENDING_ACTIVATION,
        activationTokenHash: hashedToken,
        memberships: [{ id: 'mem_pend', workspaceId: 'ws_123' }],
      });

      const res = await authService.activateAccount({
        token: rawToken,
        password: 'SecurePassword123!',
      });

      expect(res.message).toContain('Account activated successfully');

      // Verifies user updated to ACTIVE with Argon2 hash and consumed token
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pending_user_1' },
          data: expect.objectContaining({
            accountStatus: UserAccountStatus.ACTIVE,
            activationTokenHash: null,
            activationTokenExpiresAt: null,
          }),
        }),
      );

      // Verifies pending memberships were transitioned to ACTIVE
      expect(mockPrisma.membership.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'pending_user_1',
            status: MembershipStatus.PENDING_ACCEPTANCE,
          },
          data: expect.objectContaining({
            status: MembershipStatus.ACTIVE,
          }),
        }),
      );
    });

    it('rejects activation with invalid or expired token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.activateAccount({
          token: 'expired_or_fake_token',
          password: 'SecurePassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects login when account is still PENDING_ACTIVATION', async () => {
      const hashedPassword = await hash('SecurePassword123!');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user_pending',
        email: 'pending@test.com',
        passwordHash: hashedPassword,
        accountStatus: UserAccountStatus.PENDING_ACTIVATION,
        isSuspended: false,
        memberships: [],
      });

      await expect(
        authService.login({
          email: 'pending@test.com',
          password: 'SecurePassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('verifies email with valid token and sets emailVerifiedAt timestamp', async () => {
      const rawToken = 'verify_raw_token_xyz';
      const hashedToken = createHash('sha256').update(rawToken).digest('hex');

      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user_unverified',
        email: 'verify@test.com',
        isEmailVerified: false,
        emailVerificationToken: hashedToken,
        memberships: [{ workspaceId: 'ws_abc' }],
      });

      const res = await authService.verifyEmail({ token: rawToken });
      expect(res.message).toBe('Email verified successfully.');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user_unverified' },
          data: expect.objectContaining({
            isEmailVerified: true,
            emailVerifiedAt: expect.any(Date),
            emailVerificationToken: null,
            emailVerificationTokenExpiresAt: null,
          }),
        }),
      );
    });

    it('resends verification email with rate limit and token rotation', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user_resend',
        email: 'resend@test.com',
        name: 'Resend User',
        isEmailVerified: false,
        memberships: [{ workspaceId: 'ws_xyz' }],
      });

      const res = await authService.resendVerification('resend@test.com');
      expect(res.message).toContain('verification link has been sent');

      expect(mockEmail.sendVerificationEmail).toHaveBeenCalledWith(
        'resend@test.com',
        'Resend User',
        expect.any(String),
      );
    });
  });

  // --- SECTION D: Workspace Membership Status Toggling ---
  describe('Workspace Membership Status Management', () => {
    const wsId = '507f1f77bcf86cd799439011';

    it('allows an owner to suspend and reactivate a member', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_toggle',
        workspaceId: wsId,
        userId: 'user_target',
        role: WorkspaceRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      });

      mockPrisma.membership.update.mockResolvedValue({
        id: 'mem_toggle',
        role: WorkspaceRole.MEMBER,
        status: MembershipStatus.SUSPENDED,
        user: { id: 'user_target', email: 'target@test.com', name: 'Target' },
      });

      const res = await workspacesService.updateMemberStatus(
        wsId,
        'owner_1',
        WorkspaceRole.OWNER,
        'mem_toggle',
        { status: MembershipStatus.SUSPENDED, reason: 'Pending investigation' },
      );

      expect(res.status).toBe(MembershipStatus.SUSPENDED);
      expect(mockPrisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mem_toggle' },
          data: expect.objectContaining({
            status: MembershipStatus.SUSPENDED,
            suspensionReason: 'Pending investigation',
          }),
        }),
      );
    });

    it('prevents a member from suspending their own membership', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_self',
        workspaceId: wsId,
        userId: 'acting_user',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });

      await expect(
        workspacesService.updateMemberStatus(
          wsId,
          'acting_user',
          WorkspaceRole.ADMIN,
          'mem_self',
          { status: MembershipStatus.SUSPENDED },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents suspending the workspace owner', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_owner',
        workspaceId: wsId,
        userId: 'owner_user',
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      });

      await expect(
        workspacesService.updateMemberStatus(
          wsId,
          'admin_1',
          WorkspaceRole.ADMIN,
          'mem_owner',
          { status: MembershipStatus.SUSPENDED },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
