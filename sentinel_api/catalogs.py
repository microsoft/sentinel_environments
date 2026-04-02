# loads all sqlite databases into in-memory python dicts at server startup.
# these catalogs are read-only lookup tables — they never change during a simulation.
# handlers read from catalogs to build api responses (e.g. look up email sender info).
#
# flow: build_db.py creates .db files -> catalogs.py loads them into dicts -> handlers read from dicts
# example: micromail.db -> MICROMAIL_EMAIL_CATALOG / MICROMAIL_ATTACHMENT_CATALOG -> micromail handler
# example: shared.db -> USER_CATALOG -> any handler that needs user names/avatars
#
# mutable per-session state lives in session.py, not here.

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

_MICROMAIL_DB = Path(__file__).parent / "micromail" / "micromail.db"
_MICROCHAT_DB = Path(__file__).parent / "microchat" / "microchat.db"
_MICRODIN_DB = Path(__file__).parent / "microdin" / "microdin.db"
_MICROFY_DB = Path(__file__).parent / "microfy" / "microfy.db"
_MICROGRAM_DB = Path(__file__).parent / "microgram" / "microgram.db"
_MICROHOOD_DB = Path(__file__).parent / "microhood" / "microhood.db"
_MICROHUB_DB = Path(__file__).parent / "microhub" / "microhub.db"
_MICROLENDAR_DB = Path(__file__).parent / "microlendar" / "microlendar.db"
_MICROSCHOLAR_DB = Path(__file__).parent / "microscholar" / "microscholar.db"
_MICROTUBE_DB = Path(__file__).parent / "microtube" / "microtube.db"
_SHARED_DB = Path(__file__).parent / "shared.db"

# MicroMail catalogs
MICROMAIL_EMAIL_CATALOG: dict[str, dict] = {}
MICROMAIL_ATTACHMENT_CATALOG: dict[str, list[dict]] = {}  # email_id → list of attachments

# MicroChat catalogs
MICROCHAT_MESSAGE_CATALOG: dict[str, dict] = {}       # message_id → message row
MICROCHAT_TEAM_CATALOG: dict[str, dict] = {}          # team_id → team data
MICROCHAT_CONVERSATION_CATALOG: dict[str, dict] = {}  # conversation_id → conversation data
MICROCHAT_CALL_CATALOG: dict[str, dict] = {}          # call_id → call data

# MicroDin catalogs
MICRODIN_POST_CATALOG: dict[str, dict] = {}              # post_id → post row
MICRODIN_CONNECTION_CATALOG: dict[str, dict] = {}         # connection_id → connection row
MICRODIN_CONVERSATION_CATALOG: dict[str, dict] = {}       # conversation_id → conversation data
MICRODIN_MESSAGE_CATALOG: dict[str, dict] = {}            # message_id → message row
MICRODIN_NOTIFICATION_CATALOG: dict[str, dict] = {}       # notification_id → notification row
MICRODIN_JOB_CATALOG: dict[str, dict] = {}                # job_id → job row
MICRODIN_COMPANY_CATALOG: dict[str, dict] = {}            # company_id → company data

# MicroFy catalogs
MICROFY_TRACK_CATALOG: dict[str, dict] = {}              # track_id → track row
MICROFY_PLAYLIST_CATALOG: dict[str, dict] = {}           # playlist_id → playlist data
MICROFY_MOOD_CATALOG: dict[str, dict] = {}               # mood_id → mood data
MICROFY_ARTIST_CATALOG: dict[str, dict] = {}             # artist_id → {id, entityId, name}

# MicroGram catalogs
MICROGRAM_POST_CATALOG: dict[str, dict] = {}            # post_id → post row
MICROGRAM_STORY_CATALOG: dict[str, dict] = {}           # story_id → story row
MICROGRAM_MESSAGE_CATALOG: dict[str, dict] = {}         # dm_id → DM conversation data (JSON blob)
MICROGRAM_ACTIVITY_CATALOG: dict[str, dict] = {}        # activity_id → activity row

