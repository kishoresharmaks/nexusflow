import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService, escapeHtml } from '../src/email/email.service';
import { SmtpEmailAdapter } from '../src/email/adapters/smtp.adapter';
import { Msg91EmailAdapter } from '../src/email/adapters/msg91.adapter';
import { BrevoEmailAdapter } from '../src/email/adapters/brevo.adapter';
import { ResendEmailAdapter } from '../src/email/adapters/resend.adapter';
import { sanitizeEmail, sanitizeErrorMessage } from '../src/email/adapters/email-provider.interface';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../src/prisma/prisma.service';

describe('EmailService and Multi-Provider Adapters', () => {
  let emailService: EmailService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockConfig: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'EMAIL_PROVIDER') return 'local';
        if (key === 'WEB_URL') return 'http://localhost:3000';
        if (key === 'EMAIL_FROM') return 'NexusFlow <noreply@nexusflow.test>';
        if (key === 'SMTP_HOST') return 'smtp.example.com';
        if (key === 'SMTP_PORT') return '587';
        if (key === 'SMTP_USER') return 'user@example.com';
        if (key === 'SMTP_PASS') return 'secret-pass';
        if (key === 'BREVO_API_KEY') return 'xkeysib-test-key-123';
        if (key === 'MSG91_AUTH_KEY') return 'msg91-auth-test-key';
        if (key === 'MSG91_DOMAIN') return 'mail.mybrand.com';
        if (key === 'EMAIL_API_KEY') return 're_test_resend_key';
        return null;
      }),
    };

    emailService = new EmailService(mockConfig as ConfigService);
  });

  describe('Local Email Adapter', () => {
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

    it('dispatches post approval requested notification', async () => {
      const result = await emailService.sendPostApprovalRequestedEmail(
        'approver@example.com',
        'Summer Promo Campaign 2026',
        'Alex Creator',
        'Acme Brand',
        'post_123',
      );

      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox.length).toBe(1);
      expect(outbox[0]?.subject).toContain('Content Approval Requested');
      expect(outbox[0]?.text).toContain('Alex Creator');
    });

    it('dispatches post publication status alert', async () => {
      const result = await emailService.sendPostPublishStatusEmail(
        'author@example.com',
        'Summer Promo 2026',
        'Acme Brand',
        'FAILED',
        'Instagram token expired',
      );

      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox.length).toBe(1);
      expect(outbox[0]?.subject).toContain('Publishing Failed');
      expect(outbox[0]?.text).toContain('Instagram token expired');
    });

    it('sends account activated email', async () => {
      const result = await emailService.sendAccountActivatedEmail('alex@example.com', 'Alex Rivera');
      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox[0]?.subject).toContain('Account Activated');
      expect(outbox[0]?.text).toContain('Alex Rivera');
    });

    it('sends member role updated email', async () => {
      const result = await emailService.sendMemberRoleUpdatedEmail(
        'sarah@example.com',
        'Sarah Connor',
        'Tech Corp',
        'MEMBER',
        'ADMIN',
      );
      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox[0]?.subject).toContain('ADMIN');
      expect(outbox[0]?.text).toContain('MEMBER to ADMIN');
    });

    it('sends member removed email', async () => {
      const result = await emailService.sendMemberRemovedEmail(
        'dev@example.com',
        'Dev User',
        'Tech Corp',
      );
      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox[0]?.subject).toContain('Access removed');
      expect(outbox[0]?.text).toContain('Tech Corp');
    });

    it('sends ownership transferred confirmation email', async () => {
      const result = await emailService.sendOwnershipTransferredConfirmationEmail(
        'newowner@example.com',
        'New Owner',
        'Tech Corp',
        true,
      );
      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox[0]?.subject).toContain('Ownership transfer completed');
      expect(outbox[0]?.text).toContain('Tech Corp');
    });

    it('sends post approved email', async () => {
      const result = await emailService.sendPostApprovedEmail(
        'author@example.com',
        'Launch Campaign',
        'Tech Corp',
        'Chief Editor',
        'Looks ready to schedule',
      );
      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox[0]?.subject).toContain('Post Approved');
      expect(outbox[0]?.text).toContain('Chief Editor');
    });

    it('sends post rejected email', async () => {
      const result = await emailService.sendPostRejectedEmail(
        'author@example.com',
        'Launch Campaign',
        'Tech Corp',
        'Chief Editor',
        'Needs higher resolution product image',
      );
      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox[0]?.subject).toContain('Revision Requested');
      expect(outbox[0]?.text).toContain('Needs higher resolution product image');
    });

    it('sends subscription updated email', async () => {
      const result = await emailService.sendSubscriptionUpdatedEmail(
        'owner@example.com',
        'Owner Name',
        'Tech Corp',
        'Growth',
        4900,
        'USD',
      );
      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox[0]?.subject).toContain('Subscription Confirmed');
      expect(outbox[0]?.text).toContain('Growth plan');
    });

    it('sends subscription cancelled email', async () => {
      const result = await emailService.sendSubscriptionCancelledEmail(
        'owner@example.com',
        'Owner Name',
        'Tech Corp',
        'Growth',
        new Date('2026-11-01'),
      );
      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox[0]?.subject).toContain('Subscription Cancellation Scheduled');
      expect(outbox[0]?.text).toContain('Tech Corp');
    });

    it('sends workspace suspended email', async () => {
      const result = await emailService.sendWorkspaceSuspendedEmail(
        'owner@example.com',
        'Owner Name',
        'Suspended Corp',
        'Policy violation investigation',
      );
      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox[0]?.subject).toContain('Workspace "Suspended Corp" Suspended');
      expect(outbox[0]?.text).toContain('Policy violation investigation');
    });

    it('sends workspace reactivated email', async () => {
      const result = await emailService.sendWorkspaceReactivatedEmail(
        'owner@example.com',
        'Owner Name',
        'Restored Corp',
      );
      expect(result.id).toBeDefined();
      const outbox = emailService.getOutbox();
      expect(outbox[0]?.subject).toContain('Restored Corp" Reactivated');
      expect(outbox[0]?.text).toContain('resume normal operations');
    });

    it('clears outbox when clearOutbox is called', () => {
      emailService.clearOutbox();
      expect(emailService.getOutbox().length).toBe(0);
    });

    it('returns status with all available providers', () => {
      const status = emailService.getStatus();
      expect(status.activeProvider).toBe('local');
      expect(status.availableProviders).toContain('smtp');
      expect(status.availableProviders).toContain('brevo');
      expect(status.availableProviders).toContain('msg91');
      expect(status.availableProviders).toContain('resend');
      expect(status.availableProviders).toContain('local');
    });
  });

  describe('SMTP Provider Adapter', () => {
    it('detects configured status when host, user, and password are provided', () => {
      const adapter = new SmtpEmailAdapter({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: 'test@gmail.com',
        pass: 'app-password',
        defaultFrom: 'NexusFlow <noreply@nexusflow.test>',
      });
      expect(adapter.isConfigured()).toBe(true);
    });

    it('detects unconfigured status when credentials are missing', () => {
      const adapter = new SmtpEmailAdapter({
        host: '',
        port: 587,
        secure: false,
        defaultFrom: 'NexusFlow <noreply@nexusflow.test>',
      });
      expect(adapter.isConfigured()).toBe(false);
    });

    it('verifies connection using mock transporter', async () => {
      const adapter = new SmtpEmailAdapter({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: 'test@gmail.com',
        pass: 'app-password',
        defaultFrom: 'NexusFlow <noreply@nexusflow.test>',
      });

      // Mock verify on transporter
      (adapter as any).transporter = {
        verify: vi.fn().mockResolvedValue(true),
        sendMail: vi.fn().mockResolvedValue({ messageId: '<msg_smtp_999@smtp.gmail.com>' }),
      };

      const verification = await adapter.verifyConnection();
      expect(verification.ok).toBe(true);
      expect(verification.message).toContain('SMTP connection established');

      const sendResult = await adapter.send({
        to: 'recipient@example.com',
        subject: 'SMTP Test Subject',
        html: '<p>SMTP Body</p>',
        text: 'SMTP Body',
      });
      expect(sendResult.id).toBe('<msg_smtp_999@smtp.gmail.com>');
      expect(sendResult.provider).toBe('smtp');
    });
  });

  describe('Brevo Provider Adapter', () => {
    it('detects configured status when API key is valid', () => {
      const adapter = new BrevoEmailAdapter({
        apiKey: 'xkeysib-valid-key-99',
        defaultFrom: 'noreply@mybrand.com',
      });
      expect(adapter.isConfigured()).toBe(true);
    });

    it('sends transactional email via Brevo REST API v3', async () => {
      const adapter = new BrevoEmailAdapter({
        apiKey: 'xkeysib-valid-key-99',
        defaultFrom: 'NexusFlow <noreply@mybrand.com>',
      });

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: '<brevo_msg_777@smtp-relay.mailin.fr>' }),
      } as any);

      const res = await adapter.send({
        to: 'customer@example.com',
        toName: 'Customer Name',
        subject: 'Your Brevo Invoice',
        html: '<p>Invoice details</p>',
        text: 'Invoice details',
      });

      expect(res.id).toBe('<brevo_msg_777@smtp-relay.mailin.fr>');
      expect(res.provider).toBe('brevo');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/smtp/email',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'api-key': 'xkeysib-valid-key-99' }),
        }),
      );
    });

    it('verifies Brevo connection by querying Brevo account API', async () => {
      const adapter = new BrevoEmailAdapter({
        apiKey: 'xkeysib-valid-key-99',
        defaultFrom: 'noreply@mybrand.com',
      });

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'owner@mybrand.com', companyName: 'MyBrand Inc.' }),
      } as any);

      const check = await adapter.verifyConnection();
      expect(check.ok).toBe(true);
      expect(check.message).toContain('owner@mybrand.com');
    });
  });

  describe('MSG91 Provider Adapter', () => {
    it('detects configured status when authKey and domain are set', () => {
      const adapter = new Msg91EmailAdapter({
        authKey: 'auth_key_123',
        domain: 'transactional.domain.com',
        defaultFrom: 'noreply@domain.com',
      });
      expect(adapter.isConfigured()).toBe(true);
    });

    it('sends transactional email via MSG91 REST API v5', async () => {
      const adapter = new Msg91EmailAdapter({
        authKey: 'auth_key_123',
        domain: 'transactional.domain.com',
        defaultFrom: 'NexusFlow <noreply@domain.com>',
      });

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          message: 'Mail sent',
          data: { unique_id: 'msg91_req_456' },
        }),
      } as any);

      const res = await adapter.send({
        to: 'customer@domain.com',
        subject: 'Order Confirmation',
        html: '<p>Thank you for your order</p>',
        text: 'Thank you for your order',
      });

      expect(res.id).toBe('msg91_req_456');
      expect(res.provider).toBe('msg91');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://control.msg91.com/api/v5/email/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ authkey: 'auth_key_123' }),
        }),
      );
    });
  });

  describe('Resend Provider Adapter', () => {
    it('sends transactional email via Resend API', async () => {
      const adapter = new ResendEmailAdapter({
        apiKey: 're_123456789',
        defaultFrom: 'NexusFlow <noreply@nexusflow.test>',
      });

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend_email_id_99' }),
      } as any);

      const res = await adapter.send({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Body</p>',
        text: 'Body',
      });

      expect(res.id).toBe('resend_email_id_99');
      expect(res.provider).toBe('resend');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer re_123456789' }),
        }),
      );
    });
  });

  describe('Diagnostic Testing Methods', () => {
    it('dispatches test email via sendTestEmail', async () => {
      const res = await emailService.sendTestEmail('admin@example.com', 'local');
      expect(res.id).toBeDefined();
      expect(res.provider).toBe('local');
      expect(res.latencyMs).toBeGreaterThanOrEqual(0);

      const outbox = emailService.getOutbox();
      expect(outbox.some((m) => m.to === 'admin@example.com')).toBe(true);
    });

    it('verifies provider connection for active provider', async () => {
      const verification = await emailService.verifyProviderConnection('local');
      expect(verification.ok).toBe(true);
      expect(verification.provider).toBe('local');
    });

    it('rejects invalid recipient email format with BadRequestException', async () => {
      await expect(
        emailService.sendTestEmail('not-an-email', 'local'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        emailService.sendTestEmail('<script>alert(1)</script>@test.com', 'local'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Audit Findings Remediation: Configuration & Production Guards', () => {
    it('[CRITICAL] Throws at startup if EMAIL_PROVIDER is placeholder or unsupported', () => {
      const invalidConfig = {
        get: vi.fn((key: string) => {
          if (key === 'EMAIL_PROVIDER') return 'placeholder';
          if (key === 'NODE_ENV') return 'development';
          if (key === 'WEB_URL') return 'http://localhost:3000';
          if (key === 'EMAIL_FROM') return 'NexusFlow <noreply@domain.com>';
          return null;
        }),
      } as unknown as ConfigService;

      expect(() => new EmailService(invalidConfig)).toThrow(
        /Invalid EMAIL_PROVIDER "placeholder"/,
      );
    });

    it('[CRITICAL] Throws BadRequestException when getAdapter requested with unknown provider', () => {
      expect(() => emailService.getAdapter('unsupported_mailer')).toThrow(BadRequestException);
    });

    it('[CRITICAL] Throws in production when EMAIL_PROVIDER=local without ALLOW_LOCAL_EMAIL_OUTBOX=true', () => {
      const prodLocalConfig = {
        get: vi.fn((key: string) => {
          if (key === 'EMAIL_PROVIDER') return 'local';
          if (key === 'NODE_ENV') return 'production';
          if (key === 'WEB_URL') return 'https://nexusflow.io';
          if (key === 'EMAIL_FROM') return 'NexusFlow <noreply@nexusflow.io>';
          if (key === 'ALLOW_LOCAL_EMAIL_OUTBOX') return 'false';
          return null;
        }),
      } as unknown as ConfigService;

      expect(() => new EmailService(prodLocalConfig)).toThrow(
        /EMAIL_PROVIDER="local" is prohibited in production/,
      );
    });

    it('Allows local provider in production if ALLOW_LOCAL_EMAIL_OUTBOX=true explicitly set', () => {
      const prodOverrideConfig = {
        get: vi.fn((key: string) => {
          if (key === 'EMAIL_PROVIDER') return 'local';
          if (key === 'NODE_ENV') return 'production';
          if (key === 'WEB_URL') return 'https://nexusflow.io';
          if (key === 'EMAIL_FROM') return 'NexusFlow <noreply@nexusflow.io>';
          if (key === 'ALLOW_LOCAL_EMAIL_OUTBOX') return 'true';
          return null;
        }),
      } as unknown as ConfigService;

      expect(() => new EmailService(prodOverrideConfig)).not.toThrow();
    });

    it('[HIGH] Throws in production when WEB_URL is localhost or not HTTPS', () => {
      const prodHttpConfig = {
        get: vi.fn((key: string) => {
          if (key === 'EMAIL_PROVIDER') return 'resend';
          if (key === 'EMAIL_API_KEY') return 're_test_key';
          if (key === 'NODE_ENV') return 'production';
          if (key === 'WEB_URL') return 'http://localhost:3000';
          if (key === 'EMAIL_FROM') return 'NexusFlow <noreply@nexusflow.io>';
          return null;
        }),
      } as unknown as ConfigService;

      expect(() => new EmailService(prodHttpConfig)).toThrow(
        /Production WEB_URL must use https:\/\/ protocol/,
      );
    });

    it('[HIGH] Throws in production when EMAIL_FROM uses test/example domain', () => {
      const prodExampleDomainConfig = {
        get: vi.fn((key: string) => {
          if (key === 'EMAIL_PROVIDER') return 'resend';
          if (key === 'EMAIL_API_KEY') return 're_test_key';
          if (key === 'NODE_ENV') return 'production';
          if (key === 'WEB_URL') return 'https://nexusflow.io';
          if (key === 'EMAIL_FROM') return 'NexusFlow <noreply@example.test>';
          return null;
        }),
      } as unknown as ConfigService;

      expect(() => new EmailService(prodExampleDomainConfig)).toThrow(
        /Test or example sender domains are prohibited in production/,
      );
    });
  });

  describe('Audit Findings Remediation: Template Escaping & PII Protection', () => {
    it('[MEDIUM] Properly sanitizes email addresses in logs to protect PII', () => {
      expect(sanitizeEmail('john.doe@company.org')).toBe('j***e@company.org');
      expect(sanitizeEmail('ab@domain.com')).toBe('***@domain.com');
      expect(sanitizeEmail('invalid')).toBe('***@***');
    });

    it('[MEDIUM] Sanitizes error messages containing Bearer tokens, API keys, passwords, and emails', () => {
      const sensitiveErr = new Error(
        'Request failed with Bearer secret_jwt_token_123456 and api-key: xkeysib-999-secret for seller@example.com with password: mySecretPassword123',
      );
      const sanitized = sanitizeErrorMessage(sensitiveErr);
      expect(sanitized).not.toContain('secret_jwt_token_123456');
      expect(sanitized).not.toContain('xkeysib-999-secret');
      expect(sanitized).not.toContain('mySecretPassword123');
      expect(sanitized).not.toContain('seller@example.com');
      expect(sanitized).toContain('Bearer [REDACTED]');
      expect(sanitized).toContain('api-key: [REDACTED]');
      expect(sanitized).toContain('s***r@example.com');
    });

    it('[MEDIUM] HTML escapes malicious user input in email templates', async () => {
      const maliciousPayload = '<script>alert("XSS")</script>';
      await emailService.sendWorkspaceInvitationEmail(
        'invitee@example.com',
        `Acme Corp ${maliciousPayload}`,
        'ADMIN',
        'raw-token-xyz',
        `Attacker ${maliciousPayload}`,
      );

      const outbox = emailService.getOutbox();
      const lastEmail = outbox[outbox.length - 1];
      expect(lastEmail?.html).not.toContain('<script>');
      expect(lastEmail?.html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('HTML escapes user credentials and organization name in account activation template', async () => {
      const xssOrg = '<h1>Corp</h1>';
      await emailService.sendAccountActivationEmail(
        'direct@example.com',
        '<b>User</b>',
        xssOrg,
        'MEMBER',
        'activation-token-123',
      );

      const outbox = emailService.getOutbox();
      const lastEmail = outbox[outbox.length - 1];
      expect(lastEmail?.html).not.toContain('<h1>Corp</h1>');
      expect(lastEmail?.html).toContain('&lt;h1&gt;Corp&lt;/h1&gt;');
      expect(lastEmail?.html).toContain('&lt;b&gt;User&lt;/b&gt;');
    });
  });

  describe('Audit Findings Remediation: Transactional Outbox Persistence', () => {
    it('[LOW/MEDIUM] Persists email to Prisma EmailOutbox database model when Prisma is available', async () => {
      const mockPrisma = {
        emailOutbox: {
          create: vi.fn().mockResolvedValue({ id: 'outbox_row_123' }),
        },
      } as unknown as PrismaService;

      const durableService = new EmailService(mockConfig as ConfigService, mockPrisma);
      const res = await durableService.sendVerificationEmail(
        'persisted@example.com',
        'Persisted User',
        'verify-123',
      );

      expect(res.id).toBeDefined();
      expect(mockPrisma.emailOutbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            to: 'persisted@example.com',
            status: 'SENT',
            provider: 'local',
          }),
        }),
      );
    });

    it('Persists FAILED status and sanitized error in EmailOutbox when provider throws', async () => {
      const mockPrisma = {
        emailOutbox: {
          create: vi.fn().mockResolvedValue({ id: 'outbox_row_failed' }),
        },
      } as unknown as PrismaService;

      const durableService = new EmailService(mockConfig as ConfigService, mockPrisma);
      // Spy on local adapter send to simulate failure with sensitive error message
      const localAdapter = (durableService as any).localAdapter;
      vi.spyOn(localAdapter, 'send').mockRejectedValueOnce(
        new Error('SMTP auth failed with password: super_secret_pass for user@domain.com'),
      );

      await expect(
        durableService.sendSecurityAlertEmail(
          'user@domain.com',
          'Breach Alert',
          'Suspicious login detected',
        ),
      ).rejects.toThrow();

      expect(mockPrisma.emailOutbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            to: 'user@domain.com',
            status: 'FAILED',
            errorMessage: expect.stringContaining('password: [REDACTED]'),
          }),
        }),
      );
      // Assert sensitive password is redacted in persisted outbox error message
      const callArgs = (mockPrisma.emailOutbox.create as any).mock.calls[0][0];
      expect(callArgs.data.errorMessage).not.toContain('super_secret_pass');
    });
  });
});
