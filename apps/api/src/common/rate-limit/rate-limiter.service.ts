import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAfterSeconds: number;
}

interface InMemoryBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimiterService.name);
  private redisClient: Redis | null = null;
  private inMemoryFallback = new Map<string, InMemoryBucket>();

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ||
      process.env['REDIS_URL'] ||
      'redis://localhost:6379';

    const isTest = process.env['NODE_ENV'] === 'test';

    if (redisUrl && redisUrl !== 'none' && redisUrl !== 'disabled' && !isTest) {
      try {
        this.redisClient = new Redis(redisUrl, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        });

        this.redisClient.connect().catch((err) => {
          this.logger.warn(
            `Redis connection failed for RateLimiter. Falling back to memory: ${err.message}`,
          );
          this.redisClient = null;
        });
      } catch {
        this.redisClient = null;
      }
    }
  }

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const fullKey = `ratelimit:${key}`;
        const count = await this.redisClient.incr(fullKey);

        if (count === 1) {
          await this.redisClient.expire(fullKey, windowSeconds);
        }

        let ttl = await this.redisClient.ttl(fullKey);
        if (ttl < 0) ttl = windowSeconds;

        const allowed = count <= limit;
        const remaining = Math.max(0, limit - count);

        return {
          allowed,
          remaining,
          limit,
          resetAfterSeconds: ttl,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown Redis error';
        this.logger.warn(`Redis rate limit error, using memory fallback: ${message}`);
      }
    }

    // High performance in-memory sliding bucket fallback
    const now = Date.now();
    const bucket = this.inMemoryFallback.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.inMemoryFallback.set(key, {
        count: 1,
        resetAt: now + windowSeconds * 1000,
      });

      return {
        allowed: true,
        remaining: limit - 1,
        limit,
        resetAfterSeconds: windowSeconds,
      };
    }

    bucket.count += 1;
    const allowed = bucket.count <= limit;
    const remaining = Math.max(0, limit - bucket.count);
    const resetAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    return {
      allowed,
      remaining,
      limit,
      resetAfterSeconds,
    };
  }

  onModuleDestroy(): void {
    if (this.redisClient) {
      try {
        this.redisClient.disconnect();
      } catch {
        // Safe cleanup
      }
    }
    this.inMemoryFallback.clear();
  }
}
