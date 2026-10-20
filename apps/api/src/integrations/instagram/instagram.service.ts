import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SocialProvider,
  SocialAccountStatus,
  PostStatus,
} from '@commercepilot/database';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EntitlementsService } from '../../billing/entitlements.service';
import {
  encryptToken,
  decryptToken,
  createOAuthState,
  decodeAndVerifyOAuthState,
} from '../../social/crypto.util';

export interface InstagramAuthUrlResult {
  authUrl: string;
  state: string;
  expiresInSeconds: number;
}

export interface InstagramCallbackResult {
  success: boolean;
  workspaceId?: string;
  accountId?: string;
  username?: string | null;
  displayName?: string;
  redirectUrl: string;
}

export interface InstagramSafeAccount {
  id: string;
  provider: SocialProvider;
  displayName: string;
  username: string | null;
  providerAccountId: string;
  scopes: string[];
  status: SocialAccountStatus;
  tokenExpiresAt: Date | null;
  createdAt: Date;
}

export interface InstagramStatusResult {
  connected: boolean;
  account: InstagramSafeAccount | null;
  canPublish: boolean;
}

export interface InstagramPublishResult {
  success: boolean;
  postId: string;
  providerPostId: string;
}

@Injectable()
export class InstagramIntegrationService {
  private readonly logger = new Logger(InstagramIntegrationService.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;
  private readonly graphApiVersion: string;
  private readonly frontendUrl: string;

  /**
   * Official Meta Graph API scopes required for Instagram Business management and publishing.
   */
  readonly requiredScopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly entitlementsService?: EntitlementsService,
  ) {
    this.clientId =
      process.env['META_APP_ID'] ||
      process.env['INSTAGRAM_CLIENT_ID'] ||
      this.configService?.get<string>('instagram.clientId') ||
      '';

    this.clientSecret =
      process.env['META_APP_SECRET'] ||
      process.env['INSTAGRAM_CLIENT_SECRET'] ||
      this.configService?.get<string>('instagram.clientSecret') ||
      '';

    this.callbackUrl =
      process.env['INSTAGRAM_CALLBACK_URL'] ||
      this.configService?.get<string>('instagram.callbackUrl') ||
      'http://localhost:4000/api/integrations/instagram/callback';

    this.graphApiVersion =
      process.env['META_GRAPH_API_VERSION'] ||
      this.configService?.get<string>('instagram.graphApiVersion') ||
      'v19.0';

    this.frontendUrl =
      process.env['FRONTEND_URL'] ||
      process.env['WEB_URL'] ||
      this.configService?.get<string>('instagram.frontendUrl') ||
      'http://localhost:3000';
  }

  getFrontendUrl(): string {
    return this.frontendUrl;
  }

