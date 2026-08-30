BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(64) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;

ALTER TYPE bookings_status_enum ADD VALUE IF NOT EXISTS 'pending_payment';

BEGIN;

ALTER TABLE bookings
  ALTER COLUMN status SET DEFAULT 'pending_payment'::bookings_status_enum;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  class_id varchar NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency varchar(3) NOT NULL,
  status varchar NOT NULL,
  provider varchar NOT NULL DEFAULT 'razorpay',
  provider_order_id varchar UNIQUE,
  provider_ref varchar,
  failure_reason text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id varchar PRIMARY KEY,
  event varchar NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations(version)
VALUES ('20260830_payments')
ON CONFLICT (version) DO NOTHING;

COMMIT;
