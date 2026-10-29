import { randomBytes } from 'crypto';
import { encryptToken, decryptToken } from '../../social/crypto.util';
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { RolesGuard } from '../../workspaces/guards/roles.guard';
import { Roles } from '../../workspaces/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { WebhooksService } from '../../webhooks/webhooks.service';
import { CustomStoreAdapter } from './custom-store.adapter';
import { CustomProductBatchDto, ValidateCustomPayloadDto } from './dto/custom-product-ingest.dto';
import { StoreSyncStatus, StorePlatform, type User } from '@commercepilot/database';

@Controller('workspaces/:workspaceId/integrations/custom')
@UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
export class CustomStoreController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly customStoreAdapter: CustomStoreAdapter,
    private readonly webhooksService: WebhooksService,
  ) {}

  /**
   * Push-based catalog ingestion API.
   * Upserts batches of products from external headless stores, ERPs, or custom webhooks.
   */
  @Post('products')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async ingestProducts(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CustomProductBatchDto,
    @CurrentUser() user: User,
  ) {
    if (!dto.products || !Array.isArray(dto.products) || dto.products.length === 0) {
      throw new BadRequestException('Request body must contain an array of products.');
    }

    const now = new Date();
    let created = 0;
    let updated = 0;
    const storeLabel = dto.storeName?.trim() || 'Custom Ingestion API';

    for (const p of dto.products) {
      const existing = await this.prisma.product.findFirst({
        where: {
          workspaceId,
          source: 'CUSTOM',
          sourceId: p.sourceId,
        },
      });

      if (existing) {
        await this.prisma.product.update({
          where: { id: existing.id },
          data: {
            title: p.title.trim(),
            priceCents: Math.max(0, Math.round(p.priceCents)),
            currency: (p.currency || 'USD').toUpperCase(),
            inventoryCount: p.inventoryCount !== undefined ? Math.max(0, Math.round(p.inventoryCount)) : existing.inventoryCount,
            sku: p.sku !== undefined ? p.sku.trim() : existing.sku,
            description: p.description !== undefined ? p.description : existing.description,
            url: p.url !== undefined ? p.url : existing.url,
            images: p.images || existing.images,
            tags: p.tags || existing.tags,
            isActive: p.isActive !== undefined ? p.isActive : existing.isActive,
            freshnessCheckedAt: now,
          },
        });
        updated++;
      } else {
        await this.prisma.product.create({
          data: {
            workspaceId,
            source: 'CUSTOM',
            sourceId: p.sourceId,
            title: p.title.trim(),
            priceCents: Math.max(0, Math.round(p.priceCents)),
            currency: (p.currency || 'USD').toUpperCase(),
            inventoryCount: p.inventoryCount !== undefined ? Math.max(0, Math.round(p.inventoryCount)) : 0,
            sku: p.sku ? p.sku.trim() : null,
            description: p.description || null,
            url: p.url || null,
            images: p.images || [],
            tags: p.tags || [],
            isActive: p.isActive !== undefined ? p.isActive : true,
            freshnessCheckedAt: now,
          },
        });
        created++;
      }
    }

    // Upsert or update a StoreConnection representing this custom source
    const storeUrl = `https://custom-api.workspace/${workspaceId}`;
    await this.prisma.storeConnection.upsert({
      where: {
        workspaceId_platform_storeUrl: {
          workspaceId,
          platform: StorePlatform.CUSTOM,
          storeUrl,
        },
      },
      create: {
        workspaceId,
        platform: StorePlatform.CUSTOM,
        storeName: storeLabel,
        storeUrl,
        encryptedApiKey: 'custom_push_api',
        syncStatus: StoreSyncStatus.SUCCESS,
        lastSyncAt: now,
        syncedProducts: created + updated,
      },
      update: {
        storeName: storeLabel,
        syncStatus: StoreSyncStatus.SUCCESS,
        lastSyncAt: now,
        syncedProducts: created + updated,
        errorMessage: null,
      },
    });

    // Record audit event
    await this.auditService.record({
      workspaceId,
      userId: user.id,
      action: 'store.custom_ingested',
      resourceType: 'Product',
      metadata: {
        storeName: storeLabel,
        totalReceived: dto.products.length,
        created,
        updated,
      },
    });

    return {
      success: true,
      total: dto.products.length,
      created,
      updated,
      failed: 0,
      message: `Successfully ingested ${dto.products.length} custom products (${created} created, ${updated} updated).`,
    };
  }

  /**
   * Interactive Sandbox validation endpoint.
   * Validates raw JSON payload against catalog requirements without saving.
   */
  @Post('validate')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  validatePayload(@Body() dto: ValidateCustomPayloadDto) {
    if (!dto || dto.payload === undefined || dto.payload === null) {
      return {
        valid: false,
        normalizedCount: 0,
        errors: ['Payload is empty or null.'],
        sample: [],
      };
    }

    const errors: string[] = [];
    const normalized = this.customStoreAdapter.normalizePayload(
      dto.payload,
      'https://store.example.com',
      10,
    );

    if (normalized.length === 0) {
      errors.push('No valid product items could be extracted from payload. Ensure your payload is an array of objects or an object containing a `products` array with `sourceId`, `title`, and `priceCents`.');
    }

    return {
      valid: errors.length === 0 && normalized.length > 0,
      normalizedCount: normalized.length,
      errors,
      sample: normalized,
    };
  }

  /**
   * Retrieve recent custom store ingestion history from audit events.
   */
  @Get('history')
  @Roles('OWNER', 'ADMIN')
  async getIngestHistory(@Param('workspaceId') workspaceId: string) {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        workspaceId,
        action: 'store.custom_ingested',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return events.map((e) => {
      const meta = (e.metadata || {}) as Record<string, unknown>;
      return {
        id: e.id,
        timestamp: e.createdAt.toISOString(),
        storeName: (meta.storeName as string) || 'Custom Store',
        total: (meta.totalReceived as number) || 0,
        created: (meta.created as number) || 0,
        updated: (meta.updated as number) || 0,
        actor: e.user ? { name: e.user.name, email: e.user.email } : null,
      };
    });
  }

  /**
   * Order webhook ingestion endpoint for custom/headless stores and ERPs.
   * Records conversions idempotently with multi-channel attribution and optional HMAC verification.
   */
  @Post('orders')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async ingestOrder(
    @Param('workspaceId') workspaceId: string,
    @Body() payload: Record<string, unknown>,
    @Headers('x-nexusflow-hmac') signature: string | undefined,
    @Headers('x-webhook-signature') altSignature: string | undefined,
    @Req() req: Request,
  ) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(payload);
    return this.webhooksService.processCustomOrderWebhook(
      workspaceId,
      payload,
      rawBody,
      signature || altSignature,
    );
  }

  /**
   * Interactive Order Webhook Callback Simulator for developers and store integrators.
   * Calculates HMAC signature, executes order callback against internal engine,
   * and returns comprehensive diagnostics with matched attribution.
   */
  @Post('simulate-order-webhook')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async simulateOrderWebhook(
    @Param('workspaceId') workspaceId: string,
    @Body()
    dto: {
      provider?: 'shopify' | 'custom' | 'woocommerce';
      eventType?: string;
      payload: Record<string, unknown>;
      secret?: string;
      tamperSignature?: boolean;
    },
  ) {
    if (!dto || !dto.payload || typeof dto.payload !== 'object') {
      throw new BadRequestException('Request body must include a `payload` object.');
    }

    const options: {
      provider: 'shopify' | 'custom' | 'woocommerce';
      eventType?: string;
      payload: Record<string, unknown>;
      secret?: string;
      tamperSignature?: boolean;
    } = {
      provider: dto.provider || 'custom',
      payload: dto.payload,
    };

    if (dto.eventType) options.eventType = dto.eventType;
    if (dto.secret) options.secret = dto.secret;
    if (dto.tamperSignature !== undefined) options.tamperSignature = dto.tamperSignature;

    return this.webhooksService.simulateOrderWebhook(workspaceId, options);
  }

  /**
   * Retrieves developer integration credentials and signing endpoint details.
   */
  @Get('credentials')
  @Roles('OWNER', 'ADMIN')
  async getCredentials(@Param('workspaceId') workspaceId: string) {
    const storeUrl = `https://custom-api.workspace/${workspaceId}`;
    let store = await this.prisma.storeConnection.findUnique({
      where: {
        workspaceId_platform_storeUrl: {
          workspaceId,
          platform: StorePlatform.CUSTOM,
          storeUrl,
        },
      },
    });

    if (!store) {
      const generatedApiKey = `nxf_live_${randomBytes(16).toString('hex')}`;
      const generatedSecret = `whsec_${randomBytes(24).toString('hex')}`;
      store = await this.prisma.storeConnection.create({
        data: {
          workspaceId,
          platform: StorePlatform.CUSTOM,
          storeName: 'Custom Headless & ERP Ingestion',
          storeUrl,
          encryptedApiKey: encryptToken(generatedApiKey),
          encryptedSecret: encryptToken(generatedSecret),
          syncStatus: StoreSyncStatus.IDLE,
          syncedProducts: 0,
        },
      });
    }

    let decryptedKey = 'nxf_live_••••••••';
    let decryptedSecret = 'whsec_••••••••';
    try {
      const rawKey = decryptToken(store.encryptedApiKey);
      decryptedKey = rawKey.length > 10 ? `${rawKey.slice(0, 9)}••••${rawKey.slice(-4)}` : rawKey;
    } catch {}

    try {
      if (store.encryptedSecret) {
        const rawSec = decryptToken(store.encryptedSecret);
        decryptedSecret = rawSec.length > 10 ? `${rawSec.slice(0, 6)}••••${rawSec.slice(-4)}` : rawSec;
      }
    } catch {}

    const apiBase = process.env['API_URL'] || 'http://localhost:4000';
    const cleanBase = apiBase.replace(/\/+$/, '');

    return {
      success: true,
      storeId: store.id,
      storeName: store.storeName,
      apiKeyMasked: decryptedKey,
      webhookSecretMasked: decryptedSecret,
      pushEndpoint: `${cleanBase}/api/v1/workspaces/${workspaceId}/integrations/custom/products`,
      webhookEndpoint: `${cleanBase}/api/v1/workspaces/${workspaceId}/integrations/custom/orders`,
      syncedProducts: store.syncedProducts,
      lastSyncAt: store.lastSyncAt ? store.lastSyncAt.toISOString() : null,
    };
  }

  /**
   * Rotates or generates a new Webhook HMAC Signing Secret for the workspace.
   */
  @Post('rotate-secret')
  @Roles('OWNER', 'ADMIN')
  async rotateWebhookSecret(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
  ) {
    const storeUrl = `https://custom-api.workspace/${workspaceId}`;
    const newSecret = `whsec_${randomBytes(24).toString('hex')}`;
    const encryptedSecret = encryptToken(newSecret);

    await this.prisma.storeConnection.upsert({
      where: {
        workspaceId_platform_storeUrl: {
          workspaceId,
          platform: StorePlatform.CUSTOM,
          storeUrl,
        },
      },
      create: {
        workspaceId,
        platform: StorePlatform.CUSTOM,
        storeName: 'Custom Headless & ERP Ingestion',
        storeUrl,
        encryptedApiKey: encryptToken(`nxf_live_${randomBytes(16).toString('hex')}`),
        encryptedSecret,
        syncStatus: StoreSyncStatus.IDLE,
        syncedProducts: 0,
      },
      update: {
        encryptedSecret,
      },
    });

    await this.auditService.record({
      workspaceId,
      userId: user.id,
      action: 'store.custom_secret_rotated',
      resourceType: 'StoreConnection',
      metadata: {
        platform: 'CUSTOM',
        rotatedAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
      webhookSecret: newSecret,
      message: 'New Webhook HMAC signing secret generated. Copy and save it now into your webhook emitter headers.',
    };
  }
}
