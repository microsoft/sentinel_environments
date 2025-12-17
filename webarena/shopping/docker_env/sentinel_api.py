"""Sentinel API for controlling the simulation of WebArena data in the OneStopShop environment."""

import asyncio
import gzip
import json
import os
import signal
import subprocess
from datetime import datetime, timezone

import fastapi
import mysql.connector
import uvicorn
from fastapi.responses import JSONResponse

from webarena.shopping.events.generate_events import event_types
from webarena.shopping.events.product_sales import add_product_sales_rule
from webarena.shopping.events.products import (
    add_product,
    remove_product,
    update_stock_for_product,
)
from webarena.shopping.events.reviews import add_product_review
from webarena.shopping.utils.auth import create_customer_account, get_admin_token

STATE_STARTING = "starting"
STATE_PREINIT = "preinit"
STATE_READY = "ready"
STATE_RUNNING_AUTO = "running_auto"
STATE_RUNNING_MANUAL = "running_manual"
STATE_STOPPING = "stopping"

SERVER_URL = (
    f"{os.environ.get('SERVER_URL', 'gcr-sandbox-009.redmond.corp.microsoft.com')}"
)
SIMULATION_START_TIME = "2025-12-03T16:44:25+00:00"
WEBARENA_SHOP_START_TIME = "2023-04-18T14:30:42+00:00"

app = fastapi.FastAPI()
state = STATE_STARTING

# Events passed via init()
custom_events = []

file_lock = asyncio.Lock()
events_file_handle = None
next_file_event = None

# Next event (merged)
next_event = None

# Time of simulation start (at when shopping events were generated.)
webarena_reference_time = datetime.fromisoformat(SIMULATION_START_TIME)

# The wall-clock time of when the simulation has started.
# It is set to now() in init(), and is from where simulation_time is measured
simulation_reference_time = None

# This is how time is expressed to through all public APIs
simulation_time = 0


async def _next_file_event():
    """Return the next event from the events file."""
    async with file_lock:
        line = events_file_handle.readline().strip()
        if line == "":
            return None
        else:
            event_data = json.loads(line)

            # Make the timestamps relative, and in seconds
            event_data["time"] = int(
                datetime.fromisoformat(event_data["time"]).timestamp()
                - webarena_reference_time.timestamp()
            )

            return event_data


async def _next_event():
    """Return the next event, merging custom events and file events."""
    global custom_events
    global next_file_event

    if len(custom_events) == 0:
        # No custom events, just read from the file
        result = next_file_event
        next_file_event = await _next_file_event()
    elif next_file_event is None:
        # No file events, just read from the custom events list
        if len(custom_events) > 0:
            result = custom_events.pop(0)
    else:
        # Return whichever event is earliest
        if custom_events[0]["time"] <= next_file_event["time"]:
            result = custom_events.pop(0)
        else:
            result = next_file_event
            next_file_event = await _next_file_event()
    return result


@app.exception_handler(Exception)
async def internal_server_error_handler(request: fastapi.Request, exc: Exception):
    """Handle uncaught exceptions and return a JSON response."""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": str(exc),
        },
    )


@app.on_event("startup")
async def startup_event():
    """Startup the endpoint, initialize magento, open events file, create accounts, etc."""
    global state
    global simulation_time
    global events_file_handle
    global next_file_event
    global next_event

    events_file_handle = gzip.open("/var/www/html/events.jsonl.gz", "rt")

    next_file_event = await _next_file_event()
    next_event = await _next_event()
    simulation_time = 0

    # Sleep for 60s to allow the magento instance and services to start according to the webarena docs
    # https://github.com/web-arena-x/webarena/blob/main/environment_docker/README.md#shopping-website-onestopshop
    await asyncio.sleep(60)

    # Connect to the db, initialize settings
    _setup_magento()

    # Adjust the review start times to be within the simulation time, rather than the original time from webarena in 2023
    _adjust_review_start_time()

    # Initialize the customer account with the REST API
    create_customer_account()

    state = STATE_PREINIT
    print("[startup] events file opened, magento setup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown the endpoint, closing database connections, etc."""
    if events_file_handle:
        events_file_handle.close()
    print("[shutdown]")


@app.get("/status")
async def status():
    """Get the current status of the simulation."""
    next_event_time = None
    if next_event is not None:
        next_event_time = next_event["time"]

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
            "simulation_time": simulation_time,
            "next_event_time": next_event_time,
        },
    )


