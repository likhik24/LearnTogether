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

The `apps/web` admin console shell (Next.js) and the `auth` / `teacher`
services are implemented; the remaining services are health-check skeletons.

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

## Admin console shell (apps/web)

```bash
pnpm --filter @learn-and-build/web dev   # http://localhost:3100
```

A minimal Next.js console: sign in as an admin, list users, and change roles.
Point it at the auth service with `NEXT_PUBLIC_AUTH_API_URL`.

## Infrastructure (CDK)

```bash
cd infra/cdk
pnpm synth
```
