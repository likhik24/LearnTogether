import { ConfigService } from '@nestjs/config';
import { PaymentsGateway } from './payments.gateway';

describe('PaymentsGateway', () => {
  it('authorizes refund requests with the server-only internal secret', async () => {
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'PAYMENTS_API_URL') return 'http://payments:3007';
        if (key === 'INTERNAL_SERVICE_SECRET') return 'internal-secret';
        return fallback;
      }),
    };
    global.fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const gateway = new PaymentsGateway(config as unknown as ConfigService);

    await gateway.refund('Bearer customer-token', 'booking-1');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://payments:3007/payments/booking/booking-1/refund',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer customer-token',
          'x-internal-service-token': 'internal-secret',
        }),
      }),
    );
  });
});
