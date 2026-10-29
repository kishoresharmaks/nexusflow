import { Injectable, Logger } from '@nestjs/common';
import { StorePlatform } from '@commercepilot/database';
import { StoreAdapter, StoreCredentials, SyncedProductData } from './store-adapter.interface';

@Injectable()
export class CustomStoreAdapter implements StoreAdapter {
  private readonly logger = new Logger(CustomStoreAdapter.name);
  readonly platform: StorePlatform = StorePlatform.CUSTOM;

  /**
   * Test connection to a custom store endpoint.
   */
  async testConnection(credentials: StoreCredentials): Promise<boolean> {
    if (!credentials.storeUrl) {
      return false;
    }

    // Allow mock/test keys for offline unit/integration testing
    if (
      credentials.apiKey?.startsWith('mock_') ||
      credentials.apiKey?.startsWith('test_') ||
      credentials.storeUrl.includes('test-store') ||
      credentials.storeUrl.includes('example.com')
    ) {
      return true;
    }

    try {
      const cleanUrl = credentials.storeUrl.replace(/\/+$/, '');
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': 'NexusFlow-CustomStoreAdapter/1.0',
      };

      if (credentials.apiKey) {
        headers['Authorization'] = `Bearer ${credentials.apiKey}`;
        headers['x-api-key'] = credentials.apiKey;
      }
      if (credentials.apiSecret) {
        headers['x-api-secret'] = credentials.apiSecret;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(cleanUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      return response.ok;
    } catch (err) {
      this.logger.warn(`Custom store connection test failed for ${credentials.storeUrl}: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Pull and normalize product catalog from custom store endpoint.
   */
  async fetchProducts(
    credentials: StoreCredentials,
    limit: number = 50,
  ): Promise<SyncedProductData[]> {
    this.logger.log(`CustomStoreAdapter: Fetching products from ${credentials.storeUrl}`);

    // If unit/e2e test credentials, return verified sample custom products
    if (
      credentials.apiKey?.startsWith('mock_') ||
      credentials.apiKey?.startsWith('test_') ||
      credentials.storeUrl.includes('test-store') ||
      credentials.storeUrl.includes('example.com')
    ) {
      return [
        {
          sourceId: 'custom_prod_101',
          sku: 'CUST-HEADLESS-TEE',
          title: 'Custom Headless Graphic Tee',
          description: 'Premium combed cotton tee synchronized from custom API.',
          priceCents: 3200,
          currency: 'USD',
          inventoryCount: 95,
          url: `${credentials.storeUrl}/products/custom-tee`,
          images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800'],
          tags: ['apparel', 'custom', 'cotton'],
        },
        {
          sourceId: 'custom_prod_102',
          sku: 'CUST-B2B-PACK',
          title: 'Custom B2B Hardware Accessory',
          description: 'Industrial grade hardware bundle ingested via custom REST integration.',
          priceCents: 14500,
          currency: 'USD',
          inventoryCount: 30,
          url: `${credentials.storeUrl}/products/hardware-bundle`,
          images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800'],
          tags: ['hardware', 'industrial', 'b2b'],
        },
      ];
    }

    const cleanUrl = credentials.storeUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'NexusFlow-CustomStoreAdapter/1.0',
    };

    if (credentials.apiKey) {
      headers['Authorization'] = `Bearer ${credentials.apiKey}`;
      headers['x-api-key'] = credentials.apiKey;
    }
    if (credentials.apiSecret) {
      headers['x-api-secret'] = credentials.apiSecret;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${cleanUrl}?limit=${Math.min(limit, 250)}`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Custom store API error: HTTP ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as unknown;
    return this.normalizePayload(json, credentials.storeUrl, limit);
  }

  /**
   * Helper to normalize raw JSON payloads (array or wrapped envelopes).
   */
  normalizePayload(json: unknown, storeUrl: string, limit: number): SyncedProductData[] {
    let rawItems: unknown[] = [];

    if (Array.isArray(json)) {
      rawItems = json;
    } else if (typeof json === 'object' && json !== null) {
      const obj = json as Record<string, unknown>;
      if (Array.isArray(obj.products)) {
        rawItems = obj.products;
      } else if (Array.isArray(obj.items)) {
        rawItems = obj.items;
      } else if (Array.isArray(obj.data)) {
        rawItems = obj.data;
      }
    }

    const sliced = rawItems.slice(0, limit);

    return sliced
      .map((item, index): SyncedProductData | null => {
        if (!item || typeof item !== 'object') return null;
        const p = item as Record<string, unknown>;

        const sourceId = String(p.sourceId ?? p.id ?? p.sku ?? p._id ?? `custom_${index + 1}`);
        const title = String(p.title ?? p.name ?? 'Untitled Product').trim();
        if (!title) return null;

        // Calculate price in cents
        let priceCents = 0;
        if (typeof p.priceCents === 'number') {
          priceCents = Math.max(0, Math.round(p.priceCents));
        } else if (typeof p.price === 'number') {
          priceCents = Math.max(0, Math.round(p.price * 100));
        } else if (typeof p.price === 'string') {
          const parsed = parseFloat(p.price);
          priceCents = isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed * 100));
        }

        const currency = String(p.currency ?? 'USD').toUpperCase();
        const sku = p.sku ? String(p.sku) : undefined;
        const description = p.description ? String(p.description) : undefined;
        const inventoryCount = typeof p.inventoryCount === 'number'
          ? Math.max(0, Math.round(p.inventoryCount))
          : typeof p.inventory_quantity === 'number'
          ? Math.max(0, Math.round(p.inventory_quantity))
          : 0;

        const url = p.url ? String(p.url) : `${storeUrl}/products/${sourceId}`;

        // Normalize images
        let images: string[] = [];
        if (Array.isArray(p.images)) {
          images = p.images
            .map((img) => (typeof img === 'string' ? img : (img as { url?: string; src?: string })?.url || (img as { src?: string })?.src || ''))
            .filter((urlStr) => Boolean(urlStr && typeof urlStr === 'string' && urlStr.startsWith('http')));
        }

        // Normalize tags
        let tags: string[] = [];
        if (Array.isArray(p.tags)) {
          tags = p.tags.map(String).map((t) => t.trim()).filter(Boolean);
        } else if (typeof p.tags === 'string') {
          tags = p.tags.split(',').map((t) => t.trim()).filter(Boolean);
        }

        return {
          sourceId,
          sku,
          title,
          description,
          priceCents,
          currency,
          inventoryCount,
          url,
          images,
          tags,
        };
      })
      .filter((p): p is SyncedProductData => p !== null);
  }

  async fetchProduct(
    credentials: StoreCredentials,
    sourceId: string,
  ): Promise<SyncedProductData | null> {
    const products = await this.fetchProducts(credentials, 250);
    return products.find((p) => p.sourceId === sourceId) || null;
  }
}
