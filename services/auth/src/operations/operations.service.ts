import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OperationJobStatus } from '@learn-and-build/types';
import type { EmailReadinessDto } from '@learn-and-build/types';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { AccountMailerService } from '../auth/account-mailer.service';
import { PaymentsGateway } from '../customer/payments.gateway';
import { NotificationPreference } from './notification-preference.entity';
import { OperationJob } from './operation-job.entity';

interface ClaimedJob {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

@Injectable()
export class OperationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OperationsService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly s3: S3Client;

  constructor(
    @InjectRepository(OperationJob) private readonly jobs: Repository<OperationJob>,
    @InjectRepository(NotificationPreference)
    private readonly preferences: Repository<NotificationPreference>,
    private readonly db: DataSource,
    private readonly mailer: AccountMailerService,
    private readonly payments: PaymentsGateway,
    private readonly config: ConfigService,
  ) {
    this.s3 = new S3Client({ region: config.get<string>('AWS_REGION', 'ap-southeast-2') });
  }

  onModuleInit(): void {
    void this.recoverStaleJobs().then(() => this.tick());
    this.timer = setInterval(() => void this.tick(), 15_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.scheduleReminders();
      const jobs = await this.claim(12);
      for (const job of jobs) await this.process(job);
    } catch (error) {
      this.logger.error(`Operations worker tick failed: ${message(error)}`);
    } finally {
      this.running = false;
    }
  }

  listFailed(): Promise<OperationJob[]> {
    return this.jobs.find({
      where: { status: OperationJobStatus.FAILED },
      order: { updatedAt: 'DESC' },
      take: 100,
    });
  }

  async retry(id: string): Promise<OperationJob> {
    const job = await this.jobs.findOneByOrFail({ id });
    job.status = OperationJobStatus.PENDING;
    job.attempts = 0;
    job.nextAttemptAt = new Date();
    job.lockedAt = null;
    job.lastError = null;
    return this.jobs.save(job);
  }

  async getPreferences(userId: string): Promise<NotificationPreference> {
    return (
      (await this.preferences.findOne({ where: { userId } })) ??
      this.preferences.create({
        userId,
        emailEnabled: true,
        bookingReminders: true,
        productUpdates: false,
      })
    );
  }

  async updatePreferences(
    userId: string,
    input: Partial<
      Pick<NotificationPreference, 'emailEnabled' | 'bookingReminders' | 'productUpdates'>
    >,
  ): Promise<NotificationPreference> {
    const preference = await this.getPreferences(userId);
    Object.assign(preference, input);
    return this.preferences.save(preference);
  }

  emailReadiness(): Promise<EmailReadinessDto> {
    return this.mailer.readiness();
  }

  private async claim(limit: number): Promise<ClaimedJob[]> {
    return this.db.transaction(async (manager) =>
      manager.query<ClaimedJob[]>(
        `UPDATE operation_jobs SET status = 'processing', locked_at = now(),
                 attempts = attempts + 1, updated_at = now()
         WHERE id IN (
           SELECT id FROM operation_jobs
           WHERE status = 'pending' AND next_attempt_at <= now() AND attempts < max_attempts
           ORDER BY next_attempt_at, created_at
           FOR UPDATE SKIP LOCKED LIMIT $1
         )
         RETURNING id, type, payload, attempts, max_attempts`,
        [limit],
      ),
    );
  }

  private async process(job: ClaimedJob): Promise<void> {
    try {
      await this.dispatch(job);
      await this.db.query(
        `UPDATE operation_jobs SET status = 'completed', locked_at = NULL,
                 last_error = NULL, updated_at = now() WHERE id = $1`,
        [job.id],
      );
    } catch (error) {
      const final = job.attempts >= job.max_attempts;
      const backoffSeconds = Math.min(3600, 15 * 2 ** Math.max(0, job.attempts - 1));
      await this.db.query(
        `UPDATE operation_jobs SET status = $2, locked_at = NULL, last_error = $3,
                 next_attempt_at = now() + ($4 || ' seconds')::interval, updated_at = now()
         WHERE id = $1`,
        [
          job.id,
          final ? OperationJobStatus.FAILED : OperationJobStatus.PENDING,
          message(error).slice(0, 4000),
          backoffSeconds,
        ],
      );
      this.logger.warn(`Job ${job.type}/${job.id} failed (${job.attempts}): ${message(error)}`);
    }
  }

