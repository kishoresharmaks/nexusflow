import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRole } from '@commercepilot/database';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from '../../auth/guards/auth.guard';

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  [WorkspaceRole.OWNER]: 4,
  [WorkspaceRole.ADMIN]: 3,
  [WorkspaceRole.MEMBER]: 2,
  [WorkspaceRole.VIEWER]: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const membership = request.membership;

    if (!membership) {
      throw new ForbiddenException('Workspace membership context is required.');
    }

    const userLevel = ROLE_HIERARCHY[membership.role] ?? 0;
    const hasSufficientRole = requiredRoles.some((required) => {
      const requiredLevel = ROLE_HIERARCHY[required] ?? 99;
      return userLevel >= requiredLevel;
    });

    if (!hasSufficientRole) {
      throw new ForbiddenException(
        `Insufficient permissions. Required one of: [${requiredRoles.join(', ')}], current role is: ${membership.role}`,
      );
    }

    return true;
  }
}
