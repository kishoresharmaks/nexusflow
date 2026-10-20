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
import { LinkedInIntegrationService } from './linkedin.service';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../database/prisma.service';
import { AuthGuard, AuthenticatedUser } from '../../auth/guards/auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { WorkspaceRole } from '@commercepilot/database';
import {
  LinkedInConnectQueryDto,
  LinkedInCallbackQueryDto,
  LinkedInStatusQueryDto,
  LinkedInDisconnectDto,
  LinkedInPostDto,
  LinkedInRefreshDto,
} from './dto/linkedin.dto';

@ApiTags('LinkedIn Integration')
@Controller(['api/integrations/linkedin', 'integrations/linkedin'])
export class LinkedInIntegrationController {
  constructor(
    private readonly linkedinService: LinkedInIntegrationService,
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
   * and redirects to LinkedIn authorization portal.
   */
  @Get('connect')
  @ApiOperation({ summary: 'Initiate LinkedIn OAuth 2.0 authorization and redirect' })
  @ApiQuery({ name: 'workspaceId', required: false, description: 'Target workspace ObjectId' })
  @ApiQuery({ name: 'token', required: false, description: 'Optional session token for browser navigation' })
  @ApiQuery({ name: 'json', required: false, description: 'Return JSON authUrl instead of redirecting' })
  async connect(
    @Query() query: LinkedInConnectQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const token = this.extractToken(req, query.token);

    if (!token) {
      if (query.json === 'true' || query.json === '1') {
        throw new UnauthorizedException('Authentication required. Missing token.');
      }
      return res.redirect(
        `${this.linkedinService.getFrontendUrl()}/social-accounts?linkedin=failed&error=unauthorized`,
      );
    }

    const session = await this.authService.validateSession(token);
    if (!session) {
      if (query.json === 'true' || query.json === '1') {
        throw new UnauthorizedException('Session is invalid or expired.');
      }
      return res.redirect(
        `${this.linkedinService.getFrontendUrl()}/social-accounts?linkedin=failed&error=invalid_session`,
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
          `${this.linkedinService.getFrontendUrl()}/social-accounts?linkedin=failed&error=no_workspace`,
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
          `${this.linkedinService.getFrontendUrl()}/social-accounts?linkedin=failed&error=forbidden_workspace`,
        );
      }
    }

    try {
      const authResult = await this.linkedinService.getAuthorizationUrl(
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
        `${this.linkedinService.getFrontendUrl()}/social-accounts?linkedin=failed&error=${encodeURIComponent(
          message,
        )}`,
      );
    }
  }

  /**
   * OAuth 2.0 callback endpoint:
   * Validates state, exchanges code for access token, retrieves member profile,
   * encrypts token, saves account in database, and redirects back to dashboard.
   */
  @Get('callback')
  @ApiOperation({ summary: 'LinkedIn OAuth 2.0 callback handler' })
  async callback(
    @Query() query: LinkedInCallbackQueryDto,
    @Ip() ip: string,
    @Res() res: Response,
  ): Promise<void> {
    const outcome = await this.linkedinService.handleCallback({
      code: query.code,
      state: query.state,
      error: query.error,
      errorDescription: query.error_description,
      clientIp: ip,
    });

    res.redirect(outcome.redirectUrl);
  }

  /**
   * Safe status check endpoint:
   * Returns display information for the connected LinkedIn account without exposing tokens.
   */
  @Get('status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get safe status of connected LinkedIn integration' })
  async getStatus(
    @Query() query: LinkedInStatusQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const membership = user.memberships.find((m) => m.workspaceId === query.workspaceId);
    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }

    return this.linkedinService.getStatus(query.workspaceId);
  }

  /**
   * Disconnect LinkedIn integration:
   * Removes or deactivates stored credentials.
   */
  @Delete('disconnect')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect LinkedIn integration and deactivate credentials' })
  async disconnect(
    @Body() dto: LinkedInDisconnectDto,
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

    return this.linkedinService.disconnect(dto.workspaceId, user.id, dto.accountId, ip);
  }

  /**
   * Personal-profile publishing endpoint:
   * Publishes post content to member feed using LinkedIn Posts API.
   */
  @Post('posts')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish post to connected LinkedIn profile' })
  async publishPost(
    @Body() dto: LinkedInPostDto,
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

    return this.linkedinService.publishPost(
      dto.workspaceId,
      user.id,
      dto.content,
      dto.mediaUrls,
    );
  }

  /**
   * Token refresh endpoint:
   * Uses stored refresh token to exchange for a new access token without requiring re-auth.
   */
  @Post('refresh')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh LinkedIn OAuth access token using stored refresh token' })
  async refreshToken(
    @Body() dto: LinkedInRefreshDto,
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

    return this.linkedinService.refreshToken(dto.workspaceId, dto.accountId, user.id, ip);
  }
}
