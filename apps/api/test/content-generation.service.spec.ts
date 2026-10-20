import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentGenerationService } from '../src/ai/content-generation.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../src/database/prisma.service';
import type { AuditService } from '../src/audit/audit.service';
import { AiProviderFactory } from '../src/ai/ai-provider.factory';
import type { UsageService } from '../src/ai/usage.service';
import { MockAiProvider } from '../src/ai/providers/mock-ai-provider';
import { PostStatus } from '@commercepilot/database';

describe('ContentGenerationService', () => {
  let service: ContentGenerationService;
  let mockPrisma: any;
  let mockAuditService: Partial<AuditService>;
  let mockAiFactory: Partial<AiProviderFactory>;
  let mockUsageService: Partial<UsageService>;

  const workspaceId = '60b8d29f1c9d440000a11111';
  const productId = '60b8d29f1c9d440000a22222';
  const brandProfileId = '60b8d29f1c9d440000a33333';
  const userId = '60b8d29f1c9d440000a44444';

  beforeEach(() => {
    mockPrisma = {
      product: {
        findFirst: vi.fn(),
      },
      brandProfile: {
        findFirst: vi.fn(),
      },
      contentTemplate: {
        findFirst: vi.fn(),
      },
      post: {
        create: vi.fn().mockImplementation(async ({ data }: any) => ({
          id: 'post-new-123',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    };

    mockAuditService = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    const mockProvider = new MockAiProvider();
    mockAiFactory = {
      getTextProvider: vi.fn().mockReturnValue(mockProvider),
    };

    mockUsageService = {
      assertQuotaAvailable: vi.fn().mockResolvedValue(undefined),
      recordUsage: vi.fn().mockResolvedValue(undefined),
    };

    service = new ContentGenerationService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as AuditService,
      mockAiFactory as AiProviderFactory,
      mockUsageService as UsageService,
    );
  });

  describe('Grounded marketing generation', () => {
    it('generates marketing copy grounded in product facts and saves draft post', async () => {
      const freshDate = new Date();
      mockPrisma.product.findFirst.mockResolvedValue({
        id: productId,
        workspaceId,
        sku: 'SHIRT-01',
        title: 'Linen Classic Shirt',
        description: 'Breathable organic linen shirt',
        priceCents: 4999,
        currency: 'USD',
        inventoryCount: 15,
        url: 'https://example.com/shirt',
        images: ['https://example.com/shirt.jpg'],
        freshnessCheckedAt: freshDate,
        updatedAt: freshDate,
      });

      const result = await service.generate(
        workspaceId,
        {
          productId,
          channel: 'INSTAGRAM',
          createDraftPost: true,
        },
        userId,
      );

      expect(result.caption).toContain('Linen Classic Shirt');
      expect(result.caption).toContain('$49.99 USD');
      expect(result.hashtags.length).toBeGreaterThan(0);
      expect(result.callToAction).toBeDefined();
      expect(result.staleWarning).toBeUndefined(); // Fresh product

      // Verify draft post was persisted with PostStatus.DRAFT
      expect(result.draftPost).toBeDefined();
      expect(result.draftPost?.status).toBe(PostStatus.DRAFT);
      expect(result.draftPost?.productId).toBe(productId);

      // Verify token usage metered
      expect(mockUsageService.recordUsage).toHaveBeenCalledWith(
        workspaceId,
        expect.objectContaining({
          feature: 'CONTENT_GENERATION',
        }),
      );

      // Verify audit trail
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AI_CONTENT_GENERATED' }),
      );
    });

    it('emits stale product warning when product data is older than 48 hours', async () => {
      const staleDate = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72 hours ago
      mockPrisma.product.findFirst.mockResolvedValue({
        id: productId,
        workspaceId,
        sku: 'OLD-01',
        title: 'Vintage Leather Boots',
        priceCents: 12000,
        currency: 'USD',
        inventoryCount: 4,
        freshnessCheckedAt: staleDate,
        updatedAt: staleDate,
      });

      const result = await service.generate(
        workspaceId,
        { productId, channel: 'INSTAGRAM' },
        userId,
      );

      expect(result.staleWarning).toBeDefined();
      expect(result.staleWarning).toContain('>48 hours ago');
    });

    it('scrubs prohibited words defined in brand voice profile', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: productId,
        workspaceId,
        title: 'Luxury Watch',
        priceCents: 25000,
        currency: 'USD',
        inventoryCount: 5,
        freshnessCheckedAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.brandProfile.findFirst.mockResolvedValue({
        id: brandProfileId,
        workspaceId,
        name: 'Luxury Voice',
        toneOfVoice: 'Sophisticated and elegant',
        prohibitedWords: ['miracle', 'discount'],
        preferredHashtags: ['#LuxuryLife', '#TimelessStyle'],
      });

      // Mock provider returning prohibited word
      const customProvider = {
        providerName: 'mock',
        generateText: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            caption: 'A miracle timepiece with unmatched precision.',
            callToAction: 'Shop now for exclusive discount!',
            hashtags: ['#Watches'],
          }),
          promptTokens: 100,
          completionTokens: 50,
          costEstimateMicrocents: 20,
          model: 'mock',
          provider: 'mock',
        }),
      };
      mockAiFactory.getTextProvider = vi.fn().mockReturnValue(customProvider as any);

      const result = await service.generate(workspaceId, { productId, brandProfileId }, userId);

      // Prohibited words 'miracle' and 'discount' must be cleansed
      expect(result.caption).not.toContain('miracle');
      expect(result.callToAction).not.toContain('discount');
      // Preferred hashtags must be merged
      expect(result.hashtags).toContain('#LuxuryLife');
      expect(result.hashtags).toContain('#TimelessStyle');
    });

    it('throws ForbiddenException when workspace quota is exhausted', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: productId,
        workspaceId,
        title: 'Any Product',
        priceCents: 1000,
        currency: 'USD',
        inventoryCount: 1,
      });

      vi.spyOn(mockUsageService, 'assertQuotaAvailable').mockRejectedValue(
        new ForbiddenException('AI token quota exceeded'),
      );

      await expect(service.generate(workspaceId, { productId }, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when product does not exist in workspace', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(service.generate(workspaceId, { productId }, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
