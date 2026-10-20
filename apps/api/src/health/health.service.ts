import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';

export interface ServiceCheckResult {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

export interface ReadinessResult {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: {
    database: ServiceCheckResult;
    redis: ServiceCheckResult;
  };
}

export interface LivenessResult {
  status: 'ok';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getLiveness(): LivenessResult {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime() * 100) / 100,
      version: '0.1.0',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
    };
  }

  async checkReadiness(): Promise<ReadinessResult> {
    const [databaseCheck, redisCheck] = await Promise.all([
      this.prismaService.checkReadiness(),
      this.checkRedisReadiness(),
    ]);

    const redisRequired = this.configService.get<string>('REDIS_REQUIRED', 'false') === 'true';
    const isReady = databaseCheck.status === 'up' && (!redisRequired || redisCheck.status === 'up');

    return {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: databaseCheck,
        redis: redisCheck,
      },
    };
  }

  private async checkRedisReadiness(): Promise<ServiceCheckResult> {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl || redisUrl === 'none' || redisUrl === 'disabled') {
      return {
        status: 'down',
        message: 'Redis not configured (operating in standalone database mode)',
      };
    }

    const startTime = Date.now();
    let client: Redis | null = null;

    try {
      client = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: 2000,
        commandTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Do not auto-retry during health check
      });

      // Avoid unhandled error logs in console during failed health probe
      client.on('error', () => {
        // silently handled for probe
      });

      await client.connect();
      const pingResponse = await client.ping();

      if (pingResponse === 'PONG') {
        const latencyMs = Date.now() - startTime;
        return { status: 'up', latencyMs };
      }

      return { status: 'down', message: 'Redis ping unexpected response' };
    } catch {
      // Redacted and safe: never expose hostnames, ports, passwords or raw errors
      return { status: 'down', message: 'Redis connection unreachable or ping failed' };
    } finally {
      if (client) {
        try {
          client.disconnect();
        } catch {
          // Ignore disconnect error
        }
      }
    }
  }
}
