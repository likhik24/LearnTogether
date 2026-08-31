# Learn&Build Platform

A Turborepo + pnpm monorepo for the Learn&Build platform.

## Layout

```
/apps
  /web              Next.js PWA (placeholder, built later)
  /mobile           Expo app (placeholder, built later)
/services
  /auth             NestJS service
  /teacher          NestJS service
  /search           NestJS service
  /scheduling       NestJS service
  /voice            NestJS service
  /meetings         NestJS service
  /payments         NestJS service
/packages
  /types            Shared TypeScript types/contracts
  /api-client       Shared API client
  /nest-auth        Shared NestJS auth guards/strategy (JWT + roles)
  /config           Shared eslint / tsconfig / jest presets
/infra
  /cdk              AWS CDK stacks (RDS PostGIS, OpenSearch, ElastiCache, S3)
docker-compose.yml  Local dev infra + services
turbo.json
```

The `apps/web` customer discovery experience and admin console (Next.js), plus
the `auth`, `teacher`, `search`, and `scheduling` services, are implemented.
Some of the remaining services are still health-check skeletons.

## Prerequisites

- Node.js >= 20
- pnpm (via corepack: `corepack enable pnpm`)
- Docker + Docker Compose
- AWS account **960763460353** for any AWS-backed features (S3 document
  uploads, SES email). Configure a named profile for this account and export it
  before running commands that touch AWS.

### AWS profile setup (macOS)

Create a named profile `learnbuild` for account **960763460353** (one-time),
then export it in each shell that runs AWS-backed commands.

```bash
# 1. Configure the profile (prompts for Access Key ID, Secret Access Key, region).
#    Use us-east-1 (or your team's region) when asked for the default region.
aws configure --profile learnbuild

# 2. Export the profile for the current terminal session.
export AWS_PROFILE=learnbuild

# 3. Verify it resolves to the right account.
aws sts get-caller-identity   # should report Account: 960763460353
```

To make the export permanent, add it to your shell profile (zsh is the default
on macOS):

```bash
echo 'export AWS_PROFILE=learnbuild' >> ~/.zshrc
source ~/.zshrc
```

> If you use SSO instead of long-lived keys, run
> `aws configure sso --profile learnbuild` and sign in with
> `aws sso login --profile learnbuild`, then `export AWS_PROFILE=learnbuild`.
> The `Account` in the SSO account selection must be `960763460353`.

## Getting started

Run these from the repo root, in order.

### 1. Install dependencies

```bash
pnpm install
```

> **Registry note.** Dependencies are all public npm packages. If your machine
> has a `~/.npmrc` pointing pnpm at a private registry (e.g. AWS CodeArtifact)
> whose token is expired, `pnpm install` fails with `ERR_PNPM_FETCH_401`. Since
> nothing here is private, install from the public registry instead — this does
> not modify your `~/.npmrc`:
> ```bash
> pnpm install --registry=https://registry.npmjs.org/ --config.always-auth=false
> ```

### 2. Build, test, lint (optional but recommended)

```bash
pnpm build
pnpm test
pnpm lint
```

> Do **not** run `pnpm build` for the web app while its dev server is running —
> both write to `apps/web/.next` and can corrupt the dev cache
> (`__webpack_modules__[moduleId] is not a function`). If that happens, stop the
> dev server, delete `apps/web/.next`, and restart it.

### 3. Start the backend stack

```bash
docker compose up --build
```

Boots Postgres+PostGIS, OpenSearch, Redis, and all NestJS services (see the
port table below). Wait until the services report healthy.

> **After changing service code, rebuild that container** so the running image
> isn’t stale, e.g. `docker compose up -d --build auth`. A stale container is a
> common cause of `Cannot GET /…` (route missing) or `… is not exported`
> (outdated bundle) errors.

#### Running a service natively (when Docker is unavailable)

If Docker Desktop is locked or you want a service on current code without
rebuilding its image, run it directly against the host Postgres (which the
compose stack already publishes on `localhost:5432`). Example for the auth
service on a spare port so it doesn’t clash with the container on 3001:

