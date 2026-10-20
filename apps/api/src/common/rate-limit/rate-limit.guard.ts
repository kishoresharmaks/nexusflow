import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RateLimiterService } from './rate-limiter.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const clientIp =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      'unknown-ip';

    const prefix = options.keyPrefix || `${request.method}:${request.path}`;
    const rateLimitKey = `${prefix}:${clientIp}`;

    const result = await this.rateLimiterService.consume(
      rateLimitKey,
      options.limit,
      options.windowSeconds,
    );

    if (response && typeof response.setHeader === 'function') {
      response.setHeader('X-RateLimit-Limit', result.limit.toString());
      response.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      response.setHeader('X-RateLimit-Reset', result.resetAfterSeconds.toString());
    }

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Too many attempts. Please try again after ${result.resetAfterSeconds} seconds.`,
          retryAfter: result.resetAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
