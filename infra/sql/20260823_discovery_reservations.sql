-- Production schema change for API-backed discovery and transactional seats.
-- Development uses TypeORM synchronize; production should apply this once.

ALTER TABLE IF EXISTS class_offerings
  ADD COLUMN IF NOT EXISTS slug varchar,
  ADD COLUMN IF NOT EXISTS category varchar NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS age_min integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS age_max integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS price_minor integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS tone varchar NOT NULL DEFAULT 'mint',
  ADD COLUMN IF NOT EXISTS rating real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS venue_name varchar;

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_offerings_slug
  ON class_offerings (slug) WHERE slug IS NOT NULL;

DO $$ BEGIN
  CREATE TYPE class_reservations_status_enum AS ENUM ('reserved', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS class_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES class_offerings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  occurrence_start timestamptz NOT NULL,
  seats integer NOT NULL DEFAULT 1 CHECK (seats > 0),
  status class_reservations_status_enum NOT NULL DEFAULT 'reserved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_inventory
  ON class_reservations (class_id, occurrence_start, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_class_reservation
  ON class_reservations (user_id, class_id, occurrence_start)
  WHERE status = 'reserved';

ALTER TABLE IF EXISTS customer_bookings
  ADD COLUMN IF NOT EXISTS class_slug varchar,
  ADD COLUMN IF NOT EXISTS reservation_id uuid;
