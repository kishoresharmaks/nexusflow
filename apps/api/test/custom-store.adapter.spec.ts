import { describe, it, expect, beforeEach } from 'vitest';
import { CustomStoreAdapter } from '../src/integrations/stores/custom-store.adapter';
import { StorePlatform } from '@commercepilot/database';

describe('CustomStoreAdapter', () => {
  let adapter: CustomStoreAdapter;

  beforeEach(() => {
    adapter = new CustomStoreAdapter();
  });

  it('has platform set to StorePlatform.CUSTOM', () => {
    expect(adapter.platform).toBe(StorePlatform.CUSTOM);
  });

  it('rejects testConnection when storeUrl is empty', async () => {
    const result = await adapter.testConnection({
      platform: StorePlatform.CUSTOM,
      storeUrl: '',
      apiKey: 'test_token',
    });
    expect(result).toBe(false);
  });

  it('accepts testConnection for test/mock credentials', async () => {
    const result = await adapter.testConnection({
      platform: StorePlatform.CUSTOM,
      storeUrl: 'https://test-store.example.com/api/products',
      apiKey: 'test_secret_123',
    });
    expect(result).toBe(true);
  });

  it('normalizes a flat array of custom products', () => {
    const payload = [
      {
        sourceId: 'PROD-1',
        title: 'Mechanical Keyboard',
        priceCents: 12900,
        currency: 'USD',
        inventoryCount: 25,
        sku: 'KB-MECH-01',
        description: 'RGB mechanical gaming keyboard.',
        url: 'https://store.example.com/keyboard',
        images: ['https://images.example.com/kb.jpg'],
        tags: ['gaming', 'accessories'],
      },
    ];

    const result = adapter.normalizePayload(payload, 'https://store.example.com', 50);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      sourceId: 'PROD-1',
      title: 'Mechanical Keyboard',
      priceCents: 12900,
      currency: 'USD',
      inventoryCount: 25,
      sku: 'KB-MECH-01',
      description: 'RGB mechanical gaming keyboard.',
      url: 'https://store.example.com/keyboard',
      images: ['https://images.example.com/kb.jpg'],
      tags: ['gaming', 'accessories'],
    });
  });

  it('unwraps an object envelope with { products: [...] }', () => {
    const payload = {
      products: [
        {
          id: 'item-99',
          name: 'Wireless Mouse',
          price: 49.99,
          currency: 'eur',
          inventory_quantity: 40,
          tags: 'tech, wireless, mouse',
        },
      ],
    };

    const result = adapter.normalizePayload(payload, 'https://store.example.com', 50);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('item-99');
    expect(result[0].title).toBe('Wireless Mouse');
    expect(result[0].priceCents).toBe(4999);
    expect(result[0].currency).toBe('EUR');
    expect(result[0].inventoryCount).toBe(40);
    expect(result[0].tags).toEqual(['tech', 'wireless', 'mouse']);
  });

  it('filters out items without a valid title or object structure', () => {
    const payload = [
      null,
      'invalid item',
      { title: '', priceCents: 100 },
      { sourceId: 'VALID-1', title: 'Valid Item', priceCents: 500 },
    ];

    const result = adapter.normalizePayload(payload, 'https://store.example.com', 50);
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('VALID-1');
  });

  it('fetches sample products for test credentials', async () => {
    const products = await adapter.fetchProducts({
      platform: StorePlatform.CUSTOM,
      storeUrl: 'https://test-store.example.com/api',
      apiKey: 'test_key',
    });

    expect(products.length).toBeGreaterThan(0);
    expect(products[0].sourceId).toBeDefined();
    expect(products[0].title).toBeDefined();
  });
});