# MicroHood catalogs
MICROHOOD_STOCK_CATALOG: dict[str, dict] = {}           # symbol → stock row
MICROHOOD_TRACE_CATALOG: dict[str, list[float]] = {}    # symbol → [11 price points]
MICROHOOD_WATCHLIST_CATALOG: dict[str, dict] = {}       # symbol → watchlist item
MICROHOOD_NEWS_CATALOG: dict[str, dict] = {}            # id → news row

# MicroHub catalogs
MICROHUB_REPOSITORY_CATALOG: dict[str, dict] = {}       # id → repo data (JSON blob)
MICROHUB_FILE_CATALOG: dict[str, dict] = {}             # id → file row
MICROHUB_ISSUE_CATALOG: dict[str, dict] = {}            # id → issue row
MICROHUB_PR_CATALOG: dict[str, dict] = {}               # id → PR row
MICROHUB_COMMIT_CATALOG: dict[str, dict] = {}           # id → commit row
MICROHUB_WORKFLOW_RUN_CATALOG: dict[str, dict] = {}     # id → workflow run row
MICROHUB_WORKFLOW_CATALOG: dict[str, dict] = {}         # id → workflow row
MICROHUB_WIKI_CATALOG: dict[str, dict] = {}             # id → wiki page row
MICROHUB_PROJECT_CATALOG: dict[str, dict] = {}          # id → project row
MICROHUB_ACTIVITY_CATALOG: dict[str, dict] = {}         # id → activity row
MICROHUB_INSIGHT_CATALOG: dict[str, dict] = {}          # type → insight data
MICROHUB_RELEASE_CATALOG: dict[str, dict] = {}          # id → release row
MICROHUB_LABEL_CATALOG: dict[str, dict] = {}            # id → label row
MICROHUB_SECURITY_CATALOG: dict[str, dict] = {}         # id → security advisory row
MICROHUB_CODE_SCANNING_CATALOG: dict[str, dict] = {}    # id → code scanning row
MICROHUB_SETTINGS_CATALOG: dict[str, dict] = {}         # id → settings data (JSON blob)
MICROHUB_DEPLOYMENT_CATALOG: dict[str, dict] = {}       # id → deployment row
MICROHUB_PACKAGE_CATALOG: dict[str, dict] = {}          # id → package row

# MicroLendar catalogs
MICROLENDAR_EVENT_CATALOG: dict[str, dict] = {}         # id → event/task row

# MicroScholar catalogs
MICROSCHOLAR_PAPER_CATALOG: dict[str, dict] = {}        # paper_id → paper row
MICROSCHOLAR_ALERT_CATALOG: dict[str, dict] = {}        # alert_id → alert row
MICROSCHOLAR_COAUTHOR_CATALOG: dict[str, dict] = {}     # "aid1|aid2" → coauthor row

# MicroTube catalogs
MICROTUBE_VIDEO_CATALOG: dict[str, dict] = {}           # video_id → video row
MICROTUBE_CHANNEL_CATALOG: dict[str, dict] = {}         # channel_id → channel row
MICROTUBE_COMMENT_CATALOG: dict[str, dict] = {}         # comment_id → comment row
MICROTUBE_NOTIFICATION_CATALOG: dict[str, dict] = {}    # notif_id → notification row

# Shared catalogs
USER_CATALOG: dict[str, dict] = {}


def load_catalogs() -> None:
    _load_micromail_catalogs()
    _load_microchat_catalogs()
    _load_microdin_catalogs()
    _load_microfy_catalogs()
    _load_microgram_catalogs()
    _load_microhood_catalogs()
    _load_microhub_catalogs()
    _load_microlendar_catalogs()
    _load_microscholar_catalogs()
    _load_microtube_catalogs()
    _load_shared_catalogs()


def _load_micromail_catalogs() -> None:
    if not _MICROMAIL_DB.exists():
        return
    conn = sqlite3.connect(_MICROMAIL_DB)
    conn.row_factory = sqlite3.Row

    for row in conn.execute("SELECT * FROM emails"):
        d = dict(row)
        d["cc"] = json.loads(d["cc"])
        d["recipients"] = json.loads(d["recipients"])
        for key in ("hasAttachment", "isExternal", "mentionsMe", "isCC", "isRead", "isFlagged"):
            d[key] = bool(d[key])
        MICROMAIL_EMAIL_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM attachments"):
        d = dict(row)
        MICROMAIL_ATTACHMENT_CATALOG.setdefault(d["email_id"], []).append(d)
    conn.close()


