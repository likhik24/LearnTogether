import { BookingStatus, PaymentStatus } from '@learn-and-build/types';
import type { DataSource, Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { PaymentWebhookEvent } from './payment-webhook-event.entity';
import { PaymentsService } from './payments.service';
import { RazorpayGateway } from './razorpay.gateway';

describe('PaymentsService', () => {
  const payments = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => Object.assign(new Payment(), v)),
    save: jest.fn(async (v) => v),
  };
  const events = {
    findOne: jest.fn(),
    create: jest.fn((v) => Object.assign(new PaymentWebhookEvent(), v)),
    save: jest.fn(async (v) => v),
  };
  const db = { query: jest.fn(), transaction: jest.fn() };
  const gateway = {
    provider: 'mock',
    publicKey: 'mock_key',
    isReady: jest.fn(() => true),
    createOrder: jest.fn(),
    verifyPayment: jest.fn(),
    refund: jest.fn(),
    capturedPaymentForOrder: jest.fn(),
  };
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentsService(
      payments as unknown as Repository<Payment>,
      events as unknown as Repository<PaymentWebhookEvent>,
      db as unknown as DataSource,
      gateway as unknown as RazorpayGateway,
    );
  });

  it('creates one provider order using the authoritative booking amount', async () => {
    db.query.mockResolvedValueOnce([
      {
        id: 'booking-1',
        user_id: 'user-1',
        class_ref: 'class-1',
        amount_minor: 49900,
        currency: 'INR',
        status: BookingStatus.PENDING_PAYMENT,
      },
    ]);
    payments.findOne.mockResolvedValue(null);
    gateway.createOrder.mockResolvedValue({ id: 'order-1' });
    const result = await service.createIntent('user-1', 'booking-1');
    expect(gateway.createOrder).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      amount: 49900,
      currency: 'INR',
    });
    expect(result.providerOrderId).toBe('order-1');
  });

  it('confirms the booking only after provider verification', async () => {
    const payment = Object.assign(new Payment(), {
      id: 'payment-1',
      userId: 'user-1',
      bookingId: 'booking-1',
      amountMinor: 49900,
      currency: 'INR',
      status: PaymentStatus.PENDING,
      providerOrderId: 'order-1',
    });
    payments.findOne.mockResolvedValue(payment);
    await service.verify('user-1', 'payment-1', {
      providerOrderId: 'order-1',
      providerPaymentId: 'pay-1',
      signature: 'signature',
    });
    expect(gateway.verifyPayment).toHaveBeenCalled();
    expect(payment.status).toBe(PaymentStatus.SUCCEEDED);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE bookings'), [
      BookingStatus.CONFIRMED,
      'booking-1',
      BookingStatus.PENDING_PAYMENT,
    ]);
  });

  it('refunds a succeeded payment before cancellation continues', async () => {
    const payment = Object.assign(new Payment(), {
      userId: 'user-1',
      bookingId: 'booking-1',
      amountMinor: 49900,
      status: PaymentStatus.SUCCEEDED,
      providerRef: 'pay-1',
    });
    payments.findOne.mockResolvedValue(payment);
    await service.refund('user-1', 'booking-1');
    expect(gateway.refund).toHaveBeenCalledWith('pay-1', 49900);
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
  });

  it('recovers a captured checkout from a signed order webhook', async () => {
    const payment = Object.assign(new Payment(), {
      bookingId: 'booking-1',
      amountMinor: 49900,
      currency: 'INR',
      status: PaymentStatus.PENDING,
      providerOrderId: 'order-1',
    });
    events.findOne.mockResolvedValue(null);
    payments.findOne.mockResolvedValue(payment);
    gateway.capturedPaymentForOrder.mockResolvedValue({ id: 'pay-1' });
    await service.webhook('event-1', {
      event: 'order.paid',
      payload: { order: { entity: { id: 'order-1' } } },
    });
    expect(gateway.capturedPaymentForOrder).toHaveBeenCalledWith('order-1', 49900, 'INR');
    expect(payment.providerRef).toBe('pay-1');
    expect(payment.status).toBe(PaymentStatus.SUCCEEDED);
  });

  it('expires abandoned checkout holds and releases their reservation', async () => {
    const payment = Object.assign(new Payment(), {
      bookingId: 'booking-1',
      status: PaymentStatus.PENDING,
      expiresAt: new Date(Date.now() - 1_000),
    });
    payments.find.mockResolvedValue([payment]);
    const manager = { save: jest.fn(async (value) => value), query: jest.fn() };
    db.transaction.mockImplementation(async (work: (value: typeof manager) => unknown) =>
      work(manager),
    );
    await expect(service.expirePending()).resolves.toBe(1);
    expect(payment.status).toBe(PaymentStatus.FAILED);
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('class_reservations'), [
      'booking-1',
    ]);
  });
});
