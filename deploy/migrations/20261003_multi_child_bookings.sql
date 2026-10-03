BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS child_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE bookings
SET child_ids = jsonb_build_array(child_id::text)
WHERE child_id IS NOT NULL
  AND (child_ids IS NULL OR child_ids = '[]'::jsonb);

INSERT INTO schema_migrations(version)
VALUES ('20261003_multi_child_bookings')
ON CONFLICT (version) DO NOTHING;

COMMIT;
