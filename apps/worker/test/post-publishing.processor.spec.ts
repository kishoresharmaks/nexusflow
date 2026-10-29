import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processPostPublishing } from '../src/processors/post-publishing.processor';
import { FallbackScheduler } from '../src/processors/fallback-scheduler';
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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      publishAttempt: {
        create: vi.fn().mockResolvedValue({ id: 'att-1' }),
      },
    },
  };
});

vi.mock('../src/crypto.util', () => ({
  decryptToken: vi.fn().mockReturnValue('decrypted-real-token'),
}));

describe('processPostPublishing', () => {
  const postId = '60b8d29f1c9d440000a11111';
  const workspaceId = '60b8d29f1c9d440000a22222';

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.post.updateMany as any).mockResolvedValue({ count: 1 });
  });

  it('publishes a SCHEDULED post successfully and transitions to PUBLISHED', async () => {
    (prisma.post.findFirst as any).mockResolvedValue({
      id: postId,
      workspaceId,
      status: PostStatus.SCHEDULED,
      content: 'Seasonal Summer Sale live now!',
      mediaUrls: ['https://example.com/banner.png'],
      publishAttempts: [],
      socialAccount: {
        id: 'acc-1',
        provider: SocialProvider.META_INSTAGRAM,
        providerAccountId: 'ig-12345',
        encryptedAccessToken: 'mock-token',
        status: 'ACTIVE',
      },
    });

    (prisma.post.update as any).mockImplementation((args: any) => ({
      id: postId,
      ...args.data,
    }));

    const result = await processPostPublishing({ postId, workspaceId });

    expect(result.success).toBe(true);
    expect(result.status).toBe(PostStatus.PUBLISHED);
    expect(prisma.publishAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        postId,
        status: AttemptStatus.SUCCESS,
        attemptNumber: 1,
      }),
    });
  });

  it('publishes a SCHEDULED LinkedIn post successfully with provider URN', async () => {
    (prisma.post.findFirst as any).mockResolvedValue({
      id: postId,
      workspaceId,
      status: PostStatus.SCHEDULED,
      content: 'Company announcement on LinkedIn!',
      mediaUrls: [],
      publishAttempts: [],
      socialAccount: {
        id: 'acc-li-1',
        provider: SocialProvider.LINKEDIN,
        providerAccountId: 'urn:li:person:li-999',
        encryptedAccessToken: 'mock-li-token',
        status: 'ACTIVE',
      },
    });

    (prisma.post.update as any).mockImplementation((args: any) => ({
      id: postId,
      ...args.data,
    }));

    const result = await processPostPublishing({ postId, workspaceId });

    expect(result.success).toBe(true);
    expect(result.status).toBe(PostStatus.PUBLISHED);
    expect(result.providerPostId).toContain('urn:li:share:');
    expect(prisma.publishAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        postId,
        status: AttemptStatus.SUCCESS,
        attemptNumber: 1,
      }),
    });
  });

  it('enforces atomic lease lock: exits early without publishing if another worker claimed post', async () => {
    (prisma.post.findFirst as any).mockResolvedValue({
      id: postId,
      workspaceId,
      status: PostStatus.SCHEDULED,
      content: 'Sale',
      mediaUrls: [],
      publishAttempts: [],
      socialAccount: {
        id: 'acc-1',
        provider: SocialProvider.META_INSTAGRAM,
        encryptedAccessToken: 'mock-token',
        status: 'ACTIVE',
      },
    });

    // Simulate concurrent worker claiming the lease first
    (prisma.post.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await processPostPublishing({ postId, workspaceId });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('LEASE_ACQUISITION_FAILED');
    expect(prisma.publishAttempt.create).not.toHaveBeenCalled();
  });

  it('fails safely and records attempt when social account is inactive', async () => {
    (prisma.post.findFirst as any).mockResolvedValue({
      id: postId,
      workspaceId,
      status: PostStatus.SCHEDULED,
      content: 'Sale announcement',
      mediaUrls: [],
      publishAttempts: [],
      socialAccount: {
        id: 'acc-1',
        provider: SocialProvider.LINKEDIN,
        encryptedAccessToken: 'mock-token',
        status: 'DISCONNECTED',
      },
    });

    (prisma.post.update as any).mockImplementation((args: any) => ({
      id: postId,
      ...args.data,
    }));

    const result = await processPostPublishing({ postId, workspaceId });

    expect(result.success).toBe(false);
    expect(result.status).toBe(PostStatus.FAILED);
    expect(prisma.publishAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        postId,
        status: AttemptStatus.FAILED,
        errorCode: 'NO_ACTIVE_SOCIAL_ACCOUNT',
      }),
    });
  });
});

