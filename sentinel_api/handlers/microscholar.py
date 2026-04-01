# handler for the microscholar (academic search) environment.
# reads immutable paper/alert/coauthor data from catalogs.py, mutable state from session.py.
# provides functions for listing papers, alerts, coauthors, and citing/saving papers.
#
# flow: server.py route -> microscholar handler -> reads MICROSCHOLAR_*_CATALOG + session -> returns data
# example: GET /microscholar/papers -> get_papers() -> merges catalog data + session paper_states

from __future__ import annotations

import json
import sqlite3
from typing import TYPE_CHECKING

from sentinel_api.catalogs import (
    MICROSCHOLAR_ALERT_CATALOG,
    MICROSCHOLAR_COAUTHOR_CATALOG,
    MICROSCHOLAR_PAPER_CATALOG,
    USER_CATALOG,
)

if TYPE_CHECKING:
    from sentinel_api.session import Session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_user(user_id: str) -> dict:
    """Return resolved user fields for a given user ID."""
    u = USER_CATALOG.get(user_id, {})
    return {"name": u.get("name", "Unknown"), "avatarUrl": u.get("avatarUrl", "")}


def _build_paper_row(paper_id: str) -> dict:
    """Build a paper dict from catalog data."""
    raw = MICROSCHOLAR_PAPER_CATALOG.get(paper_id)
    if raw is None:
        raise KeyError(f"Unknown paper_id: {paper_id!r}")

    author_ids = json.loads(raw["author_ids"]) if isinstance(raw["author_ids"], str) else raw["author_ids"]

    # Resolve author details
    author_details = []
    for aid in author_ids:
        u = USER_CATALOG.get(aid, {})
        scholar = u.get("scholar", {})
        author_details.append({
            "id": aid,
            "name": u.get("name", "Unknown"),
            "avatarUrl": u.get("avatarUrl", ""),
            "affiliation": scholar.get("affiliation", ""),
        })

    return {
        "id": raw["id"],
        "title": raw["title"],
        "titleHtml": raw["title_html"],
        "authorIds": author_ids,
        "authorDetails": author_details,
        "authors": raw["authors"],
        "source": raw["source"],
        "year": raw["year"],
        "snippet": raw["snippet"],
        "citedBy": raw["cited_by"],
        "pdfLink": raw["pdf_link"],
        "pdfSource": raw["pdf_source"],
        "isBook": bool(raw["is_book"]),
        "isTargetPaper": bool(raw["is_target_paper"]),
        "taskType": raw["task_type"],
        "order": raw["order"],
    }


def _build_alert_row(alert_id: str) -> dict:
    """Build an alert dict from catalog data."""
    raw = MICROSCHOLAR_ALERT_CATALOG.get(alert_id)
    if raw is None:
        raise KeyError(f"Unknown alert_id: {alert_id!r}")

    return {
        "id": raw["id"],
        "type": raw["type"],
        "title": raw["title"],
        "description": raw["description"],
        "isRead": bool(raw["is_read"]),
        "relatedPaperId": raw.get("related_paper_id", ""),
        "order": raw["order"],
    }


def _build_coauthor_row(coauthor: dict) -> dict:
    """Build a coauthor relationship dict from catalog data."""
    r1 = _resolve_user(coauthor["author_id_1"])
    r2 = _resolve_user(coauthor["author_id_2"])
    return {
        "authorId1": coauthor["author_id_1"],
        "author1Name": r1["name"],
        "author1AvatarUrl": r1["avatarUrl"],
        "authorId2": coauthor["author_id_2"],
        "author2Name": r2["name"],
        "author2AvatarUrl": r2["avatarUrl"],
        "sharedPapers": json.loads(coauthor["shared_papers"]) if isinstance(coauthor["shared_papers"], str) else coauthor["shared_papers"],
        "order": coauthor["order"],
    }


def _init_paper_state() -> dict:
    return {"isSaved": False}


def _init_alert_state(raw: dict) -> dict:
    return {"isRead": bool(raw.get("is_read", False))}


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_current_metrics(session: Session) -> dict:
    papers = session.microscholar_papers
    alerts = session.microscholar_alerts
    alert_states = session.microscholar_alert_states
    paper_states = session.microscholar_paper_states

    target_paper_available = 1 if any(p.get("isTargetPaper") for p in papers) else 0

    return {
        "target_paper_available": target_paper_available,
        "paper_count": len(papers),
        "saved_paper_count": sum(
            1 for s in paper_states.values() if s.get("isSaved")
        ),
        "unread_alert_count": sum(
            1
            for a in alerts
            if not alert_states.get(a["id"], {}).get("isRead", False)
        ),
    }


