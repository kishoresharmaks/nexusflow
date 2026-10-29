import { prisma, SocialProvider, SocialAccountStatus } from '@commercepilot/database';
import { decryptToken, encryptToken } from '../crypto.util';

export interface TokenRefreshJobData {
  workspaceId?: string;
  accountId?: string;
  daysThreshold?: number; // default 7
  forceRefresh?: boolean;
}

export interface TokenRefreshDetail {
  accountId: string;
  workspaceId: string;
  provider: string;
  status: 'refreshed' | 'failed' | 'expired';
  error?: string;
  newTokenExpiresAt?: string;
}

export interface TokenRefreshResult {
  scanned: number;
  refreshed: number;
  failed: number;
  expired: number;
  details: TokenRefreshDetail[];
}

export async function processTokenRefresh(
  data: TokenRefreshJobData = {},
): Promise<TokenRefreshResult> {
  const daysThreshold = data.daysThreshold ?? 7;
  const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);

  const whereClause: Record<string, unknown> = {
    status: { in: [SocialAccountStatus.ACTIVE, SocialAccountStatus.EXPIRED] },
  };

  if (data.workspaceId) {
    whereClause['workspaceId'] = data.workspaceId;
  }
  if (data.accountId) {
    whereClause['id'] = data.accountId;
  } else if (!data.forceRefresh) {
    whereClause['OR'] = [
      { tokenExpiresAt: { lte: thresholdDate } },
      { tokenExpiresAt: null },
    ];
  }

  const accounts = await prisma.socialAccount.findMany({
    where: whereClause,
    orderBy: { tokenExpiresAt: 'asc' },
  });

  const result: TokenRefreshResult = {
    scanned: accounts.length,
    refreshed: 0,
    failed: 0,
    expired: 0,
    details: [],
  };

  for (const account of accounts) {
    try {
      if (account.provider === SocialProvider.META_INSTAGRAM) {
        const refreshMeta = await refreshInstagramAccount(account);
        result.refreshed++;
        result.details.push(refreshMeta);
      } else if (account.provider === SocialProvider.LINKEDIN) {
        const refreshLinkedIn = await refreshLinkedInAccount(account);
        result.refreshed++;
        result.details.push(refreshLinkedIn);
      } else {
        result.details.push({
          accountId: account.id,
          workspaceId: account.workspaceId,
          provider: account.provider,
          status: 'failed',
          error: `Provider ${account.provider} does not support programmatic OAuth refresh`,
        });
        result.failed++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Token refresh failed';
      const isRevocation =
        msg.includes('invalid_grant') ||
        msg.includes('revoked') ||
        msg.includes('expired') ||
        msg.includes('OAuthException') ||
        msg.includes('re-authenticate');

      if (isRevocation) {
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: { status: SocialAccountStatus.EXPIRED },
        });
        result.expired++;
        result.details.push({
          accountId: account.id,
          workspaceId: account.workspaceId,
          provider: account.provider,
          status: 'expired',
          error: msg,
        });
      } else {
        result.failed++;
        result.details.push({
          accountId: account.id,
          workspaceId: account.workspaceId,
          provider: account.provider,
          status: 'failed',
          error: msg,
        });
      }
    }
  }

  return result;
}

