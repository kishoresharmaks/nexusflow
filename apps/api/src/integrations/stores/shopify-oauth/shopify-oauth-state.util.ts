import crypto from 'crypto';

interface ShopifyOAuthStatePayload {
  workspaceId: string;
  userId: string;
  shop: string;
  nonce: string;
  timestamp: number;
}

// In-memory single-use nonce tracking with TTL expiry to prevent replay attacks
const consumedNonces = new Map<string, number>();

function getSigningKey(): Buffer {
  const envKey = process.env['TOKEN_ENCRYPTION_KEY'] || process.env['SESSION_SECRET'];
  if (envKey) {
    if (envKey.length === 64) {
      return Buffer.from(envKey, 'hex');
    }
    return crypto.createHash('sha256').update(envKey).digest();
  }
  // Deterministic local development key
  return crypto.createHash('sha256').update('commercepilot-dev-shopify-oauth-signing-key').digest();
}

/**
 * Periodically purge consumed nonces older than the max age window.
 */
function cleanupConsumedNonces(): void {
  const now = Date.now();
  for (const [nonce, expiresAt] of consumedNonces.entries()) {
    if (now > expiresAt) {
      consumedNonces.delete(nonce);
    }
  }
}

/**
 * Creates a cryptographically signed OAuth state token bound to workspace, user, and shop domain.
 * Format: payloadBase64Url.hmacSignatureBase64Url
 */
export function createShopifyOAuthState(
  workspaceId: string,
  userId: string,
  shop: string,
): string {
  return createShopifyOAuthStateWithTimestamp(workspaceId, userId, shop, Date.now());
}

/**
 * Creates a signed OAuth state with a custom timestamp (useful for testing expiration & skew).
 */
export function createShopifyOAuthStateWithTimestamp(
  workspaceId: string,
  userId: string,
  shop: string,
  timestamp: number,
): string {
  cleanupConsumedNonces();

  const payload: ShopifyOAuthStatePayload = {
    workspaceId,
    userId,
    shop: shop.toLowerCase(),
    nonce: crypto.randomBytes(16).toString('hex'),
    timestamp,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const key = getSigningKey();
  const signature = crypto.createHmac('sha256', key).update(payloadStr).digest('base64url');

  return `${payloadStr}.${signature}`;
}

/**
 * Verifies the signed OAuth state token, strictly checking:
 * 1. HMAC signature integrity with constant-time comparison
 * 2. Expiration window (maxAgeMs, default 10 minutes)
 * 3. Future-timestamp skew rejection (> 30s in future)
 * 4. Shop domain binding matches callback shop parameter
 * 5. Single-use replay protection (consumed nonce rejection)
 */
export function verifyAndConsumeShopifyOAuthState(
  stateStr: string,
  expectedShop: string,
  maxAgeMs = 600_000, // 10 minutes
): {
  valid: boolean;
  workspaceId?: string;
  userId?: string;
  shop?: string;
  reason?: string;
} {
  cleanupConsumedNonces();

  if (!stateStr || !stateStr.includes('.')) {
    return { valid: false, reason: 'Malformed OAuth state parameter' };
  }

  const [payloadStr, signature] = stateStr.split('.');
  if (!payloadStr || !signature) {
    return { valid: false, reason: 'Missing state payload or signature' };
  }

  const key = getSigningKey();
  const expectedSignature = crypto.createHmac('sha256', key).update(payloadStr).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    return { valid: false, reason: 'Invalid state signature or tampering detected' };
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString('utf8'),
    ) as Partial<ShopifyOAuthStatePayload>;

    if (!payload.workspaceId || !payload.userId || !payload.shop || !payload.nonce || !payload.timestamp) {
      return { valid: false, reason: 'State payload is missing required fields' };
    }

    const now = Date.now();

    // Reject future timestamp skew (> 30 seconds into future)
    if (payload.timestamp > now + 30_000) {
      return { valid: false, reason: 'OAuth state timestamp is in the future' };
    }

    // Reject expired state
    if (now - payload.timestamp > maxAgeMs) {
      return { valid: false, reason: 'OAuth state has expired' };
    }

    // Verify shop domain binding
    const normalizedExpectedShop = expectedShop.toLowerCase();
    if (payload.shop !== normalizedExpectedShop) {
      return { valid: false, reason: `State shop (${payload.shop}) does not match expected shop (${normalizedExpectedShop})` };
    }

    // Replay attack protection: check if nonce was already consumed
    if (consumedNonces.has(payload.nonce)) {
      return { valid: false, reason: 'OAuth state nonce has already been consumed (replay attack detected)' };
    }

    // Mark nonce as consumed until state expiration
    consumedNonces.set(payload.nonce, payload.timestamp + maxAgeMs);

    return {
      valid: true,
      workspaceId: payload.workspaceId,
      userId: payload.userId,
      shop: payload.shop,
    };
  } catch {
    return { valid: false, reason: 'Failed to parse OAuth state payload' };
  }
}

/**
 * Test helper to reset consumed nonces state.
 */
export function resetConsumedNoncesForTesting(): void {
  consumedNonces.clear();
}
