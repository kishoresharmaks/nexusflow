import { Injectable } from '@nestjs/common';
import { SocialProvider } from '@commercepilot/database';
import { SocialPublishingAdapter } from './publishing-adapter.interface';
import { MetaPublishingAdapter } from './meta-publishing-adapter';
import { MockSocialPublishingAdapter } from './mock-publishing-adapter';
import { LinkedInPublishingAdapter } from './linkedin-publishing-adapter';
import { TwitterPublishingAdapter } from './twitter-publishing-adapter';
import { PinterestPublishingAdapter } from './pinterest-publishing-adapter';

@Injectable()
export class PublishingAdapterFactory {
  constructor(
    private readonly metaAdapter: MetaPublishingAdapter,
    private readonly linkedInAdapter: LinkedInPublishingAdapter,
    private readonly twitterAdapter: TwitterPublishingAdapter,
    private readonly pinterestAdapter: PinterestPublishingAdapter,
    private readonly mockAdapter: MockSocialPublishingAdapter,
  ) {}

  getAdapter(provider: SocialProvider): SocialPublishingAdapter {
    switch (provider) {
      case SocialProvider.META_INSTAGRAM:
      case SocialProvider.META_FACEBOOK:
        return this.metaAdapter;
      case SocialProvider.LINKEDIN:
        return this.linkedInAdapter;
      case SocialProvider.TWITTER:
        return this.twitterAdapter;
      case SocialProvider.PINTEREST:
        return this.pinterestAdapter;
      case SocialProvider.TIKTOK:
      case SocialProvider.YOUTUBE:
      default:
        return this.mockAdapter;
    }
  }
}
