BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(64) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS child_id uuid;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS child_name varchar;
CREATE INDEX IF NOT EXISTS idx_bookings_child_id ON bookings(child_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_child') THEN
    ALTER TABLE bookings
      ADD CONSTRAINT fk_bookings_child FOREIGN KEY (child_id) REFERENCES child_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO schema_migrations(version)
VALUES ('20260830_customer_booking_context')
ON CONFLICT (version) DO NOTHING;

COMMIT;