```bash
PORT=3011 NODE_ENV=development \
  DATABASE_URL=postgres://learnbuild:learnbuild@localhost:5432/learnbuild \
  JWT_SECRET=dev-insecure-secret \
  pnpm --filter @learn-and-build/auth-service dev
```

Then point the web app’s proxy at it when starting the dev server:

```bash
AUTH_SERVICE_ORIGIN=http://localhost:3011 pnpm --filter @learn-and-build/web dev
```

The same pattern works for other services via their `*_SERVICE_ORIGIN`
overrides (see `next.config.mjs`). Use the same `JWT_SECRET` as the rest of the
stack so tokens interoperate.

### 3b. Apply database migrations

The full schema lives in a single migration, `deploy/migrations/0001_init_schema.sql`.
It builds every table, enum, index, and foreign key from an empty database and
is idempotent, so it is safe to run repeatedly. With Postgres up (step 3), apply
it from the repo root:

```bash
pnpm db:migrate          # apply pending migrations
pnpm db:migrate:status   # show applied vs pending, without changing anything
```

The runner tracks applied migrations in the `schema_migrations` table and skips
any already applied. It reads `DATABASE_URL` (default
`postgres://learnbuild:learnbuild@localhost:5432/learnbuild`); set `PGSSLMODE=require`
when pointing at a TLS-only database such as RDS.

> In local development the services default to TypeORM `synchronize`, so the
> schema is auto-created and this step is optional for day-to-day work. In
> production, services run with `DB_SYNCHRONIZE=false` and these migrations are
> the single source of truth — run `pnpm db:migrate` (or let the deploy stack's
> `migrate` service run it) before starting the services against a fresh
> database.

### 4. Start the web app (separate terminal)

```bash
pnpm --filter @learn-and-build/web dev
```

Open http://localhost:3100. The customer app, admin console (`/admin`), and the
provider page (`/provider`) are all served here.

## Local infrastructure & services

`docker compose up --build` (step 3 above) boots Postgres+PostGIS, OpenSearch,
Redis, and all NestJS services. To run a subset, name the services, e.g.:

```bash
docker compose up --build postgres redis opensearch auth teacher scheduling search
```

Each service exposes a health endpoint:

| Service    | Port | Health URL                   |
| ---------- | ---- | ---------------------------- |
| auth       | 3001 | http://localhost:3001/health |
| teacher    | 3002 | http://localhost:3002/health |
| search     | 3003 | http://localhost:3003/health |
| scheduling | 3004 | http://localhost:3004/health |
| voice      | 3005 | http://localhost:3005/health |
| meetings   | 3006 | http://localhost:3006/health |
| payments   | 3007 | http://localhost:3007/health |

All `/health` endpoints return HTTP 200 with `{ "status": "ok", "service": "<name>" }`.

> Note: the `auth` and `teacher` services open a Postgres connection at
> startup, so their `/health` is available once Postgres is reachable (it is,
> under docker compose). The skeleton services have no dependencies and boot
> standalone.

## Auth service (port 3001)

Roles: `user`, `teacher`, `admin` (shared `Role` enum in `@learn-and-build/types`).

