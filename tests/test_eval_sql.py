#!/usr/bin/env python3
"""Test all eval_sql scenarios end-to-end.

Auto-discovers all scenario JSONs across 10 environments, runs each through
the full lifecycle (init -> advance all events -> simulate user actions ->
evaluate -> assert success), and reports pass/fail.

Usage:
    cd SentinelBench
    .venv/bin/python tests/test_eval_sql.py             # positive tests only
    .venv/bin/python tests/test_eval_sql.py --negative   # also run negative tests

Requires: server running on localhost:8000
"""
import argparse
import json
import sys
import time
from pathlib import Path

import requests

HOST = "http://localhost:8000"
TIMEOUT = 10

# Scenarios whose eval_sql checks user-created state that events alone cannot satisfy.
# The agent must interact with items delivered by events to meet these thresholds.
NEEDS_USER_ACTION = {
    "microhub-contribute-absolute-active",
    "microhood-orders-absolute-active",
    "microgram-follows-absolute-active",
    "microgram-likes-absolute-passive",
    "microgram-stories-absolute-passive",
    "microfy-followers-absolute-active",
    "microfy-likes-absolute-passive",
    "microfy-plays-absolute-passive",
    "microlendar-tasks-absolute-passive",
    "microtube-views-relative-active",
    "microtube-subscribers-absolute-passive",
}

# Scenarios exempt from negative testing (eval_sql passes from preload alone by design).
NEGATIVE_EXEMPT = {
    "microhub-browse-absolute-passive",       # placeholder: SELECT 1 >= 1
    "microhood-portfolio-absolute-passive",    # preloaded portfolio already meets $15k threshold
}


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def get(path, **kwargs):
    r = requests.get(f"{HOST}{path}", timeout=TIMEOUT, **kwargs)
    r.raise_for_status()
    return r.json()


