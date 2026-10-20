import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

describe('E2E Billing, Entitlements, Webhooks, and Cross-Tenant Isolation Flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  let tenant1Token: string;
  let tenant1WorkspaceId: string;

  let tenant2Token: string;
  let tenant2WorkspaceId: string;

  const testWebhookSecret =
    process.env['RAZORPAY_WEBHOOK_SECRET'] ||
    process.env['WEBHOOK_SECRET'] ||
    'commercepilot-default-webhook-secret-key-32';

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
    const t1Email = `billing_tenant1_${Date.now()}@commercepilot.test`;
    const t1Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Billing Seller One',
        email: t1Email,
        password: 'Password123!',
      }),
    });
    const t1Data = await t1Res.json();
    tenant1Token = t1Data.sessionToken;

    const ws1Res = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ name: 'Flagship Billing Store' }),
    });
    const ws1Data = await ws1Res.json();
    tenant1WorkspaceId = ws1Data.workspace.id;

    // Setup Tenant 2
    const t2Email = `billing_tenant2_${Date.now()}@commercepilot.test`;
    const t2Res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Billing Seller Two',
        email: t2Email,
        password: 'Password123!',
      }),
    });
    const t2Data = await t2Res.json();
    tenant2Token = t2Data.sessionToken;

    const ws2Res = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({ name: 'Foreign Billing Store' }),
    });
    const ws2Data = await ws2Res.json();
    tenant2WorkspaceId = ws2Data.workspace.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Fetches available billing plans', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/billing/plans`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    expect(res.status).toBe(200);
    const plans = await res.json();
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThanOrEqual(4);
    expect(plans.some((p: { id: string }) => p.id === 'GROWTH')).toBe(true);
  });

  it('2. Auto-provisions and returns default FREE subscription', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/billing/subscription`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    expect(res.status).toBe(200);
    const sub = await res.json();
    expect(sub.planId).toBe('FREE');
    expect(sub.status).toBe('ACTIVE');
    expect(sub.cancelAtPeriodEnd).toBe(false);
  });

  it('3. Computes billing usage against entitlements', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/billing/usage`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    expect(res.status).toBe(200);
    const usage = await res.json();
    expect(usage.plan.id).toBe('FREE');
    expect(usage.metrics.monthlyPosts.limit).toBe(10);
    expect(usage.metrics.monthlyAiWords.limit).toBe(5000);
    expect(usage.metrics.teamMembers.used).toBe(1);
  });

  it('4. Creates checkout session for paid upgrade to GROWTH', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ planId: 'GROWTH' }),
    });
    expect(res.status).toBe(201);
    const session = await res.json();
    expect(session.planId).toBe('GROWTH');
    expect(session.amountCents).toBe(7900);
    expect(session.sessionId).toBeDefined();
  });

  it('5. Ingests signature-verified webhook activating GROWTH subscription', async () => {
    const eventId = `evt_act_${Date.now()}`;
    const payload = {
      id: eventId,
      event: 'subscription.activated',
      workspaceId: tenant1WorkspaceId,
      planId: 'GROWTH',
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', testWebhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const res = await fetch(`${baseUrl}/webhooks/billing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
      },
      body: rawBody,
    });
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.status).toBe('processed');

    // Verify subscription updated in DB
    const subRes = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/billing/subscription`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const sub = await subRes.json();
    expect(sub.planId).toBe('GROWTH');
    expect(sub.status).toBe('ACTIVE');
  });

  it('6. Rejects duplicate webhook event idempotently', async () => {
    const duplicateEventId = `evt_dup_${Date.now()}`;
    const payload = {
      id: duplicateEventId,
      event: 'subscription.charged',
      workspaceId: tenant1WorkspaceId,
      amountCents: 7900,
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', testWebhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    // First call: processed
    const res1 = await fetch(`${baseUrl}/webhooks/billing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
      },
      body: rawBody,
    });
    expect(res1.status).toBe(200);
    expect((await res1.json()).status).toBe('processed');

    // Second call: already_processed
    const res2 = await fetch(`${baseUrl}/webhooks/billing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
      },
      body: rawBody,
    });
    expect(res2.status).toBe(200);
    expect((await res2.json()).status).toBe('already_processed');
  });

  it('7. Cancels subscription at period end', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/billing/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ reason: 'Testing cancellation flow' }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.cancelAtPeriodEnd).toBe(true);
  });

  it('8. Enforces cross-tenant isolation: Tenant 2 cannot access Tenant 1 billing', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/billing/subscription`, {
      headers: { Authorization: `Bearer ${tenant2Token}` },
    });
    expect(res.status).toBe(403);
  });
});
