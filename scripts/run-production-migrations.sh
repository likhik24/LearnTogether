#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$repo_dir/deploy/docker-compose.production.yml"
env_file="$repo_dir/deploy/.env.production"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file" >&2
  exit 1
fi

for migration in "$repo_dir"/deploy/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U learnbuild -d learnbuild < "$migration"
done
