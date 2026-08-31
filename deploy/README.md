# Production deployment

The production topology exposes only the Next.js web container. It publishes
port 3100 on the host (bound to `WEB_BIND`, loopback by default); put an
external reverse proxy such as nginx, Caddy, or a load balancer in front of it
to terminate TLS and serve the public hostname. All APIs and data services
remain on a private Docker network, and Next rewrites `/api/*` requests to the
appropriate service.

## First deployment

1. Use a clean clone of the repository on the server.
2. Run `node scripts/generate-production-env.mjs`.
3. Edit `deploy/.env.production` locally on the server:
   - set `WEB_BIND` (loopback for a fronting reverse proxy, or `0.0.0.0` to
     publish the web port directly on the host);
   - confirm the admin email;
   - confirm the S3 bucket and AWS region;
   - add optional OIDC credentials only when needed.
   - set `AUTH_EMAIL_FROM` to an address on an SES-verified domain.
   - add the Razorpay key ID, key secret, and a separately generated webhook
     secret. Start with Test Mode credentials until the complete checkout and
     refund flow has been verified.
   - keep the generated `INTERNAL_SERVICE_SECRET` private; it authorizes the
     auth service—not browsers—to request refunds from the payments service.
   - leave `DB_SYNCHRONIZE=false`. The schema is owned by the migrations; never
     enable `synchronize` against real data.
   - confirm `POSTGRES_DATA_DIR` points at a durable host path and create it
     once so the database persists across container recreation and redeploys:

     ```bash
     sudo mkdir -p /opt/learn-and-build/postgres
     ```
4. Allow the production web origins to upload provider PDFs directly through
   presigned URLs:

   ```bash
   aws s3api put-bucket-cors \
     --bucket "$DOCUMENTS_BUCKET" \
     --cors-configuration file://deploy/s3-cors.json
   ```

5. Start the stack. Keep `DB_SYNCHRONIZE=false` (the default in production).
   The one-shot `migrate` service applies `deploy/migrations/0001_init_schema.sql`,
   which builds the entire schema from an empty database and is idempotent, so
   it works for both a brand-new database and an existing one. It completes
   before the database-backed application services (`auth`, `teacher`,
   `scheduling`, `payments`) are allowed to start. Then verify the migration and
   endpoint health:

   ```bash
   docker compose \
     --env-file deploy/.env.production \
     -f deploy/docker-compose.production.yml \
     up -d --build

   docker compose \
     --env-file deploy/.env.production \
     -f deploy/docker-compose.production.yml \
     logs migrate

   docker compose \
     --env-file deploy/.env.production \
     -f deploy/docker-compose.production.yml \
     ps

   docker compose \
     --env-file deploy/.env.production \
     -f deploy/docker-compose.production.yml \
     exec web node -e \
     "fetch('http://localhost:3100').then(async r=>{console.log(r.status);process.exit(r.ok?0:1)})"
   ```

The migrations are the single source of truth for the schema. Never enable
`DB_SYNCHRONIZE` in production; schema changes go through a reviewed migration
file applied by the `migrate` service.

## Updating an existing deployment

> One-time migration for deployments created before Postgres used a host bind
> mount: the data previously lived in the `..._postgres_data` Docker volume.
> Before switching to `POSTGRES_DATA_DIR`, copy it across so no data is lost —
> back up first (`scripts/db-backup.sh`), stop the stack, copy the old volume's
> contents into the new `POSTGRES_DATA_DIR/pgdata`, then start again. If unsure,
> restore from a dump into the fresh bind mount with `scripts/db-restore.sh`.

Pull the reviewed release and rebuild the stack. The one-shot `migrate`
service runs transactional, idempotent migrations before auth, scheduling, and
the provider (`teacher`) services are allowed to start.

```bash
docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  up -d --build

docker compose \
  --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml \
  logs migrate
```

For an explicit operator-run migration or recovery, run the tracked runner
against the database directly (it records applied migrations in
`schema_migrations` and skips ones already applied):

```bash
DATABASE_URL="postgres://learnbuild:<password>@<host>:5432/learnbuild" \
  PGSSLMODE=require pnpm db:migrate
```

`scripts/run-production-migrations.sh` remains available as a psql-based
alternative. A failed migration exits non-zero and prevents dependent services
from starting; do not bypass that gate.

### Automatic deployment after merge

`.github/workflows/deploy-production.yml` rebuilds this stack only after the
`CI` workflow succeeds on `main` (or on a manual dispatch) through AWS Systems
Manager—no inbound SSH port or long-lived AWS access key is required. Configure the GitHub `production`
environment with:

