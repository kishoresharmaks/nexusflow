import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignsService } from '../src/campaigns/campaigns.service';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      campaign: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new CampaignsService(mockPrisma as any, mockAudit as any);
  });

  it('creates a campaign with formatted slug utmCampaign', async () => {
    mockPrisma.campaign.create.mockResolvedValue({
      id: 'camp_1',
      workspaceId: 'ws_1',
      name: 'Spring Flash Sale 2026',
      utmCampaign: 'spring-flash-sale-2026',
    });

    const campaign = await service.createCampaign(
      'ws_1',
      {
        name: 'Spring Flash Sale 2026',
      },
      'usr_1',
    );

    expect(campaign.id).toBe('camp_1');
    expect(mockPrisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          name: 'Spring Flash Sale 2026',
          utmCampaign: 'spring-flash-sale-2026',
        }),
      }),
    );
  });

  it('builds RFC 3986 compliant UTM tagged URLs', () => {
    const result = service.buildUtmUrl({
      baseUrl: 'https://example.com/products/headphones',
      utmSource: 'Instagram',
      utmMedium: 'Stories',
      utmCampaign: 'spring-sale',
      utmContent: 'promo_video_v1',
      utmTerm: 'noise-canceling',
    });

    expect(result.taggedUrl).toContain('https://example.com/products/headphones?');
    expect(result.taggedUrl).toContain('utm_source=instagram');
    expect(result.taggedUrl).toContain('utm_medium=stories');
    expect(result.taggedUrl).toContain('utm_campaign=spring-sale');
    expect(result.taggedUrl).toContain('utm_content=promo_video_v1');
    expect(result.taggedUrl).toContain('utm_term=noise-canceling');
    expect(result.utmParameters.utm_source).toBe('instagram');
  });
});
