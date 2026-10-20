import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

function getEncryptionKey(): Buffer {
  const envKey = process.env['TOKEN_ENCRYPTION_KEY'];
  if (envKey) {
    if (envKey.length === 64) {
      return Buffer.from(envKey, 'hex');
    }
    return crypto.createHash('sha256').update(envKey).digest();
  }
  if (process.env['NODE_ENV'] === 'production' || process.env['NODE_ENV'] === 'staging') {
    throw new Error('TOKEN_ENCRYPTION_KEY must be configured in production/staging environments.');
  }
  // Deterministic local development fallback key (never used in production)
  return crypto.createHash('sha256').update('commercepilot-dev-token-encryption-key-2026').digest();
}

/**
 * Encrypt a plaintext token using AES-256-GCM with authentication tag.
 * Returns format: iv:tag:ciphertext (base64 encoded parts)
 */
export function encryptToken(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  return `${iv.toString('base64')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM token with authentication tag verification.
 */
export function decryptToken(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  if (!ivBase64 || !authTagBase64 || !ciphertextBase64) {
    throw new Error('Malformed encrypted token components');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextBase64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Create a cryptographically signed, expiring OAuth state parameter bound to workspace and user.
 * Format: payloadBase64.hmacSignatureBase64
 */
export function createOAuthState(workspaceId: string, userId: string): string {
  const payload = {
    workspaceId,
    userId,
    nonce: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const key = getEncryptionKey();
  const hmac = crypto.createHmac('sha256', key).update(payloadStr).digest('base64url');

  return `${payloadStr}.${hmac}`;
}

/**
 * Decode and cryptographically verify signed OAuth state parameter.
 * Returns valid status, along with securely unpacked workspaceId and userId.
 */
export function decodeAndVerifyOAuthState(
  stateStr: string,
  maxAgeMs = 600_000, // 10 minutes
): { valid: boolean; workspaceId?: string; userId?: string; reason?: string } {
  if (!stateStr || !stateStr.includes('.')) {
    return { valid: false, reason: 'Malformed state token format' };
  }

  const [payloadStr, signature] = stateStr.split('.');
  if (!payloadStr || !signature) {
    return { valid: false, reason: 'Missing state payload or signature' };
  }

  const key = getEncryptionKey();
  const expectedSig = crypto.createHmac('sha256', key).update(payloadStr).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSig);
  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    return { valid: false, reason: 'Invalid state signature or tampering detected' };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (!payload.workspaceId || !payload.userId) {
      return { valid: false, reason: 'State payload missing workspace or user identifiers' };
    }
    if (Date.now() - payload.timestamp > maxAgeMs) {
      return { valid: false, reason: 'OAuth state has expired' };
    }
    return { valid: true, workspaceId: payload.workspaceId, userId: payload.userId };
  } catch {
    return { valid: false, reason: 'Failed to parse OAuth state payload' };
  }
}

/**
 * Verify signed OAuth state parameter: checks HMAC signature, workspaceId, userId, and 10-minute expiry.
 */
export function verifyOAuthState(
  stateStr: string,
  expectedWorkspaceId: string,
  expectedUserId: string,
  maxAgeMs = 600_000, // 10 minutes
): { valid: boolean; reason?: string } {
  const result = decodeAndVerifyOAuthState(stateStr, maxAgeMs);
  if (!result.valid) {
    return { valid: false, ...(result.reason ? { reason: result.reason } : {}) };
  }
  if (result.workspaceId !== expectedWorkspaceId) {
    return { valid: false, reason: 'OAuth state does not match current workspace' };
  }
  if (result.userId !== expectedUserId) {
    return { valid: false, reason: 'OAuth state does not match requesting user' };
  }
  return { valid: true };
}
