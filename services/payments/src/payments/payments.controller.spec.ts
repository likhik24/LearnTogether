import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayGateway } from './razorpay.gateway';

describe('PaymentsController', () => {
  const payments = { refund: jest.fn() };
  const gateway = {};
  const config = { get: jest.fn(() => 'internal-secret') };
  const controller = new PaymentsController(
    payments as unknown as PaymentsService,
    gateway as RazorpayGateway,
    config as unknown as ConfigService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects direct browser refund requests', async () => {
    await expect(
      controller.refund({ sub: 'user-1' } as never, 'booking-1', ''),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(payments.refund).not.toHaveBeenCalled();
  });

  it('allows the authenticated internal cancellation workflow', async () => {
    payments.refund.mockResolvedValue(null);
    await expect(
      controller.refund({ sub: 'user-1' } as never, 'booking-1', 'internal-secret'),
    ).resolves.toBeNull();
    expect(payments.refund).toHaveBeenCalledWith('user-1', 'booking-1');
  });
});