def _load_microchat_catalogs() -> None:
    if not _MICROCHAT_DB.exists():
        return
    conn = sqlite3.connect(_MICROCHAT_DB)
    conn.row_factory = sqlite3.Row

    for row in conn.execute("SELECT id, data FROM teams"):
        MICROCHAT_TEAM_CATALOG[row["id"]] = json.loads(row["data"])

    for row in conn.execute("SELECT id, data FROM conversations"):
        MICROCHAT_CONVERSATION_CATALOG[row["id"]] = json.loads(row["data"])

    for row in conn.execute("SELECT * FROM messages"):
        d = dict(row)
        d["is_read"] = bool(d["is_read"])
        d["is_urgent"] = bool(d["is_urgent"])
        d["mentions_me"] = bool(d["mentions_me"])
        d["has_attachment"] = bool(d["has_attachment"])
        MICROCHAT_MESSAGE_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT id, data FROM calls"):
        MICROCHAT_CALL_CATALOG[row["id"]] = json.loads(row["data"])

    conn.close()


def _load_microdin_catalogs() -> None:
    if not _MICRODIN_DB.exists():
        return
    conn = sqlite3.connect(_MICRODIN_DB)
    conn.row_factory = sqlite3.Row

    for row in conn.execute("SELECT * FROM posts"):
        d = dict(row)
        d["comments"] = json.loads(d["comments"])
        MICRODIN_POST_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM connections"):
        d = dict(row)
        MICRODIN_CONNECTION_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT id, data FROM din_conversations"):
        MICRODIN_CONVERSATION_CATALOG[row["id"]] = json.loads(row["data"])

    for row in conn.execute("SELECT * FROM din_messages"):
        d = dict(row)
        d["is_read"] = bool(d["is_read"])
        MICRODIN_MESSAGE_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM notifications"):
        d = dict(row)
        d["is_read"] = bool(d["is_read"])
        MICRODIN_NOTIFICATION_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM jobs"):
        d = dict(row)
        d["requirements"] = json.loads(d["requirements"])
        MICRODIN_JOB_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT id, data FROM companies"):
        MICRODIN_COMPANY_CATALOG[row["id"]] = json.loads(row["data"])

    conn.close()


def _load_microfy_catalogs() -> None:
    if not _MICROFY_DB.exists():
        return
    conn = sqlite3.connect(_MICROFY_DB)
    conn.row_factory = sqlite3.Row

    for row in conn.execute("SELECT * FROM tracks"):
        d = dict(row)
        d["is_new_release"] = bool(d["is_new_release"])
        MICROFY_TRACK_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT id, data FROM playlists"):
        pl = json.loads(row["data"])
        pl["coverUrl"] = f"images/microfy/playlists-logos/{row['id']}.webp"
        MICROFY_PLAYLIST_CATALOG[row["id"]] = pl

    for row in conn.execute("SELECT id, data FROM moods"):
        MICROFY_MOOD_CATALOG[row["id"]] = json.loads(row["data"])

    for row in conn.execute("SELECT * FROM artists"):
        d = dict(row)
        eid = d["entity_id"]
        MICROFY_ARTIST_CATALOG[d["id"]] = {
            "id": d["id"],
            "entityId": eid,
            "name": d["name"],
            "imageUrl": f"images/microfy/band-logos/{eid}.webp",
            "bannerUrl": f"images/microfy/band-banners/{eid}_banner.webp",
        }

    conn.close()


def _load_microgram_catalogs() -> None:
    if not _MICROGRAM_DB.exists():
        return
    conn = sqlite3.connect(_MICROGRAM_DB)
    conn.row_factory = sqlite3.Row

    for row in conn.execute("SELECT * FROM posts"):
        d = dict(row)
        d["comments"] = json.loads(d["comments"])
        d["is_target_post"] = bool(d["is_target_post"])
        MICROGRAM_POST_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM stories"):
        d = dict(row)
        MICROGRAM_STORY_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT id, data FROM messages"):
        MICROGRAM_MESSAGE_CATALOG[row["id"]] = json.loads(row["data"])

    for row in conn.execute("SELECT * FROM activity"):
        d = dict(row)
        MICROGRAM_ACTIVITY_CATALOG[d["id"]] = d

    conn.close()


