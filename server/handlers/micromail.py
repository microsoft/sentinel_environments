# handler for the micromail (email client) environment.
# reads immutable email data from catalogs.py and mutable state from session.py.
# provides functions for listing emails, moving to folders, marking read/flagged, etc.
#
# flow: server.py route -> micromail handler -> reads MICROMAIL_EMAIL_CATALOG + session -> returns data
# example: GET /micromail/emails -> get_emails() -> merges catalog data + session email_states

from __future__ import annotations

import datetime
import sqlite3
from typing import TYPE_CHECKING

import uuid

from server.catalogs import (
    MICROMAIL_ATTACHMENT_CATALOG,
    MICROMAIL_EMAIL_CATALOG,
    USER_CATALOG,
)


def _self_user() -> dict:
    """Return the catalog entry for the self user (isSelf=True)."""
    return next((u for u in USER_CATALOG.values() if u.get("isSelf")), {})


def _self_user_email() -> str:
    return _self_user().get("email", "you@micromail.com")

if TYPE_CHECKING:
    from server.session import Session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_email_row(email_id: str, backdated: bool = False) -> dict:
    """Merge raw email data with sender and attachment info."""
    raw = MICROMAIL_EMAIL_CATALOG.get(email_id)
    if raw is None:
        raise KeyError(f"Unknown email_id: {email_id!r}")

    sender_id = raw.get("sender_id", "")
    user = USER_CATALOG.get(sender_id, {})

    attachments = MICROMAIL_ATTACHMENT_CATALOG.get(email_id, [])
    attachment = attachments[0] if attachments else None

    if backdated:
        ts = (datetime.datetime.utcnow() - datetime.timedelta(minutes=5)).isoformat() + "Z"
    else:
        ts = datetime.datetime.utcnow().isoformat() + "Z"

    cc = raw.get("cc", [])

    return {
        "id": email_id,
        "subject": raw.get("subject", ""),
        "body": raw.get("body", ""),
        "sender": {
            "name": user.get("name", "Unknown Sender"),
            "email": user.get("email", ""),
            "avatarUrl": user.get("avatarUrl", ""),
        },
        "recipients": raw.get("recipients") or [_self_user_email()],

        "cc": cc,
        "isCC": bool(raw.get("isCC", False)),
        "hasAttachment": bool(raw.get("hasAttachment", attachment is not None)),
        "isExternal": bool(raw.get("isExternal", False)),
        "importance": raw.get("importance", "normal"),
        "mentionsMe": bool(raw.get("mentionsMe", False)),
        "attachment": (
            {"id": attachment["id"], "name": attachment["name"], "size": attachment["size"]}
            if attachment
            else None
        ),
        "timestamp": ts,
    }


def _init_email_state(email_id: str, raw: dict) -> dict:
    folder = raw.get("folder")
    if not folder:
        folder = "junk" if raw.get("isJunk") else "inbox"
    return {
        "isRead": bool(raw.get("isRead", False)),
        "isFlagged": bool(raw.get("isFlagged", False)),
        "isPinned": bool(raw.get("isPinned", False)),
        "folder": folder,
    }


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_current_metrics(session: Session) -> dict:
    states = session.micromail_email_states
    emails = session.micromail_emails
    email_state_map = {e["id"]: states.get(e["id"], {}) for e in emails}

    return {
        "unread_count": sum(
            1
            for eid, s in email_state_map.items()
            if not s.get("isRead", False) and s.get("folder") == "inbox"
        ),
        "junk_count": sum(
            1 for s in states.values() if s.get("folder") == "junk"
        ),
        "attachment_count": sum(
            1
            for e in emails
            if e.get("hasAttachment") and states.get(e["id"], {}).get("folder") != "deleted"
        ),
        "external_count": sum(
            1
            for e in emails
            if e.get("isExternal") and states.get(e["id"], {}).get("folder") == "inbox"
        ),
        "inbox_count": sum(
            1 for s in states.values() if s.get("folder") == "inbox"
        ),
        "urgent_count": sum(
            1
            for e in emails
            if e.get("importance") == "high" and states.get(e["id"], {}).get("folder") == "inbox"
        ),
        "mention_count": sum(
            1
            for e in emails
            if e.get("mentionsMe") and states.get(e["id"], {}).get("folder") == "inbox"
        ),
        "cc_count": sum(
            1
            for e in emails
            if e.get("isCC") and states.get(e["id"], {}).get("folder") == "inbox"
        ),
    }


