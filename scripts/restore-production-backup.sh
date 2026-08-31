#!/usr/bin/env bash
set -euo pipefail

backup_uri="${1:-}"
if [[ -z "$backup_uri" || "$backup_uri" != s3://*/production/*.dump ]]; then
  echo "Usage: RESTORE_CONFIRM=restore-production $0 s3://BUCKET/production/BACKUP.dump" >&2
  exit 2
fi
if [[ "${RESTORE_CONFIRM:-}" != "restore-production" ]]; then
  echo "Refusing destructive restore. Set RESTORE_CONFIRM=restore-production after reviewing the target." >&2
  exit 2
fi

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
restore_dir="$(mktemp -d)"
backup_file="$restore_dir/production.dump"
trap 'rm -rf -- "$restore_dir"' EXIT

cd "$repo_dir"
aws s3 cp "$backup_uri" "$backup_file"
test -s "$backup_file"
compose=(docker compose --env-file deploy/.env.production -f deploy/docker-compose.production.yml)
"${compose[@]}" stop auth teacher scheduling search payments voice web
"${compose[@]}" exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' <"$backup_file"
"${compose[@]}" up -d auth teacher scheduling search payments voice web
"${compose[@]}" ps
echo "Restore completed from $backup_uri. Run the production smoke test now."
