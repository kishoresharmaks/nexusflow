import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailDispatchOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface OutboxEmail extends EmailDispatchOptions {
  id: string;
  sentAt: Date;
  provider: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: string;
  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly webUrl: string;
  private readonly outbox: OutboxEmail[] = [];

  constructor(private readonly configService: ConfigService) {
    this.provider = (
      this.configService.get<string>('EMAIL_PROVIDER') ||
      process.env['EMAIL_PROVIDER'] ||
      'local'
    ).toLowerCase();

    this.apiKey =
      this.configService.get<string>('EMAIL_API_KEY') || process.env['EMAIL_API_KEY'] || '';

    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM') ||
      process.env['EMAIL_FROM'] ||
      'CommercePilot <noreply@commercepilot.test>';

    this.webUrl =
      this.configService.get<string>('WEB_URL') ||
      process.env['WEB_URL'] ||
      'http://localhost:3000';
  }

  getOutbox(): OutboxEmail[] {
    return [...this.outbox];
  }

  clearOutbox(): void {
    this.outbox.length = 0;
  }

  async sendEmail(options: EmailDispatchOptions): Promise<{ id: string; provider: string }> {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const isStaging = process.env['NODE_ENV'] === 'staging';

    // In production or staging, provider must be explicitly configured
    if ((isProduction || isStaging) && (!this.apiKey || this.apiKey === 'replace-me')) {
      this.logger.error(
        `Transactional email cannot be sent in ${process.env['NODE_ENV']}: Provider credentials missing.`,
      );
      throw new ServiceUnavailableException(
        'Transactional email provider is unconfigured or unavailable.',
      );
    }

    if (this.provider === 'resend' && this.apiKey && this.apiKey !== 'replace-me') {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.fromAddress,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Resend API error (${res.status}): ${errText}`);
        }

        const data = (await res.json()) as { id: string };
        return { id: data.id, provider: 'resend' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown email provider error';
        this.logger.error(`Failed to dispatch email via Resend to ${options.to}: ${msg}`);
        throw err;
      }
    }

    // Local development and test inbox mode
    const emailRecord: OutboxEmail = {
      id: `mail_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      sentAt: new Date(),
      provider: this.provider,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    this.outbox.push(emailRecord);
    this.logger.log(
      `[Local Outbox] Email to ${options.to}: "${options.subject}" (ID: ${emailRecord.id})`,
    );

    return { id: emailRecord.id, provider: 'local' };
  }

  async sendVerificationEmail(to: string, name: string, token: string): Promise<{ id: string }> {
    const verificationUrl = `${this.webUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const subject = 'Verify your email address - CommercePilot';
    const text = `Hello ${name},\n\nPlease verify your email address by opening the following link:\n${verificationUrl}\n\nThis link will expire in 24 hours.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Welcome to CommercePilot</h2>
        <p style="color: #344054;">Hello ${name},</p>
        <p style="color: #344054;">Please verify your email address to secure your account and workspace:</p>
        <div style="margin: 24px 0;">
          <a href="${verificationUrl}" style="background-color: #e85d2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="color: #667085; font-size: 12px;">This link will expire in 24 hours. If you did not create this account, you can safely disregard this email.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<{ id: string }> {
    const resetUrl = `${this.webUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = 'Reset your password - CommercePilot';
    const text = `Hello ${name},\n\nWe received a request to reset your password. Open the following link to choose a new password:\n${resetUrl}\n\nThis link will expire in 1 hour. If you did not request this, please secure your account immediately.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h2 style="color: #17202a; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #344054;">Hello ${name},</p>
        <p style="color: #344054;">We received a request to reset the password for your CommercePilot account.</p>
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
  ): Promise<{ id: string }> {
    const invitationUrl = `${this.webUrl}/invitations/accept?token=${encodeURIComponent(token)}`;
    const subject = `You are invited to ${workspaceName} on CommercePilot`;
    const text = `You have been invited to join ${workspaceName} as ${role}. Sign in or create an account with ${to}, then accept the invitation: ${invitationUrl}. This link expires in 7 days.`;
    const html = `<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;"><h2 style="color: #17202a; margin-top: 0;">Workspace invitation</h2><p style="color: #344054;">You have been invited to join <strong>${workspaceName}</strong> as <strong>${role}</strong>.</p><p style="color: #344054;">Sign in or create an account using this email address, then accept your invitation.</p><p style="margin: 24px 0;"><a href="${invitationUrl}" style="background-color: #e85d2a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept invitation</a></p><p style="color: #667085; font-size: 12px;">This link expires in 7 days. If you were not expecting this invitation, you can safely ignore this email.</p></div>`;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendOwnershipTransferEmail(to: string, workspaceName: string, transferId: string): Promise<{ id: string }> {
    const transferUrl = `${this.webUrl}/ownership-transfers/accept?transferId=${encodeURIComponent(transferId)}`;
    const subject = `Ownership transfer requested for ${workspaceName}`;
    const text = `You have been asked to become the owner of ${workspaceName}. Sign in with ${to} and review the transfer: ${transferUrl}. This request expires in 24 hours.`;
    const html = `<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;"><h2 style="color: #17202a; margin-top: 0;">Ownership transfer requested</h2><p style="color: #344054;">You have been asked to become the owner of <strong>${workspaceName}</strong>.</p><p style="margin: 24px 0;"><a href="${transferUrl}" style="background-color: #b42318; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Review ownership transfer</a></p><p style="color: #667085; font-size: 12px;">This request expires in 24 hours. If you did not expect it, do not accept it.</p></div>`;
    return this.sendEmail({ to, subject, html, text });
  }

  async sendSecurityAlertEmail(
    to: string,
    title: string,
    message: string,
  ): Promise<{ id: string }> {
    const subject = `Security Notice: ${title} - CommercePilot`;
    const text = `Security Notice:\n\n${title}\n\n${message}\n\nIf you did not perform this action, please contact support and revoke your active sessions immediately.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e7ec; border-radius: 8px;">
        <h3 style="color: #b42318; margin-top: 0;">Security Alert</h3>
        <p style="color: #17202a; font-weight: bold;">${title}</p>
        <p style="color: #344054;">${message}</p>
        <p style="color: #667085; font-size: 12px; margin-top: 24px;">If you did not authorize this change, please log in immediately to revoke all active sessions and reset your password.</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html, text });
  }
}
