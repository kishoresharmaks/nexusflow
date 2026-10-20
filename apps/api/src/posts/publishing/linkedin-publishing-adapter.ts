import { Injectable, Logger } from '@nestjs/common';
import { SocialProvider } from '@commercepilot/database';
import {
  SocialPublishingAdapter,
  PublishPayload,
  PublishResult,
} from './publishing-adapter.interface';

@Injectable()
export class LinkedInPublishingAdapter implements SocialPublishingAdapter {
  private readonly logger = new Logger(LinkedInPublishingAdapter.name);
  readonly provider: SocialProvider = SocialProvider.LINKEDIN;

  async publish(
    account: {
      provider: SocialProvider;
      providerAccountId: string;
      displayName: string;
    },
    payload: PublishPayload,
    accessToken: string,
  ): Promise<PublishResult> {
    this.logger.log(
      `LinkedInPublishingAdapter: Publishing post ${payload.postId} to account ${account.displayName} (${account.providerAccountId})`,
    );

    // 1. Basic validation
    if (!accessToken || accessToken.trim() === '') {
      return {
        success: false,
        errorCode: 'INVALID_ACCESS_TOKEN',
        errorMessage: 'LinkedIn OAuth token is missing or empty.',
        isTransient: false,
      };
    }

    if (!payload.content || payload.content.trim() === '') {
      return {
        success: false,
        errorCode: 'EMPTY_CONTENT',
        errorMessage: 'LinkedIn post content cannot be empty.',
        isTransient: false,
      };
    }

    // LinkedIn text limit: 3,000 characters
    if (payload.content.length > 3000) {
      return {
        success: false,
        errorCode: 'CONTENT_TOO_LONG',
        errorMessage: `LinkedIn post content exceeds 3,000 characters limit (${payload.content.length} chars).`,
        isTransient: false,
      };
    }

    // If mock token or test environment, return simulated provider post ID
    if (accessToken.startsWith('mock_') || accessToken.startsWith('test_')) {
      return {
        success: true,
        providerPostId: `urn:li:share:${Date.now()}`,
        providerRequestId: `req_li_${Date.now()}`,
        isTransient: false,
      };
    }

    try {
      // LinkedIn UGC Post API endpoint: https://api.linkedin.com/v2/ugcPosts
      const body: Record<string, unknown> = {
        author: `urn:li:person:${account.providerAccountId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: payload.content,
            },
            shareMediaCategory: payload.mediaUrls.length > 0 ? 'IMAGE' : 'NONE',
            ...(payload.mediaUrls.length > 0
              ? {
                  media: payload.mediaUrls.map((url) => ({
                    status: 'READY',
                    originalUrl: url,
                  })),
                }
              : {}),
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isTransient = response.status === 429 || response.status >= 500;
        return {
          success: false,
          errorCode: `LINKEDIN_HTTP_${response.status}`,
          errorMessage: `LinkedIn API error: ${errorText}`,
          isTransient,
          retryAfterSeconds: isTransient ? 60 : undefined,
        };
      }

      const data = (await response.json()) as { id?: string };
      return {
        success: true,
        providerPostId: data.id || `urn:li:share:${Date.now()}`,
        providerRequestId: response.headers.get('x-li-uuid') ?? undefined,
        isTransient: false,
      };
    } catch (err) {
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: (err as Error).message,
        isTransient: true,
        retryAfterSeconds: 30,
      };
    }
  }
}
