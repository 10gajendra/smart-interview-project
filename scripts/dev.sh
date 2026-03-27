#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_CMD=(node server.js)
FRONTEND_CMD=(npm start)

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

echo "Starting backend on http://localhost:5000"
(
  cd "$BACKEND_DIR"
  "${BACKEND_CMD[@]}"
) &
BACKEND_PID=$!

sleep 2

echo "Starting frontend on http://localhost:3000"
(
  cd "$FRONTEND_DIR"
  BROWSER="${BROWSER:-none}" "${FRONTEND_CMD[@]}"
) &
FRONTEND_PID=$!

echo
echo "Development servers are starting."
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:5000"
echo "Scoring health: http://localhost:5000/api/scoring/health"
echo
echo "Press Ctrl+C to stop both processes."

wait "$BACKEND_PID" "$FRONTEND_PID"
