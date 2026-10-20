import { Injectable, Logger } from '@nestjs/common';
import { SocialProvider } from '@commercepilot/database';
import {
  SocialPublishingAdapter,
  PublishPayload,
  PublishResult,
} from './publishing-adapter.interface';

@Injectable()
export class TwitterPublishingAdapter implements SocialPublishingAdapter {
  private readonly logger = new Logger(TwitterPublishingAdapter.name);
  readonly provider: SocialProvider = SocialProvider.TWITTER;

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
      `TwitterPublishingAdapter: Publishing tweet for post ${payload.postId} to account ${account.displayName}`,
    );

    if (!accessToken || accessToken.trim() === '') {
      return {
        success: false,
        errorCode: 'INVALID_ACCESS_TOKEN',
        errorMessage: 'Twitter/X OAuth token is missing or empty.',
        isTransient: false,
      };
    }

    if (!payload.content || payload.content.trim() === '') {
      return {
        success: false,
        errorCode: 'EMPTY_CONTENT',
        errorMessage: 'Tweet text cannot be empty.',
        isTransient: false,
      };
    }

    // Twitter standard character limit: 280 characters
    if (payload.content.length > 280) {
      return {
        success: false,
        errorCode: 'CONTENT_TOO_LONG',
        errorMessage: `Tweet exceeds 280 character limit (${payload.content.length} chars).`,
        isTransient: false,
      };
    }

    if (accessToken.startsWith('mock_') || accessToken.startsWith('test_')) {
      return {
        success: true,
        providerPostId: `tweet_${Date.now()}`,
        providerRequestId: `req_x_${Date.now()}`,
        isTransient: false,
      };
    }

    try {
      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: payload.content,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isTransient = response.status === 429 || response.status >= 500;
        return {
          success: false,
          errorCode: `TWITTER_HTTP_${response.status}`,
          errorMessage: `Twitter API error: ${errorText}`,
          isTransient,
          retryAfterSeconds: isTransient ? 900 : undefined,
        };
      }

      const data = (await response.json()) as { data?: { id?: string } };
      return {
        success: true,
        providerPostId: data.data?.id || `tweet_${Date.now()}`,
        providerRequestId: response.headers.get('x-response-time') ?? undefined,
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
