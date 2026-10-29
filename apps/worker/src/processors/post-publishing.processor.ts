import {
  prisma,
  PostStatus,
  AttemptStatus,
  SocialProvider,
  type PublishAttempt,
} from '@commercepilot/database';
import { decryptToken } from '../crypto.util';
import {
  DEFAULT_META_GRAPH_API_VERSION,
  publishInstagramFeedPost,
  validateInstagramCaption,
  validateInstagramMediaUrls,
} from '../providers/instagram-graph.client';
import {
  isAmbiguousErrorCode,
  RECONCILIATION_INITIAL_DELAY_MS,
} from './post-reconciliation.processor';

export interface PostPublishingJobData {
  postId: string;
  workspaceId: string;
}

export interface PostPublishingResult {
  postId: string;
  success: boolean;
  status: PostStatus;
  providerPostId?: string | undefined;
  errorCode?: string | undefined;
}

/** Bounded retry ceiling for transient failures before a post is marked FAILED. */
export const MAX_PUBLISH_ATTEMPTS = 3;
const TRANSIENT_BACKOFF_BASE_MS = 30_000;
const TRANSIENT_BACKOFF_MAX_MS = 5 * 60 * 1000;

/**
 * Process publication of a scheduled post.
 * Enforces atomic state transitions via conditional leases, full attempt history, and safe retry classification.
 */
