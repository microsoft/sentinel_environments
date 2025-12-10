"""A script to play back shopping events in the WebArena OneStopShop environment, against a sentinel server running in a Docker container."""

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from enum import Enum

import requests

sys.path.append(os.path.join(os.path.dirname(__file__), "docker_env"))

from webarena.shopping.utils.auth import get_admin_token
from webarena.shopping.utils.store_requests import make_authenticated_request

DOCKER_SENTINEL_URL = "http://gcr-sandbox-009.redmond.corp.microsoft.com:8000"
ADOBE_COMMERCE_STORE_URL = "http://gcr-sandbox-009.redmond.corp.microsoft.com:7770"
event_types = Enum(
    "EventType",
    [
        "ADD_PRODUCT",
        "UNSTOCK_PRODUCT",
        "RESTOCK_PRODUCT",
        "ADD_SALE",
        "ADD_PRODUCT_REVIEW",
    ],
)


def generate_shopping_init_events():
    """Generate test events for shopping scenario initialization."""
    events = [
        {
            "type": event_types.ADD_PRODUCT_REVIEW.name,
            "time": 10,
            "payload": {
                "review": {
                    "entity_pk_value": 39276,
                    "title": "Durable, Comfortable, and Safe for Little Listeners - TESTED and APPROVED!",
                    "detail": "Great kid-friendly headphones with smart safety touches. I bought this 2-pack for my kindergarten classroom, and they’ve been a hit. The adjustable headband actually fits small heads properly without slipping, and the lightweight build keeps kids comfortable through story time and short computer sessions. The ABS plastic earcups feel rugged enough for daily classroom use, and the protective slotted baffles are a thoughtful detail—no more curious fingers poking the drivers. Sound quality is clear and balanced for voices, audiobooks, and learning apps. They’re not bass-heavy, but that’s not the goal here; intelligible speech is excellent. The ambient noise-reducing cups help keep volume lower (a big plus for hearing safety), and the child-accessible volume control lets us fine-tune without cranking it. The permanently attached 5.5' cord with reinforced strain relief has survived plenty of tugs, and the right-angle 3.5mm plug sits neatly in tablets and laptops, reducing accidental pull-outs. For classroom or home learning, these check all the boxes: safe, durable, and age-appropriate sizing. Minor nitpicks: the styling is more playful than sleek, which is perfect for young kids but not older ones; and there’s no mic, so not ideal for two-way calls. Overall, excellent value in a 2-pack for schools and parents focused on safe listening and durability.",
                    "nickname": "Ms. K—Kinder Tech",
                    "ratings": [
                        {
                            "rating_id": 4,
                            "rating_name": "Rating",
                            "value": 4,
                            "percent": 80,
                        }
                    ],
                    "review_entity": "product",
                    "review_type": 2,
                    "review_status": 1,
                    "store_id": 1,
                    "stores": [1],
                }
            },
        }
    ]

    return events


def get_product_link_by_sku(token, sku):
    """Get the product link for a given SKU."""
    endpoint = f"/rest/V1/products/{sku}"
    result = make_authenticated_request(
        token,
        endpoint,
        method="GET",
    )
    if result:
        product = result
        product_url_key = None
        for attr in product.get("custom_attributes", []):
            if attr["attribute_code"] == "url_key":
                product_url_key = attr["value"]
                break
        if product_url_key:
            product_link = f"{ADOBE_COMMERCE_STORE_URL}/{product_url_key}.html"
            return product_link
        else:
            print(f"✗ URL key not found for SKU: {sku}")
            return None
    else:
        print(f"✗ Failed to get product with SKU: {sku}")
        return None


def get_product_link_by_entity_id(token, entity_id):
    """Get the product link for a given entity ID."""
    endpoint = f"/rest/V1/products?searchCriteria[filter_groups][0][filters][0][field]=entity_id&searchCriteria[filter_groups][0][filters][0][value]={entity_id}"
    result = make_authenticated_request(
        token,
        endpoint,
        method="GET",
    )
    if result and "items" in result and len(result["items"]) > 0:
        product = result["items"][0]
        product_url_key = None
        for attr in product.get("custom_attributes", []):
            if attr["attribute_code"] == "url_key":
                product_url_key = attr["value"]
                break
        if product_url_key:
            product_link = f"{ADOBE_COMMERCE_STORE_URL}/{product_url_key}.html"
            return product_link
        else:
            print(f"✗ URL key not found for Entity ID: {entity_id}")
            return None
    else:
        print(f"✗ Failed to get product with Entity ID: {entity_id}")
        return None


def _raise_for_status_with_body(resp: requests.Response) -> None:
    """Like resp.raise_for_status(), but includes the response body in the error message."""
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        body = (resp.text or "").strip()
        if len(body) > 2000:
            body = body[:2000] + "... [truncated]"
        msg = f"{e}\n\nResponse body:\n{body}"
        raise requests.HTTPError(msg, response=resp) from e


