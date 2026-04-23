# handler for the microchat (team messaging) environment.
# reads immutable message/team/conversation data from catalogs.py, mutable state from session.py.
# provides functions for listing messages, conversations, teams, calls, and reacting to messages.
#
# flow: server.py route -> microchat handler -> reads MICROCHAT_*_CATALOG + session -> returns data
# example: GET /microchat/messages -> get_messages() -> merges catalog data + session message_states

from __future__ import annotations

import datetime
import json
import sqlite3
from typing import TYPE_CHECKING

from server.catalogs import (
    MICROCHAT_CALL_CATALOG,
    MICROCHAT_CONVERSATION_CATALOG,
    MICROCHAT_MESSAGE_CATALOG,
    MICROCHAT_TEAM_CATALOG,
    USER_CATALOG,
)

if TYPE_CHECKING:
    from server.session import Session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_message_row(message_id: str, backdated: bool = False) -> dict:
    """Merge raw message data with sender info."""
    raw = MICROCHAT_MESSAGE_CATALOG.get(message_id)
    if raw is None:
        raise KeyError(f"Unknown message_id: {message_id!r}")

    sender_id = raw.get("sender_id", "")
    user = USER_CATALOG.get(sender_id, {})

    if backdated:
        ts = (datetime.datetime.utcnow() - datetime.timedelta(minutes=5)).isoformat() + "Z"
    else:
        ts = datetime.datetime.utcnow().isoformat() + "Z"

    return {
        "id": message_id,
        "conversationId": raw["conversation_id"],
        "senderId": sender_id,
        "senderName": user.get("name", "Unknown"),
        "senderAvatarUrl": user.get("avatarUrl", ""),
        "content": raw["content"],
        "isUrgent": bool(raw.get("is_urgent", False)),
        "mentionsMe": bool(raw.get("mentions_me", False)),
        "hasAttachment": bool(raw.get("has_attachment", False)),
        "reactions": json.loads(raw["reactions"]) if isinstance(raw["reactions"], str) else raw.get("reactions", []),
        "attachments": json.loads(raw["attachments"]) if isinstance(raw["attachments"], str) else raw.get("attachments", []),
        "replyToId": raw.get("reply_to_id"),
        "timestamp": ts,
        "order": raw.get("order", 0),
    }


def _init_message_state(message_id: str, raw: dict) -> dict:
    is_read = raw.get("is_read")
    if is_read is None:
        is_read = raw.get("isRead", False)
    return {
        "isRead": bool(is_read),
    }


def _resolve_user(user_id: str) -> dict:
    """Return resolved user fields for a given user ID."""
    u = USER_CATALOG.get(user_id, {})
    return {
        "name": u.get("name", "Unknown"),
        "avatarUrl": u.get("avatarUrl", ""),
        "username": u.get("username", ""),
        "jobTitle": u.get("jobTitle", ""),
    }


def _self_user_id() -> str:
    """Return the catalog ID for the self user."""
    for uid, user in USER_CATALOG.items():
        if user.get("isSelf"):
            return uid
    return "user000"


def _resolve_direct_counterparty(participant_ids: list[str]) -> dict | None:
    """Resolve the non-self participant for a direct conversation."""
    self_id = _self_user_id()
    for uid in participant_ids:
        if uid != self_id and uid in USER_CATALOG:
            return {"id": uid, **_resolve_user(uid)}
    return None


def _build_conversation_row(conv_data: dict) -> dict:
    """Build a conversation row, canonicalizing direct-message identity."""
    row = dict(conv_data)
    participant_ids = row.get("participantIds", [])
    if participant_ids:
        row["participants"] = [
            {"id": uid, **_resolve_user(uid)} for uid in participant_ids
        ]

    if row.get("type") == "direct":
        counterparty = _resolve_direct_counterparty(participant_ids)
        if counterparty:
            row["name"] = counterparty["name"]

    return row


def _build_call_row(call_id: str) -> dict:
    raw = MICROCHAT_CALL_CATALOG.get(call_id)
    if raw is None:
        raise KeyError(f"Unknown call_id: {call_id!r}")
    row = dict(raw)
    uid = row.get("userId") or row.get("callerId") or ""
    if uid:
        resolved = _resolve_user(uid)
        row["name"] = resolved["name"]
        row["userName"] = resolved["name"]
        row["userAvatarUrl"] = resolved["avatarUrl"]
    return row


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_current_metrics(session: Session) -> dict:
    states = session.microchat_message_states
    messages = session.microchat_messages

    unread_count = 0
    mention_count = 0
    urgent_count = 0
    unread_convos: set[str] = set()

    for m in messages:
        is_read = states.get(m["id"], {}).get("isRead", False)
        if not is_read:
            unread_count += 1
            unread_convos.add(m["conversationId"])
            if m.get("mentionsMe", False):
                mention_count += 1
            if m.get("isUrgent", False):
                urgent_count += 1

    missed_call_count = sum(
        1 for c in session.microchat_calls if c.get("missed", False)
    )

    return {
        "unread_count": unread_count,
        "unread_conversation_count": len(unread_convos),
        "mention_count": mention_count,
        "urgent_count": urgent_count,
        "missed_call_count": missed_call_count,
        "total_message_count": len(messages),
    }