- variable `PRODUCTION_DEPLOY_ENABLED=true`;
- variable `AWS_REGION` (for example `ap-southeast-2`);
- variable `EC2_INSTANCE_ID`;
- variable `PRODUCTION_REPO_PATH` (the absolute clean-clone path on EC2);
- secret `AWS_DEPLOY_ROLE_ARN`, trusted for GitHub OIDC and permitted to call
  `ssm:SendCommand`/`ssm:GetCommandInvocation` for that instance.

The EC2 instance must be managed by SSM and its instance role must include
`AmazonSSMManagedInstanceCore`. Leave `PRODUCTION_DEPLOY_ENABLED` unset until
the role, instance variables, and a manual `workflow_dispatch` run have been
verified. The production environment should require reviewer approval if you
want a human gate between merge and deployment.

## Razorpay activation

In the Razorpay dashboard, create a webhook pointing to:

`https://learnandbuild.org/api/payments/payments/webhooks/razorpay`

Subscribe to `payment.captured`, `payment.failed`, and `order.paid`, and use the
same webhook secret stored as `RAZORPAY_WEBHOOK_SECRET`. Test successful
payment, declined payment, checkout dismissal and retry, abandoned-seat expiry,
and a paid booking cancellation/refund before replacing Test Mode keys with
Live Mode keys. Never put the Razorpay key secret or webhook secret in a
`NEXT_PUBLIC_*` variable.

## Public ingress and TLS

The web container publishes port 3100 on the host at `WEB_BIND` (loopback by
default). Serve it publicly with a TLS-terminating reverse proxy in front —
for example nginx or Caddy on the same host, or an application load balancer:

- point the reverse proxy `upstream`/target at `127.0.0.1:3100`
  (or the host IP if you set `WEB_BIND=0.0.0.0` behind a firewall);
- obtain and renew a certificate for the public hostname
  (e.g. `learnandbuild.org`) at the proxy;
- forward both `learnandbuild.org` and `www.learnandbuild.org` to the same
  upstream, or redirect `www` to the apex at the proxy.

Because the whole platform is served from this single origin (Next rewrites
`/api/*` to the private backend services), only this one port needs to be
exposed.

## Data persistence and backups

All durable application data — user accounts and profiles, child profiles,
provider profiles and documents metadata, classes, reservations, bookings,
payments, payouts, reviews and notifications — lives in PostgreSQL. The
production Postgres service bind-mounts its data directory to the host path in
`POSTGRES_DATA_DIR` (default `/opt/learn-and-build/postgres`), so the data
survives:

- `docker compose restart` / `up -d --build` / `--force-recreate`;
- container removal and image upgrades;
- `docker compose down` and even `docker compose down -v` (a bind mount is not
  a Docker volume, so `-v` does not delete it).

Because the schema is owned by the reviewed migrations and services run with
`DB_SYNCHRONIZE=false`, redeploying never rewrites or drops existing data —
migrations only add what is missing.

Redis (sessions/cache) and OpenSearch (search index) hold derived state that
rebuilds from Postgres, so they use named volumes and are safe to lose.

### Back up

Take regular logical backups (and always before an upgrade). From the repo root:

```bash
scripts/db-backup.sh                 # writes ./backups/learnbuild-<timestamp>.dump
```

Schedule it, e.g. a daily cron entry on the server:

```cron
15 2 * * *  cd /opt/learn-and-build/app && scripts/db-backup.sh >> /var/log/lb-backup.log 2>&1
```

Copy the dump (and, if you want a physical copy, the `POSTGRES_DATA_DIR` while
the stack is stopped) to off-box storage such as S3.

### Restore / move to a new machine

On the new machine: clone the repo, create `deploy/.env.production` with the
**same** `POSTGRES_PASSWORD`, create `POSTGRES_DATA_DIR`, then either copy the
old data directory into it (stack stopped) or restore a dump:

```bash
# Bring up only Postgres first
docker compose --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml up -d postgres

scripts/db-restore.sh backups/learnbuild-<timestamp>.dump

# Then start the rest of the stack
docker compose --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml up -d --build
```

The `migrate` service is idempotent, so it is safe to run against the restored
database.

> Danger: never run `docker volume rm` on the data or point `POSTGRES_DATA_DIR`
> at a fresh empty path on an existing deployment — either starts the database
> from empty. There is no automatic re-seed of real data.

## Security notes

- Only the web port (3100) is published, bound to `WEB_BIND` (loopback by
  default). No database, Redis, OpenSearch, or backend API port is exposed on
  the host — they stay on the private Docker network.
- Terminate TLS at the reverse proxy in front of the web port; do not serve the
  app over plain HTTP publicly.
- Use an EC2 instance role for S3 rather than static AWS access keys.
- Keep `deploy/.env.production` mode `0600` and outside Git.
- Build from a clean clone. `.dockerignore` excludes PDF, DOCX, and temporary
  signing directories as an additional safeguard.
