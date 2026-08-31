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

   > **Let `.env.production` be the source of truth for AWS settings.** Docker
   > Compose gives variables already exported in your shell precedence over
   > `--env-file`. If your shell exports `AWS_REGION`, `AWS_ACCESS_KEY_ID`, or
   > `AWS_SECRET_ACCESS_KEY` (common on developer machines, or a stale
   > `AWS_REGION=us-east-1`), those values silently override the ones in
   > `.env.production` — the teacher service then signs S3 upload URLs for the
   > wrong region or with the wrong keys and portfolio/class-image uploads fail.
   > Put the real values in `.env.production` and run compose with a clean
   > environment so they win. Either unset the stale variables for the command:
   >
   > ```bash
   > env -u AWS_REGION -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN -u AWS_PROFILE \
   >   docker compose --env-file deploy/.env.production \
   >   -f deploy/docker-compose.production.yml up -d --build
   > ```
   >
   > or ensure they are not exported in the deploy shell at all (check with
   > `env | grep -i aws`). On EC2 with an instance role, leave the AWS key
   > variables blank in `.env.production` and unset in the shell so the SDK uses
   > the role.

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

`https://www.learnandbuild.org/api/payments/payments/webhooks/razorpay`

Subscribe to `payment.captured`, `payment.failed`, and `order.paid`, and use the
same webhook secret stored as `RAZORPAY_WEBHOOK_SECRET`. Test successful
payment, declined payment, checkout dismissal and retry, abandoned-seat expiry,
and a paid booking cancellation/refund before replacing Test Mode keys with
Live Mode keys. Never put the Razorpay key secret or webhook secret in a
`NEXT_PUBLIC_*` variable.

## Go live at https://www.learnandbuild.org

The web container publishes port 3100 on the host loopback (`WEB_BIND=127.0.0.1`).
A Caddy reverse proxy on the same host terminates TLS for the public hostname,
auto-provisions a Let's Encrypt certificate, and forwards to `127.0.0.1:3100`.
Because Next rewrites `/api/*` to the private backend services, this single
origin serves the whole platform.

Canonical origin: **`https://www.learnandbuild.org`** (the apex
`learnandbuild.org` 301-redirects to it). This is set via `PUBLIC_ORIGIN` in
`.env.production` and used for CORS, OIDC redirects, and app links.

Do these in order. Steps that touch AWS, DNS, or the domain registrar must be
run by you with your credentials.

### 1. Provision the host

Deploy `deploy/ec2-origin.yml` (t3.large min). It creates a public-subnet EC2
instance, a security group allowing inbound **80 and 443** (Caddy needs 80 for
the ACME challenge and the http→https redirect), an instance role with S3
`teachers/*` access, and installs Docker + compose. Restrict `IngressCidr` if
you can.

```bash
aws cloudformation deploy \
  --template-file deploy/ec2-origin.yml \
  --stack-name learn-and-build-origin \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides IngressCidr=0.0.0.0/0
```

Associate an Elastic IP with the instance so its public address is stable, and
note that IP — DNS points at it in step 5.

### 2. Get the code and secrets onto the host

Connect with SSM Session Manager (no SSH port needed), then clone from a git
remote the instance can reach (a public GitHub URL clones with no credentials;
a private repo needs a deploy key or token):

```bash
sudo install -d -o ec2-user -g ec2-user /opt/learn-and-build
sudo -u ec2-user git clone <repo-url> /opt/learn-and-build/app
cd /opt/learn-and-build/app
mkdir -p /opt/learn-and-build/postgres           # persistent DB path
```

> The `localhost:3100` dev server is **not** a repo URL — the instance cannot
> reach your laptop. Use the actual git remote (`git remote -v`).

Now create `deploy/.env.production`. `scripts/generate-production-env.mjs`
generates it, **but it needs Node**, which is not installed on the host (only
Docker + git + jq are). Either install Node first, or write the file directly
with shell tools — the file is just `KEY=value` lines with random secrets:

```bash
gen() { openssl rand -base64 48 | tr -dc A-Za-z0-9 | head -c "${1:-40}"; }
sudo -u ec2-user tee deploy/.env.production >/dev/null <<EOF
POSTGRES_PASSWORD=$(gen 32)
JWT_SECRET=$(gen 48)
INTERNAL_SERVICE_SECRET=$(gen 48)
ADMIN_EMAIL=admin@learnandbuild.org
ADMIN_PASSWORD=$(gen 24)
ADMIN_NAME=Administrator
JWT_EXPIRES_IN=15m
AUTH_EMAIL_FROM=no-reply@learnandbuild.org
DB_SYNCHRONIZE=false
SEED_DEMO_CLASSES=false
POSTGRES_DATA_DIR=/opt/learn-and-build/postgres
DOCUMENTS_BUCKET=providers-profiles
AWS_REGION=ap-southeast-2
UPLOAD_URL_TTL=900
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=
WEB_BIND=127.0.0.1
PUBLIC_ORIGIN=https://www.learnandbuild.org
OIDC_SUCCESS_REDIRECT=https://www.learnandbuild.org/profile
RAZORPAY_KEY_ID=rzp_test_placeholder
RAZORPAY_KEY_SECRET=placeholder_secret
RAZORPAY_WEBHOOK_SECRET=$(gen 32)
EOF
chmod 600 deploy/.env.production
```

