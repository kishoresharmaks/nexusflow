import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBrandProfileDto, UpdateBrandProfileDto } from './dto/brand-profile.dto';
import { BrandProfile, Prisma } from '@commercepilot/database';

@Injectable()
export class BrandProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private validateObjectId(id: string, label = 'ID'): void {
    if (!/^[a-f\d]{24}$/i.test(id)) {
      throw new BadRequestException(`Invalid ${label} format.`);
    }
  }

  async create(
    workspaceId: string,
    dto: CreateBrandProfileDto,
    userId: string,
    clientIp?: string,
  ): Promise<BrandProfile> {
    this.validateObjectId(workspaceId, 'workspace ID');

    const profile = await this.prisma.brandProfile.create({
      data: {
        workspaceId,
        name: dto.name,
        toneOfVoice: dto.toneOfVoice ?? null,
        targetAudience: dto.targetAudience ?? null,
        prohibitedWords: dto.prohibitedWords ?? [],
        preferredHashtags: dto.preferredHashtags ?? [],
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'BRAND_PROFILE_CREATED',
      resourceType: 'BrandProfile',
      resourceId: profile.id,
      metadata: { name: profile.name },
      ipAddress: clientIp,
    });

    return profile;
  }

  async findAll(workspaceId: string): Promise<BrandProfile[]> {
    this.validateObjectId(workspaceId, 'workspace ID');
    return this.prisma.brandProfile.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(workspaceId: string, profileId: string): Promise<BrandProfile> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(profileId, 'profile ID');

    const profile = await this.prisma.brandProfile.findFirst({
      where: { id: profileId, workspaceId },
    });

    if (!profile) {
      throw new NotFoundException('Brand profile not found in this workspace.');
    }

    return profile;
  }

  async update(
    workspaceId: string,
    profileId: string,
    dto: UpdateBrandProfileDto,
    userId: string,
    clientIp?: string,
  ): Promise<BrandProfile> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(profileId, 'profile ID');

    await this.findOne(workspaceId, profileId);

    const data: Prisma.BrandProfileUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.toneOfVoice !== undefined) data.toneOfVoice = dto.toneOfVoice ?? null;
    if (dto.targetAudience !== undefined) data.targetAudience = dto.targetAudience ?? null;
    if (dto.prohibitedWords !== undefined) data.prohibitedWords = dto.prohibitedWords;
    if (dto.preferredHashtags !== undefined) data.preferredHashtags = dto.preferredHashtags;

    const updated = await this.prisma.brandProfile.update({
      where: { id: profileId },
      data,
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'BRAND_PROFILE_UPDATED',
      resourceType: 'BrandProfile',
      resourceId: profileId,
      ipAddress: clientIp,
    });

    return updated;
  }

  async delete(
    workspaceId: string,
    profileId: string,
    userId: string,
    clientIp?: string,
  ): Promise<{ success: boolean; id: string }> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(profileId, 'profile ID');

    await this.findOne(workspaceId, profileId);

    await this.prisma.brandProfile.delete({
      where: { id: profileId },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'BRAND_PROFILE_DELETED',
      resourceType: 'BrandProfile',
      resourceId: profileId,
      ipAddress: clientIp,
    });

    return { success: true, id: profileId };
  }
}
