import { Injectable, Logger } from '@nestjs/common';
import { SocialProvider } from '@commercepilot/database';
import {
  SocialPublishingAdapter,
  PublishPayload,
  PublishResult,
} from './publishing-adapter.interface';

@Injectable()
export class PinterestPublishingAdapter implements SocialPublishingAdapter {
  private readonly logger = new Logger(PinterestPublishingAdapter.name);
  readonly provider: SocialProvider = SocialProvider.PINTEREST;

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
      `PinterestPublishingAdapter: Publishing pin for post ${payload.postId} to board of ${account.displayName}`,
    );

    if (!accessToken || accessToken.trim() === '') {
      return {
        success: false,
        errorCode: 'INVALID_ACCESS_TOKEN',
        errorMessage: 'Pinterest OAuth token is missing or empty.',
        isTransient: false,
      };
    }

    // Pinterest requires an image asset for every pin
    if (!payload.mediaUrls || payload.mediaUrls.length === 0) {
      return {
        success: false,
        errorCode: 'MEDIA_REQUIRED',
        errorMessage: 'Pinterest requires at least one media image URL to create a pin.',
        isTransient: false,
      };
    }

    if (accessToken.startsWith('mock_') || accessToken.startsWith('test_')) {
      return {
        success: true,
        providerPostId: `pin_${Date.now()}`,
        providerRequestId: `req_pin_${Date.now()}`,
        isTransient: false,
      };
    }

    try {
      const title = payload.content.slice(0, 100);
      const description = payload.content.slice(0, 500);

      const response = await fetch('https://api.pinterest.com/v5/pins', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          board_id: account.providerAccountId,
          title,
          description,
          media_source: {
            source_type: 'image_url',
            url: payload.mediaUrls[0],
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const isTransient = response.status === 429 || response.status >= 500;
        return {
          success: false,
          errorCode: `PINTEREST_HTTP_${response.status}`,
          errorMessage: `Pinterest API error: ${errorText}`,
          isTransient,
          retryAfterSeconds: isTransient ? 120 : undefined,
        };
      }

      const data = (await response.json()) as { id?: string };
      return {
        success: true,
        providerPostId: data.id || `pin_${Date.now()}`,
        providerRequestId: response.headers.get('x-pinterest-rid') ?? undefined,
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
