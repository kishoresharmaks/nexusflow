import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { StoreSyncStatus, StorePlatform } from '@commercepilot/database';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { encryptToken, decryptToken } from '../../social/crypto.util';
import { StoreAdapterFactory } from './store-adapter.factory';
import { ConnectStoreDto } from './dto/connect-store.dto';

export interface MaskedStoreConnection {
  id: string;
  workspaceId: string;
  platform: StorePlatform;
  storeName: string;
  storeUrl: string;
  apiKeyMasked: string;
  apiVersion?: string | null | undefined;
  lastSyncAt?: Date | null | undefined;
  syncStatus: StoreSyncStatus;
  errorMessage?: string | null | undefined;
  syncedProducts: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class StoreConnectionsService {
  private readonly logger = new Logger(StoreConnectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly adapterFactory: StoreAdapterFactory,
  ) {}

  /**
   * Connect a new store to a workspace, validating credentials and encrypting keys.
   */
  async connectStore(
    workspaceId: string,
    dto: ConnectStoreDto,
    userId?: string,
  ): Promise<MaskedStoreConnection> {
    const adapter = this.adapterFactory.getAdapter(dto.platform);

    const isConnected = await adapter.testConnection({
      platform: dto.platform,
      storeUrl: dto.storeUrl,
      apiKey: dto.apiKey,
      apiSecret: dto.apiSecret,
      apiVersion: dto.apiVersion,
    });

    if (!isConnected) {
      throw new BadRequestException(
        `Failed to connect to ${dto.platform} store at ${dto.storeUrl}. Please check your credentials.`,
      );
    }

    const encryptedApiKey = encryptToken(dto.apiKey);
    const encryptedSecret = dto.apiSecret ? encryptToken(dto.apiSecret) : undefined;

    const connection = await this.prisma.storeConnection.upsert({
      where: {
        workspaceId_platform_storeUrl: {
          workspaceId,
          platform: dto.platform,
          storeUrl: dto.storeUrl,
        },
      },
      create: {
        workspaceId,
        platform: dto.platform,
        storeName: dto.storeName,
        storeUrl: dto.storeUrl,
        encryptedApiKey,
        ...(encryptedSecret ? { encryptedSecret } : {}),
        ...(dto.apiVersion ? { apiVersion: dto.apiVersion } : {}),
        syncStatus: StoreSyncStatus.IDLE,
      },
      update: {
        storeName: dto.storeName,
        encryptedApiKey,
        ...(encryptedSecret ? { encryptedSecret } : {}),
        ...(dto.apiVersion ? { apiVersion: dto.apiVersion } : {}),
        syncStatus: StoreSyncStatus.IDLE,
        errorMessage: null,
      },
    });

    if (userId) {
      await this.auditService.record({
        workspaceId,
        userId,
        action: 'store.connected',
        resourceType: 'StoreConnection',
        resourceId: connection.id,
        metadata: { platform: dto.platform, storeUrl: dto.storeUrl },
      });
    }

    return this.maskConnection(connection);
  }

  /**
   * List all store connections for a workspace.
   */
  async listStores(workspaceId: string): Promise<MaskedStoreConnection[]> {
    const connections = await this.prisma.storeConnection.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    return connections.map((conn) => this.maskConnection(conn));
  }

  /**
   * Get single store connection.
   */
  async getStore(workspaceId: string, connectionId: string): Promise<MaskedStoreConnection> {
    const connection = await this.prisma.storeConnection.findFirst({
      where: { id: connectionId, workspaceId },
    });

    if (!connection) {
      throw new NotFoundException(`Store connection ${connectionId} not found in workspace.`);
    }

    return this.maskConnection(connection);
  }

  /**
   * Disconnect and remove a store connection.
   */
  async disconnectStore(
    workspaceId: string,
    connectionId: string,
    userId?: string,
  ): Promise<{ success: boolean }> {
    const connection = await this.prisma.storeConnection.findFirst({
      where: { id: connectionId, workspaceId },
    });

    if (!connection) {
      throw new NotFoundException(`Store connection ${connectionId} not found.`);
    }

    await this.prisma.storeConnection.delete({
      where: { id: connectionId },
    });

    if (userId) {
      await this.auditService.record({
        workspaceId,
        userId,
        action: 'store.disconnected',
        resourceType: 'StoreConnection',
        resourceId: connectionId,
        metadata: { platform: connection.platform, storeUrl: connection.storeUrl },
      });
    }

    return { success: true };
  }

  /**
   * Trigger catalog synchronization from store to workspace products.
   */
  async syncStore(
    workspaceId: string,
    connectionId: string,
    userId?: string,
  ): Promise<{ synced: number; status: StoreSyncStatus; message?: string }> {
    const connection = await this.prisma.storeConnection.findFirst({
      where: { id: connectionId, workspaceId },
    });

    if (!connection) {
      throw new NotFoundException(`Store connection ${connectionId} not found.`);
    }

    // Set status to SYNCING
    await this.prisma.storeConnection.update({
      where: { id: connectionId },
      data: { syncStatus: StoreSyncStatus.SYNCING, errorMessage: null },
    });

    try {
      const adapter = this.adapterFactory.getAdapter(connection.platform);
      const decryptedApiKey = decryptToken(connection.encryptedApiKey);
      const decryptedSecret = connection.encryptedSecret
        ? decryptToken(connection.encryptedSecret)
        : undefined;

      const products = await adapter.fetchProducts({
        platform: connection.platform,
        storeUrl: connection.storeUrl,
        apiKey: decryptedApiKey,
        ...(decryptedSecret ? { apiSecret: decryptedSecret } : {}),
        ...(connection.apiVersion ? { apiVersion: connection.apiVersion } : {}),
      });

      let upsertCount = 0;
      const now = new Date();

      for (const p of products) {
        const existing = await this.prisma.product.findFirst({
          where: {
            workspaceId,
            source: connection.platform,
            sourceId: p.sourceId,
          },
        });

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data: {
              title: p.title,
              ...(p.description !== undefined ? { description: p.description } : {}),
              priceCents: p.priceCents,
              currency: p.currency,
              inventoryCount: p.inventoryCount,
              ...(p.url !== undefined ? { url: p.url } : {}),
              images: p.images,
              tags: p.tags,
              freshnessCheckedAt: now,
              isActive: true,
            },
          });
        } else {
          await this.prisma.product.create({
            data: {
              workspaceId,
              ...(p.sku ? { sku: p.sku } : {}),
              title: p.title,
              ...(p.description ? { description: p.description } : {}),
              priceCents: p.priceCents,
              currency: p.currency,
              inventoryCount: p.inventoryCount,
              ...(p.url ? { url: p.url } : {}),
              images: p.images,
              tags: p.tags,
              source: connection.platform,
              sourceId: p.sourceId,
              freshnessCheckedAt: now,
              isActive: true,
            },
          });
        }
        upsertCount++;
      }

