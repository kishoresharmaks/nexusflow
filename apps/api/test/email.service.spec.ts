import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../src/email/email.service';
import type { ConfigService } from '@nestjs/config';

describe('EmailService', () => {
  let emailService: EmailService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'EMAIL_PROVIDER') return 'local';
        if (key === 'WEB_URL') return 'http://localhost:3000';
        if (key === 'EMAIL_FROM') return 'CommercePilot <noreply@commercepilot.test>';
        return null;
      }),
    };

    emailService = new EmailService(mockConfig as ConfigService);
  });

  it('dispatches verification email with valid URL and token to outbox', async () => {
    const result = await emailService.sendVerificationEmail(
      'seller@example.com',
      'Jane',
      'test-token-123',
    );

    expect(result.id).toBeDefined();
    const outbox = emailService.getOutbox();
    expect(outbox.length).toBe(1);
    expect(outbox[0]?.to).toBe('seller@example.com');
    expect(outbox[0]?.subject).toContain('Verify your email');
    expect(outbox[0]?.text).toContain('token=test-token-123');
  });

  it('dispatches password reset email with 1-hour expiration notice', async () => {
    const result = await emailService.sendPasswordResetEmail(
      'seller@example.com',
      'Jane',
      'reset-token-456',
    );

    expect(result.id).toBeDefined();
    const outbox = emailService.getOutbox();
    expect(outbox.length).toBe(1);
    expect(outbox[0]?.to).toBe('seller@example.com');
    expect(outbox[0]?.subject).toContain('Reset your password');
    expect(outbox[0]?.text).toContain('reset-token-456');
    expect(outbox[0]?.text).toContain('1 hour');
  });

  it('dispatches security alert notice for password modifications', async () => {
    const result = await emailService.sendSecurityAlertEmail(
      'seller@example.com',
      'Password Changed',
      'All active sessions have been revoked.',
    );

    expect(result.id).toBeDefined();
    const outbox = emailService.getOutbox();
    expect(outbox.length).toBe(1);
    expect(outbox[0]?.subject).toContain('Security Notice');
    expect(outbox[0]?.text).toContain('All active sessions have been revoked');
  });

  it('clears outbox when clearOutbox is called', () => {
    emailService.clearOutbox();
    expect(emailService.getOutbox().length).toBe(0);
  });
});
