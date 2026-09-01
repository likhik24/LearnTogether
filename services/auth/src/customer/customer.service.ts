import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { BookingStatus, RescheduleRequestStatus, WaitlistStatus } from '@learn-and-build/types';
import { ChildProfile } from './entities/child-profile.entity';
import { SavedClass } from './entities/saved-class.entity';
import { Booking } from './entities/booking.entity';
import { CustomerNotification } from './entities/customer-notification.entity';
import { SchedulingGateway } from './scheduling.gateway';
import { PaymentsGateway } from './payments.gateway';
import { ClassWaitlist } from './entities/class-waitlist.entity';
import { BookingRescheduleRequest } from './entities/booking-reschedule-request.entity';

const AVATAR_COLORS = ['#7c5cff', '#f0871f', '#2fb37f', '#d1477a', '#3f7ad1'];

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(ChildProfile)
    private readonly children: Repository<ChildProfile>,
    @InjectRepository(SavedClass)
    private readonly saved: Repository<SavedClass>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(CustomerNotification)
    private readonly notifications: Repository<CustomerNotification>,
    @InjectRepository(ClassWaitlist)
    private readonly waitlists: Repository<ClassWaitlist>,
    @InjectRepository(BookingRescheduleRequest)
    private readonly reschedules: Repository<BookingRescheduleRequest>,
    private readonly scheduling: SchedulingGateway,
    private readonly payments: PaymentsGateway,
    private readonly db: DataSource,
  ) {}

  // --- Children ---
  listChildren(userId: string): Promise<ChildProfile[]> {
    return this.children.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async createChild(
    userId: string,
    input: { name: string; birthDate?: string; interests?: string[]; avatarColor?: string },
    index = 0,
  ): Promise<ChildProfile> {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Child name is required');
    assertValidBirthDate(input.birthDate);
    const child = this.children.create({
      userId,
      name,
      birthDate: input.birthDate ?? null,
      interests: input.interests ?? [],
      avatarColor: input.avatarColor ?? AVATAR_COLORS[index % AVATAR_COLORS.length],
    });
    const savedChild = await this.children.save(child);
    await this.notify(
      userId,
      'profile',
      `${savedChild.name}'s profile is ready`,
      'Recommendations will improve as you add interests and save classes.',
    );
    return savedChild;
  }

  async updateChild(
    userId: string,
    id: string,
    input: { name?: string; birthDate?: string; interests?: string[]; avatarColor?: string },
  ): Promise<ChildProfile> {
    const child = await this.children.findOne({ where: { id, userId } });
    if (!child) throw new NotFoundException('Child profile not found');
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('Child name is required');
      child.name = name;
    }
    if (input.birthDate !== undefined) {
      assertValidBirthDate(input.birthDate);
      child.birthDate = input.birthDate || null;
    }
    if (input.interests !== undefined) child.interests = input.interests;
    if (input.avatarColor !== undefined) child.avatarColor = input.avatarColor;
    return this.children.save(child);
  }

  // --- Saved classes ---
  listSaved(userId: string): Promise<SavedClass[]> {
    return this.saved.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async saveClass(userId: string, authorization: string, classRef: string): Promise<SavedClass> {
    const existing = await this.saved.findOne({ where: { userId, classRef } });
    if (existing) return existing;
    const offering = await this.scheduling.getClass(authorization, classRef);
    return this.saved.save(this.saved.create({ userId, classRef, title: offering.activity }));
  }

  async removeSaved(userId: string, classRef: string): Promise<void> {
    await this.saved.delete({ userId, classRef });
  }

  // --- Bookings ---
  listBookings(userId: string): Promise<Booking[]> {
    return this.bookings.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createBooking(
    userId: string,
    authorization: string,
    input: {
      childId: string;
      childIds?: string[];
      classRef: string;
      classSlug?: string;
      reservationId?: string;
      title: string;
      scheduledStart: string;
      amountMinor?: number;
      currency?: string;
    },
  ): Promise<Booking> {
    await this.payments.assertReady();
    const requestedIds = [...new Set(input.childIds?.length ? input.childIds : [input.childId])];
    const selectedChildren = await this.children.find({ where: { id: In(requestedIds), userId } });
    if (selectedChildren.length !== requestedIds.length)
      throw new BadRequestException('Select child profiles that belong to your account');
    const child = selectedChildren[0];
    if (selectedChildren.some((item) => !item.birthDate))
      throw new BadRequestException('Add every selected child’s birthday before booking');

    // Class identity, title and price are authoritative Scheduling data. Never
    // trust a browser-provided snapshot for a booking record.
    const offering = await this.scheduling.getClass(authorization, input.classRef);
    const scheduledStart = new Date(input.scheduledStart);
    const ineligible = selectedChildren.find((item) => {
      const age = ageOnDate(item.birthDate!, scheduledStart);
      return age < offering.ageMin || age > offering.ageMax;
    });
    if (ineligible) {
      const childAge = ageOnDate(ineligible.birthDate!, scheduledStart);
      throw new BadRequestException(
        `${ineligible.name} is ${childAge} on this date; this class is for ages ${offering.ageMin}–${offering.ageMax}`,
      );
    }
    const existing = await this.bookings.findOne({
      where: {
        userId,
        classRef: offering.id,
        scheduledStart,
        status: In([BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED]),
      },
    });
    if (existing) {
      if (existing.childId === child.id && existing.seatCount === selectedChildren.length) {
        return existing;
      }
      throw new ConflictException(
        'This class time is already reserved. Cancel the existing booking before changing children.',
      );
    }

    const reservation = await this.scheduling.reserve(
      authorization,
      offering.id,
      input.scheduledStart,
      selectedChildren.length,
    );
    let booking: Booking;
    try {
      booking = await this.db.transaction(async (manager) => {
        const saved = await manager.save(
          this.bookings.create({
            userId,
            classRef: offering.id,
            classSlug: offering.slug ?? input.classSlug ?? null,
            reservationId: reservation.id,
            childId: child.id,
            childName: selectedChildren.map((item) => item.name).join(', '),
            seatCount: selectedChildren.length,
            title: offering.activity,
            scheduledStart,
            amountMinor: offering.priceMinor * selectedChildren.length,
            currency: offering.currency,
            status: BookingStatus.PENDING_PAYMENT,
          }),
        );
        await manager.query(
          `UPDATE class_waitlists SET status = 'joined', offer_expires_at = NULL, updated_at = now()
           WHERE user_id = $1 AND class_id = $2 AND occurrence_start = $3
             AND child_id = ANY($4::uuid[]) AND status IN ('waiting', 'offered')`,
          [userId, offering.id, scheduledStart, requestedIds],
        );
        return saved;
      });
    } catch (error) {
      await this.scheduling
        .release(authorization, offering.id, reservation.id)
        .catch(() => undefined);
      throw error;
    }
    await this.notify(
      userId,
      'booking',
      `${booking.title} is awaiting payment`,
      'Complete payment within 20 minutes to confirm this trial-class spot.',
    );
    return booking;
  }

  async cancelBooking(userId: string, _authorization: string, id: string): Promise<Booking> {
    const booking = await this.bookings.findOne({ where: { id, userId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === BookingStatus.CANCELLED) return booking;
    if (booking.scheduledStart <= new Date()) {
      throw new ConflictException('A class cannot be cancelled after it starts');
    }
    return this.db.transaction(async (manager) => {
      if (booking.reservationId) {
        await manager.query(
          `UPDATE class_reservations SET status = 'cancelled', updated_at = now()
           WHERE id::text = $1 AND user_id = $2 AND status = 'reserved'`,
          [booking.reservationId, userId],
        );
      }
      booking.status = BookingStatus.CANCELLED;
      const cancelled = await manager.save(booking);
      await manager.query(
        `INSERT INTO operation_jobs
           (type, payload, status, attempts, max_attempts, next_attempt_at, idempotency_key)
         VALUES ('refund_booking', jsonb_build_object('bookingId', $1::text),
                 'pending', 0, 8, now(), 'refund-booking:' || $1::text)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [booking.id],
      );
      await manager.query(
        `INSERT INTO operation_jobs
           (type, payload, status, attempts, max_attempts, next_attempt_at, idempotency_key)
         VALUES ('promote_waitlist', jsonb_build_object('classId', $1::text, 'occurrenceStart', $2::text),
                 'pending', 0, 8, now(), 'promote-waitlist-booking:' || $3::text)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [booking.classRef, booking.scheduledStart.toISOString(), booking.id],
      );
      await manager.query(
        `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
         VALUES ($1, 'booking', $2, $3, NULL)`,
        [
          userId,
          `${booking.title} cancelled`,
          'The booking was removed and any captured payment has been queued for refund.',
        ],
      );
      await manager.query(
        `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
         SELECT teacher_id, 'booking', $2, $3, NULL
         FROM class_offerings WHERE id::text = $1`,
        [
          booking.classRef,
          `${booking.title} booking cancelled`,
          `${booking.childName ?? 'A learner'} will no longer attend this session.`,
        ],
      );
      return cancelled;
    });
  }

  // --- Notifications ---
  listNotifications(userId: string, unreadOnly = false): Promise<CustomerNotification[]> {
    return this.notifications.find({
      where: unreadOnly ? { userId, readAt: IsNull() } : { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async notify(
    userId: string,
    kind: string,
    title: string,
    body: string,
  ): Promise<CustomerNotification> {
    return this.notifications.save(
      this.notifications.create({ userId, kind, title, body, readAt: null }),
    );
  }

  async markNotificationRead(userId: string, id: string): Promise<CustomerNotification> {
    const n = await this.notifications.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    n.readAt = n.readAt ?? new Date();
    return this.notifications.save(n);
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.notifications.update({ userId, readAt: IsNull() }, { readAt: new Date() });
  }

  async listWaitlist(userId: string): Promise<Array<{ entry: ClassWaitlist; position: number }>> {
    const entries = await this.waitlists.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return Promise.all(
      entries.map(async (entry) => {
        if (entry.status !== WaitlistStatus.WAITING) return { entry, position: 0 };
        const rows = await this.db.query<Array<{ position: string }>>(
          `SELECT COUNT(*)::text AS position FROM class_waitlists
           WHERE class_id = $1 AND occurrence_start = $2 AND status = 'waiting'
             AND created_at <= $3`,
          [entry.classId, entry.occurrenceStart, entry.createdAt],
        );
        return { entry, position: Number(rows[0]?.position ?? 0) };
      }),
    );
  }

  async joinWaitlist(
    userId: string,
    authorization: string,
    input: { childId: string; classId: string; occurrenceStart: string },
  ): Promise<{ entry: ClassWaitlist; position: number }> {
    const child = await this.children.findOne({ where: { id: input.childId, userId } });
    if (!child)
      throw new BadRequestException('Select a child profile that belongs to your account');
    const start = new Date(input.occurrenceStart);
    if (Number.isNaN(start.getTime()) || start <= new Date()) {
      throw new BadRequestException('Choose a future class session');
    }
    const availability = await this.scheduling.availability(authorization, input.classId, 120);
    const occurrence = availability.find((item) => item.start === start.toISOString());
    if (!occurrence) throw new BadRequestException('That class session is no longer available');
    if (occurrence.seatsAvailable > 0) {
      throw new ConflictException('A seat is available now; book the class instead');
    }
    let entry = await this.waitlists.findOne({
      where: {
        userId,
        classId: input.classId,
        occurrenceStart: start,
        childId: child.id,
        status: In([WaitlistStatus.WAITING, WaitlistStatus.OFFERED]),
      },
    });
    if (!entry) {
      entry = await this.waitlists.save(
        this.waitlists.create({
          userId,
          classId: input.classId,
          occurrenceStart: start,
          childId: child.id,
          childName: child.name,
          status: WaitlistStatus.WAITING,
          offerExpiresAt: null,
        }),
      );
      await this.notify(
        userId,
        'waitlist',
        `${child.name} joined the waitlist`,
        'We will notify you if a seat becomes available.',
      );
    }
    const listed = await this.listWaitlist(userId);
    return listed.find((item) => item.entry.id === entry!.id) ?? { entry, position: 0 };
  }

  async leaveWaitlist(userId: string, id: string): Promise<ClassWaitlist> {
    const entry = await this.waitlists.findOne({ where: { id, userId } });
    if (!entry) throw new NotFoundException('Waitlist entry not found');
    entry.status = WaitlistStatus.CANCELLED;
    entry.offerExpiresAt = null;
    return this.waitlists.save(entry);
  }

  listRescheduleRequests(userId: string): Promise<BookingRescheduleRequest[]> {
    return this.reschedules.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async requestReschedule(
    userId: string,
    authorization: string,
    bookingId: string,
    input: { requestedStart: string; reason?: string },
  ): Promise<BookingRescheduleRequest> {
    const booking = await this.bookings.findOne({
      where: { id: bookingId, userId, status: BookingStatus.CONFIRMED },
    });
    if (!booking || booking.scheduledStart <= new Date()) {
      throw new NotFoundException('Upcoming confirmed booking not found');
    }
    const requested = new Date(input.requestedStart);
    if (Number.isNaN(requested.getTime()) || requested <= new Date()) {
      throw new BadRequestException('Choose a future session');
    }
    if (requested.toISOString() === booking.scheduledStart.toISOString()) {
      throw new BadRequestException('Choose a different session');
    }
    const availability = await this.scheduling.availability(authorization, booking.classRef, 120);
    const occurrence = availability.find((item) => item.start === requested.toISOString());
    if (!occurrence || occurrence.seatsAvailable < booking.seatCount) {
      throw new ConflictException('The requested session does not have enough seats');
    }
    const existing = await this.reschedules.findOne({
      where: { bookingId, status: RescheduleRequestStatus.REQUESTED },
    });
    if (existing) return existing;
    const saved = await this.reschedules.save(
      this.reschedules.create({
        bookingId,
        classId: booking.classRef,
        userId,
        childName: booking.childName,
        currentStart: booking.scheduledStart,
        requestedStart: requested,
        reason: input.reason?.trim() || null,
        status: RescheduleRequestStatus.REQUESTED,
        providerNote: null,
      }),
    );
    await this.db.query(
      `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
       SELECT teacher_id, 'reschedule', $2, $3, NULL FROM class_offerings WHERE id = $1`,
      [
        booking.classRef,
        `Reschedule requested for ${booking.title}`,
        `${booking.childName ?? 'A learner'} requested another available session.`,
      ],
    );
    return saved;
  }

  async exportData(userId: string): Promise<Record<string, unknown>> {
    const rows = await Promise.all([
      this.db.query(
        `SELECT id, email, display_name, role, provider, email_verified_at, created_at FROM users WHERE id = $1`,
        [userId],
      ),
      this.db.query(`SELECT * FROM child_profiles WHERE user_id = $1 ORDER BY created_at`, [
        userId,
      ]),
      this.db.query(`SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at`, [userId]),
      this.db.query(`SELECT * FROM saved_classes WHERE user_id = $1 ORDER BY created_at`, [userId]),
      this.db.query(`SELECT * FROM class_reviews WHERE user_id = $1 ORDER BY created_at`, [userId]),
      this.db.query(`SELECT * FROM class_waitlists WHERE user_id = $1 ORDER BY created_at`, [
        userId,
      ]),
      this.db.query(
        `SELECT * FROM booking_reschedule_requests WHERE user_id = $1 ORDER BY created_at`,
        [userId],
      ),
      this.db.query(`SELECT * FROM customer_notifications WHERE user_id = $1 ORDER BY created_at`, [
        userId,
      ]),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      account: rows[0][0] ?? null,
      children: rows[1],
      bookings: rows[2],
      savedClasses: rows[3],
      reviews: rows[4],
      waitlists: rows[5],
      rescheduleRequests: rows[6],
      notifications: rows[7],
    };
  }

  async accountDeletionStatus(userId: string): Promise<{
    requestedAt: string | null;
    scheduledFor: string | null;
  }> {
    const rows = await this.db.query<Array<{ deletion_requested_at: Date | null }>>(
      `SELECT deletion_requested_at FROM users WHERE id = $1`,
      [userId],
    );
    const requestedAt = rows[0]?.deletion_requested_at ?? null;
    return {
      requestedAt: requestedAt?.toISOString() ?? null,
      scheduledFor: requestedAt
        ? new Date(requestedAt.getTime() + 7 * 86_400_000).toISOString()
        : null,
    };
  }

  async requestAccountDeletion(userId: string): Promise<{
    requestedAt: string | null;
    scheduledFor: string | null;
  }> {
    const upcoming = await this.db.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS(SELECT 1 FROM bookings WHERE user_id = $1 AND status = 'confirmed'
       AND scheduled_start > now()) AS exists`,
      [userId],
    );
    if (upcoming[0]?.exists) {
      throw new ConflictException(
        'Cancel or complete upcoming bookings before deleting the account',
      );
    }
    await this.db.transaction(async (manager) => {
      await manager.query(
        `UPDATE users SET deletion_requested_at = now(), updated_at = now() WHERE id = $1`,
        [userId],
      );
      await manager.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
      await manager.query(
        `INSERT INTO operation_jobs
           (type, payload, status, attempts, max_attempts, next_attempt_at, idempotency_key)
         VALUES ('delete_account', jsonb_build_object('userId', $1::text),
                 'pending', 0, 8, now() + interval '7 days', 'delete-account:' || $1::text)
         ON CONFLICT (idempotency_key) DO UPDATE SET status = 'pending',
           next_attempt_at = EXCLUDED.next_attempt_at, attempts = 0, last_error = NULL`,
        [userId],
      );
    });
    return this.accountDeletionStatus(userId);
  }

  async cancelAccountDeletion(userId: string): Promise<void> {
    await this.db.transaction(async (manager) => {
      await manager.query(
        `UPDATE users SET deletion_requested_at = NULL, updated_at = now() WHERE id = $1`,
        [userId],
      );
      await manager.query(
        `UPDATE operation_jobs SET status = 'completed', updated_at = now()
         WHERE idempotency_key = $1 AND status = 'pending'`,
        [`delete-account:${userId}`],
      );
    });
  }
}

function assertValidBirthDate(value?: string): void {
  if (!value) return;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Birthday is invalid');
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  if (date > today) throw new BadRequestException('Birthday cannot be in the future');
}

function ageOnDate(birthDate: string, occurrence: Date): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = occurrence.getUTCFullYear() - year;
  const occurrenceMonth = occurrence.getUTCMonth() + 1;
  const occurrenceDay = occurrence.getUTCDate();
  if (occurrenceMonth < month || (occurrenceMonth === month && occurrenceDay < day)) age -= 1;
  return age;
}
