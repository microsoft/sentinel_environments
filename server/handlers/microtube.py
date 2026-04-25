# handler for the microtube (video platform) environment.
# reads immutable video/channel/comment data from catalogs.py, mutable state from session.py.
# provides functions for listing videos, channels, comments, playlists, and subscribing/liking.
#
# flow: server.py route -> microtube handler -> reads MICROTUBE_*_CATALOG + session -> returns data
# example: POST /microtube/videos/{id}/like -> toggle_like() -> session.microtube_video_states[id]["isLiked"]

from __future__ import annotations

import json
import sqlite3
from typing import TYPE_CHECKING

from server.catalogs import (
    MICROTUBE_CHANNEL_CATALOG,
    MICROTUBE_COMMENT_CATALOG,
    MICROTUBE_NOTIFICATION_CATALOG,
    MICROTUBE_VIDEO_CATALOG,
    USER_CATALOG,
)

if TYPE_CHECKING:
    from server.session import Session


# ---------------------------------------------------------------------------
# Row builders
# ---------------------------------------------------------------------------

def _resolve_channel_raw(channel_id: str) -> dict:
    # Returns the catalog channel record with self-channel placeholder fields
    # (name/handle/avatar/banner) replaced by the active self user's identity.
    raw = MICROTUBE_CHANNEL_CATALOG.get(channel_id)
    if raw is None or not raw.get("is_self"):
        return raw or {}
    self_user = next((u for u in USER_CATALOG.values() if u.get("isSelf")), {})
    username = self_user.get("username")
    return {
        **raw,
        "name": self_user.get("name") or raw.get("name", ""),
        "handle": f"@{username}" if username else raw.get("handle", ""),
        "avatar_src": self_user.get("avatarUrl") or raw.get("avatar_src", ""),
        "banner_src": self_user.get("bannerUrl") or raw.get("banner_src", ""),
    }


def _build_video_row(video_id: str) -> dict:
    raw = MICROTUBE_VIDEO_CATALOG.get(video_id)
    if raw is None:
        raise KeyError(f"Unknown video_id: {video_id!r}")

    ch = _resolve_channel_raw(raw["channel_id"])
    return {
        "id": raw["id"],
        "channel_id": raw["channel_id"],
        "title": raw["title"],
        "description": raw["description"],
        "views": raw["views"],
        "likes": raw["likes"],
        "dislikes": raw["dislikes"],
        "comments": raw["comments"],
        "duration": raw["duration"],
        "thumbnailColor": raw["thumbnail_color"],
        "thumbnailSrc": raw["thumbnail_src"],
        "videoSrc": raw["video_src"],
        "publishedAt": raw["published_at"],
        "isLive": bool(raw["is_live"]),
        "isShort": bool(raw["is_short"]),
        "channelName": ch.get("name", ""),
        "channelHandle": ch.get("handle", ""),
        "channelAvatarColor": ch.get("avatar_color", "#333"),
        "channelAvatarSrc": ch.get("avatar_src", ""),
        "channelIsVerified": bool(ch.get("is_verified", False)),
        "channelSubscribers": ch.get("subscribers", 0),
        "task": raw["task"],
        "order": raw["order"],
    }


def _build_channel_row(channel_id: str) -> dict:
    if channel_id not in MICROTUBE_CHANNEL_CATALOG:
        raise KeyError(f"Unknown channel_id: {channel_id!r}")
    raw = _resolve_channel_raw(channel_id)

    return {
        "id": raw["id"],
        "name": raw["name"],
        "handle": raw["handle"],
        "subscribers": raw["subscribers"],
        "videos": raw["videos"],
        "description": raw["description"],
        "avatarColor": raw["avatar_color"],
        "avatarSrc": raw["avatar_src"],
        "bannerSrc": raw["banner_src"],
        "isVerified": bool(raw["is_verified"]),
        "isSelf": bool(raw["is_self"]),
    }


def _build_comment_row(comment_id: str) -> dict:
    raw = MICROTUBE_COMMENT_CATALOG.get(comment_id)
    if raw is None:
        raise KeyError(f"Unknown comment_id: {comment_id!r}")

    user = USER_CATALOG.get(raw["user_id"], {})
    return {
        "id": raw["id"],
        "video_id": raw["video_id"],
        "user_id": raw["user_id"],
        "content": raw["content"],
        "likes": raw["likes"],
        "replies": raw["replies"],
        "userName": user.get("name", "Unknown User"),
        "userAvatar": user.get("avatarUrl", ""),
        "task": raw["task"],
        "order": raw["order"],
    }