async function refreshInstagramAccount(account: {
  id: string;
  workspaceId: string;
  providerAccountId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
}): Promise<TokenRefreshDetail> {
  const isTest =
    process.env['NODE_ENV'] === 'test' ||
    process.env['MOCK_SOCIAL'] === 'true' ||
    account.encryptedAccessToken.startsWith('mock_');

  let newPageAccessToken: string;
  let newUserAccessToken: string | null;
  let expiresInSeconds = 60 * 24 * 3600; // 60 days default

  if (isTest) {
    newPageAccessToken = `mock_refreshed_meta_token_${Date.now()}`;
    newUserAccessToken = newPageAccessToken;
  } else {
    const clientId = process.env['INSTAGRAM_CLIENT_ID'] || process.env['META_APP_ID'];
    const clientSecret = process.env['INSTAGRAM_CLIENT_SECRET'] || process.env['META_APP_SECRET'];
    const graphVersion = process.env['META_GRAPH_VERSION'] || 'v22.0';

    if (!clientId || !clientSecret) {
      throw new Error('Meta/Instagram App credentials are not configured in worker environment.');
    }

    if (!account.encryptedRefreshToken) {
      throw new Error(
        'Instagram account does not have a stored user token for refresh. Re-authentication required.',
      );
    }

    const currentRefreshToken = decryptToken(account.encryptedRefreshToken);
    const refreshUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    refreshUrl.searchParams.set('grant_type', 'fb_exchange_token');
    refreshUrl.searchParams.set('client_id', clientId);
    refreshUrl.searchParams.set('client_secret', clientSecret);
    refreshUrl.searchParams.set('fb_exchange_token', currentRefreshToken);

    const refreshRes = await fetch(refreshUrl.toString());
    if (!refreshRes.ok) {
      const errText = await refreshRes.text();
      throw new Error(`Meta token exchange failed (HTTP ${refreshRes.status}): ${errText}`);
    }

    const tokenData = (await refreshRes.json()) as { access_token: string; expires_in?: number };
    newUserAccessToken = tokenData.access_token;
    if (tokenData.expires_in) {
      expiresInSeconds = tokenData.expires_in;
    }

    // Rediscover the Page Access Token
    const accountsUrl = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`);
    accountsUrl.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id}');
    accountsUrl.searchParams.set('access_token', newUserAccessToken);

    const accountsRes = await fetch(accountsUrl.toString());
    if (!accountsRes.ok) {
      throw new Error('Failed to retrieve Meta Page tokens using refreshed user token.');
    }

    const accountsData = (await accountsRes.json()) as {
      data: Array<{ access_token: string; instagram_business_account?: { id: string } }>;
    };

    const matchingPage = (accountsData.data || []).find(
      (p) => p.instagram_business_account?.id === account.providerAccountId,
    );

    if (!matchingPage?.access_token) {
      throw new Error(
        'Refreshed Meta user token but the associated Instagram business page was not found.',
      );
    }
    newPageAccessToken = matchingPage.access_token;
  }

  const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  const encryptedAccessToken = encryptToken(newPageAccessToken);

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      encryptedAccessToken,
      ...(newUserAccessToken ? { encryptedRefreshToken: encryptToken(newUserAccessToken) } : {}),
      tokenExpiresAt,
      status: SocialAccountStatus.ACTIVE,
    },
  });

  return {
    accountId: account.id,
    workspaceId: account.workspaceId,
    provider: SocialProvider.META_INSTAGRAM,
    status: 'refreshed',
    newTokenExpiresAt: tokenExpiresAt.toISOString(),
  };
}

async function refreshLinkedInAccount(account: {
  id: string;
  workspaceId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
}): Promise<TokenRefreshDetail> {
  const isTest =
    process.env['NODE_ENV'] === 'test' ||
    process.env['MOCK_SOCIAL'] === 'true' ||
    account.encryptedAccessToken.startsWith('mock_');

  if (!account.encryptedRefreshToken && !isTest) {
    throw new Error(
      'Standard LinkedIn accounts do not issue refresh tokens without partner MDP access. Re-authentication required.',
    );
  }

  let newAccessToken: string;
  let newRefreshToken: string | null;
  let expiresInSeconds = 60 * 24 * 3600; // 60 days default

  if (isTest) {
    newAccessToken = `mock_refreshed_access_token_${Date.now()}`;
    newRefreshToken = `mock_refreshed_refresh_token_${Date.now()}`;
  } else {
    const clientId = process.env['LINKEDIN_CLIENT_ID'];
    const clientSecret = process.env['LINKEDIN_CLIENT_SECRET'];

    if (!clientId || !clientSecret) {
      throw new Error('LinkedIn client credentials are not configured in worker environment.');
    }

    const currentRefreshToken = decryptToken(account.encryptedRefreshToken!);
    const bodyParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`LinkedIn token refresh failed (HTTP ${tokenRes.status}): ${errText}`);
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    newAccessToken = data.access_token;
    expiresInSeconds = data.expires_in || expiresInSeconds;
    newRefreshToken = data.refresh_token || currentRefreshToken;
  }

  const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  const encryptedAccessToken = encryptToken(newAccessToken);

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      encryptedAccessToken,
      ...(newRefreshToken ? { encryptedRefreshToken: encryptToken(newRefreshToken) } : {}),
      tokenExpiresAt,
      status: SocialAccountStatus.ACTIVE,
    },
  });

  return {
    accountId: account.id,
    workspaceId: account.workspaceId,
    provider: SocialProvider.LINKEDIN,
    status: 'refreshed',
    newTokenExpiresAt: tokenExpiresAt.toISOString(),
  };
}
