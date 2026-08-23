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

## Getting started

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## Local infrastructure & services

```bash
docker compose up --build
```

This boots Postgres+PostGIS, OpenSearch, Redis, and all NestJS services.
Each service exposes a health endpoint:

| Service     | Port | Health URL                  |
| ----------- | ---- | --------------------------- |
| auth        | 3001 | http://localhost:3001/health |
| teacher     | 3002 | http://localhost:3002/health |
| search      | 3003 | http://localhost:3003/health |
| scheduling  | 3004 | http://localhost:3004/health |
| voice       | 3005 | http://localhost:3005/health |
| meetings    | 3006 | http://localhost:3006/health |
| payments    | 3007 | http://localhost:3007/health |

All `/health` endpoints return HTTP 200 with `{ "status": "ok", "service": "<name>" }`.

> Note: the `auth` and `teacher` services open a Postgres connection at
> startup, so their `/health` is available once Postgres is reachable (it is,
> under docker compose). The skeleton services have no dependencies and boot
> standalone.

## Auth service (port 3001)

Roles: `user`, `teacher`, `admin` (shared `Role` enum in `@learn-and-build/types`).

| Method | Route                      | Auth                | Purpose                         |
| ------ | -------------------------- | ------------------- | ------------------------------- |
| POST   | /auth/register             | public              | Sign up (USER or TEACHER only)  |
| POST   | /auth/login                | public              | Get a JWT                       |
| GET    | /auth/me                   | JWT                 | Current user                    |
| GET    | /admin/users               | JWT + ADMIN         | List users                      |
| PATCH  | /admin/users/:id/role      | JWT + ADMIN         | Change a user's role            |

Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` to seed an initial admin on first boot.

### Customer account data

The customer UI stores data in PostgreSQL whenever a user signs in. Every
route below requires a bearer JWT and is scoped to that user.

| Method | Route                                  | Purpose                         |
| ------ | -------------------------------------- | ------------------------------- |
| GET    | /customer/children                     | List child profiles             |
| POST   | /customer/children                     | Create a child profile          |
| PATCH  | /customer/children/:id                 | Update an owned child profile   |
| GET    | /customer/saved-classes                | List saved classes              |
| PUT    | /customer/saved-classes/:classRef      | Save a class (idempotent)       |
| DELETE | /customer/saved-classes/:classRef      | Remove a saved class            |
| GET    | /customer/bookings                     | List booking snapshots          |
| POST   | /customer/bookings                     | Confirm a demo trial booking    |
| PATCH  | /customer/bookings/:id/cancel          | Cancel an owned booking         |
| GET    | /customer/notifications                | List in-app notifications       |
| PATCH  | /customer/notifications/:id/read       | Mark one notification as read   |
| POST   | /customer/notifications/read-all       | Mark all notifications as read  |

Booking and profile actions create notifications automatically. The current
booking endpoint persists the customer-facing trial booking; payment capture
and transactional seat reservation are intentionally not claimed by this API.

### OIDC (Google + AWS Cognito)

The auth service also supports OIDC login via Google and AWS Cognito
(Authorization Code + PKCE, using `openid-client`). Providers are enabled only
when their env vars are set, so it degrades gracefully to password-only.

| Method | Route                          | Purpose                                   |
| ------ | ------------------------------ | ----------------------------------------- |
| GET    | /auth/oidc/providers           | List enabled providers (for UI buttons)   |
| GET    | /auth/oidc/:provider/login     | 302 redirect to the provider              |
| GET    | /auth/oidc/:provider/callback  | Exchange code, then redirect to console   |

On success the browser is redirected to `OIDC_SUCCESS_REDIRECT` with the JWT in
the URL fragment (`#access_token=...`); the admin console reads it on load.
External identities are linked to a local user (matched by email, else created
as a `user`). Configure via `GOOGLE_CLIENT_ID/SECRET` and
`AWS_COGNITO_ISSUER` + `AWS_COGNITO_CLIENT_ID/SECRET` (see `.env.example`).
Set each provider's redirect URI to
`${OIDC_REDIRECT_BASE}/auth/oidc/<google|aws>/callback`.

