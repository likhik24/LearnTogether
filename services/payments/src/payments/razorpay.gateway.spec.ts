import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { RazorpayGateway } from './razorpay.gateway';

describe('RazorpayGateway', () => {
  const values: Record<string, string> = {
    PAYMENTS_PROVIDER: 'razorpay',
    RAZORPAY_KEY_ID: 'rzp_test_key',
    RAZORPAY_KEY_SECRET: 'key-secret',
    RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
  };
  const config = { get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback) };
  let gateway: RazorpayGateway;

  beforeEach(() => {
    gateway = new RazorpayGateway(config as unknown as ConfigService);
    global.fetch = jest.fn();
  });

  it('creates an immutable server-side order with automatic capture', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'order_1', amount: 49900, currency: 'INR', status: 'created' }),
        { status: 200 },
      ),
    );
    await gateway.createOrder({
      bookingId: '11111111-1111-4111-8111-111111111111',
      amount: 49900,
      currency: 'INR',
    });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      amount: 49900,
      currency: 'INR',
      capture: 'automatic',
    });
    expect((init.headers as Record<string, string>).authorization).toMatch(/^Basic /);
  });

  it('requires a valid checkout signature and captured authoritative amount', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'pay_1',
          order_id: 'order_1',
          amount: 49900,
          currency: 'INR',
          status: 'captured',
        }),
        { status: 200 },
      ),
    );
    const signature = createHmac('sha256', 'key-secret').update('order_1|pay_1').digest('hex');
    await expect(
      gateway.verifyPayment({
        storedOrderId: 'order_1',
        returnedOrderId: 'order_1',
        paymentId: 'pay_1',
        signature,
        amount: 49900,
        currency: 'INR',
      }),
    ).resolves.toBeUndefined();
    await expect(
      gateway.verifyPayment({
        storedOrderId: 'order_1',
        returnedOrderId: 'order_1',
        paymentId: 'pay_1',
        signature: 'wrong',
        amount: 49900,
        currency: 'INR',
      }),
    ).rejects.toThrow('signature');
  });

  it('validates webhook signatures against the raw request bytes', () => {
    const payload = Buffer.from('{"event":"payment.captured"}');
    const signature = createHmac('sha256', 'webhook-secret').update(payload).digest('hex');
    expect(() => gateway.verifyWebhook(payload, signature)).not.toThrow();
    expect(() => gateway.verifyWebhook(payload, 'wrong')).toThrow('signature');
  });

  it('finds only a captured payment with the authoritative order total', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'pay_wrong',
              order_id: 'order_1',
              amount: 100,
              currency: 'INR',
              status: 'captured',
            },
            {
              id: 'pay_1',
              order_id: 'order_1',
              amount: 49900,
              currency: 'INR',
              status: 'captured',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    await expect(gateway.capturedPaymentForOrder('order_1', 49900, 'INR')).resolves.toMatchObject({
      id: 'pay_1',
    });
  });
});
