import { Injectable, ForbiddenException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PlanEntitlements } from './billing-plans';
import { BillingService } from './billing.service';
import { Subscription, SubscriptionStatus } from '@commercepilot/database';

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  /**
   * Retrieves active subscription and corresponding plan entitlements.
   */
  async getActivePlan(workspaceId: string): Promise<{
    subscription: Subscription;
    plan: PlanEntitlements;
  }> {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        workspaceId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!this.billingService.isPlanConfigurationAvailable()) {
      throw new ServiceUnavailableException(
        'Plan configuration is unavailable; entitlements cannot be authoritatively enforced.',
      );
    }
    const planKey = (sub?.planId || 'FREE').toUpperCase();
    const plan = this.billingService.getPlan(planKey);
    if (!plan) {
      throw new ServiceUnavailableException(`Plan configuration for ${planKey} is unavailable.`);
    }

    // If no DB subscription exists, construct virtual trial subscription
    const subscription: Subscription = sub ?? {
      id: 'sub_default_trial',
      workspaceId,
      planId: 'FREE',
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { subscription, plan };
  }

  /**
   * Enforces monthly post creation allowance.
   */
  async enforceCanCreatePost(workspaceId: string): Promise<void> {
    const { subscription, plan } = await this.getActivePlan(workspaceId);

    const postCount = await this.prisma.post.count({
      where: {
        workspaceId,
        createdAt: {
          gte: subscription.currentPeriodStart,
          lte: subscription.currentPeriodEnd,
        },
      },
    });

    if (postCount >= plan.maxMonthlyPosts) {
      this.logger.warn(
        `Workspace ${workspaceId} post quota reached: ${postCount}/${plan.maxMonthlyPosts} (Plan: ${plan.name})`,
      );
      throw new ForbiddenException(
        `Monthly post limit reached (${postCount}/${plan.maxMonthlyPosts} posts). Please upgrade to ${plan.id === 'FREE' ? 'STARTER or GROWTH' : 'a higher tier'} to create more posts.`,
      );
    }
  }

  /**
   * Enforces connected social account allowance.
   */
  async enforceCanConnectSocialAccount(workspaceId: string): Promise<void> {
    const { plan } = await this.getActivePlan(workspaceId);

    const accountsCount = await this.prisma.socialAccount.count({
      where: {
        workspaceId,
        status: 'ACTIVE',
      },
    });

    if (accountsCount >= plan.maxSocialAccounts) {
      this.logger.warn(
        `Workspace ${workspaceId} social account quota reached: ${accountsCount}/${plan.maxSocialAccounts} (Plan: ${plan.name})`,
      );
      throw new ForbiddenException(
        `Social account channel limit reached (${accountsCount}/${plan.maxSocialAccounts} connected). Please upgrade your subscription to connect additional channels.`,
      );
    }
  }

  /**
   * Enforces team member seat allowance.
   */
  async enforceCanAddTeamMember(workspaceId: string): Promise<void> {
    const { plan } = await this.getActivePlan(workspaceId);

    const membersCount = await this.prisma.membership.count({
      where: { workspaceId },
    });

    if (membersCount >= plan.maxTeamMembers) {
      this.logger.warn(
        `Workspace ${workspaceId} team member quota reached: ${membersCount}/${plan.maxTeamMembers} (Plan: ${plan.name})`,
      );
      throw new ForbiddenException(
        `Team seat limit reached (${membersCount}/${plan.maxTeamMembers} members). Please upgrade your subscription to invite additional team members.`,
      );
    }
  }
}
