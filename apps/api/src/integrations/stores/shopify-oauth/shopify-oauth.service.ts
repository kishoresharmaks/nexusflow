import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import { encryptToken } from '../../../social/crypto.util';
import { StoreConnectionsService } from '../store-connections.service';
import { StorePlatform, StoreSyncStatus, WorkspaceRole } from '@commercepilot/database';
import {
  createShopifyOAuthState,
  verifyAndConsumeShopifyOAuthState,
} from './shopify-oauth-state.util';

export interface ShopifyTokenExchangeResponse {
  access_token: string;
  scope: string;
  associated_user_scope?: string;
  associated_user?: Record<string, unknown>;
}

export interface ShopifyShopMetadata {
  id: number;
  name: string;
  email?: string;
  domain?: string;
  currency: string;
  myshopify_domain?: string;
}

@Injectable()
export class ShopifyOAuthService {
  private readonly logger = new Logger(ShopifyOAuthService.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;
  private readonly scopes: string;
  private readonly apiVersion: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storeConnectionsService: StoreConnectionsService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.clientId =
      this.configService?.get<string>('shopify.clientId') ||
      process.env['SHOPIFY_CLIENT_ID'] ||
      '';
    this.clientSecret =
      this.configService?.get<string>('shopify.clientSecret') ||
      process.env['SHOPIFY_CLIENT_SECRET'] ||
      '';
    this.callbackUrl =
      this.configService?.get<string>('shopify.callbackUrl') ||
      process.env['SHOPIFY_REDIRECT_URI'] ||
      'http://localhost:4000/api/v1/integrations/stores/shopify/callback';
    this.scopes =
      this.configService?.get<string>('shopify.scopes') ||
      process.env['SHOPIFY_SCOPES'] ||
      'read_products,read_inventory';
    this.apiVersion =
      this.configService?.get<string>('shopify.apiVersion') ||
      process.env['SHOPIFY_API_VERSION'] ||
      '2026-01';
    this.frontendUrl =
      this.configService?.get<string>('shopify.frontendUrl') ||
      process.env['FRONTEND_URL'] ||
      process.env['WEB_URL'] ||
      'http://localhost:3000';
  }

  getFrontendUrl(): string {
    return this.frontendUrl;
  }