def post(path, json_body=None):
    r = requests.post(f"{HOST}{path}", json=json_body, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def close():
    try:
        requests.get(f"{HOST}/close", timeout=TIMEOUT)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Init + advance helpers
# ---------------------------------------------------------------------------

def build_init_body(scenario):
    return {
        "environment": scenario["environment"],
        "duration": scenario["duration"],
        "eval_sql": scenario.get("eval_sql", ""),
        "events": scenario["events"],
    }


def advance_all():
    """Advance simulation time to 999999 to process all events at once."""
    return get("/advance", params={"time": 999999})


# ---------------------------------------------------------------------------
# Action simulation for scenarios that need user-created state
# ---------------------------------------------------------------------------

def simulate_actions(scenario_id):
    """Simulate agent actions for scenarios whose eval_sql needs user interaction."""

    if scenario_id == "microhub-contribute-absolute-active":
        # Comment on an issue (eval: user_created_comments >= 1)
        issues = get("/data/microhub-issues")["issues"]
        post(f"/data/microhub-issues/{issues[0]['id']}/comment", {"body": "test comment"})

    elif scenario_id == "microhood-orders-absolute-active":
        # Place 3 buy orders (eval: orders >= 3)
        stocks = get("/data/microhood-stocks")["stocks"]
        for i in range(3):
            sym = stocks[i % len(stocks)]["symbol"]
            post(f"/data/microhood-stocks/{sym}/order",
                 {"action": "buy", "quantity": 1, "type": "market"})

    elif scenario_id == "microgram-follows-absolute-active":
        # Follow 5 users (eval: followed_users >= 5)
        for i in range(5):
            post(f"/data/microgram-users/test-user-{i}/follow")

    elif scenario_id == "microgram-likes-absolute-passive":
        # Like 10 posts (eval: post_states WHERE isLiked=1 >= 10)
        posts = get("/data/microgram-posts")["posts"]
        for p in posts[:10]:
            post(f"/data/microgram-posts/{p['id']}/like")

    elif scenario_id == "microgram-stories-absolute-passive":
        # View 10 stories (eval: story_states WHERE isViewed=1 >= 10)
        stories = get("/data/microgram-stories")["stories"]
        for s in stories[:10]:
            post(f"/data/microgram-stories/{s['id']}/view")

    elif scenario_id == "microfy-followers-absolute-active":
        # Follow 5 artists (eval: followed_artists >= 5)
        artists = get("/data/microfy-artists")["artists"]
        for a in artists[:5]:
            post(f"/data/microfy-artists/{a['id']}/follow")

    elif scenario_id == "microfy-likes-absolute-passive":
        # Like 10 tracks (eval: track_states WHERE isLiked=1 >= 10)
        tracks = get("/data/microfy-tracks")["tracks"]
        for t in tracks[:10]:
            post(f"/data/microfy-tracks/{t['id']}/like")

    elif scenario_id == "microfy-plays-absolute-passive":
        # Play 5 tracks (eval: SUM(userPlayCount) >= 5)
        tracks = get("/data/microfy-tracks")["tracks"]
        for t in tracks[:5]:
            post(f"/data/microfy-tracks/{t['id']}/play")

    elif scenario_id == "microlendar-tasks-absolute-passive":
        # Create 2 extra tasks to reach 12 (eval: tasks >= 12, events deliver 10)
        post("/data/microlendar-tasks", {"title": "Test task 1", "dueDate": "2026-03-25"})
        post("/data/microlendar-tasks", {"title": "Test task 2", "dueDate": "2026-03-26"})

    elif scenario_id == "microtube-views-relative-active":
        # Watch 5 videos (eval: watched_videos - baseline >= 5)
        videos = get("/data/microtube-videos")["videos"]
        for v in videos[:5]:
            post(f"/data/microtube-videos/{v['id']}/watch")

    elif scenario_id == "microtube-subscribers-absolute-passive":
        # Subscribe to 3 channels (eval: channel_states WHERE isSubscribed=1 >= 3)
        channels = get("/data/microtube-channels")["channels"]
        for c in channels[:3]:
            post(f"/data/microtube-channels/{c['id']}/subscribe")


# ---------------------------------------------------------------------------
# Test runners
# ---------------------------------------------------------------------------

def run_one(scenario_path: Path) -> tuple:
    """Run a single scenario. Returns (id, passed, detail)."""
    try:
        with open(scenario_path) as f:
            scenario = json.load(f)
        sid = scenario["id"]
    except Exception as e:
        return (str(scenario_path), False, f"Failed to load JSON: {e}")

    try:
        close()
        init_resp = post("/init", build_init_body(scenario))
        if not init_resp.get("success"):
            return (sid, False, f"init failed: {init_resp}")

        advance_all()

        if sid in NEEDS_USER_ACTION:
            simulate_actions(sid)

        result = post("/evaluate")
        passed = result.get("success", False)
        detail = result.get("detail", "")
        return (sid, passed, detail if not passed else "")

    except Exception as e:
        return (sid, False, f"Exception: {e}")

    finally:
        close()


def run_negative(scenario_path: Path) -> tuple:
    """Init scenario but DON'T advance events. Eval should NOT succeed.

    This validates that eval_sql actually checks something meaningful
    rather than always returning true.
    """
    try:
        with open(scenario_path) as f:
            scenario = json.load(f)
        sid = scenario["id"]
    except Exception as e:
        return (str(scenario_path), False, f"Failed to load JSON: {e}")

    if sid in NEGATIVE_EXEMPT:
        return (sid, True, "")

    try:
        close()
        init_resp = post("/init", build_init_body(scenario))
        if not init_resp.get("success"):
            return (sid, False, f"init failed: {init_resp}")

        # No advance, no actions — just evaluate immediately after preload
        result = post("/evaluate")
        if result.get("success"):
            return (sid, False, "NEGATIVE: eval_sql passes without events")
        return (sid, True, "")

    except Exception as e:
        return (sid, False, f"Exception: {e}")

    finally:
        close()


# ---------------------------------------------------------------------------
# Scenario discovery
# ---------------------------------------------------------------------------

def discover_scenarios() -> list:
    """Find all scenario JSONs across environment subdirectories."""
    base = Path("sentinel_api")
    # Exclude webarena reference implementations
    scenarios = sorted(
        p for p in base.glob("*/scenarios/*.json")
        if "webarena" not in str(p)
    )
    return scenarios


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Test all eval_sql scenarios end-to-end.")
    parser.add_argument("--negative", action="store_true",
                        help="Also run negative tests (eval should fail without events)")
    args = parser.parse_args()

    # Verify server is running
    try:
        requests.get(f"{HOST}/status", timeout=3)
    except requests.ConnectionError:
        print("ERROR: Server not running on localhost:8000")
        print("Start with: .venv/bin/uvicorn sentinel_api.server:app --port 8000")
        sys.exit(1)

    # Ensure clean state
    close()

    scenarios = discover_scenarios()
    if not scenarios:
        print("ERROR: No scenario files found. Run from SentinelBench/ directory.")
        sys.exit(1)

    print(f"Discovered {len(scenarios)} scenarios\n")

    # --- Positive tests ---
    print("=" * 60)
    print("POSITIVE TESTS (init -> advance all -> actions -> evaluate)")
    print("=" * 60)
    results = []
    for s in scenarios:
        sid, passed, detail = run_one(s)
        results.append((sid, passed, detail))
        status = "\033[32mPASS\033[0m" if passed else "\033[31mFAIL\033[0m"
        line = f"  [{status}] {sid}"
        if not passed:
            line += f" — {detail}"
        print(line)

    pos_passed = sum(1 for _, p, _ in results if p)
    pos_failed = [(sid, d) for sid, p, d in results if not p]

    print(f"\nPositive: {pos_passed}/{len(results)} passed")
    if pos_failed:
        print("FAILURES:")
        for sid, d in pos_failed:
            print(f"  {sid}: {d}")

    # --- Negative tests (optional) ---
    neg_failed = []
    neg_total = 0
    if args.negative:
        print(f"\n{'=' * 60}")
        print("NEGATIVE TESTS (init only, no advance — eval should fail)")
        print("=" * 60)
        neg_results = []
        for s in scenarios:
            sid, passed, detail = run_negative(s)
            neg_results.append((sid, passed, detail))
            status = "\033[32mPASS\033[0m" if passed else "\033[31mFAIL\033[0m"
            line = f"  [{status}] {sid}"
            if not passed:
                line += f" — {detail}"
            print(line)

        neg_total = len(neg_results)
        neg_passed = sum(1 for _, p, _ in neg_results if p)
        neg_failed = [(sid, d) for sid, p, d in neg_results if not p]

        print(f"\nNegative: {neg_passed}/{neg_total} passed")
        if neg_failed:
            print("FAILURES:")
            for sid, d in neg_failed:
                print(f"  {sid}: {d}")

    # --- Summary ---
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print("=" * 60)
    print(f"  Positive: {pos_passed}/{len(results)} passed")
    if args.negative:
        print(f"  Negative: {neg_total - len(neg_failed)}/{neg_total} passed")

    all_ok = not pos_failed and not neg_failed
    if all_ok:
        print("  ALL TESTS PASSED")
    print("=" * 60)
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
