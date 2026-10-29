import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { BILLING_PLANS, PlanEntitlements } from './billing-plans';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { RazorpayClient } from './razorpay.client';
import {
  Subscription,
  SubscriptionStatus,
  BillingEvent,
  BillingOrderStatus,
} from '@commercepilot/database';

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
  keyId: string;
  planId: string;
  planName: string;
  amountCents: number;
  currency: string;
  checkoutUrl: string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private customPlans: PlanEntitlements[] = Object.values(BILLING_PLANS);
  private planConfigurationAvailable = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService?: EmailService,
    private readonly razorpayClient?: RazorpayClient,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: 'billing.plans' },
      });
      if (setting && Array.isArray(setting.value) && setting.value.length > 0) {
        this.customPlans = setting.value as unknown as PlanEntitlements[];
      }
      this.planConfigurationAvailable = true;
    } catch {
      // Static plans are non-authoritative until the persisted configuration can be read.
      this.planConfigurationAvailable = false;
    }
  }

  getAvailablePlans(): PlanEntitlements[] {
    return this.customPlans;
  }

  isPlanConfigurationAvailable(): boolean {
    return this.planConfigurationAvailable;
  }

  setCustomPlans(plans: PlanEntitlements[]): void {
    this.customPlans = plans;
    this.planConfigurationAvailable = true;
  }

  getPlan(planId: string): PlanEntitlements | undefined {
    return (
      this.customPlans.find((p) => p.id.toUpperCase() === planId.toUpperCase()) ??
      BILLING_PLANS[planId.toUpperCase()]
    );
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
    const plan = this.getPlan(dto.planId);
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

      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { planTier: 'FREE' },
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
        keyId: '',
        planId: plan.id,
        planName: plan.name,
        amountCents: 0,
        currency: plan.currency,
        checkoutUrl: `/billing?status=activated&plan=${plan.id}`,
      };
    }

    // Real Razorpay order creation — no simulated checkout URLs or fabricated order IDs.
    if (!this.razorpayClient?.isConfigured()) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET server-side.',
      );
    }

    const receipt = `rcpt_${workspaceId}_${Date.now()}`;
    const razorpayOrder = await this.razorpayClient.createOrder({
      amount: plan.priceCents,
      currency: plan.currency,
      receipt,
      notes: { workspaceId, planId: plan.id },
    });

    const billingOrder = await this.prisma.billingOrder.create({
      data: {
        workspaceId,
        planId: plan.id,
        razorpayOrderId: razorpayOrder.id,
        amountCents: plan.priceCents,
        currency: plan.currency,
        status: BillingOrderStatus.PENDING,
        receipt,
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'BILLING_CHECKOUT_INITIATED',
      resourceType: 'BillingOrder',
      resourceId: billingOrder.id,
      metadata: {
        planId: plan.id,
        amountCents: plan.priceCents,
        razorpayOrderId: razorpayOrder.id,
      },
      ...(ip ? { ipAddress: ip } : {}),
    });

    return {
      sessionId: billingOrder.id,
      orderId: razorpayOrder.id,
      keyId: this.razorpayClient.getKeyId(),
      planId: plan.id,
      planName: plan.name,
      amountCents: plan.priceCents,
      currency: plan.currency,
      checkoutUrl: '', // client opens Razorpay Checkout using keyId + orderId
    };
  }

  /**
   * Webhook-gated activation. A plan is only activated after the Razorpay
   * `payment.captured` webhook has been cryptographically verified and the
   * corresponding BillingOrder has been marked PAID server-side.
   */
  async confirmActivation(
    workspaceId: string,
    orderId: string,
    userId: string,
    ip?: string,
  ): Promise<Subscription> {
    const order = await this.prisma.billingOrder.findFirst({
      where: { workspaceId, razorpayOrderId: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Billing order ${orderId} was not found for this workspace.`);
    }

    if (order.status !== BillingOrderStatus.PAID) {
      throw new ConflictException(
        'Payment has not been confirmed. Activation requires a verified Razorpay payment.captured webhook.',
      );
    }

    if (!order.providerPaymentId) {
      throw new ConflictException('Billing order is missing its provider payment reference.');
    }

    return this.applyActivation(workspaceId, order.planId, order.providerPaymentId, userId, ip);
  }

  private async applyActivation(
    workspaceId: string,
    planId: string,
    providerPaymentId: string,
    userId: string,
    ip?: string,
  ): Promise<Subscription> {
    const plan = this.getPlan(planId);
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

    // Synchronize workspace planTier and cancel superseded active subscriptions
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { planTier: plan.id },
    });

    await this.prisma.subscription.updateMany({
      where: {
        workspaceId,
        id: { not: currentSub.id },
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] },
      },
      data: { status: SubscriptionStatus.CANCELED },
    });

    await this.prisma.billingEvent.create({
      data: {
        workspaceId,
        providerPaymentId,
        amountCents: plan.priceCents,
        currency: plan.currency,
        eventType: 'SUBSCRIPTION_ACTIVATED',
        metadata: { activatedBy: userId, planId: plan.id, providerPaymentId },
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'BILLING_PLAN_ACTIVATED',
      resourceType: 'Subscription',
      resourceId: currentSub.id,
      metadata: { fromPlan: currentSub.planId, toPlan: plan.id, amountCents: plan.priceCents, providerPaymentId },
      ...(ip ? { ipAddress: ip } : {}),
    });

    if (this.emailService) {
      try {
        const [ws, user] = await Promise.all([
          this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
          this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
        ]);

        if (user?.email) {
          await this.emailService.sendSubscriptionUpdatedEmail(
            user.email,
            user.name || 'Workspace Administrator',
            ws?.name || 'Workspace',
            plan.name,
            plan.priceCents,
            plan.currency,
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to dispatch subscription updated email: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

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

    if (this.emailService) {
      try {
        const [ws, user] = await Promise.all([
          this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
          this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
        ]);

        if (user?.email) {
          await this.emailService.sendSubscriptionCancelledEmail(
            user.email,
            user.name || 'Workspace Administrator',
            ws?.name || 'Workspace',
            this.getPlan(sub.planId)?.name || sub.planId,
            sub.currentPeriodEnd,
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to dispatch subscription cancelled email: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return updated;
  }

  async getUsage(workspaceId: string): Promise<WorkspaceUsageSummary> {
    const sub = await this.getSubscription(workspaceId);
    const plan = this.getPlan(sub.planId) ?? BILLING_PLANS.FREE!;

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
