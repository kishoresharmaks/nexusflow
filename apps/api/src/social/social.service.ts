import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConnectSocialAccountDto } from './dto/connect-social-account.dto';
import { encryptToken, decryptToken, createOAuthState, verifyOAuthState } from './crypto.util';
import { SocialAccountStatus, SocialProvider, type SocialAccount } from '@commercepilot/database';

export type SafeSocialAccount = Omit<
  SocialAccount,
  'encryptedAccessToken' | 'encryptedRefreshToken'
>;

export interface MetaOAuthStartResult {
  authUrl: string;
  state: string;
  expiresInSeconds: number;
}

export interface AccountHealthResult {
  status: SocialAccountStatus;
  isValid: boolean;
  expiresAt: Date | null;
  provider: SocialProvider;
  displayName: string;
  reason?: string;
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);
  private readonly metaAppId: string | undefined;
  private readonly metaAppSecret: string | undefined;
  private readonly metaRedirectUri: string;
  private readonly metaGraphApiVersion =
    process.env['META_GRAPH_API_VERSION'] || 'v21.0';

  private readonly metaDefaultScopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_insights',
    'business_management',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService?: ConfigService,
  ) {
    this.metaAppId =
      this.configService?.get<string>('metaAppId') ||
      process.env['META_APP_ID'] ||
      process.env['META_CLIENT_ID'] ||
      process.env['INSTAGRAM_CLIENT_ID'];
    this.metaAppSecret =
      this.configService?.get<string>('metaAppSecret') ||
      process.env['META_APP_SECRET'] ||
      process.env['META_CLIENT_SECRET'] ||
      process.env['INSTAGRAM_CLIENT_SECRET'];
    this.metaRedirectUri =
      this.configService?.get<string>('metaRedirectUri') ||
      process.env['META_REDIRECT_URI'] ||
      process.env['INSTAGRAM_CALLBACK_URL'] ||
      'http://localhost:3000/settings/social/callback';
  }

  private validateObjectId(id: string, label: string): void {
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new BadRequestException(`Invalid ${label} format.`);
    }
  }

  private sanitizeAccount(account: SocialAccount): SafeSocialAccount {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedAccessToken, encryptedRefreshToken, ...safe } = account;
    return safe;
  }

  async getAccounts(workspaceId: string): Promise<SafeSocialAccount[]> {
    this.validateObjectId(workspaceId, 'workspace ID');

    const accounts = await this.prisma.socialAccount.findMany({
      where: {
        workspaceId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((acc) => this.sanitizeAccount(acc));
  }

  async getAccountById(workspaceId: string, accountId: string): Promise<SafeSocialAccount> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(accountId, 'account ID');

    const account = await this.prisma.socialAccount.findFirst({
      where: { id: accountId, workspaceId },
    });

    if (!account) {
      throw new NotFoundException('Social account not found in this workspace.');
    }

    return this.sanitizeAccount(account);
  }

  async connectAccount(
    workspaceId: string,
    dto: ConnectSocialAccountDto,
    userId: string,
    clientIp?: string,
  ): Promise<SafeSocialAccount> {
    this.validateObjectId(workspaceId, 'workspace ID');

    const encryptedAccessToken = encryptToken(dto.accessToken);
    const encryptedRefreshToken = dto.refreshToken ? encryptToken(dto.refreshToken) : null;

    const tokenExpiresAt = dto.tokenExpiresAt ? new Date(dto.tokenExpiresAt) : null;

    // Upsert so reconnecting an existing account refreshes tokens seamlessly
    const existing = await this.prisma.socialAccount.findFirst({
      where: {
        workspaceId,
        provider: dto.provider,
        providerAccountId: dto.providerAccountId,
      },
    });

    let account: SocialAccount;
    if (existing) {
      account = await this.prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          displayName: dto.displayName,
          username: dto.username ?? existing.username,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          scopes: dto.scopes ?? existing.scopes,
          status: SocialAccountStatus.ACTIVE,
        },
      });
    } else {
      account = await this.prisma.socialAccount.create({
        data: {
          workspaceId,
          provider: dto.provider,
          providerAccountId: dto.providerAccountId,
          displayName: dto.displayName,
          username: dto.username ?? null,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          scopes: dto.scopes ?? [],
          status: SocialAccountStatus.ACTIVE,
        },
      });
    }

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'SOCIAL_ACCOUNT_CONNECTED',
      resourceType: 'SocialAccount',
      resourceId: account.id,
      metadata: {
        provider: dto.provider,
        providerAccountId: dto.providerAccountId,
        displayName: dto.displayName,
      },
      ipAddress: clientIp,
    });

    return this.sanitizeAccount(account);
  }

  async disconnectAccount(
    workspaceId: string,
    accountId: string,
    userId: string,
    clientIp?: string,
  ): Promise<{ success: boolean; id: string }> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(accountId, 'account ID');

    const existing = await this.prisma.socialAccount.findFirst({
      where: { id: accountId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Social account not found in this workspace.');
    }

    await this.prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        status: SocialAccountStatus.DISCONNECTED,
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'SOCIAL_ACCOUNT_DISCONNECTED',
      resourceType: 'SocialAccount',
      resourceId: accountId,
      metadata: {
        provider: existing.provider,
        displayName: existing.displayName,
      },
      ipAddress: clientIp,
    });

    return { success: true, id: accountId };
  }

  /**
   * Internal method for secure token access during publishing.
   * Decrypts tokens on the fly and never exposes them outside the execution boundary.
   */
  async getDecryptedTokens(
    workspaceId: string,
    accountId: string,
  ): Promise<{ accessToken: string; refreshToken?: string | null }> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(accountId, 'account ID');

    const account = await this.prisma.socialAccount.findFirst({
      where: { id: accountId, workspaceId },
    });

    if (!account) {
      throw new NotFoundException('Social account not found in this workspace.');
    }

    if (account.status !== SocialAccountStatus.ACTIVE) {
      throw new BadRequestException(
        `Social account is ${account.status.toLowerCase()} and cannot be used for publishing.`,
      );
    }

    const accessToken = decryptToken(account.encryptedAccessToken);
    const refreshToken = account.encryptedRefreshToken
      ? decryptToken(account.encryptedRefreshToken)
      : null;

    return { accessToken, refreshToken };
  }

  /**
   * Generates a signed, expiring OAuth authorization URL for Meta connection.
   */
  getMetaOAuthUrl(
    workspaceId: string,
    userId: string,
    redirectUri?: string,
  ): MetaOAuthStartResult {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(userId, 'user ID');

    const clientId = this.metaAppId || process.env['META_APP_ID'] || 'dummy-meta-client-id';
    const callbackUri = redirectUri || this.metaRedirectUri;
    const state = createOAuthState(workspaceId, userId);
    const scopeParam = encodeURIComponent(this.metaDefaultScopes.join(','));

    const authUrl = `https://www.facebook.com/${this.metaGraphApiVersion}/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUri)}&state=${state}&scope=${scopeParam}&response_type=code`;

    return {
      authUrl,
      state,
      expiresInSeconds: 600, // 10 minutes
    };
  }

  /**
   * Exchanges authorization code for access tokens, discovers eligible Pages/Instagram accounts,
   * encrypts tokens, and securely persists them.
   */
  async handleMetaOAuthCallback(
    workspaceId: string,
    userId: string,
    code: string,
    state: string,
    redirectUri?: string,
    clientIp?: string,
  ): Promise<SafeSocialAccount[]> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(userId, 'user ID');

    // 1. Verify OAuth State integrity
    const verification = verifyOAuthState(state, workspaceId, userId);
    if (!verification.valid) {
      throw new BadRequestException(`OAuth State verification failed: ${verification.reason}`);
    }

    const callbackUri = redirectUri || this.metaRedirectUri;
    const clientId = this.metaAppId || process.env['META_APP_ID'];
    const clientSecret = this.metaAppSecret || process.env['META_APP_SECRET'];

    // Test runtime only: never honor mock/test codes in production.
    if (process.env['NODE_ENV'] === 'test') {
      const mockIg = await this.connectAccount(
        workspaceId,
        {
          provider: SocialProvider.META_INSTAGRAM,
          providerAccountId: `ig_${Date.now()}`,
          displayName: 'Test Brand Instagram',
          username: 'testbrand_ig',
          accessToken: `mock-meta-token-${Date.now()}`,
          scopes: this.metaDefaultScopes,
          tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
        },
        userId,
        clientIp,
      );
      return [mockIg];
    }

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Meta App credentials are not configured on the server.');
    }

    // 2. Exchange code for short-lived user access token
    const tokenUrl = `https://graph.facebook.com/${this.metaGraphApiVersion}/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(callbackUri)}&code=${code}`;

    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      this.logger.error(`Meta OAuth code exchange failed: ${err}`);
      throw new BadRequestException('Failed to exchange authorization code with Meta.');
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      token_type: string;
      expires_in?: number;
    };

    // 3. Exchange short-lived token for 60-day long-lived token
    const longLivedUrl = `https://graph.facebook.com/${this.metaGraphApiVersion}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${tokenData.access_token}`;

    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = longLivedRes.ok
      ? ((await longLivedRes.json()) as { access_token: string; expires_in?: number })
      : tokenData;

    const userAccessToken = longLivedData.access_token;
    const tokenExpiresAt = longLivedData.expires_in
      ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
      : undefined;

    // 4. Discover connected Pages and Instagram Business accounts
    const accountsUrl = `https://graph.facebook.com/${this.metaGraphApiVersion}/me/accounts?fields=id,name,access_token,category,instagram_business_account{id,username,name}&access_token=${userAccessToken}`;

    const accountsRes = await fetch(accountsUrl);
    if (!accountsRes.ok) {
      throw new BadRequestException('Failed to discover Facebook Pages / Instagram accounts from Meta.');
    }

    const accountsJson = (await accountsRes.json()) as {
      data: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: {
          id: string;
          username?: string;
          name?: string;
        };
      }>;
    };

    const connectedAccounts: SafeSocialAccount[] = [];

    for (const page of accountsJson.data || []) {
      // Connect Facebook Page
      const fbAccount = await this.connectAccount(
        workspaceId,
        {
          provider: SocialProvider.META_FACEBOOK,
          providerAccountId: page.id,
          displayName: page.name,
          accessToken: page.access_token,
          scopes: this.metaDefaultScopes,
          tokenExpiresAt,
        },
        userId,
        clientIp,
      );
      connectedAccounts.push(fbAccount);

      // Connect associated Instagram account if present
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account;
        const igAccount = await this.connectAccount(
          workspaceId,
          {
            provider: SocialProvider.META_INSTAGRAM,
            providerAccountId: ig.id,
            displayName: ig.name || ig.username || page.name,
            username: ig.username,
            accessToken: page.access_token,
            scopes: this.metaDefaultScopes,
            tokenExpiresAt,
          },
          userId,
          clientIp,
        );
        connectedAccounts.push(igAccount);
      }
    }

    return connectedAccounts;
  }

  /**
   * Health and token validity check for a connected social account.
   */
  async checkAccountHealth(workspaceId: string, accountId: string): Promise<AccountHealthResult> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(accountId, 'account ID');

    const account = await this.prisma.socialAccount.findFirst({
      where: { id: accountId, workspaceId },
    });

    if (!account) {
      throw new NotFoundException('Social account not found in this workspace.');
    }

    // Check expiry
    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      await this.prisma.socialAccount.update({
        where: { id: accountId },
        data: { status: SocialAccountStatus.EXPIRED },
      });

      return {
        status: SocialAccountStatus.EXPIRED,
        isValid: false,
        expiresAt: account.tokenExpiresAt,
        provider: account.provider,
        displayName: account.displayName,
        reason: 'Access token expired. Reconnection required.',
      };
    }

    return {
      status: account.status,
      isValid: account.status === SocialAccountStatus.ACTIVE,
      expiresAt: account.tokenExpiresAt,
      provider: account.provider,
      displayName: account.displayName,
    };
  }

  /**
   * Refreshes all active social accounts in the workspace (or system-wide) expiring within daysThreshold.
   */
  async refreshExpiringTokens(
    workspaceId?: string,
    daysThreshold: number = 7,
  ): Promise<{
    scanned: number;
    refreshed: number;
    failed: number;
    expired: number;
    results: Array<{
      id: string;
      displayName: string;
      provider: SocialProvider;
      status: 'refreshed' | 'expired' | 'failed';
      error?: string;
    }>;
  }> {
    const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
    const whereClause: {
      status: SocialAccountStatus;
      tokenExpiresAt?: { lte: Date };
      workspaceId?: string;
    } = {
      status: SocialAccountStatus.ACTIVE,
      tokenExpiresAt: { lte: thresholdDate },
    };

    if (workspaceId) {
      this.validateObjectId(workspaceId, 'workspace ID');
      whereClause.workspaceId = workspaceId;
    }

    const accounts = await this.prisma.socialAccount.findMany({
      where: whereClause,
      orderBy: { tokenExpiresAt: 'asc' },
    });

    let refreshed = 0;
    let failed = 0;
    let expired = 0;
    const results: Array<{
      id: string;
      displayName: string;
      provider: SocialProvider;
      status: 'refreshed' | 'expired' | 'failed';
      error?: string;
    }> = [];

    const isTest =
      process.env['NODE_ENV'] === 'test' ||
      process.env['MOCK_SOCIAL'] === 'true';

    for (const acc of accounts) {
      try {
        if (
          acc.provider === SocialProvider.META_INSTAGRAM ||
          acc.provider === SocialProvider.META_FACEBOOK
        ) {
          let newAccessToken = `mock_meta_refreshed_${Date.now()}`;
          let expiresIn = 60 * 24 * 3600;

          if (!isTest) {
            const rawUserToken = acc.encryptedRefreshToken
              ? decryptToken(acc.encryptedRefreshToken)
              : decryptToken(acc.encryptedAccessToken);
            const refreshUrl = new URL(
              `https://graph.facebook.com/${this.metaGraphApiVersion}/oauth/access_token`,
            );
            refreshUrl.searchParams.set('grant_type', 'fb_exchange_token');
            refreshUrl.searchParams.set('client_id', this.metaAppId || '');
            refreshUrl.searchParams.set('client_secret', this.metaAppSecret || '');
            refreshUrl.searchParams.set('fb_exchange_token', rawUserToken);

            const res = await fetch(refreshUrl.toString());
            if (!res.ok) {
              const errBody = await res.text();
              throw new Error(`Meta token exchange failed: ${errBody}`);
            }
            const data = (await res.json()) as { access_token: string; expires_in?: number };
            newAccessToken = data.access_token;
            if (data.expires_in) expiresIn = data.expires_in;
          }

          const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
          await this.prisma.socialAccount.update({
            where: { id: acc.id },
            data: {
              encryptedAccessToken: encryptToken(newAccessToken),
              tokenExpiresAt,
              status: SocialAccountStatus.ACTIVE,
            },
          });

          refreshed++;
          results.push({
            id: acc.id,
            displayName: acc.displayName,
            provider: acc.provider,
            status: 'refreshed',
          });
        } else if (acc.provider === SocialProvider.LINKEDIN) {
          if (!acc.encryptedRefreshToken && !isTest) {
            throw new Error('Standard LinkedIn accounts require user re-authentication.');
          }

          let newAccessToken = `mock_linkedin_refreshed_${Date.now()}`;
          let newRefreshToken = `mock_linkedin_refresh_${Date.now()}`;
          let expiresIn = 60 * 24 * 3600;

          if (!isTest && acc.encryptedRefreshToken) {
            const currentRefreshToken = decryptToken(acc.encryptedRefreshToken);
            const clientId = process.env['LINKEDIN_CLIENT_ID'] || '';
            const clientSecret = process.env['LINKEDIN_CLIENT_SECRET'] || '';
            const bodyParams = new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: currentRefreshToken,
              client_id: clientId,
              client_secret: clientSecret,
            });

            const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: bodyParams.toString(),
            });

            if (!res.ok) {
              const errBody = await res.text();
              throw new Error(`LinkedIn token refresh failed: ${errBody}`);
            }

            const data = (await res.json()) as {
              access_token: string;
              expires_in: number;
              refresh_token?: string;
            };
            newAccessToken = data.access_token;
            expiresIn = data.expires_in;
            if (data.refresh_token) newRefreshToken = data.refresh_token;
          }

          const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
          await this.prisma.socialAccount.update({
            where: { id: acc.id },
            data: {
              encryptedAccessToken: encryptToken(newAccessToken),
              encryptedRefreshToken: encryptToken(newRefreshToken),
              tokenExpiresAt,
              status: SocialAccountStatus.ACTIVE,
            },
          });

          refreshed++;
          results.push({
            id: acc.id,
            displayName: acc.displayName,
            provider: acc.provider,
            status: 'refreshed',
          });
        } else {
          results.push({
            id: acc.id,
            displayName: acc.displayName,
            provider: acc.provider,
            status: 'failed',
            error: 'Provider does not support programmatic refresh',
          });
          failed++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Refresh failed';
        const isRevoked =
          msg.includes('invalid_grant') ||
          msg.includes('revoked') ||
          msg.includes('expired') ||
          msg.includes('re-authenticate');

        if (isRevoked) {
          await this.prisma.socialAccount.update({
            where: { id: acc.id },
            data: { status: SocialAccountStatus.EXPIRED },
          });
          expired++;
          results.push({
            id: acc.id,
            displayName: acc.displayName,
            provider: acc.provider,
            status: 'expired',
            error: msg,
          });
        } else {
          failed++;
          results.push({
            id: acc.id,
            displayName: acc.displayName,
            provider: acc.provider,
            status: 'failed',
            error: msg,
          });
        }
      }
    }

    return {
      scanned: accounts.length,
      refreshed,
      failed,
      expired,
      results,
    };
  }
}
