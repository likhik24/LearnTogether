#!/usr/bin/env bash
#
# Back up the production Postgres database to a compressed dump.
#
# Produces a consistent logical backup (pg_dump custom format) of the entire
# `learnbuild` database — all user profiles, classes, bookings, payments and
# everything else — that can be restored on this or another machine with
# scripts/db-restore.sh.
#
# Usage:
#   scripts/db-backup.sh [output-dir]
#
# Defaults:
#   output-dir            ./backups
#   BACKUP_RETENTION_DAYS  keep dumps for this many days (default 30; 0 = keep all)
#
# Runs pg_dump inside the running production `postgres` container, so no local
# Postgres client is required. Run from the repo root.

set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$repo_dir/deploy/docker-compose.production.yml"
env_file="$repo_dir/deploy/.env.production"
out_dir="${1:-$repo_dir/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file" >&2
  exit 1
fi

mkdir -p "$out_dir"
timestamp="$(date +%Y%m%d-%H%M%S)"
out_file="$out_dir/learnbuild-$timestamp.dump"

echo "Backing up learnbuild -> $out_file"
docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  pg_dump -U learnbuild -d learnbuild -Fc > "$out_file"

# Basic integrity check: a valid custom-format dump lists its table of contents.
if ! docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  pg_restore -l < "$out_file" > /dev/null 2>&1; then
  echo "WARNING: could not verify the dump table of contents; keeping the file anyway." >&2
fi

size="$(du -h "$out_file" | cut -f1)"
echo "Backup complete ($size)."

if [[ "$retention_days" -gt 0 ]]; then
  echo "Pruning backups older than $retention_days day(s) in $out_dir"
  find "$out_dir" -name 'learnbuild-*.dump' -type f -mtime "+$retention_days" -print -delete
fi
