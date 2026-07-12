#!/usr/bin/env bash
set -euo pipefail

errors=0
for command in docker curl openssl; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "Missing required command: ${command}" >&2
    errors=1
  fi
done

if command -v docker >/dev/null 2>&1; then
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but the daemon is not reachable." >&2
    errors=1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose v2 is required." >&2
    errors=1
  fi
fi

if [[ "${errors}" -ne 0 ]]; then
  exit 1
fi

if [[ "${1:-}" == "--preflight" ]]; then
  echo "Preflight passed."
  exit 0
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"
docker compose config --quiet
docker compose ps
echo "Configuration and Docker runtime look healthy."
