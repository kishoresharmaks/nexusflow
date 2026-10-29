import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhooksService } from '../src/webhooks/webhooks.service';
import crypto from 'crypto';
import { SubscriptionStatus, BillingOrderStatus } from '@commercepilot/database';
import type { PrismaService } from '../src/database/prisma.service';
import type { ConfigService } from '@nestjs/config';

describe('WebhooksService', () => {
  let service: WebhooksService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockConfig: any;

  const testSecret = 'test-secret-key-32-bytes-long!!';
  const validWorkspaceId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    mockPrisma = {
      webhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      subscription: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      billingEvent: {
        create: vi.fn(),
      },
      billingOrder: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      workspace: {
        update: vi.fn(),
      },
    };

    mockConfig = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'WEBHOOK_SECRET' || key === 'CRYPTO_SECRET') {
          return testSecret;
        }
        return null;
      }),
    };

    service = new WebhooksService(
      mockPrisma as unknown as PrismaService,
      mockConfig as unknown as ConfigService,
    );
  });

  describe('verifySignature', () => {
    it('returns true for matching HMAC-SHA256 signature', () => {
      const payload = JSON.stringify({ event: 'subscription.charged', amount: 2900 });
      const validSig = crypto
        .createHmac('sha256', testSecret)
        .update(payload, 'utf8')
        .digest('hex');

      expect(service.verifySignature(payload, validSig, testSecret)).toBe(true);
    });

    it('returns false for tampered payload or forged signature', () => {
      const payload = JSON.stringify({ event: 'subscription.charged', amount: 2900 });
      const forgedSig = crypto
        .createHmac('sha256', 'wrong-secret')
        .update(payload, 'utf8')
        .digest('hex');

      expect(service.verifySignature(payload, forgedSig, testSecret)).toBe(false);
      expect(service.verifySignature('altered-body', forgedSig, testSecret)).toBe(false);
    });
  });

  describe('processBillingWebhook', () => {
    it('rejects invalid signature with UnauthorizedException', async () => {
      await expect(
        service.processBillingWebhook(
          'razorpay',
          'evt_123',
          'subscription.charged',
          { amount: 2900 },
          'raw-body',
          'invalid-sig-hex-1234567890abcdef',
        ),
      ).rejects.toThrow('Invalid cryptographic webhook signature.');
    });

    it('is idempotent and returns already_processed without re-executing logic', async () => {
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        id: 'wh-1',
        provider: 'razorpay',
        providerEventId: 'evt_dup_999',
        processed: true,
      });

      const raw = JSON.stringify({ event: 'subscription.charged', amount: 2900 });
      const sig = crypto.createHmac('sha256', testSecret).update(raw, 'utf8').digest('hex');

      const result = await service.processBillingWebhook(
        'razorpay',
        'evt_dup_999',
        'subscription.charged',
        { amount: 2900 },
        raw,
        sig,
      );

      expect(result.status).toBe('already_processed');
      expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
      expect(mockPrisma.billingEvent.create).not.toHaveBeenCalled();
    });

    it('processes subscription.charged event and registers billing record', async () => {
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.webhookEvent.create.mockResolvedValue({
        id: 'wh-new',
        provider: 'razorpay',
        providerEventId: 'evt_new_1',
      });
      mockPrisma.webhookEvent.update.mockResolvedValue({ id: 'wh-new', processed: true });

      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        workspaceId: validWorkspaceId,
        currentPeriodEnd: new Date(),
      });
      mockPrisma.subscription.update.mockResolvedValue({ id: 'sub-1' });
      mockPrisma.billingEvent.create.mockResolvedValue({ id: 'bill-1' });

      const raw = JSON.stringify({ workspaceId: validWorkspaceId, amountCents: 7900 });
      const sig = crypto.createHmac('sha256', testSecret).update(raw, 'utf8').digest('hex');

      const result = await service.processBillingWebhook(
        'razorpay',
        'evt_new_1',
        'subscription.charged',
        { workspaceId: validWorkspaceId, amountCents: 7900 },
        raw,
        sig,
      );

      expect(result.status).toBe('processed');
      expect(mockPrisma.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: validWorkspaceId,
            amountCents: 7900,
            eventType: 'subscription.charged',
          }),
        }),
      );
      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ processed: true }),
        }),
      );
    });
  });

  describe('processRazorpayPaymentWebhook', () => {
    const razorpayPayload = (event: string, entity: Record<string, unknown>) => ({
      entity: 'event',
      event,
      payload: {
        payment: { entity },
      },
    });

    it('rejects an invalid signature with UnauthorizedException', async () => {
      const raw = JSON.stringify(razorpayPayload('payment.captured', { id: 'pay_1', order_id: 'order_1' }));
      await expect(
        service.processRazorpayPaymentWebhook(raw, 'deadbeef-invalid-sig'),
      ).rejects.toThrow('Invalid Razorpay webhook HMAC-SHA256 signature.');
    });

    it('activates the subscription and marks the order PAID on verified payment.captured', async () => {
      const payload = razorpayPayload('payment.captured', {
        id: 'pay_abc123',
        amount: 7900,
        currency: 'USD',
        order_id: 'order_real_123',
        status: 'captured',
      });
      const raw = JSON.stringify(payload);
      const sig = crypto.createHmac('sha256', testSecret).update(raw, 'utf8').digest('hex');

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.webhookEvent.create.mockResolvedValue({ id: 'wh-razorpay-1' });
      mockPrisma.webhookEvent.update.mockResolvedValue({ id: 'wh-razorpay-1', processed: true });
      mockPrisma.billingOrder.findUnique.mockResolvedValue({
        id: 'bo-1',
        workspaceId: validWorkspaceId,
        planId: 'GROWTH',
        razorpayOrderId: 'order_real_123',
      });
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        workspaceId: validWorkspaceId,
      });
      mockPrisma.subscription.update.mockResolvedValue({ id: 'sub-1' });
      mockPrisma.workspace.update.mockResolvedValue({ id: validWorkspaceId });
      mockPrisma.billingEvent.create.mockResolvedValue({ id: 'be-1' });

      const result = await service.processRazorpayPaymentWebhook(raw, sig);

      expect(result.status).toBe('processed');
      expect(mockPrisma.billingOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bo-1' },
          data: expect.objectContaining({
            status: BillingOrderStatus.PAID,
            providerPaymentId: 'pay_abc123',
          }),
        }),
      );
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({ planId: 'GROWTH', status: SubscriptionStatus.ACTIVE }),
        }),
      );
      expect(mockPrisma.billingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerPaymentId: 'pay_abc123',
            eventType: 'payment.captured',
          }),
        }),
      );
    });

    it('returns already_processed for a duplicate webhook event id', async () => {
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        id: 'wh-razorpay-existing',
        provider: 'razorpay',
        providerEventId: 'pay_dup_1',
        processed: true,
      });

      const payload = razorpayPayload('payment.captured', { id: 'pay_dup_1', order_id: 'order_1' });
      const raw = JSON.stringify(payload);
      const sig = crypto.createHmac('sha256', testSecret).update(raw, 'utf8').digest('hex');

      const result = await service.processRazorpayPaymentWebhook(raw, sig);

      expect(result.status).toBe('already_processed');
      expect(mockPrisma.billingOrder.update).not.toHaveBeenCalled();
    });
  });
});
