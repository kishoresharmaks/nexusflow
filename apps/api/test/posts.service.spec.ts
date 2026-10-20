import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostsService } from '../src/posts/posts.service';
import { PostStatus, ApprovalStatus, AttemptStatus, SocialProvider } from '@commercepilot/database';
import type { PrismaService } from '../src/database/prisma.service';
import type { AuditService } from '../src/audit/audit.service';
import type { SocialService } from '../src/social/social.service';
import type { PublishingAdapterFactory } from '../src/posts/publishing/publishing-adapter.factory';

describe('PostsService', () => {
  let service: PostsService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockSocial: any;
  let mockAdapterFactory: any;
  let mockAdapter: any;

  const validWorkspaceId = '507f1f77bcf86cd799439011';
  const validPostId = '507f1f77bcf86cd799439012';
  const validUserId = '507f1f77bcf86cd799439099';
  const validAccountId = '507f1f77bcf86cd799439033';

  beforeEach(() => {
    mockPrisma = {
      post: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      approval: {
        create: vi.fn(),
      },
      publishAttempt: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      product: {
        findFirst: vi.fn(),
      },
      socialAccount: {
        findFirst: vi.fn(),
      },
    };

    mockAudit = { record: vi.fn() };
    mockSocial = {
      getDecryptedTokens: vi.fn().mockResolvedValue({ accessToken: 'mock-token-xyz' }),
    };

    mockAdapter = {
      publish: vi.fn(),
    };

    mockAdapterFactory = {
      getAdapter: vi.fn().mockReturnValue(mockAdapter),
    };

    service = new PostsService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
      mockSocial as unknown as SocialService,
      mockAdapterFactory as unknown as PublishingAdapterFactory,
    );
  });

  describe('createPost', () => {
    it('creates post as DRAFT and records audit event', async () => {
      mockPrisma.post.create.mockResolvedValue({
        id: validPostId,
        workspaceId: validWorkspaceId,
        content: 'Exciting spring release!',
        mediaUrls: [],
        status: PostStatus.DRAFT,
      });

      const post = await service.createPost(
        validWorkspaceId,
        { content: 'Exciting spring release!' },
        validUserId,
      );

      expect(post.status).toBe(PostStatus.DRAFT);
      expect(mockPrisma.post.create).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'POST_CREATED' }),
      );
    });
  });

  describe('Approval State Transitions', () => {
    it('requestApproval moves DRAFT post to AWAITING_APPROVAL', async () => {
      mockPrisma.post.findFirst.mockResolvedValue({
        id: validPostId,
        workspaceId: validWorkspaceId,
        status: PostStatus.DRAFT,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: validPostId,
        status: PostStatus.AWAITING_APPROVAL,
      });

      const updated = await service.requestApproval(validWorkspaceId, validPostId, validUserId);
      expect(updated.status).toBe(PostStatus.AWAITING_APPROVAL);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'POST_APPROVAL_REQUESTED' }),
      );
    });

    it('approvePost transitions AWAITING_APPROVAL to APPROVED and records Approval record', async () => {
      mockPrisma.post.findFirst.mockResolvedValue({
        id: validPostId,
        workspaceId: validWorkspaceId,
        status: PostStatus.AWAITING_APPROVAL,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: validPostId,
        status: PostStatus.APPROVED,
      });
      mockPrisma.approval.create.mockResolvedValue({
        id: '507f1f77bcf86cd799439044',
        postId: validPostId,
        status: ApprovalStatus.APPROVED,
      });

      const updated = await service.approvePost(
        validWorkspaceId,
        validPostId,
        { decisionNotes: 'Looks great for campaign launch.' },
        validUserId,
      );

      expect(updated.status).toBe(PostStatus.APPROVED);
      expect(mockPrisma.approval.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: ApprovalStatus.APPROVED,
          decisionNotes: 'Looks great for campaign launch.',
        }),
      });
    });

    it('rejectPost transitions AWAITING_APPROVAL back to DRAFT', async () => {
      mockPrisma.post.findFirst.mockResolvedValue({
        id: validPostId,
        workspaceId: validWorkspaceId,
        status: PostStatus.AWAITING_APPROVAL,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: validPostId,
        status: PostStatus.DRAFT,
      });
      mockPrisma.approval.create.mockResolvedValue({
        id: '507f1f77bcf86cd799439044',
        postId: validPostId,
        status: ApprovalStatus.REJECTED,
      });

      const updated = await service.rejectPost(
        validWorkspaceId,
        validPostId,
        { decisionNotes: 'Please tone down the punctuation.' },
        validUserId,
      );

      expect(updated.status).toBe(PostStatus.DRAFT);
      expect(mockPrisma.approval.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: ApprovalStatus.REJECTED }),
      });
    });
  });

  describe('Scheduling', () => {
    it('schedules an APPROVED post with scheduledAt date', async () => {
      mockPrisma.post.findFirst.mockResolvedValue({
        id: validPostId,
        workspaceId: validWorkspaceId,
        status: PostStatus.APPROVED,
      });
      const targetDate = new Date(Date.now() + 86400000).toISOString();
      mockPrisma.post.update.mockResolvedValue({
        id: validPostId,
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(targetDate),
      });

      const scheduled = await service.schedulePost(
        validWorkspaceId,
        validPostId,
        { scheduledAt: targetDate },
        validUserId,
      );

      expect(scheduled.status).toBe(PostStatus.SCHEDULED);
      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: validPostId },
        data: expect.objectContaining({ status: PostStatus.SCHEDULED }),
      });
    });
  });

  describe('publishNow and State Machine Enforcement', () => {
    it('disallows duplicate publishing if post is already PUBLISHING or PUBLISHED', async () => {
      mockPrisma.post.findFirst.mockResolvedValue({
        id: validPostId,
        workspaceId: validWorkspaceId,
        status: PostStatus.PUBLISHED,
        publishAttempts: [],
      });

      await expect(service.publishNow(validWorkspaceId, validPostId, validUserId)).rejects.toThrow(
        'Duplicate publishing disallowed',
      );
    });

    it('successfully publishes, marks PUBLISHED, and persists PublishAttempt', async () => {
      mockPrisma.post.findFirst.mockResolvedValue({
        id: validPostId,
        workspaceId: validWorkspaceId,
        status: PostStatus.APPROVED,
        content: 'Check out our new arrivals!',
        mediaUrls: ['https://s3.example.com/asset.png'],
        socialAccount: {
          id: validAccountId,
          provider: SocialProvider.META_INSTAGRAM,
          displayName: 'Acme IG',
        },
        publishAttempts: [],
      });

      mockAdapter.publish.mockResolvedValue({
        success: true,
        providerPostId: 'ig_post_999888',
        providerRequestId: 'req_123',
        isTransient: false,
      });

      mockPrisma.publishAttempt.create.mockResolvedValue({
        id: 'attempt-1',
        postId: validPostId,
        attemptNumber: 1,
        status: AttemptStatus.SUCCESS,
        providerRequestId: 'req_123',
        isTransient: false,
      });

      mockPrisma.post.update
        .mockResolvedValueOnce({ status: PostStatus.PUBLISHING })
        .mockResolvedValueOnce({
          id: validPostId,
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          providerPostId: 'ig_post_999888',
        });

      const result = await service.publishNow(validWorkspaceId, validPostId, validUserId);

      expect(result.post.status).toBe(PostStatus.PUBLISHED);
      expect(result.attempt.status).toBe(AttemptStatus.SUCCESS);
      expect(mockPrisma.publishAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          attemptNumber: 1,
          status: AttemptStatus.SUCCESS,
        }),
      });
    });

    it('records transient failure without blind duplicate retry', async () => {
      mockPrisma.post.findFirst.mockResolvedValue({
        id: validPostId,
        workspaceId: validWorkspaceId,
        status: PostStatus.APPROVED,
        content: 'Flash sale starting now!',
        mediaUrls: [],
        socialAccount: {
          id: validAccountId,
          provider: SocialProvider.LINKEDIN,
          displayName: 'Acme LinkedIn',
        },
        publishAttempts: [],
      });

      mockAdapter.publish.mockResolvedValue({
        success: false,
        errorCode: 'RATE_LIMIT',
        errorMessage: 'Provider rate limit exceeded',
        isTransient: true,
      });

      mockPrisma.publishAttempt.create.mockResolvedValue({
        id: 'attempt-1',
        postId: validPostId,
        attemptNumber: 1,
        status: AttemptStatus.FAILED,
        errorCode: 'RATE_LIMIT',
        isTransient: true,
      });

      mockPrisma.post.update
        .mockResolvedValueOnce({ status: PostStatus.PUBLISHING })
        .mockResolvedValueOnce({
          id: validPostId,
          status: PostStatus.FAILED,
        });

      const result = await service.publishNow(validWorkspaceId, validPostId, validUserId);

      expect(result.post.status).toBe(PostStatus.FAILED);
      expect(result.attempt.status).toBe(AttemptStatus.FAILED);
      expect(result.attempt.isTransient).toBe(true);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'POST_PUBLISH_FAILED' }),
      );
    });
  });
});
