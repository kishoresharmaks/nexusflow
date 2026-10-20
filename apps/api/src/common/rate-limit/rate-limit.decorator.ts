import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'RATE_LIMIT_METADATA';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  keyPrefix?: string;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);
