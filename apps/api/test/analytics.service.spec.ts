import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from '../src/analytics/analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      post: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      trackedClick: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      conversionEvent: {
        findMany: vi.fn(),
      },
      analyticsSnapshot: {
        findMany: vi.fn(),
      },
    };

    service = new AnalyticsService(mockPrisma as any);
  });

  it('calculates comprehensive overview metrics including CTR, CVR, and AOV', async () => {
    mockPrisma.post.count.mockResolvedValue(5);
    mockPrisma.trackedClick.count.mockResolvedValue(100);
    mockPrisma.conversionEvent.findMany.mockResolvedValue([
      { orderTotalCents: 5000 },
      { orderTotalCents: 7500 },
    ]);
    mockPrisma.analyticsSnapshot.findMany.mockResolvedValue([
      { impressions: 2000, engagements: 250 },
    ]);

    const overview = await service.getOverview('ws_1', 30);

    expect(overview.totalPosts).toBe(5);
    expect(overview.totalClicks).toBe(100);
    expect(overview.totalConversions).toBe(2);
    expect(overview.totalRevenueCents).toBe(12500);
    expect(overview.clickThroughRate).toBe(5); // 100 / 2000 * 100 = 5%
    expect(overview.conversionRate).toBe(2); // 2 / 100 * 100 = 2%
    expect(overview.averageOrderValueCents).toBe(6250); // 12500 / 2
  });

  it('returns ranked best posting times with actionable recommendations', async () => {
    mockPrisma.post.findMany.mockResolvedValue([]);

    const recommendations = await service.getBestTimes('ws_1');

    expect(recommendations.length).toBeGreaterThanOrEqual(3);
    expect(recommendations[0]?.dayOfWeek).toBe('Tuesday');
    expect(recommendations[0]?.confidenceScore).toBeGreaterThanOrEqual(70);
  });
});
