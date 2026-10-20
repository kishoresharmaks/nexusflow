import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditController } from '../src/audit/audit.controller';
import { AuditService } from '../src/audit/audit.service';
import type { PrismaService } from '../src/database/prisma.service';

describe('AuditController and AuditService', () => {
  let controller: AuditController;
  let service: AuditService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  const validWorkspaceId = '507f1f77bcf86cd799439011';
  const mockAuditEvents = [
    {
      id: '507f1f77bcf86cd799439021',
      workspaceId: validWorkspaceId,
      userId: '507f1f77bcf86cd799439099',
      action: 'POST_CREATED',
      resourceType: 'Post',
      resourceId: '507f1f77bcf86cd799439055',
      ipAddress: '127.0.0.1',
      metadata: { status: 'DRAFT' },
      createdAt: new Date('2026-10-20T08:00:00Z'),
      user: {
        id: '507f1f77bcf86cd799439099',
        name: 'Jane Merchant',
        email: 'merchant@example.com',
      },
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      auditEvent: {
        create: vi.fn().mockResolvedValue({ id: 'aud_1' }),
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue(mockAuditEvents),
      },
    };

    service = new AuditService(mockPrisma as unknown as PrismaService);
    controller = new AuditController(service);
  });

  it('records an audit event without throwing on success', async () => {
    await expect(
      service.record({
        workspaceId: validWorkspaceId,
        action: 'PRODUCT_CREATED',
        resourceType: 'Product',
      }),
    ).resolves.not.toThrow();
    expect(mockPrisma.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('returns paginated audit logs via getAuditLogs', async () => {
    const result = await controller.getAuditLogs(validWorkspaceId, 1, 50);

    expect(result).toBeDefined();
    expect(result.items.length).toBe(1);
    expect(result.items[0]?.action).toBe('POST_CREATED');
    expect(result.meta.total).toBe(1);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(50);
  });

  it('clamps invalid or excessive page and limit queries safely', async () => {
    await controller.getAuditLogs(validWorkspaceId, -5, 500);

    expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100, // clamped to max 100
      }),
    );
  });
});
