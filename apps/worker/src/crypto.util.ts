import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

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
