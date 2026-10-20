import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RecordClickDto } from './dto/record-click.dto';
import { RecordConversionDto } from './dto/record-conversion.dto';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async recordClick(workspaceId: string, dto: RecordClickDto) {
    if (dto.campaignId) {
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: dto.campaignId, workspaceId },
      });
      if (!campaign) {
        throw new NotFoundException(`Campaign ${dto.campaignId} not found in workspace.`);
      }
    }

    return this.prisma.trackedClick.create({
      data: {
        workspaceId,
        ...(dto.campaignId ? { campaignId: dto.campaignId } : {}),
        targetUrl: dto.targetUrl,
        ...(dto.referrer ? { referrer: dto.referrer } : {}),
        ...(dto.country ? { country: dto.country } : {}),
      },
    });
  }

  async recordConversion(workspaceId: string, dto: RecordConversionDto) {
    return this.prisma.conversionEvent.create({
      data: {
        workspaceId,
        orderId: dto.orderId,
        orderTotalCents: dto.orderTotalCents,
        currency: dto.currency || 'USD',
        ...(dto.attributionSource ? { attributionSource: dto.attributionSource } : {}),
      },
    });
  }

  async listClicks(workspaceId: string, limit: number = 50) {
    return this.prisma.trackedClick.findMany({
      where: { workspaceId },
      take: Math.min(limit, 100),
      orderBy: { clickedAt: 'desc' },
      include: {
        campaign: {
          select: { id: true, name: true, utmCampaign: true },
        },
      },
    });
  }

  async listConversions(workspaceId: string, limit: number = 50) {
    return this.prisma.conversionEvent.findMany({
      where: { workspaceId },
      take: Math.min(limit, 100),
      orderBy: { occurredAt: 'desc' },
    });
  }
}