def _load_microhood_catalogs() -> None:
    if not _MICROHOOD_DB.exists():
        return
    conn = sqlite3.connect(_MICROHOOD_DB)
    conn.row_factory = sqlite3.Row

    for row in conn.execute("SELECT * FROM stocks"):
        d = dict(row)
        MICROHOOD_STOCK_CATALOG[d["symbol"]] = d

    for row in conn.execute("SELECT * FROM price_traces"):
        MICROHOOD_TRACE_CATALOG[row["symbol"]] = json.loads(row["trace_points"])

    for row in conn.execute("SELECT * FROM watchlist"):
        d = dict(row)
        MICROHOOD_WATCHLIST_CATALOG[d["symbol"]] = d

    for row in conn.execute("SELECT * FROM news"):
        d = dict(row)
        MICROHOOD_NEWS_CATALOG[d["id"]] = d

    conn.close()


def _load_microhub_catalogs() -> None:
    if not _MICROHUB_DB.exists():
        return
    conn = sqlite3.connect(_MICROHUB_DB)
    conn.row_factory = sqlite3.Row

    for row in conn.execute("SELECT id, data FROM repository"):
        MICROHUB_REPOSITORY_CATALOG[row["id"]] = json.loads(row["data"])

    for row in conn.execute("SELECT * FROM files ORDER BY \"order\""):
        d = dict(row)
        d["last_commit"] = json.loads(d["last_commit"])
        MICROHUB_FILE_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM issues ORDER BY \"order\""):
        d = dict(row)
        d["assignees"] = json.loads(d["assignees"])
        d["label_ids"] = json.loads(d["label_ids"])
        d["comments"] = json.loads(d["comments"])
        MICROHUB_ISSUE_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM pull_requests ORDER BY \"order\""):
        d = dict(row)
        d["assignees"] = json.loads(d["assignees"])
        d["reviewers"] = json.loads(d["reviewers"])
        d["label_ids"] = json.loads(d["label_ids"])
        d["checks"] = json.loads(d["checks"])
        d["comments"] = json.loads(d["comments"])
        MICROHUB_PR_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM commits ORDER BY \"order\""):
        d = dict(row)
        d["files_changed"] = json.loads(d["files_changed"])
        d["verified"] = bool(d["verified"])
        MICROHUB_COMMIT_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM workflow_runs ORDER BY \"order\""):
        d = dict(row)
        d["jobs"] = json.loads(d["jobs"])
        MICROHUB_WORKFLOW_RUN_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM workflows"):
        MICROHUB_WORKFLOW_CATALOG[row["id"]] = dict(row)

    for row in conn.execute("SELECT * FROM wiki_pages ORDER BY \"order\""):
        MICROHUB_WIKI_CATALOG[row["id"]] = dict(row)

    for row in conn.execute("SELECT * FROM projects ORDER BY \"order\""):
        d = dict(row)
        d["columns"] = json.loads(d["columns"])
        MICROHUB_PROJECT_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM activity ORDER BY \"order\""):
        d = dict(row)
        d["payload"] = json.loads(d["payload"])
        MICROHUB_ACTIVITY_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM insights"):
        d = dict(row)
        d["data"] = json.loads(d["data"])
        MICROHUB_INSIGHT_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM releases ORDER BY \"order\""):
        d = dict(row)
        d["is_latest"] = bool(d["is_latest"])
        d["is_prerelease"] = bool(d["is_prerelease"])
        d["assets"] = json.loads(d["assets"])
        MICROHUB_RELEASE_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM labels ORDER BY \"order\""):
        MICROHUB_LABEL_CATALOG[row["id"]] = dict(row)

    for row in conn.execute("SELECT * FROM security_advisories ORDER BY \"order\""):
        MICROHUB_SECURITY_CATALOG[row["id"]] = dict(row)

    for row in conn.execute("SELECT * FROM code_scanning ORDER BY \"order\""):
        MICROHUB_CODE_SCANNING_CATALOG[row["id"]] = dict(row)

    for row in conn.execute("SELECT id, data FROM settings"):
        MICROHUB_SETTINGS_CATALOG[row["id"]] = json.loads(row["data"])

    for row in conn.execute("SELECT * FROM deployments ORDER BY \"order\""):
        MICROHUB_DEPLOYMENT_CATALOG[row["id"]] = dict(row)

    for row in conn.execute("SELECT * FROM packages ORDER BY \"order\""):
        MICROHUB_PACKAGE_CATALOG[row["id"]] = dict(row)

    conn.close()


