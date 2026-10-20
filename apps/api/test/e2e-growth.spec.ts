import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { StorePlatform, StoreSyncStatus } from '@commercepilot/database';

describe('E2E Store Integrations, Campaigns, Attribution, and Analytics Flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  let tenant1Token: string;
  let tenant1WorkspaceId: string;

  let tenant2Token: string;
  let tenant2WorkspaceId: string;

  let createdStoreId: string;
  let createdCampaignId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'ready', 'api/v1/health', 'api/v1/ready'],
    });

    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    prisma = app.get<PrismaService>(PrismaService);

    // Setup Tenant 1
    const t1Email = `growth_t1_${Date.now()}@commercepilot.test`;
    const t1Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Growth Seller One',
        email: t1Email,
        password: 'Password123!',
      }),
    });
    const t1Data = (await t1Res.json()) as { sessionToken: string; user: { id: string } };
    tenant1Token = t1Data.sessionToken;

    const t1WsRes = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ name: 'Growth Workspace Alpha' }),
    });
    const t1WsData = (await t1WsRes.json()) as { workspace: { id: string } };
    tenant1WorkspaceId = t1WsData.workspace.id;

    // Setup Tenant 2
    const t2Email = `growth_t2_${Date.now()}@commercepilot.test`;
    const t2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Growth Seller Two',
        email: t2Email,
        password: 'Password123!',
      }),
    });
    const t2Data = (await t2Res.json()) as { sessionToken: string; user: { id: string } };
    tenant2Token = t2Data.sessionToken;

    const t2WsRes = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({ name: 'Growth Workspace Beta' }),
    });
    const t2WsData = (await t2WsRes.json()) as { workspace: { id: string } };
    tenant2WorkspaceId = t2WsData.workspace.id;
  });

  afterAll(async () => {
    // Cleanup records created for these workspaces
    if (tenant1WorkspaceId) {
      await prisma.product.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
      await prisma.storeConnection.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
      await prisma.campaign.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
      await prisma.trackedClick.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
      await prisma.conversionEvent.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
      await prisma.workspace.delete({ where: { id: tenant1WorkspaceId } }).catch(() => {});
    }
    if (tenant2WorkspaceId) {
      await prisma.workspace.delete({ where: { id: tenant2WorkspaceId } }).catch(() => {});
    }
    await app.close();
  });

  it('1. Connects Shopify store with encrypted credentials and masked keys', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/integrations/stores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        platform: StorePlatform.SHOPIFY,
        storeName: 'Alpha Flagship Store',
        storeUrl: 'https://test-store.myshopify.com',
        apiKey: 'shpat_test_mock_token_123',
        apiVersion: '2024-01',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      platform: string;
      storeName: string;
      apiKeyMasked: string;
      syncStatus: string;
    };

    expect(body.id).toBeDefined();
    expect(body.platform).toBe(StorePlatform.SHOPIFY);
    expect(body.storeName).toBe('Alpha Flagship Store');
    expect(body.apiKeyMasked).toBe('••••••••');
    expect(body.syncStatus).toBe(StoreSyncStatus.IDLE);

    createdStoreId = body.id;
  });

  it('2. Synchronizes catalog from connected Shopify store into workspace products', async () => {
    const res = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/integrations/stores/${createdStoreId}/sync`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tenant1Token}`,
        },
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      synced: number;
      status: string;
      message: string;
    };

    expect(body.synced).toBeGreaterThan(0);
    expect(body.status).toBe(StoreSyncStatus.SUCCESS);

    // Verify products exist in database under Tenant 1
    const products = await prisma.product.findMany({
      where: { workspaceId: tenant1WorkspaceId, source: StorePlatform.SHOPIFY },
    });
    expect(products.length).toBe(body.synced);
    expect(products[0]?.priceCents).toBeGreaterThan(0);
  });

  it('3. Creates a marketing campaign with UTM campaign identifier', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        name: 'Spring Brand Relaunch 2026',
        description: 'Multi-channel acquisition campaign for new apparel line.',
        utmCampaign: 'spring-relaunch-2026',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      name: string;
      utmCampaign: string;
    };

    expect(body.id).toBeDefined();
    expect(body.name).toBe('Spring Brand Relaunch 2026');
    expect(body.utmCampaign).toBe('spring-relaunch-2026');

    createdCampaignId = body.id;
  });

  it('4. Generates RFC 3986 compliant UTM tagged URLs', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/campaigns/generate-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        baseUrl: 'https://myshop.com/products/organic-tee',
        utmSource: 'instagram',
        utmMedium: 'stories',
        utmCampaign: 'spring-relaunch-2026',
        utmContent: 'reel_variant_a',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      taggedUrl: string;
      utmParameters: Record<string, string>;
    };

    expect(body.taggedUrl).toContain('utm_source=instagram');
    expect(body.taggedUrl).toContain('utm_medium=stories');
    expect(body.taggedUrl).toContain('utm_campaign=spring-relaunch-2026');
    expect(body.utmParameters['utm_source']).toBe('instagram');
  });

  it('5. Records tracked clicks and order conversion events', async () => {
    // 1. Record Click
    const clickRes = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/tracking/clicks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        targetUrl: 'https://myshop.com/products/organic-tee',
        campaignId: createdCampaignId,
        referrer: 'https://instagram.com',
        country: 'US',
      }),
    });

    expect(clickRes.status).toBe(201);
    const clickBody = (await clickRes.json()) as { id: string; campaignId: string };
    expect(clickBody.id).toBeDefined();
    expect(clickBody.campaignId).toBe(createdCampaignId);

    // 2. Record Conversion
    const convRes = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/tracking/conversions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`,
        },
        body: JSON.stringify({
          orderId: `ord_${Date.now()}`,
          orderTotalCents: 6998,
          currency: 'USD',
          attributionSource: 'spring-relaunch-2026',
        }),
      },
    );

    expect(convRes.status).toBe(201);
    const convBody = (await convRes.json()) as { id: string; orderTotalCents: number };
    expect(convBody.id).toBeDefined();
    expect(convBody.orderTotalCents).toBe(6998);
  });

  it('6. Computes aggregated analytics overview, timeseries, and best times', async () => {
    const overviewRes = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/analytics/overview?days=30`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      },
    );
    expect(overviewRes.status).toBe(200);
    const overview = (await overviewRes.json()) as {
      totalClicks: number;
      totalConversions: number;
      totalRevenueCents: number;
      conversionRate: number;
    };

    expect(overview.totalClicks).toBeGreaterThanOrEqual(1);
    expect(overview.totalConversions).toBeGreaterThanOrEqual(1);
    expect(overview.totalRevenueCents).toBeGreaterThanOrEqual(6998);

    const timeseriesRes = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/analytics/timeseries?days=7`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      },
    );
    expect(timeseriesRes.status).toBe(200);
    const timeseries = (await timeseriesRes.json()) as Array<{ date: string; clicks: number }>;
    expect(timeseries.length).toBe(7);

    const bestTimesRes = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/analytics/best-times`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      },
    );
    expect(bestTimesRes.status).toBe(200);
    const bestTimes = (await bestTimesRes.json()) as Array<{
      dayOfWeek: string;
      confidenceScore: number;
    }>;
    expect(bestTimes.length).toBeGreaterThanOrEqual(3);
    expect(bestTimes[0]?.confidenceScore).toBeGreaterThanOrEqual(70);
  });

  it('7. Enforces strict tenant isolation: Tenant 2 cannot access Tenant 1 stores or campaigns', async () => {
    // Tenant 2 tries to access Tenant 1 store connection -> 403 Forbidden
    const crossStoreRes = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/integrations/stores`,
      {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      },
    );
    expect(crossStoreRes.status).toBe(403);

    // Tenant 2 tries to trigger sync on Tenant 1 store -> 403 Forbidden
    const crossSyncRes = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/integrations/stores/${createdStoreId}/sync`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tenant2Token}` },
      },
    );
    expect(crossSyncRes.status).toBe(403);

    // Tenant 2 tries to access Tenant 1 campaign -> 403 Forbidden
    const crossCampRes = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/campaigns/${createdCampaignId}`,
      {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      },
    );
    expect(crossCampRes.status).toBe(403);

    // Tenant 2 tries to read Tenant 1 analytics -> 403 Forbidden
    const crossAnalyticsRes = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/analytics/overview`,
      {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      },
    );
    expect(crossAnalyticsRes.status).toBe(403);
  });
});
