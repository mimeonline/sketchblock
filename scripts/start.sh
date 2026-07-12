#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

./scripts/doctor.sh --preflight

if [[ ! -f .env ]]; then
  auth_secret="$(openssl rand -hex 32)"
  postgres_password="$(openssl rand -hex 24)"
  sed \
    -e "s/^APP_AUTH_SECRET=.*/APP_AUTH_SECRET=${auth_secret}/" \
    -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${postgres_password}/" \
    -e "s#^COLLAB_DATABASE_URL=.*#COLLAB_DATABASE_URL=postgresql://sketchblock:${postgres_password}@postgres:5432/sketchblock_collab#" \
    -e "s#^SKETCHBLOCK_APP_DATABASE_URL=.*#SKETCHBLOCK_APP_DATABASE_URL=postgresql://sketchblock:${postgres_password}@postgres:5432/sketchblock_app#" \
    .env.compose.example > .env
  chmod 600 .env
  echo "Created .env with random local authentication and database secrets."
fi

docker compose up --build -d

read_env_value() {
  local key="$1"
  local fallback="$2"
  local value
  value="$(sed -n "s/^${key}=//p" .env | tail -n 1)"
  printf '%s' "${value:-${fallback}}"
}

web_port="$(read_env_value SKETCHBLOCK_WEB_PORT 4512)"
collab_port="$(read_env_value SKETCHBLOCK_COLLAB_PORT 4513)"

echo "Waiting for Sketchblock..."
for attempt in $(seq 1 60); do
  if curl --fail --silent "http://localhost:${web_port}" >/dev/null 2>&1 \
    && curl --fail --silent "http://localhost:${collab_port}/health" >/dev/null 2>&1; then
    echo "Sketchblock is ready: http://localhost:${web_port}"
    echo "Demo mode is active. No GitHub credentials are required."
    exit 0
  fi
  sleep 2
done

echo "Sketchblock did not become healthy in time." >&2
docker compose ps
docker compose logs --tail=80 web collab-server flyway-app flyway-collab
exit 1
