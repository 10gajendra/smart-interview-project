#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGO_DIR="$ROOT_DIR/.local/mongodb"
MONGO_DBPATH="$MONGO_DIR/data"
MONGO_LOG_DIR="$MONGO_DIR/log"
MONGO_LOG="$MONGO_LOG_DIR/mongod.log"
MONGO_BIN="$MONGO_DIR/mongodb-linux-x86_64-ubuntu2204-7.0.14/bin/mongod"
MONGO_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/interviewDB-backup}"

is_local_mongo_uri() {
  [[ "$MONGO_URI" == mongodb://127.0.0.1:27017/* ]] || [[ "$MONGO_URI" == mongodb://localhost:27017/* ]]
}

is_mongo_running() {
  pgrep -f "$MONGO_BIN.*--port 27017" >/dev/null 2>&1 || pgrep -f "mongod.*--port 27017" >/dev/null 2>&1
}

start_local_mongo() {
  if ! is_local_mongo_uri; then
    echo "MONGODB_URI is not local ($MONGO_URI). Skipping local mongod startup."
    return 0
  fi

  if is_mongo_running; then
    echo "MongoDB already running on port 27017."
    return 0
  fi

  if [[ ! -x "$MONGO_BIN" ]]; then
    echo "MongoDB binary not found at: $MONGO_BIN"
    echo "Set MONGODB_URI to an Atlas URI, or install/download local MongoDB first."
    exit 1
  fi

  mkdir -p "$MONGO_DBPATH" "$MONGO_LOG_DIR"
  echo "Starting local MongoDB on 127.0.0.1:27017"
  "$MONGO_BIN" \
    --dbpath "$MONGO_DBPATH" \
    --bind_ip 127.0.0.1 \
    --port 27017 \
    --logpath "$MONGO_LOG" \
    --fork
}

start_local_mongo
exec "$ROOT_DIR/scripts/dev.sh"
