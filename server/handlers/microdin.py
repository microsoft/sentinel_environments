# handler for the microdin (professional network) environment.
# reads immutable post/connection/job data from catalogs.py, mutable state from session.py.
# provides functions for listing posts, connections, jobs, notifications, and conversations.
#
# flow: server.py route -> microdin handler -> reads MICRODIN_*_CATALOG + session -> returns data
# example: GET /microdin/posts -> get_posts() -> merges catalog data + session post_states

from __future__ import annotations

import datetime
import json
import sqlite3
from typing import TYPE_CHECKING

from server.catalogs import (
    MICRODIN_CONNECTION_CATALOG,
    MICRODIN_CONVERSATION_CATALOG,
    MICRODIN_JOB_CATALOG,
    MICRODIN_MESSAGE_CATALOG,
    MICRODIN_NOTIFICATION_CATALOG,
    MICRODIN_POST_CATALOG,
    USER_CATALOG,
)

if TYPE_CHECKING:
    from server.session import Session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_user(user_id: str) -> dict:
    """Return resolved user fields for a given user ID."""
    u = USER_CATALOG.get(user_id, {})
    return {"name": u.get("name", "Unknown"), "avatarUrl": u.get("avatarUrl", "")}


def _build_post_row(post_id: str, backdated: bool = False) -> dict:
    raw = MICRODIN_POST_CATALOG.get(post_id)
    if raw is None:
        raise KeyError(f"Unknown post_id: {post_id!r}")

    author_id = raw.get("author_id", "")
    user = USER_CATALOG.get(author_id, {})

    if backdated:
        ts = (datetime.datetime.utcnow() - datetime.timedelta(minutes=5)).isoformat() + "Z"
    else:
        ts = datetime.datetime.utcnow().isoformat() + "Z"

    # Resolve comment authors
    raw_comments = raw.get("comments", [])
    resolved_comments = []
    for c in raw_comments:
        rc = dict(c)
        cid = rc.get("authorId", rc.get("author_id", ""))
        resolved = _resolve_user(cid)
        rc["authorName"] = resolved["name"]
        rc["authorAvatarUrl"] = resolved["avatarUrl"]
        resolved_comments.append(rc)

    return {
        "id": post_id,
        "authorId": author_id,
        "authorName": user.get("name", "Unknown"),
        "authorTitle": user.get("jobTitle", ""),
        "authorAvatarUrl": user.get("avatarUrl", ""),
        "content": raw.get("content", ""),
        "imageUrl": raw.get("image_url"),
        "likes": raw.get("likes", 0),
        "comments": resolved_comments,
        "shares": raw.get("shares", 0),
        "timestamp": ts,
        "order": raw.get("order", 0),
    }


def _init_post_state(post_id: str) -> dict:
    return {"isLiked": False}


def _build_connection_row(connection_id: str) -> dict:
    raw = MICRODIN_CONNECTION_CATALOG.get(connection_id)
    if raw is None:
        raise KeyError(f"Unknown connection_id: {connection_id!r}")

    user_id = raw.get("user_id", "")
    user = USER_CATALOG.get(user_id, {})

    return {
        "id": connection_id,
        "userId": user_id,
        "name": user.get("name", "Unknown"),
        "title": user.get("jobTitle", "Professional"),
        "avatarUrl": user.get("avatarUrl", ""),
        "mutualConnections": raw.get("mutual_connections", 0),
        "order": raw.get("order", 0),
    }


def _init_connection_state(connection_id: str) -> dict:
    raw = MICRODIN_CONNECTION_CATALOG.get(connection_id, {})
    return {"status": raw.get("status", "pending")}


def _build_message_row(message_id: str, backdated: bool = False) -> dict:
    raw = MICRODIN_MESSAGE_CATALOG.get(message_id)
    if raw is None:
        raise KeyError(f"Unknown din message_id: {message_id!r}")

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
        "content": raw["content"],
        "timestamp": ts,
        "order": raw.get("order", 0),
    }


def _init_message_state(message_id: str) -> dict:
    raw = MICRODIN_MESSAGE_CATALOG.get(message_id, {})
    return {"isRead": bool(raw.get("is_read", False))}


