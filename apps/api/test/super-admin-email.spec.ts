import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuperAdminService } from '../src/super-admin/super-admin.service';
import type { PrismaService } from '../src/database/prisma.service';
import type { AdminAuditService } from '../src/super-admin/audit/admin-audit.service';
import type { EmailService } from '../src/email/email.service';

describe('SuperAdmin Email Diagnostics & Controls', () => {
  let superAdminService: SuperAdminService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAudit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockEmailService: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockPrisma = {};

    mockAudit = {
      logAction: vi.fn().mockResolvedValue({ id: 'audit_log_1' }),
    };

    mockEmailService = {
      getStatus: vi.fn().mockReturnValue({
        activeProvider: 'smtp',
        isConfigured: true,
        fromAddress: 'NexusFlow <noreply@nexusflow.test>',
        availableProviders: ['local', 'smtp', 'brevo', 'msg91', 'resend'],
        outboxCount: 5,
      }),
      verifyProviderConnection: vi.fn().mockResolvedValue({
        ok: true,
        provider: 'smtp',
        message: 'SMTP connection established to smtp.example.com:587',
        latencyMs: 45,
      }),
      sendTestEmail: vi.fn().mockResolvedValue({
        id: 'msg_smtp_test_123',
        provider: 'smtp',
        timestamp: new Date(),
        latencyMs: 78,
      }),
    };

    superAdminService = new SuperAdminService(
      mockPrisma as PrismaService,
      mockAudit as AdminAuditService,
      mockEmailService as EmailService,
    );
  });

  it('returns current email service status with active provider telemetry', async () => {
    const status = await superAdminService.getEmailStatus();

    expect(status.activeProvider).toBe('smtp');
    expect(status.isConfigured).toBe(true);
    expect(status.availableProviders).toContain('smtp');
    expect(status.availableProviders).toContain('brevo');
    expect(status.availableProviders).toContain('msg91');
    expect(status.outboxCount).toBe(5);
  });

  it('verifies provider connectivity and measures ping latency', async () => {
    const res = await superAdminService.verifyEmailConnection('smtp');

    expect(res.ok).toBe(true);
    expect(res.provider).toBe('smtp');
    expect(res.message).toContain('SMTP connection established');
    expect(res.latencyMs).toBe(45);
    expect(mockEmailService.verifyProviderConnection).toHaveBeenCalledWith('smtp');
  });

  it('dispatches test email and records administrative audit log', async () => {
    const actor = { id: 'admin_user_99', email: 'superadmin@nexusflow.test' };
    const res = await superAdminService.sendTestEmail('client@target.com', 'brevo', actor);

    expect(res.id).toBe('msg_smtp_test_123');
    expect(res.latencyMs).toBe(78);
    expect(mockEmailService.sendTestEmail).toHaveBeenCalledWith('client@target.com', 'brevo');

    expect(mockAudit.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin_user_99',
        actorEmail: 'superadmin@nexusflow.test',
        action: 'email.test_dispatched',
        targetType: 'EMAIL_PROVIDER',
      }),
    );
  });
});