# ---------------------------------------------------------------------------
# Event processing
# ---------------------------------------------------------------------------

def process_event(session: Session, event: dict) -> None:
    etype = event["type"]

    if etype == "preload_emails":
        email_ids = event.get("payload", {}).get("email_ids") or event.get("email_ids", [])
        if email_ids == ["*"]:
            email_ids = list(MICROMAIL_EMAIL_CATALOG.keys())
        for email_id in email_ids:
            row = _build_email_row(email_id, backdated=True)
            session.micromail_emails.append(row)
            session.micromail_email_states[email_id] = _init_email_state(
                email_id, MICROMAIL_EMAIL_CATALOG.get(email_id, {})
            )
        # Capture baseline after preload
        session.baseline_metrics = compute_current_metrics(session)

    elif etype == "new_email":
        email_id = event.get("payload", {}).get("email_id") or event.get("email_id")
        row = _build_email_row(email_id, backdated=False)
        session.micromail_emails.append(row)
        session.micromail_email_states[email_id] = _init_email_state(
            email_id, MICROMAIL_EMAIL_CATALOG.get(email_id, {})
        )


# ---------------------------------------------------------------------------
# Send / compose
# ---------------------------------------------------------------------------

def send_email(session: Session, *, to: list[str], cc: list[str], bcc: list[str],
               subject: str, body: str, folder: str = "sent") -> dict:
    """Create a new outgoing email and place it in the given folder (sent or drafts)."""
    me = _self_user()
    email_id = f"{folder}-{uuid.uuid4().hex[:12]}"
    ts = datetime.datetime.utcnow().isoformat() + "Z"

    row = {
        "id": email_id,
        "subject": subject,
        "body": body,
        "sender": {
            "name": me.get("name", "You"),
            "email": me.get("email", "you@micromail.com"),
            "avatarUrl": me.get("avatarUrl", ""),
        },
        "recipients": to,
        "cc": cc,
        "isCC": False,
        "hasAttachment": False,
        "isExternal": False,
        "importance": "normal",
        "mentionsMe": False,
        "attachment": None,
        "timestamp": ts,
    }
    session.micromail_emails.append(row)
    session.micromail_email_states[email_id] = {
        "isRead": True,
        "isFlagged": False,
        "isPinned": False,
        "folder": folder,
    }
    return row


# ---------------------------------------------------------------------------
# Bulk actions
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# SQLite materialisation
# ---------------------------------------------------------------------------

def materialize_to_sqlite(session: Session, conn: sqlite3.Connection) -> None:
    """Write session email data into an in-memory SQLite database."""

    # -- emails table --
    conn.execute(
        "CREATE TABLE IF NOT EXISTS emails ("
        "id TEXT, subject TEXT, sender_name TEXT, sender_email TEXT, "
        "hasAttachment INT, isExternal INT, importance TEXT, "
        "mentionsMe INT, isCC INT, body TEXT, attachment_name TEXT"
        ")"
    )
    conn.executemany(
        "INSERT INTO emails "
        "(id, subject, sender_name, sender_email, hasAttachment, isExternal, "
        "importance, mentionsMe, isCC, body, attachment_name) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (
                e.get("id", ""),
                e.get("subject", ""),
                e.get("sender", {}).get("name", ""),
                e.get("sender", {}).get("email", ""),
                int(e.get("hasAttachment", False)),
                int(e.get("isExternal", False)),
                e.get("importance", "normal"),
                int(e.get("mentionsMe", False)),
                int(e.get("isCC", False)),
                e.get("body", ""),
                (e.get("attachment") or {}).get("name", ""),
            )
            for e in session.micromail_emails
        ],
    )

    # -- email_states table --
    conn.execute(
        "CREATE TABLE IF NOT EXISTS email_states ("
        "email_id TEXT, isRead INT, isFlagged INT, isPinned INT, folder TEXT"
        ")"
    )
    conn.executemany(
        "INSERT INTO email_states (email_id, isRead, isFlagged, isPinned, folder) "
        "VALUES (?, ?, ?, ?, ?)",
        [
            (
                email_id,
                int(state.get("isRead", False)),
                int(state.get("isFlagged", False)),
                int(state.get("isPinned", False)),
                state.get("folder", "inbox"),
            )
            for email_id, state in session.micromail_email_states.items()
        ],
    )
