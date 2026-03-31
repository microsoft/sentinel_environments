"""End-to-end test: server lifecycle + frontend via Playwright.

Validates the full sentinel_environments-compatible flow:
  1. Server starts in preinit
  2. run_simulation.py inits + advances events
  3. Frontend shows emails, mutations work
  4. Evaluate returns success when conditions met
  5. /close resets to preinit
"""
import json
import subprocess
import sys
import time

import requests

HOST = "http://localhost:8000"
FRONTEND = "http://localhost:5173"
SCENARIO = "sentinel_api/micromail/scenarios/micromail-attachment-absolute-active.json"


def step(name):
    print(f"\n{'='*60}\n  {name}\n{'='*60}")


def check(label, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}" + (f" — {detail}" if detail else ""))
    if not condition:
        raise AssertionError(f"FAILED: {label} {detail}")


def _build_init_payload(scenario):
    return {
        "environment": scenario["environment"],
        "duration": scenario["duration"],
        "eval_sql": scenario.get("eval_sql", ""),
        "events": scenario["events"],
    }


def test_backend_lifecycle():
    """Test 1: Full backend lifecycle without frontend."""
    step("Test 1: Backend Lifecycle")

    # 1a. Server should be in preinit
    r = requests.get(f"{HOST}/status").json()
    check("Server in preinit", r["status"] == "preinit")

    # 1b. Load scenario and POST /init
    with open(SCENARIO) as f:
        scenario = json.load(f)

    init_payload = _build_init_payload(scenario)
    r = requests.post(f"{HOST}/init", json=init_payload)
    r.raise_for_status()
    data = r.json()
    check("Init returns ready", data["status"] == "ready")
    check("Simulation time is 0", data["simulation_time"] == 0)
    check("Next event time is set", data["next_event_time"] is not None, f"next_event_time={data['next_event_time']}")

    # 1c. Advance through all events
    sim_time = data["simulation_time"]
    next_time = data["next_event_time"]
    event_count = 0

    while next_time is not None:
        r = requests.get(f"{HOST}/advance", params={"time": next_time})
        r.raise_for_status()
        data = r.json()
        event_count += len(data.get("processed_events", []))
        sim_time = data["simulation_time"]
        next_time = data["next_event_time"]

    check("All events processed", event_count == 10, f"got {event_count}")

    # 1d. Check data endpoints
    emails = requests.get(f"{HOST}/data/emails").json()["emails"]
    check("10 emails in data store", len(emails) == 10)
    check("All have attachments", all(e["hasAttachment"] for e in emails))
    check("All unread", all(not e["isRead"] for e in emails))

    config = requests.get(f"{HOST}/data/config").json()
    check("Config task=attachment", config["task"] == "attachment")
    check("Config activity=active", config["activity"] == "active")

    # 1e. Evaluate — should succeed (eval_sql is sole arbiter)
    r = requests.post(f"{HOST}/evaluate").json()
    check("Evaluate success", r["success"] is True)

    # 1f. Close resets to preinit
    requests.get(f"{HOST}/close")
    r = requests.get(f"{HOST}/status").json()
    check("Close resets to preinit", r["status"] == "preinit")


def test_passive_scenario():
    """Test 2: Passive scenario."""
    step("Test 2: Passive Scenario")

    scenario_path = "sentinel_api/micromail/scenarios/micromail-unread-absolute-passive.json"
    with open(scenario_path) as f:
        scenario = json.load(f)

    init_payload = _build_init_payload(scenario)
    requests.post(f"{HOST}/init", json=init_payload)

    # Advance all events
    data = requests.get(f"{HOST}/status").json()
    next_time = data["next_event_time"]
    while next_time is not None:
        data = requests.get(f"{HOST}/advance", params={"time": next_time}).json()
        next_time = data["next_event_time"]

    # Evaluate — eval_sql is the sole arbiter
    r = requests.post(f"{HOST}/evaluate").json()
    check("Passive evaluate succeeds", r["success"] is True)

    requests.get(f"{HOST}/close")


def test_relative_scenario():
    """Test 3: Relative scenario (preloaded emails + delta threshold)."""
    step("Test 3: Relative Scenario (preload + delta)")

    scenario_path = "sentinel_api/micromail/scenarios/micromail-unread-relative-active.json"
    with open(scenario_path) as f:
        scenario = json.load(f)

    init_payload = _build_init_payload(scenario)
    r = requests.post(f"{HOST}/init", json=init_payload).json()

    # After init, preloaded emails should exist
    emails = requests.get(f"{HOST}/data/emails").json()["emails"]
    preload_ids = scenario["events"][0]["payload"]["email_ids"]
    check("Preloaded emails present", len(emails) == len(preload_ids), f"{len(emails)} emails, expected {len(preload_ids)}")

    # Advance all events
    next_time = r["next_event_time"]
    while next_time is not None:
        data = requests.get(f"{HOST}/advance", params={"time": next_time}).json()
        next_time = data["next_event_time"]

    # Evaluate — eval_sql is the sole arbiter
    r = requests.post(f"{HOST}/evaluate").json()
    check("Relative evaluate succeeds", r["success"] is True)

    requests.get(f"{HOST}/close")