# ---------------------------------------------------------------------------
# Event processing
# ---------------------------------------------------------------------------

def process_event(session: Session, event: dict) -> None:
    etype = event["type"]

    if etype == "preload_papers":
        # Load initial (non-target) papers
        paper_ids = event.get("payload", {}).get("paper_ids", [])
        for pid in paper_ids:
            row = _build_paper_row(pid)
            session.microscholar_papers.append(row)
            session.microscholar_paper_states[pid] = _init_paper_state()

        # Load alerts
        alert_ids = event.get("payload", {}).get("alert_ids", [])
        for aid in alert_ids:
            row = _build_alert_row(aid)
            session.microscholar_alerts.append(row)
            session.microscholar_alert_states[aid] = _init_alert_state(
                MICROSCHOLAR_ALERT_CATALOG.get(aid, {})
            )

        # Load coauthors
        for key, cat in MICROSCHOLAR_COAUTHOR_CATALOG.items():
            session.microscholar_coauthors.append(_build_coauthor_row(cat))

        # Capture baseline after preload
        session.baseline_metrics = compute_current_metrics(session)

    elif etype == "inject_target_paper":
        paper_id = event.get("payload", {}).get("paper_id")
        if paper_id:
            row = _build_paper_row(paper_id)
            session.microscholar_papers.append(row)
            session.microscholar_paper_states[paper_id] = _init_paper_state()


# ---------------------------------------------------------------------------
# Bulk actions
# ---------------------------------------------------------------------------

def handle_action(session: Session, action_name: str) -> dict:
    if action_name == "cite_target_paper":
        pass  # No state change — action acknowledgement only

    elif action_name == "clear_saved_papers":
        for s in session.microscholar_paper_states.values():
            s["isSaved"] = False

    elif action_name == "mark_all_alerts_read":
        for s in session.microscholar_alert_states.values():
            s["isRead"] = True

    else:
        return {"success": False, "error": f"Unknown action: {action_name}"}

    return {"success": True}


# ---------------------------------------------------------------------------
# Materialization for SQL-based evaluation
# ---------------------------------------------------------------------------

def materialize_to_sqlite(session: Session, conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE papers (id TEXT, title TEXT, authors TEXT, year INT, isTargetPaper INT, taskType TEXT)"
    )
    conn.executemany(
        "INSERT INTO papers VALUES (?,?,?,?,?,?)",
        [
            (p.get("id"), p.get("title"), p.get("authors", ""),
             int(p.get("year", 0)), int(p.get("isTargetPaper", False)),
             p.get("taskType"))
            for p in session.microscholar_papers
        ],
    )

    conn.execute("CREATE TABLE paper_states (paper_id TEXT, isSaved INT)")
    conn.executemany(
        "INSERT INTO paper_states VALUES (?,?)",
        [(pid, int(s.get("isSaved", False))) for pid, s in session.microscholar_paper_states.items()],
    )

    conn.execute("CREATE TABLE alerts (id TEXT, type TEXT, title TEXT, description TEXT)")
    conn.executemany(
        "INSERT INTO alerts VALUES (?,?,?,?)",
        [(a.get("id"), a.get("type"), a.get("title"), a.get("description")) for a in session.microscholar_alerts],
    )

    conn.execute("CREATE TABLE alert_states (alert_id TEXT, isRead INT)")
    conn.executemany(
        "INSERT INTO alert_states VALUES (?,?)",
        [(aid, int(s.get("isRead", False))) for aid, s in session.microscholar_alert_states.items()],
    )

    conn.execute("CREATE TABLE coauthors (authorId1 TEXT, authorId2 TEXT, sharedPapers TEXT)")
    conn.executemany(
        "INSERT INTO coauthors VALUES (?,?,?)",
        [
            (c.get("authorId1"), c.get("authorId2"), json.dumps(c.get("sharedPapers", [])))
            for c in session.microscholar_coauthors
        ],
    )
