import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../../audit/audit.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspacesModule } from '../../workspaces/workspaces.module';
import { StoreConnectionsService } from './store-connections.service';
import { StoreConnectionsController } from './store-connections.controller';
import { StoreAdapterFactory } from './store-adapter.factory';
import { ShopifyStoreAdapter } from './shopify-store.adapter';
import { WooCommerceStoreAdapter } from './woocommerce-store.adapter';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, WorkspacesModule],
  controllers: [StoreConnectionsController],
  providers: [
    StoreConnectionsService,
    StoreAdapterFactory,
    ShopifyStoreAdapter,
    WooCommerceStoreAdapter,
  ],
  exports: [StoreConnectionsService, StoreAdapterFactory],
})
export class StoreConnectionsModule {}