Because the instance role provides S3 access, leave `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` blank and make sure no stale `AWS_*` vars are exported in
the shell (`env | grep -i aws`). Razorpay is left on placeholders so the stack
boots; replace with real keys before taking payments (see step 8).

> **Driving this over SSM `send-command`?** The `commands` array is JSON, so
> here-doc `\n` escapes get mangled and secrets/quotes are awkward. Build the
> file (or the Caddyfile) locally, `base64` it, pass the single base64 string,
> and `echo "$B64" | base64 -d | sudo tee <path>` on the host. Files you add
> locally but have not committed/pushed (e.g. `deploy/caddy/Caddyfile`,
> `deploy/.env.production`) will **not** be in the host's clone — ship them this
> way.

### 3. Start the stack

`WEB_BIND=127.0.0.1` (default) keeps the app on loopback so only Caddy is
public. Run compose with a clean environment (see the AWS note above):

```bash
env -u AWS_REGION -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN -u AWS_PROFILE \
  docker compose --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml up -d --build

# Wait until all services are healthy, then confirm locally on the host:
curl -sf http://127.0.0.1:3100/ >/dev/null && echo "web up on loopback"
```

### 4. Install and start Caddy (TLS reverse proxy)

On Amazon Linux 2023 the Caddy COPR and Cloudsmith RPM repos are **not
available** (COPR is a Fedora service; the RPM repo URL 404s). Install the
official static binary from GitHub instead — it is dependency-free and reliable:

```bash
VER=$(curl -fsSL https://api.github.com/repos/caddyserver/caddy/releases/latest | jq -r .tag_name | sed 's/^v//')
curl -fsSL -o /tmp/caddy.tar.gz \
  "https://github.com/caddyserver/caddy/releases/download/v${VER}/caddy_${VER}_linux_amd64.tar.gz"
cd /tmp && tar xzf caddy.tar.gz caddy
sudo install -m 0755 /tmp/caddy /usr/bin/caddy
caddy version

# Service account and directories
sudo groupadd --system caddy 2>/dev/null || true
sudo useradd --system --gid caddy --home-dir /var/lib/caddy --shell /usr/sbin/nologin caddy 2>/dev/null || true
sudo mkdir -p /etc/caddy /var/lib/caddy && sudo chown -R caddy:caddy /var/lib/caddy

# Systemd unit (needs CAP_NET_BIND_SERVICE to bind 80/443 as the caddy user)
sudo tee /etc/systemd/system/caddy.service >/dev/null <<'UNIT'
[Unit]
Description=Caddy
After=network-online.target
Requires=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
LimitNOFILE=1048576
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
UNIT

# Install the Caddyfile (edit the ACME email in it to a real address first).
sudo cp deploy/caddy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl daemon-reload
sudo systemctl enable --now caddy
```

Caddy will not obtain a certificate until DNS (step 5) resolves **directly** to
this host, so expect it to retry with errors until then; that is normal
(`sudo journalctl -u caddy -f` to watch).

### 5. Point DNS at the host

At your DNS provider for `learnandbuild.org`, create records pointing at the
instance's Elastic IP:

- `www.learnandbuild.org` → **A** → `<Elastic IP>`
- `learnandbuild.org` (apex) → **A** → `<Elastic IP>` (or an ALIAS/ANAME if your
  provider requires it for the apex)

**If the domain is on Cloudflare, the records MUST be DNS-only (grey cloud).**
A proxied (orange cloud) record resolves to Cloudflare's edge IPs (e.g.
`104.21.x.x` / `172.67.x.x`), not your host, so Caddy's TLS-ALPN challenge never
reaches the server and certificate issuance fails. Click the orange cloud on
each record to turn it grey. Verify from your machine that both names resolve to
the Elastic IP before expecting a cert:

```bash
dig +short www.learnandbuild.org @1.1.1.1     # must be the Elastic IP
dig +short learnandbuild.org    @1.1.1.1       # must be the Elastic IP
```

Once DNS resolves directly to the host, restart Caddy to retry immediately
(`sudo systemctl restart caddy`) and it issues the certificate within a minute
or two. Watch with `sudo journalctl -u caddy -f` for `certificate obtained`.

### 6. Allow browser uploads from the public origin (S3 CORS)

Providers upload portfolio/class images straight to S3 from the browser, so the
bucket must allow the public origins. `deploy/s3-cors.json` already lists both
`https://www.learnandbuild.org` and `https://learnandbuild.org`:

```bash
aws s3api put-bucket-cors --bucket "$DOCUMENTS_BUCKET" \
  --region ap-southeast-2 \
  --cors-configuration file://deploy/s3-cors.json
```

### 7. Verify

```bash
curl -sSI https://www.learnandbuild.org/ | head -n 1        # expect HTTP/2 200
curl -sSI https://learnandbuild.org/ | head -n 1            # expect 301 -> www
curl -sf https://www.learnandbuild.org/api/auth/health      # backend via proxy
```

