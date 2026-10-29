import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../../audit/audit.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspacesModule } from '../../workspaces/workspaces.module';
import { WebhooksModule } from '../../webhooks/webhooks.module';
import { StoreConnectionsService } from './store-connections.service';
import { StoreConnectionsController } from './store-connections.controller';
import { CustomStoreController } from './custom-store.controller';
import { StoreAdapterFactory } from './store-adapter.factory';
import { ShopifyStoreAdapter } from './shopify-store.adapter';
import { WooCommerceStoreAdapter } from './woocommerce-store.adapter';
import { CustomStoreAdapter } from './custom-store.adapter';
import { ShopifyOAuthService } from './shopify-oauth/shopify-oauth.service';
import { ShopifyOAuthController } from './shopify-oauth/shopify-oauth.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, WorkspacesModule, WebhooksModule],
  controllers: [StoreConnectionsController, CustomStoreController, ShopifyOAuthController],
  providers: [
    StoreConnectionsService,
    StoreAdapterFactory,
    ShopifyStoreAdapter,
    WooCommerceStoreAdapter,
    CustomStoreAdapter,
    ShopifyOAuthService,
  ],
  exports: [StoreConnectionsService, StoreAdapterFactory, CustomStoreAdapter, ShopifyOAuthService],
})
export class StoreConnectionsModule {}
