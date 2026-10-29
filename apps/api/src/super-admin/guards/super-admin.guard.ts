import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../database/prisma.service';
import {
  PlatformAdmin,
  PlatformAdminStatus,
  User,
  Session,
} from '@commercepilot/database';
import {
  AdminPermission,
  ADMIN_PERMISSIONS_METADATA_KEY,
  ROLE_PERMISSIONS,
} from '../super-admin.constants';

export interface AuthenticatedAdminRequest extends Request {
  user: User;
  session: Session;
  sessionToken: string;
  platformAdmin: PlatformAdmin & { user: User };
  adminPermissions: AdminPermission[];
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedAdminRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required. Missing or malformed token.');
    }

    const session = await this.authService.validateSession(token);
    if (!session || !session.user) {
      throw new UnauthorizedException('Session is invalid, expired, or has been revoked.');
    }

    const user = session.user as User;

    // Check if account is suspended
    if ((user as any).isSuspended) {
      throw new ForbiddenException('Account has been suspended by an administrator.');
    }

    // Query PlatformAdmin identity
    const platformAdmin = await this.prisma.platformAdmin.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });

    if (!platformAdmin) {
      throw new ForbiddenException('Platform administrator access required. Account is not a platform admin.');
    }

    if (platformAdmin.status !== PlatformAdminStatus.ACTIVE) {
      throw new ForbiddenException(`Platform administrator access has been ${platformAdmin.status.toLowerCase()}.`);
    }

    // Calculate effective permissions (role default + custom array overrides)
    const roleDefaults = ROLE_PERMISSIONS[platformAdmin.role] || [];
    const customPermissions = (platformAdmin.permissions || []) as AdminPermission[];
    const effectivePermissions = Array.from(
      new Set<AdminPermission>([...roleDefaults, ...customPermissions]),
    );

    // Check required permissions from route metadata
    const requiredPermissions = this.reflector.getAllAndOverride<AdminPermission[]>(
      ADMIN_PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAll = requiredPermissions.every((perm) => effectivePermissions.includes(perm));
      if (!hasAll) {
        const missing = requiredPermissions.filter((perm) => !effectivePermissions.includes(perm));
        throw new ForbiddenException(
          `Forbidden: Missing required platform admin permission(s): [${missing.join(', ')}]`,
        );
      }
    }

    request.user = user;
    request.session = session;
    request.sessionToken = token;
    request.platformAdmin = platformAdmin as PlatformAdmin & { user: User };
    request.adminPermissions = effectivePermissions;

    return true;
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    const cookieHeader = request.headers['cookie'];
    if (cookieHeader) {
      const match = cookieHeader.match(/sessionToken=([^;]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }

    return null;
  }
}