export async function processPostPublishing(
  data: PostPublishingJobData,
): Promise<PostPublishingResult> {
  const { postId, workspaceId } = data;

  const post = await prisma.post.findFirst({
    where: { id: postId, workspaceId },
    include: {
      socialAccount: true,
      publishAttempts: true,
    },
  });

  if (!post) {
    throw new Error(`Post ${postId} not found in workspace ${workspaceId}`);
  }

  // Prevent duplicate execution if post has already been published, failed, or cancelled
  if (post.status !== PostStatus.SCHEDULED && post.status !== PostStatus.APPROVED) {
    return {
      postId: post.id,
      success: post.status === PostStatus.PUBLISHED,
      status: post.status,
    };
  }

  // 1. Atomic lease acquisition: only one worker can transition from SCHEDULED/APPROVED to PUBLISHING
  const lease = await prisma.post.updateMany({
    where: {
      id: postId,
      workspaceId,
      status: { in: [PostStatus.SCHEDULED, PostStatus.APPROVED] },
    },
    data: {
      status: PostStatus.PUBLISHING,
    },
  });

  if (lease.count === 0) {
    // Another worker acquired the lease or post state changed concurrently
    return {
      postId: post.id,
      success: false,
      status: post.status,
      errorCode: 'LEASE_ACQUISITION_FAILED',
    };
  }

  const socialAccount = post.socialAccount;
  const attemptNumber = post.publishAttempts.length + 1;

  // 2. Validate linked social account
  if (!socialAccount || socialAccount.status !== 'ACTIVE') {
    const attempt: PublishAttempt = await prisma.publishAttempt.create({
      data: {
        postId: post.id,
        attemptNumber,
        status: AttemptStatus.FAILED,
        errorCode: 'NO_ACTIVE_SOCIAL_ACCOUNT',
        errorMessage: 'Linked social account is missing, disconnected, or inactive.',
        isTransient: false,
      },
    });

    await prisma.post.update({
      where: { id: postId },
      data: { status: PostStatus.FAILED },
    });

    return {
      postId: post.id,
      success: false,
      status: PostStatus.FAILED,
      errorCode: attempt.errorCode ?? undefined,
    };
  }

  // 3. Decrypt access token securely
  let accessToken: string;
  if (
    socialAccount.encryptedAccessToken.startsWith('mock-') ||
    socialAccount.encryptedAccessToken.startsWith('test-')
  ) {
    accessToken = socialAccount.encryptedAccessToken;
  } else {
    try {
      accessToken = decryptToken(socialAccount.encryptedAccessToken);
    } catch {
      await prisma.publishAttempt.create({
        data: {
          postId: post.id,
          attemptNumber,
          status: AttemptStatus.FAILED,
          errorCode: 'TOKEN_DECRYPTION_FAILED',
          errorMessage: 'Unable to decrypt social account access token.',
          isTransient: false,
        },
      });

      await prisma.post.update({
        where: { id: postId },
        data: { status: PostStatus.FAILED },
      });

      return {
        postId: post.id,
        success: false,
        status: PostStatus.FAILED,
        errorCode: 'TOKEN_DECRYPTION_FAILED',
      };
    }
  }

  // 4. Provider execution
  const isInstagram = socialAccount.provider === SocialProvider.META_INSTAGRAM;
  const isSimulation =
    process.env['NODE_ENV'] === 'test' ||
    accessToken.startsWith('mock-') ||
    accessToken.startsWith('test-') ||
    socialAccount.providerAccountId.startsWith('test-') ||
    socialAccount.providerAccountId.startsWith('mock-');

  let providerPostId: string | undefined;
  let providerRequestId: string | undefined;
  let success = false;
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  let isTransient = false;

  if (isSimulation) {
    let providerPrefix = 'fb';
    if (socialAccount.provider === SocialProvider.META_INSTAGRAM) providerPrefix = 'ig';
    else if (socialAccount.provider === SocialProvider.LINKEDIN) providerPrefix = 'li';

    providerPostId =
      socialAccount.provider === SocialProvider.LINKEDIN
        ? `urn:li:share:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        : `${providerPrefix}_pub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    providerRequestId = `worker_sim_req_${Date.now()}`;
    success = true;
  } else {
    try {
      if (socialAccount.provider === SocialProvider.LINKEDIN) {
        // LinkedIn Posts API (REST v202401)
        const authorUrn = socialAccount.providerAccountId.startsWith('urn:li:')
          ? socialAccount.providerAccountId
          : `urn:li:person:${socialAccount.providerAccountId}`;

        const postBody = {
          author: authorUrn,
          commentary: post.content,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        };

        const res = await fetch('https://api.linkedin.com/rest/posts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'LinkedIn-Version': '202401',
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postBody),
        });

        if (!res.ok) {
          const errText = await res.text();
          errorCode = `LINKEDIN_HTTP_${res.status}`;
          errorMessage = `LinkedIn post publish failed: ${errText}`;
          isTransient = res.status === 429 || res.status >= 500;
        } else {
          success = true;
          providerPostId = res.headers.get('x-restli-id') ?? `urn:li:share:${Date.now()}`;
          providerRequestId = res.headers.get('x-li-uuid') ?? `req_li_${Date.now()}`;
        }
      } else if (isInstagram) {
        const captionError = validateInstagramCaption(post.content);
        const mediaError = validateInstagramMediaUrls(post.mediaUrls);
        if (captionError || mediaError) {
          const validation = captionError ?? mediaError!;
          errorCode = validation.errorCode;
          errorMessage = validation.errorMessage;
          isTransient = false;
        } else {
          const graphResult = await publishInstagramFeedPost({
            igUserId: socialAccount.providerAccountId,
            accessToken,
            caption: post.content,
            mediaUrls: post.mediaUrls,
            graphApiVersion: process.env['META_GRAPH_API_VERSION'] || DEFAULT_META_GRAPH_API_VERSION,
          });

          if (graphResult.success) {
            success = true;
            providerPostId = graphResult.providerPostId;
            providerRequestId = graphResult.providerRequestId;
          } else {
            errorCode = graphResult.errorCode;
            errorMessage = graphResult.errorMessage;
            isTransient = graphResult.ambiguous ? false : graphResult.isTransient;
          }
        }
      } else {
        // Facebook Page publication
        const hasMedia = post.mediaUrls.length > 0;
        const graphVersion = process.env['META_GRAPH_API_VERSION'] || DEFAULT_META_GRAPH_API_VERSION;
        const endpoint = hasMedia
          ? `https://graph.facebook.com/${graphVersion}/${socialAccount.providerAccountId}/photos`
          : `https://graph.facebook.com/${graphVersion}/${socialAccount.providerAccountId}/feed`;

        const body: Record<string, string> = {
          access_token: accessToken,
          ...(hasMedia ? { url: post.mediaUrls[0]!, caption: post.content } : { message: post.content }),
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = (await res.json()) as {
          id?: string;
          post_id?: string;
          error?: { code: number; message: string };
        };

        if (!res.ok || (!data.id && !data.post_id) || data.error) {
          const errCode = data.error?.code ?? res.status;
          errorCode = `META_ERR_${errCode}`;
          errorMessage = data.error?.message ?? 'Facebook post publish failed.';
          isTransient = errCode === 4 || errCode === 17 || errCode === 2 || res.status >= 500;
        } else {
          success = true;
          providerPostId = data.post_id || data.id;
          providerRequestId = res.headers.get('x-fb-request-id') ?? `req_${Date.now()}`;
        }
      }
    } catch (networkErr) {
      errorCode = 'AMBIGUOUS_PUBLISH_OUTCOME';
      errorMessage = (networkErr as Error).message || 'Ambiguous outcome: network error contacting Meta.';
      isTransient = false;
    }
  }

  const isAmbiguous = isAmbiguousErrorCode(errorCode);
  const attemptStatus = success
    ? AttemptStatus.SUCCESS
    : isAmbiguous
      ? AttemptStatus.UNKNOWN
      : AttemptStatus.FAILED;

  // 5. Persist PublishAttempt record
  await prisma.publishAttempt.create({
    data: {
      postId: post.id,
      attemptNumber,
      status: attemptStatus,
      providerRequestId: providerRequestId ?? null,
      errorCode: errorCode ?? null,
      errorMessage: errorMessage ?? null,
      isTransient,
    },
  });

  // 6. Update final Post status
  if (success && providerPostId) {
    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        providerPostId,
      },
    });

    return {
      postId: post.id,
      success: true,
      status: updated.status,
      providerPostId: updated.providerPostId ?? undefined,
    };
  }

  if (isAmbiguous) {
    // Outcome unknown: do NOT mark FAILED (a blind retry could duplicate).
    // Persist an UNKNOWN_OUTCOME state and schedule reconciliation to verify.
    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.UNKNOWN_OUTCOME,
        reconciliationAttempts: 0,
        reconciliationDueAt: new Date(Date.now() + RECONCILIATION_INITIAL_DELAY_MS),
      },
    });

    return {
      postId: post.id,
      success: false,
      status: updated.status,
      errorCode,
    };
  }

  if (isTransient && attemptNumber < MAX_PUBLISH_ATTEMPTS) {
    // Bounded retry: re-schedule with exponential backoff. The always-running
    // fallback scheduler picks the post up again once it becomes due.
    const backoffMs = Math.min(
      TRANSIENT_BACKOFF_MAX_MS,
      TRANSIENT_BACKOFF_BASE_MS * 2 ** (attemptNumber - 1),
    );
    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.SCHEDULED,
        scheduledAt: new Date(Date.now() + backoffMs),
      },
    });

    return {
      postId: post.id,
      success: false,
      status: updated.status,
      errorCode,
    };
  }

  // Permanent failure, or transient retries exhausted.
  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      status: PostStatus.FAILED,
    },
  });

  return {
    postId: post.id,
    success: false,
    status: updated.status,
    errorCode,
  };
}
