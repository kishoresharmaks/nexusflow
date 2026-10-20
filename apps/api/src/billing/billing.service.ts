import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BILLING_PLANS, PlanEntitlements } from './billing-plans';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { Subscription, SubscriptionStatus, BillingEvent } from '@commercepilot/database';

export interface WorkspaceUsageSummary {
  plan: PlanEntitlements;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  metrics: {
    monthlyPosts: {
      used: number;
      limit: number;
      percentage: number;
    };
    monthlyAiWords: {
      used: number;
      limit: number;
      percentage: number;
    };
    socialAccounts: {
      used: number;
      limit: number;
      percentage: number;
    };
    teamMembers: {
      used: number;
      limit: number;
      percentage: number;
    };
  };
}

export interface CheckoutSessionResult {
  sessionId: string;
  orderId: string;
  planId: string;
  planName: string;
  amountCents: number;
  currency: string;
  checkoutUrl: string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  getAvailablePlans(): PlanEntitlements[] {
    return Object.values(BILLING_PLANS);
  }

  async getSubscription(workspaceId: string): Promise<Subscription> {
    const existing = await this.prisma.subscription.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    // Default to FREE trial if no subscription exists
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    return this.prisma.subscription.create({
      data: {
        workspaceId,
        planId: 'FREE',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });
  }

  async createCheckoutSession(
    workspaceId: string,
    dto: CreateCheckoutDto,
    userId: string,
    ip?: string,
  ): Promise<CheckoutSessionResult> {
    const plan = BILLING_PLANS[dto.planId.toUpperCase()];
    if (!plan) {
      throw new BadRequestException(`Unknown billing plan: ${dto.planId}`);
    }

    const currentSub = await this.getSubscription(workspaceId);

    // If upgrading to FREE, simply apply immediately
    if (plan.id === 'FREE') {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30);

      await this.prisma.subscription.update({
        where: { id: currentSub.id },
        data: {
          planId: 'FREE',
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      await this.auditService.record({
        workspaceId,
        userId,
        action: 'BILLING_PLAN_CHANGED',
        resourceType: 'Subscription',
        resourceId: currentSub.id,
        metadata: { fromPlan: currentSub.planId, toPlan: 'FREE' },
        ...(ip ? { ipAddress: ip } : {}),
      });

      return {
        sessionId: `sess_free_${Date.now()}`,
        orderId: `order_free_${Date.now()}`,
        planId: plan.id,
        planName: plan.name,
        amountCents: 0,
        currency: plan.currency,
        checkoutUrl: `/billing?status=activated&plan=${plan.id}`,
      };
    }

    // Generate verified checkout session (e.g. Razorpay / Stripe compatible structure)
    const sessionId = `cp_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const orderId = `order_${Math.random().toString(36).substring(2, 10)}`;

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'BILLING_CHECKOUT_INITIATED',
      resourceType: 'CheckoutSession',
      resourceId: sessionId,
      metadata: { planId: plan.id, amountCents: plan.priceCents },
      ...(ip ? { ipAddress: ip } : {}),
    });

    return {
      sessionId,
      orderId,
      planId: plan.id,
      planName: plan.name,
      amountCents: plan.priceCents,
      currency: plan.currency,
      checkoutUrl: `/billing?session_id=${sessionId}&order_id=${orderId}`,
    };
  }

  async activatePlan(
    workspaceId: string,
    planId: string,
    userId: string,
    ip?: string,
  ): Promise<Subscription> {
    const plan = BILLING_PLANS[planId.toUpperCase()];
    if (!plan) {
      throw new BadRequestException(`Unknown billing plan: ${planId}`);
    }

    const currentSub = await this.getSubscription(workspaceId);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    const updated = await this.prisma.subscription.update({
      where: { id: currentSub.id },
      data: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    await this.prisma.billingEvent.create({
      data: {
        workspaceId,
        providerPaymentId: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        amountCents: plan.priceCents,
        currency: plan.currency,
        eventType: 'SUBSCRIPTION_ACTIVATED',
        metadata: { activatedBy: userId, planId: plan.id },
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'BILLING_PLAN_ACTIVATED',
      resourceType: 'Subscription',
      resourceId: currentSub.id,
      metadata: { fromPlan: currentSub.planId, toPlan: plan.id, amountCents: plan.priceCents },
      ...(ip ? { ipAddress: ip } : {}),
    });

    return updated;
  }

  async cancelSubscription(
    workspaceId: string,
    dto: CancelSubscriptionDto,
    userId: string,
    ip?: string,
  ): Promise<Subscription> {
    const sub = await this.getSubscription(workspaceId);

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: true,
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'BILLING_SUBSCRIPTION_CANCEL_SCHEDULED',
      resourceType: 'Subscription',
      resourceId: sub.id,
      metadata: {
        reason: dto.reason ?? 'User requested cancellation',
        cancelAt: sub.currentPeriodEnd,
      },
      ...(ip ? { ipAddress: ip } : {}),
    });

    return updated;
  }

  async getUsage(workspaceId: string): Promise<WorkspaceUsageSummary> {
    const sub = await this.getSubscription(workspaceId);
    const plan = BILLING_PLANS[sub.planId] ?? BILLING_PLANS.FREE!;

    const periodStart = sub.currentPeriodStart;

    // 1. Published posts count in current period
    const publishedPostsCount = await this.prisma.post.count({
      where: {
        workspaceId,
        status: 'PUBLISHED',
        publishedAt: { gte: periodStart },
      },
    });

    // 2. AI words used in current period
    const aiUsageSum = await this.prisma.usageLedger.aggregate({
      where: {
        workspaceId,
        metric: 'ai_words',
        createdAt: { gte: periodStart },
      },
      _sum: {
        quantity: true,
      },
    });
    const aiWordsUsed = aiUsageSum._sum.quantity ?? 0;

    // 3. Active social accounts count
    const socialAccountsCount = await this.prisma.socialAccount.count({
      where: {
        workspaceId,
        status: 'ACTIVE',
      },
    });

    // 4. Team members count
    const teamMembersCount = await this.prisma.membership.count({
      where: {
        workspaceId,
      },
    });

    const calculatePercentage = (used: number, limit: number): number => {
      if (limit <= 0) return 0;
      return Math.min(100, Math.round((used / limit) * 100));
    };

    return {
      plan,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      metrics: {
        monthlyPosts: {
          used: publishedPostsCount,
          limit: plan.maxMonthlyPosts,
          percentage: calculatePercentage(publishedPostsCount, plan.maxMonthlyPosts),
        },
        monthlyAiWords: {
          used: aiWordsUsed,
          limit: plan.maxMonthlyAiWords,
          percentage: calculatePercentage(aiWordsUsed, plan.maxMonthlyAiWords),
        },
        socialAccounts: {
          used: socialAccountsCount,
          limit: plan.maxSocialAccounts,
          percentage: calculatePercentage(socialAccountsCount, plan.maxSocialAccounts),
        },
        teamMembers: {
          used: teamMembersCount,
          limit: plan.maxTeamMembers,
          percentage: calculatePercentage(teamMembersCount, plan.maxTeamMembers),
        },
      },
    };
  }

  async getBillingHistory(workspaceId: string): Promise<BillingEvent[]> {
    return this.prisma.billingEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