def _build_notification_row(notification_id: str, backdated: bool = False) -> dict:
    raw = MICRODIN_NOTIFICATION_CATALOG.get(notification_id)
    if raw is None:
        raise KeyError(f"Unknown notification_id: {notification_id!r}")

    actor_id = raw.get("actor_id", "")
    user = USER_CATALOG.get(actor_id, {})

    if backdated:
        ts = (datetime.datetime.utcnow() - datetime.timedelta(minutes=5)).isoformat() + "Z"
    else:
        ts = datetime.datetime.utcnow().isoformat() + "Z"

    # Build content string based on notification type
    ntype = raw.get("type", "")
    text = raw.get("text")
    if text:
        content = text
    elif ntype == "like":
        content = "liked your post"
    elif ntype == "comment":
        content = "commented on your post"
    elif ntype == "connection":
        content = "sent you a connection request"
    elif ntype == "mention":
        content = "mentioned you in a post"
    elif ntype == "job":
        content = "A new job matches your profile"
    elif ntype == "profile_view":
        content = "viewed your profile"
    else:
        content = "interacted with your content"

    return {
        "id": notification_id,
        "type": ntype,
        "actorId": actor_id,
        "actorName": user.get("name", "Someone"),
        "actorAvatarUrl": user.get("avatarUrl", ""),
        "content": content,
        "targetPostId": raw.get("target_post_id"),
        "timestamp": ts,
        "order": raw.get("order", 0),
    }


def _init_notification_state(notification_id: str) -> dict:
    raw = MICRODIN_NOTIFICATION_CATALOG.get(notification_id, {})
    return {"isRead": bool(raw.get("is_read", False))}


def _build_job_row(job_id: str) -> dict:
    raw = MICRODIN_JOB_CATALOG.get(job_id)
    if raw is None:
        raise KeyError(f"Unknown job_id: {job_id!r}")

    return {
        "id": job_id,
        "title": raw.get("title", ""),
        "companyId": raw.get("company_id", ""),
        "location": raw.get("location", ""),
        "type": raw.get("type", "full-time"),
        "description": raw.get("description", ""),
        "requirements": raw.get("requirements", []),
        "applicants": raw.get("applicants", 0),
        "order": raw.get("order", 0),
    }


def _init_job_state(job_id: str) -> dict:
    return {"isApplied": False}


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_current_metrics(session: Session) -> dict:
    # Post count
    post_count = len(session.microdin_posts)

    # Pending connections
    pending_connection_count = sum(
        1 for cid, s in session.microdin_connection_states.items()
        if s.get("status") == "pending"
    )

    # Unread messages
    msg_states = session.microdin_message_states
    unread_message_count = sum(
        1 for mid, s in msg_states.items()
        if not s.get("isRead", False)
    )

    # Unread conversations (conversations with at least 1 unread message)
    unread_convos: set[str] = set()
    for m in session.microdin_messages:
        if not msg_states.get(m["id"], {}).get("isRead", False):
            unread_convos.add(m["conversationId"])
    unread_conversation_count = len(unread_convos)

    # Unread notifications
    notif_states = session.microdin_notification_states
    unread_notification_count = sum(
        1 for nid, s in notif_states.items()
        if not s.get("isRead", False)
    )

    # Jobs
    job_count = len(session.microdin_jobs)
    applied_job_count = sum(
        1 for jid, s in session.microdin_job_states.items()
        if s.get("isApplied", False)
    )

    return {
        "post_count": post_count,
        "pending_connection_count": pending_connection_count,
        "unread_message_count": unread_message_count,
        "unread_conversation_count": unread_conversation_count,
        "unread_notification_count": unread_notification_count,
        "job_count": job_count,
        "applied_job_count": applied_job_count,
    }


# ---------------------------------------------------------------------------
# Event processing
# ---------------------------------------------------------------------------

