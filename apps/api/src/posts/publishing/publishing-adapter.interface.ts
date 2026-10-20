import { SocialProvider } from '@commercepilot/database';

export interface PublishResult {
  success: boolean;
  providerPostId?: string | undefined;
  providerRequestId?: string | undefined;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  isTransient: boolean;
  retryAfterSeconds?: number | undefined;
}

export interface PublishPayload {
  postId: string;
  content: string;
  mediaUrls: string[];
}

export interface SocialPublishingAdapter {
  readonly provider: SocialProvider;
  publish(
    account: {
      provider: SocialProvider;
      providerAccountId: string;
      displayName: string;
    },
    payload: PublishPayload,
    accessToken: string,
  ): Promise<PublishResult>;
}
