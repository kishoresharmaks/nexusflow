import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import path from 'path';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { EmailModule } from './email/email.module';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ProductsModule } from './products/products.module';
import { AiModule } from './ai/ai.module';
import { MediaModule } from './media/media.module';
import { SocialModule } from './social/social.module';
import { PostsModule } from './posts/posts.module';
import { BillingModule } from './billing/billing.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { StoreConnectionsModule } from './integrations/stores/store-connections.module';
import { LinkedInIntegrationModule } from './integrations/linkedin/linkedin.module';
import { InstagramIntegrationModule } from './integrations/instagram/instagram.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { TrackingModule } from './tracking/tracking.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SuperAdminModule } from './super-admin/super-admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        '.env',
        '../../.env',
      ],
      load: [configuration],
    }),
    DatabaseModule,
    RateLimitModule,
    EmailModule,
    AuditModule,
    AuthModule,
    WorkspacesModule,
    ProductsModule,
    AiModule,
    MediaModule,
    SocialModule,
    PostsModule,
    BillingModule,
    WebhooksModule,
    StoreConnectionsModule,
    LinkedInIntegrationModule,
    InstagramIntegrationModule,
    CampaignsModule,
    TrackingModule,
    AnalyticsModule,
    SuperAdminModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes('{*path}');
  }
}
