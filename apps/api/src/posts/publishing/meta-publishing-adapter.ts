import { Injectable, Logger } from '@nestjs/common';
import { SocialProvider } from '@commercepilot/database';
import {
  SocialPublishingAdapter,
  PublishPayload,
  PublishResult,
} from './publishing-adapter.interface';

@Injectable()
export class MetaPublishingAdapter implements SocialPublishingAdapter {
  readonly provider = SocialProvider.META_INSTAGRAM;
  private readonly logger = new Logger(MetaPublishingAdapter.name);
  private readonly graphApiVersion = 'v19.0';

  async publish(
    account: {
      provider: SocialProvider;
      providerAccountId: string;
      displayName: string;
    },
    payload: PublishPayload,
    accessToken: string,
  ): Promise<PublishResult> {
    const isInstagram = account.provider === SocialProvider.META_INSTAGRAM;

    // 1. Validate platform constraints
    if (isInstagram && payload.mediaUrls.length === 0) {
      return {
        success: false,
        errorCode: 'MEDIA_REQUIRED',
        errorMessage: 'Instagram Feed posts require at least one image or video media URL.',
        isTransient: false,
      };
    }

    if (payload.content.length > 2200) {
      return {
        success: false,
        errorCode: 'CAPTION_TOO_LONG',
        errorMessage: `Content length (${payload.content.length}) exceeds Meta character limit of 2,200.`,
        isTransient: false,
      };
    }

    const hashtagMatches = payload.content.match(/#[a-zA-Z0-9_]+/g);
    if (hashtagMatches && hashtagMatches.length > 30) {
      return {
        success: false,
        errorCode: 'TOO_MANY_HASHTAGS',
        errorMessage: `Hashtag count (${hashtagMatches.length}) exceeds Instagram limit of 30.`,
        isTransient: false,
      };
    }

    // 2. In test/dev environment or simulated test accounts:
    if (
      process.env['NODE_ENV'] === 'test' ||
      accessToken.startsWith('mock-') ||
      accessToken.startsWith('test-') ||
      account.providerAccountId.startsWith('test-') ||
      account.providerAccountId.startsWith('mock-')
    ) {
      const mockPostId = `${isInstagram ? 'ig' : 'fb'}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return {
        success: true,
        providerPostId: mockPostId,
        providerRequestId: `meta_req_${Date.now()}`,
        isTransient: false,
      };
    }

    // 3. Official Meta Graph API call
    try {
      if (isInstagram) {
        return await this.publishToInstagram(account.providerAccountId, payload, accessToken);
      } else {
        return await this.publishToFacebook(account.providerAccountId, payload, accessToken);
      }
    } catch (networkError) {
      this.logger.warn(
        `Network timeout/failure contacting Meta Graph API: ${(networkError as Error).message}`,
      );
      return {
        success: false,
        errorCode: 'NETWORK_TIMEOUT',
        errorMessage: 'Ambiguous outcome: network error contacting Meta Graph API.',
        isTransient: true,
        retryAfterSeconds: 60,
      };
    }
  }

  /**
   * Official Instagram 2-step container publication flow:
   * Step 1: Create media container (POST /{ig-user-id}/media)
   * Step 2: Publish media container (POST /{ig-user-id}/media_publish)
   */
  private async publishToInstagram(
    igUserId: string,
    payload: PublishPayload,
    accessToken: string,
  ): Promise<PublishResult> {
    const isVideo = payload.mediaUrls[0]?.match(/\.(mp4|mov)(\?.*)?$/i);
    const containerEndpoint = `https://graph.facebook.com/${this.graphApiVersion}/${igUserId}/media`;

    const containerBody: Record<string, string> = {
      access_token: accessToken,
      caption: payload.content,
    };

    if (isVideo) {
      containerBody['media_type'] = 'VIDEO';
      containerBody['video_url'] = payload.mediaUrls[0]!;
    } else {
      containerBody['image_url'] = payload.mediaUrls[0]!;
    }

    const containerRes = await fetch(containerEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody),
    });

    const containerData = (await containerRes.json()) as {
      id?: string;
      error?: { code: number; message: string; subcode?: number };
    };

    if (!containerRes.ok || !containerData.id || containerData.error) {
      return this.classifyMetaError(containerRes.status, containerData.error);
    }

    const creationId = containerData.id;

    // Step 2: Publish container
    const publishEndpoint = `https://graph.facebook.com/${this.graphApiVersion}/${igUserId}/media_publish`;
    const publishRes = await fetch(publishEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    });

    const publishData = (await publishRes.json()) as {
      id?: string;
      error?: { code: number; message: string; subcode?: number };
    };

    if (!publishRes.ok || !publishData.id || publishData.error) {
      return this.classifyMetaError(publishRes.status, publishData.error);
    }

    return {
      success: true,
      providerPostId: publishData.id,
      providerRequestId: publishRes.headers.get('x-fb-request-id') ?? `meta_req_${Date.now()}`,
      isTransient: false,
    };
  }

  /**
   * Official Facebook Page Feed publication flow:
   * Photo post via /{page-id}/photos or status/link post via /{page-id}/feed
   */
  private async publishToFacebook(
    pageId: string,
    payload: PublishPayload,
    accessToken: string,
  ): Promise<PublishResult> {
    const hasMedia = payload.mediaUrls.length > 0;
    const endpoint = hasMedia
      ? `https://graph.facebook.com/${this.graphApiVersion}/${pageId}/photos`
      : `https://graph.facebook.com/${this.graphApiVersion}/${pageId}/feed`;

    const body: Record<string, string> = {
      access_token: accessToken,
      ...(hasMedia
        ? { url: payload.mediaUrls[0]!, caption: payload.content }
        : { message: payload.content }),
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      id?: string;
      post_id?: string;
      error?: { code: number; message: string; subcode?: number };
    };

    if (!res.ok || (!data.id && !data.post_id) || data.error) {
      return this.classifyMetaError(res.status, data.error);
    }

    return {
      success: true,
      providerPostId: data.post_id || data.id,
      providerRequestId: res.headers.get('x-fb-request-id') ?? `meta_req_${Date.now()}`,
      isTransient: false,
    };
  }

  private classifyMetaError(
    httpStatus: number,
    error?: { code: number; message: string; subcode?: number },
  ): PublishResult {
    const errCode = error?.code ?? httpStatus;
    const errMsg = error?.message ?? `Meta API request failed with HTTP ${httpStatus}`;

    // Rate limits (4, 17, 32) or Server 5xx (2, 500+)
    const isRateLimit = errCode === 4 || errCode === 17 || errCode === 32;
    const isServer5xx = errCode === 2 || httpStatus >= 500;
    const isTransient = isRateLimit || isServer5xx;

    const retryAfterSeconds = isRateLimit ? 300 : isTransient ? 60 : undefined;

    return {
      success: false,
      errorCode: `META_ERR_${errCode}`,
      errorMessage: errMsg,
      isTransient,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    };
  }
}
