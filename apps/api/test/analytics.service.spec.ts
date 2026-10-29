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
      campaign: {
        findMany: vi.fn(),
      },
      product: {
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

  it('calculates growth from real snapshot impressions without synthetic multipliers', async () => {
    mockPrisma.post.count.mockResolvedValue(10);
    mockPrisma.trackedClick.count
      .mockResolvedValueOnce(200) // current clicks
      .mockResolvedValueOnce(100); // prev clicks
    mockPrisma.conversionEvent.findMany
      .mockResolvedValueOnce([{ orderTotalCents: 10000 }]) // current
      .mockResolvedValueOnce([{ orderTotalCents: 5000 }]); // prev
    mockPrisma.analyticsSnapshot.findMany
      .mockResolvedValueOnce([{ impressions: 5000, engagements: 500 }]) // current
      .mockResolvedValueOnce([{ impressions: 2500, engagements: 250 }]); // prev

    const overview = await service.getOverview('ws_1', 30);

    // Impressions growth: (5000 - 2500) / 2500 * 100 = 100% (honest calculation from actual snapshots)
    expect(overview.growth.impressions).toBe(100);
    expect(overview.growth.clicks).toBe(100);
    expect(overview.growth.revenue).toBe(100);
  });

  it('aggregates campaign performance matrix with CVR and AOV', async () => {
    mockPrisma.campaign.findMany.mockResolvedValue([
      {
        id: 'camp_1',
        name: 'Summer Splash',
        utmCampaign: 'summer_2026',
        _count: { posts: 4 },
        trackedClicks: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }],
        conversions: [{ id: 'cv1', orderTotalCents: 12000 }, { id: 'cv2', orderTotalCents: 8000 }],
      },
      {
        id: 'camp_2',
        name: 'Flash Sale',
        utmCampaign: 'flash_sale',
        _count: { posts: 1 },
        trackedClicks: [{ id: 'c5' }],
        conversions: [],
      },
    ]);

    const campaigns = await service.getCampaigns('ws_1', 30);

    expect(campaigns.length).toBe(2);
    expect(campaigns[0]?.name).toBe('Summer Splash');
    expect(campaigns[0]?.clicks).toBe(4);
    expect(campaigns[0]?.conversions).toBe(2);
    expect(campaigns[0]?.revenueCents).toBe(20000);
    expect(campaigns[0]?.conversionRate).toBe(50); // 2/4 = 50%
    expect(campaigns[0]?.averageOrderValueCents).toBe(10000);
    expect(campaigns[1]?.name).toBe('Flash Sale');
    expect(campaigns[1]?.conversionRate).toBe(0);
  });

  it('aggregates channel distribution with share percentage and conversion rate', async () => {
    mockPrisma.trackedClick.findMany.mockResolvedValue([
      {
        id: 'c1',
        referrer: 'https://l.instagram.com/',
        trackingLink: { utmSource: 'instagram', utmMedium: 'social' },
      },
      {
        id: 'c2',
        referrer: 'https://www.linkedin.com/',
        trackingLink: { utmSource: 'linkedin', utmMedium: 'social' },
      },
      {
        id: 'c3',
        referrer: null,
        trackingLink: null,
      },
    ]);

    mockPrisma.conversionEvent.findMany.mockResolvedValue([
      {
        id: 'cv1',
        orderTotalCents: 15000,
        attributionSource: 'instagram',
        click: { trackingLink: { utmSource: 'instagram' }, referrer: null },
      },
    ]);

    const channels = await service.getChannels('ws_1', 30);

    const instagram = channels.find((ch) => ch.channel === 'Instagram');
    expect(instagram).toBeDefined();
    expect(instagram?.clicks).toBe(1);
    expect(instagram?.conversions).toBe(1);
    expect(instagram?.revenueCents).toBe(15000);
    expect(instagram?.conversionRate).toBe(100);
    expect(instagram?.sharePercentage).toBeCloseTo(33.3, 1);
  });

  it('returns top catalog products with attributed clicks and revenue', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 'prod_1',
        title: 'Linen Summer Shirt',
        sku: 'SHIRT-LINEN-01',
        priceCents: 4500,
        currency: 'USD',
        images: ['https://cdn.example.com/shirt.jpg'],
        url: 'https://mystore.com/products/linen-shirt',
        posts: [{ id: 'p1', campaignId: 'camp_1' }],
      },
    ]);

    mockPrisma.trackedClick.findMany.mockResolvedValue([
      { id: 'c1', campaignId: 'camp_1', targetUrl: 'https://mystore.com/products/linen-shirt' },
    ]);

    mockPrisma.conversionEvent.findMany.mockResolvedValue([
      { id: 'cv1', campaignId: 'camp_1', orderTotalCents: 9000 },
    ]);

    const products = await service.getProducts('ws_1', 30);

    expect(products.length).toBe(1);
    expect(products[0]?.title).toBe('Linen Summer Shirt');
    expect(products[0]?.clicks).toBe(1);
    expect(products[0]?.conversions).toBe(1);
    expect(products[0]?.revenueCents).toBe(9000);
  });

  it('returns recent conversions stream with order metadata and campaign names', async () => {
    mockPrisma.conversionEvent.findMany.mockResolvedValue([
      {
        id: 'cv_1',
        orderId: 'ORD-99881',
        orderTotalCents: 7500,
        currency: 'USD',
        attributionSource: 'instagram',
        occurredAt: new Date('2026-10-21T12:00:00Z'),
        campaign: { id: 'camp_1', name: 'Autumn Apparel' },
        click: {
          targetUrl: 'https://mystore.com/autumn',
          referrer: 'https://l.instagram.com',
          trackingLink: { utmSource: 'instagram', destinationUrl: 'https://mystore.com/autumn' },
        },
      },
    ]);

    const conversions = await service.getRecentConversions('ws_1', 30, 10);

    expect(conversions.length).toBe(1);
    expect(conversions[0]?.orderId).toBe('ORD-99881');
    expect(conversions[0]?.campaignName).toBe('Autumn Apparel');
    expect(conversions[0]?.orderTotalCents).toBe(7500);
  });

  it('returns ranked best posting times with actionable recommendations', async () => {
    mockPrisma.post.findMany.mockResolvedValue([]);

    const recommendations = await service.getBestTimes('ws_1');

    expect(recommendations.length).toBeGreaterThanOrEqual(3);
    expect(recommendations[0]?.dayOfWeek).toBe('Tuesday');
    expect(recommendations[0]?.confidenceScore).toBeGreaterThanOrEqual(70);
  });
});
