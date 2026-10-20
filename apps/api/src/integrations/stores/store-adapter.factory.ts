import { Injectable, BadRequestException } from '@nestjs/common';
import { StorePlatform } from '@commercepilot/database';
import { StoreAdapter } from './store-adapter.interface';
import { ShopifyStoreAdapter } from './shopify-store.adapter';
import { WooCommerceStoreAdapter } from './woocommerce-store.adapter';

@Injectable()
export class StoreAdapterFactory {
  constructor(
    private readonly shopifyAdapter: ShopifyStoreAdapter,
    private readonly wooCommerceAdapter: WooCommerceStoreAdapter,
  ) {}

  getAdapter(platform: StorePlatform): StoreAdapter {
    switch (platform) {
      case StorePlatform.SHOPIFY:
        return this.shopifyAdapter;
      case StorePlatform.WOOCOMMERCE:
        return this.wooCommerceAdapter;
      default:
        throw new BadRequestException(`Unsupported store platform: ${platform}`);
    }
  }
}
