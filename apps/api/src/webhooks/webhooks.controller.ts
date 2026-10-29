import { Controller, Post, Body, Headers, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { WebhooksService, WebhookProcessingResult } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('billing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive and process billing webhook events with signature verification',
  })
  @ApiResponse({ status: 200, description: 'Webhook acknowledged and processed idempotently' })
  @ApiResponse({ status: 401, description: 'Invalid cryptographic signature' })
  async handleBillingWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Req() req: Request,
  ): Promise<WebhookProcessingResult> {
    const eventId = (body['id'] as string) || (body['eventId'] as string) || `evt_${Date.now()}`;
    const eventType = (body['event'] as string) || (body['eventType'] as string) || 'unknown';
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(body);

    return this.webhooksService.processBillingWebhook(
      'billing_gateway',
      eventId,
      eventType,
      body,
      rawBody,
      signature,
    );
  }

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive Razorpay payment webhooks with HMAC-SHA256 signature verification',
  })
  @ApiResponse({ status: 200, description: 'Razorpay webhook acknowledged' })
  @ApiResponse({ status: 401, description: 'Invalid Razorpay signature' })
  async handleRazorpayWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string | undefined,
  ): Promise<WebhookProcessingResult> {
    const rawBody = req.rawBody
      ? req.rawBody.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body ?? {});

    return this.webhooksService.processRazorpayPaymentWebhook(rawBody, signature);
  }

  @Post('shopify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive Shopify order webhooks with HMAC-SHA256 signature verification',
  })
  @ApiResponse({ status: 200, description: 'Shopify order webhook acknowledged and attributed' })
  @ApiResponse({ status: 401, description: 'Invalid Shopify HMAC signature' })
  async handleShopifyWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-shopify-hmac-sha256') signature: string | undefined,
    @Headers('x-shopify-shop-domain') shopDomain: string | undefined,
    @Headers('x-shopify-topic') topic: string | undefined,
    @Req() req: Request,
  ): Promise<WebhookProcessingResult> {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(body);

    return this.webhooksService.processShopifyOrderWebhook(
      topic || 'orders/paid',
      shopDomain || '',
      body,
      rawBody,
      signature,
    );
  }
}
