import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SocialService } from '../social/social.service';
import { PublishingAdapterFactory } from './publishing/publishing-adapter.factory';
import { PublishingQueueService } from './publishing-queue.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SchedulePostDto } from './dto/schedule-post.dto';
import { ApprovalDecisionDto } from './dto/approval-decision.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import {
  PostStatus,
  ApprovalStatus,
  AttemptStatus,
  type Post,
  type Approval,
  type PublishAttempt,
  type Prisma,
} from '@commercepilot/database';

export interface PostListResponse {
  items: Array<
    Post & {
      product?: { id: string; title: string; sku: string | null } | null;
      socialAccount?: {
        id: string;
        provider: string;
        displayName: string;
      } | null;
      latestApproval?: Approval | null;
      attemptsCount: number;
    }
  >;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly socialService: SocialService,
    private readonly adapterFactory: PublishingAdapterFactory,
    private readonly publishingQueueService?: PublishingQueueService,
  ) {}

  private validateObjectId(id: string, label: string): void {
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new BadRequestException(`Invalid ${label} format.`);
    }
  }

  async createPost(
    workspaceId: string,
    dto: CreatePostDto,
    userId: string,
    clientIp?: string,
  ): Promise<Post> {
    this.validateObjectId(workspaceId, 'workspace ID');

    if (dto.productId) {
      this.validateObjectId(dto.productId, 'product ID');
      const prod = await this.prisma.product.findFirst({
        where: { id: dto.productId, workspaceId },
      });
      if (!prod) {
        throw new NotFoundException('Linked product not found in this workspace.');
      }
    }

    if (dto.campaignId) {
      this.validateObjectId(dto.campaignId, 'campaign ID');
      const camp = await this.prisma.campaign.findFirst({
        where: { id: dto.campaignId, workspaceId },
      });
      if (!camp) {
        throw new NotFoundException('Linked campaign not found in this workspace.');
      }
    }

    if (dto.socialAccountId) {
      this.validateObjectId(dto.socialAccountId, 'social account ID');
      const account = await this.prisma.socialAccount.findFirst({
        where: { id: dto.socialAccountId, workspaceId },
      });
      if (!account) {
        throw new NotFoundException('Linked social account not found in this workspace.');
      }
    }

    const post = await this.prisma.post.create({
      data: {
        workspaceId,
        content: dto.content,
        mediaUrls: dto.mediaUrls ?? [],
        productId: dto.productId ?? null,
        campaignId: dto.campaignId ?? null,
        socialAccountId: dto.socialAccountId ?? null,
        status: PostStatus.DRAFT,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'POST_CREATED',
      resourceType: 'Post',
      resourceId: post.id,
      metadata: { status: post.status },
      ipAddress: clientIp,
    });

    return post;
  }

  async getPosts(workspaceId: string, query: QueryPostsDto): Promise<PostListResponse> {
    this.validateObjectId(workspaceId, 'workspace ID');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PostWhereInput = {
      workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
      ...(query.socialAccountId ? { socialAccountId: query.socialAccountId } : {}),
    };

    const [total, posts] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          product: { select: { id: true, title: true, sku: true } },
          socialAccount: {
            select: { id: true, provider: true, displayName: true },
          },
          approvals: {
            orderBy: { decidedAt: 'desc' },
            take: 1,
          },
          _count: {
            select: { publishAttempts: true },
          },
        },
      }),
    ]);

    const items = posts.map((p) => ({
      ...p,
      latestApproval: p.approvals[0] ?? null,
      attemptsCount: p._count.publishAttempts,
    }));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getPostById(workspaceId: string, postId: string): Promise<Post> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(postId, 'post ID');

    const post = await this.prisma.post.findFirst({
      where: { id: postId, workspaceId },
      include: {
        product: true,
        socialAccount: {
          select: {
            id: true,
            provider: true,
            displayName: true,
            username: true,
            status: true,
          },
        },
        approvals: {
          orderBy: { decidedAt: 'desc' },
        },
        publishAttempts: {
          orderBy: { attemptNumber: 'desc' },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found in this workspace.');
    }

    return post;
  }

  async updatePost(
    workspaceId: string,
    postId: string,
    dto: UpdatePostDto,
    userId: string,
    clientIp?: string,
  ): Promise<Post> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(postId, 'post ID');

    const existing = await this.prisma.post.findFirst({
      where: { id: postId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Post not found in this workspace.');
    }

    if (existing.status === PostStatus.PUBLISHING || existing.status === PostStatus.PUBLISHED) {
      throw new BadRequestException(`Cannot edit a post with status ${existing.status}.`);
    }

    // If post was awaiting approval, editing invalidates approval and returns to draft
    const newStatus =
      existing.status === PostStatus.AWAITING_APPROVAL ? PostStatus.DRAFT : existing.status;

    const data: Prisma.PostUpdateInput = {
      status: newStatus,
    };

    if (dto.content !== undefined) data.content = dto.content;
    if (dto.mediaUrls !== undefined) data.mediaUrls = dto.mediaUrls;
    if (dto.productId !== undefined) {
      if (dto.productId) {
        this.validateObjectId(dto.productId, 'product ID');
        const prod = await this.prisma.product.findFirst({
          where: { id: dto.productId, workspaceId },
        });
        if (!prod) {
          throw new NotFoundException('Linked product not found in this workspace.');
        }
      }
      data.product = dto.productId ? { connect: { id: dto.productId } } : { disconnect: true };
    }
    if (dto.campaignId !== undefined) {
      if (dto.campaignId) {
        this.validateObjectId(dto.campaignId, 'campaign ID');
        const camp = await this.prisma.campaign.findFirst({
          where: { id: dto.campaignId, workspaceId },
        });
        if (!camp) {
          throw new NotFoundException('Linked campaign not found in this workspace.');
        }
      }
      data.campaign = dto.campaignId ? { connect: { id: dto.campaignId } } : { disconnect: true };
    }
    if (dto.socialAccountId !== undefined) {
      if (dto.socialAccountId) {
        this.validateObjectId(dto.socialAccountId, 'social account ID');
        const account = await this.prisma.socialAccount.findFirst({
          where: { id: dto.socialAccountId, workspaceId },
        });
        if (!account) {
          throw new NotFoundException('Linked social account not found in this workspace.');
        }
      }
      data.socialAccount = dto.socialAccountId
        ? { connect: { id: dto.socialAccountId } }
        : { disconnect: true };
    }
    if (dto.scheduledAt !== undefined) {
      data.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data,
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'POST_UPDATED',
      resourceType: 'Post',
      resourceId: postId,
      metadata: { changes: Object.keys(dto) },
      ipAddress: clientIp,
    });

    return updated;
  }

  async deletePost(
    workspaceId: string,
    postId: string,
    userId: string,
    clientIp?: string,
  ): Promise<{ success: boolean; id: string }> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(postId, 'post ID');

    const existing = await this.prisma.post.findFirst({
      where: { id: postId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Post not found in this workspace.');
    }

    if (existing.status === PostStatus.PUBLISHING || existing.status === PostStatus.PUBLISHED) {
      throw new BadRequestException(`Cannot delete a post with status ${existing.status}.`);
    }

    await this.prisma.post.delete({
      where: { id: postId },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'POST_DELETED',
      resourceType: 'Post',
      resourceId: postId,
      ipAddress: clientIp,
    });

    return { success: true, id: postId };
  }

  // --- Approval Pipeline ---

  async requestApproval(
    workspaceId: string,
    postId: string,
    userId: string,
    clientIp?: string,
  ): Promise<Post> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(postId, 'post ID');

    const post = await this.prisma.post.findFirst({
      where: { id: postId, workspaceId },
    });

    if (!post) {
      throw new NotFoundException('Post not found in this workspace.');
    }

    if (post.status !== PostStatus.DRAFT && post.status !== PostStatus.FAILED) {
      throw new BadRequestException(
        `Approval can only be requested for DRAFT or FAILED posts. Current status: ${post.status}.`,
      );
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.AWAITING_APPROVAL },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'POST_APPROVAL_REQUESTED',
      resourceType: 'Post',
      resourceId: postId,
      ipAddress: clientIp,
    });

    return updated;
  }

  async approvePost(
    workspaceId: string,
    postId: string,
    dto: ApprovalDecisionDto,
    reviewerId: string,
    clientIp?: string,
  ): Promise<Post> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(postId, 'post ID');

    const post = await this.prisma.post.findFirst({
      where: { id: postId, workspaceId },
    });

    if (!post) {
      throw new NotFoundException('Post not found in this workspace.');
    }

    if (post.status !== PostStatus.AWAITING_APPROVAL) {
      throw new BadRequestException(
        `Post must be in AWAITING_APPROVAL status to be approved. Current status: ${post.status}.`,
      );
    }

    const [updated] = await Promise.all([
      this.prisma.post.update({
        where: { id: postId },
        data: { status: PostStatus.APPROVED },
      }),
      this.prisma.approval.create({
        data: {
          postId,
          reviewerId,
          status: ApprovalStatus.APPROVED,
          decisionNotes: dto.decisionNotes ?? null,
        },
      }),
    ]);

    await this.auditService.record({
      workspaceId,
      userId: reviewerId,
      action: 'POST_APPROVED',
      resourceType: 'Post',
      resourceId: postId,
      metadata: { notes: dto.decisionNotes },
      ipAddress: clientIp,
    });

    return updated;
  }

  async rejectPost(
    workspaceId: string,
    postId: string,
    dto: ApprovalDecisionDto,
    reviewerId: string,
    clientIp?: string,
  ): Promise<Post> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(postId, 'post ID');

    const post = await this.prisma.post.findFirst({
      where: { id: postId, workspaceId },
    });

    if (!post) {
      throw new NotFoundException('Post not found in this workspace.');
    }

    if (post.status !== PostStatus.AWAITING_APPROVAL) {
      throw new BadRequestException(
        `Post must be in AWAITING_APPROVAL status to be rejected. Current status: ${post.status}.`,
      );
    }

    const [updated] = await Promise.all([
      this.prisma.post.update({
        where: { id: postId },
        data: { status: PostStatus.DRAFT },
      }),
      this.prisma.approval.create({
        data: {
          postId,
          reviewerId,
          status: ApprovalStatus.REJECTED,
          decisionNotes: dto.decisionNotes ?? null,
        },
      }),
    ]);

    await this.auditService.record({
      workspaceId,
      userId: reviewerId,
      action: 'POST_REJECTED',
      resourceType: 'Post',
      resourceId: postId,
      metadata: { notes: dto.decisionNotes },
      ipAddress: clientIp,
    });

    return updated;
  }

  // --- Scheduling ---

  async schedulePost(
    workspaceId: string,
    postId: string,
    dto: SchedulePostDto,
    userId: string,
    clientIp?: string,
  ): Promise<Post> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(postId, 'post ID');

    const post = await this.prisma.post.findFirst({
      where: { id: postId, workspaceId },
      include: { socialAccount: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found in this workspace.');
    }

    // In CommercePilot: posts must be APPROVED or DRAFT before scheduling
    if (
      post.status !== PostStatus.APPROVED &&
      post.status !== PostStatus.DRAFT &&
      post.status !== PostStatus.FAILED
    ) {
      throw new BadRequestException(
        `Cannot schedule post in ${post.status} status. It must be APPROVED or DRAFT.`,
      );
    }

    // Validate explicit social account target (no fallback)
    const targetAccountId = dto.socialAccountId || post.socialAccountId;
    if (dto.socialAccountId) {
      this.validateObjectId(dto.socialAccountId, 'social account ID');
      const account = await this.prisma.socialAccount.findFirst({
        where: { id: dto.socialAccountId, workspaceId },
      });
      if (!account || account.status !== 'ACTIVE') {
        throw new BadRequestException('Selected target social account is inactive or not found.');
      }
    }

    const scheduledDate = new Date(dto.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException('Invalid scheduledAt timestamp.');
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.SCHEDULED,
        scheduledAt: scheduledDate,
        ...(dto.socialAccountId ? { socialAccount: { connect: { id: dto.socialAccountId } } } : {}),
      },
    });

    // Enqueue delayed job into BullMQ post-publishing queue
    if (this.publishingQueueService) {
      await this.publishingQueueService.enqueueScheduledPost(
        workspaceId,
        postId,
        scheduledDate,
      );
    }

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'POST_SCHEDULED',
      resourceType: 'Post',
      resourceId: postId,
      metadata: { scheduledAt: scheduledDate.toISOString(), socialAccountId: targetAccountId },
      ipAddress: clientIp,
    });

    return updated;
  }

  async cancelPost(
    workspaceId: string,
    postId: string,
    userId: string,
    clientIp?: string,
  ): Promise<Post> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(postId, 'post ID');

    const post = await this.prisma.post.findFirst({
      where: { id: postId, workspaceId },
    });

    if (!post) {
      throw new NotFoundException('Post not found in this workspace.');
    }

    if (post.status !== PostStatus.SCHEDULED && post.status !== PostStatus.AWAITING_APPROVAL) {
      throw new BadRequestException(
        `Cannot cancel post in ${post.status} status. Only SCHEDULED or AWAITING_APPROVAL can be cancelled.`,
      );
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.CANCELLED,
      },
    });

    // Invalidate pending BullMQ delayed job
    if (this.publishingQueueService) {
      await this.publishingQueueService.cancelPostJob(postId);
    }

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'POST_CANCELLED',
      resourceType: 'Post',
      resourceId: postId,
      ipAddress: clientIp,
    });

    return updated;
  }

  // --- Immediate Publishing Pipeline ---

  async publishNow(
    workspaceId: string,
    postId: string,
    userId: string,
    clientIp?: string,
  ): Promise<{ post: Post; attempt: PublishAttempt }> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(postId, 'post ID');

    const post = await this.prisma.post.findFirst({
      where: { id: postId, workspaceId },
      include: {
        socialAccount: true,
        publishAttempts: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found in this workspace.');
    }

    if (post.status === PostStatus.PUBLISHING || post.status === PostStatus.PUBLISHED) {
      throw new ConflictException(
        `Post is already ${post.status}. Duplicate publishing disallowed.`,
      );
    }

    // Resolve explicit target social account - no arbitrary silent fallback
    let socialAccount = post.socialAccount;
    if (!socialAccount && post.socialAccountId) {
      socialAccount = await this.prisma.socialAccount.findFirst({
        where: { id: post.socialAccountId, workspaceId },
      });
    }

    if (!socialAccount) {
      throw new BadRequestException(
        'A target social account must be explicitly selected before publishing a post.',
      );
    }

    if (socialAccount.status && socialAccount.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Target social account is ${socialAccount.status.toLowerCase()} and cannot be used for publishing.`,
      );
    }

    // 1. Mark transition to PUBLISHING
    await this.prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.PUBLISHING },
    });

    // 2. Fetch decrypted tokens
    const { accessToken } = await this.socialService.getDecryptedTokens(
      workspaceId,
      socialAccount.id,
    );

    // 3. Dispatch to Provider Adapter
    const adapter = this.adapterFactory.getAdapter(socialAccount.provider);
    const result = await adapter.publish(
      socialAccount,
      {
        postId: post.id,
        content: post.content,
        mediaUrls: post.mediaUrls,
      },
      accessToken,
    );

    const attemptNumber = post.publishAttempts.length + 1;

    // 4. Record PublishAttempt
    const attempt = await this.prisma.publishAttempt.create({
      data: {
        postId: post.id,
        attemptNumber,
        status: result.success ? AttemptStatus.SUCCESS : AttemptStatus.FAILED,
        providerRequestId: result.providerRequestId ?? null,
        errorCode: result.errorCode ?? null,
        errorMessage: result.errorMessage ?? null,
        isTransient: result.isTransient,
      },
    });

    // 5. Update Post outcome
    let finalPost: Post;
    if (result.success) {
      finalPost = await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(),
          providerPostId: result.providerPostId ?? null,
          socialAccount: { connect: { id: socialAccount.id } },
        },
      });

      await this.auditService.record({
        workspaceId,
        userId,
        action: 'POST_PUBLISHED',
        resourceType: 'Post',
        resourceId: postId,
        metadata: {
          provider: socialAccount.provider,
          providerPostId: result.providerPostId,
        },
        ipAddress: clientIp,
      });
    } else {
      // On failure, update post status to FAILED
      finalPost = await this.prisma.post.update({
        where: { id: postId },
        data: {
          status: PostStatus.FAILED,
          socialAccount: { connect: { id: socialAccount.id } },
        },
      });

      await this.auditService.record({
        workspaceId,
        userId,
        action: 'POST_PUBLISH_FAILED',
        resourceType: 'Post',
        resourceId: postId,
        metadata: {
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          isTransient: result.isTransient,
        },
        ipAddress: clientIp,
      });
    }

    return { post: finalPost, attempt };
  }

  async getAttempts(workspaceId: string, postId: string): Promise<PublishAttempt[]> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(postId, 'post ID');

    const post = await this.prisma.post.findFirst({
      where: { id: postId, workspaceId },
    });

    if (!post) {
      throw new NotFoundException('Post not found in this workspace.');
    }

    return this.prisma.publishAttempt.findMany({
      where: { postId },
      orderBy: { attemptNumber: 'asc' },
    });
  }
}
