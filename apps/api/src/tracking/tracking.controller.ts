import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { TrackingService } from './tracking.service';
import { RecordClickDto } from './dto/record-click.dto';
import { RecordConversionDto } from './dto/record-conversion.dto';

@Controller('workspaces/:workspaceId/tracking')
@UseGuards(AuthGuard, WorkspaceGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('clicks')
  async recordClick(@Param('workspaceId') workspaceId: string, @Body() dto: RecordClickDto) {
    return this.trackingService.recordClick(workspaceId, dto);
  }

  @Post('conversions')
  async recordConversion(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: RecordConversionDto,
  ) {
    return this.trackingService.recordConversion(workspaceId, dto);
  }

  @Get('clicks')
  async listClicks(@Param('workspaceId') workspaceId: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.trackingService.listClicks(workspaceId, isNaN(parsedLimit) ? 50 : parsedLimit);
  }

  @Get('conversions')
  async listConversions(@Param('workspaceId') workspaceId: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.trackingService.listConversions(workspaceId, isNaN(parsedLimit) ? 50 : parsedLimit);
  }
}
