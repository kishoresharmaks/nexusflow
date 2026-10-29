import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from '../src/billing/billing.service';
import { SubscriptionStatus, BillingOrderStatus } from '@commercepilot/database';
import type { PrismaService } from '../src/database/prisma.service';
import type { AuditService } from '../src/audit/audit.service';
import type { RazorpayClient } from '../src/billing/razorpay.client';

describe('BillingService', () => {
  let service: BillingService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAudit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRazorpay: any;

  const validWorkspaceId = '507f1f77bcf86cd799439011';
  const validUserId = '507f1f77bcf86cd799439099';

  beforeEach(() => {
    mockPrisma = {
      subscription: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      workspace: {
        update: vi.fn().mockResolvedValue({ id: validWorkspaceId, planTier: 'FREE' }),
      },
      billingEvent: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      billingOrder: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
      post: {
        count: vi.fn(),
      },
      usageLedger: {
        aggregate: vi.fn(),
      },
      socialAccount: {
        count: vi.fn(),
      },
      membership: {
        count: vi.fn(),
      },
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockRazorpay = {
      isConfigured: vi.fn().mockReturnValue(true),
      getKeyId: vi.fn().mockReturnValue('rzp_test_key_123'),
      createOrder: vi.fn().mockResolvedValue({
        id: 'order_real_123',
        entity: 'order',
        amount: 2900,
        amount_paid: 0,
        currency: 'USD',
        receipt: 'rcpt_test',
        status: 'created',
      }),
    };

    service = new BillingService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
      undefined,
      mockRazorpay as unknown as RazorpayClient,
    );
  });

  describe('getAvailablePlans', () => {
    it('returns all supported billing tiers', () => {
      const plans = service.getAvailablePlans();
      expect(plans.length).toBeGreaterThanOrEqual(4);
      expect(plans.map((p) => p.id)).toContain('FREE');
      expect(plans.map((p) => p.id)).toContain('STARTER');
      expect(plans.map((p) => p.id)).toContain('GROWTH');
      expect(plans.map((p) => p.id)).toContain('PRO');
    });
  });

  describe('getSubscription', () => {
    it('returns existing subscription if present', async () => {
      const mockSub = {
        id: 'sub-123',
        workspaceId: validWorkspaceId,
        planId: 'GROWTH',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        cancelAtPeriodEnd: false,
      };
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSub);

      const result = await service.getSubscription(validWorkspaceId);
      expect(result).toEqual(mockSub);
      expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    });

    it('creates default FREE trial subscription if none exists', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.create.mockImplementation((args: { data: unknown }) =>
        Promise.resolve({ id: 'sub-new', ...args.data }),
      );

      const result = await service.getSubscription(validWorkspaceId);
      expect(result.planId).toBe('FREE');
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(mockPrisma.subscription.create).toHaveBeenCalledOnce();
    });
  });

  describe('createCheckoutSession', () => {
    it('throws BadRequestException for unknown plan', async () => {
      await expect(
        service.createCheckoutSession(validWorkspaceId, { planId: 'NONEXISTENT' }, validUserId),
      ).rejects.toThrow('Unknown billing plan: NONEXISTENT');
    });

    it('creates paid checkout session with a real Razorpay order id and emits audit log', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        workspaceId: validWorkspaceId,
        planId: 'FREE',
        status: SubscriptionStatus.ACTIVE,
      });
      mockPrisma.billingOrder.create.mockResolvedValue({
        id: 'billing-order-1',
        razorpayOrderId: 'order_real_123',
      });

      const session = await service.createCheckoutSession(
        validWorkspaceId,
        { planId: 'STARTER' },
        validUserId,
        '127.0.0.1',
      );

      expect(session.planId).toBe('STARTER');
      expect(session.amountCents).toBe(2900);
      expect(session.sessionId).toBe('billing-order-1');
      expect(session.orderId).toBe('order_real_123');
      expect(session.keyId).toBe('rzp_test_key_123');
      expect(mockRazorpay.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2900,
          currency: 'USD',
          notes: expect.objectContaining({ workspaceId: validWorkspaceId, planId: 'STARTER' }),
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: validWorkspaceId,
          userId: validUserId,
          action: 'BILLING_CHECKOUT_INITIATED',
        }),
      );
    });

    it('fails with ServiceUnavailableException when Razorpay is not configured', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        workspaceId: validWorkspaceId,
        planId: 'FREE',
        status: SubscriptionStatus.ACTIVE,
      });
      mockRazorpay.isConfigured.mockReturnValue(false);

      await expect(
        service.createCheckoutSession(validWorkspaceId, { planId: 'STARTER' }, validUserId),
      ).rejects.toThrow('Razorpay is not configured');
      expect(mockRazorpay.createOrder).not.toHaveBeenCalled();
    });

    it('switches to FREE plan directly without payment gateway', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        workspaceId: validWorkspaceId,
        planId: 'GROWTH',
        status: SubscriptionStatus.ACTIVE,
      });
      mockPrisma.subscription.update.mockResolvedValue({
        id: 'sub-1',
        planId: 'FREE',
      });

      const session = await service.createCheckoutSession(
        validWorkspaceId,
        { planId: 'FREE' },
        validUserId,
      );

      expect(session.planId).toBe('FREE');
      expect(session.amountCents).toBe(0);
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({ planId: 'FREE' }),
        }),
      );
    });
  });

  describe('confirmActivation', () => {
    it('rejects activation when the billing order is not PAID', async () => {
      mockPrisma.billingOrder.findFirst.mockResolvedValue({
        id: 'bo-1',
        workspaceId: validWorkspaceId,
        planId: 'GROWTH',
        razorpayOrderId: 'order_real_123',
        status: BillingOrderStatus.PENDING,
        providerPaymentId: null,
      });

      await expect(
        service.confirmActivation(validWorkspaceId, 'order_real_123', validUserId),
      ).rejects.toThrow('Payment has not been confirmed');
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('activates the plan when the billing order is PAID (webhook confirmed)', async () => {
      mockPrisma.billingOrder.findFirst.mockResolvedValue({
        id: 'bo-1',
        workspaceId: validWorkspaceId,
        planId: 'GROWTH',
        razorpayOrderId: 'order_real_123',
        status: BillingOrderStatus.PAID,
        providerPaymentId: 'pay_real_123',
      });
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        workspaceId: validWorkspaceId,
        planId: 'FREE',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        cancelAtPeriodEnd: false,
      });
      mockPrisma.subscription.update.mockImplementation((args: { data: unknown }) =>
        Promise.resolve({ id: 'sub-1', ...args.data }),
      );

      const result = await service.confirmActivation(
        validWorkspaceId,
        'order_real_123',
        validUserId,
      );

      expect(result.planId).toBe('GROWTH');
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(mockPrisma.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerPaymentId: 'pay_real_123',
            eventType: 'SUBSCRIPTION_ACTIVATED',
          }),
        }),
      );
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: validWorkspaceId },
        data: { planTier: 'GROWTH' },
      });
    });
  });

  describe('cancelSubscription', () => {
    it('sets cancelAtPeriodEnd to true and records audit event', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        workspaceId: validWorkspaceId,
        planId: 'GROWTH',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 15 * 86400000),
      });
      mockPrisma.subscription.update.mockResolvedValue({
        id: 'sub-1',
        cancelAtPeriodEnd: true,
      });

      const result = await service.cancelSubscription(
        validWorkspaceId,
        { reason: 'Cost optimization' },
        validUserId,
      );

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BILLING_SUBSCRIPTION_CANCEL_SCHEDULED',
        }),
      );
    });
  });

  describe('getUsage', () => {
    it('calculates current cycle consumption against plan limits', async () => {
      const now = new Date();
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        workspaceId: validWorkspaceId,
        planId: 'STARTER', // max 50 posts, 50,000 words, 3 accounts, 3 members
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(now.getTime() - 10 * 86400000),
        currentPeriodEnd: new Date(now.getTime() + 20 * 86400000),
        cancelAtPeriodEnd: false,
      });

      mockPrisma.post.count.mockResolvedValue(25);
      mockPrisma.usageLedger.aggregate.mockResolvedValue({
        _sum: { quantity: 15000 },
      });
      mockPrisma.socialAccount.count.mockResolvedValue(2);
      mockPrisma.membership.count.mockResolvedValue(2);

      const usage = await service.getUsage(validWorkspaceId);

      expect(usage.plan.id).toBe('STARTER');
      expect(usage.metrics.monthlyPosts.used).toBe(25);
      expect(usage.metrics.monthlyPosts.limit).toBe(50);
      expect(usage.metrics.monthlyPosts.percentage).toBe(50);

      expect(usage.metrics.monthlyAiWords.used).toBe(15000);
      expect(usage.metrics.monthlyAiWords.limit).toBe(50000);
      expect(usage.metrics.monthlyAiWords.percentage).toBe(30);

      expect(usage.metrics.socialAccounts.used).toBe(2);
      expect(usage.metrics.socialAccounts.limit).toBe(3);

      expect(usage.metrics.teamMembers.used).toBe(2);
      expect(usage.metrics.teamMembers.limit).toBe(3);
    });
  });
});