      await this.prisma.storeConnection.update({
        where: { id: connectionId },
        data: {
          syncStatus: StoreSyncStatus.SUCCESS,
          lastSyncAt: now,
          syncedProducts: upsertCount,
          errorMessage: null,
        },
      });

      if (userId) {
        await this.auditService.record({
          workspaceId,
          userId,
          action: 'store.synced',
          resourceType: 'StoreConnection',
          resourceId: connectionId,
          metadata: { platform: connection.platform, syncedCount: upsertCount },
        });
      }

      return {
        synced: upsertCount,
        status: StoreSyncStatus.SUCCESS,
        message: `Successfully synchronized ${upsertCount} products from ${connection.storeName}.`,
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      this.logger.error(`Store sync failed for connection ${connectionId}: ${errorMsg}`);

      await this.prisma.storeConnection.update({
        where: { id: connectionId },
        data: {
          syncStatus: StoreSyncStatus.FAILED,
          errorMessage: errorMsg,
        },
      });

      throw new BadRequestException(`Catalog synchronization failed: ${errorMsg}`);
    }
  }

  private maskConnection(conn: {
    id: string;
    workspaceId: string;
    platform: StorePlatform;
    storeName: string;
    storeUrl: string;
    apiVersion?: string | null;
    lastSyncAt?: Date | null;
    syncStatus: StoreSyncStatus;
    errorMessage?: string | null;
    syncedProducts: number;
    createdAt: Date;
    updatedAt: Date;
  }): MaskedStoreConnection {
    return {
      id: conn.id,
      workspaceId: conn.workspaceId,
      platform: conn.platform,
      storeName: conn.storeName,
      storeUrl: conn.storeUrl,
      apiKeyMasked: '••••••••',
      apiVersion: conn.apiVersion,
      lastSyncAt: conn.lastSyncAt,
      syncStatus: conn.syncStatus,
      errorMessage: conn.errorMessage,
      syncedProducts: conn.syncedProducts,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    };
  }
}
