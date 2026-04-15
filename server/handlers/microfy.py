# handler for the microfy (music streaming) environment.
# reads immutable track/playlist/artist data from catalogs.py, mutable state from session.py.
# provides functions for listing tracks, playlists, moods, artists, and creating playlists.
#
# flow: server.py route -> microfy handler -> reads MICROFY_*_CATALOG + session -> returns data
# example: GET /microfy/tracks -> get_tracks() -> merges catalog data + session track_states (isLiked, playCount)

from __future__ import annotations

import json
import sqlite3
from typing import TYPE_CHECKING

from server.catalogs import (
    MICROFY_MOOD_CATALOG,
    MICROFY_PLAYLIST_CATALOG,
    MICROFY_TRACK_CATALOG,
)

if TYPE_CHECKING:
    from server.session import Session


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_track_row(track_id: str) -> dict:
    raw = MICROFY_TRACK_CATALOG.get(track_id)
    if raw is None:
        raise KeyError(f"Unknown track_id: {track_id!r}")

    return {
        "id": track_id,
        "title": raw["title"],
        "artistId": raw["artist_id"],
        "artistName": raw["artist_name"],
        "albumName": raw.get("album_name", ""),
        "duration": raw.get("duration", "0:00"),
        "durationSeconds": raw.get("duration_seconds", 0),
        "description": raw.get("description", ""),
        "coverUrl": f"images/microfy/tracks/{track_id}.webp",
        "coverColor": raw.get("cover_color", "#333"),
        "coverInitials": raw.get("cover_initials", ""),
        "genre": raw.get("genre", ""),
        "lyrics": raw.get("lyrics", ""),
        "playCount": raw.get("play_count", 0),
        "isNewRelease": raw.get("is_new_release", False),
        "order": raw.get("order", 0),
    }


def _init_track_state(track_id: str) -> dict:
    return {"isLiked": False, "userPlayCount": 0}


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_current_metrics(session: Session) -> dict:
    liked_count = sum(
        1 for s in session.microfy_track_states.values()
        if s.get("isLiked", False)
    )

    total_user_plays = sum(
        s.get("userPlayCount", 0) for s in session.microfy_track_states.values()
    )

    new_release_count = sum(
        1 for t in session.microfy_tracks
        if t.get("isNewRelease", False)
    )

    playlist_count = len(session.microfy_user_created_playlists)

    followed_artist_count = len(session.microfy_followed_artists)

    track_count = len(session.microfy_tracks)

    return {
        "liked_count": liked_count,
        "play_count": total_user_plays,
        "new_release_count": new_release_count,
        "playlist_count": playlist_count,
        "followed_artist_count": followed_artist_count,
        "track_count": track_count,
    }


# ---------------------------------------------------------------------------
# Event processing
# ---------------------------------------------------------------------------

def process_event(session: Session, event: dict) -> None:
    etype = event["type"]

    if etype == "preload_tracks":
        payload = event.get("payload", {})

        # Load tracks
        track_ids = payload.get("track_ids", [])
        if track_ids == ["*"]:
            track_ids = list(MICROFY_TRACK_CATALOG.keys())
        for track_id in track_ids:
            row = _build_track_row(track_id)
            session.microfy_tracks.append(row)
            session.microfy_track_states[track_id] = _init_track_state(track_id)

        # Load playlists (catalog playlists, not user-created)
        playlist_ids = payload.get("playlist_ids", [])
        if playlist_ids == ["*"]:
            playlist_ids = list(MICROFY_PLAYLIST_CATALOG.keys())
        for playlist_id in playlist_ids:
            pl = MICROFY_PLAYLIST_CATALOG.get(playlist_id)
            if pl:
                session.microfy_playlists.append(dict(pl))

        # Load moods
        mood_ids = payload.get("mood_ids", [])
        if mood_ids == ["*"]:
            mood_ids = list(MICROFY_MOOD_CATALOG.keys())
        for mood_id in mood_ids:
            mood = MICROFY_MOOD_CATALOG.get(mood_id)
            if mood:
                session.microfy_moods.append(dict(mood))

        # Pre-liked tracks
        for track_id in payload.get("liked_track_ids", []):
            if track_id in session.microfy_track_states:
                session.microfy_track_states[track_id]["isLiked"] = True

        # Pre-followed artists
        for artist_id in payload.get("followed_artist_ids", []):
            session.microfy_followed_artists.add(artist_id)

        # Capture baseline after preload
        session.baseline_metrics = compute_current_metrics(session)

    elif etype == "new_track":
        track_id = event.get("payload", {}).get("track_id")
        if track_id:
            row = _build_track_row(track_id)
            session.microfy_tracks.append(row)
            session.microfy_track_states[track_id] = _init_track_state(track_id)

    elif etype == "new_playlist":
        playlist_id = event.get("payload", {}).get("playlist_id")
        if playlist_id:
            pl = MICROFY_PLAYLIST_CATALOG.get(playlist_id)
            if pl:
                session.microfy_playlists.append(dict(pl))


# ---------------------------------------------------------------------------
# Bulk actions
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Materialization for SQL-based evaluation
# ---------------------------------------------------------------------------

def materialize_to_sqlite(session: Session, conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE tracks (id TEXT, title TEXT, artistId TEXT, artistName TEXT, genre TEXT, isNewRelease INT)"
    )
    conn.executemany(
        "INSERT INTO tracks VALUES (?,?,?,?,?,?)",
        [
            (t.get("id"), t.get("title"), t.get("artistId"), t.get("artistName"),
             t.get("genre"), int(t.get("isNewRelease", False)))
            for t in session.microfy_tracks
        ],
    )

    conn.execute("CREATE TABLE track_states (track_id TEXT, isLiked INT, userPlayCount INT)")
    conn.executemany(
        "INSERT INTO track_states VALUES (?,?,?)",
        [(tid, int(s.get("isLiked", False)), int(s.get("userPlayCount", 0))) for tid, s in session.microfy_track_states.items()],
    )

    conn.execute("CREATE TABLE playlists (id TEXT, name TEXT, data TEXT)")
    conn.executemany(
        "INSERT INTO playlists VALUES (?,?,?)",
        [(p.get("id"), p.get("name"), json.dumps(p)) for p in session.microfy_playlists],
    )

    conn.execute("CREATE TABLE user_created_playlists (id TEXT, name TEXT, data TEXT)")
    conn.executemany(
        "INSERT INTO user_created_playlists VALUES (?,?,?)",
        [(p.get("id"), p.get("name"), json.dumps(p)) for p in session.microfy_user_created_playlists],
    )

    conn.execute("CREATE TABLE followed_artists (artist_id TEXT)")
    conn.executemany(
        "INSERT INTO followed_artists VALUES (?)",
        [(aid,) for aid in session.microfy_followed_artists],
    )

    conn.execute("CREATE TABLE moods (id TEXT, name TEXT)")
    conn.executemany(
        "INSERT INTO moods VALUES (?,?)",
        [(m.get("id"), m.get("name")) for m in session.microfy_moods],
    )
