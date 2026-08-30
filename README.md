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

### 4. Start the web app (separate terminal)

```bash
pnpm --filter @learn-and-build/web dev
```

Open http://localhost:3100. The customer app, admin console (`/admin`), and the
provider onboarding page (`/provider`) are all served here.

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

| Method | Route                 | Auth        | Purpose                        |
| ------ | --------------------- | ----------- | ------------------------------ |
| POST   | /auth/register        | public      | Sign up (USER or TEACHER only) |
| POST   | /auth/login           | public      | Get a JWT                      |
| GET    | /auth/me              | JWT         | Current user                   |
| GET    | /admin/users          | JWT + ADMIN | List users                     |
| PATCH  | /admin/users/:id/role | JWT + ADMIN | Change a user's role           |

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
the customer record. Payment capture remains a separate, unfinished concern.

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

## Teacher service (port 3002)

Provider (teacher) profiles with PostGIS location, a full onboarding +
availability questionnaire, S3 document uploads, and an admin-driven
verification state machine (`pending → submitted → under_review →
approved/rejected`, with resubmit from `rejected`).

| Method | Route                            | Auth          | Purpose                            |
| ------ | -------------------------------- | ------------- | ---------------------------------- |
| GET    | /teachers/me                     | JWT + TEACHER | Fetch own profile                  |
| PUT    | /teachers/me                     | JWT + TEACHER | Create/update own profile (upsert) |
| POST   | /teachers/me/documents/presign   | JWT + TEACHER | Get a presigned S3 upload URL      |
| POST   | /teachers/me/documents           | JWT + TEACHER | Attach an uploaded document        |
| POST   | /teachers/me/submit              | JWT + TEACHER | Submit profile for review          |
| GET    | /teachers/nearby?lat&lng&radius  | JWT           | Find approved teachers nearby      |
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

> **AWS credentials for S3 uploads.** Teacher portfolios are stored in the
> **`providers-profiles`** S3 bucket in AWS account **960763460353**. The
> teacher service signs the upload URLs, so it needs credentials for that
> account: export the profile from
> [AWS profile setup (macOS)](#aws-profile-setup-macos)
> (`export AWS_PROFILE=learnbuild`) before starting the service, and set
> `DOCUMENTS_BUCKET=providers-profiles`. Without valid credentials, presigning
> fails with `Could not load credentials from any providers` (HTTP 500 on the
> presign call). See the step-by-step setup below.

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

2. Give the teacher-service IAM identity permission to upload only under the
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

5. Start the teacher service with the bucket and region. `docker-compose.yml`
   passes these host environment variables into the container:

   ```bash
   export DOCUMENTS_BUCKET=providers-profiles
   export AWS_REGION=ap-southeast-2
   docker compose up -d --build teacher
   ```

6. Verify identity, bucket access, and the teacher health endpoint:

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

Verified teachers publish classes (activity, description, instructor gender,
duration, seats) with recurring weekly timings; an availability query expands
them into concrete upcoming occurrences with seat counts.

| Method | Route                          | Auth          | Purpose                      |
| ------ | ------------------------------ | ------------- | ---------------------------- |
| POST   | /classes                       | JWT + TEACHER | Publish a class              |
| GET    | /classes/mine                  | JWT + TEACHER | A teacher's own classes      |
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
Production environments with schema sync disabled should apply
`infra/sql/20260823_discovery_reservations.sql` during deployment.

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

### Provider onboarding page (`/provider`)

`/provider` (linked from the home page) lets an educator sign in or create a
provider account (role `teacher`) and complete a five-section onboarding +
availability form covering all provider fields, including a category selector
that reveals matching subcategories from the shared taxonomy and a portfolio
PDF upload. It reads/writes the teacher service via `createTeacherClient()`,
which the Next server proxies to the teacher service at `/api/teacher`
(override the origin with `TEACHER_SERVICE_ORIGIN`, or the browser base URL
with `NEXT_PUBLIC_TEACHER_API_URL`; defaults to `http://localhost:3002`).

## Infrastructure (CDK)

```bash
cd infra/cdk
pnpm synth
```
