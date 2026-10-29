import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  EmailProviderAdapter,
  EmailSendOptions,
  EmailSendResult,
  EmailConnectionTestResult,
  sanitizeEmail,
  sanitizeErrorMessage,
} from './email-provider.interface';

export interface BrevoConfig {
  apiKey: string;
  defaultFrom: string;
  defaultFromName?: string;
}

export class BrevoEmailAdapter implements EmailProviderAdapter {
  readonly name = 'brevo';
  private readonly logger = new Logger(BrevoEmailAdapter.name);

  constructor(private readonly config: BrevoConfig) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.apiKey &&
        this.config.apiKey !== 'replace-me' &&
        this.config.apiKey !== 'xkeysib_placeholder',
    );
  }

  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Brevo transactional email provider is unconfigured. Missing BREVO_API_KEY.',
      );
    }

    const fromEmail = options.from || this.config.defaultFrom;
    const fromName = options.fromName || this.config.defaultFromName || 'NexusFlow';

    // Parse email if in "Name <email>" format
    let cleanFromEmail = fromEmail;
    let cleanFromName = fromName;
    const match = fromEmail.match(/^(.*)<(.*)>$/);
    if (match) {
      cleanFromName = match[1]?.trim() || cleanFromName;
      cleanFromEmail = match[2]?.trim() || cleanFromEmail;
    }

    const payload = {
      sender: {
        name: cleanFromName,
        email: cleanFromEmail,
      },
      to: [
        {
          email: options.to,
          name: options.toName || options.to,
        },
      ],
      subject: options.subject,
      htmlContent: options.html,
      textContent: options.text,
      replyTo: options.replyTo ? { email: options.replyTo } : undefined,
    };

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.config.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      const sanitized = sanitizeErrorMessage(errText);
      this.logger.error(`Brevo API error (${res.status}): ${sanitized}`);
      throw new Error(`Brevo API dispatch error (${res.status}): ${sanitized}`);
    }

    const data = (await res.json()) as { messageId?: string };
    const messageId = data.messageId || `brevo_${Date.now()}`;

    this.logger.log(`Brevo dispatched message ${messageId} to ${sanitizeEmail(options.to)}`);

    return {
      id: messageId,
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
        message: 'Brevo API key missing. Configure BREVO_API_KEY.',
        latencyMs: Date.now() - start,
      };
    }

    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: {
          'api-key': this.config.apiKey,
          Accept: 'application/json',
        },
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const err = await res.text();
        return {
          ok: false,
          provider: this.name,
          message: `Brevo credentials invalid (${res.status}): ${err}`,
          latencyMs,
        };
      }

      const account = (await res.json()) as { email?: string; companyName?: string };
      return {
        ok: true,
        provider: this.name,
        message: `Brevo account verified (${account.email || 'active'})`,
        latencyMs,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Brevo connection error';
      return {
        ok: false,
        provider: this.name,
        message: `Brevo connection failed: ${msg}`,
        latencyMs: Date.now() - start,
      };
    }
  }
}
