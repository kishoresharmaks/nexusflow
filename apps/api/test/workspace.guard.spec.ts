import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceGuard } from '../src/workspaces/guards/workspace.guard';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../src/database/prisma.service';
import type { ExecutionContext } from '@nestjs/common';
import { WorkspaceRole } from '@commercepilot/database';

describe('WorkspaceGuard (Cross-Tenant Isolation Gate)', () => {
  let guard: WorkspaceGuard;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      membership: {
        findUnique: vi.fn(),
      },
    };
    guard = new WorkspaceGuard(mockPrisma as PrismaService);
  });

  const createMockContext = (
    user: any,
    params: Record<string, string>,
    headers: Record<string, string> = {},
  ): { context: ExecutionContext; req: any } => {
    const req: any = {
      user,
      params,
      headers,
    };
    const context: any = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    };
    return { context, req };
  };

  it('allows access when user is a valid member of the requested workspace', async () => {
    const validObjectId = '507f1f77bcf86cd799439011';
    const { context, req } = createMockContext({ id: 'user_1' }, { workspaceId: validObjectId });

    mockPrisma.membership.findUnique.mockResolvedValue({
      id: 'mem_1',
      userId: 'user_1',
      workspaceId: validObjectId,
      role: WorkspaceRole.MEMBER,
      workspace: { id: validObjectId, name: 'Target Workspace' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(req.workspace.id).toBe(validObjectId);
    expect(req.membership.role).toBe(WorkspaceRole.MEMBER);
  });

  it('PREVENTS CROSS-TENANT ACCESS: throws ForbiddenException when user is NOT a member of requested workspace', async () => {
    const foreignWorkspaceId = '507f1f77bcf86cd799439022';
    const { context } = createMockContext(
      { id: 'attacker_user_id' },
      { workspaceId: foreignWorkspaceId },
    );

    // Membership query returns null because user does not belong to this tenant
    mockPrisma.membership.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('PREVENTS GUESSED ID ATTACKS: rejects malformed workspace IDs with BadRequestException', async () => {
    const { context } = createMockContext({ id: 'user_1' }, { workspaceId: 'non-hex-id-attempt' });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException if workspace record is absent', async () => {
    const validObjectId = '507f1f77bcf86cd799439033';
    const { context } = createMockContext({ id: 'user_1' }, { workspaceId: validObjectId });

    mockPrisma.membership.findUnique.mockResolvedValue({
      id: 'mem_orphan',
      userId: 'user_1',
      workspaceId: validObjectId,
      workspace: null,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });
});
