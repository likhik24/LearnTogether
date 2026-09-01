#!/usr/bin/env bash
#
# Restore the production Postgres database from a dump created by
# scripts/db-backup.sh. Use this when moving to a new machine or recovering
# data.
#
# Usage:
#   scripts/db-restore.sh <path-to.dump>
#
# This OVERWRITES the current contents of the `learnbuild` database with the
# dump (pg_restore --clean --if-exists). It requires explicit confirmation
# because it is destructive to whatever is currently in the target database.
#
# Runs pg_restore inside the running production `postgres` container. Run from
# the repo root. Start only the postgres service first, restore, then bring up
# the rest of the stack.

set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$repo_dir/deploy/docker-compose.production.yml"
env_file="$repo_dir/deploy/.env.production"
dump_file="${1:-}"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file" >&2
  exit 1
fi
if [[ -z "$dump_file" || ! -f "$dump_file" ]]; then
  echo "Usage: scripts/db-restore.sh <path-to.dump>" >&2
  exit 1
fi

echo "About to restore '$dump_file' into the learnbuild database."
echo "This REPLACES the current data in that database."
read -r -p "Type 'restore' to continue: " confirm
if [[ "$confirm" != "restore" ]]; then
  echo "Aborted."
  exit 1
fi

echo "Restoring ..."
docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
  pg_restore -U learnbuild -d learnbuild --clean --if-exists --no-owner --no-privileges \
  < "$dump_file"

echo "Restore complete."
