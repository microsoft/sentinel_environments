import time
import requests
import json
import argparse

DOCKER_SENTINEL_URL = "http://gcrazgdl1200.northcentralus.cloudapp.azure.com:8000"


def _raise_for_status_with_body(resp: requests.Response) -> None:
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        body = (resp.text or "").strip()
        if len(body) > 2000:
            body = body[:2000] + "... [truncated]"
        msg = f"{e}\n\nResponse body:\n{body}"
        raise requests.HTTPError(msg, response=resp) from e


def _poll_until(docker_sentinel_url, target_states, valid_states=None):
    """
    Poll the server until it is in the desired state.

    target_states: the function returns when the server is in one of these states
    valid_states: [Optional] list of valid states. Raise an error if not in one of these states.
    """

    while True:
        response = requests.get(f"{docker_sentinel_url}/status")
        _raise_for_status_with_body(response)
        status_data = response.json()

        if status_data["status"] in target_states:
            return status_data

        if valid_states is not None and status_data["status"] not in valid_states:
            raise Exception(f"Invalid state: {status_data['status']}")

        time.sleep(1)  # Wait before polling again


def main(
    scenario_file_path: str, docker_sentinel_url: str, playback_speed: float = 1.0
):
    # Read the scenario
    with open(scenario_file_path, "rt") as f:
        scenario_data = json.load(f)

    # Wait for things to start up
    response_data = _poll_until(
        docker_sentinel_url, target_states=["preinit"], valid_states=["starting"]
    )

    # Initialize the server
    init_events = {
        "events": scenario_data["events"],
    }

    response = requests.post(f"{docker_sentinel_url}/init", json=init_events)
    _raise_for_status_with_body(response)
    response_data = response.json()

    assert response_data["status"] == "ready"

    print("Done init()")

    simulation_time = response_data["simulation_time"]
    next_event_time = response_data["next_event_time"]

    # Run the simulation
    print(f"Playback at {playback_speed}x speed")
    while True:
        sleep_for = next_event_time - simulation_time
        time.sleep(sleep_for / playback_speed)

        response = requests.get(
            f"{docker_sentinel_url}/advance", params={"t": next_event_time}
        )
        _raise_for_status_with_body(response)
        response_data = response.json()

        simulation_time = response_data["simulation_time"]
        next_event_time = response_data["next_event_time"]

        print(f"Simulation time: {simulation_time}")
        for e in response_data["processed_events"]:
            print("    " + e["type"])
        print()

        if next_event_time is None:
            print("No more scheduled events. Exiting.")
            break


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run simulation against Docker Sentinel server."
    )
    parser.add_argument("scenario", type=str, help="Path to the scenario JSON file")
    parser.add_argument(
        "--host",
        type=str,
        default=DOCKER_SENTINEL_URL,
        help="Docker Sentinel server URL",
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=1.0,
        help="Playback speed (e.g., 1.0, 2.0, 4.0, etc.)",
    )
    args = parser.parse_args()
    main(args.scenario, args.host, args.speed)
