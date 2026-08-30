import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}
interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}
interface RazorpayPaymentList {
  items: RazorpayPayment[];
}

@Injectable()
export class RazorpayGateway {
  constructor(private readonly config: ConfigService) {}

  get provider(): 'razorpay' | 'mock' {
    return this.config.get<string>('PAYMENTS_PROVIDER') === 'mock' ? 'mock' : 'razorpay';
  }

  get publicKey(): string {
    return this.provider === 'mock' ? 'mock_key' : this.config.get<string>('RAZORPAY_KEY_ID', '');
  }

  isReady(): boolean {
    return this.provider === 'mock' || Boolean(this.publicKey && this.secret);
  }

  async createOrder(input: {
    bookingId: string;
    amount: number;
    currency: string;
  }): Promise<RazorpayOrder> {
    this.assertReady();
    if (this.provider === 'mock') {
      return {
        id: `order_mock_${input.bookingId.replace(/-/g, '').slice(0, 20)}`,
        amount: input.amount,
        currency: input.currency,
        status: 'created',
      };
    }
    return this.request<RazorpayOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        receipt: `booking_${input.bookingId.replace(/-/g, '').slice(0, 24)}`,
        notes: { booking_id: input.bookingId },
        capture: 'automatic',
      }),
    });
  }

  async verifyPayment(input: {
    storedOrderId: string;
    returnedOrderId: string;
    paymentId: string;
    signature: string;
    amount: number;
    currency: string;
  }): Promise<void> {
    this.assertReady();
    if (input.returnedOrderId !== input.storedOrderId)
      throw new UnauthorizedException('Payment order does not match');
    if (this.provider === 'mock') {
      if (input.signature !== 'mock_signature')
        throw new UnauthorizedException('Payment signature is invalid');
      return;
    }
    const expected = hmac(`${input.storedOrderId}|${input.paymentId}`, this.secret);
    if (!safeEqual(expected, input.signature))
      throw new UnauthorizedException('Payment signature is invalid');
    const payment = await this.request<RazorpayPayment>(
      `/payments/${encodeURIComponent(input.paymentId)}`,
    );
    if (
      payment.status !== 'captured' ||
      payment.order_id !== input.storedOrderId ||
      payment.amount !== input.amount ||
      payment.currency !== input.currency
    ) {
      throw new UnauthorizedException('Payment has not been captured for the expected amount');
    }
  }

  async refund(paymentId: string, amount: number): Promise<void> {
    this.assertReady();
    if (this.provider === 'mock') return;
    await this.request(`/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      body: JSON.stringify({ amount, notes: { reason: 'customer_booking_cancelled' } }),
    });
  }

  async capturedPaymentForOrder(
    orderId: string,
    amount: number,
    currency: string,
  ): Promise<RazorpayPayment> {
    this.assertReady();
    if (this.provider === 'mock') {
      return {
        id: `pay_mock_${orderId.replace(/\W/g, '').slice(0, 20)}`,
        order_id: orderId,
        amount,
        currency,
        status: 'captured',
      };
    }
    const result = await this.request<RazorpayPaymentList>(
      `/orders/${encodeURIComponent(orderId)}/payments`,
    );
    const payment = result.items.find(
      (item) =>
        item.status === 'captured' &&
        item.order_id === orderId &&
        item.amount === amount &&
        item.currency === currency,
    );
    if (!payment)
      throw new UnauthorizedException('No captured payment matches the expected order amount');
    return payment;
  }

  verifyWebhook(payload: Buffer, signature: string): void {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET', '');
    if (!secret || !safeEqual(hmac(payload, secret), signature))
      throw new UnauthorizedException('Webhook signature is invalid');
  }

  private get secret(): string {
    return this.config.get<string>('RAZORPAY_KEY_SECRET', '');
  }
  private assertReady(): void {
    if (!this.isReady())
      throw new ServiceUnavailableException('Online payments are not configured');
  }
  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      headers: {
        authorization: `Basic ${Buffer.from(`${this.publicKey}:${this.secret}`).toString('base64')}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok)
      throw new ServiceUnavailableException(`Payment provider request failed (${response.status})`);
    return response.json() as Promise<T>;
  }
}

function hmac(value: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqual(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}
