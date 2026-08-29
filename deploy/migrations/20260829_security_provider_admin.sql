BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(64) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at, now());

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  refresh_token_hash varchar NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  ip_address varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS account_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash varchar NOT NULL UNIQUE,
  kind varchar NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_tokens_user_id ON account_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_account_tokens_expiry ON account_tokens(expires_at) WHERE consumed_at IS NULL;

ALTER TABLE class_offerings
  ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'active';
ALTER TABLE class_offerings
  ADD COLUMN IF NOT EXISTS moderation_status varchar;
ALTER TABLE class_offerings
  ADD COLUMN IF NOT EXISTS moderation_reason text;
UPDATE class_offerings SET moderation_status = 'approved' WHERE moderation_status IS NULL;
ALTER TABLE class_offerings ALTER COLUMN moderation_status SET NOT NULL;
ALTER TABLE class_offerings ALTER COLUMN moderation_status SET DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS class_moderation_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  action varchar NOT NULL,
  actor_id uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_moderation_audits_class_id ON class_moderation_audits(class_id);

CREATE TABLE IF NOT EXISTS teacher_moderation_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_profile_id uuid NOT NULL,
  action varchar NOT NULL,
  actor_id uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teacher_moderation_audits_profile_id ON teacher_moderation_audits(teacher_profile_id);

INSERT INTO schema_migrations(version)
VALUES ('20260829_security_provider_admin')
ON CONFLICT (version) DO NOTHING;

COMMIT;
