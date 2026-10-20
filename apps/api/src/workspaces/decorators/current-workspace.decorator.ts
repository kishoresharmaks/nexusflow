import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import type { Workspace } from '@commercepilot/database';

export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Workspace | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.workspace;
  },
);
