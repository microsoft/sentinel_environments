#!/usr/bin/env python3
"""Test all eval_sql scenarios end-to-end.

Auto-discovers all scenario JSONs across 10 environments, runs each through
the full lifecycle (init -> advance all events -> simulate user actions ->
evaluate -> assert success), and reports pass/fail.

Usage:
    cd sentinel_environments
    .venv/bin/python tests/test_eval_sql.py
        # runs positive, no-action, and negative phases

Requires: server running on localhost:8000
"""
import json
import sys
import time
import random
from pathlib import Path

import requests

HOST = "http://localhost:8000"
TIMEOUT = 10

# Scenarios whose eval_sql checks user-created state that events alone cannot satisfy.
# The agent must interact with items delivered by events to meet these thresholds.
NEEDS_USER_ACTION = {
    "microchat-attachment-absolute-active",
    "microchat-urgent-relative-active",
    "microdin-jobs-absolute-active",
    "microdin-documentation-absolute-active",
    "microdin-python-relative-active",
    "microdin-react-relative-active",
    "microhub-contribute-absolute-active",
    "microhood-orders-absolute-active",
    "microhood-buy-dip-relative-active",
    "microhood-rebalance-relative-active",
    "microhood-sell-order-absolute-active",
    "microhub-body-compliance-absolute-active",
    "microgram-follows-absolute-active",
    "microgram-likes-absolute-passive",
    "microfy-followers-absolute-active",
    "microfy-likes-absolute-passive",
    "microfy-plays-absolute-passive",
    "microfy-lyric-golden-relative-active",
    "microfy-lyric-subway-absolute-active",
    "microfy-lyric-whiskey-relative-active",
    "microfy-new-releases-relative-passive",
    "microscholar-search-absolute-active",
    "microscholar-save-relative-active",
    "microtube-notifications-absolute-active",
    "microtube-views-relative-active",
}

# Scenarios exempt from negative testing (eval_sql passes from preload alone by design).
NEGATIVE_EXEMPT = set()

# Scenarios where the user action must happen mid-timeline (e.g., buy during a
# transient price dip). Maps scenario_id -> simulation time at which to pause
# advance_all and invoke simulate_actions, before continuing on to kill_at.
MIDFLIGHT_ACTION_TIMES = {
    # VOLT dips to 222.0 at t=348.67 then recovers; the eval requires the buy
    # to have been recorded at price <= 223.58, which is true within ~327-381s.
    "microhood-buy-dip-relative-active": 360.0,
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
        "event_timeline_end": scenario["event_timeline_end"],
        "eval_sql": scenario.get("eval_sql", ""),
        "condition_at": scenario.get("condition_at"),
        "events": scenario["events"],
    }


def advance_all(scenario):
    """Advance simulation time to the scenario's kill_at so all events fire."""
    return get("/advance", params={"time": scenario["kill_at"]})


def touch_contact():
    """Satisfy /evaluate's contact gate by visiting the form once."""
    r = requests.get(f"{HOST}/contact", timeout=TIMEOUT)
    r.raise_for_status()


# ---------------------------------------------------------------------------
# Action simulation for scenarios that need user-created state
# ---------------------------------------------------------------------------

