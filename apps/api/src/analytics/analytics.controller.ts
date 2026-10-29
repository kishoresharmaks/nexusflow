import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { AnalyticsService } from './analytics.service';

@Controller('workspaces/:workspaceId/analytics')
@UseGuards(AuthGuard, WorkspaceGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(@Param('workspaceId') workspaceId: string, @Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getOverview(workspaceId, isNaN(parsedDays) ? 30 : parsedDays);
  }

  @Get('timeseries')
  async getTimeseries(@Param('workspaceId') workspaceId: string, @Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getTimeseries(workspaceId, isNaN(parsedDays) ? 30 : parsedDays);
  }

  @Get('campaigns')
  async getCampaigns(@Param('workspaceId') workspaceId: string, @Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getCampaigns(workspaceId, isNaN(parsedDays) ? 30 : parsedDays);
  }

  @Get('channels')
  async getChannels(@Param('workspaceId') workspaceId: string, @Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getChannels(workspaceId, isNaN(parsedDays) ? 30 : parsedDays);
  }

  @Get('products')
  async getProducts(@Param('workspaceId') workspaceId: string, @Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getProducts(workspaceId, isNaN(parsedDays) ? 30 : parsedDays);
  }

  @Get('conversions')
  async getRecentConversions(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedDays = days ? parseInt(days, 10) : 30;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.analyticsService.getRecentConversions(
      workspaceId,
      isNaN(parsedDays) ? 30 : parsedDays,
      isNaN(parsedLimit) ? 10 : parsedLimit,
    );
  }

  @Get('best-times')
  async getBestTimes(@Param('workspaceId') workspaceId: string) {
    return this.analyticsService.getBestTimes(workspaceId);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  async exportReport(
    @Param('workspaceId') workspaceId: string,
    @Body('format') format?: 'json' | 'csv',
  ) {
    return this.analyticsService.exportReport(workspaceId, format || 'json');
  }
}