@app.post("/init")
async def init(request: fastapi.Request):
    """Initialize the simulation with custom events."""
    global simulation_reference_time
    global simulation_time
    global custom_events
    global next_event
    global state

    if state != STATE_PREINIT:
        raise RuntimeError(
            f"Wrong state: /init must be called when in state '{STATE_PREINIT}'. Current state is '{state}'."
        )

    data = await request.json()
    custom_events = data["events"]

    # Sort custom events by time. Don't assume they are pre-sorted.
    custom_events.sort(key=lambda e: e["time"], reverse=False)

    simulation_reference_time = datetime.now(timezone.utc)
    simulation_time = 0

    state = STATE_READY

    next_event_time = None
    if next_event is not None:
        next_event_time = next_event["time"]

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
            "simulation_time": simulation_time,
            "next_event_time": next_event_time,
        },
    )


@app.get("/advance")
async def advance(t: int):
    """Advance the simulation to a given time."""
    global state

    if state != STATE_READY and state != STATE_RUNNING_MANUAL:
        raise RuntimeError(
            f"Wrong state: /advance must be called when in state '{STATE_READY}' or '{STATE_RUNNING_MANUAL}'. Current state is '{state}'."
        )

    state = STATE_RUNNING_MANUAL
    result = await _advance(t)

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content=result,
    )


async def _advance(t: int):
    """Advance the simulation to a given time. Called by advance() and play()."""
    global simulation_time
    global next_event
    global state

    if t <= simulation_time:
        raise ValueError("Simulation time cannot go backwards.")

    processed_events = []

    if next_event is not None:
        next_event_time = None
        if next_event is not None:
            next_event_time = next_event["time"]

        while next_event_time <= t:
            processed_events.append(next_event)

            # Process each type of event.
            admin_token = get_admin_token()
            event_type = next_event["type"]
            event_type = event_types[event_type]
            if event_type == event_types.ADD_PRODUCT:
                add_product(
                    token=admin_token,
                    sku=next_event["payload"]["product"]["sku"],
                    product=next_event["payload"],
                )
            elif event_type == event_types.REMOVE_PRODUCT:
                sku = next_event["payload"].get("sku")
                remove_product(admin_token, sku)
            elif event_type == event_types.ADD_SALE:
                product_id = (
                    next_event["payload"].get("rule", {}).get("product_ids", [None])[0]
                )
                if product_id:
                    add_product_sales_rule(
                        admin_token, product_id, next_event["payload"]
                    )
            elif event_type == event_types.ADD_PRODUCT_REVIEW:
                product_id = (
                    next_event["payload"].get("review", {}).get("entity_pk_value")
                )
                add_product_review(admin_token, product_id, next_event["payload"])
            elif event_type == event_types.RESTOCK_PRODUCT:
                sku = next_event["payload"].get("sku")

                # Remove sku from payload as it's not part of stock update API
                payload_copy = next_event["payload"].copy()
                del payload_copy["sku"]
                update_stock_for_product(admin_token, sku, payload_copy)

            next_event = await _next_event()
            if next_event is None:
                next_event_time = None
                break
            else:
                next_event_time = next_event["time"]

    simulation_time = t
    if next_event is not None:
        next_event_time = next_event["time"]

    return {
        "success": True,
        "status": state,
        "simulation_time": simulation_time,
        "next_event_time": next_event_time,
        "processed_events": processed_events,
    }


