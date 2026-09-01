--
-- Complete initial schema for the Learn&Build platform.
--
-- This single migration builds the entire database from empty for every
-- DB-backed service (auth, teacher/provider, scheduling, payments). It is the
-- one script needed to set the app up on a new machine or a fresh production
-- database with TypeORM `synchronize` disabled (DB_SYNCHRONIZE=false).
--
-- It consolidates what were previously a genesis baseline plus a series of
-- incremental patch migrations into one authoritative schema. It is fully
-- idempotent: every statement guards with IF NOT EXISTS / catalog checks, so
-- it is a safe no-op on an already-populated database and a full build on an
-- empty one.
--
-- Index, constraint and foreign-key names are stable and descriptive (TypeORM's
-- auto-generated hash names are intentionally not reproduced); only the
-- columns, primary keys, uniqueness, spatial indexes and foreign keys the
-- application relies on are recreated.

-- Migration bookkeeping table (also ensured by the migration runner).
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    varchar(64) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- Extensions
-- --------------------------------------------------------------------------
-- uuid_generate_v4() is the default for most primary keys.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- PostGIS provides the geography(Point,4326) columns + GiST spatial indexes
-- used for proximity search of providers and classes.
CREATE EXTENSION IF NOT EXISTS postgis;

-- --------------------------------------------------------------------------
-- Native enum types (names match what TypeORM generates for these columns)
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
    CREATE TYPE public.users_role_enum AS ENUM ('user', 'teacher', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_provider_enum') THEN
    CREATE TYPE public.users_provider_enum AS ENUM ('local', 'google', 'aws');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bookings_status_enum') THEN
    CREATE TYPE public.bookings_status_enum AS ENUM ('pending_payment', 'confirmed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teacher_documents_type_enum') THEN
    CREATE TYPE public.teacher_documents_type_enum AS ENUM ('id', 'certificate', 'resume', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teacher_profiles_verificationstatus_enum') THEN
    CREATE TYPE public.teacher_profiles_verificationstatus_enum AS ENUM ('pending', 'submitted', 'under_review', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_offerings_instructor_gender_enum') THEN
    CREATE TYPE public.class_offerings_instructor_gender_enum AS ENUM ('male', 'female', 'any');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_reservations_status_enum') THEN
    CREATE TYPE public.class_reservations_status_enum AS ENUM ('reserved', 'cancelled');
  END IF;
END
$$;

-- ==========================================================================
-- auth service
-- ==========================================================================

CREATE TABLE IF NOT EXISTS users (
  id                uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  email             varchar NOT NULL,
  password_hash     varchar,
  display_name      varchar NOT NULL,
  role              public.users_role_enum NOT NULL DEFAULT 'user',
  provider          public.users_provider_enum NOT NULL DEFAULT 'local',
  provider_subject  varchar,
  email_verified_at timestamptz,
  created_at        timestamp NOT NULL DEFAULT now(),
  updated_at        timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uq_users_email UNIQUE (email)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_provider_subject
  ON users (provider, provider_subject) WHERE provider_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS child_profiles (
  id           uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      varchar NOT NULL,
  name         varchar NOT NULL,
  birth_date   date,
  interests    text[] NOT NULL DEFAULT '{}'::text[],
  avatar_color varchar NOT NULL DEFAULT '#7c5cff',
  created_at   timestamp NOT NULL DEFAULT now(),
  updated_at   timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_child_profiles_user_id ON child_profiles (user_id);

CREATE TABLE IF NOT EXISTS saved_classes (
  id         uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    varchar NOT NULL,
  class_ref  varchar NOT NULL,
  title      varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_user_ref ON saved_classes (user_id, class_ref);

CREATE TABLE IF NOT EXISTS bookings (
  id                uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           varchar NOT NULL,
  class_ref         varchar NOT NULL,
  class_slug        varchar,
  reservation_id    varchar,
  child_id          uuid,
  child_name        varchar,
  title             varchar NOT NULL,
  scheduled_start   timestamptz NOT NULL,
  amount_minor      integer NOT NULL DEFAULT 0,
  currency          varchar NOT NULL DEFAULT 'INR',
  status            public.bookings_status_enum NOT NULL DEFAULT 'pending_payment',
  attendance_status varchar,
  attendance_notes  text,
  created_at        timestamp NOT NULL DEFAULT now(),
  updated_at        timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_child_id ON bookings (child_id);

CREATE TABLE IF NOT EXISTS customer_notifications (
  id         uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    varchar NOT NULL,
  kind       varchar NOT NULL DEFAULT 'general',
  title      varchar NOT NULL,
  body       text NOT NULL,
  read_at    timestamptz,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_id ON customer_notifications (user_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id                 uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id            uuid NOT NULL,
  refresh_token_hash varchar NOT NULL,
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  user_agent         text,
  ip_address         varchar,
  created_at         timestamp NOT NULL DEFAULT now(),
  updated_at         timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_sessions_refresh_token_hash ON auth_sessions (refresh_token_hash);
-- Partial index to expire only live sessions efficiently.
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry
  ON auth_sessions (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS account_tokens (
  id          uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     uuid NOT NULL,
  token_hash  varchar NOT NULL,
  kind        varchar NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_tokens_user_id ON account_tokens (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_tokens_token_hash ON account_tokens (token_hash);
-- Partial index to expire only unconsumed tokens efficiently.
CREATE INDEX IF NOT EXISTS idx_account_tokens_expiry
  ON account_tokens (expires_at) WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS class_reviews (
  id         uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id uuid NOT NULL,
  class_id   uuid NOT NULL,
  user_id    uuid NOT NULL,
  rating     smallint NOT NULL,
  comment    text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_reviews_booking_id ON class_reviews (booking_id);
CREATE INDEX IF NOT EXISTS idx_class_reviews_class_id ON class_reviews (class_id);
CREATE INDEX IF NOT EXISTS idx_class_reviews_user_id ON class_reviews (user_id);

-- ==========================================================================
-- teacher (provider) service
-- ==========================================================================

CREATE TABLE IF NOT EXISTS teacher_profiles (
  id                          uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id                     varchar NOT NULL,
  display_name                varchar NOT NULL,
  bio                         text,
  subjects                    text[] NOT NULL DEFAULT '{}'::text[],
  location                    geography(Point, 4326),
  "verificationStatus"        public.teacher_profiles_verificationstatus_enum NOT NULL DEFAULT 'pending',
  rejection_reason            text,
  phone                       varchar,
  email                       varchar,
  age_band                    varchar,
  locality                    varchar,
  city                        varchar,
  category                    varchar,
  subcategories               text[] NOT NULL DEFAULT '{}'::text[],
  skills                      text[] NOT NULL DEFAULT '{}'::text[],
  skill_description           text,
  years_experience            varchar,
  portfolio                   text,
  instagram_url               varchar,
  preply_url                  varchar,
  urbanpro_url                varchar,
  teacheron_url               varchar,
  children_experience         varchar,
  children_experience_detail  text,
  child_age_groups            text[] NOT NULL DEFAULT '{}'::text[],
  teaching_formats            text[] NOT NULL DEFAULT '{}'::text[],
  venue_preferences           text[] NOT NULL DEFAULT '{}'::text[],
  travel_radius               varchar,
  home_address                varchar,
  available_days              text[] NOT NULL DEFAULT '{}'::text[],
  time_slots                  text[] NOT NULL DEFAULT '{}'::text[],
  availability_dates          jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_availability      text,
  session_frequency           varchar,
  why_join                    text,
  created_at                  timestamp NOT NULL DEFAULT now(),
  updated_at                  timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_profiles_user_id ON teacher_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_location ON teacher_profiles USING gist (location);

CREATE TABLE IF NOT EXISTS teacher_documents (
  id          uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  type        public.teacher_documents_type_enum NOT NULL DEFAULT 'other',
  file_name   varchar NOT NULL,
  storage_key varchar NOT NULL,
  uploaded_at timestamp NOT NULL DEFAULT now(),
  -- TypeORM ManyToOne created a quoted camelCase FK column; preserved verbatim.
  "profileId" uuid
);

CREATE TABLE IF NOT EXISTS teacher_moderation_audits (
  id                 uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_profile_id uuid NOT NULL,
  action             varchar NOT NULL,
  actor_id           uuid NOT NULL,
  note               text,
  created_at         timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teacher_moderation_audits_profile_id
  ON teacher_moderation_audits (teacher_profile_id);

-- ==========================================================================
-- scheduling service
-- ==========================================================================

CREATE TABLE IF NOT EXISTS class_offerings (
  id                uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id        varchar NOT NULL,
  slug              varchar,
  activity          varchar NOT NULL,
  description       text,
  category          varchar NOT NULL DEFAULT 'General',
  age_min           integer NOT NULL DEFAULT 3,
  age_max           integer NOT NULL DEFAULT 6,
  price_minor       integer NOT NULL DEFAULT 0,
  currency          varchar(3) NOT NULL DEFAULT 'INR',
  image_url         text,
  tone              varchar NOT NULL DEFAULT 'mint',
  rating            real NOT NULL DEFAULT 0,
  review_count      integer NOT NULL DEFAULT 0,
  venue_name        varchar,
  instructor_gender public.class_offerings_instructor_gender_enum NOT NULL DEFAULT 'any',
  duration_minutes  integer NOT NULL,
  seats             integer NOT NULL,
  timings           jsonb NOT NULL DEFAULT '[]'::jsonb,
  status            varchar NOT NULL DEFAULT 'active',
  moderation_status varchar NOT NULL DEFAULT 'pending',
  moderation_reason text,
  location          geography(Point, 4326),
  created_at        timestamp NOT NULL DEFAULT now(),
  updated_at        timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_offerings_teacher_id ON class_offerings (teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_offerings_slug ON class_offerings (slug);
CREATE INDEX IF NOT EXISTS idx_class_offerings_location ON class_offerings USING gist (location);

CREATE TABLE IF NOT EXISTS class_reservations (
  id               uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id         uuid NOT NULL,
  user_id          uuid NOT NULL,
  occurrence_start timestamptz NOT NULL,
  seats            integer NOT NULL DEFAULT 1,
  status           public.class_reservations_status_enum NOT NULL DEFAULT 'reserved',
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservation_inventory
  ON class_reservations (class_id, occurrence_start, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_class_reservation
  ON class_reservations (user_id, class_id, occurrence_start) WHERE status = 'reserved';

CREATE TABLE IF NOT EXISTS class_moderation_audits (
  id         uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  class_id   uuid NOT NULL,
  action     varchar NOT NULL,
  actor_id   uuid NOT NULL,
  note       text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_moderation_audits_class_id
  ON class_moderation_audits (class_id);

CREATE TABLE IF NOT EXISTS class_occurrence_overrides (
  id                uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id          uuid NOT NULL,
  original_start    timestamptz NOT NULL,
  replacement_start timestamptz,
  status            varchar NOT NULL,
  reason            text,
  created_by        uuid NOT NULL,
  created_at        timestamp NOT NULL DEFAULT now(),
  updated_at        timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_occurrence_override
  ON class_occurrence_overrides (class_id, original_start);
CREATE INDEX IF NOT EXISTS idx_occurrence_overrides_replacement
  ON class_occurrence_overrides (class_id, replacement_start);

-- ==========================================================================
-- payments service
-- ==========================================================================

CREATE TABLE IF NOT EXISTS payments (
  id                uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           uuid NOT NULL,
  booking_id        uuid NOT NULL,
  class_id          varchar NOT NULL,
  amount_minor      integer NOT NULL,
  currency          varchar(3) NOT NULL,
  status            varchar NOT NULL,
  provider          varchar NOT NULL DEFAULT 'razorpay',
  provider_order_id varchar,
  provider_ref      varchar,
  failure_reason    text,
  expires_at        timestamptz NOT NULL,
  created_at        timestamp NOT NULL DEFAULT now(),
  updated_at        timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_booking_id ON payments (booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_order_id ON payments (provider_order_id);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id     varchar NOT NULL PRIMARY KEY,
  event        varchar NOT NULL,
  processed_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_payouts (
  id           uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id   uuid NOT NULL,
  amount_minor integer NOT NULL,
  currency     varchar(3) NOT NULL DEFAULT 'INR',
  status       varchar NOT NULL DEFAULT 'requested',
  reference    varchar,
  note         text,
  created_at   timestamp NOT NULL DEFAULT now(),
  updated_at   timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_payouts_teacher ON provider_payouts (teacher_id);
CREATE INDEX IF NOT EXISTS idx_provider_payouts_status ON provider_payouts (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_payout_active_teacher
  ON provider_payouts (teacher_id) WHERE status IN ('requested', 'processing');

-- --------------------------------------------------------------------------
-- Foreign keys (guarded: ADD CONSTRAINT has no IF NOT EXISTS on older PG).
-- Each guard checks for ANY foreign key already present on the referencing
-- column (whatever its name), so this is a no-op on a database where the FK
-- already exists and adds it on a fresh one.
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f' AND c.conrelid = 'class_reservations'::regclass
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = 'class_reservations'::regclass AND attname = 'class_id')]
  ) THEN
    ALTER TABLE class_reservations
      ADD CONSTRAINT fk_class_reservations_class
      FOREIGN KEY (class_id) REFERENCES class_offerings (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f' AND c.conrelid = 'teacher_documents'::regclass
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = 'teacher_documents'::regclass AND attname = 'profileId')]
  ) THEN
    ALTER TABLE teacher_documents
      ADD CONSTRAINT fk_teacher_documents_profile
      FOREIGN KEY ("profileId") REFERENCES teacher_profiles (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f' AND c.conrelid = 'bookings'::regclass
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute
        WHERE attrelid = 'bookings'::regclass AND attname = 'child_id')]
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT fk_bookings_child
      FOREIGN KEY (child_id) REFERENCES child_profiles (id) ON DELETE SET NULL;
  END IF;
END
$$;
