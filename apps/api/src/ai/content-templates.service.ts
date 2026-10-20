import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateContentTemplateDto, UpdateContentTemplateDto } from './dto/content-template.dto';
import { ContentTemplate, Prisma } from '@commercepilot/database';

@Injectable()
export class ContentTemplatesService {
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
    dto: CreateContentTemplateDto,
    userId: string,
    clientIp?: string,
  ): Promise<ContentTemplate> {
    this.validateObjectId(workspaceId, 'workspace ID');

    const template = await this.prisma.contentTemplate.create({
      data: {
        workspaceId,
        name: dto.name,
        promptTemplate: dto.promptTemplate,
        channel: dto.channel ?? null,
        category: dto.category ?? null,
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'CONTENT_TEMPLATE_CREATED',
      resourceType: 'ContentTemplate',
      resourceId: template.id,
      metadata: { name: template.name, channel: template.channel },
      ipAddress: clientIp,
    });

    return template;
  }

  async findAll(workspaceId: string, channel?: string): Promise<ContentTemplate[]> {
    this.validateObjectId(workspaceId, 'workspace ID');

    const where: Prisma.ContentTemplateWhereInput = { workspaceId };
    if (channel) where.channel = channel;

    return this.prisma.contentTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(workspaceId: string, templateId: string): Promise<ContentTemplate> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(templateId, 'template ID');

    const template = await this.prisma.contentTemplate.findFirst({
      where: { id: templateId, workspaceId },
    });

    if (!template) {
      throw new NotFoundException('Content template not found in this workspace.');
    }

    return template;
  }

  async update(
    workspaceId: string,
    templateId: string,
    dto: UpdateContentTemplateDto,
    userId: string,
    clientIp?: string,
  ): Promise<ContentTemplate> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(templateId, 'template ID');

    await this.findOne(workspaceId, templateId);

    const data: Prisma.ContentTemplateUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.promptTemplate !== undefined) data.promptTemplate = dto.promptTemplate;
    if (dto.channel !== undefined) data.channel = dto.channel ?? null;
    if (dto.category !== undefined) data.category = dto.category ?? null;

    const updated = await this.prisma.contentTemplate.update({
      where: { id: templateId },
      data,
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'CONTENT_TEMPLATE_UPDATED',
      resourceType: 'ContentTemplate',
      resourceId: templateId,
      ipAddress: clientIp,
    });

    return updated;
  }

  async delete(
    workspaceId: string,
    templateId: string,
    userId: string,
    clientIp?: string,
  ): Promise<{ success: boolean; id: string }> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(templateId, 'template ID');

    await this.findOne(workspaceId, templateId);

    await this.prisma.contentTemplate.delete({
      where: { id: templateId },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'CONTENT_TEMPLATE_DELETED',
      resourceType: 'ContentTemplate',
      resourceId: templateId,
      ipAddress: clientIp,
    });

    return { success: true, id: templateId };
  }
}