# ---------------------------------------------------------------------------
# Event processing
# ---------------------------------------------------------------------------

def process_event(session: Session, event: dict) -> None:
    etype = event["type"]

    if etype == "preload_messages":
        message_ids = event.get("payload", {}).get("message_ids", [])
        if message_ids == ["*"]:
            message_ids = list(MICROCHAT_MESSAGE_CATALOG.keys())
        for msg_id in message_ids:
            row = _build_message_row(msg_id, backdated=True)
            session.microchat_messages.append(row)
            session.microchat_message_states[msg_id] = _init_message_state(
                msg_id, MICROCHAT_MESSAGE_CATALOG.get(msg_id, {})
            )
        # Load calls
        call_ids = event.get("payload", {}).get("call_ids", [])
        if call_ids == ["*"]:
            call_ids = list(MICROCHAT_CALL_CATALOG.keys())
        for call_id in call_ids:
            row = _build_call_row(call_id)
            session.microchat_calls.append(row)
        # Load all conversations and teams from catalogs
        if not session.microchat_conversations:
            for conv_data in MICROCHAT_CONVERSATION_CATALOG.values():
                row = _build_conversation_row(conv_data)
                session.microchat_conversations.append(row)
                session.microchat_conversation_states[conv_data["id"]] = {
                    "isPinned": conv_data.get("isPinned", False),
                    "isMuted": conv_data.get("isMuted", False),
                }
        if not session.microchat_teams:
            for team_data in MICROCHAT_TEAM_CATALOG.values():
                row = dict(team_data)
                # Resolve memberIds to members with name/avatar
                if "memberIds" in row:
                    row["members"] = [
                        {"id": uid, **_resolve_user(uid)} for uid in row["memberIds"]
                    ]
                session.microchat_teams.append(row)
        # Capture baseline after preload
        session.baseline_metrics = compute_current_metrics(session)

    elif etype == "new_message":
        msg_id = event.get("payload", {}).get("message_id")
        if msg_id:
            row = _build_message_row(msg_id, backdated=False)
            session.microchat_messages.append(row)
            session.microchat_message_states[msg_id] = _init_message_state(
                msg_id, MICROCHAT_MESSAGE_CATALOG.get(msg_id, {})
            )

    elif etype == "new_call":
        call_id = event.get("payload", {}).get("call_id")
        if call_id:
            row = _build_call_row(call_id)
            session.microchat_calls.append(row)


# ---------------------------------------------------------------------------
# Bulk actions
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Materialization for SQL-based evaluation
# ---------------------------------------------------------------------------

def materialize_to_sqlite(session: Session, conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE messages ("
        "id TEXT, conversationId TEXT, senderId TEXT, content TEXT, "
        "isUrgent INT, mentionsMe INT, hasAttachment INT)"
    )
    conn.executemany(
        "INSERT INTO messages VALUES (?,?,?,?,?,?,?)",
        [
            (
                m.get("id"), m.get("conversationId"), m.get("senderId"),
                m.get("content"), int(m.get("isUrgent", False)),
                int(m.get("mentionsMe", False)), int(m.get("hasAttachment", False)),
            )
            for m in session.microchat_messages
        ],
    )

    conn.execute("CREATE TABLE message_states (message_id TEXT, isRead INT)")
    conn.executemany(
        "INSERT INTO message_states VALUES (?,?)",
        [(mid, int(s.get("isRead", False))) for mid, s in session.microchat_message_states.items()],
    )

    conn.execute("CREATE TABLE conversations (id TEXT, name TEXT, type TEXT, teamId TEXT)")
    conn.executemany(
        "INSERT INTO conversations VALUES (?,?,?,?)",
        [(c.get("id"), c.get("name"), c.get("type"), c.get("teamId")) for c in session.microchat_conversations],
    )

    conn.execute("CREATE TABLE conversation_states (conversation_id TEXT, isPinned INT, isMuted INT)")
    conn.executemany(
        "INSERT INTO conversation_states VALUES (?,?,?)",
        [
            (cid, int(s.get("isPinned", False)), int(s.get("isMuted", False)))
            for cid, s in session.microchat_conversation_states.items()
        ],
    )

    conn.execute("CREATE TABLE teams (id TEXT, name TEXT)")
    conn.executemany(
        "INSERT INTO teams VALUES (?,?)",
        [(t.get("id"), t.get("name")) for t in session.microchat_teams],
    )

    conn.execute("CREATE TABLE calls (id TEXT, callerId TEXT, missed INT, duration TEXT)")
    conn.executemany(
        "INSERT INTO calls VALUES (?,?,?,?)",
        [(c.get("id"), c.get("callerId"), int(c.get("missed", False)), str(c.get("duration", ""))) for c in session.microchat_calls],
    )
