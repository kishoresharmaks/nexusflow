import {
  prisma,
  PostStatus,
  AttemptStatus,
} from '@commercepilot/database';
import { decryptToken } from '../crypto.util';
import { reconcileProviderPost } from '../providers/reconciliation.client';

export interface ReconciliationJobData {
  postId: string;
  workspaceId: string;
}

export interface ReconciliationResult {
  postId: string;
  resolved: boolean;
  status: PostStatus;
  providerPostId?: string | undefined;
  errorCode?: string | undefined;
}

export const MAX_RECONCILIATION_ATTEMPTS = 5;
export const RECONCILIATION_INITIAL_DELAY_MS = 2 * 60 * 1000;
const RECONCILIATION_BACKOFF_BASE_MS = 2 * 60 * 1000;
const RECONCILIATION_BACKOFF_MAX_MS = 30 * 60 * 1000;

const AMBIGUOUS_CODES = new Set(['AMBIGUOUS_PUBLISH_OUTCOME', 'AMBIGUOUS_TIMEOUT']);

export function isAmbiguousErrorCode(errorCode: string | undefined): boolean {
  return errorCode !== undefined && AMBIGUOUS_CODES.has(errorCode);
}

function isMockToken(encrypted: string): boolean {
  return encrypted.startsWith('mock-') || encrypted.startsWith('test-');
}

function decryptedAccessToken(encryptedAccessToken: string): string {
  if (isMockToken(encryptedAccessToken)) {
    return encryptedAccessToken;
  }
  return decryptToken(encryptedAccessToken);
}

async function resolveLatestUnknownAttempt(
  postId: string,
  resolution: {
    status: 'SUCCESS' | 'FAILED';
    providerRequestId?: string;
    errorCode?: string;
    errorMessage?: string;
  },
): Promise<void> {
  const attempt = await prisma.publishAttempt.findFirst({
    where: { postId, status: AttemptStatus.UNKNOWN },
    orderBy: { attemptNumber: 'desc' },
  });
  if (!attempt) return;

  await prisma.publishAttempt.update({
    where: { id: attempt.id },
    data: {
      status: resolution.status,
      ...(resolution.providerRequestId ? { providerRequestId: resolution.providerRequestId } : {}),
      ...(resolution.errorCode ? { errorCode: resolution.errorCode } : {}),
      ...(resolution.errorMessage ? { errorMessage: resolution.errorMessage } : {}),
    },
  });
}

function logEvent(level: 'info' | 'warn' | 'error', message: string, fields: Record<string, unknown>): void {
  const method = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error;
  method(JSON.stringify({ level, message, ...fields, timestamp: new Date().toISOString() }));
}

/**
 * Reconcile a single post whose publish outcome is ambiguous (UNKNOWN_OUTCOME).
 * Uses an atomic lease so concurrent scans/workers never reconcile twice.
 */