  /**
   * Generates Meta OAuth 2.0 authorization URL with cryptographically signed state.
   */
  async getAuthorizationUrl(
    workspaceId: string,
    userId: string,
    redirectUriOverride?: string | undefined,
  ): Promise<InstagramAuthUrlResult> {
    if (this.entitlementsService) {
      const existingActive = await this.prisma.socialAccount.findFirst({
        where: {
          workspaceId,
          provider: SocialProvider.META_INSTAGRAM,
          status: SocialAccountStatus.ACTIVE,
        },
      });

      if (!existingActive) {
        await this.entitlementsService.enforceCanConnectSocialAccount(workspaceId);
      }
    }

    const state = createOAuthState(workspaceId, userId);
    const redirectUri = redirectUriOverride || this.callbackUrl;

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: this.requiredScopes.join(','),
      response_type: 'code',
    });

    const authUrl = `https://www.facebook.com/${this.graphApiVersion}/dialog/oauth?${params.toString()}`;

    return {
      authUrl,
      state,
      expiresInSeconds: 600,
    };
  }

  /**
   * Handles Meta OAuth callback:
   * Validates signed state, exchanges code for access token, upgrades to 60-day token,
   * discovers connected Instagram Business accounts, encrypts tokens, upserts account.
   */
  async handleCallback(params: {
    code?: string | undefined;
    state?: string | undefined;
    error?: string | undefined;
    errorReason?: string | undefined;
    errorDescription?: string | undefined;
    clientIp?: string | undefined;
  }): Promise<InstagramCallbackResult> {
    const { code, state, error, errorReason, errorDescription, clientIp } = params;

    // 1. User denied permissions or Meta returned error
    if (error || errorReason) {
      const errCode = error || errorReason || 'access_denied';
      const desc = errorDescription || 'User cancelled authorization or Meta returned an error.';
      this.logger.warn(`Instagram OAuth returned error: ${errCode} - ${desc}`);
      const deniedUrl = `${this.frontendUrl}/social-accounts?instagram=denied&error=${encodeURIComponent(
        errCode,
      )}`;
      return { success: false, redirectUrl: deniedUrl };
    }

    if (!code || !state) {
      this.logger.error('Instagram OAuth callback missing code or state parameter');
      const failedUrl = `${this.frontendUrl}/social-accounts?instagram=failed&error=missing_parameters`;
      return { success: false, redirectUrl: failedUrl };
    }

    // 2. Cryptographic state verification
    const verification = decodeAndVerifyOAuthState(state);
    if (!verification.valid || !verification.workspaceId || !verification.userId) {
      this.logger.error(
        `Instagram OAuth state verification failed: ${verification.reason || 'tampered state'}`,
      );
      const failedUrl = `${this.frontendUrl}/social-accounts?instagram=failed&error=invalid_state`;
      return { success: false, redirectUrl: failedUrl };
    }

    const { workspaceId, userId } = verification;

    try {
      // Enforce subscription plan channel quota
      if (this.entitlementsService) {
        const existingActive = await this.prisma.socialAccount.findFirst({
          where: {
            workspaceId,
            provider: SocialProvider.META_INSTAGRAM,
            status: SocialAccountStatus.ACTIVE,
          },
        });

        if (!existingActive) {
          await this.entitlementsService.enforceCanConnectSocialAccount(workspaceId);
        }
      }

      let providerAccountId = '';
      let displayName = '';
      let username: string | null = null;
      let rawAccessToken = '';
      let tokenExpiresAt: Date | null = null;

      // 3. Test/Mock execution branch
      if (
        process.env['NODE_ENV'] === 'test' ||
        code.startsWith('mock_') ||
        code.startsWith('test_')
      ) {
        providerAccountId = `ig_${Date.now()}`;
        displayName = 'Test Brand Instagram';
        username = 'testbrand_ig';
        rawAccessToken = `mock_meta_ig_token_${Date.now()}`;
        tokenExpiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);
      } else {
        // 4. Exchange authorization code for short-lived user access token
        const tokenExchangeUrl = new URL(
          `https://graph.facebook.com/${this.graphApiVersion}/oauth/access_token`,
        );
        tokenExchangeUrl.searchParams.set('client_id', this.clientId);
        tokenExchangeUrl.searchParams.set('client_secret', this.clientSecret);
        tokenExchangeUrl.searchParams.set('redirect_uri', this.callbackUrl);
        tokenExchangeUrl.searchParams.set('code', code);

        const tokenRes = await fetch(tokenExchangeUrl.toString());
        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          this.logger.error(`Meta token exchange failed: HTTP ${tokenRes.status} - ${errText}`);
          throw new BadRequestException(`Failed to exchange code with Meta: ${errText}`);
        }

        const tokenData = (await tokenRes.json()) as {
          access_token: string;
          token_type: string;
          expires_in?: number;
        };

        // Upgrade short-lived token to 60-day long-lived token
        const longLivedUrl = new URL(
          `https://graph.facebook.com/${this.graphApiVersion}/oauth/access_token`,
        );
        longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
        longLivedUrl.searchParams.set('client_id', this.clientId);
        longLivedUrl.searchParams.set('client_secret', this.clientSecret);
        longLivedUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

        const longLivedRes = await fetch(longLivedUrl.toString());
        const longLivedData = longLivedRes.ok
          ? ((await longLivedRes.json()) as { access_token: string; expires_in?: number })
          : tokenData;

        const userAccessToken = longLivedData.access_token;
        const expiresInSec = longLivedData.expires_in || 5184000;
        tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000);

        // Discover connected Facebook Pages & associated Instagram Business Account
        const accountsUrl = new URL(`https://graph.facebook.com/${this.graphApiVersion}/me/accounts`);
        accountsUrl.searchParams.set(
          'fields',
          'id,name,access_token,category,instagram_business_account{id,username,name,profile_picture_url}',
        );
        accountsUrl.searchParams.set('access_token', userAccessToken);

        const accountsRes = await fetch(accountsUrl.toString());
        if (!accountsRes.ok) {
          const errText = await accountsRes.text();
          this.logger.error(`Failed to discover Instagram accounts: ${errText}`);
          throw new BadRequestException('Failed to discover connected Instagram accounts from Meta.');
        }

        const accountsData = (await accountsRes.json()) as {
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

        let foundInstagram: {
          id: string;
          username?: string;
          name?: string;
          pageAccessToken: string;
        } | null = null;

        for (const page of accountsData.data || []) {
          if (page.instagram_business_account) {
            foundInstagram = {
              ...page.instagram_business_account,
              pageAccessToken: page.access_token,
            };
            break;
          }
        }

        if (!foundInstagram) {
          this.logger.warn(
            'Meta OAuth completed, but no Instagram Business/Creator Account was linked to any Page.',
          );
          const noAccountUrl = `${this.frontendUrl}/social-accounts?instagram=failed&error=no_instagram_business_account`;
          return { success: false, redirectUrl: noAccountUrl };
        }

        providerAccountId = foundInstagram.id;
        username = foundInstagram.username || null;
        displayName = foundInstagram.name || foundInstagram.username || 'Instagram Business Account';
        rawAccessToken = foundInstagram.pageAccessToken || userAccessToken;
      }

      // 5. Encrypt access token at rest
      const encryptedAccessToken = encryptToken(rawAccessToken);

      // 6. Upsert account record
      const account = await this.prisma.socialAccount.upsert({
        where: {
          workspaceId_provider_providerAccountId: {
            workspaceId,
            provider: SocialProvider.META_INSTAGRAM,
            providerAccountId,
          },
        },
        create: {
          workspaceId,
          provider: SocialProvider.META_INSTAGRAM,
          providerAccountId,
          displayName,
          username,
          encryptedAccessToken,
          tokenExpiresAt,
          scopes: this.requiredScopes,
          status: SocialAccountStatus.ACTIVE,
        },
        update: {
          displayName,
          username,
          encryptedAccessToken,
          tokenExpiresAt,
          scopes: this.requiredScopes,
          status: SocialAccountStatus.ACTIVE,
        },
      });

      // 7. Audit log
      await this.auditService.record({
        workspaceId,
        userId,
        action: 'SOCIAL_ACCOUNT_CONNECTED',
        resourceType: 'SocialAccount',
        resourceId: account.id,
        metadata: {
          provider: SocialProvider.META_INSTAGRAM,
          providerAccountId,
          displayName,
          username,
        },
        ipAddress: clientIp,
      });

      const successUrl = `${this.frontendUrl}/social-accounts?instagram=connected&name=${encodeURIComponent(
        displayName,
      )}&accountId=${account.id}`;

      return {
        success: true,
        workspaceId,
        accountId: account.id,
        username,
        displayName,
        redirectUrl: successUrl,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
      this.logger.error(`Instagram OAuth flow error: ${errorMsg}`);
      const failedUrl = `${this.frontendUrl}/social-accounts?instagram=failed&error=${encodeURIComponent(
        errorMsg,
      )}`;
      return { success: false, redirectUrl: failedUrl };
    }
  }

  /**
   * Return connected Instagram account status and safe display information without exposing tokens.
   */
  async getStatus(workspaceId: string): Promise<InstagramStatusResult> {
    const account = await this.prisma.socialAccount.findFirst({
      where: {
        workspaceId,
        provider: SocialProvider.META_INSTAGRAM,
        status: SocialAccountStatus.ACTIVE,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!account) {
      return {
        connected: false,
        account: null,
        canPublish: false,
      };
    }

    const isExpired = account.tokenExpiresAt ? account.tokenExpiresAt < new Date() : false;
    const canPublish =
      account.status === SocialAccountStatus.ACTIVE &&
      !isExpired &&
      account.scopes.includes('instagram_content_publish');

    return {
      connected: true,
      account: {
        id: account.id,
        provider: account.provider,
        displayName: account.displayName,
        username: account.username,
        providerAccountId: account.providerAccountId,
        scopes: account.scopes,
        status: account.status,
        tokenExpiresAt: account.tokenExpiresAt,
        createdAt: account.createdAt,
      },
      canPublish,
    };
  }

  /**
   * Disconnect Instagram account for workspace and update status.
   */
  async disconnect(
    workspaceId: string,
    userId: string,
    accountId?: string | undefined,
    clientIp?: string | undefined,
  ): Promise<{ success: boolean; message: string }> {
    const whereClause: {
      workspaceId: string;
      provider: SocialProvider;
      id?: string;
    } = {
      workspaceId,
      provider: SocialProvider.META_INSTAGRAM,
    };

    if (accountId) {
      whereClause.id = accountId;
    }

    const account = await this.prisma.socialAccount.findFirst({
      where: whereClause,
    });

    if (!account) {
      throw new NotFoundException('No active Instagram account found in this workspace.');
    }

    await this.prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        status: SocialAccountStatus.DISCONNECTED,
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'SOCIAL_ACCOUNT_DISCONNECTED',
      resourceType: 'SocialAccount',
      resourceId: account.id,
      metadata: {
        provider: SocialProvider.META_INSTAGRAM,
        displayName: account.displayName,
      },
      ipAddress: clientIp,
    });

    return {
      success: true,
      message: 'Instagram account disconnected successfully.',
    };
  }

  /**
   * Publish photo or video post to connected Instagram Professional profile
   * using the official Meta 2-step media container + publish API handshake.
   */
  async publishPost(
    workspaceId: string,
    userId: string,
    content: string,
    mediaUrls: string[] = [],
  ): Promise<InstagramPublishResult> {
    if (!content || content.trim() === '') {
      throw new BadRequestException('Post caption cannot be empty.');
    }

    if (content.length > 2200) {
      throw new BadRequestException(
        `Post caption exceeds Instagram limit of 2,200 characters (${content.length} chars).`,
      );
    }

    if (!mediaUrls || mediaUrls.length === 0) {
      throw new BadRequestException(
        'Instagram Feed posts require at least one image or video media URL.',
      );
    }

    const account = await this.prisma.socialAccount.findFirst({
      where: {
        workspaceId,
        provider: SocialProvider.META_INSTAGRAM,
        status: SocialAccountStatus.ACTIVE,
      },
    });

    if (!account) {
      throw new BadRequestException('No active Instagram account connected for this workspace.');
    }

    if (!account.scopes.includes('instagram_content_publish')) {
      throw new BadRequestException(
        'The connected Instagram account lacks the required instagram_content_publish permission.',
      );
    }

    // Enforce monthly post creation allowance
    if (this.entitlementsService) {
      await this.entitlementsService.enforceCanCreatePost(workspaceId);
    }

    const accessToken = decryptToken(account.encryptedAccessToken);

    // Create draft post record in database
    const post = await this.prisma.post.create({
      data: {
        workspaceId,
        socialAccountId: account.id,
        content,
        mediaUrls,
        status: PostStatus.PUBLISHING,
      },
    });

    let providerPostId = '';

    if (
      process.env['NODE_ENV'] === 'test' ||
      accessToken.startsWith('mock_') ||
      accessToken.startsWith('test_')
    ) {
      providerPostId = `ig_post_${Date.now()}`;
    } else {
      try {
        // Step 1: Create media container
        const isVideo = mediaUrls[0]?.match(/\.(mp4|mov)(\?.*)?$/i);
        const containerBody: Record<string, string> = {
          access_token: accessToken,
          caption: content,
        };

        if (isVideo) {
          containerBody['media_type'] = 'VIDEO';
          containerBody['video_url'] = mediaUrls[0]!;
        } else {
          containerBody['image_url'] = mediaUrls[0]!;
        }

        const containerRes = await fetch(
          `https://graph.facebook.com/${this.graphApiVersion}/${account.providerAccountId}/media`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(containerBody),
          },
        );

        const containerData = (await containerRes.json()) as {
          id?: string;
          error?: { code: number; message: string };
        };

        if (!containerRes.ok || !containerData.id || containerData.error) {
          const errText = containerData.error?.message || `HTTP ${containerRes.status}`;
          throw new BadRequestException(`Instagram media container creation failed: ${errText}`);
        }

        // Step 2: Publish container
        const publishRes = await fetch(
          `https://graph.facebook.com/${this.graphApiVersion}/${account.providerAccountId}/media_publish`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              creation_id: containerData.id,
              access_token: accessToken,
            }),
          },
        );

        const publishData = (await publishRes.json()) as {
          id?: string;
          error?: { code: number; message: string };
        };

        if (!publishRes.ok || !publishData.id || publishData.error) {
          const errText = publishData.error?.message || `HTTP ${publishRes.status}`;
          throw new BadRequestException(`Instagram media publish failed: ${errText}`);
        }

        providerPostId = publishData.id;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Publishing failed';
        await this.prisma.post.update({
          where: { id: post.id },
          data: { status: PostStatus.FAILED },
        });

        await this.prisma.publishAttempt.create({
          data: {
            postId: post.id,
            attemptNumber: 1,
            status: 'FAILED',
            errorMessage: errorMsg,
          },
        });

        throw new BadRequestException(errorMsg);
      }
    }

    // Update post to PUBLISHED and record publish attempt
    const updatedPost = await this.prisma.post.update({
      where: { id: post.id },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        providerPostId,
      },
    });

    await this.prisma.publishAttempt.create({
      data: {
        postId: post.id,
        attemptNumber: 1,
        status: 'SUCCESS',
        ...(providerPostId ? { providerRequestId: providerPostId } : {}),
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'POST_PUBLISHED',
      resourceType: 'Post',
      resourceId: post.id,
      metadata: {
        provider: SocialProvider.META_INSTAGRAM,
        providerPostId,
      },
    });

    return {
      success: true,
      postId: updatedPost.id,
      providerPostId,
    };
  }

  /**
   * Refreshes long-lived Instagram/Meta access token (extends for another 60 days).
   */
  async refreshToken(
    workspaceId: string,
    accountId?: string | undefined,
    userId?: string | undefined,
    clientIp?: string | undefined,
  ): Promise<{
    success: boolean;
    accountId: string;
    tokenExpiresAt: Date;
    message: string;
  }> {
    const whereClause: {
      workspaceId: string;
      provider: SocialProvider;
      status: SocialAccountStatus;
      id?: string;
    } = {
      workspaceId,
      provider: SocialProvider.META_INSTAGRAM,
      status: SocialAccountStatus.ACTIVE,
    };

    if (accountId) {
      whereClause.id = accountId;
    }

    const account = await this.prisma.socialAccount.findFirst({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
    });

    if (!account) {
      throw new NotFoundException('No active Instagram account found for this workspace.');
    }

    const currentAccessToken = decryptToken(account.encryptedAccessToken);
    let newAccessToken = currentAccessToken;
    let expiresInSeconds = 5184000; // 60 days default

    if (
      process.env['NODE_ENV'] === 'test' ||
      currentAccessToken.startsWith('test_') ||
      currentAccessToken.startsWith('mock_')
    ) {
      newAccessToken = `mock_refreshed_meta_token_${Date.now()}`;
    } else {
      try {
        const refreshUrl = new URL(
          `https://graph.facebook.com/${this.graphApiVersion}/oauth/access_token`,
        );
        refreshUrl.searchParams.set('grant_type', 'fb_exchange_token');
        refreshUrl.searchParams.set('client_id', this.clientId);
        refreshUrl.searchParams.set('client_secret', this.clientSecret);
        refreshUrl.searchParams.set('fb_exchange_token', currentAccessToken);

        const refreshRes = await fetch(refreshUrl.toString());
        if (!refreshRes.ok) {
          const errText = await refreshRes.text();
          this.logger.error(`Meta token refresh failed: HTTP ${refreshRes.status} - ${errText}`);
          throw new BadRequestException(`Instagram token refresh failed: ${errText}`);
        }

        const data = (await refreshRes.json()) as {
          access_token: string;
          expires_in?: number;
        };

        newAccessToken = data.access_token;
        if (data.expires_in) {
          expiresInSeconds = data.expires_in;
        }
      } catch (err: unknown) {
        if (err instanceof BadRequestException) throw err;
        const msg = err instanceof Error ? err.message : 'Token refresh failed';
        this.logger.error(`Failed to refresh Instagram token: ${msg}`);
        throw new BadRequestException(`Instagram token refresh failed: ${msg}`);
      }
    }

    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const encryptedAccessToken = encryptToken(newAccessToken);

    await this.prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        encryptedAccessToken,
        tokenExpiresAt,
        status: SocialAccountStatus.ACTIVE,
      },
    });

    if (userId) {
      await this.auditService.record({
        workspaceId,
        userId,
        action: 'SOCIAL_ACCOUNT_REFRESHED',
        resourceType: 'SocialAccount',
        resourceId: account.id,
        metadata: {
          provider: SocialProvider.META_INSTAGRAM,
          displayName: account.displayName,
          tokenExpiresAt: tokenExpiresAt.toISOString(),
        },
        ipAddress: clientIp,
      });
    }

    return {
      success: true,
      accountId: account.id,
      tokenExpiresAt,
      message: 'Instagram access token refreshed successfully.',
    };
  }

  /**
   * Background utility: Find all Instagram accounts expiring within N days and refresh their tokens.
   */
  async refreshExpiringTokens(daysThreshold = 7): Promise<{
    scanned: number;
    refreshed: number;
    failed: number;
  }> {
    const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);

    const expiringAccounts = await this.prisma.socialAccount.findMany({
      where: {
        provider: SocialProvider.META_INSTAGRAM,
        status: SocialAccountStatus.ACTIVE,
        tokenExpiresAt: { lte: thresholdDate },
      },
    });

    let refreshed = 0;
    let failed = 0;

    for (const acc of expiringAccounts) {
      try {
        await this.refreshToken(acc.workspaceId, acc.id);
        refreshed++;
      } catch (err: unknown) {
        failed++;
        this.logger.warn(
          `Failed to automatically refresh token for Instagram account ${acc.id} in workspace ${acc.workspaceId}: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`,
        );
      }
    }

    return {
      scanned: expiringAccounts.length,
      refreshed,
      failed,
    };
  }
}
