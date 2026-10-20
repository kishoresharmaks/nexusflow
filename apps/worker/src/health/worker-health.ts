import Redis from 'ioredis';
import { prisma } from '@commercepilot/database';

export interface ServiceProbeResult {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

export interface WorkerHealthStatus {
  status: 'ready' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    redis: ServiceProbeResult;
    database: ServiceProbeResult;
  };
}

async function probeRedis(redisUrl: string): Promise<ServiceProbeResult> {
  const redisStart = Date.now();
  let client: Redis | null = null;
  try {
    client = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 2000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    client.on('error', () => {
      // Handled silently for probe
    });
    await client.connect();
    const res = await client.ping();
    if (res === 'PONG') {
      return { status: 'up', latencyMs: Date.now() - redisStart };
    }
    return { status: 'down', message: 'Unexpected ping response' };
  } catch {
    return { status: 'down', message: 'Redis connection unavailable' };
  } finally {
    if (client) {
      try {
        client.disconnect();
      } catch {
        // Disconnect error ignored
      }
    }
  }
}

async function probeDatabase(): Promise<ServiceProbeResult> {
  const dbStart = Date.now();
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    return { status: 'up', latencyMs: Date.now() - dbStart };
  } catch {
    return { status: 'down', message: 'Database connection unavailable' };
  }
}

export async function checkWorkerHealth(redisUrl: string): Promise<WorkerHealthStatus> {
  const [redisStatus, dbStatus] = await Promise.all([probeRedis(redisUrl), probeDatabase()]);

  const isHealthy = redisStatus.status === 'up' && dbStatus.status === 'up';

  return {
    status: isHealthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    checks: {
      redis: redisStatus,
      database: dbStatus,
    },
  };
}
