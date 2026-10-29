/**
 * Official Meta Instagram Graph content-publishing client.
 *
 * Flow (Content Publishing API):
 * 1. POST /{ig-user-id}/media  — create a container (IMAGE, REELS, or CAROUSEL)
 * 2. GET  /{creation-id}?fields=status_code until FINISHED (required for video)
 * 3. POST /{ig-user-id}/media_publish — publish only after FINISHED
 *
 * Does not fabricate provider post IDs. Callers must mock `fetch` in tests.
 */

export const DEFAULT_META_GRAPH_API_VERSION = 'v21.0';

export const INSTAGRAM_CAPTION_MAX_CHARS = 2200;
export const INSTAGRAM_HASHTAG_MAX = 30;
export const INSTAGRAM_CAROUSEL_MIN = 2;
export const INSTAGRAM_CAROUSEL_MAX = 10;

const DEFAULT_TIMEOUT_MS = 20_000;
const CONTAINER_POLL_INTERVAL_MS = 2_000;
const CONTAINER_POLL_ATTEMPTS = 20;

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface InstagramGraphFailure {
  success: false;
  errorCode: string;
  errorMessage: string;
  isTransient: boolean;
  retryAfterSeconds?: number;
  ambiguous: boolean;
}

export interface InstagramGraphSuccess {
  success: true;
  providerPostId: string;
  providerRequestId?: string;
}

export type InstagramGraphResult = InstagramGraphSuccess | InstagramGraphFailure;

interface GraphErrorBody {
  error?: { code?: number; message?: string; error_subcode?: number };
  id?: string;
  status_code?: string;
}

function failure(
  errorCode: string,
  errorMessage: string,
  opts?: { isTransient?: boolean; retryAfterSeconds?: number; ambiguous?: boolean },
): InstagramGraphFailure {
  return {
    success: false,
    errorCode,
    errorMessage,
    isTransient: opts?.isTransient ?? false,
    ...(opts?.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: opts.retryAfterSeconds }
      : {}),
    ambiguous: opts?.ambiguous ?? false,
  };
}

function isGraphFailure(
  value: { id: string } | InstagramGraphFailure,
): value is InstagramGraphFailure {
  return 'success' in value && value.success === false;
}

export function classifyMetaGraphError(
  httpStatus: number,
  error?: { code?: number; message?: string; error_subcode?: number },
): InstagramGraphFailure {
  const errCode = error?.code ?? httpStatus;
  const errMsg = error?.message ?? `Meta API request failed with HTTP ${httpStatus}`;
  const isRateLimit = errCode === 4 || errCode === 17 || errCode === 32;
  const mediaNotReady = errCode === 9007 || errCode === 24;
  const isServer5xx = errCode === 2 || httpStatus >= 500;
  const isTransient = isRateLimit || isServer5xx || mediaNotReady;

  return failure(`META_ERR_${errCode}`, errMsg, {
    isTransient,
    ...(isRateLimit ? { retryAfterSeconds: 300 } : isTransient ? { retryAfterSeconds: 15 } : {}),
    ambiguous: false,
  });
}

export function validateInstagramCaption(content: string): InstagramGraphFailure | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return failure('CAPTION_REQUIRED', 'Post caption cannot be empty.');
  }
  if (trimmed.length > INSTAGRAM_CAPTION_MAX_CHARS) {
    return failure(
      'CAPTION_TOO_LONG',
      `Post caption exceeds Instagram limit of ${INSTAGRAM_CAPTION_MAX_CHARS} characters (${trimmed.length} chars).`,
    );
  }
  const hashtags = trimmed.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  if (hashtags.length > INSTAGRAM_HASHTAG_MAX) {
    return failure(
      'TOO_MANY_HASHTAGS',
      `Hashtag count (${hashtags.length}) exceeds Instagram limit of ${INSTAGRAM_HASHTAG_MAX}.`,
    );
  }
  return null;
}

