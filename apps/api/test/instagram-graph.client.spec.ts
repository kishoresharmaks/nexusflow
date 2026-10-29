import { describe, it, expect, vi } from 'vitest';
import {
  publishInstagramFeedPost,
  validateInstagramCaption,
  validateInstagramMediaUrls,
  classifyMetaGraphError,
  type FetchLike,
} from '../src/integrations/instagram/instagram-graph.client';

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('Instagram Graph client', () => {
  it('rejects empty captions, oversize captions, and over-limit hashtags', () => {
    expect(validateInstagramCaption('   ')?.errorCode).toBe('CAPTION_REQUIRED');
    expect(validateInstagramCaption('A'.repeat(2201))?.errorCode).toBe('CAPTION_TOO_LONG');
    const tooManyTags = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(' ');
    expect(validateInstagramCaption(tooManyTags)?.errorCode).toBe('TOO_MANY_HASHTAGS');
    expect(validateInstagramCaption('Summer drop #fashion')).toBeNull();
  });

  it('requires public HTTPS media and rejects localhost', () => {
    expect(validateInstagramMediaUrls([])?.errorCode).toBe('MEDIA_REQUIRED');
    expect(
      validateInstagramMediaUrls(['http://cdn.example.com/photo.jpg'])?.errorCode,
    ).toBe('INVALID_MEDIA_URL');
    expect(validateInstagramMediaUrls(['https://localhost/photo.jpg'])?.errorCode).toBe(
      'INVALID_MEDIA_URL',
    );
    expect(validateInstagramMediaUrls(['https://cdn.example.com/photo.jpg'])).toBeNull();
  });

  it('classifies Meta rate limits as transient and 400s as permanent', () => {
    const rate = classifyMetaGraphError(400, { code: 4, message: 'rate limited' });
    expect(rate.isTransient).toBe(true);
    expect(rate.retryAfterSeconds).toBe(300);

    const bad = classifyMetaGraphError(400, { code: 100, message: 'bad param' });
    expect(bad.isTransient).toBe(false);
  });

  it('publishes a single image after container create + status + media_publish', async () => {
    const fetchImpl = vi.fn<FetchLike>(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/media_publish')) {
        return jsonRes({ id: 'ig_media_999' }, 200, { 'x-fb-request-id': 'req_abc' });
      }
      if (method === 'POST' && url.endsWith('/media')) {
        return jsonRes({ id: 'container_1' });
      }
      if (method === 'GET' && url.includes('container_1')) {
        return jsonRes({ status_code: 'FINISHED' });
      }
      return jsonRes({ error: { code: 100, message: `unexpected ${method} ${url}` } }, 400);
    });

    const result = await publishInstagramFeedPost({
      igUserId: '17841400000000001',
      accessToken: 'page-token',
      caption: 'New sandals in stock #fashion',
      mediaUrls: ['https://cdn.example.com/sandals.jpg'],
      fetchImpl,
      sleep: async () => undefined,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.providerPostId).toBe('ig_media_999');
      expect(result.providerRequestId).toBe('req_abc');
    }
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('treats a missing status_code as ready so photo posts do not stall', async () => {
    const fetchImpl = vi.fn<FetchLike>(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/media_publish')) {
        return jsonRes({ id: 'ig_photo_1' });
      }
      if (method === 'POST' && url.endsWith('/media')) {
        return jsonRes({ id: 'container_photo' });
      }
      return jsonRes({ id: 'container_photo' });
    });

    const result = await publishInstagramFeedPost({
      igUserId: '17841400000000001',
      accessToken: 'page-token',
      caption: 'Photo caption',
      mediaUrls: ['https://cdn.example.com/look.jpg'],
      fetchImpl,
      sleep: async () => undefined,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.providerPostId).toBe('ig_photo_1');
    }
  });

  it('polls video containers until FINISHED before publishing as REELS', async () => {
    let polls = 0;
    const fetchImpl = vi.fn<FetchLike>(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'POST' && url.endsWith('/media')) {
        expect(String(init?.body)).toContain('REELS');
        expect(String(init?.body)).toContain('video_url');
        return jsonRes({ id: 'container_video' });
      }
      if (url.includes('container_video') && method === 'GET') {
        polls += 1;
        return jsonRes({ status_code: polls < 2 ? 'IN_PROGRESS' : 'FINISHED' });
      }
      if (url.includes('/media_publish')) {
        return jsonRes({ id: 'ig_reel_55' });
      }
      return jsonRes({ error: { message: 'unexpected' } }, 400);
    });

    const result = await publishInstagramFeedPost({
      igUserId: '17841400000000001',
      accessToken: 'page-token',
      caption: 'Reel drop',
      mediaUrls: ['https://cdn.example.com/clip.mp4'],
      fetchImpl,
      sleep: async () => undefined,
    });

    expect(result.success).toBe(true);
    expect(polls).toBeGreaterThanOrEqual(2);
  });

  it('creates carousel children then a CAROUSEL parent before publish', async () => {
    const created: string[] = [];
    const fetchImpl = vi.fn<FetchLike>(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = String(init?.body || '');
      if (method === 'POST' && url.endsWith('/media')) {
        if (body.includes('CAROUSEL')) {
          created.push('carousel_parent');
          return jsonRes({ id: 'carousel_parent' });
        }
        const id = `child_${created.length + 1}`;
        created.push(id);
        return jsonRes({ id });
      }
      if (method === 'GET') {
        return jsonRes({ status_code: 'FINISHED' });
      }
      if (url.includes('/media_publish')) {
        expect(body).toContain('carousel_parent');
        return jsonRes({ id: 'ig_carousel_7' });
      }
      return jsonRes({ error: { message: 'unexpected' } }, 400);
    });

    const result = await publishInstagramFeedPost({
      igUserId: '17841400000000001',
      accessToken: 'page-token',
      caption: 'Carousel lookbook',
      mediaUrls: [
        'https://cdn.example.com/1.jpg',
        'https://cdn.example.com/2.jpg',
        'https://cdn.example.com/3.jpg',
      ],
      fetchImpl,
      sleep: async () => undefined,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.providerPostId).toBe('ig_carousel_7');
    }
    expect(created.filter((id) => id.startsWith('child_'))).toHaveLength(3);
  });

  it('marks a dropped publish handshake as ambiguous and not retryable', async () => {
    const fetchImpl = vi.fn<FetchLike>(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'POST' && url.endsWith('/media')) {
        return jsonRes({ id: 'container_1' });
      }
      if (method === 'GET') {
        return jsonRes({ status_code: 'FINISHED' });
      }
      throw new Error('socket hang up after media_publish');
    });

    const result = await publishInstagramFeedPost({
      igUserId: '17841400000000001',
      accessToken: 'page-token',
      caption: 'Ambiguous publish',
      mediaUrls: ['https://cdn.example.com/photo.jpg'],
      fetchImpl,
      sleep: async () => undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe('AMBIGUOUS_PUBLISH_OUTCOME');
      expect(result.ambiguous).toBe(true);
      expect(result.isTransient).toBe(false);
    }
  });
});
