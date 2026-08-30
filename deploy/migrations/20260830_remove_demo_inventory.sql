BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(64) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TEMP TABLE demo_inventory_refs ON COMMIT DROP AS
SELECT id::text AS id, slug
FROM class_offerings
WHERE teacher_id = 'demo-teacher';

DELETE FROM saved_classes saved
USING demo_inventory_refs demo
WHERE saved.class_ref = demo.id OR saved.class_ref = demo.slug;

DELETE FROM bookings booking
USING demo_inventory_refs demo
WHERE booking.class_ref = demo.id OR booking.class_slug = demo.slug;

DELETE FROM class_offerings WHERE teacher_id = 'demo-teacher';

INSERT INTO schema_migrations(version)
VALUES ('20260830_remove_demo_inventory')
ON CONFLICT (version) DO NOTHING;

COMMIT;
