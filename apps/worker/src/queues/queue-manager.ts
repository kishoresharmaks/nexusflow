import { Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import {
  processCatalogImport,
  type CatalogImportJobData,
} from '../processors/catalog-import.processor';
import {
  processPostPublishing,
  type PostPublishingJobData,
} from '../processors/post-publishing.processor';
import {
  processAnalyticsSync,
  type AnalyticsSyncJobData,
} from '../processors/analytics-sync.processor';
import { FallbackScheduler } from '../processors/fallback-scheduler';

export const QUEUE_NAMES = {
  CATALOG_IMPORT: 'catalog-import',
  CONTENT_GENERATION: 'content-generation',
  POST_PUBLISHING: 'post-publishing',
  POST_RECONCILIATION: 'post-reconciliation',
  ANALYTICS_SYNC: 'analytics-sync',
  REPORTS: 'reports',
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export class QueueManager {
  private isRunning = false;
  private workers: Worker[] = [];
  private redisConnection: Redis | null = null;
  private fallbackScheduler: FallbackScheduler | null = null;

  constructor(private readonly redisUrl: string) {}

  public getRedisUrl(): string {
    return this.redisUrl;
  }

  public async start(): Promise<void> {
    this.isRunning = true;

    // Start fallback scheduler for direct MongoDB scheduled post processing
    this.fallbackScheduler = new FallbackScheduler();
    this.fallbackScheduler.start();

    try {
      const redis = new Redis(this.redisUrl, {
        maxRetriesPerRequest: null,
        connectTimeout: 2000,
        lazyConnect: true,
        retryStrategy: () => null,
      });

      redis.on('error', (err) => {
        // Handled silently to avoid uncaught exceptions when Redis is offline
        console.warn(
          JSON.stringify({
            level: 'warn',
            message: 'QueueManager Redis connection warning',
            error: err.message,
            timestamp: new Date().toISOString(),
          }),
        );
      });

      await redis.connect();
      this.redisConnection = redis;

      // 1. Register Catalog Import Worker
      const catalogWorker = new Worker<CatalogImportJobData>(
        QUEUE_NAMES.CATALOG_IMPORT,
        async (job: Job<CatalogImportJobData>) => {
          console.log(
            JSON.stringify({
              level: 'info',
              message: `Processing catalog import job ${job.id}`,
              importId: job.data.importId,
              workspaceId: job.data.workspaceId,
              timestamp: new Date().toISOString(),
            }),
          );
          return processCatalogImport(job.data);
        },
        {
          connection: this.redisConnection,
          concurrency: 2,
        },
      );

      // 2. Register Post Publishing Worker
      const publishingWorker = new Worker<PostPublishingJobData>(
        QUEUE_NAMES.POST_PUBLISHING,
        async (job: Job<PostPublishingJobData>) => {
          console.log(
            JSON.stringify({
              level: 'info',
              message: `Processing post publishing job ${job.id}`,
              postId: job.data.postId,
              workspaceId: job.data.workspaceId,
              timestamp: new Date().toISOString(),
            }),
          );
          return processPostPublishing(job.data);
        },
        {
          connection: this.redisConnection,
          concurrency: 5,
        },
      );

      // 3. Register Analytics Sync Worker
      const analyticsWorker = new Worker<AnalyticsSyncJobData>(
        QUEUE_NAMES.ANALYTICS_SYNC,
        async (job: Job<AnalyticsSyncJobData>) => {
          console.log(
            JSON.stringify({
              level: 'info',
              message: `Processing analytics sync job ${job.id}`,
              workspaceId: job.data.workspaceId,
              timestamp: new Date().toISOString(),
            }),
          );
          return processAnalyticsSync(job.data);
        },
        {
          connection: this.redisConnection,
          concurrency: 1,
        },
      );

      this.workers.push(catalogWorker, publishingWorker, analyticsWorker);

      console.log(
        JSON.stringify({
          level: 'info',
          message: 'QueueManager started with active BullMQ worker queues.',
          registeredQueues: Object.values(QUEUE_NAMES),
          activeWorkers: [
            QUEUE_NAMES.CATALOG_IMPORT,
            QUEUE_NAMES.POST_PUBLISHING,
            QUEUE_NAMES.ANALYTICS_SYNC,
          ],
          timestamp: new Date().toISOString(),
        }),
      );
    } catch {
      console.log(
        JSON.stringify({
          level: 'info',
          message:
            'QueueManager operating in standby/direct mode (Redis not reachable or in mock environment). FallbackScheduler active.',
          registeredQueues: Object.values(QUEUE_NAMES),
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  public async stop(): Promise<void> {
    this.isRunning = false;

    if (this.fallbackScheduler) {
      this.fallbackScheduler.stop();
      this.fallbackScheduler = null;
    }

    for (const worker of this.workers) {
      try {
        await worker.close();
      } catch {
        // Ignore worker close errors during shutdown
      }
    }
    this.workers = [];

    if (this.redisConnection) {
      try {
        this.redisConnection.disconnect();
      } catch {
        // Ignore disconnect error
      }
      this.redisConnection = null;
    }

    console.log(
      JSON.stringify({
        level: 'info',
        message: 'QueueManager stopped gracefully.',
        timestamp: new Date().toISOString(),
      }),
    );
  }

  public getStatus(): {
    isRunning: boolean;
    queues: readonly string[];
    activeWorkersCount: number;
    fallbackSchedulerActive: boolean;
  } {
    return {
      isRunning: this.isRunning,
      queues: Object.values(QUEUE_NAMES),
      activeWorkersCount: this.workers.length,
      fallbackSchedulerActive: this.fallbackScheduler !== null,
    };
  }
}
