import { Controller, Get, Post, Body, Param, UseGuards, Ip, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuthGuard, AuthenticatedUser } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../workspaces/guards/roles.guard';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceRole } from '@commercepilot/database';
import {
  SocialService,
  type SafeSocialAccount,
  type MetaOAuthStartResult,
  type AccountHealthResult,
} from './social.service';
import { ConnectSocialAccountDto } from './dto/connect-social-account.dto';
import { MetaOAuthCallbackDto } from './dto/meta-oauth.dto';

@ApiTags('Social Accounts')
@ApiBearerAuth()
@UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
@Controller('workspaces/:workspaceId/social-accounts')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List connected social accounts for workspace' })
  async getAccounts(@Param('workspaceId') workspaceId: string): Promise<SafeSocialAccount[]> {
    return this.socialService.getAccounts(workspaceId);
  }

  @Get('oauth/meta/start')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Initiate Meta OAuth 2.0 connection flow with signed state' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiQuery({ name: 'redirectUri', required: false, description: 'Optional callback URL override' })
  startMetaOAuth(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('redirectUri') redirectUri?: string,
  ): MetaOAuthStartResult {
    return this.socialService.getMetaOAuthUrl(workspaceId, user.id, redirectUri);
  }

  @Post('oauth/meta/callback')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Exchange Meta authorization code for accounts with verified state' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  async metaOAuthCallback(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: MetaOAuthCallbackDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<SafeSocialAccount[]> {
    return this.socialService.handleMetaOAuthCallback(
      workspaceId,
      user.id,
      dto.code,
      dto.state,
      dto.redirectUri,
      ip,
    );
  }

  @Get(':accountId/health')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Check token validity and health status of a connected account' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'accountId', description: '24-character hex MongoDB ObjectId' })
  async checkAccountHealth(
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
  ): Promise<AccountHealthResult> {
    return this.socialService.checkAccountHealth(workspaceId, accountId);
  }

  @Get(':accountId')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get details of a connected social account' })
  async getAccountById(
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
  ): Promise<SafeSocialAccount> {
    return this.socialService.getAccountById(workspaceId, accountId);
  }

  @Post('connect')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Connect or update a social account with encrypted tokens' })
  async connectAccount(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ConnectSocialAccountDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<SafeSocialAccount> {
    return this.socialService.connectAccount(workspaceId, dto, user.id, ip);
  }

  @Post(':accountId/disconnect')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Disconnect a social account' })
  async disconnectAccount(
    @Param('workspaceId') workspaceId: string,
    @Param('accountId') accountId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<{ success: boolean; id: string }> {
    return this.socialService.disconnectAccount(workspaceId, accountId, user.id, ip);
  }

  @Post('refresh-expiring')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Trigger automated background refresh for expiring social OAuth tokens' })
  async refreshExpiringTokens(
    @Param('workspaceId') workspaceId: string,
    @Query('days') days?: string,
  ) {
    const daysThreshold = days ? parseInt(days, 10) : 7;
    return this.socialService.refreshExpiringTokens(
      workspaceId,
      isNaN(daysThreshold) ? 7 : daysThreshold,
    );
  }
}
