import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  EmailProviderAdapter,
  EmailSendOptions,
  EmailSendResult,
  EmailConnectionTestResult,
  sanitizeEmail,
  sanitizeErrorMessage,
} from './email-provider.interface';

export interface Msg91Config {
  authKey: string;
  domain: string;
  defaultFrom: string;
  defaultFromName?: string;
}

export class Msg91EmailAdapter implements EmailProviderAdapter {
  readonly name = 'msg91';
  private readonly logger = new Logger(Msg91EmailAdapter.name);

  constructor(private readonly config: Msg91Config) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.authKey &&
        this.config.authKey !== 'replace-me' &&
        this.config.authKey !== 'msg91_authkey_placeholder' &&
        this.config.domain &&
        this.config.domain !== 'mail.example.com',
    );
  }

  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'MSG91 transactional email provider is unconfigured. Missing MSG91_AUTH_KEY or MSG91_DOMAIN.',
      );
    }

    const fromEmail = options.from || this.config.defaultFrom;
    let cleanFromEmail = fromEmail;
    let cleanFromName = options.fromName || this.config.defaultFromName || 'NexusFlow';

    const match = fromEmail.match(/^(.*)<(.*)>$/);
    if (match) {
      cleanFromName = match[1]?.trim() || cleanFromName;
      cleanFromEmail = match[2]?.trim() || cleanFromEmail;
    }

    const payload = {
      to: [
        {
          name: options.toName || options.to,
          email: options.to,
        },
      ],
      from: {
        name: cleanFromName,
        email: cleanFromEmail,
      },
      domain: this.config.domain,
      subject: options.subject,
      body: options.html,
    };

    const res = await fetch('https://control.msg91.com/api/v5/email/send', {
      method: 'POST',
      headers: {
        authkey: this.config.authKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      const sanitized = sanitizeErrorMessage(errText);
      this.logger.error(`MSG91 API error (${res.status}): ${sanitized}`);
      throw new Error(`MSG91 API dispatch error (${res.status}): ${sanitized}`);
    }

    const data = (await res.json()) as { message?: string; status?: string; data?: { unique_id?: string } };
    const messageId = data.data?.unique_id || `msg91_${Date.now()}`;

    this.logger.log(`MSG91 dispatched message ${messageId} to ${sanitizeEmail(options.to)}`);

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
        message: 'MSG91 credentials missing. Configure MSG91_AUTH_KEY and MSG91_DOMAIN.',
        latencyMs: Date.now() - start,
      };
    }

    try {
      // MSG91 domain balance or validate auth key
      const res = await fetch(`https://control.msg91.com/api/v5/email/domains?domain=${encodeURIComponent(this.config.domain)}`, {
        headers: {
          authkey: this.config.authKey,
          Accept: 'application/json',
        },
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const err = await res.text();
        return {
          ok: false,
          provider: this.name,
          message: `MSG91 credentials or domain invalid (${res.status}): ${err}`,
          latencyMs,
        };
      }

      return {
        ok: true,
        provider: this.name,
        message: `MSG91 domain "${this.config.domain}" validated successfully.`,
        latencyMs,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'MSG91 connection error';
      return {
        ok: false,
        provider: this.name,
        message: `MSG91 connection check failed: ${msg}`,
        latencyMs: Date.now() - start,
      };
    }
  }
}