  /**
   * Normalizes and validates the incoming shop domain.
   * Strips protocols, trailing paths, and appends .myshopify.com if omitted.
   * Enforces RFC-compliant subdomain characters to prevent SSRF and open redirect vulnerabilities.
   */
  normalizeShop(rawShop: string): string {
    if (!rawShop || typeof rawShop !== 'string') {
      throw new BadRequestException('Shop domain must be a non-empty string.');
    }

    let cleaned = rawShop.trim().toLowerCase();
    cleaned = cleaned.replace(/^https?:\/\//, '');
    cleaned = cleaned.split('/')[0] || '';
    cleaned = cleaned.split('?')[0] || '';

    if (!cleaned.includes('.')) {
      cleaned = `${cleaned}.myshopify.com`;
    }

    const shopifyDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
    if (!shopifyDomainRegex.test(cleaned)) {
      throw new BadRequestException(
        `Invalid Shopify domain: "${rawShop}". Must be a valid .myshopify.com domain (e.g. your-store.myshopify.com).`,
      );
    }

    return cleaned;
  }

  /**
   * Generates the Shopify authorization URL with signed state nonce.
   */
  async generateAuthorizeUrl(
    workspaceId: string,
    userId: string,
    rawShop: string,
  ): Promise<{ authUrl: string; shop: string }> {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException(
        'Shopify OAuth is not configured on the server. Please configure SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.',
      );
    }

    const shop = this.normalizeShop(rawShop);
    const state = createShopifyOAuthState(workspaceId, userId, shop);

    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: this.scopes,
      redirect_uri: this.callbackUrl,
      state,
    });

    const authUrl = `https://${shop}/admin/oauth/authorize?${params.toString()}`;
    return { authUrl, shop };
  }

  /**
   * Strictly verifies Shopify's HMAC-SHA256 signature according to official specifications:
   * 1. Extracts all query parameters except 'hmac' and 'signature'
   * 2. Sorts parameter keys lexicographically
   * 3. Joins into key=value format separated by '&'
   * 4. Computes HMAC-SHA256 using client secret and compares with timing-safe equality
   */
  verifyShopifyHmac(queryParams: Record<string, string | undefined>): boolean {
    if (!this.clientSecret) {
      this.logger.error('Cannot verify Shopify HMAC: SHOPIFY_CLIENT_SECRET is missing.');
      return false;
    }

    const providedHmac = queryParams['hmac'];
    if (!providedHmac || typeof providedHmac !== 'string') {
      return false;
    }

    const filteredParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(queryParams)) {
      if (key !== 'hmac' && key !== 'signature' && value !== undefined) {
        filteredParams[key] = String(value);
      }
    }

    const sortedMessage = Object.keys(filteredParams)
      .sort()
      .map((k) => `${k}=${filteredParams[k]}`)
      .join('&');

    const calculatedHmac = crypto
      .createHmac('sha256', this.clientSecret)
      .update(sortedMessage)
      .digest('hex');

    try {
      const providedBuffer = Buffer.from(providedHmac, 'hex');
      const calculatedBuffer = Buffer.from(calculatedHmac, 'hex');

      if (providedBuffer.length !== calculatedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(providedBuffer, calculatedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Exchanges authorization code for permanent offline access token.
   */
  async exchangeCodeForToken(
    shop: string,
    code: string,
  ): Promise<ShopifyTokenExchangeResponse> {
    const exchangeUrl = `https://${shop}/admin/oauth/access_token`;

    const response = await fetch(exchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Shopify token exchange failed (${response.status}): ${errorText}`);
      throw new BadRequestException(
        `Failed to exchange Shopify authorization code for access token (HTTP ${response.status}).`,
      );
    }

    const data = (await response.json()) as ShopifyTokenExchangeResponse;
    if (!data.access_token) {
      throw new BadRequestException('Shopify did not return an access token.');
    }

    return data;
  }

  /**
   * Fetches shop metadata (name, currency, domain) using the newly issued access token.
   */
  async fetchShopMetadata(
    shop: string,
    accessToken: string,
  ): Promise<ShopifyShopMetadata> {
    const shopUrl = `https://${shop}/admin/api/${this.apiVersion}/shop.json`;

    try {
      const response = await fetch(shopUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { shop?: ShopifyShopMetadata };
        if (data.shop) {
          return data.shop;
        }
      }
    } catch (err) {
      this.logger.warn(`Could not fetch shop metadata from ${shopUrl}: ${(err as Error).message}`);
    }

    // Fallback metadata if shop.json is temporarily unreachable
    return {
      id: 0,
      name: shop.replace('.myshopify.com', ''),
      currency: 'USD',
      myshopify_domain: shop,
    };
  }

  /**
   * Complete callback handler:
   * 1. Validates HMAC signature
   * 2. Verifies and consumes single-use state nonce
   * 3. Checks workspace authorization
   * 4. Exchanges code for access token
   * 5. Encrypts token with AES-256-GCM and persists connection
   * 6. Triggers initial catalog synchronization
   */
  async handleCallback(queryParams: Record<string, string | undefined>): Promise<string> {
    const rawShop = queryParams['shop'];
    const code = queryParams['code'];
    const state = queryParams['state'];

    if (!rawShop || !code || !state) {
      return `${this.frontendUrl}/integrations?status=error&error=${encodeURIComponent(
        'Missing required Shopify callback parameters.',
      )}`;
    }

    let shop: string;
    try {
      shop = this.normalizeShop(rawShop);
    } catch (err) {
      return `${this.frontendUrl}/integrations?status=error&error=${encodeURIComponent(
        (err as Error).message,
      )}`;
    }

    // 1. Verify HMAC
    const isHmacValid = this.verifyShopifyHmac(queryParams);
    if (!isHmacValid) {
      this.logger.warn(`Rejected Shopify callback for ${shop}: invalid HMAC signature`);
      return `${this.frontendUrl}/integrations?status=error&error=${encodeURIComponent(
        'Invalid Shopify cryptographic signature.',
      )}`;
    }

    // 2. Verify and consume single-use state nonce
    const stateResult = verifyAndConsumeShopifyOAuthState(state, shop);
    if (!stateResult.valid || !stateResult.workspaceId || !stateResult.userId) {
      this.logger.warn(`Rejected Shopify callback for ${shop}: ${stateResult.reason}`);
      return `${this.frontendUrl}/integrations?status=error&error=${encodeURIComponent(
        stateResult.reason || 'Invalid or expired OAuth state.',
      )}`;
    }

    const { workspaceId, userId } = stateResult;

    // 3. Verify workspace membership and permissions
    const membership = await this.prisma.membership.findFirst({
      where: {
        workspaceId,
        userId,
      },
    });

    if (!membership || (membership.role !== WorkspaceRole.OWNER && membership.role !== WorkspaceRole.ADMIN)) {
      this.logger.warn(
        `Rejected Shopify callback for user ${userId} in workspace ${workspaceId}: insufficient role`,
      );
      return `${this.frontendUrl}/integrations?status=error&error=${encodeURIComponent(
        'You do not have administrative permissions to connect stores to this workspace.',
      )}`;
    }

    try {
      // 4. Code exchange
      const tokenData = await this.exchangeCodeForToken(shop, code);

      // 5. Fetch shop details (official name & primary currency)
      const shopDetails = await this.fetchShopMetadata(shop, tokenData.access_token);
      const storeName = shopDetails.name || shop.replace('.myshopify.com', '');

      // 6. Encrypt access token with AES-256-GCM
      const encryptedApiKey = encryptToken(tokenData.access_token);

      // 7. Upsert store connection
      const connection = await this.prisma.storeConnection.upsert({
        where: {
          workspaceId_platform_storeUrl: {
            workspaceId,
            platform: StorePlatform.SHOPIFY,
            storeUrl: `https://${shop}`,
          },
        },
        create: {
          workspaceId,
          platform: StorePlatform.SHOPIFY,
          storeName,
          storeUrl: `https://${shop}`,
          encryptedApiKey,
          apiVersion: this.apiVersion,
          syncStatus: StoreSyncStatus.IDLE,
        },
        update: {
          storeName,
          encryptedApiKey,
          apiVersion: this.apiVersion,
          syncStatus: StoreSyncStatus.IDLE,
          errorMessage: null,
        },
      });

      // 8. Record audit log
      await this.auditService.record({
        workspaceId,
        userId,
        action: 'store.connected',
        resourceType: 'StoreConnection',
        resourceId: connection.id,
        metadata: {
          platform: StorePlatform.SHOPIFY,
          storeUrl: `https://${shop}`,
          authMethod: 'OAUTH_2_0',
          scopes: tokenData.scope || this.scopes,
        },
      });

      // 9. Auto-align workspace default currency if workspace is still on initial default USD
      try {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { currency: true, locale: true },
        });

        if (
          workspace &&
          shopDetails.currency &&
          workspace.currency === 'USD' &&
          shopDetails.currency !== 'USD'
        ) {
          const newLocale =
            shopDetails.currency === 'INR'
              ? 'en-IN'
              : shopDetails.currency === 'GBP'
              ? 'en-GB'
              : workspace.locale;

          await this.prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              currency: shopDetails.currency,
              locale: newLocale,
            },
          });
          this.logger.log(
            `Auto-aligned workspace ${workspaceId} default currency to ${shopDetails.currency} (${newLocale})`,
          );
        }
      } catch (err) {
        this.logger.warn(`Could not auto-align workspace currency: ${(err as Error).message}`);
      }

      // 10. Asynchronously trigger initial catalog sync
      void this.storeConnectionsService
        .syncStore(workspaceId, connection.id, userId)
        .catch((err) => {
          this.logger.error(`Initial Shopify catalog sync failed for ${connection.id}: ${(err as Error).message}`);
        });

      return `${this.frontendUrl}/integrations?status=success&platform=shopify&store=${encodeURIComponent(
        storeName,
      )}`;
    } catch (err) {
      this.logger.error(`Shopify OAuth completion error: ${(err as Error).message}`);
      return `${this.frontendUrl}/integrations?status=error&error=${encodeURIComponent(
        (err as Error).message || 'Failed to complete Shopify connection.',
      )}`;
    }
  }
}
