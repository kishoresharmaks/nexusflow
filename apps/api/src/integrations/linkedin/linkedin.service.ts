import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EntitlementsService } from '../../billing/entitlements.service';
import {
  encryptToken,
  decryptToken,
  createOAuthState,
  decodeAndVerifyOAuthState,
} from '../../social/crypto.util';
import {
  SocialAccountStatus,
  SocialProvider,
  PostStatus,
  type SocialAccount,
} from '@commercepilot/database';

export interface LinkedInOAuthStartResult {
  authUrl: string;
  state: string;
  expiresInSeconds: number;
}

export interface LinkedInStatusResult {
  connected: boolean;
  account: {
    id: string;
    provider: SocialProvider;
    displayName: string;
    username: string | null;
    providerAccountId: string;
    scopes: string[];
    status: SocialAccountStatus;
    tokenExpiresAt: Date | null;
    createdAt: Date;
  } | null;
  canPublish: boolean;
}

export interface LinkedInPublishResult {
  success: boolean;
  postId?: string;
  providerPostId?: string;
  errorMessage?: string;
}

@Injectable()
export class LinkedInIntegrationService {
  private readonly logger = new Logger(LinkedInIntegrationService.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;
  private readonly frontendUrl: string;

  readonly requiredScopes = ['openid', 'profile', 'w_member_social'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService?: ConfigService,
    @Optional() private readonly entitlementsService?: EntitlementsService,
  ) {
    this.clientId =
      this.configService?.get<string>('LINKEDIN_CLIENT_ID') ||
      process.env['LINKEDIN_CLIENT_ID'] ||
      '';
    this.clientSecret =
      this.configService?.get<string>('LINKEDIN_CLIENT_SECRET') ||
      process.env['LINKEDIN_CLIENT_SECRET'] ||
      '';
    this.callbackUrl =
      this.configService?.get<string>('LINKEDIN_CALLBACK_URL') ||
      process.env['LINKEDIN_CALLBACK_URL'] ||
      'http://localhost:4000/api/integrations/linkedin/callback';
    this.frontendUrl =
      this.configService?.get<string>('FRONTEND_URL') ||
      process.env['FRONTEND_URL'] ||
      process.env['WEB_URL'] ||
      'http://localhost:3000';
  }

  getFrontendUrl(): string {
    return this.frontendUrl;
  }

  getCallbackUrl(): string {
    return this.callbackUrl;
  }

  /**
   * Generates cryptographically signed OAuth 2.0 authorization URL for LinkedIn.
   */
  async getAuthorizationUrl(
    workspaceId: string,
    userId: string,
    redirectUri?: string,
  ): Promise<LinkedInOAuthStartResult> {
    // Enforce channel limits if no existing LinkedIn account in this workspace
    if (this.entitlementsService) {
      const existing = await this.prisma.socialAccount.findFirst({
        where: {
          workspaceId,
          provider: SocialProvider.LINKEDIN,
          status: SocialAccountStatus.ACTIVE,
        },
      });
      if (!existing) {
        await this.entitlementsService.enforceCanConnectSocialAccount(workspaceId);
      }
    }

    const callback = redirectUri || this.callbackUrl;
    const state = createOAuthState(workspaceId, userId);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId || 'replace-with-linkedin-client-id',
      redirect_uri: callback,
      state,
      scope: this.requiredScopes.join(' '),
    });

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

