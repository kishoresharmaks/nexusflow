import { Injectable, Logger } from '@nestjs/common';
import { SocialProvider } from '@commercepilot/database';
import {
  SocialPublishingAdapter,
  PublishPayload,
  PublishResult,
} from './publishing-adapter.interface';
import {
  DEFAULT_META_GRAPH_API_VERSION,
  publishInstagramFeedPost,
  type InstagramGraphResult,
} from '../../integrations/instagram/instagram-graph.client';

@Injectable()
export class MetaPublishingAdapter implements SocialPublishingAdapter {
  readonly provider = SocialProvider.META_INSTAGRAM;
  private readonly logger = new Logger(MetaPublishingAdapter.name);
  private readonly graphApiVersion =
    process.env['META_GRAPH_API_VERSION'] || DEFAULT_META_GRAPH_API_VERSION;

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

    const hashtagMatches = payload.content.match(/#[\p{L}\p{N}_]+/gu);
    if (hashtagMatches && hashtagMatches.length > 30) {
      return {
        success: false,
        errorCode: 'TOO_MANY_HASHTAGS',
        errorMessage: `Hashtag count (${hashtagMatches.length}) exceeds Instagram limit of 30.`,
        isTransient: false,
      };
    }

    // Test runtime only — never fabricate provider post IDs in production.
    if (process.env['NODE_ENV'] === 'test') {
      const mockPostId = `${isInstagram ? 'ig' : 'fb'}_test_${Date.now()}`;
      return {
        success: true,
        providerPostId: mockPostId,
        providerRequestId: `meta_test_req_${Date.now()}`,
        isTransient: false,
      };
    }

    try {
      if (isInstagram) {
        const graphResult = await publishInstagramFeedPost({
          igUserId: account.providerAccountId,
          accessToken,
          caption: payload.content,
          mediaUrls: payload.mediaUrls,
          graphApiVersion: this.graphApiVersion,
        });
        return this.mapInstagramResult(graphResult);
      }
      return await this.publishToFacebook(account.providerAccountId, payload, accessToken);
    } catch (networkError) {
      this.logger.warn(
        `Network timeout/failure contacting Meta Graph API: ${(networkError as Error).message}`,
      );
      return {
        success: false,
        errorCode: 'AMBIGUOUS_PUBLISH_OUTCOME',
        errorMessage: 'Ambiguous outcome: network error contacting Meta Graph API.',
        isTransient: false,
      };
    }
  }

  private mapInstagramResult(result: InstagramGraphResult): PublishResult {
    if (result.success) {
      return {
        success: true,
        providerPostId: result.providerPostId,
        ...(result.providerRequestId ? { providerRequestId: result.providerRequestId } : {}),
        isTransient: false,
      };
    }

    const isTransient = result.ambiguous ? false : result.isTransient;
    return {
      success: false,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      isTransient,
      ...(isTransient && result.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: result.retryAfterSeconds }
        : {}),
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

    const body = new URLSearchParams({
      access_token: accessToken,
      ...(hasMedia
        ? { url: payload.mediaUrls[0]!, caption: payload.content }
        : { message: payload.content }),
    });

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
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
        providerRequestId: res.headers.get('x-fb-request-id') ?? undefined,
        isTransient: false,
      };
    } catch (networkError) {
      return {
        success: false,
        errorCode: 'AMBIGUOUS_PUBLISH_OUTCOME',
        errorMessage: (networkError as Error).message || 'Ambiguous Facebook publish outcome.',
        isTransient: false,
      };
    }
  }

  private classifyMetaError(
    httpStatus: number,
    error?: { code: number; message: string; subcode?: number },
  ): PublishResult {
    const errCode = error?.code ?? httpStatus;
    const errMsg = error?.message ?? `Meta API request failed with HTTP ${httpStatus}`;

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