| Method | Route                  | Auth        | Purpose                              |
| ------ | ---------------------- | ----------- | ------------------------------------ |
| POST   | /auth/register         | public      | Sign up (USER or TEACHER only)       |
| POST   | /auth/login            | public      | Start a secure cookie session        |
| GET    | /auth/me               | JWT         | Current user                         |
| POST   | /auth/provider-account | JWT + USER  | Continue a family account as provider |
| GET    | /admin/users           | JWT + ADMIN | List users                           |
| PATCH  | /admin/users/:id/role  | JWT + ADMIN | Change a user's role                 |

Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` to seed an initial admin on first boot.

### Customer account data

The customer UI stores data in PostgreSQL whenever a user signs in. Every
route below requires a bearer JWT and is scoped to that user.

| Method | Route                             | Purpose                         |
| ------ | --------------------------------- | ------------------------------- |
| GET    | /customer/children                | List child profiles             |
| POST   | /customer/children                | Create a child profile          |
| PATCH  | /customer/children/:id            | Update an owned child profile   |
| GET    | /customer/saved-classes           | List saved classes              |
| PUT    | /customer/saved-classes/:classRef | Save a class (idempotent)       |
| DELETE | /customer/saved-classes/:classRef | Remove a saved class            |
| GET    | /customer/bookings                | List customer bookings          |
| POST   | /customer/bookings                | Reserve a seat and book a trial |
| PATCH  | /customer/bookings/:id/cancel     | Cancel an owned booking         |
| GET    | /customer/notifications           | List in-app notifications       |
| PATCH  | /customer/notifications/:id/read  | Mark one notification as read   |
| POST   | /customer/notifications/read-all  | Mark all notifications as read  |

Booking and profile actions create notifications automatically. Booking calls
the scheduling service to reserve inventory transactionally before persisting
the customer record. New bookings remain `pending_payment` until the Payments
service creates a Razorpay Order, verifies the checkout signature, and confirms
the captured amount and currency with Razorpay. Abandoned holds expire after
20 minutes; paid cancellations are refunded before inventory is released.

### Payments (Razorpay)

| Method | Route                               | Purpose                               |
| ------ | ----------------------------------- | ------------------------------------- |
| GET    | /payments/ready                     | Gateway readiness                     |
| POST   | /payments/intents                   | Create/reuse an order for a booking   |
| POST   | /payments/:id/verify                | Verify and confirm captured payment   |
| GET    | /payments/booking/:bookingId        | Read owned booking payment            |
| POST   | /payments/booking/:bookingId/refund | Refund before booking cancellation    |
| POST   | /payments/webhooks/razorpay         | Signed, idempotent webhook processing |

Local Docker uses the mock provider. Production requires
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and a separate
`RAZORPAY_WEBHOOK_SECRET`; secrets never reach browser code.

### OIDC (Google + AWS Cognito)

The auth service also supports OIDC login via Google and AWS Cognito
(Authorization Code + PKCE, using `openid-client`). Providers are enabled only
when their env vars are set, so it degrades gracefully to password-only.

| Method | Route                         | Purpose                                        |
| ------ | ----------------------------- | ---------------------------------------------- |
| GET    | /auth/oidc/providers          | List enabled providers (for UI buttons)        |
| GET    | /auth/oidc/:provider/login    | 302 redirect to the provider                   |
| GET    | /auth/oidc/:provider/callback | Exchange code, set session, then return to app |

On success the auth service sets the same secure HttpOnly session cookies as
password login and redirects to the validated in-app `returnTo` path.
External identities are linked to a local user (matched by email, else created
for the selected customer/provider flow). Configure via `GOOGLE_CLIENT_ID/SECRET` and
`AWS_COGNITO_ISSUER` + `AWS_COGNITO_CLIENT_ID/SECRET` (see `.env.example`).
Set each provider's redirect URI to
`${OIDC_REDIRECT_BASE}/auth/oidc/<google|aws>/callback`.

For Google production login, add this exact authorized redirect URI in Google
Cloud: `https://learnandbuild.org/api/auth/auth/oidc/google/callback`. Add
`https://learnandbuild.org` as an authorized JavaScript origin, then set the
client ID and secret in `deploy/.env.production` and restart the auth service.

## Provider service (port 3002)

The provider service (the `teacher` service internally; reached from the web app
under `/api/provider`) manages provider profiles with PostGIS location, a full
onboarding + availability questionnaire, S3 document uploads, and an
admin-driven verification state machine (`pending → submitted → under_review →
approved/rejected`, with resubmit from `rejected`).