def _build_notification_row(notif_id: str) -> dict:
    raw = MICROTUBE_NOTIFICATION_CATALOG.get(notif_id)
    if raw is None:
        raise KeyError(f"Unknown notification_id: {notif_id!r}")

    ch = _resolve_channel_raw(raw.get("channel_id", ""))
    return {
        "id": raw["id"],
        "type": raw["type"],
        "channel_id": raw.get("channel_id", ""),
        "video_id": raw.get("video_id", ""),
        "message": raw["message"],
        "isRead": bool(raw["is_read"]),
        "channelName": ch.get("name", ""),
        "channelAvatarSrc": ch.get("avatar_src", ""),
        "task": raw["task"],
        "order": raw["order"],
    }


def _init_video_state() -> dict:
    return {"isLiked": False, "isDisliked": False, "isSaved": False}


def _init_channel_state() -> dict:
    return {"isSubscribed": False}


def _init_notification_state(raw: dict) -> dict:
    return {"isDismissed": False, "isRead": bool(raw.get("is_read", False))}


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_current_metrics(session: Session) -> dict:
    channel_states = session.microtube_channel_states
    video_states = session.microtube_video_states
    notif_states = session.microtube_notification_states

    subscribed_count = sum(
        1 for s in channel_states.values() if s.get("isSubscribed")
    )
    liked_count = sum(
        1 for s in video_states.values() if s.get("isLiked")
    )
    watched_count = len(session.microtube_watched_videos)
    comment_count = len(session.microtube_comments) + len(session.microtube_user_created_comments)
    notification_count = sum(
        1
        for n in session.microtube_notifications
        if not notif_states.get(n["id"], {}).get("isDismissed", False)
    )

    return {
        "subscribed_count": subscribed_count,
        "liked_count": liked_count,
        "watched_count": watched_count,
        "comment_count": comment_count,
        "notification_count": notification_count,
        "playlist_count": len(session.microtube_user_created_playlists),
    }


# ---------------------------------------------------------------------------
# Event processing
# ---------------------------------------------------------------------------

def process_event(session: Session, event: dict) -> None:
    etype = event["type"]

    if etype == "preload_videos":
        payload = event.get("payload", {})

        # Load videos
        video_ids = payload.get("video_ids", [])
        if video_ids == ["*"]:
            video_ids = list(MICROTUBE_VIDEO_CATALOG.keys())
        for vid in video_ids:
            row = _build_video_row(vid)
            session.microtube_videos.append(row)
            session.microtube_video_states[vid] = _init_video_state()

        # Load channels
        channel_ids = payload.get("channel_ids", [])
        if channel_ids == ["*"]:
            channel_ids = list(MICROTUBE_CHANNEL_CATALOG.keys())
        for cid in channel_ids:
            row = _build_channel_row(cid)
            session.microtube_channels.append(row)
            session.microtube_channel_states[cid] = _init_channel_state()

        # Pre-subscribed channels
        for cid in payload.get("subscribed_channel_ids", []):
            if cid not in session.microtube_channel_states:
                row = _build_channel_row(cid)
                session.microtube_channels.append(row)
                session.microtube_channel_states[cid] = _init_channel_state()
            session.microtube_channel_states[cid]["isSubscribed"] = True

        # Load comments
        comment_ids = payload.get("comment_ids", [])
        if comment_ids == ["*"]:
            comment_ids = list(MICROTUBE_COMMENT_CATALOG.keys())
        for cmid in comment_ids:
            row = _build_comment_row(cmid)
            session.microtube_comments.append(row)

        # Load notifications
        notif_ids = payload.get("notification_ids", [])
        if notif_ids == ["*"]:
            notif_ids = list(MICROTUBE_NOTIFICATION_CATALOG.keys())
        for nid in notif_ids:
            row = _build_notification_row(nid)
            session.microtube_notifications.append(row)
            session.microtube_notification_states[nid] = _init_notification_state(
                MICROTUBE_NOTIFICATION_CATALOG.get(nid, {})
            )

        # Pre-watched videos
        for vid in payload.get("watched_video_ids", []):
            if vid not in session.microtube_video_states:
                row = _build_video_row(vid)
                session.microtube_videos.append(row)
                session.microtube_video_states[vid] = _init_video_state()
                cid = row["channel_id"]
                if cid not in session.microtube_channel_states:
                    channel_row = _build_channel_row(cid)
                    session.microtube_channels.append(channel_row)
                    session.microtube_channel_states[cid] = _init_channel_state()
            session.microtube_watched_videos.add(vid)

        # Capture baseline after preload
        session.baseline_metrics = compute_current_metrics(session)

    elif etype == "new_video":
        video_id = event.get("payload", {}).get("video_id")
        if video_id and video_id not in session.microtube_video_states:
            row = _build_video_row(video_id)
            session.microtube_videos.append(row)
            session.microtube_video_states[video_id] = _init_video_state()

    elif etype == "new_comment":
        comment_id = event.get("payload", {}).get("comment_id")
        if comment_id:
            row = _build_comment_row(comment_id)
            session.microtube_comments.append(row)

    elif etype == "new_notification":
        notif_id = event.get("payload", {}).get("notification_id")
        if notif_id and notif_id not in session.microtube_notification_states:
            row = _build_notification_row(notif_id)
            session.microtube_notifications.append(row)
            session.microtube_notification_states[notif_id] = _init_notification_state(
                MICROTUBE_NOTIFICATION_CATALOG.get(notif_id, {})
            )