  private async dispatch(job: ClaimedJob): Promise<void> {
    if (job.type === 'refund_booking') {
      await this.payments.refundBooking(requiredString(job.payload.bookingId, 'bookingId'));
      return;
    }
    if (job.type === 'notification_email') {
      const rows = await this.db.query<
        Array<{
          email: string;
          display_name: string;
          title: string;
          body: string;
          email_enabled: boolean;
          product_updates: boolean;
          kind: string;
        }>
      >(
        `SELECT u.email, u.display_name, n.title, n.body, n.kind,
                COALESCE(p.email_enabled, true) AS email_enabled,
                COALESCE(p.product_updates, false) AS product_updates
         FROM customer_notifications n
         JOIN users u ON u.id = n.user_id
         LEFT JOIN notification_preferences p ON p.user_id = u.id
         WHERE n.id = $1`,
        [requiredString(job.payload.notificationId, 'notificationId')],
      );
      const target = rows[0];
      if (
        !target ||
        !target.email_enabled ||
        (target.kind === 'product' && !target.product_updates)
      )
        return;
      await this.mailer.notification(target.email, target.display_name, target.title, target.body);
      return;
    }
    if (job.type === 'booking_reminder') {
      const bookingId = requiredString(job.payload.bookingId, 'bookingId');
      const rows = await this.db.query<
        Array<{ user_id: string; title: string; scheduled_start: Date; child_name: string | null }>
      >(
        `SELECT b.user_id, b.title, b.scheduled_start, b.child_name
         FROM bookings b LEFT JOIN notification_preferences p ON p.user_id = b.user_id
         WHERE b.id = $1 AND b.status = 'confirmed' AND COALESCE(p.booking_reminders, true)`,
        [bookingId],
      );
      const booking = rows[0];
      if (!booking) return;
      const hours = Number(job.payload.hours ?? 24);
      await this.db.query(
        `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
         VALUES ($1, 'reminder', $2, $3, NULL)`,
        [
          booking.user_id,
          `${booking.title} starts ${hours <= 2 ? 'soon' : 'tomorrow'}`,
          `${booking.child_name ?? 'Your child'} is booked for ${booking.scheduled_start.toLocaleString('en-IN')}.`,
        ],
      );
      return;
    }
    if (job.type === 'promote_waitlist') {
      await this.promoteWaitlist(
        requiredString(job.payload.classId, 'classId'),
        new Date(requiredString(job.payload.occurrenceStart, 'occurrenceStart')),
      );
      return;
    }
    if (job.type === 'delete_account') {
      await this.anonymizeAccount(requiredString(job.payload.userId, 'userId'));
      return;
    }
    if (job.type === 'delete_teacher_documents') {
      const keys = Array.isArray(job.payload.keys)
        ? job.payload.keys.filter(
            (value): value is string => typeof value === 'string' && Boolean(value),
          )
        : [];
      const bucket = this.config.get<string>('DOCUMENTS_BUCKET');
      if (bucket && keys.length) {
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
          }),
        );
      }
      return;
    }
    throw new Error(`Unsupported operation job type: ${job.type}`);
  }

  private async scheduleReminders(): Promise<void> {
    await this.db.query(
      `INSERT INTO operation_jobs (type, payload, status, attempts, max_attempts, next_attempt_at, idempotency_key)
       SELECT 'booking_reminder', jsonb_build_object('bookingId', b.id, 'hours', window.hours),
              'pending', 0, 8,
              GREATEST(now(), b.scheduled_start - (window.hours || ' hours')::interval),
              'booking-reminder:' || b.id || ':' || window.hours
       FROM bookings b
       CROSS JOIN (VALUES (24), (2)) AS window(hours)
       WHERE b.status = 'confirmed'
         AND b.scheduled_start > now()
         AND b.scheduled_start <= now() + interval '120 days'
       ON CONFLICT (idempotency_key) DO NOTHING`,
    );
    await this.db.query(
      `INSERT INTO operation_jobs
         (type, payload, status, attempts, max_attempts, next_attempt_at, idempotency_key)
       SELECT 'promote_waitlist',
              jsonb_build_object('classId', class_id::text, 'occurrenceStart', occurrence_start::text),
              'pending', 0, 8, now(), 'expired-waitlist-offer:' || id::text
       FROM class_waitlists
       WHERE status = 'offered' AND offer_expires_at < now()
       ON CONFLICT (idempotency_key) DO NOTHING`,
    );
  }

  private async recoverStaleJobs(): Promise<void> {
    await this.db.query(
      `UPDATE operation_jobs SET status = 'pending', locked_at = NULL, next_attempt_at = now()
       WHERE status = 'processing' AND locked_at < now() - interval '10 minutes'`,
    );
  }

  private async promoteWaitlist(classId: string, occurrenceStart: Date): Promise<void> {
    await this.db.transaction(async (manager) => {
      const capacity = await manager.query<
        Array<{ seats: number; reserved: string; cancelled: boolean }>
      >(
        `SELECT c.seats,
                COALESCE(SUM(r.seats) FILTER (WHERE r.status = 'reserved'), 0)::text AS reserved,
                EXISTS(SELECT 1 FROM class_occurrence_overrides o
                  WHERE o.class_id = c.id AND o.original_start = $2 AND o.status = 'cancelled') AS cancelled
         FROM class_offerings c LEFT JOIN class_reservations r
           ON r.class_id = c.id AND r.occurrence_start = $2
         WHERE c.id = $1 GROUP BY c.id, c.seats`,
        [classId, occurrenceStart],
      );
      if (
        !capacity[0] ||
        capacity[0].cancelled ||
        Number(capacity[0].reserved) >= capacity[0].seats
      )
        return;
      await manager.query(
        `UPDATE class_waitlists SET status = 'cancelled', offer_expires_at = NULL, updated_at = now()
         WHERE class_id = $1 AND occurrence_start = $2
           AND status = 'offered' AND offer_expires_at < now()`,
        [classId, occurrenceStart],
      );
      const rows = await manager.query<Array<{ id: string; user_id: string; child_name: string }>>(
        `SELECT id, user_id, child_name FROM class_waitlists
         WHERE class_id = $1 AND occurrence_start = $2 AND status = 'waiting'
         ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`,
        [classId, occurrenceStart],
      );
      const entry = rows[0];
      if (!entry) return;
      await manager.query(
        `UPDATE class_waitlists SET status = 'offered', offer_expires_at = now() + interval '24 hours',
                 updated_at = now() WHERE id = $1`,
        [entry.id],
      );
      await manager.query(
        `INSERT INTO customer_notifications (user_id, kind, title, body, read_at)
         VALUES ($1, 'waitlist', 'A class seat is available', $2, NULL)`,
        [entry.user_id, `${entry.child_name} has 24 hours to book the available seat.`],
      );
    });
  }

  private async anonymizeAccount(userId: string): Promise<void> {
    const documents = await this.db.query<Array<{ storage_key: string }>>(
      `SELECT d.storage_key FROM teacher_documents d
       JOIN teacher_profiles p ON p.id = d."profileId" WHERE p.user_id = $1`,
      [userId],
    );
    await this.db.transaction(async (manager) => {
      const rows = await manager.query<Array<{ deletion_requested_at: Date | null }>>(
        `SELECT deletion_requested_at FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
      );
      if (!rows[0]?.deletion_requested_at) return;
      await manager.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
      await manager.query(`DELETE FROM account_tokens WHERE user_id = $1`, [userId]);
      await manager.query(`DELETE FROM saved_classes WHERE user_id = $1`, [userId]);
      await manager.query(
        `UPDATE bookings SET child_id = NULL, child_name = 'Deleted learner', updated_at = now()
         WHERE user_id = $1`,
        [userId],
      );
      await manager.query(`DELETE FROM child_profiles WHERE user_id = $1`, [userId]);
      await manager.query(`DELETE FROM class_waitlists WHERE user_id = $1`, [userId]);
      await manager.query(`DELETE FROM booking_reschedule_requests WHERE user_id = $1`, [userId]);
      await manager.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [userId]);
      await manager.query(`DELETE FROM customer_notifications WHERE user_id = $1`, [userId]);
      await manager.query(`DELETE FROM provider_payout_profiles WHERE teacher_id = $1`, [userId]);
      await manager.query(
        `DELETE FROM teacher_documents WHERE "profileId" IN
          (SELECT id FROM teacher_profiles WHERE user_id = $1)`,
        [userId],
      );
      if (documents.length) {
        await manager.query(
          `INSERT INTO operation_jobs
             (type, payload, status, attempts, max_attempts, next_attempt_at, idempotency_key)
           VALUES ('delete_teacher_documents', $2::jsonb, 'pending', 0, 8, now(),
                   'delete-teacher-documents:' || $1::text)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [userId, JSON.stringify({ keys: documents.map((item) => item.storage_key) })],
        );
      }
      await manager.query(`UPDATE class_reviews SET comment = NULL WHERE user_id = $1`, [userId]);
      await manager.query(
        `UPDATE teacher_profiles SET display_name = 'Deleted provider', phone = NULL, email = NULL,
             bio = NULL, home_address = NULL, portfolio = NULL, instagram_url = NULL,
             preply_url = NULL, urbanpro_url = NULL, teacheron_url = NULL, updated_at = now()
         WHERE user_id = $1`,
        [userId],
      );
      await manager.query(
        `UPDATE users SET email = 'deleted+' || id::text || '@invalid.learnandbuild.org',
             display_name = 'Deleted account', password_hash = NULL, provider_subject = NULL,
             deletion_requested_at = NULL, updated_at = now() WHERE id = $1`,
        [userId],
      );
    });
  }
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Job payload is missing ${name}`);
  return value;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
