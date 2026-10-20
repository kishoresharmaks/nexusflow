import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../workspaces/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { GenerateUtmUrlDto } from './dto/generate-utm-url.dto';
import type { User } from '@commercepilot/database';

@Controller('workspaces/:workspaceId/campaigns')
@UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  async createCampaign(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateCampaignDto,
    @CurrentUser() user: User,
  ) {
    return this.campaignsService.createCampaign(workspaceId, dto, user.id);
  }

  @Get()
  async listCampaigns(@Param('workspaceId') workspaceId: string) {
    return this.campaignsService.listCampaigns(workspaceId);
  }

  @Post('generate-url')
  @HttpCode(HttpStatus.OK)
  generateUtmUrl(@Param('workspaceId') _workspaceId: string, @Body() dto: GenerateUtmUrlDto) {
    return this.campaignsService.buildUtmUrl(dto);
  }

  @Get(':id')
  async getCampaign(@Param('workspaceId') workspaceId: string, @Param('id') campaignId: string) {
    return this.campaignsService.getCampaign(workspaceId, campaignId);
  }

  @Patch(':id')
  async updateCampaign(
    @Param('workspaceId') workspaceId: string,
    @Param('id') campaignId: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: User,
  ) {
    return this.campaignsService.updateCampaign(workspaceId, campaignId, dto, user.id);
  }

  @Delete(':id')
  async deleteCampaign(
    @Param('workspaceId') workspaceId: string,
    @Param('id') campaignId: string,
    @CurrentUser() user: User,
  ) {
    return this.campaignsService.deleteCampaign(workspaceId, campaignId, user.id);
  }
}
