import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface QuotaStatus {
  usedTokens: number;
  limitTokens: number;
  remainingTokens: number;
  percentUsed: number;
  periodStart: string;
  periodEnd: string;
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);
  private readonly DEFAULT_MONTHLY_TOKEN_QUOTA = 100_000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns current billing period date range.
   */
  private getCurrentPeriod(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  /**
   * Retrieves current monthly AI usage and remaining quota for workspace.
   */
  async getQuotaStatus(workspaceId: string): Promise<QuotaStatus> {
    const { start, end } = this.getCurrentPeriod();

    const usages = await this.prisma.aiUsage.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        promptTokens: true,
        completionTokens: true,
      },
    });

    const usedTokens = usages.reduce(
      (sum, u) => sum + (u.promptTokens || 0) + (u.completionTokens || 0),
      0,
    );

    const limitTokens = this.DEFAULT_MONTHLY_TOKEN_QUOTA;
    const remainingTokens = Math.max(0, limitTokens - usedTokens);
    const percentUsed = Math.min(100, Math.round((usedTokens / limitTokens) * 100));

    return {
      usedTokens,
      limitTokens,
      remainingTokens,
      percentUsed,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };
  }

  /**
   * Verifies that the workspace has sufficient remaining token quota.
   */
  async assertQuotaAvailable(workspaceId: string, estimatedTokens = 500): Promise<void> {
    const quota = await this.getQuotaStatus(workspaceId);

    if (quota.remainingTokens < estimatedTokens) {
      this.logger.warn(
        `Workspace ${workspaceId} exceeded AI token quota: used ${quota.usedTokens}/${quota.limitTokens}`,
      );
      throw new ForbiddenException(
        `AI token quota exceeded for this billing cycle (${quota.usedTokens}/${quota.limitTokens} tokens used). Please upgrade your subscription plan.`,
      );
    }
  }

  /**
   * Records usage into both AiUsage and auditable UsageLedger.
   */
  async recordUsage(
    workspaceId: string,
    params: {
      provider: string;
      model: string;
      promptTokens: number;
      completionTokens: number;
      costEstimateMicrocents: number;
      feature: string;
    },
  ): Promise<void> {
    const totalTokens = params.promptTokens + params.completionTokens;

    await this.prisma.aiUsage.create({
      data: {
        workspaceId,
        provider: params.provider,
        model: params.model,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        costEstimateMicrocents: params.costEstimateMicrocents,
        feature: params.feature,
      },
    });

    const quota = await this.getQuotaStatus(workspaceId);

    await this.prisma.usageLedger.create({
      data: {
        workspaceId,
        metric: 'AI_TOKENS',
        quantity: totalTokens,
        balanceAfter: quota.remainingTokens,
        description: `Generated AI content via ${params.provider} (${params.model})`,
      },
    });
  }
}
