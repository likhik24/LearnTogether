BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_required boolean NOT NULL DEFAULT true;

INSERT INTO schema_migrations(version)
VALUES ('20260926_payment_optional_bookings')
ON CONFLICT (version) DO NOTHING;

COMMIT;
