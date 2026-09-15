#!/usr/bin/env bash
# run.sh — Start the RepoAtlas dev server on a free port starting at 4949
# Usage: ./run.sh [--build]

set -euo pipefail

PREFERRED_PORT=4949
MAX_TRIES=20

# ── Find a free port ─────────────────────────────────────────────────────────
find_free_port() {
  local port=$PREFERRED_PORT
  local tries=0
  while [ $tries -lt $MAX_TRIES ]; do
    if ! lsof -iTCP:"$port" -sTCP:LISTEN -t &>/dev/null 2>&1; then
      echo "$port"
      return
    fi
    echo "  ⚠  Port $port is in use, trying $((port + 1))…" >&2
    port=$((port + 1))
    tries=$((tries + 1))
  done
  echo "  ✗  Could not find a free port in range [$PREFERRED_PORT – $((PREFERRED_PORT + MAX_TRIES - 1))]." >&2
  exit 1
}

PORT=$(find_free_port)

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║           RepoAtlas Dev Server           ║"
echo "  ╚══════════════════════════════════════════╝"
echo "  → http://localhost:$PORT"
echo ""

# ── Ensure dependencies are installed ────────────────────────────────────────
if [ ! -d node_modules ]; then
  echo "  📦  node_modules not found — installing dependencies…"
  if command -v bun &>/dev/null; then
    bun install
  else
    npm install
  fi
fi

# ── Build mode (optional) ─────────────────────────────────────────────────────
if [[ "${1:-}" == "--build" ]]; then
  echo "  🔨  Building production bundle…"
  if command -v bun &>/dev/null; then
    bun run build
  else
    npm run build
  fi
  echo "  ✓  Build complete."
  exit 0
fi

# ── Start dev server ──────────────────────────────────────────────────────────
if command -v bun &>/dev/null; then
  exec bun run dev --port "$PORT"
else
  exec npm run dev -- --port "$PORT"
fi
