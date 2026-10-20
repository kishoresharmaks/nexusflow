import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { SocialProvider, SocialAccountStatus, PostStatus } from '@commercepilot/database';

describe('E2E LinkedIn OAuth 2.0 Integration & Publishing Flow', () => {
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
    const t1Email = `li_seller1_${Date.now()}@commercepilot.test`;
    const t1Res = await fetch(`${serverOrigin}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'LinkedIn Seller One',
        email: t1Email,
        password: 'Password123!',
        workspaceName: 'Acme LinkedIn Workspace',
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
    const t2Email = `li_seller2_${Date.now()}@commercepilot.test`;
    const t2Res = await fetch(`${serverOrigin}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'LinkedIn Seller Two',
        email: t2Email,
        password: 'Password123!',
        workspaceName: 'Rival Brands Workspace',
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
    // Cleanup created test workspaces
    try {
      if (tenant1WorkspaceId) {
        await prisma.socialAccount.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.post.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.workspace.delete({ where: { id: tenant1WorkspaceId } });
      }
      if (tenant2WorkspaceId) {
        await prisma.workspace.delete({ where: { id: tenant2WorkspaceId } });
      }
    } catch {
      // Ignored
    }
    await app.close();
  });

  it('1. GET /api/integrations/linkedin/connect rejects unauthenticated requests', async () => {
    const res = await fetch(
      `${serverOrigin}/api/integrations/linkedin/connect?workspaceId=${tenant1WorkspaceId}&json=true`,
    );
    expect(res.status).toBe(401);
  });

  it('2. GET /api/integrations/linkedin/connect initiates OAuth and returns valid authUrl with signed state', async () => {
    // Both /api/integrations/linkedin/connect and /api/v1/integrations/linkedin/connect are supported
    const res = await fetch(
      `${serverOrigin}/api/integrations/linkedin/connect?workspaceId=${tenant1WorkspaceId}&json=true`,
      {
        headers: {
          Authorization: `Bearer ${tenant1Token}`,
        },
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { authUrl: string; state: string; expiresInSeconds: number };

    expect(body.authUrl).toContain('https://www.linkedin.com/oauth/v2/authorization');
    expect(body.authUrl).toContain('response_type=code');
    expect(body.authUrl).toContain('scope=openid+profile+w_member_social');
    expect(body.state).toBeDefined();
    expect(body.expiresInSeconds).toBe(600);
  });

  it('3. GET /api/integrations/linkedin/connect redirects to LinkedIn when navigating as browser', async () => {
    const res = await fetch(
      `${serverOrigin}/api/integrations/linkedin/connect?workspaceId=${tenant1WorkspaceId}&token=${tenant1Token}`,
      {
        redirect: 'manual', // do not follow redirect to inspect 302 location
      },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toContain('https://www.linkedin.com/oauth/v2/authorization');
    expect(location).toContain('response_type=code');
  });

  it('4. GET /api/integrations/linkedin/callback rejects tampered state', async () => {
    const res = await fetch(
      `${serverOrigin}/api/integrations/linkedin/callback?code=mock-code&state=fake.tampered_state`,
      {
        redirect: 'manual',
      },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toContain('linkedin=failed');
    expect(location).toContain('invalid_state');
  });

  it('5. GET /api/integrations/linkedin/callback successfully exchanges mock code, encrypts token, and saves SocialAccount', async () => {
    // First get valid signed state
    const connectRes = await fetch(
      `${serverOrigin}/api/integrations/linkedin/connect?workspaceId=${tenant1WorkspaceId}&json=true`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      },
    );
    const { state } = (await connectRes.json()) as { state: string };

    // Simulate callback redirect from LinkedIn
    const callbackRes = await fetch(
      `${serverOrigin}/api/integrations/linkedin/callback?code=mock-code-success&state=${state}`,
      {
        redirect: 'manual',
      },
    );

    expect(callbackRes.status).toBe(302);
    const location = callbackRes.headers.get('location');
    expect(location).toContain('linkedin=connected');
    expect(location).toContain('name=CommercePilot%20LinkedIn%20Member');

    // Verify account exists in database for tenant 1
    const account = await prisma.socialAccount.findFirst({
      where: {
        workspaceId: tenant1WorkspaceId,
        provider: SocialProvider.LINKEDIN,
      },
    });

    expect(account).toBeDefined();
    expect(account!.providerAccountId).toBe('li_mock_member_782bb4');
    expect(account!.displayName).toBe('CommercePilot LinkedIn Member');
    expect(account!.status).toBe(SocialAccountStatus.ACTIVE);
    expect(account!.encryptedAccessToken).not.toContain('mock_li_token_'); // Encrypted!
    expect(account!.scopes).toContain('w_member_social');
  });

  it('6. GET /api/integrations/linkedin/status returns safe account details without exposing tokens', async () => {
    const res = await fetch(
      `${serverOrigin}/api/integrations/linkedin/status?workspaceId=${tenant1WorkspaceId}`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      connected: boolean;
      account: { displayName: string; scopes: string[] } | null;
      canPublish: boolean;
    };

    expect(body.connected).toBe(true);
    expect(body.canPublish).toBe(true);
    expect(body.account?.displayName).toBe('CommercePilot LinkedIn Member');
    expect(body.account?.scopes).toContain('w_member_social');
    expect((body.account as any).encryptedAccessToken).toBeUndefined();
  });

  it('7. POST /api/integrations/linkedin/posts publishes post to member profile using decrypted credentials', async () => {
    const res = await fetch(`${serverOrigin}/api/integrations/linkedin/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        workspaceId: tenant1WorkspaceId,
        content: 'Excited to announce our new product catalog launch with CommercePilot!',
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
    expect(body.providerPostId).toContain('urn:li:share:');

    // Check DB status is PUBLISHED
    const post = await prisma.post.findUnique({
      where: { id: body.postId },
    });
    expect(post).toBeDefined();
    expect(post!.status).toBe(PostStatus.PUBLISHED);
  });

  it('8. Cross-Tenant Isolation: Tenant 2 cannot view or disconnect Tenant 1 LinkedIn integration', async () => {
    // Tenant 2 attempts to query Tenant 1's LinkedIn status
    const statusRes = await fetch(
      `${serverOrigin}/api/integrations/linkedin/status?workspaceId=${tenant1WorkspaceId}`,
      {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      },
    );
    expect(statusRes.status).toBe(403);

    // Tenant 2 attempts to publish using Tenant 1's workspace
    const postRes = await fetch(`${serverOrigin}/api/integrations/linkedin/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({
        workspaceId: tenant1WorkspaceId,
        content: 'Malicious cross-tenant attempt',
      }),
    });
    expect(postRes.status).toBe(403);

    // Tenant 2 attempts to disconnect Tenant 1's account
    const disconnectRes = await fetch(`${serverOrigin}/api/integrations/linkedin/disconnect`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({
        workspaceId: tenant1WorkspaceId,
      }),
    });
    expect(disconnectRes.status).toBe(403);
  });

  it('9. DELETE /api/integrations/linkedin/disconnect deactivates credentials for workspace', async () => {
    const res = await fetch(`${serverOrigin}/api/integrations/linkedin/disconnect`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        workspaceId: tenant1WorkspaceId,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    // Check status is now DISCONNECTED
    const account = await prisma.socialAccount.findFirst({
      where: {
        workspaceId: tenant1WorkspaceId,
        provider: SocialProvider.LINKEDIN,
      },
    });
    expect(account!.status).toBe(SocialAccountStatus.DISCONNECTED);

    // Querying status endpoint now returns connected: false
    const statusRes = await fetch(
      `${serverOrigin}/api/integrations/linkedin/status?workspaceId=${tenant1WorkspaceId}`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      },
    );
    const statusData = (await statusRes.json()) as { connected: boolean };
    expect(statusData.connected).toBe(false);
  });
});
