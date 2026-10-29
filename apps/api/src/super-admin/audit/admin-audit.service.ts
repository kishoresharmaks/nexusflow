import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminAuditLog, Prisma } from '@commercepilot/database';

export interface LogAdminActionParams {
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId?: string | null | undefined;
  reason?: string | null | undefined;
  outcome?: 'SUCCESS' | 'DENIED' | 'FAILED';
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
}

export interface ListAdminAuditLogsQuery {
  page?: number | undefined;
  limit?: number | undefined;
  action?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  actorEmail?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logAction(params: LogAdminActionParams): Promise<AdminAuditLog> {
    try {
      const record = await this.prisma.adminAuditLog.create({
        data: {
          actorId: params.actorId,
          actorEmail: params.actorEmail,
          action: params.action,
          targetType: params.targetType,
          ...(params.targetId ? { targetId: params.targetId } : {}),
          ...(params.reason ? { reason: params.reason } : {}),
          outcome: params.outcome || 'SUCCESS',
          ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
          ...(params.userAgent ? { userAgent: params.userAgent } : {}),
          ...(params.metadata ? { metadata: params.metadata as Prisma.InputJsonValue } : {}),
        },
      });

      this.logger.log(
        `[AUDIT] admin=${params.actorEmail} action=${params.action} target=${params.targetType}:${params.targetId || 'global'} outcome=${record.outcome}`,
      );

      return record;
    } catch (err) {
      this.logger.error(`Failed to record admin audit log: ${(err as Error).message}`);
      throw err;
    }
  }

  async listLogs(query: ListAdminAuditLogsQuery = {}) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.AdminAuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.actorEmail
        ? { actorEmail: { contains: query.actorEmail, mode: 'insensitive' } }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
