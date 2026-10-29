import { SocialProvider } from '@commercepilot/database';
import { DEFAULT_META_GRAPH_API_VERSION } from './instagram-graph.client';

/**
 * Post-publish reconciliation client.
 *
 * When a publish outcome is ambiguous (network error / timeout after a request
 * may have been accepted), we must NOT blindly mark the post FAILED — a manual
 * retry could create a duplicate. Instead we verify against the provider:
 *
 *   FOUND        -> a provider post matching our content/time window exists.
 *   NOT_FOUND    -> the provider search completed cleanly AND enough time has
 *                   elapsed since the scheduled publish, so absence is trusted.
 *   INCONCLUSIVE -> provider unreachable, permissions missing, or too soon to
 *                   trust an empty result. Caller should retry later.
 */

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type ReconcileOutcome =
  | { status: 'FOUND'; providerPostId: string }
  | { status: 'NOT_FOUND' }
  | { status: 'INCONCLUSIVE'; errorCode: string; errorMessage: string };

export interface ReconcileParams {
  provider: SocialProvider;
  providerAccountId: string;
  accessToken: string;
  content: string;
  mediaUrls: string[];
  scheduledAt: Date;
  graphApiVersion?: string;
  fetchImpl?: FetchLike;
}

/** Providers must propagate the post before we trust an empty search result. */
export const CONFIRM_ABSENT_MIN_AGE_MS = 10 * 60 * 1000;
const SEARCH_WINDOW_BEFORE_MS = 10 * 60 * 1000;
const SEARCH_WINDOW_AFTER_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

interface ReconcileSearchItem {
  id?: string;
  message?: string;
  name?: string;
  caption?: string;
  commentary?: string;
  created?: { time?: number };
  [key: string]: unknown;
}

