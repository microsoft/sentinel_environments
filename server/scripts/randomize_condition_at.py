"""Deterministic, one-shot regeneration of scenario timing.

Per-scenario transformation:
- Draw new_condition_at uniformly in [MIN_CONDITION_AT, MAX_CONDITION_AT], seeded
  by scenario_id so each scenario keeps the same value on re-run and adding new
  scenarios never reshuffles existing ones.
- Move target event(s) — those currently at time == old_condition_at — to the
  new condition_at. Two scenarios carry a "target bundle" of 2 events at the
  old condition_at; both members move together.
- Stretch distractor events piecewise-linearly. Pre-target events scale by
  (new_condition_at / old_condition_at). Post-target events scale to fill
  (new_condition_at, EVENT_TIMELINE_END].
- Scale `price_waypoints` times inside preload_stocks payloads using the same
  piecewise-linear rule. Waypoints at the old condition_at move to the new
  condition_at; other waypoints stretch around them. This keeps microhood
  prices in sync with condition_at without any manual alignment.
- Round all event / waypoint times to 2 decimals.
- Overwrite JSON with: condition_at = new_condition_at, event_timeline_end =
  EVENT_TIMELINE_END, kill_at = KILL_AT. Drop the old `duration` field.

Skips scenarios without `condition_at` (the 10 dev.json fallback scenarios).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from server.timing import (
    EVENT_TIMELINE_END,
    KILL_AT,
    MAX_CONDITION_AT,
    MIN_CONDITION_AT,
    SCENARIO_SEED,
)

SCENARIOS_DIR = REPO_ROOT / "scenarios"

FIELD_ORDER = [
    "id",
    "environment",
    "start_page",
    "prompt",
    "condition_at",
    "event_timeline_end",
    "kill_at",
    "events",
    "annotator_notes",
    "taxonomy",
    "eval_sql",
]


def seeded_rng(scenario_id: str) -> random.Random:
    digest = hashlib.md5(scenario_id.encode()).hexdigest()[:8]
    seed = int(digest, 16) ^ SCENARIO_SEED
    return random.Random(seed)


def scale_post_target(t: float, old_ca: float, new_ca: float, old_end: float) -> float:
    span_old = old_end - old_ca
    span_new = EVENT_TIMELINE_END - new_ca
    return new_ca + (t - old_ca) * (span_new / span_old)


def scale_pre_target(t: float, old_ca: float, new_ca: float) -> float:
    return t * (new_ca / old_ca)


def rescale_time(t: float, old_ca: float, new_ca: float, old_end: float) -> float:
    if t == old_ca:
        return new_ca
    if t < old_ca:
        return scale_pre_target(t, old_ca, new_ca)
    return scale_post_target(t, old_ca, new_ca, old_end)


def rescale_price_waypoints(
    payload: dict, old_ca: float, new_ca: float, old_end: float
) -> int:
    """Mutate preload_stocks.payload.price_waypoints in place. Returns count."""
    waypoints = payload.get("price_waypoints")
    if not waypoints:
        return 0
    total = 0
    for symbol, points in waypoints.items():
        rescaled = []
        for point in points:
            t, price = float(point[0]), float(point[1])
            rescaled.append([round(rescale_time(t, old_ca, new_ca, old_end), 2), price])
            total += 1
        waypoints[symbol] = rescaled
    return total


def rescale_star_waypoints(
    payload: dict, old_ca: float, new_ca: float, old_end: float
) -> int:
    """Mutate preload_repo.payload.star_waypoints in place. Returns count."""
    waypoints = payload.get("star_waypoints")
    if not waypoints:
        return 0
    rescaled = []
    for point in waypoints:
        t, stars = float(point[0]), point[1]
        rescaled.append([round(rescale_time(t, old_ca, new_ca, old_end), 2), stars])
    payload["star_waypoints"] = rescaled
    return len(rescaled)


def transform(scenario: dict) -> tuple[dict, dict]:
    """Return (updated_scenario, summary)."""
    scenario_id = scenario["id"]
    old_ca = float(scenario["condition_at"])
    # First-time authoring uses `duration`; re-runs after the script has
    # already run use `event_timeline_end`. Both define the right-edge the
    # scenario was authored against for post-target scaling.
    old_end = float(
        scenario.get("duration")
        or scenario.get("event_timeline_end")
        or old_ca * 2
    )

    rng = seeded_rng(scenario_id)
    new_ca = round(rng.uniform(MIN_CONDITION_AT, MAX_CONDITION_AT), 2)

    old_events = scenario.get("events", [])
    if old_events:
        old_end = max(old_end, max(float(e["time"]) for e in old_events))
    new_events = []
    n_waypoints = 0
    for ev in old_events:
        t = float(ev["time"])
        new_ev = {**ev, "time": round(rescale_time(t, old_ca, new_ca, old_end), 2)}
        if ev.get("type") == "preload_stocks":
            payload = dict(ev.get("payload", {}))
            n_waypoints += rescale_price_waypoints(payload, old_ca, new_ca, old_end)
            new_ev["payload"] = payload
        elif ev.get("type") == "preload_repo":
            payload = dict(ev.get("payload", {}))
            n_waypoints += rescale_star_waypoints(payload, old_ca, new_ca, old_end)
            new_ev["payload"] = payload
        new_events.append(new_ev)

    updated = {k: v for k, v in scenario.items() if k != "duration"}
    updated["condition_at"] = new_ca
    updated["event_timeline_end"] = EVENT_TIMELINE_END
    updated["kill_at"] = KILL_AT
    updated["events"] = new_events

    ordered = {k: updated[k] for k in FIELD_ORDER if k in updated}
    for k in updated:
        if k not in ordered:
            ordered[k] = updated[k]

    targets = [e for e in old_events if float(e["time"]) == old_ca]
    summary = {
        "id": scenario_id,
        "old_condition_at": old_ca,
        "new_condition_at": new_ca,
        "n_targets": len(targets),
        "n_events": len(old_events),
        "n_waypoints": n_waypoints,
        "max_event_time_old": max((float(e["time"]) for e in old_events), default=0.0),
        "max_event_time_new": max((e["time"] for e in new_events), default=0.0),
    }
    return ordered, summary


def run(dry_run: bool) -> int:
    scenario_paths = sorted(SCENARIOS_DIR.glob("*/*.json"))
    touched = 0
    skipped = 0
    warnings = []

    print(f"{'id':<48} {'old_ca':>8} {'new_ca':>8} {'tgts':>5} {'events':>7} {'wps':>5} {'max_t_new':>10}")
    print("-" * 102)

    for path in scenario_paths:
        with path.open() as fh:
            data = json.load(fh)
        if "condition_at" not in data:
            skipped += 1
            continue

        updated, summary = transform(data)
        print(
            f"{summary['id']:<48} "
            f"{summary['old_condition_at']:>8.2f} "
            f"{summary['new_condition_at']:>8.2f} "
            f"{summary['n_targets']:>5} "
            f"{summary['n_events']:>7} "
            f"{summary['n_waypoints']:>5} "
            f"{summary['max_event_time_new']:>10.2f}"
        )

        if summary["n_targets"] == 0 and summary["n_waypoints"] == 0:
            warnings.append(
                f"  {summary['id']}: 0 events at old condition_at AND no waypoints — "
                f"likely nothing hits the target at condition_at. Check the scenario."
            )

        if not dry_run:
            with path.open("w") as fh:
                json.dump(updated, fh, indent=2)
                fh.write("\n")

        touched += 1

    print()
    print(f"{'WROTE' if not dry_run else 'WOULD WRITE'}: {touched} scenarios")
    print(f"SKIPPED: {skipped} scenarios (no condition_at)")
    if warnings:
        print()
        print("WARNINGS:")
        for w in warnings:
            print(w)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="print plan without writing")
    args = parser.parse_args()
    return run(dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
