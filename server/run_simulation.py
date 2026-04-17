# Scenario playback tool for local testing.
# Drives the simulation lifecycle against a running server:
#   /close (reset) -> /init (load scenario) -> /advance (tick loop) -> /evaluate
#
# This is NOT the agent evaluation harness. It replays events at accelerated
# speed for verifying scenarios. The agent harness will live in evals/.
#
# flow: scenario.json -> run_simulation.py -> POST /init -> GET /advance (loop) -> /evaluate
# example: python -m server.run_simulation scenarios/micromail/inbox-relative-passive.json --speed 2
import argparse
import json
import time

import requests

DEFAULT_HOST = "http://localhost:8000"


def _raise_for_status_with_body(resp):
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        body = (resp.text or "").strip()[:2000]
        raise requests.HTTPError(f"{e}\n\nResponse body:\n{body}", response=resp) from e


def _poll_until(host, target_states, valid_states=None):
    while True:
        resp = requests.get(f"{host}/status")
        _raise_for_status_with_body(resp)
        data = resp.json()
        if data["status"] in target_states:
            return data
        if valid_states and data["status"] not in valid_states:
            raise RuntimeError(f"Unexpected state: {data['status']}")
        time.sleep(1)


def _startup(host):
    # Always close any existing session first so we start clean,
    # regardless of what state the server is in (completed, ready, running, etc.)
    resp = requests.get(f"{host}/status")
    _raise_for_status_with_body(resp)
    if resp.json()["status"] != "preinit":
        requests.get(f"{host}/close")
        time.sleep(1)
    return _poll_until(host, target_states=["preinit"], valid_states=["stopping"])


def main():
    parser = argparse.ArgumentParser(description="Run MicroMail simulation.")
    parser.add_argument("scenario", help="Path to scenario JSON file")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--close", action="store_true", help="Just send /close and exit")
    args = parser.parse_args()

    if args.close:
        requests.get(f"{args.host}/close")
        print("Sent /close.")
        return

    with open(args.scenario) as f:
        scenario = json.load(f)

    print(f"Scenario: {scenario['id']}")
    _startup(args.host)

    # POST /init with full scenario payload
    init_payload = {
        "environment": scenario["environment"],
        "duration": scenario["duration"],
        "eval_sql": scenario.get("eval_sql", ""),
        "condition_at": scenario.get("condition_at"),
        "events": scenario["events"],
    }
    resp = requests.post(f"{args.host}/init", json=init_payload)
    _raise_for_status_with_body(resp)
    data = resp.json()
    assert data["status"] == "ready", f"Expected ready, got {data}"

    sim_time = data["simulation_time"]
    next_time = data["next_event_time"]

    print(f"Initialized. Playback at {args.speed}x speed")

    while next_time is not None:
        sleep_for = (next_time - sim_time) / args.speed
        print(f"  Sleeping {sleep_for:.1f}s (sim -> {next_time}s)")
        time.sleep(sleep_for)

        resp = requests.get(f"{args.host}/advance", params={"time": next_time})
        _raise_for_status_with_body(resp)
        data = resp.json()

        sim_time = data["simulation_time"]
        next_time = data["next_event_time"]

        for e in data.get("processed_events", []):
            etype = e["type"]
            payload = e.get("payload", {})
            print(f"    [{sim_time}s] {etype}: {payload}")

    # Evaluate
    resp = requests.post(f"{args.host}/evaluate")
    _raise_for_status_with_body(resp)
    result = resp.json()
    print(f"\nEvaluation: success={result.get('success')}, detail={result.get('detail')}")

    # Final status
    resp = requests.get(f"{args.host}/status")
    status = resp.json()
    print(f"Status: {status.get('status')}")


if __name__ == "__main__":
    main()