describe('FallbackScheduler', () => {
  it('polls due posts and processes them without throwing', async () => {
    const scheduler = new FallbackScheduler(5000);

    (prisma.post.findMany as any).mockResolvedValue([
      {
        id: 'post-due-1',
        workspaceId: 'ws-1',
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() - 1000),
      },
    ]);

    (prisma.post.findFirst as any).mockResolvedValue({
      id: 'post-due-1',
      workspaceId: 'ws-1',
      status: PostStatus.SCHEDULED,
      publishAttempts: [],
      socialAccount: {
        id: 'acc-1',
        provider: SocialProvider.META_FACEBOOK,
        providerAccountId: 'fb-12345',
        encryptedAccessToken: 'mock-token',
        status: 'ACTIVE',
      },
    });

    (prisma.post.update as any).mockResolvedValue({
      id: 'post-due-1',
      status: PostStatus.PUBLISHED,
    });

    const count = await scheduler.pollDuePosts();
    expect(count).toBe(1);
  });
});

describe('processPostPublishing — ambiguous & transient classification', () => {
  const postId = '60b8d29f1c9d440000a11111';
  const workspaceId = '60b8d29f1c9d440000a22222';

  function realTokenPostFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: postId,
      workspaceId,
      status: PostStatus.SCHEDULED,
      content: 'Launch sale now!',
      mediaUrls: [],
      publishAttempts: [],
      socialAccount: {
        id: 'acc-fb-1',
        provider: SocialProvider.META_FACEBOOK,
        providerAccountId: 'fb-page-1',
        encryptedAccessToken: 'encrypted-real-token',
        status: 'ACTIVE',
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    (prisma.post.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.post.update as any).mockImplementation((args: any) => ({
      id: postId,
      ...args.data,
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('marks a network-error outcome as UNKNOWN_OUTCOME and schedules reconciliation', async () => {
    (prisma.post.findFirst as any).mockResolvedValue(realTokenPostFixture());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')));

    const result = await processPostPublishing({ postId, workspaceId });

    expect(result.success).toBe(false);
    expect(result.status).toBe(PostStatus.UNKNOWN_OUTCOME);
    expect(prisma.publishAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        postId,
        status: AttemptStatus.UNKNOWN,
        errorCode: 'AMBIGUOUS_PUBLISH_OUTCOME',
      }),
    });
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: expect.objectContaining({
        status: PostStatus.UNKNOWN_OUTCOME,
        reconciliationDueAt: expect.any(Date),
      }),
    });
  });

  it('re-schedules (bounded retry) on a transient provider 5xx', async () => {
    (prisma.post.findFirst as any).mockResolvedValue(realTokenPostFixture());
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: { code: 2, message: 'temporary outage' } }),
      }),
    );

    const result = await processPostPublishing({ postId, workspaceId });

    expect(result.status).toBe(PostStatus.SCHEDULED);
    expect(prisma.publishAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: AttemptStatus.FAILED,
        isTransient: true,
      }),
    });
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: expect.objectContaining({
        status: PostStatus.SCHEDULED,
        scheduledAt: expect.any(Date),
      }),
    });
  });
});
