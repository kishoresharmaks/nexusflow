import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { WorkspaceRole } from '@commercepilot/database';

describe('Airtight Authentication & Authorization Enforcement Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  let validUserToken: string;
  let validWorkspaceId: string;
  let foreignUserToken: string;
  let foreignWorkspaceId: string;

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

    // Register User 1
    const u1Email = `authtest_u1_${Date.now()}@commercepilot.test`;
    const u1Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Auth User 1',
        email: u1Email,
        password: 'Password123!',
      }),
    });
    const u1Data = await u1Res.json();
    validUserToken = u1Data.sessionToken;

    const ws1Res = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validUserToken}`,
      },
      body: JSON.stringify({ name: 'Auth Test Workspace 1' }),
    });
    const ws1Data = await ws1Res.json();
    validWorkspaceId = ws1Data.workspace.id;

    // Register Foreign User 2
    const u2Email = `authtest_u2_${Date.now()}@commercepilot.test`;
    const u2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Auth User 2',
        email: u2Email,
        password: 'Password123!',
      }),
    });
    const u2Data = await u2Res.json();
    foreignUserToken = u2Data.sessionToken;

    const ws2Res = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${foreignUserToken}`,
      },
      body: JSON.stringify({ name: 'Foreign Workspace 2' }),
    });
    const ws2Data = await ws2Res.json();
    foreignWorkspaceId = ws2Data.workspace.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Unauthenticated Requests (Missing Bearer Token)', () => {
    it('rejects GET /auth/me with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/auth/me`);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe('Unauthorized');
    });

    it('rejects GET /workspaces with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/workspaces`);
      expect(res.status).toBe(401);
    });

    it('rejects GET /workspaces/:id/products with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/products`);
      expect(res.status).toBe(401);
    });

    it('rejects POST /workspaces/:id/products with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hacked Product', priceCents: 100 }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects POST /workspaces/:id/content/generate with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/content/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'INSTAGRAM', goals: ['SALE'] }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects GET /workspaces/:id/posts with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/posts`);
      expect(res.status).toBe(401);
    });

    it('rejects GET /workspaces/:id/social-accounts with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/social-accounts`);
      expect(res.status).toBe(401);
    });

    it('rejects GET /workspaces/:id/billing/subscription with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/billing/subscription`);
      expect(res.status).toBe(401);
    });
  });

  describe('2. Malformed or Expired Session Tokens', () => {
    it('rejects forged/tampered session tokens with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: {
          Authorization: 'Bearer completely-fake-and-forged-token-xyz-12345',
        },
      });
      expect(res.status).toBe(401);
    });

    it('rejects session after logout revocation with 401 Unauthorized', async () => {
      // 1. Login user 1 to get a secondary session
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (await prisma.user.findFirst({
            where: { memberships: { some: { workspaceId: validWorkspaceId } } },
          }))!.email,
          password: 'Password123!',
        }),
      });
      const loginData = await loginRes.json();
      const ephemeralToken = loginData.sessionToken;

      // Verify active
      const testRes1 = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${ephemeralToken}` },
      });
      expect(testRes1.status).toBe(200);

      // Logout to revoke
      const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ephemeralToken}` },
      });
      expect(logoutRes.status).toBe(200);

      // Verify immediate 401 on revoked token
      const testRes2 = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${ephemeralToken}` },
      });
      expect(testRes2.status).toBe(401);
    });
  });

  describe('3. Cross-Tenant Authorization Boundaries (Workspace Isolation)', () => {
    it('prevents foreign user from accessing Workspace 1 products (returns 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/products`, {
        headers: { Authorization: `Bearer ${foreignUserToken}` },
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('Forbidden');
    });

    it('prevents foreign user from accessing Workspace 1 posts (returns 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/posts`, {
        headers: { Authorization: `Bearer ${foreignUserToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('prevents foreign user from accessing Workspace 1 social accounts (returns 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/social-accounts`, {
        headers: { Authorization: `Bearer ${foreignUserToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('prevents foreign user from accessing Workspace 1 billing (returns 403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/billing/subscription`, {
        headers: { Authorization: `Bearer ${foreignUserToken}` },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('4. Cross-Workspace Linked Resource Poisoning Prevention', () => {
    let foreignProductId: string;
    let foreignCampaignId: string;
    let foreignAccountId: string;

    beforeAll(async () => {
      // Create resources in foreignWorkspaceId
      const prodRes = await fetch(`${baseUrl}/workspaces/${foreignWorkspaceId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${foreignUserToken}`,
        },
        body: JSON.stringify({
          title: 'Foreign Exclusive Item',
          priceCents: 4999,
          sku: `FOREIGN-SKU-${Date.now()}`,
        }),
      });
      const prodData = await prodRes.json();
      foreignProductId = prodData.id;

      const campRes = await fetch(`${baseUrl}/workspaces/${foreignWorkspaceId}/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${foreignUserToken}`,
        },
        body: JSON.stringify({
          name: 'Foreign Secret Campaign',
          utmCampaign: 'foreign_summer',
        }),
      });
      const campData = await campRes.json();
      foreignCampaignId = campData.id;

      const accRes = await fetch(
        `${baseUrl}/workspaces/${foreignWorkspaceId}/social-accounts/connect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${foreignUserToken}`,
          },
          body: JSON.stringify({
            provider: 'META_INSTAGRAM',
            providerAccountId: `foreign_act_${Date.now()}`,
            displayName: 'Foreign Brand IG',
            accessToken: 'foreign-mock-access-token-12345',
            scopes: ['instagram_basic'],
          }),
        },
      );
      const accData = await accRes.json();
      foreignAccountId = accData.id;
    });

    it('rejects post creation with cross-workspace productId (returns 404 Not Found)', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validUserToken}`,
        },
        body: JSON.stringify({
          content: 'Attempting to leak foreign product data',
          productId: foreignProductId,
        }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error?.message || json.message).toContain(
        'Linked product not found in this workspace',
      );
    });

    it('rejects post creation with cross-workspace campaignId (returns 404 Not Found)', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validUserToken}`,
        },
        body: JSON.stringify({
          content: 'Attempting to link foreign campaign',
          campaignId: foreignCampaignId,
        }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error?.message || json.message).toContain(
        'Linked campaign not found in this workspace',
      );
    });

    it('rejects post creation with cross-workspace socialAccountId (returns 404 Not Found)', async () => {
      const res = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validUserToken}`,
        },
        body: JSON.stringify({
          content: 'Attempting to post via foreign social account',
          socialAccountId: foreignAccountId,
        }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error?.message || json.message).toContain(
        'Linked social account not found in this workspace',
      );
    });

    it('rejects post update with cross-workspace linked resources (returns 404 Not Found)', async () => {
      // Create legitimate post in validWorkspaceId
      const postRes = await fetch(`${baseUrl}/workspaces/${validWorkspaceId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validUserToken}`,
        },
        body: JSON.stringify({
          content: 'Valid workspace draft post',
        }),
      });
      const postData = await postRes.json();
      const legitPostId = postData.id;

      // Attempt to tamper post with foreign product
      const patchProdRes = await fetch(
        `${baseUrl}/workspaces/${validWorkspaceId}/posts/${legitPostId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${validUserToken}`,
          },
          body: JSON.stringify({
            productId: foreignProductId,
          }),
        },
      );
      expect(patchProdRes.status).toBe(404);

      // Attempt to tamper post with foreign campaign
      const patchCampRes = await fetch(
        `${baseUrl}/workspaces/${validWorkspaceId}/posts/${legitPostId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${validUserToken}`,
          },
          body: JSON.stringify({
            campaignId: foreignCampaignId,
          }),
        },
      );
      expect(patchCampRes.status).toBe(404);

      // Attempt to tamper post with foreign social account
      const patchAccRes = await fetch(
        `${baseUrl}/workspaces/${validWorkspaceId}/posts/${legitPostId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${validUserToken}`,
          },
          body: JSON.stringify({
            socialAccountId: foreignAccountId,
          }),
        },
      );
      expect(patchAccRes.status).toBe(404);
    });
  });
});
