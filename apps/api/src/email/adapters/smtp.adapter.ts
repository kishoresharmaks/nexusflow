import { Logger, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import {
  EmailProviderAdapter,
  EmailSendOptions,
  EmailSendResult,
  EmailConnectionTestResult,
  sanitizeEmail,
  sanitizeErrorMessage,
} from './email-provider.interface';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  defaultFrom: string;
}

export class SmtpEmailAdapter implements EmailProviderAdapter {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpEmailAdapter.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: SmtpConfig) {
    if (config.host) {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure, // true for 465, false for other ports
        auth:
          config.user && config.pass
            ? {
                user: config.user,
                pass: config.pass,
              }
            : undefined,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config.host && this.config.user && this.config.pass);
  }

  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    if (!this.transporter || !this.isConfigured()) {
      throw new ServiceUnavailableException(
        'SMTP transactional email provider is not configured. Missing host or credentials.',
      );
    }

    const fromAddress = options.from || this.config.defaultFrom;
    const now = new Date();

    try {
      const info = await this.transporter.sendMail({
        from: options.fromName ? `"${options.fromName}" <${fromAddress}>` : fromAddress,
        to: options.toName ? `"${options.toName}" <${options.to}>` : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      });

      this.logger.log(`SMTP dispatched message ${info.messageId} to ${sanitizeEmail(options.to)}`);

      return {
        id: info.messageId,
        provider: this.name,
        timestamp: now,
      };
    } catch (err: unknown) {
      const sanitized = sanitizeErrorMessage(err);
      this.logger.error(`SMTP dispatch failed to ${sanitizeEmail(options.to)}: ${sanitized}`);
      throw new Error(`SMTP dispatch failed: ${sanitized}`);
    }
  }

  async verifyConnection(): Promise<EmailConnectionTestResult> {
    const start = Date.now();
    if (!this.transporter || !this.isConfigured()) {
      return {
        ok: false,
        provider: this.name,
        message: 'SMTP credentials missing. Host, user, and password are required.',
        latencyMs: Date.now() - start,
      };
    }

    try {
      await this.transporter.verify();
      const latencyMs = Date.now() - start;
      return {
        ok: true,
        provider: this.name,
        message: `SMTP connection established to ${this.config.host}:${this.config.port}`,
        latencyMs,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SMTP verification failed';
      return {
        ok: false,
        provider: this.name,
        message: `SMTP connection error: ${msg}`,
        latencyMs: Date.now() - start,
      };
    }
  }
}