# ---------------------------------------------------------------------------
# Bulk actions
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Materialization for SQL-based evaluation
# ---------------------------------------------------------------------------

def materialize_to_sqlite(session: Session, conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE videos (id TEXT, channel_id TEXT, title TEXT, views INT, likes INT, isLive INT, isShort INT)"
    )
    conn.executemany(
        "INSERT INTO videos VALUES (?,?,?,?,?,?,?)",
        [
            (v.get("id"), v.get("channel_id"), v.get("title"),
             int(v.get("views", 0)), int(v.get("likes", 0)),
             int(v.get("isLive", False)), int(v.get("isShort", False)))
            for v in session.microtube_videos
        ],
    )

    conn.execute("CREATE TABLE video_states (video_id TEXT, isLiked INT, isDisliked INT, isSaved INT)")
    conn.executemany(
        "INSERT INTO video_states VALUES (?,?,?,?)",
        [
            (vid, int(s.get("isLiked", False)), int(s.get("isDisliked", False)), int(s.get("isSaved", False)))
            for vid, s in session.microtube_video_states.items()
        ],
    )

    conn.execute(
        "CREATE TABLE channels (id TEXT, name TEXT, handle TEXT, subscribers INT, isVerified INT)"
    )
    conn.executemany(
        "INSERT INTO channels VALUES (?,?,?,?,?)",
        [
            (c.get("id"), c.get("name"), c.get("handle"),
             int(c.get("subscribers", 0)), int(c.get("isVerified", False)))
            for c in session.microtube_channels
        ],
    )

    conn.execute("CREATE TABLE channel_states (channel_id TEXT, isSubscribed INT)")
    conn.executemany(
        "INSERT INTO channel_states VALUES (?,?)",
        [(cid, int(s.get("isSubscribed", False))) for cid, s in session.microtube_channel_states.items()],
    )

    conn.execute("CREATE TABLE comments (id TEXT, video_id TEXT, user_id TEXT, content TEXT, likes INT)")
    conn.executemany(
        "INSERT INTO comments VALUES (?,?,?,?,?)",
        [
            (c.get("id"), c.get("video_id"), c.get("user_id"), c.get("content"), int(c.get("likes", 0)))
            for c in session.microtube_comments
        ],
    )

    conn.execute("CREATE TABLE notifications (id TEXT, type TEXT, channel_id TEXT, message TEXT)")
    conn.executemany(
        "INSERT INTO notifications VALUES (?,?,?,?)",
        [(n.get("id"), n.get("type"), n.get("channel_id"), n.get("message")) for n in session.microtube_notifications],
    )

    conn.execute("CREATE TABLE notification_states (notification_id TEXT, isDismissed INT, isRead INT)")
    conn.executemany(
        "INSERT INTO notification_states VALUES (?,?,?)",
        [
            (nid, int(s.get("isDismissed", False)), int(s.get("isRead", False)))
            for nid, s in session.microtube_notification_states.items()
        ],
    )

    conn.execute("CREATE TABLE user_created_comments (id TEXT, video_id TEXT, content TEXT)")
    conn.executemany(
        "INSERT INTO user_created_comments VALUES (?,?,?)",
        [(c.get("id"), c.get("video_id"), c.get("content")) for c in session.microtube_user_created_comments],
    )

    conn.execute("CREATE TABLE user_created_playlists (id TEXT, name TEXT, data TEXT)")
    conn.executemany(
        "INSERT INTO user_created_playlists VALUES (?,?,?)",
        [(p.get("id"), p.get("name"), json.dumps(p)) for p in session.microtube_user_created_playlists],
    )

    conn.execute("CREATE TABLE watched_videos (video_id TEXT)")
    conn.executemany(
        "INSERT INTO watched_videos VALUES (?)",
        [(vid,) for vid in session.microtube_watched_videos],
    )
