import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { RecordClickDto } from './dto/record-click.dto';
import { RecordConversionDto } from './dto/record-conversion.dto';
import { CreateTrackingLinkDto } from './dto/create-tracking-link.dto';

const BOT_USER_AGENT_REGEX =
  /bot|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|bytespider|facebookexternalhit|twitterbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest\/0\.|pinterestbot|slackbot|vkshare|w3c_validator/i;

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates and sanitizes a destination URL, defending against Open Redirect & SSRF attacks.
   */
  validateDestinationUrl(urlStr: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw new BadRequestException('Invalid destination URL: must be a well-formed RFC 3986 URL.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(
        `Invalid URL protocol "${parsed.protocol}". Only http: and https: protocols are permitted.`,
      );
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      (hostname.startsWith('172.') &&
        parseInt(hostname.split('.')[1] || '0', 10) >= 16 &&
        parseInt(hostname.split('.')[1] || '0', 10) <= 31)
    ) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new BadRequestException('Redirects to private or loopback networks are forbidden.');
      }
    }

    return parsed;
  }

  async createTrackingLink(workspaceId: string, dto: CreateTrackingLinkDto) {
    this.validateDestinationUrl(dto.destinationUrl);

    if (dto.campaignId) {
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: dto.campaignId, workspaceId },
      });
      if (!campaign) {
        throw new NotFoundException(`Campaign ${dto.campaignId} not found in workspace.`);
      }
    }

    // Generate collision-resistant shortCode
    let shortCode = crypto.randomBytes(4).toString('hex');
    let attempts = 0;
    while (attempts < 5) {
      const existing = await this.prisma.trackingLink.findUnique({
        where: { shortCode },
      });
      if (!existing) break;
      shortCode = crypto.randomBytes(4).toString('hex');
      attempts++;
    }

    const link = await this.prisma.trackingLink.create({
      data: {
        workspaceId,
        destinationUrl: dto.destinationUrl,
        utmSource: dto.utmSource.toLowerCase().trim(),
        utmMedium: dto.utmMedium.toLowerCase().trim(),
        ...(dto.utmCampaign ? { utmCampaign: dto.utmCampaign.toLowerCase().trim() } : {}),
        ...(dto.utmContent ? { utmContent: dto.utmContent.trim() } : {}),
        ...(dto.utmTerm ? { utmTerm: dto.utmTerm.trim() } : {}),
        ...(dto.campaignId ? { campaignId: dto.campaignId } : {}),
        shortCode,
      },
      include: {
        campaign: {
          select: { id: true, name: true, utmCampaign: true },
        },
      },
    });

    const apiUrl =
      this.configService.get<string>('API_URL') ||
      process.env['API_URL'] ||
      'http://localhost:4000';

    return {
      ...link,
      shortUrl: `${apiUrl.replace(/\/$/, '')}/api/v1/t/${link.shortCode}`,
    };
  }

  async listTrackingLinks(workspaceId: string, campaignId?: string) {
    const links = await this.prisma.trackingLink.findMany({
      where: {
        workspaceId,
        ...(campaignId ? { campaignId } : {}),
      },
      include: {
        campaign: {
          select: { id: true, name: true, utmCampaign: true },
        },
        _count: {
          select: { clicks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const apiUrl =
      this.configService.get<string>('API_URL') ||
      process.env['API_URL'] ||
      'http://localhost:4000';

    return links.map((link) => ({
      ...link,
      shortUrl: `${apiUrl.replace(/\/$/, '')}/api/v1/t/${link.shortCode}`,
    }));
  }

  async resolveAndRecordClick(
    shortCode: string,
    clientIp?: string,
    userAgent?: string,
    referrer?: string,
  ): Promise<{ destinationUrl: string; isBot: boolean }> {
    const link = await this.prisma.trackingLink.findUnique({
      where: { shortCode },
      include: { campaign: true },
    });

    if (!link) {
      throw new NotFoundException(`Tracking link "${shortCode}" not found or expired.`);
    }

    const parsedDest = this.validateDestinationUrl(link.destinationUrl);
    const isBot = BOT_USER_AGENT_REGEX.test(userAgent || '');

    // Set standard UTM parameters while preserving existing query parameters
    parsedDest.searchParams.set('utm_source', link.utmSource);
    parsedDest.searchParams.set('utm_medium', link.utmMedium);
    if (link.utmCampaign) parsedDest.searchParams.set('utm_campaign', link.utmCampaign);
    if (link.utmContent) parsedDest.searchParams.set('utm_content', link.utmContent);
    if (link.utmTerm) parsedDest.searchParams.set('utm_term', link.utmTerm);

    if (isBot) {
      this.logger.debug(`Bot crawler ${userAgent} redirected without counting click.`);
      return { destinationUrl: parsedDest.toString(), isBot: true };
    }

    // Privacy-preserving hash of client IP
    const ipHash = clientIp
      ? crypto.createHash('sha256').update(clientIp + 'cp_salt').digest('hex').slice(0, 16)
      : undefined;

    // Persist verified click
    const click = await this.prisma.trackedClick.create({
      data: {
        workspaceId: link.workspaceId,
        ...(link.campaignId ? { campaignId: link.campaignId } : {}),
        trackingLinkId: link.id,
        targetUrl: link.destinationUrl,
        ...(referrer ? { referrer: referrer.slice(0, 500) } : {}),
        ...(userAgent ? { userAgent: userAgent.slice(0, 500) } : {}),
        ...(ipHash ? { ipHash } : {}),
      },
    });

    // Increment click counter
    await this.prisma.trackingLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    });

    // Propagate first-party click ID for conversion attribution
    parsedDest.searchParams.set('cp_click_id', click.id);

    return { destinationUrl: parsedDest.toString(), isBot: false };
  }

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
    // Idempotency check via unique [workspaceId, orderId]
    const existing = await this.prisma.conversionEvent.findUnique({
      where: {
        workspaceId_orderId: {
          workspaceId,
          orderId: dto.orderId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    if (dto.campaignId) {
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: dto.campaignId, workspaceId },
      });
      if (!campaign) {
        throw new NotFoundException(`Campaign ${dto.campaignId} not found in workspace.`);
      }
    }

    return this.prisma.conversionEvent.create({
      data: {
        workspaceId,
        orderId: dto.orderId,
        orderTotalCents: dto.orderTotalCents,
        currency: dto.currency || 'USD',
        ...(dto.attributionSource ? { attributionSource: dto.attributionSource } : {}),
        ...(dto.campaignId ? { campaignId: dto.campaignId } : {}),
        ...(dto.clickId ? { clickId: dto.clickId } : {}),
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
      include: {
        campaign: {
          select: { id: true, name: true, utmCampaign: true },
        },
      },
    });
  }
}