## Teacher service (port 3002)

Profiles with PostGIS location, S3 document uploads, and an admin-driven
verification state machine (`pending → submitted → under_review →
approved/rejected`, with resubmit from `rejected`).

| Method | Route                              | Auth          | Purpose                          |
| ------ | ---------------------------------- | ------------- | -------------------------------- |
| PUT    | /teachers/me                       | JWT + TEACHER | Create/update own profile        |
| POST   | /teachers/me/documents/presign     | JWT + TEACHER | Get a presigned S3 upload URL    |
| POST   | /teachers/me/documents             | JWT + TEACHER | Attach an uploaded document      |
| POST   | /teachers/me/submit                | JWT + TEACHER | Submit profile for review        |
| GET    | /teachers/nearby?lat&lng&radius    | JWT           | Find approved teachers nearby    |
| GET    | /admin/teachers?status=submitted   | JWT + ADMIN   | List profiles by status          |
| POST   | /admin/teachers/:id/start-review   | JWT + ADMIN   | Move to under_review             |
| POST   | /admin/teachers/:id/approve        | JWT + ADMIN   | Approve                          |
| POST   | /admin/teachers/:id/reject         | JWT + ADMIN   | Reject (with optional reason)    |

The admin approve/reject actions are wired to the shared role guards from
`@learn-and-build/nest-auth`, the same guards the auth service uses.

## Scheduling service (port 3004)

Verified teachers publish classes (activity, description, instructor gender,
duration, seats) with recurring weekday-evening timings; an availability query
expands them into concrete upcoming occurrences with seat counts.

| Method | Route                          | Auth          | Purpose                       |
| ------ | ------------------------------ | ------------- | ----------------------------- |
| POST   | /classes                       | JWT + TEACHER | Publish a class               |
| GET    | /classes/mine                  | JWT + TEACHER | A teacher's own classes       |
| GET    | /classes/:id                   | public        | Class details                 |
| GET    | /classes/:id/availability?days | public        | Upcoming occurrences + seats  |

Timings are validated to weekday evenings (Mon-Fri, fitting inside 17:00-22:00).

## Search service (port 3003)

Hybrid semantic + keyword search over classes, geo-filtered to a radius
(default 5 km) via PostGIS `ST_DWithin`. Classes are indexed into OpenSearch
(keyword fields + embedding vector); ranking combines a concept-expanded
keyword score with embedding cosine similarity. A "text path" concept map lets
a query for "martial arts" match a "Jiu Jitsu" class. Re-indexing runs
asynchronously via an EventBridge -> SQS consumer (enabled when `SQS_QUEUE_URL`
is set) plus an admin-triggered full reindex.

| Method | Route                              | Auth        | Purpose                        |
| ------ | ---------------------------------- | ----------- | ------------------------------ |
| GET    | /search?q=&lat=&lng=&radius=       | public      | Ranked classes within radius   |
| POST   | /search/index                      | JWT + ADMIN | Index a single class           |
| POST   | /search/reindex                    | JWT + ADMIN | Full reindex from the database  |

Try the full flow (stack running): `node scripts/demo-search.mjs`.

## Customer web app and admin console (apps/web)

```bash
# Terminal 1: database, Redis, and the API used by the customer UI
docker compose up --build postgres redis auth

# Terminal 2: Next.js app
pnpm --filter @learn-and-build/web dev
```

Open http://localhost:3100. Create an account from **Profile** to sync child
profiles, saved classes, bookings, and notifications through the auth service.
Signed-out visitors retain a local-device fallback. Point the app at a custom
auth service URL with `NEXT_PUBLIC_AUTH_API_URL` (defaults to
`http://localhost:3001`). The admin console remains available at `/admin`.

## Infrastructure (CDK)

```bash
cd infra/cdk
pnpm synth
```
