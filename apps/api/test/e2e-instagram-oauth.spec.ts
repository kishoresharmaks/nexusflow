import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { SocialProvider, SocialAccountStatus, PostStatus } from '@commercepilot/database';

describe('E2E Instagram OAuth 2.0 Integration & Publishing Flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let serverOrigin: string;

  let tenant1Token: string;
  let tenant1WorkspaceId: string;
  let tenant1UserId: string;

  let tenant2Token: string;
  let tenant2WorkspaceId: string;

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
      exclude: ['health', 'ready', 'api/v1/health', 'api/v1/ready', 'api/integrations/(.*)'],
    });

    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    serverOrigin = `http://127.0.0.1:${port}`;

    prisma = app.get<PrismaService>(PrismaService);

    // 1. Setup Tenant 1
    const t1Email = `ig_seller1_${Date.now()}@commercepilot.test`;
    const t1Res = await fetch(`${serverOrigin}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Instagram Seller One',
        email: t1Email,
        password: 'Password123!',
        workspaceName: 'Acme Instagram Boutique',
      }),
    });
    const t1Data = (await t1Res.json()) as { sessionToken: string; user: { id: string } };
    tenant1Token = t1Data.sessionToken;
    tenant1UserId = t1Data.user.id;

    const t1WorkspacesRes = await fetch(`${serverOrigin}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const t1Workspaces = (await t1WorkspacesRes.json()) as Array<{ id: string }>;
    tenant1WorkspaceId = t1Workspaces[0]!.id;

    // 2. Setup Tenant 2 (For Cross-Tenant Boundary testing)
    const t2Email = `ig_seller2_${Date.now()}@commercepilot.test`;
    const t2Res = await fetch(`${serverOrigin}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Instagram Seller Two',
        email: t2Email,
        password: 'Password123!',
        workspaceName: 'Rival Fashion House',
      }),
    });
    const t2Data = (await t2Res.json()) as { sessionToken: string };
    tenant2Token = t2Data.sessionToken;

    const t2WorkspacesRes = await fetch(`${serverOrigin}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${tenant2Token}` },
    });
    const t2Workspaces = (await t2WorkspacesRes.json()) as Array<{ id: string }>;
    tenant2WorkspaceId = t2Workspaces[0]!.id;
  });

  afterAll(async () => {
    try {
      if (tenant1WorkspaceId) {
        await prisma.socialAccount.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.post.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.workspace.delete({ where: { id: tenant1WorkspaceId } });
      }
      if (tenant2WorkspaceId) {
        await prisma.socialAccount.deleteMany({ where: { workspaceId: tenant2WorkspaceId } });
        await prisma.post.deleteMany({ where: { workspaceId: tenant2WorkspaceId } });
        await prisma.workspace.delete({ where: { id: tenant2WorkspaceId } });
      }
    } catch {
      // Ignored
    }
    await app.close();
  });

  it('1. GET /api/integrations/instagram/connect rejects unauthenticated requests', async () => {
    const res = await fetch(
      `${serverOrigin}/api/integrations/instagram/connect?workspaceId=${tenant1WorkspaceId}&json=true`,
    );
    expect(res.status).toBe(401);
  });

  it('2. GET /api/integrations/instagram/connect initiates OAuth and returns valid authUrl with signed state', async () => {
    const res = await fetch(
      `${serverOrigin}/api/integrations/instagram/connect?workspaceId=${tenant1WorkspaceId}&json=true`,
      {
        headers: {
          Authorization: `Bearer ${tenant1Token}`,
        },
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { authUrl: string; state: string; expiresInSeconds: number };

    expect(body.authUrl).toContain('https://www.facebook.com/v19.0/dialog/oauth');
    expect(body.authUrl).toContain('response_type=code');
    expect(body.authUrl).toContain('instagram_basic');
    expect(body.authUrl).toContain('instagram_content_publish');
    expect(body.authUrl).toContain('pages_show_list');
    expect(body.state).toBeDefined();
    expect(body.expiresInSeconds).toBe(600);
  });

  it('3. GET /api/integrations/instagram/connect redirects to Meta when navigating as browser', async () => {
    const res = await fetch(
      `${serverOrigin}/api/integrations/instagram/connect?workspaceId=${tenant1WorkspaceId}&token=${tenant1Token}`,
      {
        redirect: 'manual',
      },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toContain('https://www.facebook.com/v19.0/dialog/oauth');
    expect(location).toContain('response_type=code');
  });

  it('4. GET /api/integrations/instagram/callback rejects tampered state', async () => {
    const res = await fetch(
      `${serverOrigin}/api/integrations/instagram/callback?code=mock_code&state=fake.tampered_state`,
      {
        redirect: 'manual',
      },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toContain('instagram=failed');
    expect(location).toContain('invalid_state');
  });

  it('5. GET /api/integrations/instagram/callback successfully exchanges mock code, encrypts token, and saves SocialAccount', async () => {
    // 1. Get signed state
    const connectRes = await fetch(
      `${serverOrigin}/api/integrations/instagram/connect?workspaceId=${tenant1WorkspaceId}&json=true`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      },
    );
    const { state } = (await connectRes.json()) as { state: string };

    // 2. Callback redirect from Meta
    const callbackRes = await fetch(
      `${serverOrigin}/api/integrations/instagram/callback?code=mock_code_ig_success&state=${state}`,
      {
        redirect: 'manual',
      },
    );

    expect(callbackRes.status).toBe(302);
    const location = callbackRes.headers.get('location');
    expect(location).toContain('instagram=connected');
    expect(location).toContain('name=Test%20Brand%20Instagram');

    // 3. Verify account in database
    const account = await prisma.socialAccount.findFirst({
      where: {
        workspaceId: tenant1WorkspaceId,
        provider: SocialProvider.META_INSTAGRAM,
      },
    });

    expect(account).toBeDefined();
    expect(account!.displayName).toBe('Test Brand Instagram');
    expect(account!.status).toBe(SocialAccountStatus.ACTIVE);
    expect(account!.encryptedAccessToken).not.toContain('mock_meta_ig_token'); // Encrypted with AES-256-GCM
  });

  it('6. GET /api/integrations/instagram/status returns safe display data without exposing tokens', async () => {
    const res = await fetch(
      `${serverOrigin}/api/integrations/instagram/status?workspaceId=${tenant1WorkspaceId}`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      connected: boolean;
      canPublish: boolean;
      account: {
        id: string;
        displayName: string;
        provider: string;
        encryptedAccessToken?: string;
      };
    };

    expect(body.connected).toBe(true);
    expect(body.canPublish).toBe(true);
    expect(body.account.displayName).toBe('Test Brand Instagram');
    expect(body.account.provider).toBe(SocialProvider.META_INSTAGRAM);
    expect(body.account.encryptedAccessToken).toBeUndefined(); // Zero token exposure
  });

  it('7. POST /api/integrations/instagram/posts publishes post with media to connected Instagram profile', async () => {
    const res = await fetch(`${serverOrigin}/api/integrations/instagram/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: tenant1WorkspaceId,
        content: 'Check out our latest fashion arrivals! #springfashion #boutique',
        mediaUrls: ['https://storage.commercepilot.test/media/product_1.jpg'],
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      postId: string;
      providerPostId: string;
    };

    expect(body.success).toBe(true);
    expect(body.postId).toBeDefined();
    expect(body.providerPostId).toContain('ig_post_');

    // Verify post status in database
    const post = await prisma.post.findUnique({
      where: { id: body.postId },
    });
    expect(post).toBeDefined();
    expect(post!.status).toBe(PostStatus.PUBLISHED);
    expect(post!.providerPostId).toBe(body.providerPostId);
  });

  it('8. POST /api/integrations/instagram/refresh refreshes the access token', async () => {
    const res = await fetch(`${serverOrigin}/api/integrations/instagram/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: tenant1WorkspaceId,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      accountId: string;
      tokenExpiresAt: string;
      message: string;
    };

    expect(body.success).toBe(true);
    expect(body.tokenExpiresAt).toBeDefined();
    expect(body.message).toContain('refreshed successfully');
  });

  it('9. Cross-Tenant Isolation: Tenant 2 cannot access, publish, or disconnect Tenant 1 Instagram integration', async () => {
    // 1. Tenant 2 tries to read Tenant 1 Instagram status
    const statusRes = await fetch(
      `${serverOrigin}/api/integrations/instagram/status?workspaceId=${tenant1WorkspaceId}`,
      {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      },
    );
    expect(statusRes.status).toBe(403);

    // 2. Tenant 2 tries to publish to Tenant 1 Instagram profile
    const publishRes = await fetch(`${serverOrigin}/api/integrations/instagram/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tenant2Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: tenant1WorkspaceId,
        content: 'Malicious cross-tenant post attempt',
        mediaUrls: ['https://example.com/bad.png'],
      }),
    });
    expect(publishRes.status).toBe(403);

    // 3. Tenant 2 tries to disconnect Tenant 1 Instagram account
    const disconnectRes = await fetch(`${serverOrigin}/api/integrations/instagram/disconnect`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tenant2Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: tenant1WorkspaceId,
      }),
    });
    expect(disconnectRes.status).toBe(403);
  });

  it('10. DELETE /api/integrations/instagram/disconnect deactivates credentials for workspace', async () => {
    const res = await fetch(`${serverOrigin}/api/integrations/instagram/disconnect`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tenant1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: tenant1WorkspaceId,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; message: string };
    expect(body.success).toBe(true);

    // Verify account is marked DISCONNECTED
    const account = await prisma.socialAccount.findFirst({
      where: {
        workspaceId: tenant1WorkspaceId,
        provider: SocialProvider.META_INSTAGRAM,
      },
    });
    expect(account!.status).toBe(SocialAccountStatus.DISCONNECTED);

    // Verify getStatus now reflects disconnected
    const statusRes = await fetch(
      `${serverOrigin}/api/integrations/instagram/status?workspaceId=${tenant1WorkspaceId}`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      },
    );
    const statusBody = (await statusRes.json()) as { connected: boolean };
    expect(statusBody.connected).toBe(false);
  });
});
