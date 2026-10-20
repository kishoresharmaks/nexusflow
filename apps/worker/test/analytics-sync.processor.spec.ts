import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processAnalyticsSync } from '../src/processors/analytics-sync.processor';
import { prisma } from '@commercepilot/database';

vi.mock('@commercepilot/database', () => {
  return {
    prisma: {
      workspace: {
        findMany: vi.fn(),
      },
      trackedClick: {
        count: vi.fn(),
      },
      conversionEvent: {
        findMany: vi.fn(),
      },
      analyticsSnapshot: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

describe('AnalyticsSyncProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates clicks and conversions into a new AnalyticsSnapshot', async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([{ id: 'ws_1' }] as any);
    vi.mocked(prisma.trackedClick.count).mockResolvedValue(15);
    vi.mocked(prisma.conversionEvent.findMany).mockResolvedValue([
      { orderTotalCents: 4500 },
      { orderTotalCents: 3500 },
    ] as any);
    vi.mocked(prisma.analyticsSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.analyticsSnapshot.create).mockResolvedValue({ id: 'snap_1' } as any);

    const result = await processAnalyticsSync({ workspaceId: 'ws_1' });

    expect(result.workspacesProcessed).toBe(1);
    expect(result.snapshotsCreatedOrUpdated).toBe(1);
    expect(prisma.analyticsSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          clicks: 15,
          conversions: 2,
          revenueCents: 8000,
        }),
      }),
    );
  });
});
