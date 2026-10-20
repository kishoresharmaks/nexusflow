import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiController } from '../src/ai/ai.controller';
import type { ContentGenerationService } from '../src/ai/content-generation.service';
import type { UsageService } from '../src/ai/usage.service';
import type { BrandProfilesService } from '../src/ai/brand-profiles.service';
import type { ContentTemplatesService } from '../src/ai/content-templates.service';
import type { Request } from 'express';

describe('AiController', () => {
  let controller: AiController;
  let mockGenerationService: Partial<ContentGenerationService>;
  let mockUsageService: Partial<UsageService>;
  let mockBrandProfilesService: Partial<BrandProfilesService>;
  let mockContentTemplatesService: Partial<ContentTemplatesService>;

  const workspaceId = '60b8d29f1c9d440000a11111';
  const profileId = '60b8d29f1c9d440000a22222';
  const templateId = '60b8d29f1c9d440000a33333';
  const user = {
    id: '60b8d29f1c9d440000a44444',
    email: 'creator@example.com',
    name: 'Creator User',
  };
  const mockReq = {
    headers: {},
    ip: '127.0.0.1',
  } as Request;

  beforeEach(() => {
    mockGenerationService = {
      generate: vi.fn(),
    };
    mockUsageService = {
      getQuotaStatus: vi.fn(),
    };
    mockBrandProfilesService = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    mockContentTemplatesService = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    controller = new AiController(
      mockGenerationService as ContentGenerationService,
      mockUsageService as UsageService,
      mockBrandProfilesService as BrandProfilesService,
      mockContentTemplatesService as ContentTemplatesService,
    );
  });

  describe('generate', () => {
    it('delegates grounded generation to content generation service', async () => {
      const dto = { productId: '60b8d29f1c9d440000a55555', channel: 'INSTAGRAM' as const };
      const mockResult = {
        caption: 'Test caption',
        hashtags: ['#Test'],
        callToAction: 'Shop now',
        characterCount: 22,
        groundedFacts: {
          productId: dto.productId,
          title: 'Product',
          priceFormatted: '$10.00 USD',
          stockStatus: 'In stock',
        },
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          costEstimateMicrocents: 5,
          model: 'mock',
          provider: 'mock',
        },
      };

      vi.spyOn(mockGenerationService, 'generate').mockResolvedValue(mockResult as any);

      const res = await controller.generate(workspaceId, dto, user, mockReq);
      expect(res.caption).toBe('Test caption');
      expect(mockGenerationService.generate).toHaveBeenCalledWith(
        workspaceId,
        dto,
        user.id,
        '127.0.0.1',
      );
    });
  });

  describe('getUsage', () => {
    it('delegates quota status retrieval to usage service', async () => {
      const status = {
        limitTokens: 100000,
        usedTokens: 1500,
        remainingTokens: 98500,
        percentUsed: 1.5,
        periodStart: '2026-10-01T00:00:00.000Z',
        periodEnd: '2026-10-31T23:59:59.999Z',
      };
      vi.spyOn(mockUsageService, 'getQuotaStatus').mockResolvedValue(status);

      const res = await controller.getUsage(workspaceId);
      expect(res.remainingTokens).toBe(98500);
      expect(mockUsageService.getQuotaStatus).toHaveBeenCalledWith(workspaceId);
    });
  });

  describe('brand profiles', () => {
    it('creates brand profile', async () => {
      const dto = { name: 'Eco Style', toneOfVoice: 'Friendly' };
      vi.spyOn(mockBrandProfilesService, 'create').mockResolvedValue({
        id: profileId,
        workspaceId,
        ...dto,
      } as any);

      const res = await controller.createBrandProfile(workspaceId, dto, user, mockReq);
      expect(res.id).toBe(profileId);
      expect(mockBrandProfilesService.create).toHaveBeenCalledWith(
        workspaceId,
        dto,
        user.id,
        '127.0.0.1',
      );
    });

    it('lists brand profiles', async () => {
      vi.spyOn(mockBrandProfilesService, 'findAll').mockResolvedValue([]);
      const res = await controller.listBrandProfiles(workspaceId);
      expect(res).toEqual([]);
      expect(mockBrandProfilesService.findAll).toHaveBeenCalledWith(workspaceId);
    });

    it('gets brand profile by id', async () => {
      vi.spyOn(mockBrandProfilesService, 'findOne').mockResolvedValue({
        id: profileId,
        workspaceId,
      } as any);
      const res = await controller.getBrandProfile(workspaceId, profileId);
      expect(res.id).toBe(profileId);
      expect(mockBrandProfilesService.findOne).toHaveBeenCalledWith(workspaceId, profileId);
    });

    it('updates brand profile', async () => {
      const dto = { toneOfVoice: 'Playful' };
      vi.spyOn(mockBrandProfilesService, 'update').mockResolvedValue({
        id: profileId,
        workspaceId,
      } as any);
      const res = await controller.updateBrandProfile(workspaceId, profileId, dto, user, mockReq);
      expect(mockBrandProfilesService.update).toHaveBeenCalledWith(
        workspaceId,
        profileId,
        dto,
        user.id,
        '127.0.0.1',
      );
    });

    it('deletes brand profile', async () => {
      vi.spyOn(mockBrandProfilesService, 'delete').mockResolvedValue({
        success: true,
        id: profileId,
      });
      const res = await controller.deleteBrandProfile(workspaceId, profileId, user, mockReq);
      expect(res.success).toBe(true);
      expect(mockBrandProfilesService.delete).toHaveBeenCalledWith(
        workspaceId,
        profileId,
        user.id,
        '127.0.0.1',
      );
    });
  });

  describe('content templates', () => {
    it('creates content template', async () => {
      const dto = { name: 'Summer Launch', promptTemplate: 'Template {product}' };
      vi.spyOn(mockContentTemplatesService, 'create').mockResolvedValue({
        id: templateId,
        workspaceId,
        ...dto,
      } as any);

      const res = await controller.createTemplate(workspaceId, dto, user, mockReq);
      expect(res.id).toBe(templateId);
      expect(mockContentTemplatesService.create).toHaveBeenCalledWith(
        workspaceId,
        dto,
        user.id,
        '127.0.0.1',
      );
    });

    it('lists content templates with channel filter', async () => {
      vi.spyOn(mockContentTemplatesService, 'findAll').mockResolvedValue([]);
      const res = await controller.listTemplates(workspaceId, 'INSTAGRAM');
      expect(res).toEqual([]);
      expect(mockContentTemplatesService.findAll).toHaveBeenCalledWith(workspaceId, 'INSTAGRAM');
    });

    it('gets content template by id', async () => {
      vi.spyOn(mockContentTemplatesService, 'findOne').mockResolvedValue({
        id: templateId,
        workspaceId,
      } as any);
      const res = await controller.getTemplate(workspaceId, templateId);
      expect(res.id).toBe(templateId);
    });

    it('updates content template', async () => {
      const dto = { promptTemplate: 'New prompt' };
      vi.spyOn(mockContentTemplatesService, 'update').mockResolvedValue({
        id: templateId,
        workspaceId,
      } as any);
      const res = await controller.updateTemplate(workspaceId, templateId, dto, user, mockReq);
      expect(mockContentTemplatesService.update).toHaveBeenCalledWith(
        workspaceId,
        templateId,
        dto,
        user.id,
        '127.0.0.1',
      );
    });

    it('deletes content template', async () => {
      vi.spyOn(mockContentTemplatesService, 'delete').mockResolvedValue({
        success: true,
        id: templateId,
      });
      const res = await controller.deleteTemplate(workspaceId, templateId, user, mockReq);
      expect(res.success).toBe(true);
    });
  });
});
