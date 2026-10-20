import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiterService } from '../src/common/rate-limit/rate-limiter.service';
import { RateLimitGuard } from '../src/common/rate-limit/rate-limit.guard';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

describe('RateLimiterService and RateLimitGuard', () => {
  let rateLimiter: RateLimiterService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      get: vi.fn().mockReturnValue(null),
    };
    rateLimiter = new RateLimiterService(mockConfig as ConfigService);
  });

  describe('RateLimiterService (Sliding Bucket)', () => {
    it('allows requests within the configured threshold limit', async () => {
      const res1 = await rateLimiter.consume('test_client_1', 3, 60);
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);

      const res2 = await rateLimiter.consume('test_client_1', 3, 60);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);

      const res3 = await rateLimiter.consume('test_client_1', 3, 60);
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);
    });

    it('rejects requests that exceed the limit with allowed: false', async () => {
      await rateLimiter.consume('test_client_overflow', 2, 60);
      await rateLimiter.consume('test_client_overflow', 2, 60);

      const blockedRes = await rateLimiter.consume('test_client_overflow', 2, 60);
      expect(blockedRes.allowed).toBe(false);
      expect(blockedRes.remaining).toBe(0);
      expect(blockedRes.resetAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('RateLimitGuard', () => {
    it('throws HttpException 429 when rate limit is exceeded', async () => {
      const mockReflector: any = {
        getAllAndOverride: vi.fn().mockReturnValue({
          limit: 1,
          windowSeconds: 60,
          keyPrefix: 'test_prefix',
        }),
      };

      const guard = new RateLimitGuard(mockReflector as Reflector, rateLimiter);

      const req: any = {
        headers: {},
        ip: '192.168.1.50',
        method: 'POST',
        path: '/auth/login',
      };
      const res: any = {
        setHeader: vi.fn(),
      };
      const context: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res,
        }),
      };

      // First call allowed
      await expect(guard.canActivate(context as ExecutionContext)).resolves.toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '1');

      // Second call blocked with 429
      await expect(guard.canActivate(context as ExecutionContext)).rejects.toThrow(HttpException);
      try {
        await guard.canActivate(context as ExecutionContext);
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('bypasses when no @RateLimit metadata is attached', async () => {
      const mockReflector: any = {
        getAllAndOverride: vi.fn().mockReturnValue(undefined),
      };

      const guard = new RateLimitGuard(mockReflector as Reflector, rateLimiter);
      const context: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
      };

      await expect(guard.canActivate(context as ExecutionContext)).resolves.toBe(true);
    });
  });
});