| Method | Route                            | Auth          | Purpose                            |
| ------ | -------------------------------- | ------------- | ---------------------------------- |
| GET    | /teachers/me                     | JWT + TEACHER | Fetch own profile                  |
| PUT    | /teachers/me                     | JWT + TEACHER | Create/update own profile (upsert) |
| POST   | /teachers/me/documents/presign   | JWT + TEACHER | Get a presigned S3 upload URL      |
| POST   | /teachers/me/documents           | JWT + TEACHER | Attach an uploaded document        |
| POST   | /teachers/me/submit              | JWT + TEACHER | Submit profile for review          |
| GET    | /teachers/nearby?lat&lng&radius  | JWT           | Find approved providers nearby     |
| GET    | /admin/teachers?status=submitted | JWT + ADMIN   | List profiles by status            |
| POST   | /admin/teachers/:id/start-review | JWT + ADMIN   | Move to under_review               |
| POST   | /admin/teachers/:id/approve      | JWT + ADMIN   | Approve                            |
| POST   | /admin/teachers/:id/reject       | JWT + ADMIN   | Reject (with optional reason)      |

The admin approve/reject actions are wired to the shared role guards from
`@learn-and-build/nest-auth`, the same guards the auth service uses.

### Provider onboarding + availability

`PUT /teachers/me` accepts the full provider questionnaire in addition to the
core `displayName`/`bio`/`subjects`/`location` fields. Every field is optional
and validated against shared enums in `@learn-and-build/types`; the upsert is
partial-save safe, so saving one section never clears answers from another.

Captured fields include: contact (`phone`, `email`), `ageBand`, `locality`,
`city`; what they teach (`category`, `subcategories`, `skills`,
`skillDescription`, `yearsExperience`); portfolio + child experience
(`portfolio`, `childrenExperience`, `childrenExperienceDetail`); teaching
preferences (`childAgeGroups`, `teachingFormats`, `venuePreferences`,
`travelRadius`); and availability (`availableDays`, `timeSlots`,
`preferredAvailability`, `sessionFrequency`, `whyJoin`).

Enum-valued fields are stored as varchar and array (checkbox) fields as
`text[]`; all are nullable/defaulted, so existing profiles migrate cleanly
under TypeORM `synchronize` in dev. Exercise the register → upsert → read-back
flow (stack running): `node scripts/verify-provider-profile.mjs`.

**Category taxonomy → discovery.** `PROVIDER_CATEGORY_TAXONOMY` (in
`@learn-and-build/types`) is the single source of truth mapping each provider
category (Music, Dance, Art & Craft, STEM, Stories & Culture, Sports & Fitness,
Life & Wellbeing) to its subcategories (e.g. Music → Carnatic music) and to the
discover/home category tile it should surface under (`discoverQuery`). The web
app's discover categories derive their mapping from the same taxonomy via
`discoverCategoryForProvider()`, keeping provider categories aligned with how
customers browse and search.

### Portfolio document uploads (S3)

Portfolio/resume PDFs use the direct-to-S3 flow: presign
(`POST /teachers/me/documents/presign`) → `PUT` the bytes to the returned URL →
confirm (`POST /teachers/me/documents`). The shared API client wraps all three
steps in `ApiClient.uploadTeacherDocument(file, type)`. Presigning requires the
service to have AWS credentials and a bucket (`DOCUMENTS_BUCKET`); for local
dev, point it at MinIO/LocalStack with `S3_ENDPOINT` (path-style addressing is
enabled automatically when set).

#### Local uploads against real S3 (no MinIO)

The provider (`teacher`) service signs S3 presigned upload URLs, so it needs AWS
credentials, the bucket name, and the bucket's region. Provide all three through
the git-ignored root `.env` file so the `docker compose` teacher container reads
them — do not rely on your shell's ambient AWS variables. To exercise real
uploads locally against the `providers-profiles` bucket (region `ap-southeast-2`):

