import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processReconciliation,
  processDueReconciliations,
  MAX_RECONCILIATION_ATTEMPTS,
} from '../src/processors/post-reconciliation.processor';
import { prisma, PostStatus, AttemptStatus, SocialProvider } from '@commercepilot/database';

vi.mock('@commercepilot/database', async () => {
  const actual = await vi.importActual<any>('@commercepilot/database');
  return {
    ...actual,
    prisma: {
      post: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      publishAttempt: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

vi.mock('../src/crypto.util', () => ({
  decryptToken: vi.fn().mockReturnValue('decrypted-real-token'),
}));

vi.mock('../src/providers/reconciliation.client', () => ({
  reconcileProviderPost: vi.fn(),
}));

import { reconcileProviderPost } from '../src/providers/reconciliation.client';

const postId = '60b8d29f1c9d440000a11111';
const workspaceId = '60b8d29f1c9d440000a22222';

function postFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: postId,
    workspaceId,
    status: PostStatus.UNKNOWN_OUTCOME,
    content: 'Launch sale now!',
    mediaUrls: ['https://example.com/banner.png'],
    scheduledAt: new Date(Date.now() - 20 * 60 * 1000),
    createdAt: new Date(),
    reconciliationAttempts: 0,
    reconciliationDueAt: new Date(Date.now() - 1000),
    socialAccount: {
      id: 'acc-1',
      provider: SocialProvider.META_INSTAGRAM,
      providerAccountId: 'ig-123',
      encryptedAccessToken: 'mock-token',
      status: 'ACTIVE',
    },
    publishAttempts: [],
    ...overrides,
  };
}

describe('processReconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.post.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.post.update as any).mockImplementation((args: any) => ({ id: postId, ...args.data }));
    (prisma.publishAttempt.update as any).mockResolvedValue({});
  });

  it('resolves FOUND outcome to PUBLISHED with the provider post id', async () => {
    (prisma.post.findFirst as any).mockResolvedValue(postFixture());
    (reconcileProviderPost as any).mockResolvedValue({
      status: 'FOUND',
      providerPostId: 'ig_123456',
    });

    const result = await processReconciliation({ postId, workspaceId });

    expect(result.resolved).toBe(true);
    expect(result.status).toBe(PostStatus.PUBLISHED);
    expect(result.providerPostId).toBe('ig_123456');
    expect(prisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: postId },
        data: expect.objectContaining({
          status: PostStatus.PUBLISHED,
          providerPostId: 'ig_123456',
        }),
      }),
    );
  });

  it('resolves confirmed-absent outcome to FAILED (safe to retry manually)', async () => {
    (prisma.post.findFirst as any).mockResolvedValue(postFixture());
    (reconcileProviderPost as any).mockResolvedValue({ status: 'NOT_FOUND' });

    const result = await processReconciliation({ postId, workspaceId });

    expect(result.resolved).toBe(true);
    expect(result.status).toBe(PostStatus.FAILED);
    expect(result.errorCode).toBe('RECONCILIATION_CONFIRMED_ABSENT');
  });

  it('keeps UNKNOWN_OUTCOME and reschedules on INCONCLUSIVE outcome', async () => {
    (prisma.post.findFirst as any).mockResolvedValue(postFixture());
    (reconcileProviderPost as any).mockResolvedValue({
      status: 'INCONCLUSIVE',
      errorCode: 'RECONCILIATION_TOO_EARLY',
      errorMessage: 'too early',
    });

    const result = await processReconciliation({ postId, workspaceId });

    expect(result.resolved).toBe(false);
    expect(result.status).toBe(PostStatus.UNKNOWN_OUTCOME);
    const updateCall = (prisma.post.update as any).mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: postId });
    expect(updateCall.data.reconciliationAttempts).toBe(1);
    expect(updateCall.data.status).toBeUndefined();
    // reconciliationDueAt should be a future date
    expect(updateCall.data.reconciliationDueAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('marks FAILED after exhausting reconciliation attempts', async () => {
    (prisma.post.findFirst as any).mockResolvedValue(
      postFixture({ reconciliationAttempts: MAX_RECONCILIATION_ATTEMPTS - 1 }),
    );
    (reconcileProviderPost as any).mockResolvedValue({
      status: 'INCONCLUSIVE',
      errorCode: 'RECONCILIATION_PROVIDER_ERROR',
      errorMessage: 'provider down',
    });

    const result = await processReconciliation({ postId, workspaceId });

    expect(result.resolved).toBe(true);
    expect(result.status).toBe(PostStatus.FAILED);
    expect(result.errorCode).toBe('RECONCILIATION_EXHAUSTED');
  });

  it('exits early (lease failed) when post is not due or already claimed', async () => {
    (prisma.post.findFirst as any).mockResolvedValue(postFixture());
    (prisma.post.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await processReconciliation({ postId, workspaceId });

    expect(result.resolved).toBe(false);
    expect(result.errorCode).toBe('RECONCILIATION_LEASE_FAILED');
    expect(reconcileProviderPost).not.toHaveBeenCalled();
  });

  it('is a no-op for posts not in UNKNOWN_OUTCOME status', async () => {
    (prisma.post.findFirst as any).mockResolvedValue(
      postFixture({ status: PostStatus.PUBLISHED }),
    );

    const result = await processReconciliation({ postId, workspaceId });

    expect(result.resolved).toBe(false);
    expect(result.status).toBe(PostStatus.PUBLISHED);
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
  });

  it('marks FAILED when the linked social account is inactive', async () => {
    (prisma.post.findFirst as any).mockResolvedValue(
      postFixture({ socialAccount: { ...postFixture().socialAccount, status: 'DISCONNECTED' } }),
    );

    const result = await processReconciliation({ postId, workspaceId });

    expect(result.resolved).toBe(true);
    expect(result.status).toBe(PostStatus.FAILED);
    expect(reconcileProviderPost).not.toHaveBeenCalled();
  });
});

describe('processDueReconciliations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scans and resolves due UNKNOWN_OUTCOME posts', async () => {
    (prisma.post.findMany as any).mockResolvedValue([
      { id: postId, workspaceId },
      { id: 'post-2', workspaceId },
    ]);
    (prisma.post.findFirst as any).mockImplementation((args: any) =>
      postFixture({ id: args.where.id }),
    );
    (prisma.post.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.post.update as any).mockImplementation((args: any) => ({ id: args.where.id, ...args.data }));
    (reconcileProviderPost as any).mockResolvedValue({ status: 'NOT_FOUND' });

    const result = await processDueReconciliations();

    expect(result.scanned).toBe(2);
    expect(result.resolved).toBe(2);
    expect(result.pending).toBe(0);
    expect(result.failed).toBe(0);
  });
});
