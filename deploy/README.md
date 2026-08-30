# Production deployment

The production topology exposes only the Next.js web container through a
Cloudflare Tunnel. All APIs and data services remain on a private Docker
network, and Next rewrites `/api/*` requests to the appropriate service.

## First deployment

1. Use a clean clone of the repository on the server.
2. Run `node scripts/generate-production-env.mjs`.
3. Edit `deploy/.env.production` locally on the server:
   - confirm the absolute Cloudflare credentials path;
   - confirm the admin email;
   - confirm the S3 bucket and AWS region;
   - add optional OIDC credentials only when needed.
   - set `AUTH_EMAIL_FROM` to an address on an SES-verified domain.
4. Allow the production web origins to upload provider PDFs directly through
   presigned URLs:

   ```bash
   aws s3api put-bucket-cors \
     --bucket "$DOCUMENTS_BUCKET" \
     --cors-configuration file://deploy/s3-cors.json
   ```

5. Start the private stack. For a brand-new empty database only, set
   `DB_SYNCHRONIZE=true` for this initial bootstrap:

   ```bash
   docker compose \
     --env-file deploy/.env.production \
     -f deploy/docker-compose.production.yml \
     up -d --build
   ```

6. Start the stack. The one-shot `migrate` service applies every reviewed SQL
   migration before the database-backed application services start. Then
   verify the migration and endpoint health:

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

7. For a brand-new empty database only, leave `DB_SYNCHRONIZE=true` until
   `auth`, `teacher`, and `scheduling` are healthy. Then set it to `false` and
   recreate those services:

   ```bash
   docker compose \
     --env-file deploy/.env.production \
     -f deploy/docker-compose.production.yml \
     up -d --force-recreate auth teacher scheduling
   ```

Do not enable `DB_SYNCHRONIZE` again after real customer data exists. Future
schema changes must use reviewed migrations.

## Updating an existing deployment

Pull the reviewed release and rebuild the stack. The one-shot `migrate`
service runs transactional, idempotent migrations before auth, scheduling, and
teacher services are allowed to start.

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

`scripts/run-production-migrations.sh` remains available for an explicit
operator-run migration or recovery. A failed migration exits non-zero and
prevents dependent services from starting; do not bypass that gate.

## Cloudflare

Create one Tunnel public hostname:

- Hostname: `learnandbuild.org`
- Service: `http://web:3100`

Add `www.learnandbuild.org` as a redirect to the apex domain or as a second
public hostname pointing at the same service. The tunnel credentials JSON
belongs outside the repository at `CLOUDFLARE_CREDENTIALS_PATH`; keep it mode
`0600`.

## Security notes

- No database, Redis, OpenSearch, or API port is published on the host.
- Use an EC2 instance role for S3 rather than static AWS access keys.
- Keep `deploy/.env.production` mode `0600` and outside Git.
- Build from a clean clone. `.dockerignore` excludes PDF, DOCX, and temporary
  signing directories as an additional safeguard.
