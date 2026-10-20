import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { MetaPublishingAdapter } from './publishing/meta-publishing-adapter';
import { MockSocialPublishingAdapter } from './publishing/mock-publishing-adapter';
import { LinkedInPublishingAdapter } from './publishing/linkedin-publishing-adapter';
import { TwitterPublishingAdapter } from './publishing/twitter-publishing-adapter';
import { PinterestPublishingAdapter } from './publishing/pinterest-publishing-adapter';
import { PublishingAdapterFactory } from './publishing/publishing-adapter.factory';
import { PublishingQueueService } from './publishing-queue.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, WorkspacesModule, SocialModule],
  controllers: [PostsController],
  providers: [
    PostsService,
    MetaPublishingAdapter,
    MockSocialPublishingAdapter,
    LinkedInPublishingAdapter,
    TwitterPublishingAdapter,
    PinterestPublishingAdapter,
    PublishingAdapterFactory,
    PublishingQueueService,
  ],
  exports: [PostsService, PublishingAdapterFactory, PublishingQueueService],
})
export class PostsModule {}