export function validateInstagramMediaUrls(mediaUrls: string[]): InstagramGraphFailure | null {
  if (!mediaUrls.length) {
    return failure(
      'MEDIA_REQUIRED',
      'Instagram Feed posts require at least one image or video media URL.',
    );
  }
  if (mediaUrls.length > INSTAGRAM_CAROUSEL_MAX) {
    return failure(
      'TOO_MANY_MEDIA_ITEMS',
      `Instagram carousels support at most ${INSTAGRAM_CAROUSEL_MAX} items.`,
    );
  }
  for (const url of mediaUrls) {
    if (!isPublicHttpsUrl(url)) {
      return failure(
        'INVALID_MEDIA_URL',
        'Instagram requires publicly reachable HTTPS media URLs (Meta fetches them server-side).',
      );
    }
  }
  return null;
}

export function isPublicHttpsUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (host.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v)(\?.*)?$/i.test(url);
}

function graphVersion(version?: string): string {
  return version && version.trim() !== '' ? version : DEFAULT_META_GRAPH_API_VERSION;
}

function sleepDefault(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function graphRequest(
  url: string,
  init: RequestInit,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<{ httpStatus: number; body: GraphErrorBody; requestId?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    let body: GraphErrorBody = {};
    try {
      body = (await res.json()) as GraphErrorBody;
    } catch {
      body = {};
    }
    const requestId = res.headers.get('x-fb-request-id');
    return {
      httpStatus: res.status,
      body,
      ...(requestId ? { requestId } : {}),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function graphPost(
  url: string,
  fields: Record<string, string>,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<{ httpStatus: number; body: GraphErrorBody; requestId?: string }> {
  return graphRequest(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    },
    fetchImpl,
    timeoutMs,
  );
}

async function createContainer(
  igUserId: string,
  version: string,
  fields: Record<string, string>,
  fetchImpl: FetchLike,
): Promise<{ id: string } | InstagramGraphFailure> {
  const url = `https://graph.facebook.com/${version}/${igUserId}/media`;
  let result: { httpStatus: number; body: GraphErrorBody };
  try {
    result = await graphPost(url, fields, fetchImpl, DEFAULT_TIMEOUT_MS);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error creating Instagram media container.';
    return failure('NETWORK_TIMEOUT', message, { isTransient: true, retryAfterSeconds: 60 });
  }

  if (!result.body.id || result.body.error || result.httpStatus >= 400) {
    return classifyMetaGraphError(result.httpStatus, result.body.error);
  }
  return { id: result.body.id };
}

async function waitUntilFinished(
  creationId: string,
  accessToken: string,
  version: string,
  fetchImpl: FetchLike,
  sleep: (ms: number) => Promise<void>,
): Promise<InstagramGraphFailure | null> {
  for (let attempt = 0; attempt < CONTAINER_POLL_ATTEMPTS; attempt++) {
    const url = new URL(`https://graph.facebook.com/${version}/${creationId}`);
    url.searchParams.set('fields', 'status_code');
    url.searchParams.set('access_token', accessToken);

    let result: { httpStatus: number; body: GraphErrorBody };
    try {
      result = await graphRequest(url.toString(), { method: 'GET' }, fetchImpl, DEFAULT_TIMEOUT_MS);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error polling Instagram container status.';
      return failure('AMBIGUOUS_PUBLISH_OUTCOME', message, {
        isTransient: false,
        ambiguous: true,
      });
    }

    if (result.body.error || result.httpStatus >= 400) {
      return classifyMetaGraphError(result.httpStatus, result.body.error);
    }

    const status = (result.body.status_code || '').toUpperCase();
    // Photo containers are often ready immediately and may omit status_code.
    if (!status || status === 'FINISHED' || status === 'PUBLISHED') {
      return null;
    }
    if (status === 'ERROR' || status === 'EXPIRED') {
      return failure(
        `CONTAINER_${status}`,
        `Instagram media container entered ${status} before publish.`,
      );
    }

    await sleep(CONTAINER_POLL_INTERVAL_MS);
  }

  return failure(
    'CONTAINER_NOT_READY',
    'Instagram media container did not reach FINISHED before the publish timeout.',
    { isTransient: true, retryAfterSeconds: 30 },
  );
}

async function publishContainer(
  igUserId: string,
  creationId: string,
  accessToken: string,
  version: string,
  fetchImpl: FetchLike,
): Promise<InstagramGraphResult> {
  const url = `https://graph.facebook.com/${version}/${igUserId}/media_publish`;
  let result: { httpStatus: number; body: GraphErrorBody; requestId?: string };
  try {
    result = await graphPost(
      url,
      { creation_id: creationId, access_token: accessToken },
      fetchImpl,
      DEFAULT_TIMEOUT_MS,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error publishing Instagram container.';
    return failure('AMBIGUOUS_PUBLISH_OUTCOME', message, {
      isTransient: false,
      ambiguous: true,
    });
  }

  if (!result.body.id || result.body.error || result.httpStatus >= 400) {
    return classifyMetaGraphError(result.httpStatus, result.body.error);
  }

  return {
    success: true,
    providerPostId: result.body.id,
    ...(result.requestId ? { providerRequestId: result.requestId } : {}),
  };
}

async function createAndWait(
  igUserId: string,
  accessToken: string,
  version: string,
  fields: Record<string, string>,
  fetchImpl: FetchLike,
  sleep: (ms: number) => Promise<void>,
): Promise<{ id: string } | InstagramGraphFailure> {
  const created = await createContainer(igUserId, version, fields, fetchImpl);
  if (isGraphFailure(created)) {
    return created;
  }
  const ready = await waitUntilFinished(created.id, accessToken, version, fetchImpl, sleep);
  if (ready) {
    return ready;
  }
  return created;
}

export async function publishInstagramFeedPost(params: {
  igUserId: string;
  accessToken: string;
  caption: string;
  mediaUrls: string[];
  graphApiVersion?: string;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}): Promise<InstagramGraphResult> {
  const captionError = validateInstagramCaption(params.caption);
  if (captionError) return captionError;
  const mediaError = validateInstagramMediaUrls(params.mediaUrls);
  if (mediaError) return mediaError;

  const fetchImpl = params.fetchImpl ?? fetch;
  const sleep = params.sleep ?? sleepDefault;
  const version = graphVersion(params.graphApiVersion);
  const caption = params.caption.trim();
  const urls = params.mediaUrls;
  const token = params.accessToken;
  const igUserId = params.igUserId;

  try {
    if (urls.length >= INSTAGRAM_CAROUSEL_MIN) {
      const childIds: string[] = [];
      for (const url of urls) {
        const childFields: Record<string, string> = {
          access_token: token,
          is_carousel_item: 'true',
        };
        if (isVideoUrl(url)) {
          childFields['media_type'] = 'VIDEO';
          childFields['video_url'] = url;
        } else {
          childFields['image_url'] = url;
        }
        const child = await createAndWait(igUserId, token, version, childFields, fetchImpl, sleep);
        if (isGraphFailure(child)) {
          return child;
        }
        childIds.push(child.id);
      }

      const carousel = await createAndWait(
        igUserId,
        token,
        version,
        {
          access_token: token,
          media_type: 'CAROUSEL',
          children: childIds.join(','),
          caption,
        },
        fetchImpl,
        sleep,
      );
      if (isGraphFailure(carousel)) {
        return carousel;
      }
      return publishContainer(igUserId, carousel.id, token, version, fetchImpl);
    }

    const url = urls[0]!;
    const fields: Record<string, string> = {
      access_token: token,
      caption,
    };
    if (isVideoUrl(url)) {
      fields['media_type'] = 'REELS';
      fields['video_url'] = url;
      fields['share_to_feed'] = 'true';
    } else {
      fields['image_url'] = url;
    }

    const container = await createAndWait(igUserId, token, version, fields, fetchImpl, sleep);
    if (isGraphFailure(container)) {
      return container;
    }
    return publishContainer(igUserId, container.id, token, version, fetchImpl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected Instagram publish failure.';
    return failure('AMBIGUOUS_PUBLISH_OUTCOME', message, {
      isTransient: false,
      ambiguous: true,
    });
  }
}
