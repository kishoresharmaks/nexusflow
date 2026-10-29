import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { GenerateUtmUrlDto } from './dto/generate-utm-url.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createCampaign(workspaceId: string, dto: CreateCampaignDto, userId?: string) {
    const campaign = await this.prisma.campaign.create({
      data: {
        workspaceId,
        name: dto.name,
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
        utmCampaign: dto.utmCampaign || dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      },
    });

    if (userId) {
      await this.auditService.record({
        workspaceId,
        userId,
        action: 'campaign.created',
        resourceType: 'Campaign',
        resourceId: campaign.id,
        metadata: { name: campaign.name, utmCampaign: campaign.utmCampaign },
      });
    }

    return campaign;
  }

  async listCampaigns(workspaceId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: {
            posts: true,
            trackedClicks: true,
            conversions: true,
          },
        },
        conversions: {
          select: {
            orderTotalCents: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((camp) => {
      const revenueCents = camp.conversions.reduce((sum, c) => sum + c.orderTotalCents, 0);
      const clicks = camp._count.trackedClicks;
      const conversions = camp._count.conversions;
      const conversionRate = clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0;

      const { conversions: _rawConversions, ...campData } = camp;
      return {
        ...campData,
        metrics: {
          clicks,
          conversions,
          revenueCents,
          conversionRate,
        },
      };
    });
  }

  async getCampaign(workspaceId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      include: {
        posts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        conversions: {
          take: 20,
          orderBy: { occurredAt: 'desc' },
        },
        trackedClicks: {
          take: 20,
          orderBy: { clickedAt: 'desc' },
        },
        _count: {
          select: {
            posts: true,
            trackedClicks: true,
            conversions: true,
            trackingLinks: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found in workspace.`);
    }

    const revenueCents = campaign.conversions.reduce((sum, c) => sum + c.orderTotalCents, 0);
    const clicks = campaign._count.trackedClicks;
    const conversions = campaign._count.conversions;
    const conversionRate = clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0;
    const averageOrderValueCents = conversions > 0 ? Math.round(revenueCents / conversions) : 0;

    return {
      ...campaign,
      metrics: {
        clicks,
        conversions,
        revenueCents,
        conversionRate,
        averageOrderValueCents,
      },
    };
  }

  async updateCampaign(
    workspaceId: string,
    campaignId: string,
    dto: UpdateCampaignDto,
    userId?: string,
  ) {
    await this.getCampaign(workspaceId, campaignId);

    const updated = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.utmCampaign !== undefined ? { utmCampaign: dto.utmCampaign } : {}),
      },
    });

    if (userId) {
      await this.auditService.record({
        workspaceId,
        userId,
        action: 'campaign.updated',
        resourceType: 'Campaign',
        resourceId: campaignId,
        metadata: { name: updated.name },
      });
    }

    return updated;
  }

  async deleteCampaign(workspaceId: string, campaignId: string, userId?: string) {
    await this.getCampaign(workspaceId, campaignId);

    await this.prisma.campaign.delete({
      where: { id: campaignId },
    });

    if (userId) {
      await this.auditService.record({
        workspaceId,
        userId,
        action: 'campaign.deleted',
        resourceType: 'Campaign',
        resourceId: campaignId,
      });
    }

    return { success: true };
  }

  buildUtmUrl(dto: GenerateUtmUrlDto): {
    taggedUrl: string;
    utmParameters: Record<string, string>;
  } {
    const url = new URL(dto.baseUrl);

    url.searchParams.set('utm_source', dto.utmSource.toLowerCase().trim());
    url.searchParams.set('utm_medium', dto.utmMedium.toLowerCase().trim());

    if (dto.utmCampaign) {
      url.searchParams.set('utm_campaign', dto.utmCampaign.toLowerCase().trim());
    }
    if (dto.utmContent) {
      url.searchParams.set('utm_content', dto.utmContent.trim());
    }
    if (dto.utmTerm) {
      url.searchParams.set('utm_term', dto.utmTerm.trim());
    }

    const utmParameters: Record<string, string> = {
      utm_source: url.searchParams.get('utm_source') ?? '',
      utm_medium: url.searchParams.get('utm_medium') ?? '',
      ...(url.searchParams.has('utm_campaign')
        ? { utm_campaign: url.searchParams.get('utm_campaign')! }
        : {}),
      ...(url.searchParams.has('utm_content')
        ? { utm_content: url.searchParams.get('utm_content')! }
        : {}),
      ...(url.searchParams.has('utm_term') ? { utm_term: url.searchParams.get('utm_term')! } : {}),
    };

    return {
      taggedUrl: url.toString(),
      utmParameters,
    };
  }
}
