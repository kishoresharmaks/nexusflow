import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { AuthService } from '../src/auth/auth.service';
import { WorkspacesService } from '../src/workspaces/workspaces.service';
import { PostStatus } from '@commercepilot/database';

describe('E2E AI Content Studio and Media Pipeline Flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let workspacesService: WorkspacesService;
  let baseUrl: string;

  let tenant1Token: string;
  let tenant1WorkspaceId: string;
  let tenant1UserId: string;

  let tenant2Token: string;
  let tenant2WorkspaceId: string;
  let tenant2UserId: string;

  let productId: string;
  let brandProfileId: string;
  let templateId: string;
  let mediaAssetId: string;
  let generatedPostId: string;

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

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    workspacesService = app.get(WorkspacesService);

    // Setup Tenant 1
    const t1Email = `e2e_ai_t1_${Date.now()}@example.test`;
    const t1Reg = await authService.register({
      email: t1Email,
      password: 'SecurePassword123!',
      name: 'Tenant 1 Creator',
    });
    tenant1UserId = t1Reg.user.id;
    tenant1Token = t1Reg.sessionToken;

    const t1Ws = await workspacesService.createWorkspace(tenant1UserId, {
      name: 'Tenant 1 Creator Store',
      slug: `t1-ai-${Date.now()}`,
    });
    tenant1WorkspaceId = t1Ws.workspace.id;

    // Setup Tenant 2
    const t2Email = `e2e_ai_t2_${Date.now()}@example.test`;
    const t2Reg = await authService.register({
      email: t2Email,
      password: 'SecurePassword123!',
      name: 'Tenant 2 Creator',
    });
    tenant2UserId = t2Reg.user.id;
    tenant2Token = t2Reg.sessionToken;

    const t2Ws = await workspacesService.createWorkspace(tenant2UserId, {
      name: 'Tenant 2 Creator Store',
      slug: `t2-ai-${Date.now()}`,
    });
    tenant2WorkspaceId = t2Ws.workspace.id;

    // Create a product for Tenant 1
    const product = await prisma.product.create({
      data: {
        workspaceId: tenant1WorkspaceId,
        sku: 'HEADPHONE-PRO',
        title: 'Studio Pro ANC Headphones',
        description: 'Active noise cancelling wireless headphones with 40-hour battery life.',
        priceCents: 19999,
        currency: 'USD',
        inventoryCount: 42,
        url: 'https://store.example.com/headphones',
        images: ['https://cdn.example.com/headphones.jpg'],
        freshnessCheckedAt: new Date(),
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    try {
      if (tenant1WorkspaceId) {
        await prisma.aiUsage.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.usageLedger.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.post.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.mediaAsset.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.contentTemplate.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.brandProfile.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.product.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.workspace.delete({ where: { id: tenant1WorkspaceId } });
      }
      if (tenant2WorkspaceId) {
        await prisma.workspace.delete({ where: { id: tenant2WorkspaceId } });
      }
      if (tenant1UserId) {
        await prisma.user.delete({ where: { id: tenant1UserId } });
      }
      if (tenant2UserId) {
        await prisma.user.delete({ where: { id: tenant2UserId } });
      }
    } catch {
      // Ignore cleanup error
    }

    if (app) {
      await app.close();
    }
  });

  it('1. Creates a brand voice profile via POST /workspaces/:workspaceId/brand-profiles', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/brand-profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        name: 'Audiophile Elite',
        toneOfVoice: 'Professional, immersive, and technical',
        targetAudience: 'Music producers and audio enthusiasts',
        prohibitedWords: ['cheap', 'scam', 'fake'],
        preferredHashtags: ['#AudiophileLife', '#StudioSound'],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Audiophile Elite');
    expect(body.prohibitedWords).toContain('cheap');
    expect(body.preferredHashtags).toContain('#AudiophileLife');
    brandProfileId = body.id;
  });

  it('2. Creates a content template via POST /workspaces/:workspaceId/templates', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        name: 'Feature Deep-Dive',
        channel: 'INSTAGRAM',
        promptTemplate: 'Lead with acoustic clarity and battery life, then present the offer.',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Feature Deep-Dive');
    templateId = body.id;
  });

  it('3. Generates grounded marketing copy and persists draft Post with PostStatus.DRAFT', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/content/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        productId,
        channel: 'INSTAGRAM',
        brandProfileId,
        templateId,
        customInstructions: 'Focus on noise cancellation for work and travel.',
        createDraftPost: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();

    // Verify grounded facts
    expect(body.caption).toContain('Studio Pro ANC Headphones');
    expect(body.caption).toContain('$199.99 USD');
    expect(body.hashtags).toContain('#AudiophileLife');
    expect(body.hashtags).toContain('#StudioSound');
    expect(body.callToAction).toBeDefined();
    expect(body.staleWarning).toBeUndefined(); // Fresh product

    // Verify usage metrics
    expect(body.usage).toBeDefined();
    expect(body.usage.promptTokens).toBeGreaterThan(0);
    expect(body.usage.completionTokens).toBeGreaterThan(0);

    // Verify editable draft post was created
    expect(body.draftPost).toBeDefined();
    expect(body.draftPost.status).toBe(PostStatus.DRAFT);
    expect(body.draftPost.productId).toBe(productId);
    expect(body.draftPost.mediaUrls).toContain('https://cdn.example.com/headphones.jpg');

    generatedPostId = body.draftPost.id;

    // Double check persistence in database
    const dbPost = await prisma.post.findUnique({ where: { id: generatedPostId } });
    expect(dbPost).toBeDefined();
    expect(dbPost?.status).toBe(PostStatus.DRAFT);
  });

  it('4. Meters token usage in AiUsage and UsageLedger records', async () => {
    const usageRes = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/content/usage`, {
      headers: {
        Authorization: `Bearer ${tenant1Token}`,
      },
    });

    expect(usageRes.status).toBe(200);
    const usageData = await usageRes.json();
    expect(usageData.usedTokens).toBeGreaterThan(0);
    expect(usageData.remainingTokens).toBeLessThan(usageData.limitTokens);

    // Verify DB records exist
    const aiUsageRecords = await prisma.aiUsage.findMany({
      where: { workspaceId: tenant1WorkspaceId },
    });
    expect(aiUsageRecords.length).toBeGreaterThan(0);
    expect(aiUsageRecords[0]?.feature).toBe('CONTENT_GENERATION');

    const ledgerRecords = await prisma.usageLedger.findMany({
      where: { workspaceId: tenant1WorkspaceId },
    });
    expect(ledgerRecords.length).toBeGreaterThan(0);
  });

  it('5. Emits stale product warning when product data is older than 48 hours', async () => {
    // Manually backdate product freshness check to 3 days ago
    const staleTime = new Date(Date.now() - 72 * 60 * 60 * 1000);
    await prisma.product.update({
      where: { id: productId },
      data: {
        freshnessCheckedAt: staleTime,
        updatedAt: staleTime,
      },
    });

    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/content/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        productId,
        channel: 'INSTAGRAM',
        createDraftPost: false,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.staleWarning).toBeDefined();
    expect(body.staleWarning).toContain('>48 hours ago');
  });

  it('6. Generates pre-signed S3 upload URL with tenant directory isolation', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/media/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        filename: 'studio-headphones-hero.png',
        mimeType: 'image/png',
        fileSizeBytes: 1024 * 512,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.uploadUrl).toBeDefined();
    expect(body.storageKey).toMatch(
      new RegExp(`^workspaces/${tenant1WorkspaceId}/media/.*studio-headphones-hero\\.png$`),
    );
    expect(body.expiresInSeconds).toBe(900);

    // Confirm upload
    const confirmRes = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/media/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        storageKey: body.storageKey,
        originalFilename: 'studio-headphones-hero.png',
        mimeType: 'image/png',
        fileSizeBytes: 1024 * 512,
        width: 1200,
        height: 800,
      }),
    });

    expect(confirmRes.status).toBe(201);
    const confirmedAsset = await confirmRes.json();
    expect(confirmedAsset.id).toBeDefined();
    expect(confirmedAsset.workspaceId).toBe(tenant1WorkspaceId);
    expect(confirmedAsset.fileSizeBytes).toBe(1024 * 512);

    mediaAssetId = confirmedAsset.id;
  });

  it('7. Enforces cross-tenant isolation: Tenant 2 cannot access Tenant 1 AI content or media', async () => {
    // Tenant 2 tries to generate content for Tenant 1's product
    const resGenerate = await fetch(
      `${baseUrl}/workspaces/${tenant2WorkspaceId}/content/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant2Token}`,
        },
        body: JSON.stringify({
          productId, // Product belongs to Tenant 1
        }),
      },
    );
    // Product not found in Tenant 2's workspace -> 404
    expect(resGenerate.status).toBe(404);

    // Tenant 2 tries to access Tenant 1's brand profile directly
    const resBrand = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/brand-profiles/${brandProfileId}`,
      {
        headers: {
          Authorization: `Bearer ${tenant2Token}`,
        },
      },
    );
    // Tenant 2 not member of Tenant 1 workspace -> 403 Forbidden
    expect(resBrand.status).toBe(403);

    // Tenant 2 tries to confirm media upload using Tenant 1's storage key
    const resMediaSpoof = await fetch(`${baseUrl}/workspaces/${tenant2WorkspaceId}/media/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({
        storageKey: `workspaces/${tenant1WorkspaceId}/media/malicious-file.png`,
        originalFilename: 'malicious.png',
        mimeType: 'image/png',
        fileSizeBytes: 100,
      }),
    });
    // Storage key prefix mismatch -> 400 Bad Request
    expect(resMediaSpoof.status).toBe(400);

    // Tenant 2 tries to delete Tenant 1's media asset
    const resDeleteMedia = await fetch(
      `${baseUrl}/workspaces/${tenant2WorkspaceId}/media/${mediaAssetId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tenant2Token}`,
        },
      },
    );
    expect(resDeleteMedia.status).toBe(404);
  });
});