def _load_microlendar_catalogs() -> None:
    if not _MICROLENDAR_DB.exists():
        return
    conn = sqlite3.connect(_MICROLENDAR_DB)
    conn.row_factory = sqlite3.Row

    for row in conn.execute("SELECT * FROM events ORDER BY event_order"):
        d = dict(row)
        d["attendees"] = json.loads(d["attendees"])
        d["is_task"] = bool(d["is_task"])
        d["is_completed"] = bool(d["is_completed"])
        d["is_conflict"] = bool(d["is_conflict"])
        MICROLENDAR_EVENT_CATALOG[d["id"]] = d

    conn.close()


def _load_microscholar_catalogs() -> None:
    if not _MICROSCHOLAR_DB.exists():
        return
    conn = sqlite3.connect(_MICROSCHOLAR_DB)
    conn.row_factory = sqlite3.Row

    for row in conn.execute('SELECT * FROM papers ORDER BY "order"'):
        d = dict(row)
        d["author_ids"] = json.loads(d["author_ids"])
        d["is_book"] = bool(d["is_book"])
        d["is_target_paper"] = bool(d["is_target_paper"])
        MICROSCHOLAR_PAPER_CATALOG[d["id"]] = d

    for row in conn.execute('SELECT * FROM alerts ORDER BY "order"'):
        d = dict(row)
        d["is_read"] = bool(d["is_read"])
        MICROSCHOLAR_ALERT_CATALOG[d["id"]] = d

    for row in conn.execute('SELECT * FROM coauthors ORDER BY "order"'):
        d = dict(row)
        d["shared_papers"] = json.loads(d["shared_papers"])
        key = f"{d['author_id_1']}|{d['author_id_2']}"
        MICROSCHOLAR_COAUTHOR_CATALOG[key] = d

    conn.close()


def _load_microtube_catalogs() -> None:
    if not _MICROTUBE_DB.exists():
        return
    conn = sqlite3.connect(_MICROTUBE_DB)
    conn.row_factory = sqlite3.Row

    for row in conn.execute('SELECT * FROM videos ORDER BY "order"'):
        d = dict(row)
        d["is_live"] = bool(d["is_live"])
        d["is_short"] = bool(d["is_short"])
        MICROTUBE_VIDEO_CATALOG[d["id"]] = d

    for row in conn.execute("SELECT * FROM channels"):
        d = dict(row)
        d["is_verified"] = bool(d["is_verified"])
        d["is_self"] = bool(d["is_self"])
        MICROTUBE_CHANNEL_CATALOG[d["id"]] = d

    for row in conn.execute('SELECT * FROM comments ORDER BY "order"'):
        d = dict(row)
        MICROTUBE_COMMENT_CATALOG[d["id"]] = d

    for row in conn.execute('SELECT * FROM notifications ORDER BY "order"'):
        d = dict(row)
        d["is_read"] = bool(d["is_read"])
        MICROTUBE_NOTIFICATION_CATALOG[d["id"]] = d

    conn.close()


def _load_shared_catalogs() -> None:
    if not _SHARED_DB.exists():
        return
    conn = sqlite3.connect(_SHARED_DB)
    conn.row_factory = sqlite3.Row

    for row in conn.execute("SELECT id, data FROM users"):
        USER_CATALOG[row["id"]] = json.loads(row["data"])
    conn.close()