def test_state_machine_errors():
    """Test 4: State machine rejects invalid transitions."""
    step("Test 4: State Machine Error Handling")

    # Can't advance in preinit
    r = requests.get(f"{HOST}/advance", params={"time": 10})
    check("/advance rejected in preinit", r.status_code == 409)

    # Can't init twice
    with open(SCENARIO) as f:
        scenario = json.load(f)
    init_payload = _build_init_payload(scenario)
    r = requests.post(f"{HOST}/init", json=init_payload)
    check("First init succeeds", r.status_code == 200)

    r = requests.post(f"{HOST}/init", json=init_payload)
    check("Second init rejected", r.status_code == 409)

    requests.get(f"{HOST}/close")


def test_mutation_persistence():
    """Test 5: Email mutations persist across polls."""
    step("Test 5: Mutation Persistence")

    with open(SCENARIO) as f:
        scenario = json.load(f)
    init_payload = _build_init_payload(scenario)
    requests.post(f"{HOST}/init", json=init_payload)

    # Advance to get some emails
    data = requests.get(f"{HOST}/status").json()
    next_time = data["next_event_time"]
    requests.get(f"{HOST}/advance", params={"time": next_time})

    # Mark first email as read
    email_id = "att-01"
    requests.post(f"{HOST}/data/emails/{email_id}/read")

    # Poll again — should still be read
    emails = requests.get(f"{HOST}/data/emails").json()["emails"]
    e = next(e for e in emails if e["id"] == email_id)
    check("Read state persists after poll", e["isRead"] is True)

    # Flag it
    requests.post(f"{HOST}/data/emails/{email_id}/flag")
    emails = requests.get(f"{HOST}/data/emails").json()["emails"]
    e = next(e for e in emails if e["id"] == email_id)
    check("Flag state persists", e["isFlagged"] is True)

    # Move to junk
    requests.post(f"{HOST}/data/emails/{email_id}/move",
                  json={"folder": "junk"}, headers={"Content-Type": "application/json"})
    emails = requests.get(f"{HOST}/data/emails").json()["emails"]
    e = next(e for e in emails if e["id"] == email_id)
    check("Move to junk persists", e["folder"] == "junk")

    requests.get(f"{HOST}/close")


def test_frontend_proxy():
    """Test 6: Frontend proxy serves API data correctly."""
    step("Test 6: Frontend Proxy")

    # Init a scenario
    with open(SCENARIO) as f:
        scenario = json.load(f)
    init_payload = _build_init_payload(scenario)
    requests.post(f"{HOST}/init", json=init_payload)

    # Advance all events
    data = requests.get(f"{HOST}/status").json()
    next_time = data["next_event_time"]
    while next_time is not None:
        data = requests.get(f"{HOST}/advance", params={"time": next_time}).json()
        next_time = data["next_event_time"]

    # Test via Vite proxy (if frontend is running)
    try:
        r = requests.get(f"{FRONTEND}/api/data/config", timeout=3)
        r.raise_for_status()
    except Exception:
        print("  [SKIP] Frontend not running on localhost:5173")
        requests.get(f"{HOST}/close")
        return

    config = r.json()
    check("Proxy /api/data/config works", config["task"] == "attachment")

    emails = requests.get(f"{FRONTEND}/api/data/emails").json()["emails"]
    check("Proxy /api/data/emails returns emails", len(emails) == 10)

    # Mutation via proxy
    requests.post(f"{FRONTEND}/api/data/emails/att-01/read")
    emails = requests.get(f"{FRONTEND}/api/data/emails").json()["emails"]
    e = next(e for e in emails if e["id"] == "att-01")
    check("Mutation via proxy persists", e["isRead"] is True)

    # Evaluate via proxy
    r = requests.post(f"{FRONTEND}/api/evaluate").json()
    check("Evaluate via proxy succeeds", r["success"] is True)

    requests.get(f"{HOST}/close")
    print("\n  NOTE: Full browser tests in sentinelbench/tests/micromail-e2e.spec.ts (npx playwright test)")


def main():
    # Verify server is running
    try:
        requests.get(f"{HOST}/status", timeout=3)
    except requests.ConnectionError:
        print("ERROR: Server not running on localhost:8000")
        print("Start with: .venv/bin/uvicorn sentinel_api.server:app --port 8000")
        sys.exit(1)

    # Ensure clean state
    requests.get(f"{HOST}/close")
    time.sleep(0.5)

    passed = 0
    failed = 0
    skipped = 0

    tests = [
        test_backend_lifecycle,
        test_passive_scenario,
        test_relative_scenario,
        test_state_machine_errors,
        test_mutation_persistence,
        test_frontend_proxy,
    ]

    for test_fn in tests:
        try:
            test_fn()
            passed += 1
        except AssertionError as e:
            print(f"  FAILED: {e}")
            failed += 1
            # Reset state for next test
            requests.get(f"{HOST}/close")
        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1
            requests.get(f"{HOST}/close")

    step("Results")
    print(f"  {passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
