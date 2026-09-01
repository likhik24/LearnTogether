BEGIN;

CREATE TABLE IF NOT EXISTS operation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error text,
  idempotency_key varchar NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operation_jobs_dispatch
  ON operation_jobs(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  booking_reminders boolean NOT NULL DEFAULT true,
  product_updates boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_payout_profiles (
  teacher_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  account_holder_name varchar NOT NULL,
  payout_method varchar NOT NULL CHECK (payout_method IN ('bank', 'upi')),
  bank_name varchar,
  ifsc varchar,
  account_last4 varchar(4),
  upi_id_masked varchar,
  external_fund_account_id varchar,
  kyc_status varchar NOT NULL DEFAULT 'submitted'
    CHECK (kyc_status IN ('not_started', 'submitted', 'verified', 'rejected')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seat_count integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS class_waitlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES class_offerings(id) ON DELETE CASCADE,
  occurrence_start timestamptz NOT NULL,
  child_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  child_name varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'offered', 'joined', 'cancelled')),
  offer_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_class_waitlist
  ON class_waitlists(user_id, class_id, occurrence_start, child_id)
  WHERE status IN ('waiting', 'offered');
CREATE INDEX IF NOT EXISTS idx_class_waitlist_queue
  ON class_waitlists(class_id, occurrence_start, status, created_at);

CREATE TABLE IF NOT EXISTS booking_reschedule_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES class_offerings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_name varchar,
  current_start timestamptz NOT NULL,
  requested_start timestamptz NOT NULL,
  reason text,
  status varchar NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'declined', 'cancelled')),
  provider_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_booking_reschedule
  ON booking_reschedule_requests(booking_id) WHERE status = 'requested';

CREATE OR REPLACE FUNCTION enqueue_notification_email() RETURNS trigger AS $$
BEGIN
  INSERT INTO operation_jobs
    (type, payload, status, attempts, max_attempts, next_attempt_at, idempotency_key)
  VALUES
    ('notification_email', jsonb_build_object('notificationId', NEW.id::text),
     'pending', 0, 8, now(), 'notification-email:' || NEW.id::text)
  ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_notification_email_outbox ON customer_notifications;
CREATE TRIGGER customer_notification_email_outbox
AFTER INSERT ON customer_notifications
FOR EACH ROW EXECUTE FUNCTION enqueue_notification_email();

INSERT INTO schema_migrations(version)
VALUES ('20260831_production_platform')
ON CONFLICT (version) DO NOTHING;

COMMIT;
