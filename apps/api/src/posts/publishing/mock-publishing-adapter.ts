import { Injectable } from '@nestjs/common';
import { SocialProvider } from '@commercepilot/database';
import {
  SocialPublishingAdapter,
  PublishPayload,
  PublishResult,
} from './publishing-adapter.interface';

@Injectable()
export class MockSocialPublishingAdapter implements SocialPublishingAdapter {
  readonly provider = SocialProvider.LINKEDIN;

  async publish(
    account: {
      provider: SocialProvider;
      providerAccountId: string;
      displayName: string;
    },
    payload: PublishPayload,
    accessToken: string,
  ): Promise<PublishResult> {
    // Check for simulated test triggers
    if (
      accessToken.includes('fail-transient') ||
      payload.content.includes('[SIMULATE_TRANSIENT_ERROR]')
    ) {
      return {
        success: false,
        errorCode: 'PROVIDER_RATE_LIMIT',
        errorMessage: 'Temporary rate limit reached on provider.',
        isTransient: true,
        retryAfterSeconds: 30,
      };
    }

    if (
      accessToken.includes('fail-permanent') ||
      payload.content.includes('[SIMULATE_PERMANENT_ERROR]')
    ) {
      return {
        success: false,
        errorCode: 'ACCOUNT_SUSPENDED',
        errorMessage: 'Target account permissions revoked or suspended.',
        isTransient: false,
      };
    }

    if (payload.content.includes('[SIMULATE_AMBIGUOUS_TIMEOUT]')) {
      return {
        success: false,
        errorCode: 'AMBIGUOUS_TIMEOUT',
        errorMessage: 'Request timed out after dispatching; provider state uncertain.',
        isTransient: false,
      };
    }

    // Default successful publish
    const providerPrefix = account.provider.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return {
      success: true,
      providerPostId: `${providerPrefix}_pub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      providerRequestId: `req_${Date.now()}`,
      isTransient: false,
    };
  }
}
