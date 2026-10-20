import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, type Job } from 'bullmq';
import Redis from 'ioredis';

export interface PostPublishJobData {
  postId: string;
  workspaceId: string;
}

@Injectable()
export class PublishingQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublishingQueueService.name);
  private queue: Queue<PostPublishJobData> | null = null;
  private redisConnection: Redis | null = null;
  private isAvailable = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl =
      this.configService.get<string>('redisUrl') ||
      process.env['REDIS_URL'] ||
      'redis://localhost:6379';

    try {
      const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        connectTimeout: 2000,
        lazyConnect: true,
        retryStrategy: () => null,
      });

      redis.on('error', (err) => {
        this.logger.debug(`PublishingQueueService Redis notice: ${err.message}`);
      });

      await redis.connect();
      this.redisConnection = redis;

      this.queue = new Queue<PostPublishJobData>('post-publishing', {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 30_000, // 30s initial backoff
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });

      this.isAvailable = true;
      this.logger.log('PublishingQueueService connected to BullMQ queue "post-publishing".');
    } catch {
      this.logger.warn(
        'PublishingQueueService operating in database-only fallback mode (Redis not reachable). FallbackScheduler will process scheduled posts.',
      );
      this.isAvailable = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
    if (this.redisConnection) {
      this.redisConnection.disconnect();
      this.redisConnection = null;
    }
    this.isAvailable = false;
  }

  get isQueueAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Enqueue post for scheduled execution with delay in milliseconds.
   */
  async enqueueScheduledPost(
    workspaceId: string,
    postId: string,
    scheduledAt: Date,
  ): Promise<{ enqueued: boolean; jobId?: string }> {
    if (!this.queue || !this.isAvailable) {
      this.logger.debug(
        `Queue offline: post ${postId} persisted in MongoDB; will be handled by worker fallback scheduler.`,
      );
      return { enqueued: false };
    }

    const delay = Math.max(0, scheduledAt.getTime() - Date.now());
    const jobId = `post_${postId}`;

    try {
      // Remove any existing job for this post (e.g. rescheduling)
      const existingJob = await this.queue.getJob(jobId);
      if (existingJob) {
        await existingJob.remove();
      }

      const job: Job<PostPublishJobData> = await this.queue.add(
        'publish-scheduled-post',
        { postId, workspaceId },
        {
          jobId,
          delay,
        },
      );

      this.logger.log(`Enqueued BullMQ job ${job.id} for post ${postId} with delay ${delay}ms`);
      return { enqueued: true, ...(job.id ? { jobId: job.id } : {}) };
    } catch (err) {
      this.logger.warn(`Failed to enqueue BullMQ job for post ${postId}: ${(err as Error).message}`);
      return { enqueued: false };
    }
  }

  /**
   * Invalidate and remove pending queue job on cancellation or un-scheduling.
   */
  async cancelPostJob(postId: string): Promise<boolean> {
    if (!this.queue || !this.isAvailable) {
      return false;
    }

    try {
      const jobId = `post_${postId}`;
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Removed cancelled BullMQ job for post ${postId}`);
        return true;
      }
      return false;
    } catch (err) {
      this.logger.warn(`Failed to remove job for post ${postId}: ${(err as Error).message}`);
      return false;
    }
  }
}
