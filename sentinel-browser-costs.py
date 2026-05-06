#!/usr/bin/env python3
"""Aggregate token usage and tool-call counts per task in a result set.

Usage: python compute_cost.py <result_set>
"""

import json
import re
import sys
from pathlib import Path

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

REPO_ROOT = Path(__file__).resolve().parent
RESULTS_ROOT = REPO_ROOT / "results"


def find_uuid_dir(task_dir: Path) -> Path:
    candidates = [p for p in task_dir.iterdir() if p.is_dir() and UUID_RE.match(p.name)]
    if len(candidates) != 1:
        raise RuntimeError(
            f"expected exactly 1 uuid dir in {task_dir}, found {len(candidates)}"
        )
    return candidates[0]


def aggregate_usage(usage_path: Path) -> dict:
    totals = {
        "completion_tokens": 0,
        "prompt_tokens": 0,
        "total_tokens": 0,
        "reasoning_tokens": 0,
        "llm_calls": 0,
    }
    with usage_path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            usage = entry.get("usage") or {}
            totals["completion_tokens"] += usage.get("completion_tokens", 0) or 0
            totals["prompt_tokens"] += usage.get("prompt_tokens", 0) or 0
            totals["total_tokens"] += usage.get("total_tokens", 0) or 0
            details = usage.get("completion_tokens_details") or {}
            totals["reasoning_tokens"] += details.get("reasoning_tokens", 0) or 0
            totals["llm_calls"] += 1
    return totals


def count_tool_calls(messages_path: Path) -> int:
    with messages_path.open() as f:
        messages = json.load(f)
    total = 0
    for msg in messages:
        if msg.get("role") != "assistant":
            continue
        tool_calls = msg.get("tool_calls") or []
        total += len(tool_calls)
    return total


def process_task(task_dir: Path) -> dict:
    uuid_dir = find_uuid_dir(task_dir)
    usage_path = uuid_dir / "usage.jsonl"
    messages_path = uuid_dir / "all_messages.json"

    totals = aggregate_usage(usage_path)
    tool_calls = count_tool_calls(messages_path)

    return {
        "uuid": uuid_dir.name,
        "completion_tokens": totals["completion_tokens"],
        "prompt_tokens": totals["prompt_tokens"],
        "total_tokens": totals["total_tokens"],
        "reasoning_tokens": totals["reasoning_tokens"],
        "tool_calls": tool_calls,
        "llm_calls": totals["llm_calls"],
    }


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python compute_cost.py <result_set>", file=sys.stderr)
        return 2

    result_set = sys.argv[1]
    root = RESULTS_ROOT / result_set
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 2

    processed = 0
    skipped = 0

    for app_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        for task_dir in sorted(p for p in app_dir.iterdir() if p.is_dir()):
            try:
                costs = process_task(task_dir)
            except Exception as e:
                print(f"skip {task_dir}: {e}", file=sys.stderr)
                skipped += 1
                continue

            out_path = task_dir / "costs.json"
            with out_path.open("w") as f:
                json.dump(costs, f, indent=2)
                f.write("\n")
            processed += 1

    print(f"processed {processed}, skipped {skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
