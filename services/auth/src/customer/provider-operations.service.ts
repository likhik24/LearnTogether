import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AttendanceStatus,
  BookingStatus,
  OccurrenceStatus,
  RescheduleRequestStatus,
  type BookingRescheduleRequestDto,
  type ClassOccurrence,
  type ClassReviewDto,
  type ClassTiming,
  type ProviderRosterEntryDto,
  type ProviderSessionDto,
} from '@learn-and-build/types';
import { Booking } from './entities/booking.entity';
import { ClassReview } from './entities/class-review.entity';
import { CustomerNotification } from './entities/customer-notification.entity';
import { BookingRescheduleRequest } from './entities/booking-reschedule-request.entity';

interface OfferingRow {
  id: string;
  teacher_id: string;
  activity: string;
  duration_minutes: number;
  seats: number;
  timings: ClassTiming[];
}

interface OverrideRow {
  class_id: string;
  original_start: Date;
  replacement_start: Date | null;
  status: OccurrenceStatus;
  reason: string | null;
}

interface ReservedRow {
  class_id: string;
  occurrence_start: Date;
  seats: string;
}

@Injectable()
export class ProviderOperationsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(ClassReview)
    private readonly reviews: Repository<ClassReview>,
    @InjectRepository(CustomerNotification)
    private readonly notifications: Repository<CustomerNotification>,
    @InjectRepository(BookingRescheduleRequest)
    private readonly reschedules: Repository<BookingRescheduleRequest>,
    private readonly db: DataSource,
  ) {}

  async listSessions(teacherId: string, days = 60): Promise<ProviderSessionDto[]> {
    const safeDays = Math.min(120, Math.max(7, days));
    const from = new Date(Date.now() - 14 * 86_400_000);
    const offerings = await this.db.query<OfferingRow[]>(
      `SELECT id, teacher_id, activity, duration_minutes, seats, timings
       FROM class_offerings
       WHERE teacher_id = $1 AND status <> 'unpublished'
       ORDER BY created_at DESC`,
      [teacherId],
    );
    if (!offerings.length) return [];
    const ids = offerings.map((item) => item.id);
    const horizon = new Date(Date.now() + safeDays * 86_400_000);
    const [overrides, reservations] = await Promise.all([
      this.db.query<OverrideRow[]>(
        `SELECT class_id, original_start, replacement_start, status, reason
         FROM class_occurrence_overrides
         WHERE class_id = ANY($1::uuid[]) AND original_start BETWEEN $2 AND $3`,
        [ids, from, horizon],
      ),
      this.db.query<ReservedRow[]>(
        `SELECT class_id, occurrence_start, COALESCE(SUM(seats), 0)::text AS seats
         FROM class_reservations
         WHERE class_id = ANY($1::uuid[]) AND status = 'reserved'
           AND occurrence_start BETWEEN $2 AND $3
         GROUP BY class_id, occurrence_start`,
        [ids, from, horizon],
      ),
    ]);
    const overridesByKey = new Map(
      overrides.map((item) => [`${item.class_id}:${item.original_start.toISOString()}`, item]),
    );
    const seatsByKey = new Map(
      reservations.map((item) => [
        `${item.class_id}:${item.occurrence_start.toISOString()}`,
        Number(item.seats),
      ]),
    );

    return offerings
      .flatMap((offering) =>
        generateOccurrences(
          offering.timings ?? [],
          offering.duration_minutes,
          offering.seats,
          from,
          safeDays + 14,
        ).map((occurrence): ProviderSessionDto => {
          const override = overridesByKey.get(`${offering.id}:${occurrence.start}`);
          const start = override?.replacement_start?.toISOString() ?? occurrence.start;
          const end = new Date(
            new Date(start).getTime() + offering.duration_minutes * 60_000,
          ).toISOString();
          const bookedSeats = seatsByKey.get(`${offering.id}:${start}`) ?? 0;
          return {
            classId: offering.id,
            classTitle: offering.activity,
            originalStart: occurrence.start,
            start,
            end,
            status: override?.status ?? OccurrenceStatus.SCHEDULED,
            reason: override?.reason ?? null,
            seatsTotal: offering.seats,
            seatsAvailable: Math.max(0, offering.seats - bookedSeats),
            bookedSeats,
          };
        }),
      )
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  async roster(
    teacherId: string,
    classId: string,
    start: string,
  ): Promise<ProviderRosterEntryDto[]> {
    const occurrence = parseDate(start, 'Session date is invalid');
    await this.ownedOffering(teacherId, classId);
    const rows = await this.db.query<
      Array<Omit<ProviderRosterEntryDto, 'scheduledStart'> & { scheduledStart: Date | string }>
    >(
      `SELECT b.id AS "bookingId", b.class_ref AS "classId",
              u.display_name AS "parentName", u.email AS "parentEmail",
              b.child_id AS "childId", b.child_name AS "childName",
              b.scheduled_start AS "scheduledStart", b.status AS "bookingStatus",
              p.status AS "paymentStatus", b.attendance_status AS "attendanceStatus",
              b.attendance_notes AS "attendanceNotes"
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN payments p ON p.booking_id = b.id
       WHERE b.class_ref = $1 AND b.scheduled_start = $2
       ORDER BY b.created_at ASC`,
      [classId, occurrence],
    );
    return rows.map((row) => ({
      ...row,
      scheduledStart: new Date(row.scheduledStart).toISOString(),
    }));
  }

  async markAttendance(
    teacherId: string,
    bookingId: string,
    status: AttendanceStatus,
    notes?: string,
  ): Promise<ProviderRosterEntryDto> {
    const rows = await this.db.query<Array<{ class_ref: string; scheduled_start: Date }>>(
      `SELECT b.class_ref, b.scheduled_start
       FROM bookings b JOIN class_offerings c ON c.id::text = b.class_ref
       WHERE b.id = $1 AND c.teacher_id = $2 AND b.status = $3`,
      [bookingId, teacherId, BookingStatus.CONFIRMED],
    );
    const owned = rows[0];
    if (!owned) throw new NotFoundException('Confirmed roster booking not found');
    if (owned.scheduled_start > new Date()) {
      throw new ConflictException('Attendance can be marked after the session starts');
    }
    await this.bookings.update(
      { id: bookingId },
      { attendanceStatus: status, attendanceNotes: notes?.trim() || null },
    );
    const roster = await this.roster(
      teacherId,
      owned.class_ref,
      owned.scheduled_start.toISOString(),
    );
    return roster.find((item) => item.bookingId === bookingId)!;
  }

  async changeOccurrence(
    teacherId: string,
    classId: string,
    input: { originalStart: string; newStart?: string; reason?: string },
  ): Promise<ProviderSessionDto> {
    const offering = await this.ownedOffering(teacherId, classId);
    const original = parseDate(input.originalStart, 'Original session date is invalid');
    if (original <= new Date()) throw new ConflictException('Past sessions cannot be changed');
    const generated = generateOccurrences(
      offering.timings ?? [],
      offering.duration_minutes,
      offering.seats,
      new Date(),
      120,
    );
    if (!generated.some((item) => item.start === original.toISOString())) {
      throw new BadRequestException('The selected session is not part of this class schedule');
    }
    const replacement = input.newStart
      ? parseDate(input.newStart, 'Replacement session date is invalid')
      : null;
    if (replacement && replacement <= new Date()) {
      throw new ConflictException('The replacement session must be in the future');
    }
    if (
      replacement &&
      replacement.toISOString() !== original.toISOString() &&
      generated.some((item) => item.start === replacement.toISOString())
    ) {
      throw new ConflictException('Choose a time that is not already a scheduled class session');
    }

    const affected = await this.db.query<Array<{ id: string }>>(
      `SELECT id FROM bookings
       WHERE class_ref = $1 AND scheduled_start = $2
         AND status IN ('pending_payment', 'confirmed')`,
      [classId, original],
    );
    await this.db.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO class_occurrence_overrides
           (class_id, original_start, replacement_start, status, reason, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (class_id, original_start) DO UPDATE SET
           replacement_start = EXCLUDED.replacement_start,
           status = EXCLUDED.status,
           reason = EXCLUDED.reason,
           updated_at = now()`,
        [
          classId,
          original,
          replacement,
          replacement ? OccurrenceStatus.RESCHEDULED : OccurrenceStatus.CANCELLED,
          input.reason?.trim() || null,
          teacherId,
        ],
      );
      if (replacement) {
        const capacity = await manager.query<
          Array<{ replacement_seats: string; moving_seats: string }>
        >(
          `SELECT
             COALESCE(SUM(seats) FILTER (WHERE occurrence_start = $2), 0)::text AS replacement_seats,
             COALESCE(SUM(seats) FILTER (WHERE occurrence_start = $3), 0)::text AS moving_seats
           FROM class_reservations
           WHERE class_id = $1 AND status = 'reserved'
             AND occurrence_start IN ($2, $3)`,
          [classId, replacement, original],
        );
        if (
          Number(capacity[0]?.replacement_seats ?? 0) + Number(capacity[0]?.moving_seats ?? 0) >
          offering.seats
        ) {
          throw new ConflictException('The replacement session does not have enough seats');
        }
        const conflicts = await manager.query<Array<{ count: string }>>(
          `SELECT COUNT(*)::text AS count FROM bookings existing
           JOIN bookings moving ON moving.user_id = existing.user_id
           WHERE moving.class_ref = $1 AND moving.scheduled_start = $2
             AND existing.class_ref = $1 AND existing.scheduled_start = $3
             AND existing.status IN ('pending_payment', 'confirmed')`,
          [classId, original, replacement],
        );
        if (Number(conflicts[0]?.count ?? 0) > 0) {
          throw new ConflictException('A family is already booked into the replacement session');
        }
        await manager.query(
          `UPDATE class_reservations SET occurrence_start = $1, updated_at = now()
           WHERE class_id = $2 AND occurrence_start = $3 AND status = 'reserved'`,
          [replacement, classId, original],
        );
        await manager.query(
          `UPDATE bookings SET scheduled_start = $1, updated_at = now()
           WHERE class_ref = $2 AND scheduled_start = $3
             AND status IN ('pending_payment', 'confirmed')`,
          [replacement, classId, original],
        );
      } else {
        await manager.query(
          `UPDATE class_reservations SET status = 'cancelled', updated_at = now()
           WHERE class_id = $1 AND occurrence_start = $2 AND status = 'reserved'`,
          [classId, original],
        );
        await manager.query(
          `UPDATE bookings SET status = 'cancelled', updated_at = now()
           WHERE class_ref = $1 AND scheduled_start = $2
             AND status IN ('pending_payment', 'confirmed')`,
          [classId, original],
        );
        for (const booking of affected) {
          await manager.query(
            `INSERT INTO operation_jobs
               (type, payload, status, attempts, max_attempts, next_attempt_at, idempotency_key)
             VALUES ('refund_booking', jsonb_build_object('bookingId', $1::text),
                     'pending', 0, 8, now(), 'refund-booking:' || $1::text)
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [booking.id],
          );
        }
      }
      const title = replacement
        ? `${offering.activity} rescheduled`
        : `${offering.activity} cancelled`;
      const body = replacement
        ? `Your class now starts ${replacement.toISOString()}. ${input.reason?.trim() || ''}`.trim()
        : `The provider cancelled this session. Any captured payment has been queued for refund. ${input.reason?.trim() || ''}`.trim();
      await manager.query(
        `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
         SELECT DISTINCT user_id, 'schedule', $3, $4, NULL
         FROM bookings WHERE class_ref = $1 AND scheduled_start = $2`,
        [classId, replacement ?? original, title, body],
      );
    });

    const sessions = await this.listSessions(teacherId, 120);
    return sessions.find(
      (item) => item.classId === classId && item.originalStart === original.toISOString(),
    )!;
  }

  async listRescheduleRequests(teacherId: string): Promise<BookingRescheduleRequestDto[]> {
    const rows = await this.db.query<BookingRescheduleRequest[]>(
      `SELECT r.id, r.booking_id AS "bookingId", r.class_id AS "classId",
              r.user_id AS "userId", r.child_name AS "childName",
              r.current_start AS "currentStart", r.requested_start AS "requestedStart",
              r.reason, r.status, r.provider_note AS "providerNote",
              r.created_at AS "createdAt", r.updated_at AS "updatedAt"
       FROM booking_reschedule_requests r
       JOIN class_offerings c ON c.id = r.class_id
       WHERE c.teacher_id = $1 ORDER BY r.created_at DESC`,
      [teacherId],
    );
    return rows.map((row) => Object.assign(new BookingRescheduleRequest(), row).toDto());
  }

  async decideReschedule(
    teacherId: string,
    id: string,
    status: RescheduleRequestStatus.APPROVED | RescheduleRequestStatus.DECLINED,
    note?: string,
  ): Promise<BookingRescheduleRequestDto> {
    return this.db.transaction(async (manager) => {
      const rows = await manager.query<
        Array<BookingRescheduleRequest & { seats: number; bookingSeats: number; title: string }>
      >(
        `SELECT r.id, r.booking_id AS "bookingId", r.class_id AS "classId",
                r.user_id AS "userId", r.child_name AS "childName",
                r.current_start AS "currentStart", r.requested_start AS "requestedStart",
                r.reason, r.status, r.provider_note AS "providerNote",
                r.created_at AS "createdAt", r.updated_at AS "updatedAt",
                c.seats, b.seat_count AS "bookingSeats", c.activity AS title
         FROM booking_reschedule_requests r
         JOIN class_offerings c ON c.id = r.class_id
         JOIN bookings b ON b.id = r.booking_id
         WHERE r.id = $1 AND c.teacher_id = $2 FOR UPDATE`,
        [id, teacherId],
      );
      const request = rows[0];
      if (!request) throw new NotFoundException('Reschedule request not found');
      if (request.status !== RescheduleRequestStatus.REQUESTED) {
        throw new ConflictException('This reschedule request has already been decided');
      }
      if (status === RescheduleRequestStatus.APPROVED) {
        if (new Date(request.requestedStart) <= new Date()) {
          throw new ConflictException('The requested session has already started');
        }
        const capacity = await manager.query<Array<{ reserved: string }>>(
          `SELECT COALESCE(SUM(seats), 0)::text AS reserved FROM class_reservations
           WHERE class_id = $1 AND occurrence_start = $2 AND status = 'reserved'`,
          [request.classId, request.requestedStart],
        );
        if (Number(capacity[0]?.reserved ?? 0) + request.bookingSeats > request.seats) {
          throw new ConflictException('The requested session is now full');
        }
        const conflicts = await manager.query<Array<{ exists: boolean }>>(
          `SELECT EXISTS(SELECT 1 FROM bookings
           WHERE user_id = $1 AND class_ref = $2 AND scheduled_start = $3
             AND id <> $4 AND status IN ('pending_payment', 'confirmed')) AS exists`,
          [request.userId, request.classId, request.requestedStart, request.bookingId],
        );
        if (conflicts[0]?.exists) {
          throw new ConflictException('This family already has the requested session booked');
        }
        const movedReservations = await manager.query<Array<{ id: string }>>(
          `UPDATE class_reservations SET occurrence_start = $1, updated_at = now()
           WHERE id::text = (SELECT reservation_id FROM bookings WHERE id = $2)
             AND status = 'reserved' RETURNING id`,
          [request.requestedStart, request.bookingId],
        );
        if (!movedReservations.length) {
          throw new ConflictException('The original seat reservation is no longer active');
        }
        await manager.query(
          `UPDATE bookings SET scheduled_start = $1, updated_at = now()
           WHERE id = $2 AND status = 'confirmed'`,
          [request.requestedStart, request.bookingId],
        );
      }
      const updated = await manager.query<BookingRescheduleRequest[]>(
        `UPDATE booking_reschedule_requests
         SET status = $2, provider_note = $3, updated_at = now()
         WHERE id = $1
         RETURNING id, booking_id AS "bookingId", class_id AS "classId",
                   user_id AS "userId", child_name AS "childName",
                   current_start AS "currentStart", requested_start AS "requestedStart",
                   reason, status, provider_note AS "providerNote",
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [id, status, note?.trim() || null],
      );
      await manager.query(
        `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
         VALUES ($1, 'reschedule', $2, $3, NULL)`,
        [
          request.userId,
          `${request.title} reschedule ${status}`,
          status === RescheduleRequestStatus.APPROVED
            ? `Your booking now starts ${new Date(request.requestedStart).toLocaleString('en-IN')}.`
            : note?.trim() || 'The provider could not approve the requested session.',
        ],
      );
      return Object.assign(new BookingRescheduleRequest(), updated[0]).toDto();
    });
  }

  async bulkAttendance(
    teacherId: string,
    bookingIds: string[],
    status: AttendanceStatus,
    notes?: string,
  ): Promise<ProviderRosterEntryDto[]> {
    if (!bookingIds.length) throw new BadRequestException('Choose at least one learner');
    const rows = await this.db.query<
      Array<{ id: string; class_ref: string; scheduled_start: Date }>
    >(
      `SELECT b.id, b.class_ref, b.scheduled_start FROM bookings b
       JOIN class_offerings c ON b.class_ref = c.id::text
       WHERE c.teacher_id = $1 AND b.id = ANY($2::uuid[])
         AND b.status = 'confirmed' AND b.scheduled_start <= now()`,
      [teacherId, bookingIds],
    );
    if (rows.length !== bookingIds.length) {
      throw new ConflictException('Some learners are not eligible for attendance yet');
    }
    if (
      new Set(rows.map((item) => `${item.class_ref}:${item.scheduled_start.toISOString()}`))
        .size !== 1
    ) {
      throw new BadRequestException('Bulk attendance must contain one class session');
    }
    await this.db.query(
      `UPDATE bookings SET attendance_status = $2, attendance_notes = $3, updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [bookingIds, status, notes?.trim() || null],
    );
    return this.roster(teacherId, rows[0].class_ref, rows[0].scheduled_start.toISOString());
  }

  async messageSession(
    teacherId: string,
    classId: string,
    start: string,
    message: string,
  ): Promise<{ recipients: number }> {
    await this.ownedOffering(teacherId, classId);
    const occurrence = parseDate(start, 'Session date is invalid');
    const result = await this.db.query<Array<{ user_id: string }>>(
      `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
       SELECT DISTINCT b.user_id, 'provider_message', c.activity || ' update', $3, NULL
       FROM bookings b JOIN class_offerings c ON c.id::text = b.class_ref
       WHERE b.class_ref = $1 AND b.scheduled_start = $2 AND b.status = 'confirmed'
       RETURNING user_id`,
      [classId, occurrence, message.trim()],
    );
    return { recipients: result.length };
  }

  async listReviewsForCustomer(userId: string): Promise<ClassReviewDto[]> {
    const rows = await this.db.query<Array<ClassReview & { parent_name: string }>>(
      `SELECT r.*, u.display_name AS parent_name
       FROM class_reviews r JOIN users u ON u.id = r.user_id
       WHERE r.user_id = $1 ORDER BY r.created_at DESC`,
      [userId],
    );
    return rows.map((row) => reviewDto(row, row.parent_name));
  }

  async reviewBooking(
    userId: string,
    bookingId: string,
    rating: number,
    comment?: string,
  ): Promise<ClassReviewDto> {
    const rows = await this.db.query<
      Array<{
        class_ref: string;
        scheduled_start: Date;
        duration_minutes: number;
        parent_name: string;
        teacher_id: string;
        activity: string;
      }>
    >(
      `SELECT b.class_ref, b.scheduled_start, c.duration_minutes,
              u.display_name AS parent_name, c.teacher_id, c.activity
       FROM bookings b
       JOIN class_offerings c ON c.id::text = b.class_ref
       JOIN users u ON u.id = b.user_id
       WHERE b.id = $1 AND b.user_id = $2 AND b.status = 'confirmed'`,
      [bookingId, userId],
    );
    const booking = rows[0];
    if (!booking) throw new NotFoundException('Completed confirmed booking not found');
    const endsAt = new Date(booking.scheduled_start.getTime() + booking.duration_minutes * 60_000);
    if (endsAt > new Date()) throw new ConflictException('Reviews open after the class ends');
    let review = await this.reviews.findOne({ where: { bookingId, userId } });
    if (review) {
      review.rating = rating;
      review.comment = comment?.trim() || null;
    } else {
      review = this.reviews.create({
        bookingId,
        classId: booking.class_ref,
        userId,
        rating,
        comment: comment?.trim() || null,
      });
    }
    const saved = await this.reviews.save(review);
    await this.db.query(
      `UPDATE class_offerings c SET
         rating = aggregates.rating,
         review_count = aggregates.review_count,
         updated_at = now()
       FROM (
         SELECT class_id, ROUND(AVG(rating)::numeric, 2)::real AS rating,
                COUNT(*)::int AS review_count
         FROM class_reviews WHERE class_id = $1 GROUP BY class_id
       ) aggregates
       WHERE c.id = aggregates.class_id`,
      [booking.class_ref],
    );
    await this.notifications.save(
      this.notifications.create({
        userId: booking.teacher_id,
        kind: 'review',
        title: `New review for ${booking.activity}`,
        body: `${booking.parent_name} left a ${rating}-star verified review.`,
        readAt: null,
      }),
    );
    return saved.toDto(booking.parent_name);
  }

  private async ownedOffering(teacherId: string, classId: string): Promise<OfferingRow> {
    const rows = await this.db.query<OfferingRow[]>(
      `SELECT id, teacher_id, activity, duration_minutes, seats, timings
       FROM class_offerings WHERE id = $1 AND teacher_id = $2`,
      [classId, teacherId],
    );
    if (!rows[0]) throw new NotFoundException('Provider class not found');
    return rows[0];
  }
}

function parseDate(value: string, message: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(message);
  return date;
}

function generateOccurrences(
  timings: ClassTiming[],
  durationMinutes: number,
  seats: number,
  from: Date,
  days: number,
): ClassOccurrence[] {
  const horizon = new Date(from.getTime() + days * 86_400_000);
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const result: ClassOccurrence[] = [];
  while (cursor <= horizon) {
    const day = cursor.getUTCDay() || 7;
    for (const timing of timings.filter((item) => item.weekday === day)) {
      const start = new Date(cursor.getTime() + timing.startMinute * 60_000);
      if (start < from || start > horizon) continue;
      result.push({
        start: start.toISOString(),
        end: new Date(start.getTime() + durationMinutes * 60_000).toISOString(),
        seatsTotal: seats,
        seatsAvailable: seats,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function reviewDto(row: ClassReview, parentName: string): ClassReviewDto {
  return {
    id: row.id,
    bookingId: row.bookingId,
    classId: row.classId,
    userId: row.userId,
    parentName,
    rating: row.rating,
    comment: row.comment,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}
