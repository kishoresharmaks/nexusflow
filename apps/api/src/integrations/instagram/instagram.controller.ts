import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Req,
  Res,
  Ip,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { InstagramIntegrationService } from './instagram.service';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../database/prisma.service';
import { AuthGuard, AuthenticatedUser } from '../../auth/guards/auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { WorkspaceRole } from '@commercepilot/database';
import {
  InstagramConnectQueryDto,
  InstagramCallbackQueryDto,
  InstagramStatusQueryDto,
  InstagramDisconnectDto,
  InstagramPostDto,
  InstagramRefreshDto,
} from './dto/instagram.dto';

@ApiTags('Instagram Integration')
@Controller(['api/integrations/instagram', 'integrations/instagram'])
export class InstagramIntegrationController {
  constructor(
    private readonly instagramService: InstagramIntegrationService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Helper to extract session token from Authorization header, Cookie, or Query parameter.
   */
  private extractToken(req: Request, queryToken?: string): string | null {
    if (queryToken && queryToken.trim() !== '') {
      return queryToken.trim();
    }

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    const cookieHeader = req.headers['cookie'];
    if (cookieHeader) {
      const match = cookieHeader.match(/sessionToken=([^;]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }

    return null;
  }

  /**
   * Start OAuth authorization flow:
   * Validates user authentication, verifies workspace, generates cryptographically signed state,
   * and redirects to Meta authorization dialog for Instagram Business permissions.
   */
  @Get('connect')
  @ApiOperation({ summary: 'Initiate Meta OAuth 2.0 authorization for Instagram Business' })
  @ApiQuery({ name: 'workspaceId', required: false, description: 'Target workspace ObjectId' })
  @ApiQuery({ name: 'token', required: false, description: 'Optional session token for browser navigation' })
  @ApiQuery({ name: 'json', required: false, description: 'Return JSON authUrl instead of redirecting' })
  async connect(
    @Query() query: InstagramConnectQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const token = this.extractToken(req, query.token);

    if (!token) {
      if (query.json === 'true' || query.json === '1') {
        throw new UnauthorizedException('Authentication required. Missing token.');
      }
      return res.redirect(
        `${this.instagramService.getFrontendUrl()}/social-accounts?instagram=failed&error=unauthorized`,
      );
    }

    const session = await this.authService.validateSession(token);
    if (!session) {
      if (query.json === 'true' || query.json === '1') {
        throw new UnauthorizedException('Session is invalid or expired.');
      }
      return res.redirect(
        `${this.instagramService.getFrontendUrl()}/social-accounts?instagram=failed&error=invalid_session`,
      );
    }

    const user = session.user;
    let targetWorkspaceId = query.workspaceId;

    if (!targetWorkspaceId) {
      const primaryMembership = user.memberships[0];
      if (!primaryMembership) {
        if (query.json === 'true' || query.json === '1') {
          throw new BadRequestException('User does not belong to any workspace.');
        }
        return res.redirect(
          `${this.instagramService.getFrontendUrl()}/social-accounts?instagram=failed&error=no_workspace`,
        );
      }
      targetWorkspaceId = primaryMembership.workspaceId;
    } else {
      const membership = user.memberships.find((m) => m.workspaceId === targetWorkspaceId);
      if (!membership) {
        if (query.json === 'true' || query.json === '1') {
          throw new ForbiddenException('User is not a member of the target workspace.');
        }
        return res.redirect(
          `${this.instagramService.getFrontendUrl()}/social-accounts?instagram=failed&error=forbidden_workspace`,
        );
      }
    }

    try {
      const authResult = await this.instagramService.getAuthorizationUrl(
        targetWorkspaceId,
        user.id,
        query.redirectUri,
      );

      if (query.json === 'true' || query.json === '1') {
        res.json(authResult);
        return;
      }

      res.redirect(authResult.authUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initiate authorization';
      if (query.json === 'true' || query.json === '1') {
        if (err instanceof ForbiddenException) throw err;
        throw new BadRequestException(message);
      }
      return res.redirect(
        `${this.instagramService.getFrontendUrl()}/social-accounts?instagram=failed&error=${encodeURIComponent(
          message,
        )}`,
      );
    }
  }

  /**
   * OAuth 2.0 callback endpoint:
   * Validates state, exchanges code for access token, upgrades to long-lived token,
   * discovers Instagram Business accounts, encrypts token, saves account in database,
   * and redirects back to dashboard.
   */
  @Get('callback')
  @ApiOperation({ summary: 'Meta OAuth 2.0 callback handler for Instagram' })
  async callback(
    @Query() query: InstagramCallbackQueryDto,
    @Ip() ip: string,
    @Res() res: Response,
  ): Promise<void> {
    const outcome = await this.instagramService.handleCallback({
      code: query.code,
      state: query.state,
      error: query.error,
      errorReason: query.error_reason,
      errorDescription: query.error_description,
      clientIp: ip,
    });

    res.redirect(outcome.redirectUrl);
  }

  /**
   * Safe status check endpoint:
   * Returns display information for connected Instagram integration without exposing tokens.
   */
  @Get('status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get safe status of connected Instagram integration' })
  async getStatus(
    @Query() query: InstagramStatusQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const membership = user.memberships.find((m) => m.workspaceId === query.workspaceId);
    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    return this.instagramService.getStatus(query.workspaceId);
  }

  /**
   * Disconnect Instagram integration:
   * Removes or deactivates stored credentials.
   */
  @Delete('disconnect')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Instagram integration and deactivate credentials' })
  async disconnect(
    @Body() dto: InstagramDisconnectDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    const membership = user.memberships.find((m) => m.workspaceId === dto.workspaceId);
    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    if (membership.role !== WorkspaceRole.OWNER && membership.role !== WorkspaceRole.ADMIN) {
      throw new ForbiddenException('Only workspace Owners and Admins can disconnect integrations.');
    }

    return this.instagramService.disconnect(dto.workspaceId, user.id, dto.accountId, ip);
  }

  /**
   * Token refresh endpoint:
   * Refreshes long-lived access token using Meta exchange token without re-auth.
   */
  @Post('refresh')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh Instagram access token' })
  async refreshToken(
    @Body() dto: InstagramRefreshDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    const membership = user.memberships.find((m) => m.workspaceId === dto.workspaceId);
    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    if (membership.role !== WorkspaceRole.OWNER && membership.role !== WorkspaceRole.ADMIN) {
      throw new ForbiddenException('Only workspace Owners and Admins can refresh tokens.');
    }

    return this.instagramService.refreshToken(dto.workspaceId, dto.accountId, user.id, ip);
  }

  /**
   * Instagram Feed Publishing endpoint:
   * Publishes post with media to connected Instagram profile via Meta Graph API container model.
   */
  @Post('posts')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish post to connected Instagram profile' })
  async publishPost(
    @Body() dto: InstagramPostDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const membership = user.memberships.find((m) => m.workspaceId === dto.workspaceId);
    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    if (
      membership.role !== WorkspaceRole.OWNER &&
      membership.role !== WorkspaceRole.ADMIN &&
      membership.role !== WorkspaceRole.MEMBER
    ) {
      throw new ForbiddenException('Viewers cannot publish posts.');
    }

    return this.instagramService.publishPost(
      dto.workspaceId,
      user.id,
      dto.content,
      dto.mediaUrls,
    );
  }
}
