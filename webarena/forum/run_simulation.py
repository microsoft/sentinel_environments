import time
import requests

DOCKER_SENTINEL_URL = "http://localhost:8000"

def _poll_until(target_states, valid_states=None):
    """
    Poll the server until it is in the desired state.

    target_states: the function returns when the server is in one of these states
    valid_states: [Optiona] list of valid states. Raise an error if not in one of these states.
    """

    while True:
        response = requests.get(f"{DOCKER_SENTINEL_URL}/status")
        response.raise_for_status()
        status_data = response.json()

        if status_data["status"] in target_states:
            return status_data

        if valid_states is not None and status_data["status"] not in valid_states:
            raise Exception(f"Invalid state: {status_data['status']}")

        time.sleep(1)  # Wait before polling again


def main():

    # Wait for things to start up
    response_data = _poll_until(target_states=["preinit"], valid_states=["starting"])

    # Initialize the server
    init_events = {
        "events": []  # No events to add in this example
    }
    response = requests.post(f"{DOCKER_SENTINEL_URL}/init", json=init_events)
    response.raise_for_status()
    response_data = response.json()

    print("Done init()")

    simulation_time = response_data["simulation_time"]
    next_event_time = response_data["next_event_time"]

    # Run the simulation
    print("Playback at 4x speed")
    while True:
        sleep_for = next_event_time - simulation_time
        time.sleep(sleep_for * 0.25)

        response = requests.get(f"{DOCKER_SENTINEL_URL}/advance", params={"t": next_event_time})
        response.raise_for_status()
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

main()
