import { prisma, PostStatus } from '@commercepilot/database';
import { processPostPublishing } from './post-publishing.processor';
import { processTokenRefresh } from './token-refresh.processor';
import { processDueReconciliations } from './post-reconciliation.processor';

export class FallbackScheduler {
  private timer: NodeJS.Timeout | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isTokenProcessing = false;
  private isReconciling = false;

  constructor(
    private readonly intervalMs = 15000,
    private readonly tokenRefreshIntervalMs = 3600000, // 1 hour
  ) {}

  public start(): void {
    if (this.timer) return;

    console.log(
      JSON.stringify({
        level: 'info',
        message: 'FallbackScheduler started: polling MongoDB for due scheduled posts, expiring tokens, and reconciliation windows.',
        intervalMs: this.intervalMs,
        tokenRefreshIntervalMs: this.tokenRefreshIntervalMs,
        timestamp: new Date().toISOString(),
      }),
    );

    // Initial runs
    void this.pollDuePosts();
    void this.pollExpiringTokens();
    void this.pollDueReconciliations();

    this.timer = setInterval(() => {
      void this.pollDuePosts();
      void this.pollDueReconciliations();
    }, this.intervalMs);

    this.tokenRefreshTimer = setInterval(() => {
      void this.pollExpiringTokens();
    }, this.tokenRefreshIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'FallbackScheduler stopped.',
        timestamp: new Date().toISOString(),
      }),
    );
  }

  public async pollExpiringTokens(daysThreshold = 7): Promise<number> {
    if (this.isTokenProcessing) return 0;
    this.isTokenProcessing = true;

    try {
      const result = await processTokenRefresh({ daysThreshold });
      if (result.scanned > 0) {
        console.log(
          JSON.stringify({
            level: 'info',
            message: 'FallbackScheduler completed scheduled token refresh check.',
            scanned: result.scanned,
            refreshed: result.refreshed,
            failed: result.failed,
            expired: result.expired,
            timestamp: new Date().toISOString(),
          }),
        );
      }
      return result.refreshed;
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Error during fallback token refresh check',
          error: (err as Error).message,
          timestamp: new Date().toISOString(),
        }),
      );
      return 0;
    } finally {
      this.isTokenProcessing = false;
    }
  }

  public async pollDuePosts(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    let processedCount = 0;
    try {
      const now = new Date();
      // Find due posts in SCHEDULED status
      const duePosts = await prisma.post.findMany({
        where: {
          status: PostStatus.SCHEDULED,
          scheduledAt: { lte: now },
        },
        take: 10,
        orderBy: { scheduledAt: 'asc' },
      });

      for (const post of duePosts) {
        try {
          console.log(
            JSON.stringify({
              level: 'info',
              message: `FallbackScheduler processing due post ${post.id}`,
              scheduledAt: post.scheduledAt?.toISOString(),
              timestamp: new Date().toISOString(),
            }),
          );

          await processPostPublishing({
            postId: post.id,
            workspaceId: post.workspaceId,
          });
          processedCount++;
        } catch (err) {
          console.error(
            JSON.stringify({
              level: 'error',
              message: `Failed to process scheduled post ${post.id}`,
              error: (err as Error).message,
              timestamp: new Date().toISOString(),
            }),
          );
        }
      }
    } catch {
      // Ignore database connection interruptions gracefully
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }

  public async pollDueReconciliations(): Promise<number> {
    if (this.isReconciling) return 0;
    this.isReconciling = true;

    try {
      const result = await processDueReconciliations();
      if (result.scanned > 0) {
        console.log(
          JSON.stringify({
            level: 'info',
            message: 'FallbackScheduler completed reconciliation scan.',
            scanned: result.scanned,
            resolved: result.resolved,
            pending: result.pending,
            failed: result.failed,
            timestamp: new Date().toISOString(),
          }),
        );
      }
      return result.resolved;
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'Error during fallback reconciliation scan',
          error: (err as Error).message,
          timestamp: new Date().toISOString(),
        }),
      );
      return 0;
    } finally {
      this.isReconciling = false;
    }
  }
}
