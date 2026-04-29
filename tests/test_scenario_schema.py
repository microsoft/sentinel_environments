"""Schema validation for scenario JSONs.

Benchmark scenarios (scenarios/<env>/<name>.json, excluding dev.json):
    required: id, environment, events, eval_sql, condition_at,
              event_timeline_end, kill_at, prompt, start_page, taxonomy
    forbidden: duration
    invariants: 0 < condition_at <= kill_at <= event_timeline_end
                events sorted by time

Dev scenarios (scenarios/<env>/dev.json):
    required: id, environment, events, event_timeline_end
    forbidden: duration, condition_at, kill_at
"""
import json
from pathlib import Path

import pytest

BASE = Path(__file__).resolve().parent.parent / "scenarios"

BENCHMARK_REQUIRED = {
    "id", "environment", "events", "eval_sql",
    "condition_at", "event_timeline_end", "kill_at",
    "prompt", "start_page", "taxonomy",
}
BENCHMARK_FORBIDDEN = {"duration"}

DEV_REQUIRED = {"id", "environment", "events", "event_timeline_end"}
DEV_FORBIDDEN = {"duration", "condition_at", "kill_at"}


def _discover_benchmarks():
    return sorted(
        p for p in BASE.glob("*/*.json")
        if p.name != "dev.json" and "webarena" not in str(p)
    )


def _discover_devs():
    return sorted(BASE.glob("*/dev.json"))


@pytest.mark.parametrize("path", _discover_benchmarks(), ids=lambda p: p.stem)
def test_benchmark_schema(path):
    with open(path) as f:
        scenario = json.load(f)

    keys = set(scenario.keys())
    missing = BENCHMARK_REQUIRED - keys
    forbidden = BENCHMARK_FORBIDDEN & keys
    assert not missing, f"{path.stem}: missing required keys {missing}"
    assert not forbidden, f"{path.stem}: contains forbidden keys {forbidden}"

    condition_at = scenario["condition_at"]
    kill_at = scenario["kill_at"]
    end = scenario["event_timeline_end"]
    assert condition_at > 0, f"{path.stem}: condition_at must be > 0"
    assert condition_at <= kill_at, (
        f"{path.stem}: condition_at ({condition_at}) > kill_at ({kill_at})"
    )
    assert kill_at <= end, (
        f"{path.stem}: kill_at ({kill_at}) > event_timeline_end ({end})"
    )

    times = [e.get("time", 0) for e in scenario.get("events", [])]
    assert times == sorted(times), f"{path.stem}: events not sorted by time"
    if times:
        assert max(times) <= end, (
            f"{path.stem}: max event time ({max(times)}) > event_timeline_end ({end})"
        )


@pytest.mark.parametrize("path", _discover_devs(), ids=lambda p: p.parent.name)
def test_dev_schema(path):
    with open(path) as f:
        scenario = json.load(f)

    keys = set(scenario.keys())
    missing = DEV_REQUIRED - keys
    forbidden = DEV_FORBIDDEN & keys
    assert not missing, f"{path.parent.name}/dev.json: missing required keys {missing}"
    assert not forbidden, f"{path.parent.name}/dev.json: contains forbidden keys {forbidden}"

    assert scenario["event_timeline_end"] > 0, (
        f"{path.parent.name}/dev.json: event_timeline_end must be > 0"
    )
