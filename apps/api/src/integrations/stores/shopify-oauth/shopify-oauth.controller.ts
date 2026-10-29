import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { WorkspaceGuard } from '../../../workspaces/guards/workspace.guard';
import { RolesGuard } from '../../../workspaces/guards/roles.guard';
import { Roles } from '../../../workspaces/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { ShopifyOAuthService } from './shopify-oauth.service';
import { ShopifyAuthorizeDto, ShopifyCallbackQueryDto } from './dto/shopify-oauth.dto';
import type { User } from '@commercepilot/database';

@ApiTags('Shopify OAuth')
@Controller()
export class ShopifyOAuthController {
  constructor(private readonly shopifyOAuthService: ShopifyOAuthService) {}

  /**
   * Initiate Shopify OAuth 2.0 authorization for a workspace.
   * Requires authenticated user with OWNER or ADMIN role in the workspace.
   */
  @Post('workspaces/:workspaceId/integrations/stores/shopify/authorize')
  @UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate Shopify OAuth authorization URL with signed state' })
  async authorize(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ShopifyAuthorizeDto,
    @CurrentUser() user: User,
  ): Promise<{ authUrl: string; shop: string }> {
    return this.shopifyOAuthService.generateAuthorizeUrl(workspaceId, user.id, dto.shop);
  }

  /**
   * Shopify OAuth callback endpoint.
   * Shopify redirects the merchant browser here with code, hmac, shop, state, and timestamp.
   * We verify HMAC and state, exchange the code for an access token, and redirect to frontend.
   */
  @Get([
    'api/v1/integrations/stores/shopify/callback',
    'integrations/stores/shopify/callback',
    'api/integrations/shopify/callback',
  ])
  @ApiOperation({ summary: 'Handle Shopify OAuth callback, exchange token, and redirect' })
  async callback(
    @Query() query: Record<string, string | undefined>,
    @Res() res: Response,
  ): Promise<void> {
    const redirectUrl = await this.shopifyOAuthService.handleCallback(query);
    return res.redirect(redirectUrl);
  }
}
