#!/usr/bin/env bash
# Bootstrap local dependencies, then launch 3 tmux windows: API server,
# frontend dev server, and a shell for the eval harness.
# Usage: ./start.sh [session_name]
# Dev mode: SENTINEL_DEV=micromail ./start.sh  (auto-loads a scenario so the UI works immediately)

set -euo pipefail

SESSION="${1:-sentinel}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
PYTHON_BIN="${PYTHON:-python3}"
API_PORT="${SENTINEL_API_PORT:-8000}"
FRONTEND_PORT="${SENTINEL_FRONTEND_PORT:-5173}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd "$PYTHON_BIN"
require_cmd npm
require_cmd tmux

echo "[setup] Python virtual environment"
if [ ! -x "$ROOT/.venv/bin/python" ]; then
  "$PYTHON_BIN" -m venv "$ROOT/.venv"
fi
"$ROOT/.venv/bin/python" -m pip install -r "$ROOT/server/requirements.txt"

echo "[setup] SQLite databases"
(cd "$ROOT" && "$ROOT/.venv/bin/python" -m server.scripts.build_db)

echo "[setup] Frontend dependencies"
if [ ! -x "$ROOT/frontend/node_modules/.bin/vite" ] || \
   [ ! -f "$ROOT/frontend/node_modules/.package-lock.json" ] || \
   [ "$ROOT/frontend/package-lock.json" -nt "$ROOT/frontend/node_modules/.package-lock.json" ]; then
  (cd "$ROOT/frontend" && npm ci)
fi

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Create session with first window: API server
tmux new-session -d -s "$SESSION" -n "server" -c "$ROOT"
tmux send-keys -t "$SESSION:server" ".venv/bin/uvicorn server.server:app --host 0.0.0.0 --port $API_PORT" Enter

# Second window: frontend dev server
tmux new-window -t "$SESSION" -n "frontend" -c "$ROOT/frontend"
tmux send-keys -t "$SESSION:frontend" "npm run dev -- --port $FRONTEND_PORT --strictPort" Enter

# Third window: eval harness / free shell
tmux new-window -t "$SESSION" -n "harness" -c "$ROOT"
tmux send-keys -t "$SESSION:harness" "# Ready. Single-task smoke test:" ""
tmux send-keys -t "$SESSION:harness" "" Enter
tmux send-keys -t "$SESSION:harness" "# .venv/bin/python -m server.eval_harness run micromail_smoke --config eval_config.yaml --task micromail-unread-absolute-passive" ""
tmux send-keys -t "$SESSION:harness" "" Enter
tmux send-keys -t "$SESSION:harness" "# Full benchmark: .venv/bin/python -m server.eval_harness run my_run --config eval_config.yaml" ""

# Focus the harness window
tmux select-window -t "$SESSION:harness"

if [ -t 0 ] && [ -t 1 ]; then
  tmux attach-session -t "$SESSION"
else
  echo "Started tmux session '$SESSION'."
  echo "Attach with: tmux attach-session -t $SESSION"
fi
