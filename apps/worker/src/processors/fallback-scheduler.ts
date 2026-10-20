import { prisma, PostStatus } from '@commercepilot/database';
import { processPostPublishing } from './post-publishing.processor';

export class FallbackScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(private readonly intervalMs = 15000) {}

  public start(): void {
    if (this.timer) return;

    console.log(
      JSON.stringify({
        level: 'info',
        message: 'FallbackScheduler started: polling MongoDB for due scheduled posts.',
        intervalMs: this.intervalMs,
        timestamp: new Date().toISOString(),
      }),
    );

    // Initial run immediately, then recurring
    void this.pollDuePosts();
    this.timer = setInterval(() => {
      void this.pollDuePosts();
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log(
        JSON.stringify({
          level: 'info',
          message: 'FallbackScheduler stopped.',
          timestamp: new Date().toISOString(),
        }),
      );
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
}
