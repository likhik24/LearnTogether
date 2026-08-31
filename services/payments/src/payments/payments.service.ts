import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  BookingStatus,
  PaymentStatus,
  ProviderPayoutStatus,
  type PaymentIntentResponse,
  type ProviderEarningsDto,
} from '@learn-and-build/types';
import { Payment } from './payment.entity';
import { PaymentWebhookEvent } from './payment-webhook-event.entity';
import { RazorpayGateway } from './razorpay.gateway';
import { ProviderPayout } from './provider-payout.entity';

interface BookingRow {
  id: string;
  user_id: string;
  class_ref: string;
  amount_minor: number;
  currency: string;
  status: BookingStatus;
}
interface WebhookPayload {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; error_description?: string } };
    order?: { entity?: { id?: string } };
  };
}

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: NodeJS.Timeout;
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(PaymentWebhookEvent) private readonly events: Repository<PaymentWebhookEvent>,
    @InjectRepository(ProviderPayout) private readonly payouts: Repository<ProviderPayout>,
    private readonly db: DataSource,
    private readonly gateway: RazorpayGateway,
  ) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => void this.expirePending().catch(() => undefined), 60_000);
    this.cleanupTimer.unref();
  }
  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  ready(): { ready: boolean; provider: string } {
    return { ready: this.gateway.isReady(), provider: this.gateway.provider };
  }

  async createIntent(userId: string, bookingId: string): Promise<PaymentIntentResponse> {
    const booking = await this.bookingForUser(userId, bookingId);
    if (booking.status === BookingStatus.CANCELLED)
      throw new BadRequestException('Cancelled bookings cannot be paid');
    let payment = await this.payments.findOne({ where: { bookingId, userId } });
    if (!payment) {
      payment = this.payments.create({
        userId,
        bookingId,
        classId: booking.class_ref,
        amountMinor: booking.amount_minor,
        currency: booking.currency,
        status: PaymentStatus.PENDING,
        provider: this.gateway.provider,
        providerOrderId: null,
        providerRef: null,
        failureReason: null,
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      });
      payment = await this.payments.save(payment);
    }
    if (payment.status === PaymentStatus.SUCCEEDED)
      throw new BadRequestException('This booking is already paid');
    if (!payment.providerOrderId || payment.status === PaymentStatus.FAILED) {
      const order = await this.gateway.createOrder({
        bookingId,
        amount: booking.amount_minor,
        currency: booking.currency,
      });
      payment.providerOrderId = order.id;
      payment.status = PaymentStatus.PENDING;
      payment.failureReason = null;
      payment.expiresAt = new Date(Date.now() + 20 * 60 * 1000);
      payment = await this.payments.save(payment);
    }
    return {
      payment: payment.toDto(),
      publicKey: this.gateway.publicKey,
      providerOrderId: payment.providerOrderId!,
    };
  }

  async verify(
    userId: string,
    id: string,
    input: { providerOrderId: string; providerPaymentId: string; signature: string },
  ): Promise<Payment> {
    const payment = await this.ownedPayment(userId, id);
    if (payment.status === PaymentStatus.SUCCEEDED) return payment;
    if (payment.status === PaymentStatus.REFUNDED)
      throw new BadRequestException('This payment was refunded');
    if (!payment.providerOrderId) throw new BadRequestException('Payment order is missing');
    await this.gateway.verifyPayment({
      storedOrderId: payment.providerOrderId,
      returnedOrderId: input.providerOrderId,
      paymentId: input.providerPaymentId,
      signature: input.signature,
      amount: payment.amountMinor,
      currency: payment.currency,
    });
    return this.markSucceeded(payment, input.providerPaymentId);
  }

  async byBooking(userId: string, bookingId: string): Promise<Payment | null> {
    return this.payments.findOne({ where: { bookingId, userId } });
  }

  async refund(userId: string, bookingId: string): Promise<Payment | null> {
    const payment = await this.payments.findOne({ where: { bookingId, userId } });
    return this.refundPayment(payment);
  }

  async refundByBooking(bookingId: string): Promise<Payment | null> {
    const payment = await this.payments.findOne({ where: { bookingId } });
    return this.refundPayment(payment);
  }

  private async refundPayment(payment: Payment | null): Promise<Payment | null> {
    if (!payment || payment.status === PaymentStatus.REFUNDED) return payment;
    if (payment.status === PaymentStatus.SUCCEEDED && payment.providerRef) {
      await this.gateway.refund(payment.providerRef, payment.amountMinor);
      payment.status = PaymentStatus.REFUNDED;
      return this.payments.save(payment);
    }
    payment.status = PaymentStatus.FAILED;
    payment.failureReason = 'Booking cancelled before payment completed';
    return this.payments.save(payment);
  }

  async providerEarnings(teacherId: string): Promise<ProviderEarningsDto> {
    const platformFeeBps = 1000;
    const classes = await this.db.query<
      Array<{
        classId: string;
        classTitle: string;
        bookings: string;
        grossMinor: string;
        refundedMinor: string;
        netMinor: string;
      }>
    >(
      `SELECT c.id AS "classId", c.activity AS "classTitle",
              COUNT(p.id) FILTER (WHERE p.status IN ('succeeded', 'refunded'))::text AS bookings,
              COALESCE(SUM(p.amount_minor) FILTER (WHERE p.status IN ('succeeded', 'refunded')), 0)::text AS "grossMinor",
              COALESCE(SUM(p.amount_minor) FILTER (WHERE p.status = 'refunded'), 0)::text AS "refundedMinor",
              COALESCE(SUM(p.amount_minor) FILTER (WHERE p.status = 'succeeded'), 0)::text AS "netMinor"
       FROM class_offerings c
       LEFT JOIN payments p ON p.class_id::text = c.id::text
       WHERE c.teacher_id = $1
       GROUP BY c.id, c.activity ORDER BY c.activity`,
      [teacherId],
    );
    const normalized = classes.map((item) => ({
      classId: item.classId,
      classTitle: item.classTitle,
      bookings: Number(item.bookings),
      grossMinor: Number(item.grossMinor),
      refundedMinor: Number(item.refundedMinor),
      netMinor: Number(item.netMinor),
    }));
    const grossMinor = normalized.reduce((sum, item) => sum + item.grossMinor, 0);
    const refundedMinor = normalized.reduce((sum, item) => sum + item.refundedMinor, 0);
    const capturedNet = normalized.reduce((sum, item) => sum + item.netMinor, 0);
    const feeMinor = Math.round((capturedNet * platformFeeBps) / 10_000);
    const payoutRows = await this.payouts.find({ where: { teacherId } });
    const requestedMinor = payoutRows
      .filter((item) =>
        [ProviderPayoutStatus.REQUESTED, ProviderPayoutStatus.PROCESSING].includes(item.status),
      )
      .reduce((sum, item) => sum + item.amountMinor, 0);
    const paidMinor = payoutRows
      .filter((item) => item.status === ProviderPayoutStatus.PAID)
      .reduce((sum, item) => sum + item.amountMinor, 0);
    const netMinor = Math.max(0, capturedNet - feeMinor);
    return {
      currency: 'INR',
      platformFeeBps,
      grossMinor,
      refundedMinor,
      feeMinor,
      netMinor,
      requestedMinor,
      paidMinor,
      availableMinor: Math.max(0, netMinor - requestedMinor - paidMinor),
      classes: normalized,
    };
  }

  listProviderPayouts(teacherId: string): Promise<ProviderPayout[]> {
    return this.payouts.find({ where: { teacherId }, order: { createdAt: 'DESC' } });
  }

  async requestProviderPayout(teacherId: string, amountMinor?: number): Promise<ProviderPayout> {
    const active = await this.payouts.findOne({
      where: [
        { teacherId, status: ProviderPayoutStatus.REQUESTED },
        { teacherId, status: ProviderPayoutStatus.PROCESSING },
      ],
    });
    if (active) throw new ConflictException('A payout request is already being processed');
    const earnings = await this.providerEarnings(teacherId);
    const amount = amountMinor ?? earnings.availableMinor;
    if (amount < 10000) throw new BadRequestException('A minimum ₹100 balance is required');
    if (amount > earnings.availableMinor) {
      throw new BadRequestException('Payout amount exceeds the available balance');
    }
    try {
      return await this.payouts.save(
        this.payouts.create({
          teacherId,
          amountMinor: amount,
          currency: earnings.currency,
          status: ProviderPayoutStatus.REQUESTED,
          reference: null,
          note: null,
        }),
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('A payout request is already being processed');
      }
      throw error;
    }
  }

  listPayoutQueue(): Promise<ProviderPayout[]> {
    return this.payouts.find({ order: { createdAt: 'DESC' } });
  }

  async updatePayout(
    id: string,
    status: ProviderPayoutStatus,
    reference?: string,
    note?: string,
  ): Promise<ProviderPayout> {
    const payout = await this.payouts.findOne({ where: { id } });
    if (!payout) throw new NotFoundException('Payout request not found');
    const transitions: Record<ProviderPayoutStatus, ProviderPayoutStatus[]> = {
      [ProviderPayoutStatus.REQUESTED]: [
        ProviderPayoutStatus.PROCESSING,
        ProviderPayoutStatus.PAID,
        ProviderPayoutStatus.REJECTED,
      ],
      [ProviderPayoutStatus.PROCESSING]: [
        ProviderPayoutStatus.PAID,
        ProviderPayoutStatus.REJECTED,
      ],
      [ProviderPayoutStatus.PAID]: [],
      [ProviderPayoutStatus.REJECTED]: [],
    };
    if (!transitions[payout.status].includes(status)) {
      throw new ConflictException(`A ${payout.status} payout cannot move to ${status}`);
    }
    if (status === ProviderPayoutStatus.PAID && !reference?.trim()) {
      throw new BadRequestException('A transfer reference is required to mark a payout paid');
    }
    payout.status = status;
    payout.reference = reference?.trim() || payout.reference;
    payout.note = note?.trim() || null;
    const saved = await this.payouts.save(payout);
    await this.db.query(
      `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
       VALUES ($1, 'payout', $2, $3, NULL)`,
      [
        payout.teacherId,
        `Payout ${status}`,
        status === ProviderPayoutStatus.PAID
          ? `₹${(payout.amountMinor / 100).toFixed(2)} was marked paid${payout.reference ? ` (${payout.reference})` : ''}.`
          : `Your payout request is now ${status}.`,
      ],
    );
    return saved;
  }

  async webhook(eventId: string, payload: WebhookPayload): Promise<void> {
    if (await this.events.findOne({ where: { eventId } })) return;
    const event = payload.event ?? 'unknown';
    const paymentEntity = payload.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id ?? payload.payload?.order?.entity?.id;
    if (orderId) {
      const payment = await this.payments.findOne({ where: { providerOrderId: orderId } });
      if (payment) {
        if (event === 'payment.captured' || event === 'order.paid') {
          const captured = await this.gateway.capturedPaymentForOrder(
            orderId,
            payment.amountMinor,
            payment.currency,
          );
          await this.markSucceeded(payment, captured.id);
        }
        if (event === 'payment.failed' && payment.status === PaymentStatus.PENDING) {
          payment.status = PaymentStatus.FAILED;
          payment.failureReason = paymentEntity?.error_description ?? 'Payment failed';
          await this.payments.save(payment);
        }
      }
    }
    await this.events.save(this.events.create({ eventId, event }));
  }

  async expirePending(): Promise<number> {
    const expired = await this.payments.find({
      where: [{ status: PaymentStatus.PENDING }, { status: PaymentStatus.FAILED }],
    });
    const due = expired.filter((payment) => payment.expiresAt < new Date());
    for (const payment of due) {
      await this.db.transaction(async (manager) => {
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = 'Payment window expired';
        await manager.save(payment);
        await manager.query(
          `UPDATE bookings SET status = $1, updated_at = now() WHERE id = $2 AND status = $3`,
          [BookingStatus.CANCELLED, payment.bookingId, BookingStatus.PENDING_PAYMENT],
        );
        await manager.query(
          `UPDATE class_reservations SET status = 'cancelled', updated_at = now() WHERE id = (SELECT reservation_id::uuid FROM bookings WHERE id = $1) AND status = 'reserved'`,
          [payment.bookingId],
        );
      });
    }
    return due.length;
  }

  private async bookingForUser(userId: string, bookingId: string): Promise<BookingRow> {
    const rows = await this.db.query<BookingRow[]>(
      `SELECT id, user_id, class_ref, amount_minor, currency, status FROM bookings WHERE id = $1 AND user_id = $2`,
      [bookingId, userId],
    );
    if (!rows[0]) throw new NotFoundException('Booking not found');
    return rows[0];
  }
  private async ownedPayment(userId: string, id: string): Promise<Payment> {
    const payment = await this.payments.findOne({ where: { id, userId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }
  private async markSucceeded(payment: Payment, providerRef: string): Promise<Payment> {
    if (payment.status === PaymentStatus.REFUNDED) return payment;
    payment.status = PaymentStatus.SUCCEEDED;
    payment.providerRef = providerRef;
    payment.failureReason = null;
    const saved = await this.payments.save(payment);
    await this.db.query(
      `UPDATE bookings SET status = $1, updated_at = now() WHERE id = $2 AND status = $3`,
      [BookingStatus.CONFIRMED, payment.bookingId, BookingStatus.PENDING_PAYMENT],
    );
    await this.db.query(
      `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
       SELECT c.teacher_id, 'booking', 'New paid booking',
              b.child_name || ' is booked for ' || b.title || '.', NULL
       FROM bookings b JOIN class_offerings c ON c.id::text = b.class_ref
       WHERE b.id = $1`,
      [payment.bookingId],
    );
    return saved;
  }
}
