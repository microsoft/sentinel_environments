# handler for the microgram (photo sharing) environment.
# reads immutable post/story/activity data from catalogs.py, mutable state from session.py.
# provides functions for listing posts, stories, messages, activity, and commenting/liking.
#
# flow: server.py route -> microgram handler -> reads MICROGRAM_*_CATALOG + session -> returns data
# example: POST /microgram/posts/{id}/like -> toggle_like() -> session.microgram_post_states[id]["isLiked"]

from __future__ import annotations

import json
import sqlite3
from typing import TYPE_CHECKING

from sentinel_api.catalogs import (
    MICROGRAM_ACTIVITY_CATALOG,
    MICROGRAM_MESSAGE_CATALOG,
    MICROGRAM_POST_CATALOG,
    MICROGRAM_STORY_CATALOG,
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


def _build_post_row(post_id: str) -> dict:
    raw = MICROGRAM_POST_CATALOG.get(post_id)
    if raw is None:
        raise KeyError(f"Unknown post_id: {post_id!r}")

    author_id = raw["author_id"]
    resolved = _resolve_user(author_id)

    # Resolve comment authors
    raw_comments = raw["comments"]
    resolved_comments = []
    for c in raw_comments:
        rc = dict(c)
        cid = rc.get("authorId", rc.get("author_id", ""))
        cr = _resolve_user(cid)
        rc["authorName"] = cr["name"]
        rc["authorAvatarUrl"] = cr["avatarUrl"]
        resolved_comments.append(rc)

    return {
        "id": post_id,
        "authorId": author_id,
        "authorName": resolved["name"],
        "authorAvatarUrl": resolved["avatarUrl"],
        "imageUrl": raw["image_url"],
        "caption": raw["caption"],
        "location": raw["location"],
        "likes": raw["likes"],
        "comments": resolved_comments,
        "isTargetPost": raw["is_target_post"],
        "taskType": raw.get("task_type"),
        "order": raw["order"],
    }


def _init_post_state(post_id: str) -> dict:
    return {"isLiked": False, "isSaved": False}


def _build_story_row(story_id: str) -> dict:
    raw = MICROGRAM_STORY_CATALOG.get(story_id)
    if raw is None:
        raise KeyError(f"Unknown story_id: {story_id!r}")

    author_id = raw["author_id"]
    resolved = _resolve_user(author_id)

    return {
        "id": story_id,
        "authorId": author_id,
        "authorName": resolved["name"],
        "authorAvatarUrl": resolved["avatarUrl"],
        "mediaUrl": raw["media_url"],
        "mediaType": raw["media_type"],
        "order": raw["order"],
    }


def _init_story_state(story_id: str) -> dict:
    return {"isViewed": False}


def _build_activity_row(activity_id: str) -> dict:
    raw = MICROGRAM_ACTIVITY_CATALOG.get(activity_id)
    if raw is None:
        raise KeyError(f"Unknown activity_id: {activity_id!r}")

    actor_id = raw["actor_id"]
    resolved = _resolve_user(actor_id)

    return {
        "id": activity_id,
        "type": raw["type"],
        "actorId": actor_id,
        "actorName": resolved["name"],
        "actorAvatarUrl": resolved["avatarUrl"],
        "targetPostId": raw.get("target_post_id"),
        "text": raw.get("text"),
        "order": raw["order"],
    }


def _build_message_row(message_id: str) -> dict:
    raw = MICROGRAM_MESSAGE_CATALOG.get(message_id)
    if raw is None:
        raise KeyError(f"Unknown message_id: {message_id!r}")
    row = dict(raw)
    # Resolve participantIds to participants with name/avatar
    if "participantIds" in row:
        row["participants"] = [
            {"id": uid, **_resolve_user(uid)} for uid in row["participantIds"]
        ]
    # Resolve senders in individual messages
    if "messages" in row:
        for msg in row["messages"]:
            sid = msg.get("senderId", "")
            if sid:
                resolved = _resolve_user(sid)
                msg["senderName"] = resolved["name"]
    return row


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_current_metrics(session: Session) -> dict:
    liked_count = sum(
        1 for s in session.microgram_post_states.values()
        if s.get("isLiked", False)
    )

    saved_count = sum(
        1 for s in session.microgram_post_states.values()
        if s.get("isSaved", False)
    )

    comment_count = len(session.microgram_user_created_comments)

    followed_count = len(session.microgram_followed_users)

    story_viewed_count = sum(
        1 for s in session.microgram_story_states.values()
        if s.get("isViewed", False)
    )

    post_count = len(session.microgram_posts)
    story_count = len(session.microgram_stories)

    return {
        "liked_count": liked_count,
        "saved_count": saved_count,
        "comment_count": comment_count,
        "followed_count": followed_count,
        "story_viewed_count": story_viewed_count,
        "post_count": post_count,
        "story_count": story_count,
    }


# ---------------------------------------------------------------------------
# Event processing
# ---------------------------------------------------------------------------

def process_event(session: Session, event: dict) -> None:
    etype = event["type"]

    if etype == "preload_posts":
        payload = event.get("payload", {})

        # Load posts
        for post_id in payload.get("post_ids", []):
            row = _build_post_row(post_id)
            session.microgram_posts.append(row)
            session.microgram_post_states[post_id] = _init_post_state(post_id)

        # Load stories
        for story_id in payload.get("story_ids", []):
            row = _build_story_row(story_id)
            session.microgram_stories.append(row)
            session.microgram_story_states[story_id] = _init_story_state(story_id)

        # Load DM conversations
        for msg_id in payload.get("message_ids", []):
            row = _build_message_row(msg_id)
            session.microgram_messages.append(row)

        # Load activity
        for act_id in payload.get("activity_ids", []):
            row = _build_activity_row(act_id)
            session.microgram_activity.append(row)

        # Pre-liked posts
        for post_id in payload.get("liked_post_ids", []):
            if post_id in session.microgram_post_states:
                session.microgram_post_states[post_id]["isLiked"] = True

        # Pre-saved posts
        for post_id in payload.get("saved_post_ids", []):
            if post_id in session.microgram_post_states:
                session.microgram_post_states[post_id]["isSaved"] = True

        # Pre-followed users
        for user_id in payload.get("followed_user_ids", []):
            session.microgram_followed_users.add(user_id)

        # Pre-viewed stories
        for story_id in payload.get("viewed_story_ids", []):
            if story_id in session.microgram_story_states:
                session.microgram_story_states[story_id]["isViewed"] = True

        # Capture baseline after preload
        session.baseline_metrics = compute_current_metrics(session)

    elif etype == "new_post":
        post_id = event.get("payload", {}).get("post_id")
        if post_id:
            row = _build_post_row(post_id)
            session.microgram_posts.append(row)
            session.microgram_post_states[post_id] = _init_post_state(post_id)

    elif etype == "new_story":
        story_id = event.get("payload", {}).get("story_id")
        if story_id:
            row = _build_story_row(story_id)
            session.microgram_stories.append(row)
            session.microgram_story_states[story_id] = _init_story_state(story_id)

    elif etype == "new_message":
        msg_id = event.get("payload", {}).get("message_id")
        if msg_id:
            row = _build_message_row(msg_id)
            session.microgram_messages.append(row)

    elif etype == "new_activity":
        act_id = event.get("payload", {}).get("activity_id")
        if act_id:
            row = _build_activity_row(act_id)
            session.microgram_activity.append(row)


# ---------------------------------------------------------------------------
# Bulk actions
# ---------------------------------------------------------------------------

def handle_action(session: Session, action_name: str) -> dict:
    if action_name == "unlike_all":
        for pid in session.microgram_post_states:
            session.microgram_post_states[pid]["isLiked"] = False

    elif action_name == "unsave_all":
        for pid in session.microgram_post_states:
            session.microgram_post_states[pid]["isSaved"] = False

    elif action_name == "unfollow_all":
        session.microgram_followed_users.clear()

    elif action_name == "delete_comments":
        session.microgram_user_created_comments.clear()

    elif action_name == "clear_story_history":
        for sid in session.microgram_story_states:
            session.microgram_story_states[sid]["isViewed"] = False

    else:
        return {"success": False, "error": f"Unknown action: {action_name}"}

    return {"success": True}


# ---------------------------------------------------------------------------
# Materialization for SQL-based evaluation
# ---------------------------------------------------------------------------

def materialize_to_sqlite(session: Session, conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE posts (id TEXT, authorId TEXT, caption TEXT, likes INT, isTargetPost INT)"
    )
    conn.executemany(
        "INSERT INTO posts VALUES (?,?,?,?,?)",
        [
            (p.get("id"), p.get("authorId"), p.get("caption"),
             int(p.get("likes", 0)), int(p.get("isTargetPost", False)))
            for p in session.microgram_posts
        ],
    )

    conn.execute("CREATE TABLE post_states (post_id TEXT, isLiked INT, isSaved INT)")
    conn.executemany(
        "INSERT INTO post_states VALUES (?,?,?)",
        [(pid, int(s.get("isLiked", False)), int(s.get("isSaved", False))) for pid, s in session.microgram_post_states.items()],
    )

    conn.execute("CREATE TABLE stories (id TEXT, authorId TEXT, mediaType TEXT)")
    conn.executemany(
        "INSERT INTO stories VALUES (?,?,?)",
        [(s.get("id"), s.get("authorId"), s.get("mediaType")) for s in session.microgram_stories],
    )

    conn.execute("CREATE TABLE story_states (story_id TEXT, isViewed INT)")
    conn.executemany(
        "INSERT INTO story_states VALUES (?,?)",
        [(sid, int(s.get("isViewed", False))) for sid, s in session.microgram_story_states.items()],
    )

    conn.execute("CREATE TABLE messages (id TEXT, data TEXT)")
    conn.executemany(
        "INSERT INTO messages VALUES (?,?)",
        [(m.get("id"), json.dumps(m)) for m in session.microgram_messages],
    )

    conn.execute("CREATE TABLE activity (id TEXT, type TEXT, actorId TEXT)")
    conn.executemany(
        "INSERT INTO activity VALUES (?,?,?)",
        [(a.get("id"), a.get("type"), a.get("actorId")) for a in session.microgram_activity],
    )

    conn.execute("CREATE TABLE followed_users (user_id TEXT)")
    conn.executemany(
        "INSERT INTO followed_users VALUES (?)",
        [(uid,) for uid in session.microgram_followed_users],
    )

    conn.execute("CREATE TABLE user_created_comments (id TEXT, post_id TEXT, text TEXT)")
    conn.executemany(
        "INSERT INTO user_created_comments VALUES (?,?,?)",
        [(c.get("id"), c.get("post_id"), c.get("text")) for c in session.microgram_user_created_comments],
    )
