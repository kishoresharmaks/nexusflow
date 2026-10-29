import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { MediaService, PresignedUploadResult, PresignedDownloadResult } from './media.service';
import { RequestUploadUrlDto, ConfirmMediaUploadDto } from './dto/media.dto';
import { AuthGuard, AuthenticatedUser } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../workspaces/guards/roles.guard';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceRole, MediaAsset } from '@commercepilot/database';

@ApiTags('Media Storage & Assets')
@ApiBearerAuth()
@UseGuards(AuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Obtain pre-signed S3 upload URL for private object storage' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 201, description: 'Pre-signed S3 upload parameters generated' })
  async requestUploadUrl(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: RequestUploadUrlDto,
  ): Promise<PresignedUploadResult> {
    return this.mediaService.generatePresignedUploadUrl(workspaceId, dto);
  }

  @Post('confirm')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Confirm completed upload and register MediaAsset record' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 201, description: 'MediaAsset record registered' })
  async confirmUpload(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ConfirmMediaUploadDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<MediaAsset> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.mediaService.confirmUpload(workspaceId, dto, user.id, ip);
  }

  @Get()
  @ApiOperation({ summary: 'List media assets in workspace' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  async listMedia(@Param('workspaceId') workspaceId: string): Promise<MediaAsset[]> {
    return this.mediaService.listAssets(workspaceId);
  }

  @Get(':assetId/download-url')
  @ApiOperation({ summary: 'Obtain short-lived pre-signed download URL for private asset' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'assetId', description: 'Media asset ID' })
  @ApiQuery({ name: 'expiresIn', required: false, description: 'Expiry in seconds (default: 300)' })
  async getDownloadUrl(
    @Param('workspaceId') workspaceId: string,
    @Param('assetId') assetId: string,
    @Query('expiresIn') expiresIn?: string,
  ): Promise<PresignedDownloadResult> {
    const expiry = expiresIn ? Math.min(3600, Math.max(60, parseInt(expiresIn, 10) || 300)) : 300;
    return this.mediaService.getPresignedDownloadUrl(workspaceId, assetId, expiry);
  }

  @Delete(':assetId')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Delete media asset' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'assetId', description: 'Media asset ID' })
  async deleteMedia(
    @Param('workspaceId') workspaceId: string,
    @Param('assetId') assetId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ success: boolean; id: string }> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.mediaService.deleteAsset(workspaceId, assetId, user.id, ip);
  }
}
