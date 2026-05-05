# handler for the microlendar (calendar) environment.
# reads immutable event data from catalogs.py, mutable state from session.py.
# provides functions for listing events, tasks, creating/updating events, and completing tasks.
#
# flow: server.py route -> microlendar handler -> reads MICROLENDAR_EVENT_CATALOG + session -> returns data
# example: POST /microlendar/events -> create_event() -> appends to session.microlendar_user_created_events

from __future__ import annotations

import sqlite3
from typing import TYPE_CHECKING

from server.catalogs import (
    MICROLENDAR_EVENT_CATALOG,
    USER_CATALOG,
)

if TYPE_CHECKING:
    from server.session import Session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_attendees(attendee_ids: list) -> list[dict]:
    """Resolve a list of user ID strings into [{id, name, avatarUrl}]."""
    result = []
    for uid in attendee_ids:
        u = USER_CATALOG.get(uid, {})
        result.append({"id": uid, "name": u.get("name", "Unknown"), "avatarUrl": u.get("avatarUrl", "")})
    return result


def _build_event_row(raw: dict) -> dict:
    """Build an event row, resolving attendee IDs to user objects."""
    row = dict(raw)
    if "attendees" in row and isinstance(row["attendees"], list):
        row["attendees"] = _resolve_attendees(row["attendees"])
    return row


def _time_to_minutes(time_str: str) -> int:
    """Convert 'HH:MM' or ISO time portion to minutes since midnight."""
    if not time_str:
        return 0
    # Handle ISO datetime (e.g. "2024-07-15T09:00:00Z")
    if "T" in time_str:
        time_str = time_str.split("T")[1].replace("Z", "")
    parts = time_str.split(":")
    return int(parts[0]) * 60 + int(parts[1])


def _date_from_iso(iso_str: str | None) -> str | None:
    """Extract YYYY-MM-DD from ISO datetime string."""
    if not iso_str:
        return None
    return iso_str.split("T")[0]


def _events_conflict(ev1: dict, ev2: dict) -> bool:
    """Check if two events have overlapping time on the same date."""
    d1 = _date_from_iso(ev1.get("start_time"))
    d2 = _date_from_iso(ev2.get("start_time"))
    if not d1 or not d2 or d1 != d2:
        return False
    if not ev1.get("start_time") or not ev2.get("start_time"):
        return False

    start1 = _time_to_minutes(ev1["start_time"])
    end1 = _time_to_minutes(ev1["end_time"]) if ev1.get("end_time") else start1 + 60
    start2 = _time_to_minutes(ev2["start_time"])
    end2 = _time_to_minutes(ev2["end_time"]) if ev2.get("end_time") else start2 + 60

    return start1 < end2 and end1 > start2


def _get_all_events(session: Session) -> list[dict]:
    """Return all non-deleted, non-task events (catalog + user-created)."""
    result = []
    for ev in session.microlendar_events:
        st = session.microlendar_event_states.get(ev["id"], {})
        if st.get("deleted"):
            continue
        if ev.get("is_task"):
            continue
        merged = {**ev, **st}
        result.append(merged)
    for ev in session.microlendar_user_created_events:
        if not ev.get("deleted"):
            result.append(ev)
    return result


def _get_all_tasks(session: Session) -> list[dict]:
    """Return all non-deleted tasks (catalog + user-created)."""
    result = []
    for t in session.microlendar_tasks:
        st = session.microlendar_task_states.get(t["id"], {})
        if st.get("deleted"):
            continue
        merged = {**t, **st}
        result.append(merged)
    for t in session.microlendar_user_created_tasks:
        if not t.get("deleted"):
            result.append(t)
    return result


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_current_metrics(session: Session) -> dict:
    events = _get_all_events(session)
    tasks = _get_all_tasks(session)

    today = session.microlendar_today

    event_count = len(events)
    today_event_count = sum(
        1 for e in events
        if _date_from_iso(e.get("start_time")) == today
    )
    work_event_count = sum(
        1 for e in events
        if e.get("category") == "Work"
    )
    task_count = len(tasks)
    personal_event_count = sum(
        1 for e in events if e.get("category") == "Personal"
    )

    # Pairwise conflict count
    conflict_count = 0
    for i in range(len(events)):
        for j in range(i + 1, len(events)):
            if _events_conflict(events[i], events[j]):
                conflict_count += 1

    return {
        "event_count": event_count,
        "today_event_count": today_event_count,
        "work_event_count": work_event_count,
        "task_count": task_count,
        "personal_event_count": personal_event_count,
        "conflict_count": conflict_count,
    }


# ---------------------------------------------------------------------------
# Event processing
# ---------------------------------------------------------------------------