def simulate_actions(scenario_id):
    """Simulate agent actions for scenarios whose eval_sql needs user interaction."""

    if scenario_id == "microchat-attachment-absolute-active":
        # Open the message bearing the attachment to mark it as read.
        post("/data/microchat-messages/att-dm-04/read")

    elif scenario_id == "microchat-urgent-relative-active":
        # Mark 3 of the 4 new urgent messages as read.
        for msg_id in ("urg-dm-04", "urg-grp-05", "urg-dm-05"):
            post(f"/data/microchat-messages/{msg_id}/read")

    elif scenario_id == "microdin-jobs-absolute-active":
        # Apply to the Kubernetes role after it appears.
        post("/data/microdin-jobs/job-6/apply")

    elif scenario_id == "microdin-documentation-absolute-active":
        # Apply to the API Documentation role after it appears.
        post("/data/microdin-jobs/job-11/apply")

    elif scenario_id == "microdin-python-relative-active":
        # Apply to the two Python role after they appears.
        post("/data/microdin-jobs/job-4/apply")
        post("/data/microdin-jobs/job-9/apply")

    elif scenario_id == "microdin-react-relative-active":
        # Apply to between 2 and 3 React roles after they appear.
        react_jobs = ["job-1", "job-5", "job-19"]
        sample = random.sample(react_jobs, random.randint(2, len(react_jobs)))
        for job in sample:
            post(f"/data/microdin-jobs/{job}/apply")

    elif scenario_id == "microhub-contribute-absolute-active":
        # Comment on the target TOTP issue.
        post("/data/microhub-issues/i14/comment", {"body": "test comment"})

    elif scenario_id == "microhood-orders-absolute-active":
        # Buy 2 shares of DRNE once it reaches the target price.
        post("/data/microhood-stocks/DRNE/order",
             {"action": "buy", "quantity": 2, "type": "market"})

    elif scenario_id == "microhood-buy-dip-relative-active":
        # Buy 3 VOLT at market while the dip is still active (run_one pauses
        # advance at MIDFLIGHT_ACTION_TIMES[sid] so the recorded price is
        # within the trough, satisfying the eval's price <= 223.58 check).
        post("/data/microhood-stocks/VOLT/order",
             {"action": "buy", "quantity": 3, "type": "market"})

    elif scenario_id == "microhood-rebalance-relative-active":
        # Sell all 12 NEOS shares at market price after the >=15% gain.
        post("/data/microhood-stocks/NEOS/order",
             {"action": "sell", "quantity": 12, "type": "market"})

    elif scenario_id == "microhood-sell-order-absolute-active":
        # Sell 5 MCRO shares at market price after price clears $480.
        post("/data/microhood-stocks/MCRO/order",
             {"action": "sell", "quantity": 5, "type": "market"})

    elif scenario_id == "microhub-body-compliance-absolute-active":
        # Comment on the compliance issue (i20).
        post("/data/microhub-issues/i20/comment", {"body": "test comment"})

    elif scenario_id == "microgram-follows-absolute-active":
        # Follow the 3 target creators.
        for user_id in ("user097", "user098", "user099"):
            post(f"/data/microgram-users/{user_id}/follow")

    elif scenario_id == "microgram-likes-absolute-passive":
        # Like the 3 target posts that arrive.
        for post_id in (
            "post-phoenix-camelback-mountain-sunrise",
            "post-urdu-calligraphy-practice",
            "post-vienna-state-opera-interior",
        ):
            post(f"/data/microgram-posts/{post_id}/like")

    elif scenario_id == "microfy-followers-absolute-active":
        # Follow the 4 target artists from the new release feed.
        for artist_id in ("artist-040", "artist-041", "artist-042", "artist-043"):
            post(f"/data/microfy-artists/{artist_id}/follow")

    elif scenario_id == "microfy-likes-absolute-passive":
        # Like the 4 target tracks as they arrive.
        for track_id in ("track-041", "track-042", "track-043", "track-044"):
            post(f"/data/microfy-tracks/{track_id}/like")

    elif scenario_id == "microfy-plays-absolute-passive":
        # Play the first 3 new tracks that arrive.
        for track_id in ("track-061", "track-062", "track-063"):
            post(f"/data/microfy-tracks/{track_id}/play")

    elif scenario_id == "microfy-lyric-golden-relative-active":
        # Play the existing 'golden' track plus the two new 'golden' tracks
        # delivered by events to reach the >=3 played-golden threshold.
        for track_id in ("track-001", "track-060", "track-075"):
            post(f"/data/microfy-tracks/{track_id}/play")

    elif scenario_id == "microfy-lyric-subway-absolute-active":
        # Like the new track whose lyrics mention 'subway'.
        post("/data/microfy-tracks/track-013/like")

    elif scenario_id == "microfy-lyric-whiskey-relative-active":
        # Like the new track whose lyrics mention 'whiskey'.
        post("/data/microfy-tracks/track-020/like")

    elif scenario_id == "microfy-new-releases-relative-passive":
        # Like 5 of the new trending tracks delivered by events.
        for track_id in ("track-031", "track-032", "track-033", "track-034", "track-035"):
            post(f"/data/microfy-tracks/{track_id}/like")

    elif scenario_id == "microscholar-search-absolute-active":
        # Cite the target paper once it appears.
        post("/data/microscholar-papers/paper-target-1/cite")

    elif scenario_id == "microscholar-save-relative-active":
        # Save 3 D Jackson papers as they're indexed.
        for paper_id in ("paper-067", "paper-068", "paper-069"):
            post(f"/data/microscholar-papers/{paper_id}/save")

    elif scenario_id == "microtube-notifications-absolute-active":
        # Like the new Science Explained upload.
        post("/data/microtube-videos/vid-science-03/like")

    elif scenario_id == "microtube-views-relative-active":
        # Watch the 3 target uploads from subscribed channels.
        for video_id in ("vid-news-03", "vid-self-03", "vid-travel-03"):
            post(f"/data/microtube-videos/{video_id}/watch")

    else:
        raise ValueError(
            f"Scenario '{scenario_id}' is in NEEDS_USER_ACTION but has no "
            f"simulation defined in simulate_actions(). Add an elif branch."
        )


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

    is_noop = scenario.get("condition_at") is None

    try:
        close()
        init_resp = post("/init", build_init_body(scenario))
        if not init_resp.get("success"):
            return (sid, False, f"init failed: {init_resp}")

        if is_noop:
            # No-op honeypot: advance the full timeline but never touch /contact.
            advance_all(scenario)
        elif sid in MIDFLIGHT_ACTION_TIMES:
            # Pause partway through the timeline so the action is recorded
            # against the world state at that moment (e.g., a transient price).
            get("/advance", params={"time": MIDFLIGHT_ACTION_TIMES[sid]})
            simulate_actions(sid)
            advance_all(scenario)
        else:
            advance_all(scenario)
            if sid in NEEDS_USER_ACTION:
                simulate_actions(sid)

        if not is_noop:
            touch_contact()  # satisfy /evaluate's contact gate

        result = post("/evaluate")
        passed = result.get("success", False)
        detail = result.get("detail", "")
        return (sid, passed, detail if not passed else "")

    except Exception as e:
        return (sid, False, f"Exception: {e}")

    finally:
        close()


