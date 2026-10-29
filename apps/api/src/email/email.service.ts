import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { EmailDeliveryStatus } from '@commercepilot/database';
import {
  EmailProviderAdapter,
  EmailSendOptions,
  EmailSendResult,
  EmailConnectionTestResult,
  LocalEmailAdapter,
  OutboxEmail,
  SmtpEmailAdapter,
  BrevoEmailAdapter,
  Msg91EmailAdapter,
  ResendEmailAdapter,
  sanitizeEmail,
  sanitizeErrorMessage,
} from './adapters';

export type { EmailSendOptions, EmailSendResult, EmailConnectionTestResult, OutboxEmail };
export type EmailDispatchOptions = EmailSendOptions;
export { sanitizeEmail, sanitizeErrorMessage };

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailProviderStatus {
  activeProvider: string;
  isConfigured: boolean;
  fromAddress: string;
  availableProviders: string[];
  outboxCount: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly webUrl: string;
  private readonly fromAddress: string;
  private readonly activeProviderName: string;

  private readonly localAdapter: LocalEmailAdapter;
  private readonly smtpAdapter: SmtpEmailAdapter;
  private readonly brevoAdapter: BrevoEmailAdapter;
  private readonly msg91Adapter: Msg91EmailAdapter;
  private readonly resendAdapter: ResendEmailAdapter;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma?: PrismaService,
  ) {
    this.activeProviderName = (
      this.configService.get<string>('EMAIL_PROVIDER') ||
      process.env['EMAIL_PROVIDER'] ||
      'local'
    ).toLowerCase();

    const supportedProviders = ['smtp', 'brevo', 'msg91', 'resend', 'local'];
    if (!supportedProviders.includes(this.activeProviderName)) {
      throw new Error(
        `Invalid EMAIL_PROVIDER "${this.activeProviderName}". Supported providers are: ${supportedProviders.join(', ')}`,
      );
    }

    const nodeEnv = (
      this.configService.get<string>('NODE_ENV') ||
      process.env['NODE_ENV'] ||
      'development'
    ).toLowerCase();
    const isProdOrStaging = nodeEnv === 'production' || nodeEnv === 'staging';

    if (isProdOrStaging && this.activeProviderName === 'local') {
      const allowLocal =
        this.configService.get<string>('ALLOW_LOCAL_EMAIL_OUTBOX') === 'true' ||
        process.env['ALLOW_LOCAL_EMAIL_OUTBOX'] === 'true';
      if (!allowLocal) {
        throw new Error(
          `EMAIL_PROVIDER="local" is prohibited in ${nodeEnv}. Please configure a production transactional provider (smtp, brevo, msg91, resend) or explicitly set ALLOW_LOCAL_EMAIL_OUTBOX=true.`,
        );
      }
    }

    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM') ||
      process.env['EMAIL_FROM'] ||
      'NexusFlow <noreply@nexusflow.dev>';

    if (isProdOrStaging) {
      const domainMatch = this.fromAddress.match(/@([a-zA-Z0-9.-]+)>?$/);
      const domain = domainMatch ? domainMatch[1]?.toLowerCase() : '';
      if (!domain || domain === 'example.com' || domain.endsWith('.test') || domain.endsWith('.example') || domain === 'localhost') {
        throw new Error(
          `Invalid production EMAIL_FROM "${this.fromAddress}". Test or example sender domains are prohibited in ${nodeEnv}. Please configure a verified domain with SPF/DKIM/DMARC.`,
        );
      }
    }

    this.webUrl =
      this.configService.get<string>('WEB_URL') ||
      process.env['WEB_URL'] ||
      'http://localhost:3000';

    if (isProdOrStaging) {
      try {
        const parsed = new URL(this.webUrl);
        if (parsed.protocol !== 'https:') {
          throw new Error(`Production WEB_URL must use https:// protocol, received: "${this.webUrl}"`);
        }
        const host = parsed.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.test') || host.endsWith('.example')) {
          throw new Error(`Production WEB_URL cannot point to localhost or test domain, received: "${this.webUrl}"`);
        }
      } catch (err: unknown) {
        throw new Error(`Invalid production WEB_URL "${this.webUrl}": ${err instanceof Error ? err.message : 'Invalid URL'}`);
      }
    }

    // 1. Local Adapter
    this.localAdapter = new LocalEmailAdapter();

    // 2. SMTP Adapter
    const smtpHost = this.configService.get<string>('SMTP_HOST') || process.env['SMTP_HOST'] || '';
    const smtpPort = parseInt(
      String(this.configService.get<string>('SMTP_PORT') || process.env['SMTP_PORT'] || '587'),
      10,
    );
    const smtpSecure =
      this.configService.get<string>('SMTP_SECURE') === 'true' ||
      process.env['SMTP_SECURE'] === 'true' ||
      smtpPort === 465;
    const smtpUser = this.configService.get<string>('SMTP_USER') || process.env['SMTP_USER'] || '';
    const smtpPass = this.configService.get<string>('SMTP_PASS') || process.env['SMTP_PASS'] || '';

    this.smtpAdapter = new SmtpEmailAdapter({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: smtpUser,
      pass: smtpPass,
      defaultFrom: this.fromAddress,
    });

    // 3. Brevo Adapter
    const brevoApiKey =
      this.configService.get<string>('BREVO_API_KEY') || process.env['BREVO_API_KEY'] || '';
    this.brevoAdapter = new BrevoEmailAdapter({
      apiKey: brevoApiKey,
      defaultFrom: this.fromAddress,
    });

    // 4. MSG91 Adapter
    const msg91AuthKey =
      this.configService.get<string>('MSG91_AUTH_KEY') || process.env['MSG91_AUTH_KEY'] || '';
    const msg91Domain =
      this.configService.get<string>('MSG91_DOMAIN') || process.env['MSG91_DOMAIN'] || '';
    this.msg91Adapter = new Msg91EmailAdapter({
      authKey: msg91AuthKey,
      domain: msg91Domain,
      defaultFrom: this.fromAddress,
    });

    // 5. Resend Adapter
    const emailApiKey =
      this.configService.get<string>('EMAIL_API_KEY') || process.env['EMAIL_API_KEY'] || '';
    this.resendAdapter = new ResendEmailAdapter({
      apiKey: emailApiKey,
      defaultFrom: this.fromAddress,
    });
  }

  getAdapter(providerName?: string): EmailProviderAdapter {
    const target = (providerName || this.activeProviderName).toLowerCase();
    switch (target) {
      case 'smtp':
        return this.smtpAdapter;
      case 'brevo':
        return this.brevoAdapter;
      case 'msg91':
        return this.msg91Adapter;
      case 'resend':
        return this.resendAdapter;
      case 'local':
        return this.localAdapter;
      default:
        throw new BadRequestException(
          `Unsupported email provider: "${target}". Supported providers are: smtp, brevo, msg91, resend, local.`,
        );
    }
  }

  getActiveProviderName(): string {
    return this.activeProviderName;
  }

  getOutbox(): OutboxEmail[] {
    return this.localAdapter.getOutbox();
  }

  clearOutbox(): void {
    this.localAdapter.clearOutbox();
  }

  getStatus(): EmailProviderStatus {
    const adapter = this.getAdapter();
    let isConfigured = false;
    if (adapter.name === 'local') {
      isConfigured = true;
    } else if (adapter.name === 'smtp') {
      isConfigured = this.smtpAdapter.isConfigured();
    } else if (adapter.name === 'brevo') {
      isConfigured = this.brevoAdapter.isConfigured();
    } else if (adapter.name === 'msg91') {
      isConfigured = this.msg91Adapter.isConfigured();
    } else if (adapter.name === 'resend') {
      isConfigured = this.resendAdapter.isConfigured();
    }

    return {
      activeProvider: this.activeProviderName,
      isConfigured,
      fromAddress: this.fromAddress,
      availableProviders: ['local', 'smtp', 'brevo', 'msg91', 'resend'],
      outboxCount: this.localAdapter.getOutbox().length,
    };
  }

  async verifyProviderConnection(providerOverride?: string): Promise<EmailConnectionTestResult> {
    const adapter = this.getAdapter(providerOverride);
    if (adapter.verifyConnection) {
      return adapter.verifyConnection();
    }
    return {
      ok: true,
      provider: adapter.name,
      message: `Provider "${adapter.name}" does not require explicit connection verification.`,
      latencyMs: 1,
    };
  }

  async sendEmail(
    options: EmailDispatchOptions,
    providerOverride?: string,
  ): Promise<{ id: string; provider: string }> {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const isStaging = process.env['NODE_ENV'] === 'staging';

    const targetProvider = (providerOverride || this.activeProviderName).toLowerCase();
    const adapter = this.getAdapter(targetProvider);

    // If in production/staging and configured adapter is unconfigured, throw ServiceUnavailableException
    if (isProduction || isStaging) {
      if (adapter.name === 'local') {
        const allowLocal =
          this.configService.get<string>('ALLOW_LOCAL_EMAIL_OUTBOX') === 'true' ||
          process.env['ALLOW_LOCAL_EMAIL_OUTBOX'] === 'true';
        if (!allowLocal) {
          throw new ServiceUnavailableException(
            `EMAIL_PROVIDER="local" is prohibited in ${process.env['NODE_ENV']}. Configure a production transactional email provider.`,
          );
        }
      } else {
        let isConfigured = false;
        if (adapter.name === 'smtp') isConfigured = this.smtpAdapter.isConfigured();
        else if (adapter.name === 'brevo') isConfigured = this.brevoAdapter.isConfigured();
        else if (adapter.name === 'msg91') isConfigured = this.msg91Adapter.isConfigured();
        else if (adapter.name === 'resend') isConfigured = this.resendAdapter.isConfigured();

        if (!isConfigured) {
          this.logger.error(
            `Transactional email cannot be sent in ${process.env['NODE_ENV']}: ${adapter.name.toUpperCase()} provider credentials missing.`,
          );
          throw new ServiceUnavailableException(
            `Transactional email provider "${adapter.name}" is unconfigured or unavailable in production.`,
          );
        }
      }
    }

    try {
      const res = await adapter.send(options);

      if (this.prisma) {
        try {
          await this.prisma.emailOutbox.create({
            data: {
              to: options.to,
              subject: options.subject,
              provider: res.provider,
              status: EmailDeliveryStatus.SENT,
              sentAt: new Date(),
              attempts: 1,
              lastAttemptAt: new Date(),
            },
          });
        } catch {
          // Non-blocking outbox audit
        }
      }

      return { id: res.id, provider: res.provider };
    } catch (err: unknown) {
      if (this.prisma) {
        try {
          await this.prisma.emailOutbox.create({
            data: {
              to: options.to,
              subject: options.subject,
              provider: adapter.name,
              status: EmailDeliveryStatus.FAILED,
              errorMessage: sanitizeErrorMessage(err),
              attempts: 1,
              lastAttemptAt: new Date(),
            },
          });
        } catch {
          // Non-blocking outbox audit
        }
      }

      // In development or test, fall back to local outbox so tests and flows don't crash
      if (!isProduction && !isStaging && adapter.name !== 'local') {
        this.logger.warn(
          `Active provider ${adapter.name} failed (${err instanceof Error ? err.message : 'Unknown'}). Falling back to local outbox in development/test.`,
        );
        const fallback = await this.localAdapter.send(options);
        return { id: fallback.id, provider: 'local' };
      }
      throw err;
    }
  }

  async sendTestEmail(
    to: string,
    providerOverride?: string,
  ): Promise<EmailSendResult & { latencyMs: number }> {
    const trimmedTo = to.trim();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (!emailRegex.test(trimmedTo)) {
      throw new BadRequestException(`Invalid recipient email address format: "${trimmedTo}"`);
    }

    const start = Date.now();
    const targetProvider = providerOverride || this.activeProviderName;
    const safeProvider = escapeHtml(targetProvider.toUpperCase());
    const safeTo = escapeHtml(trimmedTo);

    const subject = `[NexusFlow Test] Diagnostic message via ${targetProvider.toUpperCase()}`;
    const text = `This is a verified test email sent from the NexusFlow Email Diagnostics portal via ${targetProvider.toUpperCase()}.\nTimestamp: ${new Date().toISOString()}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">NexusFlow Email Diagnostics</h2>
        <p style="color: #344054;">This is a verified diagnostic email dispatched via provider <strong>${safeProvider}</strong>.</p>
        <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #344054; margin: 16px 0;">
          Status: Operational<br />
          Timestamp: ${new Date().toISOString()}<br />
          Recipient: ${safeTo}
        </div>
        <p style="color: #667085; font-size: 12px;">If you received this email, your provider configuration is functional and authenticated.</p>
      </div>
    `;

    const res = await this.sendEmail({ to, subject, html, text }, targetProvider);
    const latencyMs = Date.now() - start;

    return {
      id: res.id,
      provider: res.provider,
      timestamp: new Date(),
      latencyMs,
    };
  }

  // --- TRANSACTIONAL EMAIL TEMPLATES ACROSS THE SAAS PORTAL ---

  async sendVerificationEmail(to: string, name: string, token: string): Promise<{ id: string }> {
    const verificationUrl = `${this.webUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const subject = 'Verify your email address';
    const text = `Hello ${name},\n\nPlease verify your email address by opening the following link:\n${verificationUrl}\n\nThis verification link will expire in 24 hours. Email verification secures your identity and enables full workspace privileges.\n\nIf you need a new link, you can request one anytime from your account settings: ${this.webUrl}/settings/team\n\nIf you did not request this, you can safely ignore this email.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Verify your email address</h2>
        <p style="color: #344054;">Hello ${escapeHtml(name)},</p>
        <p style="color: #344054;">Please verify your email address to confirm your account and enable full workspace features:</p>
        <div style="margin: 24px 0;">
          <a href="${verificationUrl}" style="background-color: #e85d2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="color: #667085; font-size: 13px;">This link will expire in 24 hours. If it expires, you can request a replacement verification link from your account dashboard.</p>
        <p style="color: #667085; font-size: 12px; margin-top: 24px; border-top: 1px solid #f2f4f7; padding-top: 12px;">If you did not sign up for an account, please disregard this message.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  async sendAccountActivationEmail(
    to: string,
    name: string,
    workspaceName: string,
    role: string,
    token: string,
  ): Promise<{ id: string }> {
    const activationUrl = `${this.webUrl}/activate-account?token=${encodeURIComponent(token)}`;
    const subject = 'Activate your NexusFlow account';
    const text = `Hello ${name},\n\nYou have been added to the workspace "${workspaceName}" as a ${role}.\n\nPlease activate your NexusFlow account and establish your password by opening the link below:\n${activationUrl}\n\nThis activation link will expire in 7 days.\n\nOnce activated, you will be able to sign in directly with your email.\nFor support, contact support@nexusflow.test.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Activate your NexusFlow account</h2>
        <p style="color: #344054;">Hello <strong>${escapeHtml(name)}</strong>,</p>
        <p style="color: #344054;">An administrator has added you to <strong>${escapeHtml(workspaceName)}</strong> with the role of <strong>${escapeHtml(role)}</strong>.</p>
        <p style="color: #344054;">To get started, please activate your account and establish a secure password:</p>
        <div style="margin: 24px 0;">
          <a href="${activationUrl}" style="background-color: #e85d2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Activate Account & Set Password</a>
        </div>
        <p style="color: #667085; font-size: 13px;">This single-use activation link expires in 7 days. Never share this link with anyone.</p>
        <p style="color: #667085; font-size: 12px; margin-top: 24px; border-top: 1px solid #f2f4f7; padding-top: 12px;">Need assistance? Contact our team at <a href="mailto:support@nexusflow.test" style="color: #e85d2a;">support@nexusflow.test</a>.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  async sendWorkspaceAddedEmail(
    to: string,
    name: string,
    workspaceName: string,
    role: string,
  ): Promise<{ id: string }> {
    const loginUrl = `${this.webUrl}/login`;
    const subject = `You've been added to ${workspaceName} on NexusFlow`;
    const text = `Hello ${name},\n\nYou have been added as a ${role} to the workspace "${workspaceName}".\n\nYou can access it by signing in with your existing account:\n${loginUrl}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">New Workspace Access</h2>
        <p style="color: #344054;">Hello ${escapeHtml(name)},</p>
        <p style="color: #344054;">You have been added to <strong>${escapeHtml(workspaceName)}</strong> with the role of <strong>${escapeHtml(role)}</strong>.</p>
        <p style="color: #344054;">Your existing credentials and passwords remain unchanged. Sign in to switch to this workspace:</p>
        <div style="margin: 24px 0;">
          <a href="${loginUrl}" style="background-color: #17202a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Workspace</a>
        </div>
      </div>
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<{ id: string }> {
    const resetUrl = `${this.webUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = 'Reset your password - NexusFlow';
    const text = `Hello ${name},\n\nWe received a request to reset your password. Open the following link to choose a new password:\n${resetUrl}\n\nThis link will expire in 1 hour. If you did not request this, please secure your account immediately.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #344054;">Hello ${escapeHtml(name)},</p>
        <p style="color: #344054;">We received a request to reset the password for your NexusFlow account.</p>
        <div style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #17202a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #667085; font-size: 12px;">This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  async sendWorkspaceInvitationEmail(
    to: string,
    workspaceName: string,
    role: string,
    token: string,
    inviterName?: string,
  ): Promise<{ id: string }> {
    const invitationUrl = `${this.webUrl}/invitations/accept?token=${encodeURIComponent(token)}`;
    const subject = `You have been invited to join ${workspaceName}`;
    const inviterText = inviterName ? `${inviterName} has invited you` : 'You have been invited';
    const text = `Hello,\n\n${inviterText} to join "${workspaceName}" as ${role} on NexusFlow.\n\nTo accept this invitation, open the link below:\n${invitationUrl}\n\nExisting users: sign in with ${to} to accept.\nNew users: create an account with ${to} to accept.\n\nThis single-use invitation expires in 7 days.\nIf you were not expecting this invitation, you can safely ignore this email.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Workspace Invitation</h2>
        <p style="color: #344054;">${inviterName ? `<strong>${escapeHtml(inviterName)}</strong> has invited you` : 'You have been invited'} to join <strong>${escapeHtml(workspaceName)}</strong> as <strong>${escapeHtml(role)}</strong>.</p>
        <p style="color: #344054;">Sign in or create an account using <strong>${escapeHtml(to)}</strong>, then accept your invitation below:</p>
        <div style="margin: 24px 0;">
          <a href="${invitationUrl}" style="background-color: #e85d2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation</a>
        </div>
        <p style="color: #667085; font-size: 13px;">This invitation expires in 7 days.</p>
        <p style="color: #667085; font-size: 12px; margin-top: 24px; border-top: 1px solid #f2f4f7; padding-top: 12px;">If you were not expecting this invitation, you can safely ignore this message.</p>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendInvitationAcceptedNotification(
    inviterEmail: string,
    inviterName: string,
    memberName: string,
    memberEmail: string,
    workspaceName: string,
    role: string,
  ): Promise<{ id: string }> {
    const subject = `${memberName} accepted your invitation to ${workspaceName}`;
    const text = `Hello ${inviterName},\n\n${memberName} (${memberEmail}) has accepted the invitation to join ${workspaceName} as ${role}. They now have active access to the workspace.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h3 style="color: #17202a; margin-top: 0;">Invitation Accepted</h3>
        <p style="color: #344054;">Hello ${escapeHtml(inviterName)},</p>
        <p style="color: #344054;"><strong>${escapeHtml(memberName)}</strong> (${escapeHtml(memberEmail)}) has accepted your invitation to join <strong>${escapeHtml(workspaceName)}</strong> as <strong>${escapeHtml(role)}</strong>.</p>
        <p style="color: #667085; font-size: 12px; margin-top: 24px;">You can view and manage all team members in Workspace Administration.</p>
      </div>
    `;
    return this.sendEmail({ to: inviterEmail, subject, html, text });
  }

  async sendOwnershipTransferEmail(to: string, workspaceName: string, transferId: string): Promise<{ id: string }> {
    const transferUrl = `${this.webUrl}/ownership-transfers/accept?transferId=${encodeURIComponent(transferId)}`;
    const subject = `Ownership transfer requested for ${workspaceName}`;
    const text = `You have been asked to become the owner of ${workspaceName}. Sign in with ${to} and review the transfer: ${transferUrl}. This request expires in 24 hours.`;
    const html = `<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;"><h2 style="color: #17202a; margin-top: 0;">Ownership transfer requested</h2><p style="color: #344054;">You have been asked to become the owner of <strong>${escapeHtml(workspaceName)}</strong>.</p><p style="margin: 24px 0;"><a href="${transferUrl}" style="background-color: #b42318; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Review ownership transfer</a></p><p style="color: #667085; font-size: 12px;">This request expires in 24 hours. If you did not expect it, do not accept it.</p></div>`;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendSecurityAlertEmail(
    to: string,
    title: string,
    message: string,
  ): Promise<{ id: string }> {
    const subject = `Security Notice: ${title} - NexusFlow`;
    const text = `Security Notice:\n\n${title}\n\n${message}\n\nIf you did not perform this action, please contact support and revoke your active sessions immediately.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h3 style="color: #b42318; margin-top: 0;">Security Alert</h3>
        <p style="color: #17202a; font-weight: bold;">${escapeHtml(title)}</p>
        <p style="color: #344054;">${escapeHtml(message)}</p>
        <p style="color: #667085; font-size: 12px; margin-top: 24px;">If you did not authorize this change, please log in immediately to revoke all active sessions and reset your password.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  async sendPostApprovalRequestedEmail(
    to: string,
    postTitle: string,
    authorName: string,
    workspaceName: string,
    postId: string,
  ): Promise<{ id: string }> {
    const reviewUrl = `${this.webUrl}/posts?id=${encodeURIComponent(postId)}`;
    const subject = `Content Approval Requested: "${postTitle}" in ${workspaceName}`;
    const text = `Hello,\n\n${authorName} has submitted a new post "${postTitle}" for approval in ${workspaceName}.\n\nPlease review and approve or reject it at:\n${reviewUrl}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h3 style="color: #17202a; margin-top: 0;">Content Sign-off Required</h3>
        <p style="color: #344054;"><strong>${escapeHtml(authorName)}</strong> submitted a post for approval in <strong>${escapeHtml(workspaceName)}</strong>:</p>
        <blockquote style="margin: 16px 0; padding: 12px 16px; background-color: #f9fafb; border-left: 4px solid #e85d2a; font-style: italic; color: #344054;">
          ${escapeHtml(postTitle)}
        </blockquote>
        <div style="margin: 24px 0;">
          <a href="${reviewUrl}" style="background-color: #e85d2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Review & Approve Post</a>
        </div>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendPostPublishStatusEmail(
    to: string,
    postTitle: string,
    workspaceName: string,
    status: 'PUBLISHED' | 'FAILED' | 'UNKNOWN_OUTCOME',
    reason?: string,
  ): Promise<{ id: string }> {
    const isSuccess = status === 'PUBLISHED';
    const isUnknown = status === 'UNKNOWN_OUTCOME';
    const subject = isSuccess
      ? `Post Published Successfully: "${postTitle}"`
      : isUnknown
        ? `Post Publishing Outcome Pending Verification: "${postTitle}"`
        : `Publishing Failed: "${postTitle}" in ${workspaceName}`;
    const text = isSuccess
      ? `Your post "${postTitle}" was published successfully to social channels.`
      : isUnknown
        ? `Your post "${postTitle}" was sent, but the provider did not confirm the result. NexusFlow is verifying the outcome before allowing any retry.`
        : `Your scheduled post "${postTitle}" failed to publish.\nReason: ${reason || 'Unknown error'}\nVisit the posts hub to retry.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h3 style="color: ${isSuccess ? '#027a48' : isUnknown ? '#b54708' : '#b42318'}; margin-top: 0;">
          ${isSuccess ? 'Post Published' : isUnknown ? 'Publish Outcome Pending' : 'Publishing Alert'}
        </h3>
        <p style="color: #344054;">Status for "${escapeHtml(postTitle)}" in <strong>${escapeHtml(workspaceName)}</strong>: <strong>${escapeHtml(status)}</strong></p>
        ${!isSuccess && reason ? `<p style="color: #b42318; font-size: 13px; background: #fef3f2; padding: 10px; border-radius: 6px;">Error: ${escapeHtml(reason)}</p>` : ''}
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendAccountActivatedEmail(to: string, name: string): Promise<{ id: string }> {
    const loginUrl = `${this.webUrl}/login`;
    const subject = 'Account Activated - NexusFlow';
    const text = `Hello ${name},\n\nYour NexusFlow account has been activated and your password is now set.\n\nYou can sign in anytime at:\n${loginUrl}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Account Activated</h2>
        <p style="color: #344054;">Hello <strong>${escapeHtml(name)}</strong>,</p>
        <p style="color: #344054;">Your NexusFlow user account has been successfully activated and your security credentials have been established.</p>
        <div style="margin: 24px 0;">
          <a href="${loginUrl}" style="background-color: #e85d2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Sign In to NexusFlow</a>
        </div>
        <p style="color: #667085; font-size: 12px; margin-top: 24px; border-top: 1px solid #f2f4f7; padding-top: 12px;">If you did not activate this account, please contact our support team immediately.</p>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendMemberRoleUpdatedEmail(
    to: string,
    name: string,
    workspaceName: string,
    previousRole: string,
    newRole: string,
  ): Promise<{ id: string }> {
    const workspaceUrl = `${this.webUrl}/settings/team`;
    const subject = `Your role in ${workspaceName} is now ${newRole}`;
    const text = `Hello ${name},\n\nYour role in the workspace "${workspaceName}" has been changed from ${previousRole} to ${newRole}.\n\nView your workspace team settings:\n${workspaceUrl}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Workspace Role Updated</h2>
        <p style="color: #344054;">Hello <strong>${escapeHtml(name)}</strong>,</p>
        <p style="color: #344054;">Your permission role in <strong>${escapeHtml(workspaceName)}</strong> has been updated:</p>
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e4e7ec;">
          <div style="font-size: 13px; color: #667085; margin-bottom: 4px;">Previous Role: <span style="font-weight: 600; color: #344054;">${escapeHtml(previousRole)}</span></div>
          <div style="font-size: 14px; font-weight: bold; color: #e85d2a;">New Role: ${escapeHtml(newRole)}</div>
        </div>
        <div style="margin: 20px 0;">
          <a href="${workspaceUrl}" style="background-color: #17202a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Workspace Team</a>
        </div>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendMemberRemovedEmail(
    to: string,
    name: string,
    workspaceName: string,
  ): Promise<{ id: string }> {
    const subject = `Access removed from ${workspaceName}`;
    const text = `Hello ${name},\n\nYour access to the workspace "${workspaceName}" has been removed by an administrator. You can still access any other workspaces associated with your account.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Workspace Access Revoked</h2>
        <p style="color: #344054;">Hello ${escapeHtml(name)},</p>
        <p style="color: #344054;">Your membership in the workspace <strong>${escapeHtml(workspaceName)}</strong> has been revoked by a workspace administrator.</p>
        <p style="color: #667085; font-size: 13px;">Your global NexusFlow account remains active and you can continue to access your other workspaces.</p>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendOwnershipTransferredConfirmationEmail(
    to: string,
    recipientName: string,
    workspaceName: string,
    isNewOwner: boolean,
  ): Promise<{ id: string }> {
    const workspaceUrl = `${this.webUrl}/settings/workspace`;
    const subject = `Ownership transfer completed for ${workspaceName}`;
    const text = isNewOwner
      ? `Hello ${recipientName},\n\nYou are now the official Owner of the workspace "${workspaceName}".\nManage workspace settings:\n${workspaceUrl}`
      : `Hello ${recipientName},\n\nThe ownership transfer for "${workspaceName}" has been successfully completed. Your role in the workspace is now Admin.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Ownership Transfer Completed</h2>
        <p style="color: #344054;">Hello <strong>${escapeHtml(recipientName)}</strong>,</p>
        <p style="color: #344054;">
          ${
            isNewOwner
              ? `You are now the primary <strong>Owner</strong> of <strong>${escapeHtml(workspaceName)}</strong>.`
              : `The ownership transfer for <strong>${escapeHtml(workspaceName)}</strong> has concluded. Your role is now <strong>Admin</strong>.`
          }
        </p>
        <div style="margin: 20px 0;">
          <a href="${workspaceUrl}" style="background-color: #17202a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Workspace Settings</a>
        </div>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendPostApprovedEmail(
    to: string,
    postTitle: string,
    workspaceName: string,
    approverName: string,
    decisionNotes?: string,
  ): Promise<{ id: string }> {
    const postUrl = `${this.webUrl}/posts`;
    const subject = `Post Approved: "${postTitle}" in ${workspaceName}`;
    const text = `Hello,\n\nYour post "${postTitle}" has been approved by ${approverName} in ${workspaceName}.\n${decisionNotes ? `Notes: ${decisionNotes}\n` : ''}\nView posts:\n${postUrl}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h3 style="color: #027a48; margin-top: 0;">Post Approved</h3>
        <p style="color: #344054;">Your post has been approved by <strong>${escapeHtml(approverName)}</strong> in <strong>${escapeHtml(workspaceName)}</strong>:</p>
        <blockquote style="margin: 16px 0; padding: 12px 16px; background-color: #f9fafb; border-left: 4px solid #027a48; font-style: italic; color: #344054;">
          ${escapeHtml(postTitle)}
        </blockquote>
        ${decisionNotes ? `<p style="color: #344054; font-size: 13px;"><strong>Approver Notes:</strong> ${escapeHtml(decisionNotes)}</p>` : ''}
        <div style="margin: 20px 0;">
          <a href="${postUrl}" style="background-color: #027a48; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Posts Hub</a>
        </div>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendPostRejectedEmail(
    to: string,
    postTitle: string,
    workspaceName: string,
    reviewerName: string,
    decisionNotes?: string,
  ): Promise<{ id: string }> {
    const postUrl = `${this.webUrl}/posts`;
    const subject = `Revision Requested: "${postTitle}" in ${workspaceName}`;
    const text = `Hello,\n\nYour post "${postTitle}" requires revisions before approval in ${workspaceName}.\nReviewer: ${reviewerName}\n${decisionNotes ? `Feedback: ${decisionNotes}\n` : ''}\nEdit post:\n${postUrl}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h3 style="color: #b42318; margin-top: 0;">Revision Requested</h3>
        <p style="color: #344054;">Your post requires changes before approval in <strong>${escapeHtml(workspaceName)}</strong>:</p>
        <blockquote style="margin: 16px 0; padding: 12px 16px; background-color: #fef3f2; border-left: 4px solid #b42318; font-style: italic; color: #344054;">
          ${escapeHtml(postTitle)}
        </blockquote>
        ${decisionNotes ? `<div style="background-color: #f9fafb; padding: 12px; border-radius: 6px; font-size: 13px; color: #344054; margin: 12px 0;"><strong>Feedback from ${escapeHtml(reviewerName)}:</strong><br />${escapeHtml(decisionNotes)}</div>` : ''}
        <div style="margin: 20px 0;">
          <a href="${postUrl}" style="background-color: #17202a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Edit Draft Post</a>
        </div>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendSubscriptionUpdatedEmail(
    to: string,
    name: string,
    workspaceName: string,
    planName: string,
    amountCents: number,
    currency: string,
  ): Promise<{ id: string }> {
    const billingUrl = `${this.webUrl}/settings/billing`;
    const subject = `Subscription Confirmed: ${planName} for ${workspaceName}`;
    const formattedAmount = `${currency.toUpperCase()} ${(amountCents / 100).toFixed(2)}`;
    const text = `Hello ${name},\n\nYour subscription for "${workspaceName}" has been successfully updated to the ${planName} plan (${formattedAmount}).\n\nManage billing:\n${billingUrl}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Subscription Activated</h2>
        <p style="color: #344054;">Hello <strong>${escapeHtml(name)}</strong>,</p>
        <p style="color: #344054;">Your subscription for <strong>${escapeHtml(workspaceName)}</strong> has been updated successfully:</p>
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e4e7ec;">
          <div style="font-size: 16px; font-weight: bold; color: #17202a; margin-bottom: 4px;">${escapeHtml(planName)} Plan</div>
          <div style="font-size: 14px; color: #667085;">Billing Amount: <strong>${formattedAmount}</strong></div>
        </div>
        <div style="margin: 20px 0;">
          <a href="${billingUrl}" style="background-color: #17202a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Billing & Invoices</a>
        </div>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendSubscriptionCancelledEmail(
    to: string,
    name: string,
    workspaceName: string,
    planName: string,
    accessUntil: Date,
  ): Promise<{ id: string }> {
    const billingUrl = `${this.webUrl}/settings/billing`;
    const subject = `Subscription Cancellation Scheduled for ${workspaceName}`;
    const formattedDate = accessUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const text = `Hello ${name},\n\nYour subscription for "${workspaceName}" (${planName}) has been scheduled for cancellation. You will retain full access until ${formattedDate}.\n\nManage billing:\n${billingUrl}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Subscription Cancellation Notice</h2>
        <p style="color: #344054;">Hello ${escapeHtml(name)},</p>
        <p style="color: #344054;">Cancellation has been scheduled for your <strong>${escapeHtml(workspaceName)}</strong> (${escapeHtml(planName)}) subscription.</p>
        <p style="color: #344054;">You have full access to your plan features until the end of your billing cycle on <strong>${escapeHtml(formattedDate)}</strong>.</p>
        <div style="margin: 20px 0;">
          <a href="${billingUrl}" style="background-color: #17202a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Manage Billing Settings</a>
        </div>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendWorkspaceSuspendedEmail(
    to: string,
    ownerName: string,
    workspaceName: string,
    reason: string,
  ): Promise<{ id: string }> {
    const subject = `Important: Workspace "${workspaceName}" Suspended`;
    const text = `Hello ${ownerName},\n\nYour workspace "${workspaceName}" has been suspended by platform administration.\nReason: ${reason}\n\nPlease contact support at support@nexusflow.test to resolve this matter.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #b42318; margin-top: 0;">Workspace Suspended</h2>
        <p style="color: #344054;">Hello ${escapeHtml(ownerName)},</p>
        <p style="color: #344054;">Your workspace <strong>${escapeHtml(workspaceName)}</strong> has been suspended by platform administrators.</p>
        <div style="background-color: #fef3f2; padding: 12px 16px; border-radius: 6px; color: #b42318; font-size: 13px; margin: 16px 0;">
          <strong>Reason:</strong> ${escapeHtml(reason)}
        </div>
        <p style="color: #667085; font-size: 13px;">To appeal or resolve this suspension, please reach out to our platform support team at <a href="mailto:support@nexusflow.test" style="color: #b42318;">support@nexusflow.test</a>.</p>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendWorkspaceReactivatedEmail(
    to: string,
    ownerName: string,
    workspaceName: string,
  ): Promise<{ id: string }> {
    const workspaceUrl = `${this.webUrl}/`;
    const subject = `Workspace "${workspaceName}" Reactivated`;
    const text = `Hello ${ownerName},\n\nGood news! Your workspace "${workspaceName}" has been reactivated. You and your team members can now resume normal operations.\n\nOpen workspace:\n${workspaceUrl}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #027a48; margin-top: 0;">Workspace Reactivated</h2>
        <p style="color: #344054;">Hello ${escapeHtml(ownerName)},</p>
        <p style="color: #344054;">Your workspace <strong>${escapeHtml(workspaceName)}</strong> has been reactivated. All publishing channels, campaigns, and team access have been restored.</p>
        <div style="margin: 20px 0;">
          <a href="${workspaceUrl}" style="background-color: #027a48; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Launch Workspace</a>
        </div>
      </div>
    `;
    return this.sendEmail({ to, subject, html, text });
  }
}