def _poll_until(target_states, valid_states=None):
    """Poll the server until it is in the desired state.

    target_states: the function returns when the server is in one of these states
    valid_states: [Optional] list of valid states. Raise an error if not in one of these states.
    """
    while True:
        response = requests.get(f"{DOCKER_SENTINEL_URL}/status")
        _raise_for_status_with_body(response)
        status_data = response.json()

        if status_data["status"] in target_states:
            return status_data

        if valid_states is not None and status_data["status"] not in valid_states:
            raise Exception(f"Invalid state: {status_data['status']}")

        time.sleep(1)  # Wait before polling again


def main():
    """Run simulation against Docker Sentinel server.

    The script reads the scenario from a JSON file and runs the simulation in a loop.
    The script can also be used to close the server or run a demo scenario.
    """
    parser = argparse.ArgumentParser(
        description="Run shopping simulation against Docker Sentinel server."
    )
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
    parser.add_argument(
        "--close", action="store_true", help="Close the Docker Sentinel server"
    )
    parser.add_argument("--demo", action="store_true", help="Run demo scenario")
    args = parser.parse_args()

    if args.close:
        # Send close signal to server
        response = requests.get(f"{DOCKER_SENTINEL_URL}/close")
        response.raise_for_status()
        print("Sent close signal to server.")
        return

    # Read the scenario
    scenario_data = None
    with open(args.scenario) as f:
        scenario_data = json.load(f)

    # Wait for things to start up
    response_data = _poll_until(target_states=["preinit"], valid_states=["starting"])

    # Initialize the server
    init_events = {
        "events": scenario_data["events"],
    }
    response = requests.post(f"{DOCKER_SENTINEL_URL}/init", json=init_events)
    _raise_for_status_with_body(response)
    response_data = response.json()

    assert response_data["status"] == "ready"

    print("Done init()")

    simulation_time = response_data["simulation_time"]
    next_event_time = response_data["next_event_time"]

    # Run the simulation
    print(f"Playback at {args.speed}x speed")
    demo = defaultdict(int)
    while True:
        sleep_for = next_event_time - simulation_time

        print(
            f"Sleeping for {sleep_for} seconds (real time: {sleep_for * (1 / args.speed)} seconds)"
        )
        time.sleep(sleep_for * (1 / args.speed))

        response = requests.get(
            f"{DOCKER_SENTINEL_URL}/advance", params={"t": next_event_time}
        )
        _raise_for_status_with_body(response)
        response_data = response.json()

        simulation_time = response_data["simulation_time"]
        next_event_time = response_data["next_event_time"]

        print(f"Simulation time: {simulation_time}")
        print(f"Next event time: {next_event_time}")

        token = get_admin_token()
        for e in response_data["processed_events"]:
            print("    " + e["type"])

            if args.demo:
                # Demo mode: open product pages in browser for certain events
                # so that we can more easily see the effects of the events
                if e["type"] == event_types.ADD_PRODUCT_REVIEW.name:
                    review = e["payload"]["review"]
                    print(
                        f"        Review Title: {review['title']}, Rating: {review['ratings'][0]['value']}"
                    )

                    # only open the product page for the first review event
                    if demo[event_types.ADD_PRODUCT_REVIEW.name] >= 1:
                        continue

                    demo[event_types.ADD_PRODUCT_REVIEW.name] += 1

                    product_link = get_product_link_by_entity_id(
                        token, review["entity_pk_value"]
                    )
                    print(f"        Opening product page: {product_link}")
                    if product_link:
                        os_command = f"open -a 'Microsoft Edge' '{product_link}'"
                        os.system(os_command)

                elif e["type"] == event_types.RESTOCK_PRODUCT.name:
                    # Only open the product page for the first restock event
                    if demo[event_types.RESTOCK_PRODUCT.name] >= 1:
                        continue
                    demo[event_types.RESTOCK_PRODUCT.name] += 1

                    stock_item = e["payload"]["stockItem"]
                    sku = e["payload"]["sku"]
                    print(f"        Restocked SKU: {sku}, New Qty: {stock_item['qty']}")

                    # Open the product page
                    link = get_product_link_by_sku(token, sku)

                    os_command = f"open -a 'Microsoft Edge' '{link}'"
                    os.system(os_command)

                elif e["type"] == event_types.ADD_PRODUCT.name:
                    product = e["payload"]["product"]
                    print(
                        f"        Added Product: {product['name']}, SKU: {product['sku']}"
                    )

                    sku = product["sku"]
                    if demo[event_types.ADD_PRODUCT.name] >= 1:
                        continue
                    demo[event_types.ADD_PRODUCT.name] += 1

                    # Open the product page
                    link = get_product_link_by_sku(token, sku)
                    os_command = f"open -a 'Microsoft Edge' '{link}'"
                    os.system(os_command)
                elif e["type"] == event_types.ADD_SALE.name:
                    rule = e["payload"].get("rule", {})
                    print(
                        f"        Added Sale for Product IDs: {rule.get('product_ids', [])}, Discount: {rule.get('discount_amount', 0)}"
                    )

        print()

        if next_event_time is None:
            print("No more scheduled events. Exiting.")
            break


main()