export async function processReconciliation(
  data: ReconciliationJobData,
): Promise<ReconciliationResult> {
  const { postId, workspaceId } = data;

  const post = await prisma.post.findFirst({
    where: { id: postId, workspaceId },
    include: { socialAccount: true, publishAttempts: true },
  });

  if (!post) {
    throw new Error(`Post ${postId} not found in workspace ${workspaceId}`);
  }

  if (post.status !== PostStatus.UNKNOWN_OUTCOME) {
    return { postId: post.id, resolved: false, status: post.status };
  }

  // Atomic claim: only one reconciler clears the due timestamp and proceeds.
  const claim = await prisma.post.updateMany({
    where: {
      id: postId,
      workspaceId,
      status: PostStatus.UNKNOWN_OUTCOME,
      reconciliationDueAt: { lte: new Date() },
    },
    data: { reconciliationDueAt: null },
  });

  if (claim.count === 0) {
    return {
      postId: post.id,
      resolved: false,
      status: post.status,
      errorCode: 'RECONCILIATION_LEASE_FAILED',
    };
  }

  const socialAccount = post.socialAccount;
  const attempts = post.reconciliationAttempts + 1;

  if (!socialAccount || socialAccount.status !== 'ACTIVE') {
    await prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.FAILED,
        reconciliationDueAt: null,
        reconciliationAttempts: attempts,
      },
    });
    await resolveLatestUnknownAttempt(postId, {
      status: AttemptStatus.FAILED,
      errorCode: 'NO_ACTIVE_SOCIAL_ACCOUNT',
      errorMessage: 'Cannot reconcile: linked social account is missing or inactive.',
    });
    return { postId: post.id, resolved: true, status: PostStatus.FAILED };
  }

  let accessToken: string;
  try {
    accessToken = decryptedAccessToken(socialAccount.encryptedAccessToken);
  } catch {
    await prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.FAILED,
        reconciliationDueAt: null,
        reconciliationAttempts: attempts,
      },
    });
    await resolveLatestUnknownAttempt(postId, {
      status: AttemptStatus.FAILED,
      errorCode: 'TOKEN_DECRYPTION_FAILED',
      errorMessage: 'Unable to decrypt social account access token during reconciliation.',
    });
    return { postId: post.id, resolved: true, status: PostStatus.FAILED };
  }

  const outcome = await reconcileProviderPost({
    provider: socialAccount.provider,
    providerAccountId: socialAccount.providerAccountId,
    accessToken,
    content: post.content,
    mediaUrls: post.mediaUrls,
    scheduledAt: post.scheduledAt ?? post.createdAt,
  });

  if (outcome.status === 'FOUND') {
    await prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        providerPostId: outcome.providerPostId,
        reconciliationDueAt: null,
        reconciliationAttempts: attempts,
      },
    });
    await resolveLatestUnknownAttempt(postId, {
      status: AttemptStatus.SUCCESS,
      providerRequestId: outcome.providerPostId,
    });
    logEvent('info', 'Post publish outcome reconciled as PUBLISHED.', {
      postId,
      providerPostId: outcome.providerPostId,
      reconciliationAttempts: attempts,
    });
    return {
      postId: post.id,
      resolved: true,
      status: PostStatus.PUBLISHED,
      providerPostId: outcome.providerPostId,
    };
  }

  if (outcome.status === 'NOT_FOUND') {
    await prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.FAILED,
        reconciliationDueAt: null,
        reconciliationAttempts: attempts,
      },
    });
    await resolveLatestUnknownAttempt(postId, {
      status: AttemptStatus.FAILED,
      errorCode: 'RECONCILIATION_CONFIRMED_ABSENT',
      errorMessage: 'Provider search confirmed no matching post; safe to retry manually.',
    });
    logEvent('info', 'Post publish outcome reconciled as confirmed-absent (FAILED).', {
      postId,
      reconciliationAttempts: attempts,
    });
    return {
      postId: post.id,
      resolved: true,
      status: PostStatus.FAILED,
      errorCode: 'RECONCILIATION_CONFIRMED_ABSENT',
    };
  }

  // INCONCLUSIVE — either too early or provider unreachable.
  if (attempts >= MAX_RECONCILIATION_ATTEMPTS) {
    await prisma.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.FAILED,
        reconciliationDueAt: null,
        reconciliationAttempts: attempts,
      },
    });
    await resolveLatestUnknownAttempt(postId, {
      status: AttemptStatus.FAILED,
      errorCode: 'RECONCILIATION_EXHAUSTED',
      errorMessage: `Reconciliation could not resolve after ${attempts} attempts (${outcome.errorCode}).`,
    });
    logEvent('warn', 'Post reconciliation exhausted without resolution.', {
      postId,
      lastErrorCode: outcome.errorCode,
      reconciliationAttempts: attempts,
    });
    return {
      postId: post.id,
      resolved: true,
      status: PostStatus.FAILED,
      errorCode: 'RECONCILIATION_EXHAUSTED',
    };
  }

  const backoffMs = Math.min(
    RECONCILIATION_BACKOFF_MAX_MS,
    RECONCILIATION_BACKOFF_BASE_MS * 2 ** (attempts - 1),
  );
  await prisma.post.update({
    where: { id: postId },
    data: {
      reconciliationAttempts: attempts,
      reconciliationDueAt: new Date(Date.now() + backoffMs),
    },
  });
  logEvent('info', 'Post reconciliation inconclusive; rescheduled.', {
    postId,
    errorCode: outcome.errorCode,
    reconciliationAttempts: attempts,
    retryAfterMs: backoffMs,
  });
  return {
    postId: post.id,
    resolved: false,
    status: PostStatus.UNKNOWN_OUTCOME,
    errorCode: outcome.errorCode,
  };
}

/**
 * Scan and reconcile all posts whose reconciliation window is now due.
 * Shared by the BullMQ reconciliation worker and the MongoDB fallback scheduler.
 */
export async function processDueReconciliations(): Promise<{
  scanned: number;
  resolved: number;
  pending: number;
  failed: number;
}> {
  const duePosts = await prisma.post.findMany({
    where: {
      status: PostStatus.UNKNOWN_OUTCOME,
      reconciliationDueAt: { lte: new Date() },
    },
    take: 50,
    orderBy: { reconciliationDueAt: 'asc' },
  });

  let resolved = 0;
  let pending = 0;
  let failed = 0;

  for (const post of duePosts) {
    try {
      const result = await processReconciliation({
        postId: post.id,
        workspaceId: post.workspaceId,
      });
      if (result.resolved) resolved += 1;
      else pending += 1;
    } catch (err) {
      failed += 1;
      logEvent('error', 'Reconciliation failed for post.', {
        postId: post.id,
        error: (err as Error).message,
      });
    }
  }

  return { scanned: duePosts.length, resolved, pending, failed };
}
