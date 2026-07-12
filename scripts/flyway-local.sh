#!/usr/bin/env bash
set -euo pipefail

target="${1:-all}"
command="${2:-migrate}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
postgres_host="${SKETCHBLOCK_POSTGRES_HOST:-host.docker.internal}"
postgres_port="${SKETCHBLOCK_POSTGRES_PORT:-5432}"
postgres_user="${SKETCHBLOCK_POSTGRES_USER:-sketchblock}"
postgres_password="${SKETCHBLOCK_POSTGRES_PASSWORD:-sketchblock-local}"
app_database="${SKETCHBLOCK_APP_DATABASE:-sketchblock_app}"
collab_database="${SKETCHBLOCK_COLLAB_DATABASE:-sketchblock_collab}"
flyway_image="${FLYWAY_IMAGE:-flyway/flyway:11}"

run_flyway() {
  local database="$1"
  local migrations="$2"

  docker run --rm \
    -v "${repo_root}/${migrations}:/flyway/sql:ro" \
    "${flyway_image}" \
    -url="jdbc:postgresql://${postgres_host}:${postgres_port}/${database}" \
    -user="${postgres_user}" \
    -password="${postgres_password}" \
    -locations="filesystem:/flyway/sql" \
    "${command}"
}

case "${target}" in
  app)
    run_flyway "${app_database}" "db/flyway/app/sql"
    ;;
  collab)
    run_flyway "${collab_database}" "db/flyway/collab/sql"
    ;;
  all)
    run_flyway "${app_database}" "db/flyway/app/sql"
    run_flyway "${collab_database}" "db/flyway/collab/sql"
    ;;
  *)
    echo "Usage: scripts/flyway-local.sh [app|collab|all] [migrate|info|validate|repair]" >&2
    exit 2
    ;;
esac