def process_event(session: Session, event: dict) -> None:
    etype = event["type"]

    if etype == "preload_events":
        payload = event.get("payload", {})
        event_ids = payload.get("event_ids", [])
        task_ids = payload.get("task_ids", [])
        today = payload.get("today")
        if today:
            session.microlendar_today = today
        initial_date = payload.get("initial_date")
        if initial_date:
            session.microlendar_initial_date = initial_date

        # Load calendar events -- "*" means all non-task events
        if event_ids == ["*"]:
            event_ids = [
                eid for eid, e in MICROLENDAR_EVENT_CATALOG.items()
                if not e.get("is_task")
            ]
        for eid in event_ids:
            raw = MICROLENDAR_EVENT_CATALOG.get(eid)
            if raw is None:
                continue
            session.microlendar_events.append(_build_event_row(raw))
            session.microlendar_event_states[eid] = {"isViewed": False}

        # Load tasks -- "*" means all task items
        if task_ids == ["*"]:
            task_ids = [
                eid for eid, e in MICROLENDAR_EVENT_CATALOG.items()
                if e.get("is_task")
            ]
        for tid in task_ids:
            raw = MICROLENDAR_EVENT_CATALOG.get(tid)
            if raw is None:
                continue
            session.microlendar_tasks.append(dict(raw))
            session.microlendar_task_states[tid] = {
                "completed": bool(raw.get("is_completed", False)),
            }

        # Capture baseline after preload
        session.baseline_metrics = compute_current_metrics(session)

    elif etype == "new_event":
        event_id = event.get("payload", {}).get("event_id")
        raw = MICROLENDAR_EVENT_CATALOG.get(event_id)
        if raw:
            session.microlendar_events.append(_build_event_row(raw))
            session.microlendar_event_states[event_id] = {"isViewed": False}

    elif etype == "new_task":
        task_id = event.get("payload", {}).get("event_id")
        raw = MICROLENDAR_EVENT_CATALOG.get(task_id)
        if raw:
            session.microlendar_tasks.append(dict(raw))
            session.microlendar_task_states[task_id] = {
                "completed": bool(raw.get("is_completed", False)),
            }


# ---------------------------------------------------------------------------
# Bulk actions
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Materialization for SQL-based evaluation
# ---------------------------------------------------------------------------

def materialize_to_sqlite(session: Session, conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE events (id TEXT, title TEXT, start_time TEXT, end_time TEXT, category TEXT, is_task INT, description TEXT)"
    )
    conn.executemany(
        "INSERT INTO events VALUES (?,?,?,?,?,?,?)",
        [
            (e.get("id"), e.get("title"), e.get("start_time"), e.get("end_time"),
             e.get("category"), int(e.get("is_task", False)), e.get("description", ""))
            for e in session.microlendar_events
        ],
    )

    conn.execute("CREATE TABLE event_states (event_id TEXT, deleted INT, isViewed INT)")
    conn.executemany(
        "INSERT INTO event_states VALUES (?,?,?)",
        [(eid, int(s.get("deleted", False)), int(s.get("isViewed", False)))
         for eid, s in session.microlendar_event_states.items()],
    )

    conn.execute("CREATE TABLE tasks (id TEXT, title TEXT, dueDate TEXT)")
    conn.executemany(
        "INSERT INTO tasks VALUES (?,?,?)",
        [(t.get("id"), t.get("title"), t.get("dueDate")) for t in session.microlendar_tasks],
    )

    conn.execute("CREATE TABLE task_states (task_id TEXT, completed INT, deleted INT)")
    conn.executemany(
        "INSERT INTO task_states VALUES (?,?,?)",
        [
            (tid, int(s.get("completed", False)), int(s.get("deleted", False)))
            for tid, s in session.microlendar_task_states.items()
        ],
    )

    conn.execute(
        "CREATE TABLE user_created_events (id TEXT, title TEXT, date TEXT, time TEXT, endTime TEXT, calendar TEXT, deleted INT)"
    )
    conn.executemany(
        "INSERT INTO user_created_events VALUES (?,?,?,?,?,?,?)",
        [
            (e.get("id"), e.get("title"), e.get("date"), e.get("time"),
             e.get("endTime"), e.get("calendar"), int(e.get("deleted", False)))
            for e in session.microlendar_user_created_events
        ],
    )

    conn.execute(
        "CREATE TABLE user_created_tasks (id TEXT, title TEXT, dueDate TEXT, completed INT, deleted INT)"
    )
    conn.executemany(
        "INSERT INTO user_created_tasks VALUES (?,?,?,?,?)",
        [
            (t.get("id"), t.get("title"), t.get("dueDate"),
             int(t.get("completed", False)), int(t.get("deleted", False)))
            for t in session.microlendar_user_created_tasks
        ],
    )
