import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspacesService } from '../src/workspaces/workspaces.service';
import { WorkspaceRole } from '@commercepilot/database';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
      workspaceInvitation: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      ownershipTransfer: { updateMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
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
});
