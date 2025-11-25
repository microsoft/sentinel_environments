# sentinel_api.py
import asyncio
import json
import fastapi
import signal
import os
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta, timezone
import uvicorn
import psycopg2
import gzip

app = fastapi.FastAPI()
state = "starting"

file_lock = asyncio.Lock()
events_file_handle = None
next_event = None

# Time of simulation start in the original WebArena data
# This is time originally used in the database (prior to shifting done init),
# as well as the time that appears in the events.jsonl.gz file
webarena_reference_time = datetime.fromisoformat("2023-02-19T00:00:00+00:00")

# The wall-clock time of when the simulation has started.
# It is set in init(), and is the epoch from which simulation_time is measured
simulation_reference_time = None

# The number of seconds between simulation_reference_time and webarena_reference_time.
# It is set in the init() method and reused rather than recomputed on every event.
webarena_offset = None

# This is the number of seconds passed since simulation_reference_time
# This is how time is expressed to through all public APIs
simulation_time = 0

async def _read_next_event():
    async with file_lock:
        line = events_file_handle.readline().strip()
        if line == "":
            return None
        else:
            return json.loads(line)

@app.exception_handler(Exception)
async def internal_server_error_handler(request: fastapi.Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": str(exc),
        },
    )

@app.on_event("startup")
async def startup_event():
    global conn
    global cur
    global state 
    global simulation_time
    global events_file_handle
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
    next_event = await _read_next_event()
    simulation_time = 0
    state = "preinit"
    print("[startup] events file opened")

@app.on_event("shutdown")
async def shutdown_event():
    if cur:
        cur.close()
    if conn:
        conn.close()
    if events_file_handle:
        events_file_handle.close()
    print("[shutdown]")

@app.get("/status")
async def status():
    next_event_time = None
    if next_event is not None:
        next_event_time = datetime.fromisoformat(next_event["time"]).timestamp() - webarena_reference_time.timestamp()

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
            "simulation_time": simulation_time,
            "next_event_time": next_event_time,
        }
    )

@app.post("/init")
async def status(request: fastapi.Request):
    global simulation_reference_time
    global webarena_offset
    global simulation_time
    global state

    data = await request.json()

    # Compute the simulation reference time, and then shift the database accordingly
    simulation_reference_time = datetime.now(timezone.utc)
    webarena_offset = simulation_reference_time.timestamp() - webarena_reference_time.timestamp()
    simulation_time = 0

    # Shift about 2 days of data forward (we don't shift it all, as this would be too slow)
    cur.execute(f"SELECT MAX(\"timestamp\") FROM submissions")
    max_timestamp = None
    for row in cur.fetchall():
        max_timestamp = row[0]
        break
    shift_from = max_timestamp - timedelta(hours=48)

    # Shift every record in the database
    cur.execute(f"""
        UPDATE submissions SET
            "timestamp" = "timestamp" + INTERVAL '{webarena_offset} seconds',
            edited_at = NULL,
            last_active = last_active + INTERVAL '{webarena_offset} seconds'
            WHERE "timestamp" > '{shift_from.isoformat()}'
    """)

    cur.execute(f"""
        UPDATE comments SET
            "timestamp" = "timestamp" + INTERVAL '{webarena_offset} seconds',
            edited_at = NULL
            WHERE "timestamp" > '{shift_from.isoformat()}'
    """)
    conn.commit()

    # Switch to running
    state = "running"

    next_event_time = None
    if next_event is not None:
        next_event_time = datetime.fromisoformat(next_event["time"]).timestamp() - webarena_reference_time.timestamp()

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
            "simulation_time": simulation_time,
            "next_event_time": next_event_time,
        }
    )

@app.get("/advance")
async def next(t: int):
    global simulation_time
    global next_event

    if t <= simulation_time:
        raise ValueError("Simulation time cannot go backwards.")

    processed_events = []

    if next_event is not None:
        next_event_time = datetime.fromisoformat(next_event["time"]).timestamp() - webarena_reference_time.timestamp()

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

            next_event = await _read_next_event()
            if next_event is None:
                break
            else:
                next_event_time = datetime.fromisoformat(next_event["time"]).timestamp() - webarena_reference_time.timestamp()

    simulation_time = t
    if next_event is not None:
        next_event_time = datetime.fromisoformat(next_event["time"]).timestamp() - webarena_reference_time.timestamp()

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
            "simulation_time": simulation_time,
            "next_event_time": next_event_time,
            "processed_events": processed_events,
        }
    )

@app.get("/close")
async def status():
    global state

    state = "stopping"
    os.kill(1, signal.SIGTERM) # Will kill the docker container

    return JSONResponse(
        status_code=fastapi.status.HTTP_200_OK,
        content={
            "success": True,
            "status": state,
        }
    )

def insert_submission(conn, cur, data):
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
    cur.execute("""
UPDATE submissions AS s
SET comment_count = (
    SELECT COUNT(*)
    FROM comments c
    WHERE c.submission_id = s.id
)
WHERE s.id = %(submission_id)s;
""", {"submission_id": data["submission_id"]})
    conn.commit()

def vote_on_submission(conn, cur, data):
    op = "+ 1" if data["upvote"] else "- 1"
    sql = "UPDATE submissions SET net_score=net_score " + op + " WHERE id=%(submission_id)s;"
    cur.execute(sql, {"submission_id": data["submission_id"]})
    conn.commit()

def vote_on_comment(conn, cur, data):
    op = "+ 1" if data["upvote"] else "- 1"
    sql = "UPDATE comments SET net_score=net_score " + op + " WHERE id=%(comment_id)s;"
    cur.execute(sql, {"comment_id": data["comment_id"]})
    conn.commit()

if __name__ == "__main__":
    uvicorn.run("sentinel_api:app", host="0.0.0.0", port=8000, workers=1)
