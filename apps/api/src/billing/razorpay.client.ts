import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Official Razorpay Orders REST API client.
 *
 * Creates real payment orders via https://api.razorpay.com/v1/orders using
 * HTTP Basic auth (key_id:key_secret). No fabricated order IDs are ever returned:
 * when Razorpay is not configured the service fails with an explicit
 * ServiceUnavailableException instead of simulating a checkout.
 */
export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderRequest {
  amount: number; // smallest currency unit (paise for INR, cents for USD)
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

@Injectable()
export class RazorpayClient {
  private readonly logger = new Logger(RazorpayClient.name);
  private readonly baseUrl = 'https://api.razorpay.com/v1';

  constructor(private readonly configService: ConfigService) {}

  getKeyId(): string {
    return (
      this.configService.get<string>('razorpay.keyId') ||
      process.env['RAZORPAY_KEY_ID'] ||
      ''
    );
  }

  private getKeySecret(): string {
    return (
      this.configService.get<string>('razorpay.keySecret') ||
      process.env['RAZORPAY_KEY_SECRET'] ||
      ''
    );
  }

  isConfigured(): boolean {
    return Boolean(this.getKeyId() && this.getKeySecret());
  }

  async createOrder(params: RazorpayOrderRequest): Promise<RazorpayOrder> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET server-side.',
      );
    }

    const auth = Buffer.from(`${this.getKeyId()}:${this.getKeySecret()}`).toString('base64');

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency,
          receipt: params.receipt,
          notes: params.notes ?? {},
        }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error contacting Razorpay.';
      this.logger.error(`Razorpay order creation failed: ${message}`);
      throw new ServiceUnavailableException(`Razorpay order creation failed: ${message}`);
    }

    const data = (await res.json()) as RazorpayOrder & {
      error?: { code?: string; description?: string };
    };

    if (!res.ok || data.error) {
      const message = data.error?.description ?? `Razorpay order creation failed (HTTP ${res.status}).`;
      this.logger.error(`Razorpay order creation failed: ${message}`);
      throw new ServiceUnavailableException(`Razorpay order creation failed: ${message}`);
    }

    return data;
  }
}
