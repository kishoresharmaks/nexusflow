import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedRequest } from '../../auth/guards/auth.guard';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User is not authenticated.');
    }

    const rawWorkspaceId =
      (request.params['workspaceId'] as string) || (request.headers['x-workspace-id'] as string);

    if (!rawWorkspaceId) {
      throw new BadRequestException(
        'Workspace ID is required in route parameter or x-workspace-id header.',
      );
    }

    // Verify 24-character hex MongoDB ObjectId format
    if (!/^[a-f\d]{24}$/i.test(rawWorkspaceId)) {
      throw new BadRequestException('Invalid workspace ID format.');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: rawWorkspaceId,
          userId: user.id,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      // Cross-tenant access prevented: user cannot read or mutate workspaces they do not belong to
      throw new ForbiddenException('Access denied. You are not a member of this workspace.');
    }

    if (!membership.workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    request.membership = membership;
    request.workspace = membership.workspace;

    return true;
  }
}
