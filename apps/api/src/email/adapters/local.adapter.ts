import { Logger } from '@nestjs/common';
import {
  EmailProviderAdapter,
  EmailSendOptions,
  EmailSendResult,
  EmailConnectionTestResult,
} from './email-provider.interface';

export interface OutboxEmail extends EmailSendOptions {
  id: string;
  sentAt: Date;
  provider: string;
}

export class LocalEmailAdapter implements EmailProviderAdapter {
  readonly name = 'local';
  private readonly logger = new Logger(LocalEmailAdapter.name);
  private readonly outbox: OutboxEmail[] = [];

  getOutbox(): OutboxEmail[] {
    return [...this.outbox];
  }

  clearOutbox(): void {
    this.outbox.length = 0;
  }

  async send(options: EmailSendOptions): Promise<EmailSendResult> {
    const id = `mail_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    const record: OutboxEmail = {
      ...options,
      id,
      sentAt: now,
      provider: this.name,
    };

    this.outbox.push(record);
    this.logger.log(`[Local Outbox] Email to ${options.to}: "${options.subject}" (ID: ${id})`);

    return {
      id,
      provider: this.name,
      timestamp: now,
    };
  }

  async verifyConnection(): Promise<EmailConnectionTestResult> {
    return {
      ok: true,
      provider: this.name,
      message: 'Local development outbox active. Ready to capture outgoing emails.',
      latencyMs: 1,
    };
  }
}
