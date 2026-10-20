import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { SocialProvider, PostStatus } from '@commercepilot/database';

describe('E2E Posts, Social Accounts, Approvals, and Cross-Tenant Isolation Flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  let tenant1Token: string;
  let tenant1WorkspaceId: string;
  let tenant1AccountId: string;

  let tenant2Token: string;
  let tenant2WorkspaceId: string;

  let createdPostId: string;

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

    // 1. Setup Tenant 1
    const t1Email = `e2e_seller1_${Date.now()}@commercepilot.test`;
    const t1Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Post Seller One',
        email: t1Email,
        password: 'Password123!',
      }),
    });
    const t1Data = (await t1Res.json()) as any;
    tenant1Token = t1Data.sessionToken;

    const ws1Res = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        name: 'Seller One Brand',
        slug: `seller1-brand-${Date.now()}`,
      }),
    });
    const ws1Data = (await ws1Res.json()) as any;
    tenant1WorkspaceId = ws1Data.workspace.id;

    // 2. Setup Tenant 2
    const t2Email = `e2e_seller2_${Date.now()}@commercepilot.test`;
    const t2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Post Seller Two',
        email: t2Email,
        password: 'Password123!',
      }),
    });
    const t2Data = (await t2Res.json()) as any;
    tenant2Token = t2Data.sessionToken;

    const ws2Res = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({
        name: 'Seller Two Brand',
        slug: `seller2-brand-${Date.now()}`,
      }),
    });
    const ws2Data = (await ws2Res.json()) as any;
    tenant2WorkspaceId = ws2Data.workspace.id;
  });

  afterAll(async () => {
    if (prisma) {
      if (tenant1WorkspaceId) {
        await prisma.publishAttempt.deleteMany({
          where: { post: { workspaceId: tenant1WorkspaceId } },
        });
        await prisma.approval.deleteMany({
          where: { post: { workspaceId: tenant1WorkspaceId } },
        });
        await prisma.post.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.socialAccount.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.workspace.deleteMany({ where: { id: tenant1WorkspaceId } });
      }
      if (tenant2WorkspaceId) {
        await prisma.workspace.deleteMany({ where: { id: tenant2WorkspaceId } });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('1. Connects a social account with encrypted tokens', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/social-accounts/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        provider: SocialProvider.META_INSTAGRAM,
        providerAccountId: 'ig_test_account_1',
        displayName: 'Acme Official IG',
        accessToken: 'mock-access-token-12345',
        scopes: ['instagram_basic', 'instagram_content_publish'],
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.id).toBeDefined();
    tenant1AccountId = data.id;
    expect(data.displayName).toBe('Acme Official IG');
    expect(data.encryptedAccessToken).toBeUndefined(); // Verify token not leaked
  });

  it('2. Creates a draft post', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        content: 'Brand new luxury leather tote bag now available! #fashion #style',
        mediaUrls: ['https://s3.example.com/leather-tote.png'],
        socialAccountId: tenant1AccountId,
      }),
    });

    expect(res.status).toBe(201);
    const post = (await res.json()) as any;
    expect(post.id).toBeDefined();
    expect(post.status).toBe(PostStatus.DRAFT);
    createdPostId = post.id;
  });

  it('3. Request approval transitions post to AWAITING_APPROVAL', async () => {
    const res = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/posts/${createdPostId}/request-approval`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`,
        },
      },
    );

    expect(res.status).toBe(201);
    const post = (await res.json()) as any;
    expect(post.status).toBe(PostStatus.AWAITING_APPROVAL);
  });

  it('4. Approves the post to APPROVED with decision notes', async () => {
    const res = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/posts/${createdPostId}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`,
        },
        body: JSON.stringify({
          decisionNotes: 'Approved for social distribution.',
        }),
      },
    );

    expect(res.status).toBe(201);
    const post = (await res.json()) as any;
    expect(post.status).toBe(PostStatus.APPROVED);
  });

  it('5. Schedules the post with target UTC date', async () => {
    const targetSchedule = new Date(Date.now() + 3600000).toISOString();
    const res = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/posts/${createdPostId}/schedule`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`,
        },
        body: JSON.stringify({
          scheduledAt: targetSchedule,
        }),
      },
    );

    expect(res.status).toBe(201);
    const post = (await res.json()) as any;
    expect(post.status).toBe(PostStatus.SCHEDULED);
    expect(new Date(post.scheduledAt).toISOString()).toBe(targetSchedule);
  });

  it('6. Publishes post immediately, transitioning to PUBLISHED and recording PublishAttempt', async () => {
    const res = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/posts/${createdPostId}/publish-now`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`,
        },
      },
    );

    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.post.status).toBe(PostStatus.PUBLISHED);
    expect(data.post.publishedAt).toBeDefined();
    expect(data.attempt).toBeDefined();
    expect(data.attempt.attemptNumber).toBe(1);
    expect(data.attempt.status).toBe('SUCCESS');
  });

  it('7. Enforces cross-tenant isolation: Tenant 2 cannot access Tenant 1 posts or accounts', async () => {
    // Attempt to view Tenant 1's post using Tenant 2's token & workspace
    const postRes = await fetch(
      `${baseUrl}/workspaces/${tenant2WorkspaceId}/posts/${createdPostId}`,
      {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      },
    );
    expect([403, 404]).toContain(postRes.status);

    // Attempt to access Tenant 1's social account using Tenant 2's credentials
    const accountRes = await fetch(
      `${baseUrl}/workspaces/${tenant2WorkspaceId}/social-accounts/${tenant1AccountId}`,
      {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      },
    );
    expect([403, 404]).toContain(accountRes.status);
  });
});