Then exercise sign-up/login, a booking, and a provider portfolio upload in the
browser.

### 8. Real payments and OIDC (when ready)

The stack boots with placeholder Razorpay keys, so checkout does not work until
you set real ones. On the host, edit `deploy/.env.production` (`RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`), then recreate payments:

```bash
docker compose --env-file deploy/.env.production \
  -f deploy/docker-compose.production.yml up -d --force-recreate payments
```

Set the Razorpay webhook to
`https://www.learnandbuild.org/api/payments/payments/webhooks/razorpay`. If OIDC
is enabled, add the redirect URIs under `PUBLIC_ORIGIN`
(`https://www.learnandbuild.org/api/auth/auth/oidc/<google|aws>/callback`) in
the Google/Cognito console.

## Deployment walkthrough (as performed) and troubleshooting

This records the actual first go-live (AWS account `960763460353`, region
`ap-southeast-2`) so a repeat is predictable. The result: instance
`i-081c400c498760ed3`, Elastic IP `52.62.168.113`, live at
`https://www.learnandbuild.org` with a Let's Encrypt certificate.

What was run, in order:

1. `aws cloudformation deploy` of `deploy/ec2-origin.yml` (params
   `IngressCidr=0.0.0.0/0 InstanceType=t3.large DocumentsBucket=providers-profiles`,
   `--capabilities CAPABILITY_IAM`).
2. Allocated + associated an Elastic IP (`aws ec2 allocate-address` /
   `associate-address`).
3. Over SSM: cloned the public GitHub repo to `/opt/learn-and-build/app`, made
   `/opt/learn-and-build/postgres`, wrote `deploy/.env.production` (shipped via
   base64 because SSM mangles here-docs), then
   `docker compose ... up -d --build` (all 10 containers healthy; web 200 on
   `127.0.0.1:3100`).
4. Installed the Caddy static binary + systemd unit, shipped the Caddyfile via
   base64, started Caddy.
5. Added DNS A records for `www` and apex to the Elastic IP.
6. Applied `deploy/s3-cors.json` to the bucket.
7. Verified `https://www.learnandbuild.org` (200), apex 301→www, API health 200,
   Let's Encrypt cert present.

### Issues hit and how they were fixed

- **CloudFormation `CREATE_FAILED` on the security group.** The SG rule
  *description* contained an apostrophe ("Let's Encrypt"). EC2 allows only
  `a-zA-Z0-9. _-:/()#,@[]+=&;{}!$*` in rule descriptions. **Fix:** reworded the
  descriptions (no apostrophe). The stack was then in `ROLLBACK_COMPLETE`, which
  cannot be updated — **delete it first** (`aws cloudformation delete-stack` +
  `wait stack-delete-complete`), then redeploy.

- **Wrong AWS account/region from stale shell vars.** The shell exported
  `AWS_PROFILE=learnbuild` (no such profile) and `AWS_ACCOUNT_ID`/`AWS_REGION`
  for a different account. **Fix:** run every AWS/compose command with a clean
  environment and an explicit profile/region:
  `env -u AWS_PROFILE -u AWS_ACCOUNT_ID aws ... --profile default --region ap-southeast-2`.
  Confirm with `aws sts get-caller-identity` (expect account `960763460353`).

- **`node: command not found` on the host.** User-data installs Docker + git +
  jq, not Node, so `generate-production-env.mjs` could not run. **Fix:** write
  `deploy/.env.production` directly with `openssl`-random secrets (see step 2).

- **`.env.production` mangled when sent via SSM here-doc.** The `\n` in the JSON
  `commands` array was literalized and the here-doc delimiter broke. **Fix:**
  build the file locally, `base64` it, pass the single string, and
  `echo "$B64" | base64 -d | sudo tee deploy/.env.production` on the host.

- **`deploy/caddy/Caddyfile` missing on the host.** It was created locally but
  not committed, so the host's `git clone` did not have it. **Fix:** ship it via
  base64 to `/etc/caddy/Caddyfile` (same technique), or commit and pull it.

- **Caddy would not install from a package repo.** `@caddy/caddy` COPR is not
  available on AL2023 and the Cloudsmith RPM repo URL 404s. **Fix:** install the
  official static binary from GitHub releases + a hand-written systemd unit
  (step 4).

- **Certificate issuance failed: `NXDOMAIN` then Cloudflare edge IPs.** First
  the records did not exist yet; then they existed but were **proxied (orange
  cloud)** in Cloudflare, so they resolved to `104.21.x.x`/`172.67.x.x` and the
  ACME challenge never reached the host. **Fix:** set both records to **DNS-only
  (grey cloud)** pointing at the Elastic IP.

- **Let's Encrypt `error:rateLimited`.** The repeated failed attempts tripped a
  temporary LE rate limit. **Fix:** once DNS was correct, `sudo systemctl
  restart caddy` to retry; the limit had cleared and both certs were obtained
  (`certificate obtained`). If still limited, wait ~1 hour or use LE staging
  first (`acme_ca https://acme-staging-v02.api.letsencrypt.org/directory` in the
  Caddyfile) to validate, then switch back.

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
