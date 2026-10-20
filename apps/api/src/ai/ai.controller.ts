import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import type { Request } from 'express';
import { ContentGenerationService, GroundedMarketingDraft } from './content-generation.service';
import { UsageService, QuotaStatus } from './usage.service';
import { BrandProfilesService } from './brand-profiles.service';
import { ContentTemplatesService } from './content-templates.service';
import { GenerateContentDto } from './dto/generate-content.dto';
import { CreateBrandProfileDto, UpdateBrandProfileDto } from './dto/brand-profile.dto';
import { CreateContentTemplateDto, UpdateContentTemplateDto } from './dto/content-template.dto';
import { AuthGuard, AuthenticatedUser } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../workspaces/guards/roles.guard';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceRole, BrandProfile, ContentTemplate } from '@commercepilot/database';

@ApiTags('AI Content Studio & Brand Voice')
@ApiBearerAuth()
@UseGuards(AuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId')
export class AiController {
  constructor(
    private readonly contentGenerationService: ContentGenerationService,
    private readonly usageService: UsageService,
    private readonly brandProfilesService: BrandProfilesService,
    private readonly contentTemplatesService: ContentTemplatesService,
  ) {}

  @Post('content/generate')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({
    summary: 'Generate grounded marketing content (caption, hashtags, CTA) from catalog facts',
  })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 201, description: 'Marketing copy generated and saved as draft Post' })
  @ApiResponse({ status: 403, description: 'AI token quota exceeded' })
  @ApiResponse({ status: 404, description: 'Product not found in workspace' })
  async generate(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: GenerateContentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<GroundedMarketingDraft> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.contentGenerationService.generate(workspaceId, dto, user.id, ip);
  }

  @Get('content/usage')
  @ApiOperation({ summary: 'Get current billing cycle AI token usage and quota metrics' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Current quota status and usage ledger summary' })
  async getUsage(@Param('workspaceId') workspaceId: string): Promise<QuotaStatus> {
    return this.usageService.getQuotaStatus(workspaceId);
  }

  // --- Brand Profiles ---

  @Post('brand-profiles')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Create brand voice profile for workspace' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  async createBrandProfile(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateBrandProfileDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<BrandProfile> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.brandProfilesService.create(workspaceId, dto, user.id, ip);
  }

  @Get('brand-profiles')
  @ApiOperation({ summary: 'List brand profiles for workspace' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  async listBrandProfiles(@Param('workspaceId') workspaceId: string): Promise<BrandProfile[]> {
    return this.brandProfilesService.findAll(workspaceId);
  }

  @Get('brand-profiles/:profileId')
  @ApiOperation({ summary: 'Get brand profile details' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'profileId', description: 'Brand profile ID' })
  async getBrandProfile(
    @Param('workspaceId') workspaceId: string,
    @Param('profileId') profileId: string,
  ): Promise<BrandProfile> {
    return this.brandProfilesService.findOne(workspaceId, profileId);
  }

  @Patch('brand-profiles/:profileId')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update brand voice guidelines' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'profileId', description: 'Brand profile ID' })
  async updateBrandProfile(
    @Param('workspaceId') workspaceId: string,
    @Param('profileId') profileId: string,
    @Body() dto: UpdateBrandProfileDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<BrandProfile> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.brandProfilesService.update(workspaceId, profileId, dto, user.id, ip);
  }

  @Delete('brand-profiles/:profileId')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Delete brand voice profile' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'profileId', description: 'Brand profile ID' })
  async deleteBrandProfile(
    @Param('workspaceId') workspaceId: string,
    @Param('profileId') profileId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ success: boolean; id: string }> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.brandProfilesService.delete(workspaceId, profileId, user.id, ip);
  }

  // --- Content Templates ---

  @Post('templates')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Create reusable marketing content template' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  async createTemplate(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateContentTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ContentTemplate> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.contentTemplatesService.create(workspaceId, dto, user.id, ip);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List reusable content templates' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  async listTemplates(
    @Param('workspaceId') workspaceId: string,
    @Query('channel') channel?: string,
  ): Promise<ContentTemplate[]> {
    return this.contentTemplatesService.findAll(workspaceId, channel);
  }

  @Get('templates/:templateId')
  @ApiOperation({ summary: 'Get content template details' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  async getTemplate(
    @Param('workspaceId') workspaceId: string,
    @Param('templateId') templateId: string,
  ): Promise<ContentTemplate> {
    return this.contentTemplatesService.findOne(workspaceId, templateId);
  }

  @Patch('templates/:templateId')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Update content template prompt structure' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  async updateTemplate(
    @Param('workspaceId') workspaceId: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateContentTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ContentTemplate> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.contentTemplatesService.update(workspaceId, templateId, dto, user.id, ip);
  }

  @Delete('templates/:templateId')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Delete content template' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'templateId', description: 'Template ID' })
  async deleteTemplate(
    @Param('workspaceId') workspaceId: string,
    @Param('templateId') templateId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ success: boolean; id: string }> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.contentTemplatesService.delete(workspaceId, templateId, user.id, ip);
  }
}
