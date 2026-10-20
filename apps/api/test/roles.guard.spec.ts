import { describe, it, expect, vi } from 'vitest';
import { RolesGuard } from '../src/workspaces/guards/roles.guard';
import { WorkspaceRole } from '@commercepilot/database';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

describe('RolesGuard', () => {
  const createMockContext = (
    requiredRoles: WorkspaceRole[] | undefined,
    userRole: WorkspaceRole,
  ): { context: ExecutionContext; reflector: Reflector } => {
    const reflector: any = {
      getAllAndOverride: vi.fn().mockReturnValue(requiredRoles),
    };
    const req: any = {
      membership: { role: userRole },
    };
    const context: any = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    };
    return { context, reflector };
  };

  it('allows access when no roles are required on route', () => {
    const { context, reflector } = createMockContext(undefined, WorkspaceRole.VIEWER);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows OWNER to access ADMIN level operation', () => {
    const { context, reflector } = createMockContext([WorkspaceRole.ADMIN], WorkspaceRole.OWNER);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows ADMIN to access ADMIN level operation', () => {
    const { context, reflector } = createMockContext([WorkspaceRole.ADMIN], WorkspaceRole.ADMIN);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects MEMBER from accessing ADMIN operation with ForbiddenException', () => {
    const { context, reflector } = createMockContext([WorkspaceRole.ADMIN], WorkspaceRole.MEMBER);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects VIEWER from accessing MEMBER operation with ForbiddenException', () => {
    const { context, reflector } = createMockContext([WorkspaceRole.MEMBER], WorkspaceRole.VIEWER);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