def process_event(session: Session, event: dict) -> None:
    etype = event["type"]

    if etype == "preload_posts":
        payload = event.get("payload", {})

        # Optional profile stats
        if "profile_view_count" in payload:
            session.microdin_profile_view_count = int(payload["profile_view_count"])
        if "page_visitor_count" in payload:
            session.microdin_page_visitor_count = int(payload["page_visitor_count"])
        if "connections_count" in payload:
            session.microdin_connections_count = int(payload["connections_count"])
        if "initial_connection_ids" in payload:
            session.microdin_initial_connection_ids = list(payload["initial_connection_ids"])
            if "connections_count" not in payload:
                session.microdin_connections_count = len(session.microdin_initial_connection_ids)

        # Load posts
        post_ids = payload.get("post_ids", [])
        if post_ids == ["*"]:
            post_ids = list(MICRODIN_POST_CATALOG.keys())
        for post_id in post_ids:
            row = _build_post_row(post_id, backdated=True)
            session.microdin_posts.append(row)
            session.microdin_post_states[post_id] = _init_post_state(post_id)

        # Load connections
        connection_ids = payload.get("connection_ids", [])
        if connection_ids == ["*"]:
            connection_ids = list(MICRODIN_CONNECTION_CATALOG.keys())
        for conn_id in connection_ids:
            row = _build_connection_row(conn_id)
            session.microdin_connections.append(row)
            session.microdin_connection_states[conn_id] = _init_connection_state(conn_id)

        # Load conversations and their messages
        conversation_ids = payload.get("conversation_ids", [])
        if conversation_ids == ["*"]:
            conversation_ids = list(MICRODIN_CONVERSATION_CATALOG.keys())
        for conv_id in conversation_ids:
            conv_data = MICRODIN_CONVERSATION_CATALOG.get(conv_id)
            if conv_data:
                row = dict(conv_data)
                if "participantIds" in row:
                    row["participants"] = [
                        {"id": uid, **_resolve_user(uid)} for uid in row["participantIds"]
                    ]
                session.microdin_conversations.append(row)
        # Load messages for all loaded conversations
        loaded_conv_ids = {c["id"] for c in session.microdin_conversations}
        for msg_id, msg_raw in MICRODIN_MESSAGE_CATALOG.items():
            if msg_raw["conversation_id"] in loaded_conv_ids:
                row = _build_message_row(msg_id, backdated=True)
                session.microdin_messages.append(row)
                session.microdin_message_states[msg_id] = _init_message_state(msg_id)

        # Load notifications
        notification_ids = payload.get("notification_ids", [])
        if notification_ids == ["*"]:
            notification_ids = list(MICRODIN_NOTIFICATION_CATALOG.keys())
        for notif_id in notification_ids:
            row = _build_notification_row(notif_id, backdated=True)
            session.microdin_notifications.append(row)
            session.microdin_notification_states[notif_id] = _init_notification_state(notif_id)

        # Load jobs
        job_ids = payload.get("job_ids", [])
        if job_ids == ["*"]:
            job_ids = list(MICRODIN_JOB_CATALOG.keys())
        for job_id in job_ids:
            row = _build_job_row(job_id)
            session.microdin_jobs.append(row)
            session.microdin_job_states[job_id] = _init_job_state(job_id)

        # Capture baseline after preload
        session.baseline_metrics = compute_current_metrics(session)

    elif etype == "new_post":
        post_id = event.get("payload", {}).get("post_id")
        if post_id:
            row = _build_post_row(post_id, backdated=False)
            session.microdin_posts.append(row)
            session.microdin_post_states[post_id] = _init_post_state(post_id)

    elif etype == "new_connection":
        conn_id = event.get("payload", {}).get("connection_id")
        if conn_id:
            row = _build_connection_row(conn_id)
            session.microdin_connections.append(row)
            session.microdin_connection_states[conn_id] = _init_connection_state(conn_id)

    elif etype == "new_message":
        msg_id = event.get("payload", {}).get("message_id")
        if msg_id:
            raw = MICRODIN_MESSAGE_CATALOG.get(msg_id)
            if raw:
                # Ensure the conversation exists in session
                conv_id = raw["conversation_id"]
                if not any(c["id"] == conv_id for c in session.microdin_conversations):
                    conv_data = MICRODIN_CONVERSATION_CATALOG.get(conv_id)
                    if conv_data:
                        row = dict(conv_data)
                        if "participantIds" in row:
                            row["participants"] = [
                                {"id": uid, **_resolve_user(uid)} for uid in row["participantIds"]
                            ]
                        session.microdin_conversations.append(row)
                row = _build_message_row(msg_id, backdated=False)
                session.microdin_messages.append(row)
                session.microdin_message_states[msg_id] = {"isRead": False}
    
    elif etype == "new_notification":
        notif_id = event.get("payload", {}).get("notification_id")
        if notif_id:
            row = _build_notification_row(notif_id, backdated=False)
            session.microdin_notifications.append(row)
            session.microdin_notification_states[notif_id] = {"isRead": False}

    elif etype == "new_job":
        job_id = event.get("payload", {}).get("job_id")
        if job_id:
            row = _build_job_row(job_id)
            session.microdin_jobs.append(row)
            session.microdin_job_states[job_id] = _init_job_state(job_id)