@app.get("/play")
async def play():
    """Start automatic playback of the simulation."""
    global state

    if state != STATE_READY and state != STATE_RUNNING_MANUAL:
        raise RuntimeError(
            f"Wrong state: /play must be called when in state '{STATE_READY}' or '{STATE_RUNNING_MANUAL}'. Current state is '{state}'."
        )

    state = STATE_RUNNING_AUTO
    asyncio.create_task(_run_scenario())

    if next_event is not None:
        next_event_time = next_event["time"]

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
            "simulation_time": simulation_time,
            "next_event_time": next_event_time,
        },
    )


async def _run_scenario():
    """Run the scenario in automatic mode."""
    while True:
        if next_event is None:
            break

        await asyncio.sleep(1)
        await _advance(t=simulation_time + 1)


@app.get("/close")
async def close():
    """Close the simulation and stop the container."""
    global state

    state = STATE_STOPPING
    os.kill(1, signal.SIGTERM)  # Will kill the docker container

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
        },
    )


### Shopping specific utilities ###


def _adjust_review_start_time():
    """Adjust the start time of reviews to be within the simulation time."""
    db = _connect_to_mariadb()
    curr = db.cursor()

    # For each row in the review table, compute the difference between the review's created_at and 2023-04-18 14:30:42
    # Then, adjust the created_at time to be SIMULATION_START_TIME plus the difference between the two timestamps.
    SIM_TIME = datetime.fromisoformat(SIMULATION_START_TIME).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    WEBARENA_TIME = datetime.fromisoformat(WEBARENA_SHOP_START_TIME).strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    curr.execute(
        f"UPDATE review SET created_at = DATE_ADD('{SIM_TIME}', INTERVAL (TIMESTAMPDIFF(SECOND, '{WEBARENA_TIME}', created_at)) SECOND)"
    )
    db.commit()
    curr.close()
    db.close()
    print(f"[_adjust_review_start_time] {curr.rowcount} rows updated")


def _connect_to_mariadb():
    """Connect to the MariaDB database used by Magento."""
    try:
        # Establish connection
        conn = mysql.connector.connect(
            user="magentouser",  # DB username
            password="MyPassword",  # DB password
            host="127.0.0.1",  # Host (use IP or domain)
            port=3306,  # Default MariaDB/MySQL port
            database="magentodb",  # Database name
        )

        if conn.is_connected():
            print(
                f"[_connect_to_mariadb] connection successful. DB info: {conn.get_server_info()}"
            )
        return conn

    except mysql.connector.Error as e:
        raise Exception(f"Error connecting to MariaDB: {e.msg}") from e


def _setup_magento():
    """Set up Magento to use the correct base URL and flush its cache.

    These are typically done in docker setup after a delay, but we do it here to ensure
    they are done during the startup phase of the sentinel API.

    https://github.com/web-arena-x/webarena/blob/main/environment_docker/README.md#shopping-website-onestopshop

    """
    conn = _connect_to_mariadb()
    curr = conn.cursor()
    curr.execute(
        f'UPDATE core_config_data SET value="http://{SERVER_URL}:7770/" WHERE path = "web/secure/base_url";'
    )
    print(f"[_setup_magento] {curr.rowcount} rows updated")
    conn.commit()
    curr.close()
    conn.close()

    # Setup store_config and flush the cache, using subprocess
    try:
        output = subprocess.check_output(
            [
                "/var/www/magento2/bin/magento",
                "setup:store-config:set",
                "--base-url",
                f"http://{SERVER_URL}:7770/",
            ]
        )
        print(f"[_setup_magento] store config set: {output.decode()}")
    except subprocess.CalledProcessError as e:
        raise Exception(
            f"Error setting up Magento store config: {e.output.decode()}"
        ) from e

    # Flush the cache
    try:
        output = subprocess.check_output(
            ["/var/www/magento2/bin/magento", "cache:flush"]
        )
        print(f"[_setup_magento] cache flushed: {output.decode()}")
    except subprocess.CalledProcessError as e:
        raise Exception(f"Error flushing Magento cache: {e.output.decode()}") from e


if __name__ == "__main__":
    uvicorn.run("sentinel_api:app", host="0.0.0.0", port=8000, workers=1)
