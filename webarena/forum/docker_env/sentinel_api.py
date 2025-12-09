"""Sentinel API for controlling the simulation of WebArena data."""

import asyncio
import gzip
import json
import os
import signal
from datetime import datetime, timedelta, timezone

import fastapi
import psycopg2
import uvicorn
from fastapi.responses import JSONResponse

STATE_STARTING = "starting"
STATE_PREINIT = "preinit"
STATE_READY = "ready"
STATE_RUNNING_AUTO = "running_auto"
STATE_RUNNING_MANUAL = "running_manual"
STATE_STOPPING = "stopping"

# Submissions scheduled by init start at ID 200,000 and end at 299,999
# Comments scheduled by init start at ID 3,000,000 and end at 3,999,999

app = fastapi.FastAPI()
state = STATE_STARTING

# Events passed via init()
custom_events = []

# Events files
file_lock = asyncio.Lock()
events_file_handle = None
next_file_event = None

# Next event (merged)
next_event = None

# Time of simulation start in the original WebArena data This is time
# ORIGINALLY used in the database (prior to shifting done in the
# Dockerfile or init()). This is the time basis uses in events.jsonl.gz
webarena_reference_time = datetime.fromisoformat("2023-02-19T00:00:00+00:00")

# The wall-clock time of when the simulation has started.
# It is set to now() in init(), and is from where simulation_time is measured
simulation_reference_time = None