interface ReconcileSearchBody {
  error?: { code?: number; message?: string };
  data?: ReconcileSearchItem[];
  elements?: ReconcileSearchItem[];
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function graphVersion(version?: string): string {
  return version && version.trim() !== '' ? version : DEFAULT_META_GRAPH_API_VERSION;
}

function tooSoonToConfirm(scheduledAt: Date): boolean {
  return Date.now() - scheduledAt.getTime() < CONFIRM_ABSENT_MIN_AGE_MS;
}

function inconclusive(errorCode: string, errorMessage: string): ReconcileOutcome {
  return { status: 'INCONCLUSIVE', errorCode, errorMessage };
}

async function fetchJson(
  url: string,
  accessToken: string,
  fetchImpl: FetchLike,
): Promise<{ ok: boolean; httpStatus: number; body: ReconcileSearchBody }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    let body: ReconcileSearchBody = {};
    try {
      body = (await res.json()) as ReconcileSearchBody;
    } catch {
      body = {};
    }
    return { ok: res.ok, httpStatus: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function windowParams(scheduledAt: Date): { since: number; until: number } {
  const since = Math.floor((scheduledAt.getTime() - SEARCH_WINDOW_BEFORE_MS) / 1000);
  const until = Math.floor((scheduledAt.getTime() + SEARCH_WINDOW_AFTER_MS) / 1000);
  return { since, until };
}

function matchField(candidate: unknown, content: string): boolean {
  return typeof candidate === 'string' && normalize(candidate) === normalize(content);
}

async function reconcileFacebook(
  params: ReconcileParams,
  fetchImpl: FetchLike,
): Promise<ReconcileOutcome> {
  const version = graphVersion(params.graphApiVersion);
  const { since, until } = windowParams(params.scheduledAt);
  const hasMedia = params.mediaUrls.length > 0;
  const base = `https://graph.facebook.com/${version}/${params.providerAccountId}`;
  const edge = hasMedia ? 'photos' : 'feed';
  const field = hasMedia ? 'name' : 'message';
  const url =
    `${base}/${edge}?fields=id,${field},created_time` +
    `&since=${since}&until=${until}&limit=50&access_token=${params.accessToken}`;

  let result: { ok: boolean; httpStatus: number; body: ReconcileSearchBody };
  try {
    result = await fetchJson(url, params.accessToken, fetchImpl);
  } catch {
    return inconclusive('RECONCILIATION_NETWORK_ERROR', 'Network error contacting Meta Graph API.');
  }

  if (!result.ok || result.body.error) {
    return inconclusive(
      'RECONCILIATION_PROVIDER_ERROR',
      `Meta reconciliation search failed (HTTP ${result.httpStatus}).`,
    );
  }

  const data = Array.isArray(result.body.data) ? result.body.data : [];
  for (const item of data) {
    if (matchField(item[field], params.content) && typeof item.id === 'string') {
      return { status: 'FOUND', providerPostId: item.id };
    }
  }

  if (tooSoonToConfirm(params.scheduledAt)) {
    return inconclusive(
      'RECONCILIATION_TOO_EARLY',
      'Provider search returned no match before the confirmation window elapsed.',
    );
  }
  return { status: 'NOT_FOUND' };
}

async function reconcileInstagram(
  params: ReconcileParams,
  fetchImpl: FetchLike,
): Promise<ReconcileOutcome> {
  const version = graphVersion(params.graphApiVersion);
  const { since, until } = windowParams(params.scheduledAt);
  const url =
    `https://graph.facebook.com/${version}/${params.providerAccountId}/media` +
    `?fields=id,caption,timestamp&since=${since}&until=${until}&limit=100` +
    `&access_token=${params.accessToken}`;

  let result: { ok: boolean; httpStatus: number; body: ReconcileSearchBody };
  try {
    result = await fetchJson(url, params.accessToken, fetchImpl);
  } catch {
    return inconclusive('RECONCILIATION_NETWORK_ERROR', 'Network error contacting Instagram Graph API.');
  }

  if (!result.ok || result.body.error) {
    return inconclusive(
      'RECONCILIATION_PROVIDER_ERROR',
      `Instagram reconciliation search failed (HTTP ${result.httpStatus}).`,
    );
  }

  const data = Array.isArray(result.body.data) ? result.body.data : [];
  for (const item of data) {
    if (matchField(item.caption, params.content) && typeof item.id === 'string') {
      return { status: 'FOUND', providerPostId: item.id };
    }
  }

  if (tooSoonToConfirm(params.scheduledAt)) {
    return inconclusive(
      'RECONCILIATION_TOO_EARLY',
      'Provider search returned no match before the confirmation window elapsed.',
    );
  }
  return { status: 'NOT_FOUND' };
}

async function reconcileLinkedIn(
  params: ReconcileParams,
  fetchImpl: FetchLike,
): Promise<ReconcileOutcome> {
  const authorUrn = params.providerAccountId.startsWith('urn:li:')
    ? params.providerAccountId
    : `urn:li:person:${params.providerAccountId}`;

  const url =
    `https://api.linkedin.com/rest/posts?author=${encodeURIComponent(authorUrn)}` +
    `&q=author&count=50&sortBy=LAST_MODIFIED`;

  let result: { ok: boolean; httpStatus: number; body: ReconcileSearchBody };
  try {
    result = await fetchJson(url, params.accessToken, fetchImpl);
  } catch {
    return inconclusive('RECONCILIATION_NETWORK_ERROR', 'Network error contacting LinkedIn REST API.');
  }

  if (!result.ok) {
    return inconclusive(
      'RECONCILIATION_PROVIDER_ERROR',
      `LinkedIn reconciliation search failed (HTTP ${result.httpStatus}).`,
    );
  }

  const elements = Array.isArray(result.body.elements) ? result.body.elements : [];
  const windowStart = params.scheduledAt.getTime() - SEARCH_WINDOW_BEFORE_MS;
  const windowEnd = params.scheduledAt.getTime() + SEARCH_WINDOW_AFTER_MS;

  for (const element of elements) {
    const createdMs = element.created?.time;
    if (typeof createdMs === 'number' && (createdMs < windowStart || createdMs > windowEnd)) {
      continue;
    }
    if (matchField(element.commentary, params.content) && typeof element.id === 'string') {
      return { status: 'FOUND', providerPostId: element.id };
    }
  }

  if (tooSoonToConfirm(params.scheduledAt)) {
    return inconclusive(
      'RECONCILIATION_TOO_EARLY',
      'Provider search returned no match before the confirmation window elapsed.',
    );
  }
  return { status: 'NOT_FOUND' };
}

export async function reconcileProviderPost(params: ReconcileParams): Promise<ReconcileOutcome> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const provider = params.provider;

  if (provider === SocialProvider.META_INSTAGRAM) {
    return reconcileInstagram(params, fetchImpl);
  }
  if (provider === SocialProvider.LINKEDIN) {
    return reconcileLinkedIn(params, fetchImpl);
  }
  if (provider === SocialProvider.META_FACEBOOK) {
    return reconcileFacebook(params, fetchImpl);
  }

  // Providers without a wired reconciliation flow are never marked NOT_FOUND.
  return inconclusive(
    'RECONCILIATION_UNSUPPORTED_PROVIDER',
    `Reconciliation is not implemented for provider ${provider}.`,
  );
}
