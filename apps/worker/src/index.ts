import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    if (process.env['DATABASE_URL'] || process.env['REDIS_URL']) break;
  }
}

import { QueueManager } from './queues/queue-manager';
import { checkWorkerHealth } from './health/worker-health';

async function bootstrap(): Promise<void> {
  const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';

  console.log(
    JSON.stringify({
      level: 'info',
      message: 'CommercePilot Background Worker starting...',
      environment: process.env['NODE_ENV'] || 'development',
      timestamp: new Date().toISOString(),
    }),
  );

  const health = await checkWorkerHealth(redisUrl);
  console.log(
    JSON.stringify({
      level: 'info',
      message: 'Worker startup connectivity health check completed.',
      healthStatus: health.status,
      checks: health.checks,
      timestamp: new Date().toISOString(),
    }),
  );

  const queueManager = new QueueManager(redisUrl);
  await queueManager.start();

  const shutdown = async (signal: string): Promise<void> => {
    console.log(
      JSON.stringify({
        level: 'info',
        message: `Worker received ${signal}, shutting down gracefully...`,
        timestamp: new Date().toISOString(),
      }),
    );
    await queueManager.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Keep process alive in background
  setInterval(() => {
    // Worker heartbeat / liveness log
  }, 60000);
}

bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Unknown worker startup error';
  console.error(
    JSON.stringify({
      level: 'error',
      message: 'Fatal error during worker bootstrap',
      error: message,
      timestamp: new Date().toISOString(),
    }),
  );
  process.exit(1);
});
