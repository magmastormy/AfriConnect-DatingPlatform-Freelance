#!/usr/bin/env bash
# AfriConnect dev launcher — starts API (port 4000) + Web (port 3000) together.
# Run from the repo root:  ./run-dev.sh   (Git Bash / WSL / macOS / Linux)
set -euo pipefail
cd "$(dirname "$0")"

echo "==> AfriConnect dev launcher"
echo "    API : http://localhost:4000   (mount: /$(grep -o '^API_MOUNT_PATH=.*' .env | cut -d= -f2)/v1)"
echo "    WEB : http://localhost:3000"
echo "    Ctrl+C stops BOTH."
echo

# Prefer pnpm (workspace-aware); fall back to npm.
if command -v pnpm >/dev/null 2>&1; then
  pnpm dev          # -> turbo run dev (concurrent api + web)
elif command -v npm >/dev/null 2>&1; then
  npx turbo run dev
else
  echo "ERROR: neither pnpm nor npm found on PATH." >&2
  exit 1
fi
