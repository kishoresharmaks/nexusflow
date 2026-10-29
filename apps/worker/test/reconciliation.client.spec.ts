import { describe, it, expect, vi } from 'vitest';
import { SocialProvider } from '@commercepilot/database';
import {
  reconcileProviderPost,
  CONFIRM_ABSENT_MIN_AGE_MS,
} from '../src/providers/reconciliation.client';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    headers: new Headers(),
  } as unknown as Response;
}

const baseParams = {
  providerAccountId: '12345',
  accessToken: 'token',
  content: 'Launch sale now!',
  mediaUrls: ['https://example.com/banner.png'],
};

describe('reconcileProviderPost — Meta Facebook', () => {
  it('returns FOUND when a feed post matches the message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          { id: 'fb_post_1', message: '  Launch   sale now!  ' },
          { id: 'fb_post_2', message: 'unrelated' },
        ],
      }),
    );

    const result = await reconcileProviderPost({
      ...baseParams,
      provider: SocialProvider.META_FACEBOOK,
      mediaUrls: [],
      scheduledAt: new Date(Date.now() - 20 * 60 * 1000),
      fetchImpl: fetchImpl as any,
    });

    expect(result).toEqual({ status: 'FOUND', providerPostId: 'fb_post_1' });
  });

  it('returns NOT_FOUND after the confirmation window with a clean empty result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));

    const result = await reconcileProviderPost({
      ...baseParams,
      provider: SocialProvider.META_FACEBOOK,
      scheduledAt: new Date(Date.now() - CONFIRM_ABSENT_MIN_AGE_MS - 60_000),
      fetchImpl: fetchImpl as any,
    });

    expect(result).toEqual({ status: 'NOT_FOUND' });
  });

  it('returns INCONCLUSIVE when too early to trust an empty result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));

    const result = await reconcileProviderPost({
      ...baseParams,
      provider: SocialProvider.META_FACEBOOK,
      scheduledAt: new Date(Date.now() - 1000),
      fetchImpl: fetchImpl as any,
    });

    expect(result).toEqual({
      status: 'INCONCLUSIVE',
      errorCode: 'RECONCILIATION_TOO_EARLY',
      errorMessage: expect.any(String),
    });
  });
});

describe('reconcileProviderPost — Instagram', () => {
  it('matches captions case-insensitively within the window', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ id: 'ig_media_1', caption: 'Launch sale now!' }],
      }),
    );

    const result = await reconcileProviderPost({
      ...baseParams,
      provider: SocialProvider.META_INSTAGRAM,
      scheduledAt: new Date(Date.now() - 20 * 60 * 1000),
      fetchImpl: fetchImpl as any,
    });

    expect(result).toEqual({ status: 'FOUND', providerPostId: 'ig_media_1' });
  });

  it('returns INCONCLUSIVE on provider error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ error: { message: 'rate limited' } }, false, 429),
    );

    const result = await reconcileProviderPost({
      ...baseParams,
      provider: SocialProvider.META_INSTAGRAM,
      scheduledAt: new Date(Date.now() - 20 * 60 * 1000),
      fetchImpl: fetchImpl as any,
    });

    expect(result.status).toBe('INCONCLUSIVE');
  });
});

describe('reconcileProviderPost — LinkedIn', () => {
  it('matches commentary within the time window', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        elements: [
          {
            id: 'urn:li:share:111',
            commentary: 'Launch sale now!',
            created: { time: Date.now() - 10 * 60 * 1000 },
          },
        ],
      }),
    );

    const result = await reconcileProviderPost({
      ...baseParams,
      provider: SocialProvider.LINKEDIN,
      providerAccountId: 'urn:li:person:999',
      scheduledAt: new Date(Date.now() - 5 * 60 * 1000),
      fetchImpl: fetchImpl as any,
    });

    expect(result).toEqual({ status: 'FOUND', providerPostId: 'urn:li:share:111' });
  });
});

describe('reconcileProviderPost — unsupported provider', () => {
  it('never declares NOT_FOUND for providers without a reconciliation flow', async () => {
    const result = await reconcileProviderPost({
      ...baseParams,
      provider: SocialProvider.TIKTOK,
      scheduledAt: new Date(Date.now() - 20 * 60 * 1000),
      fetchImpl: vi.fn() as any,
    });

    expect(result).toEqual({
      status: 'INCONCLUSIVE',
      errorCode: 'RECONCILIATION_UNSUPPORTED_PROVIDER',
      errorMessage: expect.any(String),
    });
  });
});
