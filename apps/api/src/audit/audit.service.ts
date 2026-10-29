import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '@commercepilot/database';

export interface RecordAuditParams {
  workspaceId: string;
  userId?: string | undefined;
  action: string;
  resourceType: string;
  resourceId?: string | undefined;
  ipAddress?: string | undefined;
  metadata?: Prisma.InputJsonValue | undefined;
}

export interface PaginatedAuditLogs {
  items: Array<{
    id: string;
    workspaceId: string;
    userId: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress: string | null;
    metadata: unknown;
    createdAt: Date;
    user?: {
      id: string;
      name: string;
      email: string;
    } | null;
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordAuditParams): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          workspaceId: params.workspaceId,
          ...(params.userId ? { userId: params.userId } : {}),
          action: params.action,
          resourceType: params.resourceType,
          ...(params.resourceId ? { resourceId: params.resourceId } : {}),
          ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
          ...(params.metadata ? { metadata: params.metadata } : {}),
        },
      });
    } catch (err: unknown) {
      // Audit failure must never crash the primary business operation, but should be logged securely
      const message = err instanceof Error ? err.message : 'Unknown audit error';
      this.logger.error(`Failed to record audit event [${params.action}]: ${message}`);
    }
  }

  async getWorkspaceAuditLogs(
    workspaceId: string,
    page = 1,
    limit = 50,
    filters?: { action?: string; resourceType?: string },
  ): Promise<PaginatedAuditLogs> {
    const skip = (page - 1) * limit;

    const where: Prisma.AuditEventWhereInput = {
      workspaceId,
      ...(filters?.action ? { action: filters.action } : {}),
      ...(filters?.resourceType ? { resourceType: filters.resourceType } : {}),
    };

    const [total, rawItems] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    const items = rawItems.map((item) => ({
      ...item,
      metadata: this.redactAuditMetadata(item.metadata),
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private redactAuditMetadata(metadata: unknown): unknown {
    if (!metadata || typeof metadata !== 'object') return metadata;
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'accessToken',
      'refreshToken',
      'tokenHash',
      'rawToken',
      'authorizationCode',
      'cookie',
      'signature',
      'apiKey',
    ];
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(metadata as Record<string, unknown>)) {
      if (sensitiveKeys.some((sk) => k.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[k] = '[REDACTED]';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        sanitized[k] = this.redactAuditMetadata(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }
}