1. **Put the credentials, bucket, and region in `.env`** (repo root, git-ignored).
   `docker-compose.yml` passes these into the teacher container:

   ```bash
   # .env  (never commit this)
   DOCUMENTS_BUCKET=providers-profiles
   AWS_REGION=ap-southeast-2
   AWS_ACCESS_KEY_ID=<key for the account that owns the bucket>
   AWS_SECRET_ACCESS_KEY=<secret>
   # AWS_SESSION_TOKEN=<only for temporary/STS credentials>
   ```

   > **Do not let stale shell variables win.** Docker Compose gives variables
   > already exported in your shell precedence over the `.env` file. A leftover
   > `AWS_REGION=us-east-1` (or old `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`,
   > or an `AWS_PROFILE` with no matching profile) will silently override `.env`,
   > and the teacher will sign URLs for the wrong region/keys — the browser `PUT`
   > then fails. Check with `env | grep -i aws` and clear them, or run compose
   > with a clean environment:
   >
   > ```bash
   > env -u AWS_REGION -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN -u AWS_PROFILE \
   >   docker compose up -d --build teacher
   > ```

2. **Recreate the teacher container** so it picks up the `.env` values, then
   confirm the region and credentials landed:

   ```bash
   docker compose up -d --force-recreate teacher
   docker compose exec teacher sh -c 'echo region=$AWS_REGION bucket=$DOCUMENTS_BUCKET key=${AWS_ACCESS_KEY_ID:+set}'
   # expect: region=ap-southeast-2 bucket=providers-profiles key=set
   ```

3. **Bucket CORS.** The browser `PUT`s straight to S3, so the bucket must allow
   the dev origin or the upload fails with a browser `Failed to fetch`. Add
   `http://localhost:3100` (and `http://localhost:3000`) to the bucket CORS
   alongside the production origins:

   ```bash
   aws s3api put-bucket-cors --bucket providers-profiles \
     --region ap-southeast-2 --profile default \
     --cors-configuration file://deploy/s3-cors.json
   ```

   Use a CORS document that keeps the production origins and adds the localhost
   dev origins (`PUT`, `GET`, `HEAD`). Verify with
   `aws s3api get-bucket-cors --bucket providers-profiles --region ap-southeast-2`.

**Auto-submit on upload.** Confirming a document (`POST /teachers/me/documents`)
automatically submits the profile for review — a `PENDING` or `REJECTED`
profile transitions to `SUBMITTED` as soon as a document is attached, provided
all required fields are complete (full name, phone, email, locality, city,
primary category, teaching skills, skill description, and reason for joining).
An incomplete profile is left as-is so the provider can finish it; a `REJECTED`
profile has its rejection reason cleared on resubmit. The move is recorded in
the moderation audit and sends the provider an in-app notification. The manual
`POST /teachers/me/submit` endpoint remains as an explicit resubmit/fallback,
and admins still drive `start-review → approve/reject` from there.

> **AWS credentials for S3 uploads.** Provider portfolios are stored in the
> **`providers-profiles`** S3 bucket. The provider service signs the upload
> URLs, so it needs credentials for the account that owns the bucket. Set
> `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=ap-southeast-2`, and
> `DOCUMENTS_BUCKET=providers-profiles` in the git-ignored root `.env` (see the
> step above), not via ambient shell variables — Compose lets stale shell
> exports override `.env`. Without valid credentials, presigning fails with
> `Could not load credentials from any providers` (HTTP 500 on the presign
> call). In production on EC2, leave the keys unset and attach an instance role
> instead.

#### Configure real AWS S3 for local development

The following setup uses AWS account `960763460353`, bucket
`providers-profiles`, and region `ap-southeast-2`. Replace these values if you
use a different account or bucket. Do not commit credentials or put them in
`.env.example`.

1. Create the bucket in the S3 console, or with the CLI. S3 bucket names are
   globally unique:

   ```bash
   aws s3api create-bucket \
     --bucket providers-profiles \
     --region ap-southeast-2 \
     --create-bucket-configuration LocationConstraint=ap-southeast-2 \
     --profile learnbuild
   ```

   Keep **Block all public access** enabled. Presigned URLs do not require a
   public bucket.

