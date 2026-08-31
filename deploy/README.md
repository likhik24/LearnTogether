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
   - add the Razorpay key ID, key secret, and a separately generated webhook
     secret. Start with Test Mode credentials until the complete checkout and
     refund flow has been verified.
   - keep the generated `INTERNAL_SERVICE_SECRET` private; it authorizes the
     auth service—not browsers—to request refunds from the payments service.
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
   `auth`, `teacher`, `scheduling`, and `payments` are healthy. Then set it to `false` and
   recreate those services:

   ```bash
   docker compose \
     --env-file deploy/.env.production \
     -f deploy/docker-compose.production.yml \
     up -d --force-recreate auth teacher scheduling payments web
   ```

Do not enable `DB_SYNCHRONIZE` again after real customer data exists. Future
schema changes must use reviewed migrations.

## Updating an existing deployment

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

`scripts/run-production-migrations.sh` remains available for an explicit
operator-run migration or recovery. A failed migration exits non-zero and
prevents dependent services from starting; do not bypass that gate.

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

## Email production readiness

SES must be moved out of its sandbox before verification, reset, reminder, and
transactional emails can reach arbitrary customers. In the AWS SES console for
the production region:

1. Verify `learnandbuild.org`, publish the SES DKIM records in Cloudflare, and
   configure a custom MAIL FROM domain.
2. Publish SPF and DMARC records, then confirm the identity status is verified.
3. Request production access under **Account dashboard → Request production
   access**. Describe the opt-in account/booking mail, preference controls,
   bounce/complaint handling, and expected daily volume.
4. Set `AUTH_EMAIL_FROM` to a verified sender and send verification, reset,
   booking, reschedule, cancellation, refund, and reminder tests to independent
   mail providers. Monitor SES bounce and complaint metrics.

Until AWS approves the request, SES sandbox restrictions remain an external
release dependency; the durable email outbox keeps retryable delivery failures
visible in the admin operations queue.

## Backups, recovery, and monitoring

- Create a private, versioned S3 bucket matching `BackupsBucket`, with default
  encryption, public access blocked, and lifecycle rules (for example: 35 days
  standard, 12 months archive). Set `PRODUCTION_BACKUP_ENABLED=true` and
  `PRODUCTION_BACKUP_BUCKET` in the GitHub production environment.
- `.github/workflows/backup-production.yml` creates a nightly encrypted custom
  PostgreSQL dump over SSM. Review each scheduled workflow run and configure a
  GitHub Actions failure notification.
- Test a restore quarterly on an isolated environment. Production restore is
  intentionally gated:

  ```bash
  RESTORE_CONFIRM=restore-production \
    scripts/restore-production-backup.sh s3://BUCKET/production/FILE.dump
  ```

- `.github/workflows/production-smoke.yml` checks the site and core APIs every
  15 minutes. Configure GitHub workflow-failure notifications.
- Deploy `deploy/ec2-origin.yml` with `AlarmEmail` to receive EC2 status and
  sustained CPU alarms, then confirm the SNS subscription email.
- If a deployment health check fails, the workflow rolls application code back
  to the previous commit. Migrations in this repository must remain additive so
  the prior application can run safely during rollback.

## Operational incident checklist

1. Check the public smoke workflow, CloudWatch alarms, Cloudflare health, and
   `docker compose ... ps` through SSM.
2. Inspect service logs and the admin failed-operation queue. Retry only after
   fixing the underlying dependency or configuration issue.
3. For payment incidents, reconcile Razorpay order, payment, refund, booking,
   reservation, and operation-job identifiers before changing state.
4. For suspected credential exposure, rotate the credential immediately,
   revoke sessions if needed, review CloudTrail/access logs, and document scope.
5. After recovery, run customer and provider smoke flows and record timeline,
   impact, root cause, and prevention work.

## Edge security checklist

Create Cloudflare rate-limit rules for `/api/auth/auth/login`, registration,
password reset, booking, payment, provider messaging, and admin paths. The app
also has a per-instance safety limiter, but Cloudflare is the distributed
control. Enable managed WAF rules and bot protection, exclude webhook routes
only where provider signatures are strictly verified, and review GitHub secret
scanning/CodeQL alerts weekly.