# This is the number of seconds passed since simulation_reference_time
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

            # Make the timestamps relative
            event_data["time"] = (
                datetime.fromisoformat(event_data["time"]).timestamp()
                - webarena_reference_time.timestamp()
            )

            # Other time fields
            payload = event_data["payload"]
            for tf in ["timestamp", "edited_at", "last_active"]:
                if tf in payload and payload[tf] is not None:
                    payload[tf] = (
                        datetime.fromisoformat(payload[tf]).timestamp()
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
    """Startup the endpoint, opening database connections, etc."""
    global conn
    global cur
    global state
    global simulation_time
    global events_file_handle
    global next_file_event
    global next_event

    conn = None
    cur = None

    # Adjust password/host/port as needed
    conn = psycopg2.connect(
        dbname="postmill",
        user="postgres",
    )
    cur = conn.cursor()

    events_file_handle = gzip.open("/var/www/html/events.jsonl.gz", "rt")

    # Prime things
    next_file_event = await _next_file_event()
    next_event = await _next_event()
    simulation_time = 0

    state = STATE_PREINIT
    print("[startup] database opened")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown the endpoint, closing database connections, etc."""
    if cur:
        cur.close()
    if conn:
        conn.close()
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

    # TODO validate data

    # Compute the simulation reference time, and then shift the database accordingly
    simulation_reference_time = datetime.now(timezone.utc)
    simulation_time = 0

    # Shift about 2 days of data forward (we don't shift it all, as this would be too slow)
    cur.execute('SELECT MAX("timestamp") FROM submissions')
    max_timestamp = None
    for row in cur.fetchall():
        max_timestamp = row[0]
        break
    shift_from = max_timestamp - timedelta(hours=48)
    offset = simulation_reference_time.timestamp() - max_timestamp.timestamp()

    # Shift every record in the database
    cur.execute(f"""
        UPDATE submissions SET
            "timestamp" = "timestamp" + INTERVAL '{offset} seconds',
            edited_at = NULL,
            last_active = last_active + INTERVAL '{offset} seconds'
            WHERE "timestamp" > '{shift_from.isoformat()}'
    """)

    cur.execute(f"""
        UPDATE comments SET
            "timestamp" = "timestamp" + INTERVAL '{offset} seconds',
            edited_at = NULL
            WHERE "timestamp" > '{shift_from.isoformat()}'
    """)
    conn.commit()

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
            if next_event["type"] == "submission":
                insert_submission(conn, cur, next_event["payload"])
            elif next_event["type"] == "comment":
                insert_comment(conn, cur, next_event["payload"])
            elif next_event["type"] == "submission_vote":
                vote_on_submission(conn, cur, next_event["payload"])
            elif next_event["type"] == "comment_vote":
                vote_on_comment(conn, cur, next_event["payload"])

            next_event = await _next_event()
            if next_event is None:
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


def insert_submission(conn, cur, data):
    """Insert a submission into the database."""
    # Clone data
    data = json.loads(json.dumps(data))

    # Change from relative to absolute times
    # NOTE: If running the simulation faster than real-time, events might be in
    # the future and this will look weird in the UI. Max out at now() if necessary
    now = datetime.now(timezone.utc)
    if data["timestamp"] is not None:
        data["timestamp"] = min(
            now, simulation_reference_time + timedelta(seconds=data["timestamp"])
        )
    if data["edited_at"] is not None:
        data["edited_at"] = min(
            now, simulation_reference_time + timedelta(seconds=data["edited_at"])
        )
    if data["last_active"] is not None:
        data["last_active"] = min(
            now, simulation_reference_time + timedelta(seconds=data["last_active"])
        )

    sql = """
        INSERT INTO submissions (
            id,
            forum_id,
            user_id,
            title,
            "timestamp",
            url,
            body,
            image_id,
            ip,
            sticky,
            ranking,
            edited_at,
            moderated,
            user_flag,
            locked,
            search_doc,
            last_active,
            comment_count,
            net_score,
            visibility,
            media_type
        ) VALUES (
            %(id)s,
            %(forum_id)s,
            %(user_id)s,
            %(title)s,
            %(timestamp)s,
            %(url)s,
            %(body)s,
            %(image_id)s,
            %(ip)s,
            %(sticky)s,
            %(ranking)s,
            %(edited_at)s,
            %(moderated)s,
            %(user_flag)s,
            %(locked)s,
            %(search_doc)s,
            %(last_active)s,
            0,
            1,
            %(visibility)s,
            %(media_type)s
        );
    """
    cur.execute(sql, data)
    conn.commit()


def insert_comment(conn, cur, data):
    """Insert a comment into the database."""
    # Clone data
    data = json.loads(json.dumps(data))

    # Change from relative to absolute times
    now = datetime.now(timezone.utc)
    if data["timestamp"] is not None:
        data["timestamp"] = min(
            now, simulation_reference_time + timedelta(seconds=data["timestamp"])
        )
    if data["edited_at"] is not None:
        data["edited_at"] = min(
            now, simulation_reference_time + timedelta(seconds=data["edited_at"])
        )

    sql = """
    INSERT INTO comments (
    id,
    user_id,
    submission_id,
    parent_id,
    body,
    "timestamp",
    visibility,
    ip,
    edited_at,
    moderated,
    user_flag,
    search_doc,
    net_score
) VALUES (
    %(id)s,
    %(user_id)s,
    %(submission_id)s,
    %(parent_id)s,
    %(body)s,
    %(timestamp)s,
    %(visibility)s,
    %(ip)s,
    %(edited_at)s,
    %(moderated)s,
    %(user_flag)s,
    %(search_doc)s,
    1
);
    """

    cur.execute(sql, data)
    conn.commit()

    # Update the comment count
    cur.execute(
        """
UPDATE submissions AS s
SET comment_count = (
    SELECT COUNT(*)
    FROM comments c
    WHERE c.submission_id = s.id
)
WHERE s.id = %(submission_id)s;
""",
        {"submission_id": data["submission_id"]},
    )
    conn.commit()


def vote_on_submission(conn, cur, data):
    """Vote on a submission, updating its net score."""
    op = "+ 1" if data["upvote"] else "- 1"
    sql = (
        "UPDATE submissions SET net_score=net_score "
        + op
        + " WHERE id=%(submission_id)s;"
    )
    cur.execute(sql, {"submission_id": data["submission_id"]})
    conn.commit()


def vote_on_comment(conn, cur, data):
    """Vote on a comment in the database, updating its net score."""
    op = "+ 1" if data["upvote"] else "- 1"
    sql = "UPDATE comments SET net_score=net_score " + op + " WHERE id=%(comment_id)s;"
    cur.execute(sql, {"comment_id": data["comment_id"]})
    conn.commit()


if __name__ == "__main__":
    uvicorn.run("sentinel_api:app", host="0.0.0.0", port=8000, workers=1)