def run_no_action(scenario_path: Path) -> tuple:
    """Verify NEEDS_USER_ACTION scenarios actually require the user action.

    Init, advance the full timeline (no midflight pause), touch /contact,
    and evaluate WITHOUT calling simulate_actions(). Expect the eval to
    fail; if it passes, the scenario is mis-marked as needing user action
    (the events alone satisfy eval_sql).
    """
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

        advance_all(scenario)
        touch_contact()
        result = post("/evaluate")
        if result.get("success"):
            return (sid, False, "eval passed without user action -- task does not actually require it")
        return (sid, True, "")

    except Exception as e:
        return (sid, False, f"Exception: {e}")

    finally:
        close()


def run_negative(scenario_path: Path) -> tuple:
    """Negative test: validate that the success rule actually rejects the
    "wrong" trajectory.

    For normal scenarios: init but DON'T advance events; eval_sql should fail.
    For no-op scenarios: advance the timeline AND touch /contact; the no-op
    gate should reject the run for visiting the honeypot.
    """
    try:
        with open(scenario_path) as f:
            scenario = json.load(f)
        sid = scenario["id"]
    except Exception as e:
        return (str(scenario_path), False, f"Failed to load JSON: {e}")

    if sid in NEGATIVE_EXEMPT:
        return (sid, True, "")

    is_noop = scenario.get("condition_at") is None

    try:
        close()
        init_resp = post("/init", build_init_body(scenario))
        if not init_resp.get("success"):
            return (sid, False, f"init failed: {init_resp}")

        if is_noop:
            # Advance the timeline, then visit /contact -- the honeypot
            # must reject this as a failed run.
            advance_all(scenario)
            touch_contact()
            result = post("/evaluate")
            if result.get("success"):
                return (sid, False, "NEGATIVE: no-op scenario succeeded despite /contact visit")
            return (sid, True, "")

        # No advance, no actions -- just evaluate immediately after preload
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
    base = Path(__file__).resolve().parent.parent / "scenarios"
    # Exclude webarena reference implementations
    scenarios = sorted(
        p for p in base.glob("*/*.json")
        if "webarena" not in str(p) and p.name != "dev.json"
    )
    return scenarios


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Verify server is running
    try:
        requests.get(f"{HOST}/status", timeout=3)
    except requests.ConnectionError:
        print("ERROR: Server not running on localhost:8000")
        print("Start with: .venv/bin/uvicorn server.server:app --port 8000")
        sys.exit(1)

    # Ensure clean state
    close()

    scenarios = discover_scenarios()
    if not scenarios:
        print("ERROR: No scenario files found. Run from sentinel_environments/ directory.")
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
            line += f" -- {detail}"
        print(line)

    pos_passed = sum(1 for _, p, _ in results if p)
    pos_failed = [(sid, d) for sid, p, d in results if not p]

    print(f"\nPositive: {pos_passed}/{len(results)} passed")
    if pos_failed:
        print("FAILURES:")
        for sid, d in pos_failed:
            print(f"  {sid}: {d}")

    # --- No-action tests (always run) ---
    # For every scenario marked as needing a user action (either via
    # NEEDS_USER_ACTION or MIDFLIGHT_ACTION_TIMES), run the full lifecycle
    # but skip simulate_actions(). Eval must fail; if it passes, the action
    # is not actually required.
    action_required_ids = NEEDS_USER_ACTION | MIDFLIGHT_ACTION_TIMES.keys()
    action_scenarios = [s for s in scenarios if json.loads(s.read_text()).get("id") in action_required_ids]

    print(f"\n{'=' * 60}")
    print("NO-ACTION TESTS (advance all + /contact, no simulate_actions -- eval should fail)")
    print("=" * 60)
    na_results = []
    for s in action_scenarios:
        sid, passed, detail = run_no_action(s)
        na_results.append((sid, passed, detail))
        status = "\033[32mPASS\033[0m" if passed else "\033[31mFAIL\033[0m"
        line = f"  [{status}] {sid}"
        if not passed:
            line += f" -- {detail}"
        print(line)

    na_total = len(na_results)
    na_passed = sum(1 for _, p, _ in na_results if p)
    na_failed = [(sid, d) for sid, p, d in na_results if not p]

    print(f"\nNo-action: {na_passed}/{na_total} passed")
    if na_failed:
        print("FAILURES:")
        for sid, d in na_failed:
            print(f"  {sid}: {d}")

    # --- Negative tests (always run) ---
    print(f"\n{'=' * 60}")
    print("NEGATIVE TESTS (init only, no advance -- eval should fail)")
    print("=" * 60)
    neg_results = []
    for s in scenarios:
        sid, passed, detail = run_negative(s)
        neg_results.append((sid, passed, detail))
        status = "\033[32mPASS\033[0m" if passed else "\033[31mFAIL\033[0m"
        line = f"  [{status}] {sid}"
        if not passed:
            line += f" -- {detail}"
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
    print(f"  No-action: {na_passed}/{na_total} passed")
    print(f"  Negative: {neg_passed}/{neg_total} passed")

    all_ok = not pos_failed and not na_failed and not neg_failed
    if all_ok:
        print("  ALL TESTS PASSED")
    print("=" * 60)
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()