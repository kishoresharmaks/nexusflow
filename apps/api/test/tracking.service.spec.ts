import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TrackingService } from '../src/tracking/tracking.service';

describe('TrackingService - Public Tracking & Safe Redirects', () => {
  let service: TrackingService;
  let mockPrisma: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      trackingLink: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      trackedClick: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      conversionEvent: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      campaign: {
        findFirst: vi.fn(),
      },
    };

    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'API_URL') return 'http://localhost:4000';
        return undefined;
      }),
    };

    service = new TrackingService(mockPrisma as any, mockConfig as any);
  });

  describe('createTrackingLink & Open Redirect Defense', () => {
    it('creates a tracking link with shortCode and returns public shortUrl', async () => {
      mockPrisma.trackingLink.findUnique.mockResolvedValue(null); // No collision
      mockPrisma.trackingLink.create.mockImplementation((args: any) => ({
        id: 'link_123',
        ...args.data,
      }));

      const result = await service.createTrackingLink('ws_1', {
        destinationUrl: 'https://democheck-h0uyfpis.myshopify.com/products/snowboard',
        utmSource: 'instagram',
        utmMedium: 'stories',
        utmCampaign: 'winter-drop',
      });

      expect(result.id).toBe('link_123');
      expect(result.shortCode).toHaveLength(8);
      expect(result.shortUrl).toBe(`http://localhost:4000/api/v1/t/${result.shortCode}`);
      expect(result.destinationUrl).toBe('https://democheck-h0uyfpis.myshopify.com/products/snowboard');
    });

    it('rejects unsafe destination URLs with dangerous protocols (javascript: / data: / file:)', () => {
      expect(() =>
        service.validateDestinationUrl('javascript:alert(1)'),
      ).toThrow(BadRequestException);

      expect(() =>
        service.validateDestinationUrl('data:text/html,<script>alert(1)</script>'),
      ).toThrow(BadRequestException);

      expect(() =>
        service.validateDestinationUrl('file:///etc/passwd'),
      ).toThrow(BadRequestException);
    });

    it('rejects malformed destination URLs', () => {
      expect(() =>
        service.validateDestinationUrl('not-a-valid-url'),
      ).toThrow(BadRequestException);
    });
  });

  describe('resolveAndRecordClick & Bot Mitigation', () => {
    it('throws NotFoundException for non-existent tracking code', async () => {
      mockPrisma.trackingLink.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveAndRecordClick('unknown_code', '192.168.1.1', 'Mozilla/5.0'),
      ).rejects.toThrow(NotFoundException);
    });

    it('filters search crawlers and social bot User-Agents without counting clicks or polluting metrics', async () => {
      mockPrisma.trackingLink.findUnique.mockResolvedValue({
        id: 'link_123',
        workspaceId: 'ws_1',
        destinationUrl: 'https://store.example.com/products/boots',
        utmSource: 'twitter',
        utmMedium: 'post',
        utmCampaign: 'winter-sale',
        clickCount: 5,
      });

      const botAgents = [
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Twitterbot/1.0',
        'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      ];

      for (const botAgent of botAgents) {
        const result = await service.resolveAndRecordClick('code_abc', '66.249.66.1', botAgent);

        expect(result.isBot).toBe(true);
        expect(result.destinationUrl).toContain('https://store.example.com/products/boots?');
        expect(result.destinationUrl).toContain('utm_source=twitter');
        expect(result.destinationUrl).toContain('utm_campaign=winter-sale');
        // cp_click_id MUST NOT be attached for bot previews
        expect(result.destinationUrl).not.toContain('cp_click_id');
      }

      // Prisma should not have created any click records or incremented count
      expect(mockPrisma.trackedClick.create).not.toHaveBeenCalled();
      expect(mockPrisma.trackingLink.update).not.toHaveBeenCalled();
    });

    it('records verified human clicks with anonymized ipHash and propagates first-party cp_click_id', async () => {
      mockPrisma.trackingLink.findUnique.mockResolvedValue({
        id: 'link_999',
        workspaceId: 'ws_1',
        campaignId: 'camp_777',
        destinationUrl: 'https://democheck-h0uyfpis.myshopify.com/products/snowboard?currency=INR',
        utmSource: 'instagram',
        utmMedium: 'stories',
        utmCampaign: 'winter-sale',
        clickCount: 10,
      });

      mockPrisma.trackedClick.create.mockResolvedValue({
        id: 'click_507f1f77bcf86cd799439011',
        workspaceId: 'ws_1',
        campaignId: 'camp_777',
        trackingLinkId: 'link_999',
      });

      mockPrisma.trackingLink.update.mockResolvedValue({});

      const humanUserAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
      const referrer = 'https://instagram.com/';

      const result = await service.resolveAndRecordClick(
        'code_human',
        '203.0.113.195',
        humanUserAgent,
        referrer,
      );

      expect(result.isBot).toBe(false);

      // Verify TrackedClick persisted
      expect(mockPrisma.trackedClick.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: 'ws_1',
            campaignId: 'camp_777',
            trackingLinkId: 'link_999',
            targetUrl: 'https://democheck-h0uyfpis.myshopify.com/products/snowboard?currency=INR',
            referrer,
            userAgent: humanUserAgent,
          }),
        }),
      );

      // Verify TrackingLink click counter incremented
      expect(mockPrisma.trackingLink.update).toHaveBeenCalledWith({
        where: { id: 'link_999' },
        data: { clickCount: { increment: 1 } },
      });

      // Verify destination URL preserves existing query params and appends cp_click_id
      const finalUrl = new URL(result.destinationUrl);
      expect(finalUrl.searchParams.get('currency')).toBe('INR');
      expect(finalUrl.searchParams.get('utm_source')).toBe('instagram');
      expect(finalUrl.searchParams.get('utm_medium')).toBe('stories');
      expect(finalUrl.searchParams.get('utm_campaign')).toBe('winter-sale');
      expect(finalUrl.searchParams.get('cp_click_id')).toBe('click_507f1f77bcf86cd799439011');
    });
  });
});
