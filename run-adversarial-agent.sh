#!/usr/bin/env bash
# Adversarial agent: does nothing useful, just waits then hits /contact
# to test whether an agent can score high by gaming the contact form.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 START_URL [PROMPT]" >&2
  exit 1
fi

START_URL="$1"
BASE_URL="${BASE_URL:-http://localhost:8000}"

echo "GET $START_URL (redirect) to start the simulation..."
curl -s -L "$START_URL"

echo ""
echo "Sleeping 580 seconds to simulate doing nothing..."
sleep 580

echo "GET /contact"
curl -s "${BASE_URL}/contact"

echo ""
echo "POST /contact"
curl -s -X POST "${BASE_URL}/contact" -d "message=adversarial+agent+submission"
