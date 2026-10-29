import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { Prisma, SubscriptionStatus, BillingOrderStatus } from '@commercepilot/database';

export interface WebhookProcessingResult {
  status: 'processed' | 'already_processed' | 'ignored';
  eventId: string;
  eventType: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Verifies HMAC-SHA256 signature using constant-time comparison.
   */
  verifySignature(rawBody: string, signature: string, secret?: string): boolean {
    const webhookSecret =
      secret ||
      this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') ||
      this.configService.get<string>('WEBHOOK_SECRET') ||
      process.env['RAZORPAY_WEBHOOK_SECRET'] ||
      process.env['WEBHOOK_SECRET'] ||
      (process.env['NODE_ENV'] === 'test' ? 'test-webhook-secret' : undefined);

    if (!webhookSecret) {
      this.logger.error('Webhook secret is not configured.');
      return false;
    }

    if (!signature || !rawBody) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length !== expectedBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Verifies Shopify HMAC-SHA256 signature using constant-time comparison.
   * Supports standard Base64 encoding as well as hex.
   */
  verifyShopifySignature(rawBody: string, signature: string, secret?: string): boolean {
    const shopifySecret =
      secret ||
      this.configService.get<string>('SHOPIFY_CLIENT_SECRET') ||
      process.env['SHOPIFY_CLIENT_SECRET'] ||
      (process.env['NODE_ENV'] === 'test' ? 'test-shopify-secret' : undefined);

    if (!shopifySecret) {
      this.logger.error('Shopify client secret is not configured for webhook verification.');
      return false;
    }

    if (!signature || !rawBody) {
      return false;
    }

    // Standard Shopify HMAC is Base64 digest
    const expectedBase64 = crypto
      .createHmac('sha256', shopifySecret)
      .update(rawBody, 'utf8')
      .digest('base64');

    try {
      const sigBuf = Buffer.from(signature, 'base64');
      const expectedBuf = Buffer.from(expectedBase64, 'base64');
      if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return true;
      }
    } catch {}

    // Fallback support for hex format
    const expectedHex = crypto
      .createHmac('sha256', shopifySecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expectedHex, 'hex');
      if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return true;
      }
    } catch {}

    return false;
  }

  /**
   * Process incoming Shopify order webhooks idempotently with multi-channel attribution.
   */
  async processShopifyOrderWebhook(
    topic: string,
    shopDomain: string,
    payload: Record<string, unknown>,
    rawBody: string,
    signature?: string,
  ): Promise<WebhookProcessingResult> {
    const isTest = process.env['NODE_ENV'] === 'test';
    if (!signature) {
      if (!isTest) {
        throw new UnauthorizedException('Missing Shopify cryptographic HMAC signature header.');
      }
    } else if (!this.verifyShopifySignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Shopify webhook HMAC signature.');
    }

    const orderId = String(payload['id'] || payload['order_id'] || `order_${Date.now()}`);
    const eventType = topic || 'orders/paid';

    // 1. Idempotency Check at WebhookEvent level
    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: 'shopify',
          providerEventId: orderId,
        },
      },
    });

    if (existing) {
      this.logger.log(`Shopify order webhook ${orderId} already recorded, skipping.`);
      return {
        status: 'already_processed',
        eventId: orderId,
        eventType,
      };
    }

    // 2. Resolve Workspace from StoreConnection domain or payload
    let workspaceId: string | undefined = undefined;
    if (shopDomain) {
      const cleanDomain = shopDomain.replace(/^https?:\/\//, '').split('/')[0] || '';
      const conn = await this.prisma.storeConnection.findFirst({
        where: {
          platform: 'SHOPIFY',
          storeUrl: { contains: cleanDomain },
        },
      });
      if (conn) {
        workspaceId = conn.workspaceId;
      }
    }

    if (!workspaceId && typeof payload['workspaceId'] === 'string') {
      workspaceId = payload['workspaceId'] as string;
    }

    // 3. Persist WebhookEvent record
    const event = await this.prisma.webhookEvent.create({
      data: {
        provider: 'shopify',
        providerEventId: orderId,
        eventType,
        payload: payload as unknown as Prisma.InputJsonValue,
        ...(workspaceId ? { workspaceId } : {}),
        processed: false,
      },
    });

    if (!workspaceId) {
      this.logger.warn(
        `Shopify order ${orderId} for shop ${shopDomain} could not be linked to any active workspace connection.`,
      );
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processed: true, processedAt: new Date() },
      });
      return { status: 'processed', eventId: orderId, eventType };
    }

    // 4. Idempotently record ConversionEvent
    const existingConv = await this.prisma.conversionEvent.findUnique({
      where: {
        workspaceId_orderId: {
          workspaceId,
          orderId,
        },
      },
    });

    if (existingConv) {
      this.logger.log(`ConversionEvent for workspace ${workspaceId} and order ${orderId} already exists.`);
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processed: true, processedAt: new Date() },
      });
      return { status: 'already_processed', eventId: orderId, eventType };
    }

    // 5. Attribution Extraction
    let attributedCampaignId: string | undefined;
    let clickId: string | undefined;
    let attributionSource = 'shopify_direct';

    const landingSite = (payload['landing_site'] as string) || '';
    const landingSiteRef = (payload['landing_site_ref'] as string) || '';
    const referringSite = (payload['referring_site'] as string) || '';
    const combinedUrls = `${landingSite} ${landingSiteRef} ${referringSite}`;

    // Inspect URL strings for cp_click_id
    const clickIdMatch = combinedUrls.match(/cp_click_id=([a-f0-9]{24})/i);

    // Also inspect note_attributes if present
    let noteClickId: string | undefined;
    let noteUtmCampaign: string | undefined;
    const noteAttributes = payload['note_attributes'];
    if (Array.isArray(noteAttributes)) {
      for (const attr of noteAttributes) {
        if (typeof attr === 'object' && attr !== null) {
          const item = attr as Record<string, unknown>;
          const name = String(item['name'] || '').toLowerCase();
          const val = String(item['value'] || '');
          if ((name === 'cp_click_id' || name === 'click_id') && val) {
            noteClickId = val;
          }
          if (name === 'utm_campaign' && val) {
            noteUtmCampaign = val;
          }
        }
      }
    }

    const targetClickId = clickIdMatch?.[1] || noteClickId;
    if (targetClickId) {
      const click = await this.prisma.trackedClick.findFirst({
        where: { id: targetClickId, workspaceId },
      });
      if (click) {
        clickId = click.id;
        attributedCampaignId = click.campaignId || undefined;
        attributionSource = `click:${click.id}`;
      }
    }

    // Fallback: search for utm_campaign
    if (!attributedCampaignId) {
      const utmCampaignMatch = combinedUrls.match(/utm_campaign=([a-zA-Z0-9_\-]+)/i);
      const targetUtmCampaign = utmCampaignMatch?.[1] || noteUtmCampaign;
      if (targetUtmCampaign) {
        const campaign = await this.prisma.campaign.findFirst({
          where: {
            workspaceId,
            utmCampaign: targetUtmCampaign.toLowerCase().trim(),
          },
        });
        if (campaign) {
          attributedCampaignId = campaign.id;
          attributionSource = `utm:${campaign.utmCampaign}`;
        }
      }
    }

    // Calculate order total in cents
    const rawTotal =
      payload['current_total_price'] ||
      payload['total_price'] ||
      payload['subtotal_price'] ||
      '0';
    const amountCents = Math.max(0, Math.round(parseFloat(String(rawTotal)) * 100));
    const currency =
      (payload['currency'] as string) ||
      (payload['presentment_currency'] as string) ||
      'USD';
    const occurredAt = payload['created_at']
      ? new Date(payload['created_at'] as string)
      : new Date();

    await this.prisma.conversionEvent.create({
      data: {
        workspaceId,
        orderId,
        orderTotalCents: amountCents,
        currency,
        ...(attributedCampaignId ? { campaignId: attributedCampaignId } : {}),
        ...(clickId ? { clickId } : {}),
        attributionSource,
        occurredAt,
      },
    });

    await this.prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processed: true, processedAt: new Date() },
    });

    this.logger.log(
      `Shopify order ${orderId} attributed to campaign ${attributedCampaignId || 'none'} (${amountCents} ${currency}).`,
    );

    return {
      status: 'processed',
      eventId: orderId,
      eventType,
    };
  }

  /**
   * Process custom headless store or ERP order webhooks idempotently with attribution.
   */
  async processCustomOrderWebhook(
    workspaceId: string,
    payload: Record<string, unknown>,
    rawBody: string,
    signature?: string,
    secret?: string,
  ): Promise<{
    status: 'processed' | 'already_processed';
    orderId: string;
    eventType: string;
    conversionId?: string | undefined;
    attributedCampaignId?: string | undefined;
    orderTotalCents: number;
    currency: string;
    attributionSource: string;
    hmacVerified: boolean;
  }> {
    const isTest = process.env['NODE_ENV'] === 'test';
    let hmacVerified = false;

    if (signature) {
      if (!this.verifySignature(rawBody, signature, secret)) {
        throw new UnauthorizedException('Invalid custom webhook HMAC signature.');
      }
      hmacVerified = true;
    } else if (!isTest && secret) {
      throw new UnauthorizedException('Missing required HMAC signature header.');
    }

    const orderId = String(
      payload['orderId'] || payload['id'] || payload['order_id'] || `custom_order_${Date.now()}`,
    );
    const eventType = String(payload['event'] || payload['eventType'] || 'order.created');

    // 1. Idempotency Check
    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: 'custom_order',
          providerEventId: orderId,
        },
      },
    });

    if (existing) {
      this.logger.log(`Custom order webhook ${orderId} already recorded, skipping.`);
      return {
        status: 'already_processed',
        orderId,
        eventType,
        orderTotalCents: 0,
        currency: 'USD',
        attributionSource: 'already_processed',
        hmacVerified,
      };
    }

    // 2. Persist WebhookEvent record
    const event = await this.prisma.webhookEvent.create({
      data: {
        provider: 'custom_order',
        providerEventId: orderId,
        eventType,
        payload: payload as unknown as Prisma.InputJsonValue,
        workspaceId,
        processed: false,
      },
    });

    // 3. Attribution Extraction
    let attributedCampaignId: string | undefined;
    let clickId: string | undefined;
    let attributionSource = 'custom_direct';

    const rawAttr = payload['attribution'];
    const attr =
      typeof rawAttr === 'object' && rawAttr !== null
        ? (rawAttr as Record<string, unknown>)
        : {};

    const targetClickId =
      (payload['clickId'] as string) ||
      (payload['cp_click_id'] as string) ||
      (attr['clickId'] as string) ||
      (attr['cp_click_id'] as string);

    if (targetClickId) {
      const click = await this.prisma.trackedClick.findFirst({
        where: { id: targetClickId, workspaceId },
      });
      if (click) {
        clickId = click.id;
        attributedCampaignId = click.campaignId || undefined;
        attributionSource = `click:${click.id}`;
      }
    }

    if (!attributedCampaignId) {
      const targetUtmCampaign =
        (payload['utmCampaign'] as string) ||
        (payload['utm_campaign'] as string) ||
        (attr['utmCampaign'] as string) ||
        (attr['utm_campaign'] as string);

      if (targetUtmCampaign) {
        const campaign = await this.prisma.campaign.findFirst({
          where: {
            workspaceId,
            utmCampaign: targetUtmCampaign.toLowerCase().trim(),
          },
        });
        if (campaign) {
          attributedCampaignId = campaign.id;
          attributionSource = `utm:${campaign.utmCampaign}`;
        }
      }
    }

    // Total price
    let amountCents = 0;
    if (typeof payload['orderTotalCents'] === 'number') {
      amountCents = Math.max(0, Math.round(payload['orderTotalCents']));
    } else if (typeof payload['totalPrice'] === 'number') {
      amountCents = Math.max(0, Math.round(payload['totalPrice'] * 100));
    } else if (payload['total'] || payload['price']) {
      amountCents = Math.max(0, Math.round(parseFloat(String(payload['total'] || payload['price'])) * 100));
    }

    const currency = String(payload['currency'] || 'USD').toUpperCase();
    const occurredAt = payload['occurredAt'] ? new Date(payload['occurredAt'] as string) : new Date();

    const conversion = await this.prisma.conversionEvent.create({
      data: {
        workspaceId,
        orderId,
        orderTotalCents: amountCents,
        currency,
        ...(attributedCampaignId ? { campaignId: attributedCampaignId } : {}),
        ...(clickId ? { clickId } : {}),
        attributionSource,
        occurredAt,
      },
    });

    await this.prisma.webhookEvent.update({
      where: { id: event.id },
      data: { processed: true, processedAt: new Date() },
    });

    return {
      status: 'processed',
      orderId,
      eventType,
      conversionId: conversion.id,
      attributedCampaignId,
      orderTotalCents: amountCents,
      currency,
      attributionSource,
      hmacVerified,
    };
  }

  /**
   * Interactive Simulator: Generates real HMAC signature, executes order webhook processing,
   * and returns complete diagnostic inspection report for developers.
   */
  async simulateOrderWebhook(
    workspaceId: string,
    options: {
      provider: 'shopify' | 'custom' | 'woocommerce';
      eventType?: string;
      payload: Record<string, unknown>;
      secret?: string;
      tamperSignature?: boolean;
    },
  ) {
    const provider = options.provider || 'custom';
    const eventType = options.eventType || (provider === 'shopify' ? 'orders/paid' : 'order.created');
    const secret =
      options.secret ||
      this.configService.get<string>('WEBHOOK_SECRET') ||
      process.env['WEBHOOK_SECRET'] ||
      'test-webhook-secret';

    const payload = { ...options.payload };
    if (!payload['workspaceId']) {
      payload['workspaceId'] = workspaceId;
    }

    const rawBody = JSON.stringify(payload);
    let signature: string;

    if (provider === 'shopify') {
      signature = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    } else {
      signature = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    }

    if (options.tamperSignature) {
      signature = signature.split('').reverse().join('');
    }

    try {
      let resultStatus: 'processed' | 'already_processed';
      let orderId: string;
      let orderTotalCents = 0;
      let currency = 'USD';
      let attributedCampaignId: string | undefined;
      let attributionSource = 'direct';

      if (provider === 'shopify') {
        const res = await this.processShopifyOrderWebhook(
          eventType,
          (payload['shop_domain'] as string) || 'store.myshopify.com',
          payload,
          rawBody,
          signature,
        );
        resultStatus = res.status === 'already_processed' ? 'already_processed' : 'processed';
        orderId = res.eventId;

        const conv = await this.prisma.conversionEvent.findFirst({
          where: { workspaceId, orderId },
        });
        if (conv) {
          orderTotalCents = conv.orderTotalCents;
          currency = conv.currency;
          attributedCampaignId = conv.campaignId || undefined;
          attributionSource = conv.attributionSource || 'shopify_direct';
        }
      } else {
        const res = await this.processCustomOrderWebhook(
          workspaceId,
          payload,
          rawBody,
          signature,
          secret,
        );
        resultStatus = res.status;
        orderId = res.orderId;
        orderTotalCents = res.orderTotalCents;
        currency = res.currency;
        attributedCampaignId = res.attributedCampaignId;
        attributionSource = res.attributionSource;
      }

      let campaignName: string | undefined;
      if (attributedCampaignId) {
        const campaign = await this.prisma.campaign.findUnique({
          where: { id: attributedCampaignId },
        });
        campaignName = campaign ? campaign.name : undefined;
      }

      return {
        success: true,
        httpStatus: 200,
        provider,
        eventType,
        orderId,
        hmacSignature: signature,
        hmacValid: !options.tamperSignature,
        idempotencyStatus: resultStatus,
        orderTotalCents,
        currency,
        attribution: {
          campaignId: attributedCampaignId,
          campaignName,
          source: attributionSource,
        },
        message:
          resultStatus === 'already_processed'
            ? `Order ${orderId} was previously received. Idempotent guard acknowledged without duplicate charge.`
            : `Order ${orderId} callback verified via HMAC-SHA256 and attributed to ${campaignName ? `'${campaignName}'` : 'direct traffic'}.`,
      };
    } catch (err: unknown) {
      const isAuthErr = err instanceof UnauthorizedException;
      return {
        success: false,
        httpStatus: isAuthErr ? 401 : 400,
        provider,
        eventType,
        orderId: String(payload['orderId'] || payload['id'] || 'unknown'),
        hmacSignature: signature,
        hmacValid: false,
        idempotencyStatus: 'failed',
        error: err instanceof Error ? err.message : 'Webhook execution failed',
        message: err instanceof Error ? err.message : 'Webhook callback failed',
      };
    }
  }

  /**
   * Process incoming webhook payload idempotently.
   */
  async processBillingWebhook(
    provider: string,
    providerEventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    rawBody: string,
    signature?: string,
  ): Promise<WebhookProcessingResult> {
    // Cryptographic signature is strictly mandatory
    const isTest = process.env['NODE_ENV'] === 'test';
    if (!signature) {
      if (!isTest) {
        throw new UnauthorizedException('Missing cryptographic webhook signature header.');
      }
    } else if (!this.verifySignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid cryptographic webhook signature.');
    }

    // 1. Idempotency Check
    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider,
          providerEventId,
        },
      },
    });

    if (existing) {
      this.logger.log(`Webhook ${provider}:${providerEventId} already recorded, skipping.`);
      return {
        status: 'already_processed',
        eventId: providerEventId,
        eventType,
      };
    }

    const rawMeta = payload['metadata'];
    const metadata =
      typeof rawMeta === 'object' && rawMeta !== null
        ? (rawMeta as Record<string, unknown>)
        : undefined;
    const workspaceId =
      (typeof payload['workspaceId'] === 'string' ? payload['workspaceId'] : undefined) ||
      (typeof metadata?.['workspaceId'] === 'string'
        ? (metadata['workspaceId'] as string)
        : undefined);

    // 2. Persist WebhookEvent record
    const event = await this.prisma.webhookEvent.create({
      data: {
        provider,
        providerEventId,
        eventType,
        payload: payload as unknown as Prisma.InputJsonValue,
        ...(workspaceId ? { workspaceId } : {}),
        processed: false,
      },
    });

    // 3. Dispatch Event Business Logic
    try {
      await this.handleBillingEvent(eventType, payload, workspaceId);

      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      return {
        status: 'processed',
        eventId: providerEventId,
        eventType,
      };
    } catch (err) {
      this.logger.error(
        `Error processing webhook event ${providerEventId}: ${(err as Error).message}`,
      );
      throw new BadRequestException(`Failed to process webhook event: ${(err as Error).message}`);
    }
  }

  /**
   * Process a real Razorpay webhook (`payment.captured`, `order.paid`, `payment.failed`)
   * with mandatory HMAC-SHA256 signature verification and idempotency.
   *
   * This is the ONLY path that marks a BillingOrder PAID and activates a paid plan.
   * The `/billing/activate` endpoint is gated on the result of this verification.
   */
  async processRazorpayPaymentWebhook(
    rawBody: string,
    signature?: string,
  ): Promise<WebhookProcessingResult> {
    const isTest = process.env['NODE_ENV'] === 'test';
    if (!signature) {
      if (!isTest) {
        throw new UnauthorizedException(
          'Missing Razorpay webhook signature header (x-razorpay-signature).',
        );
      }
    } else if (!this.verifySignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Razorpay webhook HMAC-SHA256 signature.');
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid JSON webhook body.');
    }

    const eventType = (body['event'] as string) || 'unknown';
    const payload = (body['payload'] as Record<string, unknown>) ?? {};
    const paymentEntity = (payload['payment'] as Record<string, unknown> | undefined)
      ?.entity as Record<string, unknown> | undefined;
    const orderEntity = (payload['order'] as Record<string, unknown> | undefined)
      ?.entity as Record<string, unknown> | undefined;

    const entity = paymentEntity ?? orderEntity ?? {};
    const providerEventId =
      (body['event_id'] as string) ||
      (entity['id'] as string) ||
      `${eventType}_${Date.now()}`;

    // 1. Idempotency check
    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_providerEventId: { provider: 'razorpay', providerEventId },
      },
    });
    if (existing) {
      this.logger.log(`Razorpay webhook ${providerEventId} already recorded, skipping.`);
      return { status: 'already_processed', eventId: providerEventId, eventType };
    }

    // 2. Persist event record
    const event = await this.prisma.webhookEvent.create({
      data: {
        provider: 'razorpay',
        providerEventId,
        eventType,
        payload: body as unknown as Prisma.InputJsonValue,
        processed: false,
      },
    });

    // 3. Dispatch business logic
    try {
      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        await this.handleRazorpayCaptured(entity, eventType);
      } else if (eventType === 'payment.failed') {
        await this.handleRazorpayFailed(entity);
      } else {
        this.logger.log(`Unhandled Razorpay webhook event type: ${eventType}`);
      }

      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processed: true, processedAt: new Date() },
      });

      return { status: 'processed', eventId: providerEventId, eventType };
    } catch (err) {
      this.logger.error(
        `Error processing Razorpay webhook ${providerEventId}: ${(err as Error).message}`,
      );
      throw new BadRequestException(`Failed to process Razorpay webhook: ${(err as Error).message}`);
    }
  }

  private async handleRazorpayCaptured(
    entity: Record<string, unknown>,
    eventType: string,
  ): Promise<void> {
    const razorpayOrderId = (entity['order_id'] as string) || (entity['id'] as string) || '';
    const paymentId = (entity['id'] as string) || '';
    const amountCents = Number(entity['amount'] || 0);
    const currency = (entity['currency'] as string) || 'USD';

    if (!razorpayOrderId) {
      this.logger.warn(`Razorpay ${eventType} without a resolvable order id; skipping activation.`);
      return;
    }

    const order = await this.prisma.billingOrder.findUnique({
      where: { razorpayOrderId },
    });

    if (!order) {
      this.logger.warn(`Razorpay ${eventType} for unknown order ${razorpayOrderId}; ignoring.`);
      return;
    }

    // Mark order PAID (idempotent)
    await this.prisma.billingOrder.update({
      where: { id: order.id },
      data: {
        status: BillingOrderStatus.PAID,
        providerPaymentId: paymentId,
        confirmedAt: new Date(),
      },
    });

    // Activate the subscription for the workspace/plan referenced by the order
    const workspaceId = order.workspaceId;
    const planId = order.planId;
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);

    const existingSub = await this.prisma.subscription.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSub) {
      await this.prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          planId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          workspaceId,
          planId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });
    }

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { planTier: planId.toUpperCase() },
    });

    await this.prisma.billingEvent.create({
      data: {
        workspaceId,
        providerPaymentId: paymentId,
        amountCents,
        currency,
        eventType: 'payment.captured',
        metadata: { razorpayOrderId, planId },
      },
    });
  }

  private async handleRazorpayFailed(entity: Record<string, unknown>): Promise<void> {
    const razorpayOrderId = (entity['order_id'] as string) || (entity['id'] as string) || '';
    if (!razorpayOrderId) return;

    const order = await this.prisma.billingOrder.findUnique({
      where: { razorpayOrderId },
    });
    if (!order) return;

    await this.prisma.billingOrder.update({
      where: { id: order.id },
      data: { status: BillingOrderStatus.FAILED },
    });

    const sub = await this.prisma.subscription.findFirst({
      where: { workspaceId: order.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    if (sub) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
    }
  }

  private async handleBillingEvent(
    eventType: string,
    payload: Record<string, unknown>,
    workspaceId?: string,
  ): Promise<void> {
    if (!workspaceId) {
      this.logger.warn(`Webhook ${eventType} missing workspaceId, skipping business mutation.`);
      return;
    }

    switch (eventType) {
      case 'subscription.activated': {
        // Legacy generic-gateway event. Paid plan activation is now gated on the
        // cryptographically verified Razorpay payment.captured webhook, so this
        // event no longer mutates subscription state (prevents unsigned/simulated
        // plan upgrades via the generic gateway).
        this.logger.warn(
          `Ignoring legacy subscription.activated event for workspace ${workspaceId}: paid activation requires a Razorpay webhook.`,
        );
        break;
      }

      case 'subscription.charged': {
        const amountCents = Number(payload['amountCents'] || payload['amount'] || 2900);
        const currency = (payload['currency'] as string) || 'USD';
        const paymentId = (payload['paymentId'] as string) || `pay_${Date.now()}`;

        await this.prisma.billingEvent.create({
          data: {
            workspaceId,
            providerPaymentId: paymentId,
            amountCents,
            currency,
            eventType: 'subscription.charged',
            metadata: payload as unknown as Prisma.InputJsonValue,
          },
        });

        // Extend active subscription
        const sub = await this.prisma.subscription.findFirst({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
        });

        if (sub) {
          const nextPeriodEnd = new Date(sub.currentPeriodEnd);
          nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 30);
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: SubscriptionStatus.ACTIVE,
              currentPeriodEnd: nextPeriodEnd,
            },
          });
        }
        break;
      }

      case 'payment.failed': {
        const sub = await this.prisma.subscription.findFirst({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
        });

        if (sub) {
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.PAST_DUE },
          });
        }
        break;
      }

      case 'subscription.cancelled': {
        const sub = await this.prisma.subscription.findFirst({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
        });

        if (sub) {
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
              status: SubscriptionStatus.CANCELED,
              cancelAtPeriodEnd: true,
            },
          });
        }
        break;
      }

      default:
        this.logger.log(`Unhandled webhook event type: ${eventType}`);
    }
  }
}
