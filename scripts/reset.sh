#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

if [[ "${1:-}" != "--yes" ]]; then
  read -r -p "Delete all local Sketchblock data? Type RESET to continue: " answer
  [[ "${answer}" == "RESET" ]] || { echo "Reset cancelled."; exit 0; }
fi

docker compose down --volumes
echo "Local Sketchblock data was removed. Run ./scripts/start.sh to create a fresh demo workspace."
