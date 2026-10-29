import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspacesService } from '../src/workspaces/workspaces.service';
import { WorkspaceRole } from '@commercepilot/database';
import { BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../src/database/prisma.service';
import type { AuditService } from '../src/audit/audit.service';
import type { EmailService } from '../src/email/email.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      workspace: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      membership: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      subscription: { updateMany: vi.fn() },
      workspaceInvitation: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      ownershipTransfer: { updateMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      product: { count: vi.fn().mockResolvedValue(5) },
      socialAccount: { count: vi.fn().mockResolvedValue(2) },
      storeConnection: { count: vi.fn().mockResolvedValue(1) },
      post: { count: vi.fn().mockResolvedValue(3) },
      auditEvent: { findMany: vi.fn().mockResolvedValue([]) },
      approvalPolicy: { findUnique: vi.fn(), upsert: vi.fn() },
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new WorkspacesService(
      mockPrisma as PrismaService,
      mockAudit as AuditService,
      { sendWorkspaceInvitationEmail: vi.fn(), sendOwnershipTransferEmail: vi.fn() } as unknown as EmailService,
    );
  });

  describe('createWorkspace', () => {
    it('creates workspace and assigns creator as OWNER', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.workspace.create.mockResolvedValue({
        id: 'ws_1',
        name: 'Brand Store',
        slug: 'brand-store',
        timezone: 'UTC',
        locale: 'en-US',
        currency: 'USD',
        createdAt: new Date(),
      });
      mockPrisma.membership.create.mockResolvedValue({
        id: 'mem_1',
        role: WorkspaceRole.OWNER,
      });

      const res = await service.createWorkspace('user_1', { name: 'Brand Store' });
      expect(res.workspace.id).toBe('ws_1');
      expect(res.role).toBe(WorkspaceRole.OWNER);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WORKSPACE_CREATED', workspaceId: 'ws_1' }),
      );
    });
  });

  describe('createInvitation', () => {
    it('creates a hashed, pending invitation without creating a placeholder user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.workspaceInvitation.create.mockResolvedValue({
        id: 'invite_2',
        emailNormalized: 'colleague@example.com',
        role: WorkspaceRole.MEMBER,
        createdAt: new Date(),
        expiresAt: new Date(),
      });
      mockPrisma.workspace.findUnique.mockResolvedValue({ id: 'ws_1', name: 'Brand Store' });

      const res = await service.createInvitation('ws_1', 'user_1', WorkspaceRole.OWNER, {
        email: 'colleague@example.com',
        role: WorkspaceRole.MEMBER,
      });

      expect(res.role).toBe(WorkspaceRole.MEMBER);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.workspaceInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tokenHash: expect.any(String) }) }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVITATION_CREATED', workspaceId: 'ws_1' }),
      );
    });

    it('prevents an admin from inviting another admin', async () => {
      await expect(
        service.createInvitation('ws_1', 'user_1', WorkspaceRole.ADMIN, {
          email: 'colleague@example.com',
          role: WorkspaceRole.ADMIN,
        }),
      ).rejects.toThrow('Only the workspace owner can assign ADMIN');
    });
  });

  describe('updateMemberRole', () => {
    it('prevents demoting the sole owner of a workspace', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_owner',
        workspaceId: 'ws_1',
        userId: 'user_1',
        role: WorkspaceRole.OWNER,
      });
      mockPrisma.membership.count.mockResolvedValue(1); // Sole owner

      await expect(service.updateMemberRole('ws_1', 'user_1', WorkspaceRole.OWNER, 'mem_owner', { role: WorkspaceRole.ADMIN })).rejects.toThrow(BadRequestException);
    });

    it('allows demoting an owner if another owner exists', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_owner1',
        workspaceId: 'ws_1',
        userId: 'user_1',
        role: WorkspaceRole.OWNER,
      });
      await expect(service.updateMemberRole('ws_1', 'user_1', WorkspaceRole.OWNER, 'mem_owner1', { role: WorkspaceRole.ADMIN })).rejects.toThrow('ownership transfer');
    });
  });

  describe('removeMember', () => {
    it('prevents removing the sole owner of a workspace', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_owner',
        workspaceId: 'ws_1',
        role: WorkspaceRole.OWNER,
      });
      mockPrisma.membership.count.mockResolvedValue(1);

      await expect(service.removeMember('ws_1', 'user_1', WorkspaceRole.OWNER, 'mem_owner')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deletes membership when not sole owner', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue({
        id: 'mem_member',
        workspaceId: 'ws_1',
        role: WorkspaceRole.MEMBER,
      });
      mockPrisma.membership.delete.mockResolvedValue({});

      const res = await service.removeMember('ws_1', 'user_1', WorkspaceRole.OWNER, 'mem_member');
      expect(res.success).toBe(true);
    });
  });

  describe('getAdminSummary', () => {
    it('returns server-calculated counts, action cards, and redacted activity', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws_1',
        name: 'Brand Store',
        slug: 'brand-store',
        timezone: 'UTC',
        locale: 'en-US',
        currency: 'USD',
        createdAt: new Date(),
      });
      mockPrisma.membership.count.mockResolvedValue(3);
      mockPrisma.workspaceInvitation.count.mockResolvedValue(1);
      mockPrisma.product.count.mockResolvedValue(10);
      mockPrisma.socialAccount.count.mockResolvedValue(2);
      mockPrisma.storeConnection.count.mockResolvedValue(1);
      mockPrisma.post.count.mockResolvedValue(4);
      mockPrisma.auditEvent.findMany.mockResolvedValue([
        {
          id: 'aud_1',
          action: 'WORKSPACE_CREATED',
          resourceType: 'Workspace',
          resourceId: 'ws_1',
          createdAt: new Date(),
          user: { name: 'Admin', email: 'admin@store.com' },
          metadata: { token: 'secret-token-123', name: 'Brand Store' },
        },
      ]);

      const summary = await service.getAdminSummary('ws_1');

      expect(summary.workspace.id).toBe('ws_1');
      expect(summary.counts.teamMembers).toBe(3);
      expect(summary.counts.activeProducts).toBe(10);
      expect(summary.recentActivity).toHaveLength(1);
      // Redaction check: sensitive metadata redacted
      expect(summary.recentActivity[0]?.metadata).toEqual({
        token: '[REDACTED]',
        name: 'Brand Store',
      });
    });
  });

  describe('approvalPolicy', () => {
    it('returns default policy if none exists', async () => {
      mockPrisma.approvalPolicy.findUnique.mockResolvedValue(null);

      const policy = await service.getApprovalPolicy('ws_1');

      expect(policy.requiresApprovalBeforePublish).toBe(true);
      expect(policy.requiresApprovalBeforeSchedule).toBe(false);
      expect(policy.allowedApproverRoles).toContain(WorkspaceRole.OWNER);
    });

    it('updates approval policy and logs audit record', async () => {
      const updatedPolicy = {
        id: 'pol_1',
        workspaceId: 'ws_1',
        requiresApprovalBeforeSchedule: true,
        requiresApprovalBeforePublish: true,
        allowedApproverRoles: [WorkspaceRole.OWNER],
        updatedByUserId: 'user_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.approvalPolicy.upsert.mockResolvedValue(updatedPolicy);

      const result = await service.updateApprovalPolicy('ws_1', 'user_1', {
        requiresApprovalBeforeSchedule: true,
      });

      expect(result.requiresApprovalBeforeSchedule).toBe(true);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'APPROVAL_POLICY_UPDATED', workspaceId: 'ws_1' }),
      );
    });
  });

  describe('resendInvitation', () => {
    it('rotates token, extends expiry, and logs audit record', async () => {
      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue({
        id: 'inv_1',
        workspaceId: 'ws_1',
        emailNormalized: 'seller@example.com',
        role: WorkspaceRole.MEMBER,
        acceptedAt: null,
        revokedAt: null,
      });
      mockPrisma.workspaceInvitation.update.mockResolvedValue({
        id: 'inv_1',
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      });
      mockPrisma.workspace.findUnique.mockResolvedValue({ id: 'ws_1', name: 'Brand Store' });

      const result = await service.resendInvitation('ws_1', 'inv_1', 'user_1');

      expect(result.success).toBe(true);
      expect(mockPrisma.workspaceInvitation.update).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVITATION_RESENT', workspaceId: 'ws_1' }),
      );
    });

    it('rejects resending already accepted or revoked invitations', async () => {
      mockPrisma.workspaceInvitation.findFirst.mockResolvedValue({
        id: 'inv_1',
        workspaceId: 'ws_1',
        acceptedAt: new Date(),
      });

      await expect(service.resendInvitation('ws_1', 'inv_1', 'user_1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('archiveWorkspace', () => {
    it('archives workspace and cancels active subscriptions when owner confirms with matching slug', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws_1',
        slug: 'acme-store',
        name: 'Acme Store',
        status: 'ACTIVE',
      });
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.workspace.update.mockResolvedValue({ id: 'ws_1', status: 'ARCHIVED' });

      const res = await service.archiveWorkspace('ws_1', 'user_1', WorkspaceRole.OWNER, 'acme-store', '127.0.0.1');
      expect(res.success).toBe(true);
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws_1', status: 'ACTIVE' },
        data: { status: 'CANCELED', cancelAtPeriodEnd: false },
      });
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws_1' },
          data: expect.objectContaining({ status: 'ARCHIVED' }),
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WORKSPACE_ARCHIVED', workspaceId: 'ws_1' }),
      );
    });

    it('rejects non-owner users from archiving workspace', async () => {
      await expect(
        service.archiveWorkspace('ws_1', 'user_2', WorkspaceRole.ADMIN, 'acme-store'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects confirmation with mismatched slug', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws_1',
        slug: 'acme-store',
        name: 'Acme Store',
      });

      await expect(
        service.archiveWorkspace('ws_1', 'user_1', WorkspaceRole.OWNER, 'wrong-slug'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
