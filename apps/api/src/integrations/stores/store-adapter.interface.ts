import { StorePlatform } from '@commercepilot/database';

export interface StoreCredentials {
  platform: StorePlatform;
  storeUrl: string;
  apiKey: string;
  apiSecret?: string | undefined;
  apiVersion?: string | undefined;
}

export interface SyncedProductData {
  sourceId: string;
  sku?: string | undefined;
  title: string;
  description?: string | undefined;
  priceCents: number;
  currency: string;
  inventoryCount: number;
  url?: string | undefined;
  images: string[];
  tags: string[];
}

export interface StoreAdapter {
  readonly platform: StorePlatform;
  testConnection(credentials: StoreCredentials): Promise<boolean>;
  fetchProducts(credentials: StoreCredentials, limit?: number): Promise<SyncedProductData[]>;
  fetchProduct?(credentials: StoreCredentials, sourceId: string): Promise<SyncedProductData | null>;
}
