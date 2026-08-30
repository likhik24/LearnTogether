BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(64) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attendance_status varchar;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attendance_notes text;

CREATE TABLE IF NOT EXISTS class_occurrence_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES class_offerings(id) ON DELETE CASCADE,
  original_start timestamptz NOT NULL,
  replacement_start timestamptz,
  status varchar NOT NULL CHECK (status IN ('cancelled', 'rescheduled')),
  reason text,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_class_occurrence_override UNIQUE (class_id, original_start)
);
CREATE INDEX IF NOT EXISTS idx_occurrence_overrides_replacement
  ON class_occurrence_overrides(class_id, replacement_start);

CREATE TABLE IF NOT EXISTS class_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES class_offerings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_reviews_class ON class_reviews(class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_reviews_user ON class_reviews(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS provider_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_minor integer NOT NULL CHECK (amount_minor >= 10000),
  currency varchar(3) NOT NULL DEFAULT 'INR',
  status varchar NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'processing', 'paid', 'rejected')),
  reference varchar,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_payouts_teacher
  ON provider_payouts(teacher_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_payout_active_teacher
  ON provider_payouts(teacher_id)
  WHERE status IN ('requested', 'processing');
CREATE INDEX IF NOT EXISTS idx_provider_payouts_status
  ON provider_payouts(status, created_at ASC);

INSERT INTO schema_migrations(version)
VALUES ('20260830_provider_operations')
ON CONFLICT (version) DO NOTHING;

COMMIT;
