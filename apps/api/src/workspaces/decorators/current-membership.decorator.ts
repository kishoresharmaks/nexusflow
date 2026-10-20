import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import type { Membership } from '@commercepilot/database';

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Membership | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.membership;
  },
);
