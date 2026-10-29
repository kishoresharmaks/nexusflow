export interface EmailSendOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
}

export interface EmailSendResult {
  id: string;
  provider: string;
  timestamp: Date;
}

export interface EmailConnectionTestResult {
  ok: boolean;
  provider: string;
  message: string;
  latencyMs: number;
}

export interface EmailProviderAdapter {
  readonly name: string;
  send(options: EmailSendOptions): Promise<EmailSendResult>;
  verifyConnection?(): Promise<EmailConnectionTestResult>;
}

export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '***@***';
  const parts = email.split('@');
  const local = parts[0] || '';
  const domain = parts[1] || '';
  const maskedLocal = local.length <= 2 ? '***' : `${local[0]}***${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}

export function sanitizeErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/(bearer\s+)[a-zA-Z0-9._-]+/gi, '$1[REDACTED]')
    .replace(/(api[-_]?key\s*[:=]\s*)[a-zA-Z0-9._-]+/gi, '$1[REDACTED]')
    .replace(/(authkey\s*[:=]\s*)[a-zA-Z0-9._-]+/gi, '$1[REDACTED]')
    .replace(/(pass(?:word)?\s*[:=]\s*)[^\s,]+/gi, '$1[REDACTED]')
    .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (m) => sanitizeEmail(m));
}