2. Give the provider-service IAM identity permission to upload only under the
   provider document prefix. In IAM, open **Users** → `likhilearnbuild` →
   **Add permissions** → **Create inline policy** → **JSON**, and use:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "UploadProviderDocuments",
         "Effect": "Allow",
         "Action": "s3:PutObject",
         "Resource": "arn:aws:s3:::providers-profiles/teachers/*"
       }
     ]
   }
   ```

   An administrator must apply this policy if the IAM user cannot manage its
   own permissions. A bucket policy is not required when the IAM identity
   policy grants access in the same account.

3. Configure bucket CORS so the browser can send the presigned `PUT`. Save the
   following as `s3-cors.json` and apply it:

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "http://localhost:3100"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

   ```bash
   aws s3api put-bucket-cors \
     --bucket providers-profiles \
     --cors-configuration file://s3-cors.json \
     --profile learnbuild \
     --region ap-southeast-2
   ```

4. Authenticate locally with IAM Identity Center. This uses short-lived
   credentials and is preferred over creating long-lived access keys:

   ```bash
   aws sso login --profile learnbuild
   eval "$(aws configure export-credentials \
     --profile learnbuild \
     --format env)"
   ```

   The profile must be assigned to account `960763460353` with a permission
   set that allows the S3 actions above. If SSO is not available, an
   administrator can issue an IAM user access key; never create root access
   keys and never commit the secret.

5. Start the provider service with the bucket and region. `docker-compose.yml`
   passes these host environment variables into the container (the compose
   service is named `teacher`):

   ```bash
   export DOCUMENTS_BUCKET=providers-profiles
   export AWS_REGION=ap-southeast-2
   docker compose up -d --build teacher
   ```

6. Verify identity, bucket access, and the provider service health endpoint:

   ```bash
   aws sts get-caller-identity --profile learnbuild
   aws s3api head-bucket \
     --bucket providers-profiles \
     --profile learnbuild \
     --region ap-southeast-2
   curl http://localhost:3002/health
   ```

   If uploads fail, check that the S3 region matches `AWS_REGION`, the IAM
   resource includes `teachers/*`, and the browser origin is listed in CORS.
   SSO credentials expire, so repeat the login and `export-credentials` steps
   when the session expires.

## Scheduling service (port 3004)

Verified providers publish classes (activity, description, instructor gender,
duration, seats) with recurring weekly timings; an availability query expands
them into concrete upcoming occurrences with seat counts.

| Method | Route                          | Auth          | Purpose                      |
| ------ | ------------------------------ | ------------- | ---------------------------- |
| POST   | /classes                       | JWT + TEACHER | Publish a class              |
| GET    | /classes/mine                  | JWT + TEACHER | A provider's own classes     |
| GET    | /classes/:id                   | public        | Class details                |
| GET    | /classes/:id/availability?days | public        | Upcoming occurrences + seats |
| GET    | /classes/discover              | public        | Discovery cards + live seats |
| GET    | /classes/slug/:slug            | public        | Resolve a public class slug  |
| POST   | /classes/:id/reservations      | JWT           | Atomically reserve seats     |
| DELETE | /classes/:id/reservations/:id  | JWT           | Cancel and release seats     |

Timings are validated to a daily operating window: any day of the week
(Mon-Sun) with each session fitting inside 07:00-22:00. This supports weekend
and daytime classes (e.g. a Saturday 10:00 storytelling class) alongside
weekday evenings. Create a sample weekend class end to end (stack running):
`node scripts/create-puppetry-listing.mjs`.
The reservation transaction takes a row lock on the class offering, validates
the occurrence, sums active reservations, and rejects requests beyond capacity.
This table and index are part of the consolidated schema migration
(`deploy/migrations/0001_init_schema.sql`), applied by `pnpm db:migrate`.

## Search service (port 3003)

Hybrid semantic + keyword search over classes, geo-filtered to a radius
(default 5 km) via PostGIS `ST_DWithin`. Classes are indexed into OpenSearch
(keyword fields + embedding vector); ranking combines a concept-expanded
keyword score with embedding cosine similarity. A "text path" concept map lets
a query for "martial arts" match a "Jiu Jitsu" class. Re-indexing runs
asynchronously via an EventBridge -> SQS consumer (enabled when `SQS_QUEUE_URL`
is set) plus an admin-triggered full reindex.

| Method | Route                        | Auth        | Purpose                        |
| ------ | ---------------------------- | ----------- | ------------------------------ |
| GET    | /search?q=&lat=&lng=&radius= | public      | Ranked classes within radius   |
| POST   | /search/index                | JWT + ADMIN | Index a single class           |
| POST   | /search/reindex              | JWT + ADMIN | Full reindex from the database |

The search service bootstraps its local index from Scheduling when the index is
empty. Try the full flow (stack running): `node scripts/demo-search.mjs`.

## Customer web app and admin console (apps/web)

```bash
# Terminal 1: database, search, scheduling, and customer APIs
docker compose up --build postgres redis opensearch scheduling search auth

# Terminal 2: Next.js app
pnpm --filter @learn-and-build/web dev
```

Open http://localhost:3100. Create an account from **Profile** to sync child
profiles, saved classes, bookings, and notifications through the auth service.
Signed-out visitors retain a local-device fallback. Point the app at a custom
auth service URL with `NEXT_PUBLIC_AUTH_API_URL` (defaults to
`http://localhost:3001`). The admin console remains available at `/admin`.

Discovery reads live cards and availability from Scheduling and uses Search for
ranked text queries. Its Map and class-detail map use MapLibre with OpenFreeMap
tiles by default. Set `NEXT_PUBLIC_MAPBOX_TOKEN` to use Mapbox Streets instead.

### Provider page (`/provider`)

`/provider` (linked from the home page) is the single provider surface where an
educator signs in or creates a provider account (role `teacher`). A family
account can be signed out and re-created as a provider. It captures the full
provider profile:

- Teaching category (with subcategories from the shared taxonomy), a two-month
  availability calendar (specific dates with one-hour 9am–9pm slots and a
  selected-days summary), home location (browser GPS or address search via
  OpenStreetMap Nominatim, resolved to coordinates), max commute distance, and
  public class-profile links (Instagram, Preply, UrbanPro, TeacherOn, plus an
  other/portfolio link).
- A profile must be saved before its portfolio PDF can be uploaded. Uploading a
  document auto-submits the profile for review once required fields are complete
  (see “Auto-submit on upload” above), so there is no separate submit step in
  the common case. Reads/writes the shared `TeacherProfile` via the provider
  client.

The provider client calls are proxied by the Next server under `/api/provider`
to the provider (teacher) service (override the origin with
`PROVIDER_SERVICE_ORIGIN`, or the browser base URL with
`NEXT_PUBLIC_PROVIDER_API_URL`; defaults to `http://localhost:3002`). The former
separate `/teacher` studio route has been retired; the provider page now lives
entirely at `/provider`.

### Class studio (`/provider/classes`)

Once a provider is signed in, `/provider/classes` is the class-management and
operations studio (linked from `/provider` and the provider bottom nav):

- **Class publishing** — create/edit recurring class offerings (name, category,
  ages, price, duration, seats, venue + coordinates, cover image, weekend
  schedule, discovery keywords) through the scheduling service, with a list
  showing moderation/status and pause/resume/unpublish actions.
- **Operations & earnings** — upcoming/recent sessions, session roster and
  attendance, reschedule/cancel, plus an earnings panel (`#earnings` anchor)
  with available payout, net earnings, and payout history.

Class data uses the scheduling service; operations use the auth service’s
provider routes (`/provider/sessions`, `/provider/classes/:id/roster`,
`/provider/bookings/:id/attendance`, `/provider/classes/:id/occurrences/change`)
and the payments service (`/payments/provider/earnings`,
`/payments/provider/payouts`). A class cannot be approved for families until the
provider profile is approved.

## Infrastructure (CDK)

```bash
cd infra/cdk
pnpm synth
```