# ---------------------------------------------------------------------------
# Bulk actions
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Materialization for SQL-based evaluation
# ---------------------------------------------------------------------------

def materialize_to_sqlite(session: Session, conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE posts (id TEXT, authorId TEXT, content TEXT, likes INT, shares INT)"
    )
    conn.executemany(
        "INSERT INTO posts VALUES (?,?,?,?,?)",
        [(p.get("id"), p.get("authorId"), p.get("content"), int(p.get("likes", 0)), int(p.get("shares", 0))) for p in session.microdin_posts],
    )

    conn.execute("CREATE TABLE post_states (post_id TEXT, isLiked INT)")
    conn.executemany(
        "INSERT INTO post_states VALUES (?,?)",
        [(pid, int(s.get("isLiked", False))) for pid, s in session.microdin_post_states.items()],
    )

    conn.execute("CREATE TABLE connections (id TEXT, userId TEXT, name TEXT, mutualConnections INT)")
    conn.executemany(
        "INSERT INTO connections VALUES (?,?,?,?)",
        [(c.get("id"), c.get("userId"), c.get("name"), int(c.get("mutualConnections", 0))) for c in session.microdin_connections],
    )

    conn.execute("CREATE TABLE connection_states (connection_id TEXT, status TEXT)")
    conn.executemany(
        "INSERT INTO connection_states VALUES (?,?)",
        [(cid, s.get("status", "pending")) for cid, s in session.microdin_connection_states.items()],
    )

    conn.execute("CREATE TABLE messages (id TEXT, conversationId TEXT, senderId TEXT, content TEXT)")
    conn.executemany(
        "INSERT INTO messages VALUES (?,?,?,?)",
        [(m.get("id"), m.get("conversationId"), m.get("senderId"), m.get("content")) for m in session.microdin_messages],
    )

    conn.execute("CREATE TABLE message_states (message_id TEXT, isRead INT)")
    conn.executemany(
        "INSERT INTO message_states VALUES (?,?)",
        [(mid, int(s.get("isRead", False))) for mid, s in session.microdin_message_states.items()],
    )

    conn.execute("CREATE TABLE notifications (id TEXT, type TEXT, actorId TEXT, content TEXT)")
    conn.executemany(
        "INSERT INTO notifications VALUES (?,?,?,?)",
        [(n.get("id"), n.get("type"), n.get("actorId"), n.get("content")) for n in session.microdin_notifications],
    )

    conn.execute("CREATE TABLE notification_states (notification_id TEXT, isRead INT)")
    conn.executemany(
        "INSERT INTO notification_states VALUES (?,?)",
        [(nid, int(s.get("isRead", False))) for nid, s in session.microdin_notification_states.items()],
    )

    conn.execute("CREATE TABLE jobs (id TEXT, title TEXT, companyId TEXT, location TEXT)")
    conn.executemany(
        "INSERT INTO jobs VALUES (?,?,?,?)",
        [(j.get("id"), j.get("title"), j.get("companyId"), j.get("location")) for j in session.microdin_jobs],
    )

    conn.execute("CREATE TABLE job_states (job_id TEXT, isApplied INT)")
    conn.executemany(
        "INSERT INTO job_states VALUES (?,?)",
        [(jid, int(s.get("isApplied", False))) for jid, s in session.microdin_job_states.items()],
    )
