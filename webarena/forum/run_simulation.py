import time
import requests
import json

DOCKER_SENTINEL_URL = "http://localhost:8000"

submission = json.loads("""
{
    "time": 20,
    "type": "submission",
    "payload": {
        "id": 200001,
        "forum_id": 10021,
        "user_id": 70133,
        "title": "Testing a new scheduled submission!",
        "timestamp": 20,
        "url": "",
        "body": "This is the body of a task-specific scheduled submission! It should insert after 20 seconds.",
        "image_id": null,
        "ip": null,
        "sticky": false,
        "ranking": 7,
        "edited_at": null,
        "moderated": false,
        "user_flag": "t3_115w23z",
        "locked": false,
        "search_doc": "",
        "last_active": 20,
        "comment_count": 0,
        "net_score": 1,
        "visibility": "visible",
        "media_type": "url"
    }
}
""")

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
        "events": [submission] 
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
