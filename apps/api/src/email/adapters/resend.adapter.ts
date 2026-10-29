import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  EmailProviderAdapter,
  EmailSendOptions,
  EmailSendResult,
  EmailConnectionTestResult,
  sanitizeEmail,
  sanitizeErrorMessage,
} from './email-provider.interface';

export interface ResendConfig {
  apiKey: string;
  defaultFrom: string;
}

export class ResendEmailAdapter implements EmailProviderAdapter {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendEmailAdapter.name);

  constructor(private readonly config: ResendConfig) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.apiKey &&
        this.config.apiKey !== 'replace-me' &&
        this.config.apiKey !== 're_placeholder',
    );
  }

  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Resend transactional email provider is unconfigured. Missing EMAIL_API_KEY.',
      );
    }

    const fromAddress = options.from || this.config.defaultFrom;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.fromName ? `"${options.fromName}" <${fromAddress}>` : fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      const sanitized = sanitizeErrorMessage(errText);
      this.logger.error(`Resend API error (${res.status}): ${sanitized}`);
      throw new Error(`Resend API dispatch error (${res.status}): ${sanitized}`);
    }

    const data = (await res.json()) as { id: string };
    this.logger.log(`Resend dispatched message ${data.id} to ${sanitizeEmail(options.to)}`);

    return {
      id: data.id,
      provider: this.name,
      timestamp: new Date(),
    };
  }

  async verifyConnection(): Promise<EmailConnectionTestResult> {
    const start = Date.now();
    if (!this.isConfigured()) {
      return {
        ok: false,
        provider: this.name,
        message: 'Resend API key missing. Configure EMAIL_API_KEY.',
        latencyMs: Date.now() - start,
      };
    }

    try {
      const res = await fetch('https://api.resend.com/api-keys', {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const err = await res.text();
        return {
          ok: false,
          provider: this.name,
          message: `Resend credentials invalid (${res.status}): ${err}`,
          latencyMs,
        };
      }

      return {
        ok: true,
        provider: this.name,
        message: 'Resend API connection verified successfully.',
        latencyMs,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Resend connection error';
      return {
        ok: false,
        provider: this.name,
        message: `Resend connection failed: ${msg}`,
        latencyMs: Date.now() - start,
      };
    }
  }
}
