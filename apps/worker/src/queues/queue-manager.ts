import { Worker, Queue, type Job } from 'bullmq';
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
import {
  processTokenRefresh,
  type TokenRefreshJobData,
} from '../processors/token-refresh.processor';
import {
  processEmailNotification,
  type EmailNotificationJobData,
} from '../processors/notification.processor';
import {
  processDueReconciliations,
  processReconciliation,
  type ReconciliationJobData,
} from '../processors/post-reconciliation.processor';
import { FallbackScheduler } from '../processors/fallback-scheduler';

export const QUEUE_NAMES = {
  CATALOG_IMPORT: 'catalog-import',
  CONTENT_GENERATION: 'content-generation',
  POST_PUBLISHING: 'post-publishing',
  POST_RECONCILIATION: 'post-reconciliation',
  ANALYTICS_SYNC: 'analytics-sync',
  TOKEN_REFRESH: 'token-refresh',
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

      // 4. Register Token Refresh Worker
      const tokenRefreshWorker = new Worker<TokenRefreshJobData>(
        QUEUE_NAMES.TOKEN_REFRESH,
        async (job: Job<TokenRefreshJobData>) => {
          console.log(
            JSON.stringify({
              level: 'info',
              message: `Processing token refresh job ${job.id}`,
              workspaceId: job.data?.workspaceId,
              daysThreshold: job.data?.daysThreshold,
              timestamp: new Date().toISOString(),
            }),
          );
          return processTokenRefresh(job.data);
        },
        {
          connection: this.redisConnection,
          concurrency: 2,
        },
      );

      // 5. Register Email Notifications Worker
      const notificationsWorker = new Worker<EmailNotificationJobData>(
        QUEUE_NAMES.NOTIFICATIONS,
        async (job: Job<EmailNotificationJobData>) => {
          console.log(
            JSON.stringify({
              level: 'info',
              message: `Processing notification job ${job.id}`,
              to: job.data.to,
              subject: job.data.subject,
              timestamp: new Date().toISOString(),
            }),
          );
          return processEmailNotification(job.data);
        },
        {
          connection: this.redisConnection,
          concurrency: 5,
        },
      );

      // 6. Register Post Reconciliation Worker (verifies ambiguous publish outcomes)
      const reconciliationWorker = new Worker<ReconciliationJobData>(
        QUEUE_NAMES.POST_RECONCILIATION,
        async (job: Job<ReconciliationJobData>) => {
          if (job.data?.postId) {
            console.log(
              JSON.stringify({
                level: 'info',
                message: `Processing post reconciliation job ${job.id}`,
                postId: job.data.postId,
                workspaceId: job.data.workspaceId,
                timestamp: new Date().toISOString(),
              }),
            );
            return processReconciliation(job.data);
          }
          console.log(
            JSON.stringify({
              level: 'info',
              message: `Running post reconciliation scan ${job.id}`,
              timestamp: new Date().toISOString(),
            }),
          );
          return processDueReconciliations();
        },
        {
          connection: this.redisConnection,
          concurrency: 2,
        },
      );

      this.workers.push(
        catalogWorker,
        publishingWorker,
        analyticsWorker,
        tokenRefreshWorker,
        notificationsWorker,
        reconciliationWorker,
      );

      // Register repeatable BullMQ token refresh cron job (every 6 hours)
      try {
        const tokenQueue = new Queue(QUEUE_NAMES.TOKEN_REFRESH, {
          connection: this.redisConnection,
        });
        await tokenQueue.add(
          'periodic-token-refresh',
          { daysThreshold: 7 },
          {
            repeat: {
              pattern: '0 */6 * * *',
            },
            jobId: 'scheduled-token-refresh-cron',
            removeOnComplete: true,
          },
        );
        await tokenQueue.close();
      } catch (cronErr) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            message: 'Failed to schedule BullMQ repeatable token refresh cron job',
            error: (cronErr as Error).message,
            timestamp: new Date().toISOString(),
          }),
        );
      }

      // Register repeatable BullMQ reconciliation scan cron job (every 2 minutes)
      try {
        const reconciliationQueue = new Queue(QUEUE_NAMES.POST_RECONCILIATION, {
          connection: this.redisConnection,
        });
        await reconciliationQueue.add(
          'scan-reconciliation',
          {},
          {
            repeat: {
              pattern: '*/2 * * * *',
            },
            jobId: 'scheduled-reconciliation-scan',
            removeOnComplete: true,
          },
        );
        await reconciliationQueue.close();
      } catch (cronErr) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            message: 'Failed to schedule BullMQ repeatable reconciliation scan cron job',
            error: (cronErr as Error).message,
            timestamp: new Date().toISOString(),
          }),
        );
      }

      console.log(
        JSON.stringify({
          level: 'info',
          message: 'QueueManager started with active BullMQ worker queues.',
          registeredQueues: Object.values(QUEUE_NAMES),
          activeWorkers: [
            QUEUE_NAMES.CATALOG_IMPORT,
            QUEUE_NAMES.POST_PUBLISHING,
            QUEUE_NAMES.ANALYTICS_SYNC,
            QUEUE_NAMES.TOKEN_REFRESH,
            QUEUE_NAMES.POST_RECONCILIATION,
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
