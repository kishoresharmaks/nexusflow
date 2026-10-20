import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import type { User, Session, Membership, Workspace } from '@commercepilot/database';

export interface AuthenticatedUser extends User {
  memberships: (Membership & { workspace: Workspace })[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  session: Session;
  sessionToken: string;
  membership?: Membership;
  workspace?: Workspace;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required. Missing or malformed token.');
    }

    const session = await this.authService.validateSession(token);
    if (!session) {
      throw new UnauthorizedException('Session is invalid, expired, or has been revoked.');
    }

    request.user = session.user as AuthenticatedUser;
    request.session = session;
    request.sessionToken = token;

    return true;
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    // Cookie fallback if present
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
