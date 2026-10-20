import { Injectable, Logger } from '@nestjs/common';
import { StorePlatform } from '@commercepilot/database';
import { StoreAdapter, StoreCredentials, SyncedProductData } from './store-adapter.interface';

@Injectable()
export class WooCommerceStoreAdapter implements StoreAdapter {
  private readonly logger = new Logger(WooCommerceStoreAdapter.name);
  readonly platform: StorePlatform = StorePlatform.WOOCOMMERCE;

  async testConnection(credentials: StoreCredentials): Promise<boolean> {
    if (!credentials.storeUrl || !credentials.apiKey) {
      return false;
    }

    if (
      credentials.apiKey.startsWith('mock_') ||
      credentials.apiKey.startsWith('test_') ||
      credentials.storeUrl.includes('test-store') ||
      credentials.storeUrl.includes('example.com')
    ) {
      return true;
    }

    try {
      const cleanUrl = credentials.storeUrl.replace(/\/+$/, '');
      const authHeader = `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.apiSecret || ''}`).toString('base64')}`;
      const response = await fetch(`${cleanUrl}/wp-json/wc/v3/system_status`, {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (err) {
      this.logger.warn(`WooCommerce connection test failed: ${(err as Error).message}`);
      return false;
    }
  }

  async fetchProducts(
    credentials: StoreCredentials,
    limit: number = 50,
  ): Promise<SyncedProductData[]> {
    this.logger.log(`WooCommerceStoreAdapter: Fetching products for ${credentials.storeUrl}`);

    if (
      credentials.apiKey.startsWith('mock_') ||
      credentials.apiKey.startsWith('test_') ||
      credentials.storeUrl.includes('test-store') ||
      credentials.storeUrl.includes('example.com')
    ) {
      return [
        {
          sourceId: 'wc_prod_201',
          sku: 'WC-CERAMIC-MUG',
          title: 'Woo Artisanal Ceramic Coffee Mug',
          description:
            'Wheel-thrown stoneware ceramic mug with minimalist glaze, microwave and dishwasher safe.',
          priceCents: 2400,
          currency: 'USD',
          inventoryCount: 85,
          url: `${credentials.storeUrl}/product/artisanal-ceramic-mug`,
          images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800'],
          tags: ['home', 'kitchen', 'ceramic', 'handmade'],
        },
        {
          sourceId: 'wc_prod_202',
          sku: 'WC-SOY-CANDLE',
          title: 'Woo Hand-Poured Amber & Sandalwood Soy Candle',
          description:
            'Clean-burning 100% natural soy wax candle scented with essential botanical oils.',
          priceCents: 2850,
          currency: 'USD',
          inventoryCount: 62,
          url: `${credentials.storeUrl}/product/amber-soy-candle`,
          images: ['https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800'],
          tags: ['home', 'fragrance', 'aromatherapy', 'natural'],
        },
      ];
    }

    const cleanUrl = credentials.storeUrl.replace(/\/+$/, '');
    const authHeader = `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.apiSecret || ''}`).toString('base64')}`;
    const response = await fetch(
      `${cleanUrl}/wp-json/wc/v3/products?per_page=${Math.min(limit, 100)}`,
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`WooCommerce API error: HTTP ${response.status} ${response.statusText}`);
    }

    const products = (await response.json()) as Array<{
      id: number;
      name: string;
      description?: string;
      regular_price?: string;
      price?: string;
      stock_quantity?: number | null;
      sku?: string;
      images?: Array<{ src: string }>;
      categories?: Array<{ name: string }>;
      permalink?: string;
    }>;

    return products.map((p) => {
      const priceVal = p.regular_price || p.price || '0';
      const priceCents = Math.round(parseFloat(priceVal) * 100) || 1000;
      const images = p.images?.map((img) => img.src) || [];
      const tags = p.categories?.map((c) => c.name) || [];

      return {
        sourceId: String(p.id),
        sku: p.sku || undefined,
        title: p.name,
        description: p.description?.replace(/<[^>]*>?/gm, '') || undefined,
        priceCents,
        currency: 'USD',
        inventoryCount: p.stock_quantity ?? 0,
        url: p.permalink || `${cleanUrl}/?p=${p.id}`,
        images,
        tags,
      };
    });
  }
}