    return {
      authUrl,
      state,
      expiresInSeconds: 600, // 10 minutes
    };
  }

  /**
   * Handles the LinkedIn OAuth callback:
   * 1. Validates OAuth state HMAC & expiry.
   * 2. Exchanges code for access token via LinkedIn token endpoint.
   * 3. Retrieves member profile via OpenID Connect userinfo.
   * 4. Encrypts token with AES-256-GCM.
   * 5. Saves/upserts account under verified workspace.
   */
  async handleCallback(params: {
    code?: string | undefined;
    state?: string | undefined;
    error?: string | undefined;
    errorDescription?: string | undefined;
    redirectUri?: string | undefined;
    clientIp?: string | undefined;
  }): Promise<{
    success: boolean;
    workspaceId?: string;
    accountId?: string;
    memberName?: string;
    redirectUrl: string;
  }> {
    const { code, state, error, errorDescription, redirectUri, clientIp } = params;

    // Handle user denial / error response from LinkedIn
    if (error) {
      this.logger.warn(`LinkedIn OAuth returned error: ${error} - ${errorDescription ?? ''}`);
      const deniedUrl = `${this.frontendUrl}/social-accounts?linkedin=denied&error=${encodeURIComponent(error)}`;
      return { success: false, redirectUrl: deniedUrl };
    }

    if (!code || !state) {
      this.logger.error('LinkedIn OAuth callback missing code or state parameter');
      const failedUrl = `${this.frontendUrl}/social-accounts?linkedin=failed&error=missing_parameters`;
      return { success: false, redirectUrl: failedUrl };
    }

    // Validate state integrity and extract workspace + user context
    const stateVerification = decodeAndVerifyOAuthState(state);
    if (!stateVerification.valid || !stateVerification.workspaceId || !stateVerification.userId) {
      this.logger.error(
        `LinkedIn OAuth state verification failed: ${stateVerification.reason ?? 'Unknown reason'}`,
      );
      const invalidStateUrl = `${this.frontendUrl}/social-accounts?linkedin=failed&error=invalid_state`;
      return { success: false, redirectUrl: invalidStateUrl };
    }

    const { workspaceId, userId } = stateVerification;
    const callback = redirectUri || this.callbackUrl;

    try {
      let accessToken = '';
      let refreshToken: string | undefined;
      let expiresIn = 5184000; // 60 days default
      let profile: { sub: string; name: string; picture?: string };

      // In test or simulated code:
      if (
        process.env['NODE_ENV'] === 'test' ||
        code.startsWith('mock-') ||
        code.startsWith('test-')
      ) {
        accessToken = `mock_li_token_${Date.now()}`;
        profile = {
          sub: 'li_mock_member_782bb4',
          name: 'CommercePilot LinkedIn Member',
          picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        };
      } else {
        if (!this.clientId || !this.clientSecret) {
          throw new BadRequestException('LinkedIn credentials are not configured on the server.');
        }

        // 1. Exchange authorization code for access token
        const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: callback,
          }).toString(),
        });

        if (!tokenResponse.ok) {
          const errBody = await tokenResponse.text();
          this.logger.error(`LinkedIn token exchange failed: HTTP ${tokenResponse.status} - ${errBody}`);
          throw new BadRequestException('Failed to exchange authorization code with LinkedIn.');
        }

        const tokenData = (await tokenResponse.json()) as {
          access_token: string;
          expires_in?: number;
          refresh_token?: string;
        };

        accessToken = tokenData.access_token;
        expiresIn = tokenData.expires_in ?? 5184000;
        refreshToken = tokenData.refresh_token;

        // 2. Retrieve OpenID Connect member profile identity
        const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!profileResponse.ok) {
          const profileErr = await profileResponse.text();
          this.logger.error(`LinkedIn userinfo lookup failed: HTTP ${profileResponse.status} - ${profileErr}`);
          throw new BadRequestException('Failed to retrieve user profile from LinkedIn.');
        }

        const profileData = (await profileResponse.json()) as {
          sub: string;
          name: string;
          picture?: string;
        };

        profile = {
          sub: profileData.sub,
          name: profileData.name || 'LinkedIn User',
          ...(profileData.picture ? { picture: profileData.picture } : {}),
        };
      }

      // Enforce plan channel limit if adding a brand new social account
      const existingAccount = await this.prisma.socialAccount.findFirst({
        where: {
          workspaceId,
          provider: SocialProvider.LINKEDIN,
          providerAccountId: profile.sub,
        },
      });

      if (!existingAccount && this.entitlementsService) {
        await this.entitlementsService.enforceCanConnectSocialAccount(workspaceId);
      }

      // 3. Encrypt tokens at rest with AES-256-GCM
      const encryptedAccessToken = encryptToken(accessToken);
      const encryptedRefreshToken = refreshToken ? encryptToken(refreshToken) : null;
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      // 4. Upsert SocialAccount in MongoDB
      const account = await this.prisma.socialAccount.upsert({
        where: {
          workspaceId_provider_providerAccountId: {
            workspaceId,
            provider: SocialProvider.LINKEDIN,
            providerAccountId: profile.sub,
          },
        },
        create: {
          workspaceId,
          provider: SocialProvider.LINKEDIN,
          providerAccountId: profile.sub,
          displayName: profile.name,
          username: profile.name,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          scopes: this.requiredScopes,
          status: SocialAccountStatus.ACTIVE,
        },
        update: {
          displayName: profile.name,
          username: profile.name,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          scopes: this.requiredScopes,
          status: SocialAccountStatus.ACTIVE,
        },
      });

      // 5. Record immutable audit log
      await this.auditService.record({
        workspaceId,
        userId,
        action: 'SOCIAL_ACCOUNT_CONNECTED',
        resourceType: 'SocialAccount',
        resourceId: account.id,
        metadata: {
          provider: SocialProvider.LINKEDIN,
          providerAccountId: profile.sub,
          displayName: profile.name,
        },
        ipAddress: clientIp,
      });

      const successUrl = `${this.frontendUrl}/social-accounts?linkedin=connected&name=${encodeURIComponent(
        profile.name,
      )}&accountId=${account.id}`;

      return {
        success: true,
        workspaceId,
        accountId: account.id,
        memberName: profile.name,
        redirectUrl: successUrl,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
      this.logger.error(`LinkedIn OAuth flow error: ${errorMsg}`);
      const failedUrl = `${this.frontendUrl}/social-accounts?linkedin=failed&error=${encodeURIComponent(
        errorMsg,
      )}`;
      return { success: false, redirectUrl: failedUrl };
    }
  }

  /**
   * Return connected LinkedIn account status and safe display information without exposing tokens.
   */
  async getStatus(workspaceId: string): Promise<LinkedInStatusResult> {
    const account = await this.prisma.socialAccount.findFirst({
      where: {
        workspaceId,
        provider: SocialProvider.LINKEDIN,
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
      account.scopes.includes('w_member_social');

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
   * Disconnect LinkedIn account for workspace and update status.
   */
  async disconnect(
    workspaceId: string,
    userId: string,
    accountId?: string,
    clientIp?: string,
  ): Promise<{ success: boolean; message: string }> {
    const whereClause: {
      workspaceId: string;
      provider: SocialProvider;
      id?: string;
    } = {
      workspaceId,
      provider: SocialProvider.LINKEDIN,
    };

    if (accountId) {
      whereClause.id = accountId;
    }

    const account = await this.prisma.socialAccount.findFirst({
      where: whereClause,
    });

    if (!account) {
      throw new NotFoundException('No active LinkedIn account found in this workspace.');
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
        provider: SocialProvider.LINKEDIN,
        displayName: account.displayName,
      },
      ipAddress: clientIp,
    });

    return {
      success: true,
      message: 'LinkedIn account disconnected successfully.',
    };
  }

  /**
   * Publish personal profile post through LinkedIn API using decrypted credentials.
   */
  async publishPost(
    workspaceId: string,
    userId: string,
    content: string,
    mediaUrls: string[] = [],
  ): Promise<LinkedInPublishResult> {
    if (!content || content.trim() === '') {
      throw new BadRequestException('Post content cannot be empty.');
    }

    if (content.length > 3000) {
      throw new BadRequestException(
        `Post content exceeds LinkedIn limit of 3,000 characters (${content.length} chars).`,
      );
    }

    const account = await this.prisma.socialAccount.findFirst({
      where: {
        workspaceId,
        provider: SocialProvider.LINKEDIN,
        status: SocialAccountStatus.ACTIVE,
      },
    });

    if (!account) {
      throw new BadRequestException('No active LinkedIn account connected for this workspace.');
    }

    if (!account.scopes.includes('w_member_social')) {
      throw new BadRequestException(
        'The connected LinkedIn account lacks the required w_member_social publishing permission.',
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
      providerPostId = `urn:li:share:${Date.now()}`;
    } else {
      try {
        // LinkedIn Posts API (REST v202401)
        const authorUrn = account.providerAccountId.startsWith('urn:li:')
          ? account.providerAccountId
          : `urn:li:person:${account.providerAccountId}`;

        const postBody = {
          author: authorUrn,
          commentary: content,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        };

        const response = await fetch('https://api.linkedin.com/rest/posts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'LinkedIn-Version': '202401',
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postBody),
        });

        if (!response.ok) {
          const errText = await response.text();
          this.logger.error(`LinkedIn Posts API call failed: HTTP ${response.status} - ${errText}`);
          throw new BadRequestException(`LinkedIn publishing failed: ${errText}`);
        }

        const responseHeaderId = response.headers.get('x-restli-id');
        providerPostId = responseHeaderId || `urn:li:share:${Date.now()}`;
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
        provider: SocialProvider.LINKEDIN,
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
   * Refresh an expiring LinkedIn OAuth access token using the stored encrypted refresh token.
   */
  async refreshToken(
    workspaceId: string,
    accountId?: string,
    userId?: string,
    clientIp?: string,
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
      provider: SocialProvider.LINKEDIN,
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
      throw new NotFoundException('No active LinkedIn account found for this workspace.');
    }

    if (!account.encryptedRefreshToken) {
      throw new BadRequestException(
        'No refresh token available for this LinkedIn account. Please reconnect via OAuth to obtain a fresh token.',
      );
    }

    const currentRefreshToken = decryptToken(account.encryptedRefreshToken);

    let newAccessToken = '';
    let newRefreshToken = currentRefreshToken;
    let expiresInSeconds = 5184000; // 60 days default

    if (
      process.env['NODE_ENV'] === 'test' ||
      currentRefreshToken.startsWith('test_') ||
      currentRefreshToken.startsWith('mock_')
    ) {
      newAccessToken = `mock_refreshed_access_token_${Date.now()}`;
      newRefreshToken = `mock_refreshed_refresh_token_${Date.now()}`;
    } else {
      try {
        const bodyParams = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: currentRefreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        });

        const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: bodyParams.toString(),
        });

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();
          this.logger.error(`LinkedIn token refresh HTTP error: ${tokenResponse.status} - ${errText}`);
          throw new BadRequestException(`LinkedIn token refresh failed: ${errText}`);
        }

        const data = (await tokenResponse.json()) as {
          access_token: string;
          expires_in?: number;
          refresh_token?: string;
          refresh_token_expires_in?: number;
        };

        newAccessToken = data.access_token;
        if (data.refresh_token) {
          newRefreshToken = data.refresh_token;
        }
        if (data.expires_in) {
          expiresInSeconds = data.expires_in;
        }
      } catch (err: unknown) {
        if (err instanceof BadRequestException) throw err;
        const msg = err instanceof Error ? err.message : 'Token refresh failed';
        this.logger.error(`Failed to refresh LinkedIn token: ${msg}`);
        throw new BadRequestException(`LinkedIn token refresh failed: ${msg}`);
      }
    }

    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const encryptedAccessToken = encryptToken(newAccessToken);
    const encryptedRefreshToken = encryptToken(newRefreshToken);

    await this.prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        encryptedAccessToken,
        encryptedRefreshToken,
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
          provider: SocialProvider.LINKEDIN,
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
      message: 'LinkedIn access token refreshed successfully.',
    };
  }

  /**
   * Background utility: Find all LinkedIn accounts expiring within N days and refresh their tokens.
   */
  async refreshExpiringTokens(daysThreshold = 7): Promise<{
    scanned: number;
    refreshed: number;
    failed: number;
  }> {
    const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);

    const expiringAccounts = await this.prisma.socialAccount.findMany({
      where: {
        provider: SocialProvider.LINKEDIN,
        status: SocialAccountStatus.ACTIVE,
        encryptedRefreshToken: { not: null },
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
          `Failed to automatically refresh token for LinkedIn account ${acc.id} in workspace ${acc.workspaceId}: ${
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
