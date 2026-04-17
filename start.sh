#!/usr/bin/env bash
# Launch 3 tmux panes: API server, frontend dev server, and a shell for the eval harness.
# Usage: ./start.sh [session_name]
# Dev mode: SENTINEL_DEV=micromail ./start.sh  (auto-loads a scenario so the UI works immediately)

set -euo pipefail

SESSION="${1:-sentinel}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Create session with first window: API server
tmux new-session -d -s "$SESSION" -n "server" -c "$ROOT"
tmux send-keys -t "$SESSION:server" ".venv/bin/uvicorn server.server:app --host 0.0.0.0 --port 8000" Enter

# Second window: frontend dev server
tmux new-window -t "$SESSION" -n "frontend" -c "$ROOT/frontend"
tmux send-keys -t "$SESSION:frontend" "npm run dev" Enter

# Third window: eval harness / free shell
tmux new-window -t "$SESSION" -n "harness" -c "$ROOT"
tmux send-keys -t "$SESSION:harness" "# Ready. Example:" ""
tmux send-keys -t "$SESSION:harness" "" Enter
tmux send-keys -t "$SESSION:harness" "# .venv/bin/python -m server.eval_harness my_run --config eval_config.yaml" ""

# Focus the harness window
tmux select-window -t "$SESSION:harness"

# Attach
tmux attach-session -t "$SESSION"
