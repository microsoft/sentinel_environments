# offline script that converts jsonl/json source data into sqlite databases.
# run this once before starting the server. each environment gets its own .db file,
# plus a shared.db for users and images.
#
# flow: data/catalogs/*.jsonl -> build_db.py -> server/<env>/<env>.db
# example: data/catalogs/micromail/emails.jsonl -> build_db.py -> server/micromail/micromail.db
# example: data/catalogs/users.json -> build_db.py -> server/shared.db
#
# catalogs.py then loads these .db files into memory at server startup.
from __future__ import annotations

import json
import mimetypes
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent          # repo root
DATA_DIR = ROOT / "data"
API_DIR = ROOT / "server"

MICROMAIL_DB = API_DIR / "micromail" / "micromail.db"
MICROCHAT_DB = API_DIR / "microchat" / "microchat.db"
MICRODIN_DB = API_DIR / "microdin" / "microdin.db"
MICROFY_DB = API_DIR / "microfy" / "microfy.db"
MICROGRAM_DB = API_DIR / "microgram" / "microgram.db"
MICROHOOD_DB = API_DIR / "microhood" / "microhood.db"
MICROHUB_DB = API_DIR / "microhub" / "microhub.db"
MICROLENDAR_DB = API_DIR / "microlendar" / "microlendar.db"
MICROSCHOLAR_DB = API_DIR / "microscholar" / "microscholar.db"
MICROTUBE_DB = API_DIR / "microtube" / "microtube.db"
SHARED_DB = API_DIR / "shared.db"

# ---------------------------------------------------------------------------
# micromail.db
# ---------------------------------------------------------------------------

MICROMAIL_EMAILS_DDL = """\
CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    hasAttachment INTEGER NOT NULL DEFAULT 0,
    isExternal INTEGER NOT NULL DEFAULT 0,
    importance TEXT NOT NULL DEFAULT 'normal',
    mentionsMe INTEGER NOT NULL DEFAULT 0,
    isCC INTEGER NOT NULL DEFAULT 0,
    isRead INTEGER NOT NULL DEFAULT 0,
    isFlagged INTEGER NOT NULL DEFAULT 0,
    folder TEXT,
    cc TEXT NOT NULL DEFAULT '[]',
    recipients TEXT NOT NULL DEFAULT '[]'
);
"""

MICROMAIL_ATTACHMENTS_DDL = """\
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    email_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size TEXT NOT NULL,
    FOREIGN KEY (email_id) REFERENCES emails(id)
);
"""


def _load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def build_micromail_db() -> None:
    MICROMAIL_DB.parent.mkdir(parents=True, exist_ok=True)
    if MICROMAIL_DB.exists():
        MICROMAIL_DB.unlink()

    conn = sqlite3.connect(MICROMAIL_DB)

    conn.execute(MICROMAIL_EMAILS_DDL)
    conn.execute(MICROMAIL_ATTACHMENTS_DDL)

    # --- Emails ---
    emails = _load_jsonl(DATA_DIR / "catalogs" / "micromail" / "emails.jsonl")
    for e in emails:
        conn.execute(
            """INSERT INTO emails
               (id, sender_id, subject, body, hasAttachment, isExternal,
                importance, mentionsMe, isCC, isRead, isFlagged, folder,
                cc, recipients)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                e["id"],
                e.get("sender_id", ""),
                e.get("subject", ""),
                e.get("body", ""),
                int(e.get("hasAttachment", False)),
                int(e.get("isExternal", False)),
                e.get("importance", "normal"),
                int(e.get("mentionsMe", False)),
                int(e.get("isCC", False)),
                int(e.get("isRead", False)),
                int(e.get("isFlagged", False)),
                e.get("folder", None),
                json.dumps(e.get("cc", [])),
                json.dumps(e.get("recipients", [])),
            ),
        )
    print(f"  emails: {len(emails)} rows")

    # --- Attachments ---
    attachments = _load_jsonl(DATA_DIR / "catalogs" / "micromail" / "attachments.jsonl")
    for a in attachments:
        conn.execute(
            "INSERT INTO attachments (id, email_id, name, size) VALUES (?,?,?,?)",
            (a["id"], a["email_id"], a["name"], a["size"]),
        )
    print(f"  attachments: {len(attachments)} rows")

    conn.commit()
    conn.close()
    print(f"  -> {MICROMAIL_DB}")


# ---------------------------------------------------------------------------
# microchat.db
# ---------------------------------------------------------------------------

MICROCHAT_TEAMS_DDL = """\
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
"""

MICROCHAT_CONVERSATIONS_DDL = """\
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
"""

MICROCHAT_MESSAGES_DDL = """\
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_urgent INTEGER NOT NULL DEFAULT 0,
    mentions_me INTEGER NOT NULL DEFAULT 0,
    has_attachment INTEGER NOT NULL DEFAULT 0,
    reactions TEXT NOT NULL DEFAULT '[]',
    attachments TEXT NOT NULL DEFAULT '[]',
    reply_to_id TEXT,
    "order" INTEGER NOT NULL
);
"""

MICROCHAT_CALLS_DDL = """\
CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
"""


def build_microchat_db() -> None:
    MICROCHAT_DB.parent.mkdir(parents=True, exist_ok=True)
    if MICROCHAT_DB.exists():
        MICROCHAT_DB.unlink()

    conn = sqlite3.connect(MICROCHAT_DB)

    conn.execute(MICROCHAT_TEAMS_DDL)
    conn.execute(MICROCHAT_CONVERSATIONS_DDL)
    conn.execute(MICROCHAT_MESSAGES_DDL)
    conn.execute(MICROCHAT_CALLS_DDL)

    chat_dir = DATA_DIR / "catalogs" / "microchat"

    # --- Teams ---
    teams = _load_jsonl(chat_dir / "teams.jsonl")
    for t in teams:
        conn.execute("INSERT INTO teams (id, data) VALUES (?,?)", (t["id"], json.dumps(t)))
    print(f"  teams: {len(teams)} rows")

    # --- Conversations ---
    conversations = _load_jsonl(chat_dir / "conversations.jsonl")
    for c in conversations:
        conn.execute("INSERT INTO conversations (id, data) VALUES (?,?)", (c["id"], json.dumps(c)))
    print(f"  conversations: {len(conversations)} rows")

    # --- Messages (authored, prefix-based IDs) ---
    messages = _load_jsonl(chat_dir / "messages.jsonl")
    for i, m in enumerate(messages, start=1):
        conn.execute(
            """INSERT INTO messages
               (id, conversation_id, sender_id, content, is_read, is_urgent,
                mentions_me, has_attachment, reactions, attachments, reply_to_id, "order")
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                m["id"],
                m["conversation_id"],
                m["sender_id"],
                m["content"],
                int(m.get("isRead", False)),
                int(m.get("isUrgent", False)),
                int(m.get("mentionsMe", False)),
                int(m.get("hasAttachment", False)),
                json.dumps(m.get("reactions", [])),
                json.dumps(m.get("attachments", [])),
                m.get("reply_to_id"),
                i,
            ),
        )
    print(f"  messages: {len(messages)} rows")

    # --- Calls ---
    calls = _load_jsonl(chat_dir / "calls.jsonl")
    for c in calls:
        conn.execute("INSERT INTO calls (id, data) VALUES (?,?)", (c["id"], json.dumps(c)))
    print(f"  calls: {len(calls)} rows")

    conn.commit()
    conn.close()
    print(f"  -> {MICROCHAT_DB}")


# ---------------------------------------------------------------------------
# microdin.db
# ---------------------------------------------------------------------------

MICRODIN_POSTS_DDL = """\
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    likes INTEGER NOT NULL DEFAULT 0,
    comments TEXT NOT NULL DEFAULT '[]',
    shares INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL
);
"""

MICRODIN_CONNECTIONS_DDL = """\
CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    mutual_connections INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    task_type TEXT
);
"""

MICRODIN_CONVERSATIONS_DDL = """\
CREATE TABLE IF NOT EXISTS din_conversations (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
"""

MICRODIN_MESSAGES_DDL = """\
CREATE TABLE IF NOT EXISTS din_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL
);
"""

MICRODIN_NOTIFICATIONS_DDL = """\
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    target_post_id TEXT,
    text TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    task_type TEXT
);
"""

MICRODIN_JOBS_DDL = """\
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company_id TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'full-time',
    description TEXT NOT NULL DEFAULT '',
    requirements TEXT NOT NULL DEFAULT '[]',
    applicants INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    task_type TEXT
);
"""

MICRODIN_COMPANIES_DDL = """\
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
"""


def build_microdin_db() -> None:
    MICRODIN_DB.parent.mkdir(parents=True, exist_ok=True)
    if MICRODIN_DB.exists():
        MICRODIN_DB.unlink()

    conn = sqlite3.connect(MICRODIN_DB)

    conn.execute(MICRODIN_POSTS_DDL)
    conn.execute(MICRODIN_CONNECTIONS_DDL)
    conn.execute(MICRODIN_CONVERSATIONS_DDL)
    conn.execute(MICRODIN_MESSAGES_DDL)
    conn.execute(MICRODIN_NOTIFICATIONS_DDL)
    conn.execute(MICRODIN_JOBS_DDL)
    conn.execute(MICRODIN_COMPANIES_DDL)

    din_dir = DATA_DIR / "catalogs" / "microdin"

    # --- Posts ---
    posts = _load_jsonl(din_dir / "posts.jsonl")
    for p in posts:
        conn.execute(
            """INSERT INTO posts
               (id, author_id, content, image_url, likes, comments, shares, "order")
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                p["id"],
                p["authorId"],
                p["content"],
                p.get("imageUrl"),
                p.get("likes", 0),
                json.dumps(p.get("comments", [])),
                p.get("shares", 0),
                p.get("order", 0),
            ),
        )
    print(f"  posts: {len(posts)} rows")

    # --- Connections ---
    connections = _load_jsonl(din_dir / "connections.jsonl")
    for c in connections:
        conn.execute(
            """INSERT INTO connections
               (id, user_id, status, mutual_connections, "order", task_type)
               VALUES (?,?,?,?,?,?)""",
            (
                c["id"],
                c["userId"],
                c.get("status", "pending"),
                c.get("mutualConnections", 0),
                c.get("order", 0),
                c.get("taskType"),
            ),
        )
    print(f"  connections: {len(connections)} rows")

    # --- Conversations & Messages (messages.jsonl contains conversations) ---
    conversations = _load_jsonl(din_dir / "messages.jsonl")
    msg_count = 0
    for conv in conversations:
        # Store conversation metadata (without messages)
        conv_meta = {
            "id": conv["id"],
            "participantIds": conv["participantIds"],
            "taskType": conv.get("taskType"),
            "order": conv.get("order", 0),
        }
        conn.execute(
            "INSERT INTO din_conversations (id, data) VALUES (?,?)",
            (conv["id"], json.dumps(conv_meta)),
        )

        # Extract and store individual messages
        messages = conv.get("messages", [])
        unread_count = conv.get("unreadCount", 0)
        # Mark the last N messages as unread (where N = unreadCount)
        for i, msg in enumerate(messages):
            is_read = 1 if (len(messages) - i) > unread_count else 0
            conn.execute(
                """INSERT INTO din_messages
                   (id, conversation_id, sender_id, content, is_read, "order")
                   VALUES (?,?,?,?,?,?)""",
                (
                    msg["id"],
                    conv["id"],
                    msg["senderId"],
                    msg["text"],
                    is_read,
                    msg.get("order", i + 1),
                ),
            )
            msg_count += 1
    print(f"  din_conversations: {len(conversations)} rows")
    print(f"  din_messages: {msg_count} rows")

    # --- Notifications ---
    notifications = _load_jsonl(din_dir / "notifications.jsonl")
    for n in notifications:
        conn.execute(
            """INSERT INTO notifications
               (id, type, actor_id, target_post_id, text, is_read, "order", task_type)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                n["id"],
                n["type"],
                n["actorId"],
                n.get("targetPostId"),
                n.get("text"),
                int(n.get("isRead", False)),
                n.get("order", 0),
                n.get("taskType"),
            ),
        )
    print(f"  notifications: {len(notifications)} rows")

    # --- Jobs ---
    jobs = _load_jsonl(din_dir / "jobs.jsonl")
    for j in jobs:
        conn.execute(
            """INSERT INTO jobs
               (id, title, company_id, location, type, description,
                requirements, applicants, "order", task_type)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                j["id"],
                j["title"],
                j["companyId"],
                j.get("location", ""),
                j.get("type", "full-time"),
                j.get("description", ""),
                json.dumps(j.get("requirements", [])),
                j.get("applicants", 0),
                j.get("order", 0),
                j.get("taskType"),
            ),
        )
    print(f"  jobs: {len(jobs)} rows")

    # --- Companies (from entities.json) ---
    entities_path = DATA_DIR / "catalogs" / "entities.json"
    with open(entities_path, encoding="utf-8") as fh:
        entities = json.load(fh)
    company_count = 0
    for e in entities:
        din = e.get("platforms", {}).get("microdin")
        if din:
            company_data = {
                "id": din["companyId"],
                "entityId": e["id"],
                "name": e["name"],
                "initials": e.get("initials", ""),
                "description": e.get("description", ""),
                "avatarUrl": e.get("avatarUrl", ""),
                "bannerUrl": e.get("bannerUrl", ""),
                "industry": din.get("industry", ""),
                "size": din.get("size", ""),
                "location": din.get("location", ""),
                "employees": din.get("employees", 0),
                "followers": din.get("followers", 0),
            }
            conn.execute(
                "INSERT INTO companies (id, data) VALUES (?,?)",
                (din["companyId"], json.dumps(company_data)),
            )
            company_count += 1
    print(f"  companies: {company_count} rows")

    conn.commit()
    conn.close()
    print(f"  -> {MICRODIN_DB}")


# ---------------------------------------------------------------------------
# microfy.db
# ---------------------------------------------------------------------------

MICROFY_TRACKS_DDL = """\
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    album_name TEXT NOT NULL DEFAULT '',
    duration TEXT NOT NULL DEFAULT '0:00',
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    cover_color TEXT NOT NULL DEFAULT '#333',
    cover_initials TEXT NOT NULL DEFAULT '',
    genre TEXT NOT NULL DEFAULT '',
    lyrics TEXT NOT NULL DEFAULT '',
    play_count INTEGER NOT NULL DEFAULT 0,
    is_new_release INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    task_type TEXT
);
"""

MICROFY_PLAYLISTS_DDL = """\
CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
"""

MICROFY_MOODS_DDL = """\
CREATE TABLE IF NOT EXISTS moods (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
"""

MICROFY_ARTISTS_DDL = """\
CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    name TEXT NOT NULL
);
"""


def build_microfy_db() -> None:
    MICROFY_DB.parent.mkdir(parents=True, exist_ok=True)
    if MICROFY_DB.exists():
        MICROFY_DB.unlink()

    conn = sqlite3.connect(MICROFY_DB)

    conn.execute(MICROFY_TRACKS_DDL)
    conn.execute(MICROFY_PLAYLISTS_DDL)
    conn.execute(MICROFY_MOODS_DDL)
    conn.execute(MICROFY_ARTISTS_DDL)

    fy_dir = DATA_DIR / "catalogs" / "microfy"

    # --- Tracks ---
    tracks = _load_jsonl(fy_dir / "tracks.jsonl")
    for t in tracks:
        conn.execute(
            """INSERT INTO tracks
               (id, title, artist_id, artist_name, album_name, duration,
                duration_seconds, description, cover_color, cover_initials,
                genre, lyrics, play_count, is_new_release, "order", task_type)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                t["id"],
                t["title"],
                t["artistId"],
                t["artistName"],
                t.get("albumName", ""),
                t.get("duration", "0:00"),
                t.get("durationSeconds", 0),
                t.get("description", ""),
                t.get("coverColor", "#333"),
                t.get("coverInitials", ""),
                t.get("genre", ""),
                t.get("lyrics", ""),
                t.get("playCount", 0),
                int(t.get("isNewRelease", False)),
                t.get("order", 0),
                t.get("taskType"),
            ),
        )
    print(f"  tracks: {len(tracks)} rows")

    # --- Playlists ---
    playlists = _load_jsonl(fy_dir / "playlists.jsonl")
    for p in playlists:
        conn.execute(
            "INSERT INTO playlists (id, data) VALUES (?,?)",
            (p["id"], json.dumps(p)),
        )
    print(f"  playlists: {len(playlists)} rows")

    # --- Moods ---
    moods = _load_jsonl(fy_dir / "moods.jsonl")
    for m in moods:
        conn.execute(
            "INSERT INTO moods (id, data) VALUES (?,?)",
            (m["id"], json.dumps(m)),
        )
    print(f"  moods: {len(moods)} rows")

    # --- Artists (from entities.json) ---
    entities_path = DATA_DIR / "catalogs" / "entities.json"
    with open(entities_path, encoding="utf-8") as fh:
        entities = json.load(fh)
    artist_count = 0
    for e in entities:
        fy = e.get("platforms", {}).get("microfy")
        if fy:
            conn.execute(
                "INSERT INTO artists (id, entity_id, name) VALUES (?,?,?)",
                (fy["artistId"], e["id"], e["name"]),
            )
            artist_count += 1
    print(f"  artists: {artist_count} rows")

    conn.commit()
    conn.close()
    print(f"  -> {MICROFY_DB}")


# ---------------------------------------------------------------------------
# microgram.db
# ---------------------------------------------------------------------------

MICROGRAM_POSTS_DDL = """\
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    caption TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    likes INTEGER NOT NULL DEFAULT 0,
    comments TEXT NOT NULL DEFAULT '[]',
    is_target_post INTEGER NOT NULL DEFAULT 0,
    task_type TEXT,
    "order" INTEGER NOT NULL
);
"""

MICROGRAM_STORIES_DDL = """\
CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    media_url TEXT NOT NULL DEFAULT '',
    media_type TEXT NOT NULL DEFAULT 'image',
    "order" INTEGER NOT NULL
);
"""

MICROGRAM_MESSAGES_DDL = """\
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
"""

MICROGRAM_ACTIVITY_DDL = """\
CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    target_post_id TEXT,
    text TEXT,
    "order" INTEGER NOT NULL
);
"""

MICROGRAM_SUGGESTIONS_DDL = """\
CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
"""


def build_microgram_db() -> None:
    MICROGRAM_DB.parent.mkdir(parents=True, exist_ok=True)
    if MICROGRAM_DB.exists():
        MICROGRAM_DB.unlink()

    conn = sqlite3.connect(MICROGRAM_DB)

    conn.execute(MICROGRAM_POSTS_DDL)
    conn.execute(MICROGRAM_STORIES_DDL)
    conn.execute(MICROGRAM_MESSAGES_DDL)
    conn.execute(MICROGRAM_ACTIVITY_DDL)
    conn.execute(MICROGRAM_SUGGESTIONS_DDL)

    gram_dir = DATA_DIR / "catalogs" / "microgram"

    # --- Posts ---
    posts = _load_jsonl(gram_dir / "posts.jsonl")
    for p in posts:
        conn.execute(
            """INSERT INTO posts
               (id, author_id, image_url, caption, location, likes,
                comments, is_target_post, task_type, "order")
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                p["id"],
                p["authorId"],
                p.get("imageUrl", ""),
                p.get("caption", ""),
                p.get("location", ""),
                p.get("likes", 0),
                json.dumps(p.get("comments", [])),
                int(p.get("isTargetPost", False)),
                p.get("taskType"),
                p.get("order", 0),
            ),
        )
    print(f"  posts: {len(posts)} rows")

    # --- Stories ---
    stories = _load_jsonl(gram_dir / "stories.jsonl")
    for s in stories:
        conn.execute(
            """INSERT INTO stories
               (id, author_id, media_url, media_type, "order")
               VALUES (?,?,?,?,?)""",
            (
                s["id"],
                s["authorId"],
                s.get("mediaUrl", ""),
                s.get("mediaType", "image"),
                s.get("order", 0),
            ),
        )
    print(f"  stories: {len(stories)} rows")

    # --- Messages (DM conversations -- JSON blob) ---
    messages = _load_jsonl(gram_dir / "messages.jsonl")
    for m in messages:
        conn.execute(
            "INSERT INTO messages (id, data) VALUES (?,?)",
            (m["id"], json.dumps(m)),
        )
    print(f"  messages: {len(messages)} rows")

    # --- Activity ---
    activity = _load_jsonl(gram_dir / "activity.jsonl")
    for a in activity:
        conn.execute(
            """INSERT INTO activity
               (id, type, actor_id, target_post_id, text, "order")
               VALUES (?,?,?,?,?,?)""",
            (
                a["id"],
                a["type"],
                a["actorId"],
                a.get("targetPostId"),
                a.get("text"),
                a.get("order", 0),
            ),
        )
    print(f"  activity: {len(activity)} rows")

    # --- Suggestions ---
    suggestions = _load_jsonl(gram_dir / "suggestions.jsonl")
    for i, s in enumerate(suggestions):
        sid = s.get("id", f"suggestion-{i}")
        conn.execute(
            "INSERT INTO suggestions (id, data) VALUES (?,?)",
            (sid, json.dumps(s)),
        )
    print(f"  suggestions: {len(suggestions)} rows")

    conn.commit()
    conn.close()
    print(f"  -> {MICROGRAM_DB}")


# ---------------------------------------------------------------------------
# microhood.db
# ---------------------------------------------------------------------------

MICROHOOD_STOCKS_DDL = """\
CREATE TABLE IF NOT EXISTS stocks (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    shares INTEGER NOT NULL DEFAULT 0,
    avg_cost REAL NOT NULL DEFAULT 0,
    current_price REAL NOT NULL DEFAULT 0,
    change REAL NOT NULL DEFAULT 0,
    change_percent REAL NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#333',
    org_id TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL
);
"""

MICROHOOD_TRACES_DDL = """\
CREATE TABLE IF NOT EXISTS price_traces (
    symbol TEXT PRIMARY KEY,
    trace_points TEXT NOT NULL
);
"""

MICROHOOD_WATCHLIST_DDL = """\
CREATE TABLE IF NOT EXISTS watchlist (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    change REAL NOT NULL DEFAULT 0,
    change_percent REAL NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL
);
"""

MICROHOOD_NEWS_DDL = """\
CREATE TABLE IF NOT EXISTS news (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    time TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL
);
"""


def build_microhood_db() -> None:
    MICROHOOD_DB.parent.mkdir(parents=True, exist_ok=True)
    if MICROHOOD_DB.exists():
        MICROHOOD_DB.unlink()

    conn = sqlite3.connect(MICROHOOD_DB)

    conn.execute(MICROHOOD_STOCKS_DDL)
    conn.execute(MICROHOOD_TRACES_DDL)
    conn.execute(MICROHOOD_WATCHLIST_DDL)
    conn.execute(MICROHOOD_NEWS_DDL)

    hood_dir = DATA_DIR / "catalogs" / "microhood"

    # --- Stocks ---
    stocks = _load_jsonl(hood_dir / "stocks.jsonl")
    for i, s in enumerate(stocks, start=1):
        conn.execute(
            """INSERT INTO stocks
               (symbol, name, shares, avg_cost, current_price, change,
                change_percent, color, org_id, "order")
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                s["symbol"],
                s["name"],
                s.get("shares", 0),
                s.get("avgCost", 0),
                s.get("currentPrice", 0),
                s.get("change", 0),
                s.get("changePercent", 0),
                s.get("color", "#333"),
                s.get("orgId", ""),
                i,
            ),
        )
    print(f"  stocks: {len(stocks)} rows")

    # --- Price Traces ---
    traces_path = hood_dir / "stock_price_traces.json"
    with open(traces_path, encoding="utf-8") as fh:
        traces = json.load(fh)
    for symbol, points in traces.items():
        conn.execute(
            "INSERT INTO price_traces (symbol, trace_points) VALUES (?,?)",
            (symbol, json.dumps(points)),
        )
    print(f"  price_traces: {len(traces)} rows")

    # --- Watchlist ---
    watchlist = _load_jsonl(hood_dir / "watchlist.jsonl")
    for i, w in enumerate(watchlist, start=1):
        conn.execute(
            """INSERT INTO watchlist
               (symbol, name, price, change, change_percent, "order")
               VALUES (?,?,?,?,?,?)""",
            (
                w["symbol"],
                w.get("name", ""),
                w.get("price", 0),
                w.get("change", 0),
                w.get("changePercent", 0),
                i,
            ),
        )
    print(f"  watchlist: {len(watchlist)} rows")

    # --- News ---
    news = _load_jsonl(hood_dir / "news.jsonl")
    for i, n in enumerate(news, start=1):
        conn.execute(
            """INSERT INTO news (id, source, title, time, "order") VALUES (?,?,?,?,?)""",
            (
                n["id"],
                n.get("source", ""),
                n.get("title", ""),
                n.get("time", ""),
                i,
            ),
        )
    print(f"  news: {len(news)} rows")

    conn.commit()
    conn.close()
    print(f"  -> {MICROHOOD_DB}")


# ---------------------------------------------------------------------------
# microhub.db
# ---------------------------------------------------------------------------

MICROHUB_REPOSITORY_DDL = """\
CREATE TABLE IF NOT EXISTS repository (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
"""

MICROHUB_FILES_DDL = """\
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'file',
    parent_id TEXT,
    size INTEGER,
    language TEXT,
    last_commit TEXT NOT NULL DEFAULT '{}',
    content TEXT,
    "order" INTEGER NOT NULL
);
"""

MICROHUB_ISSUES_DDL = """\
CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'open',
    author TEXT NOT NULL DEFAULT '',
    author_id TEXT NOT NULL DEFAULT '',
    assignees TEXT NOT NULL DEFAULT '[]',
    label_ids TEXT NOT NULL DEFAULT '[]',
    comments TEXT NOT NULL DEFAULT '[]',
    milestone TEXT,
    "order" INTEGER NOT NULL
);
"""

MICROHUB_PULL_REQUESTS_DDL = """\
CREATE TABLE IF NOT EXISTS pull_requests (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'open',
    author TEXT NOT NULL DEFAULT '',
    author_id TEXT NOT NULL DEFAULT '',
    assignees TEXT NOT NULL DEFAULT '[]',
    reviewers TEXT NOT NULL DEFAULT '[]',
    label_ids TEXT NOT NULL DEFAULT '[]',
    source_branch TEXT NOT NULL DEFAULT '',
    target_branch TEXT NOT NULL DEFAULT '',
    commits INTEGER NOT NULL DEFAULT 0,
    additions INTEGER NOT NULL DEFAULT 0,
    deletions INTEGER NOT NULL DEFAULT 0,
    files_changed INTEGER NOT NULL DEFAULT 0,
    review_status TEXT NOT NULL DEFAULT 'review-required',
    checks TEXT NOT NULL DEFAULT '[]',
    comments TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL
);
"""

MICROHUB_COMMITS_DDL = """\
CREATE TABLE IF NOT EXISTS commits (
    id TEXT PRIMARY KEY,
    sha TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    description TEXT,
    author TEXT NOT NULL DEFAULT '',
    author_id TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT 'main',
    additions INTEGER NOT NULL DEFAULT 0,
    deletions INTEGER NOT NULL DEFAULT 0,
    files_changed TEXT NOT NULL DEFAULT '[]',
    verified INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL
);
"""

MICROHUB_WORKFLOW_RUNS_DDL = """\
CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL DEFAULT '',
    workflow_name TEXT NOT NULL DEFAULT '',
    run_number INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'queued',
    conclusion TEXT,
    branch TEXT NOT NULL DEFAULT '',
    commit_sha TEXT NOT NULL DEFAULT '',
    commit_message TEXT NOT NULL DEFAULT '',
    actor TEXT NOT NULL DEFAULT '',
    actor_id TEXT NOT NULL DEFAULT '',
    event TEXT NOT NULL DEFAULT '',
    duration INTEGER,
    jobs TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL
);
"""

MICROHUB_WORKFLOWS_DDL = """\
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    path TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'active'
);
"""

MICROHUB_WIKI_PAGES_DDL = """\
CREATE TABLE IF NOT EXISTS wiki_pages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    slug TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    last_edited_by TEXT NOT NULL DEFAULT '',
    last_edited_by_id TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL
);
"""

MICROHUB_PROJECTS_DDL = """\
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'open',
    creator TEXT NOT NULL DEFAULT '',
    creator_id TEXT NOT NULL DEFAULT '',
    columns TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL
);
"""

MICROHUB_ACTIVITY_DDL = """\
CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT '',
    actor TEXT NOT NULL DEFAULT '',
    actor_id TEXT NOT NULL DEFAULT '',
    repo TEXT NOT NULL DEFAULT '',
    payload TEXT NOT NULL DEFAULT '{}',
    "order" INTEGER NOT NULL
);
"""

MICROHUB_INSIGHTS_DDL = """\
CREATE TABLE IF NOT EXISTS insights (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL DEFAULT '{}'
);
"""

MICROHUB_RELEASES_DDL = """\
CREATE TABLE IF NOT EXISTS releases (
    id TEXT PRIMARY KEY,
    tag_name TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    author_id TEXT NOT NULL DEFAULT '',
    is_latest INTEGER NOT NULL DEFAULT 0,
    is_prerelease INTEGER NOT NULL DEFAULT 0,
    assets TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL
);
"""

MICROHUB_LABELS_DDL = """\
CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#000000',
    description TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL
);
"""

MICROHUB_SECURITY_DDL = """\
CREATE TABLE IF NOT EXISTS security_advisories (
    id TEXT PRIMARY KEY,
    severity TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    package TEXT NOT NULL DEFAULT '',
    vulnerable_versions TEXT NOT NULL DEFAULT '',
    patched_versions TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'open',
    cve_id TEXT,
    "order" INTEGER NOT NULL
);
"""

MICROHUB_CODE_SCANNING_DDL = """\
CREATE TABLE IF NOT EXISTS code_scanning (
    id TEXT PRIMARY KEY,
    rule TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    file_path TEXT NOT NULL DEFAULT '',
    line_number INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'open',
    "order" INTEGER NOT NULL
);
"""

MICROHUB_SETTINGS_DDL = """\
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    data TEXT NOT NULL DEFAULT '{}'
);
"""

MICROHUB_DEPLOYMENTS_DDL = """\
CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    environment TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    creator TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL
);
"""

MICROHUB_PACKAGES_DDL = """\
CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT '',
    version TEXT NOT NULL DEFAULT '',
    downloads INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL
);
"""


def build_microhub_db() -> None:
    MICROHUB_DB.parent.mkdir(parents=True, exist_ok=True)
    if MICROHUB_DB.exists():
        MICROHUB_DB.unlink()

    conn = sqlite3.connect(MICROHUB_DB)

    for ddl in (
        MICROHUB_REPOSITORY_DDL, MICROHUB_FILES_DDL, MICROHUB_ISSUES_DDL, MICROHUB_PULL_REQUESTS_DDL,
        MICROHUB_COMMITS_DDL, MICROHUB_WORKFLOW_RUNS_DDL, MICROHUB_WORKFLOWS_DDL, MICROHUB_WIKI_PAGES_DDL,
        MICROHUB_PROJECTS_DDL, MICROHUB_ACTIVITY_DDL, MICROHUB_INSIGHTS_DDL, MICROHUB_RELEASES_DDL,
        MICROHUB_LABELS_DDL, MICROHUB_SECURITY_DDL, MICROHUB_CODE_SCANNING_DDL, MICROHUB_SETTINGS_DDL,
        MICROHUB_DEPLOYMENTS_DDL, MICROHUB_PACKAGES_DDL,
    ):
        conn.execute(ddl)

    hub_dir = DATA_DIR / "catalogs" / "microhub"

    # --- Repository (single row, stored as JSON blob) ---
    repos = _load_jsonl(hub_dir / "repository.jsonl")
    for r in repos:
        conn.execute(
            "INSERT INTO repository (id, data) VALUES (?,?)",
            (r["id"], json.dumps(r)),
        )
    print(f"  repository: {len(repos)} rows")

    # --- Files ---
    files = _load_jsonl(hub_dir / "files.jsonl")
    for f in files:
        conn.execute(
            """INSERT INTO files
               (id, name, path, type, parent_id, size, language, last_commit, content, "order")
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                f["id"],
                f["name"],
                f.get("path", ""),
                f.get("type", "file"),
                f.get("parentId"),
                f.get("size"),
                f.get("language"),
                json.dumps(f.get("lastCommit", {})),
                f.get("content"),
                f.get("order", 0),
            ),
        )
    print(f"  files: {len(files)} rows")

    # --- Issues ---
    issues = _load_jsonl(hub_dir / "issues.jsonl")
    for i in issues:
        conn.execute(
            """INSERT INTO issues
               (id, number, title, body, state, author, author_id, assignees, label_ids, comments, milestone, "order")
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                i["id"],
                i["number"],
                i["title"],
                i.get("body", ""),
                i.get("state", "open"),
                i.get("author", ""),
                i.get("authorId", ""),
                json.dumps(i.get("assignees", [])),
                json.dumps(i.get("labelIds", [])),
                json.dumps(i.get("comments", [])),
                i.get("milestone"),
                i.get("order", 0),
            ),
        )
    print(f"  issues: {len(issues)} rows")

    # --- Pull Requests ---
    prs = _load_jsonl(hub_dir / "prs.jsonl")
    for p in prs:
        conn.execute(
            """INSERT INTO pull_requests
               (id, number, title, body, state, author, author_id, assignees, reviewers,
                label_ids, source_branch, target_branch, commits, additions, deletions,
                files_changed, review_status, checks, comments, "order")
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                p["id"],
                p["number"],
                p["title"],
                p.get("body", ""),
                p.get("state", "open"),
                p.get("author", ""),
                p.get("authorId", ""),
                json.dumps(p.get("assignees", [])),
                json.dumps(p.get("reviewers", [])),
                json.dumps(p.get("labelIds", [])),
                p.get("sourceBranch", ""),
                p.get("targetBranch", ""),
                p.get("commits", 0),
                p.get("additions", 0),
                p.get("deletions", 0),
                p.get("filesChanged", 0),
                p.get("reviewStatus", "review-required"),
                json.dumps(p.get("checks", [])),
                json.dumps(p.get("comments", [])),
                p.get("order", 0),
            ),
        )
    print(f"  pull_requests: {len(prs)} rows")

    # --- Commits ---
    commits = _load_jsonl(hub_dir / "commits.jsonl")
    for c in commits:
        conn.execute(
            """INSERT INTO commits
               (id, sha, message, description, author, author_id, branch,
                additions, deletions, files_changed, verified, "order")
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                c["id"],
                c["sha"],
                c["message"],
                c.get("description"),
                c.get("author", ""),
                c.get("authorId", ""),
                c.get("branch", "main"),
                c.get("additions", 0),
                c.get("deletions", 0),
                json.dumps(c.get("filesChanged", [])),
                int(c.get("verified", True)),
                c.get("order", 0),
            ),
        )
    print(f"  commits: {len(commits)} rows")

    # --- Workflow Runs ---
    runs = _load_jsonl(hub_dir / "workflow-runs.jsonl")
    for r in runs:
        commit = r.get("commit", {})
        conn.execute(
            """INSERT INTO workflow_runs
               (id, workflow_id, workflow_name, run_number, status, conclusion,
                branch, commit_sha, commit_message, actor, actor_id, event, duration, jobs, "order")
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                r["id"],
                r.get("workflowId", ""),
                r.get("workflowName", ""),
                r.get("runNumber", 0),
                r.get("status", "queued"),
                r.get("conclusion"),
                r.get("branch", ""),
                commit.get("sha", ""),
                commit.get("message", ""),
                r.get("actor", ""),
                r.get("actorId", ""),
                r.get("event", ""),
                r.get("duration"),
                json.dumps(r.get("jobs", [])),
                r.get("order", 0),
            ),
        )
    print(f"  workflow_runs: {len(runs)} rows")

    # --- Workflows ---
    workflows = _load_jsonl(hub_dir / "workflows.jsonl")
    for w in workflows:
        conn.execute(
            "INSERT INTO workflows (id, name, path, state) VALUES (?,?,?,?)",
            (w["id"], w["name"], w["path"], w.get("state", "active")),
        )
    print(f"  workflows: {len(workflows)} rows")

    # --- Wiki Pages ---
    wiki = _load_jsonl(hub_dir / "wiki.jsonl")
    for w in wiki:
        conn.execute(
            """INSERT INTO wiki_pages
               (id, title, slug, content, last_edited_by, last_edited_by_id, "order")
               VALUES (?,?,?,?,?,?,?)""",
            (
                w["id"],
                w["title"],
                w["slug"],
                w.get("content", ""),
                w.get("lastEditedBy", ""),
                w.get("lastEditedById", ""),
                w.get("order", 0),
            ),
        )
    print(f"  wiki_pages: {len(wiki)} rows")

    # --- Projects ---
    projects = _load_jsonl(hub_dir / "projects.jsonl")
    for p in projects:
        conn.execute(
            """INSERT INTO projects
               (id, name, description, state, creator, creator_id, columns, "order")
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                p["id"],
                p["name"],
                p.get("description", ""),
                p.get("state", "open"),
                p.get("creator", ""),
                p.get("creatorId", ""),
                json.dumps(p.get("columns", [])),
                p.get("order", 0),
            ),
        )
    print(f"  projects: {len(projects)} rows")

    # --- Activity ---
    activity = _load_jsonl(hub_dir / "activity.jsonl")
    for a in activity:
        conn.execute(
            """INSERT INTO activity
               (id, type, actor, actor_id, repo, payload, "order")
               VALUES (?,?,?,?,?,?,?)""",
            (
                a["id"],
                a["type"],
                a.get("actor", ""),
                a.get("actorId", ""),
                a.get("repo", ""),
                json.dumps(a.get("payload", {})),
                a.get("order", 0),
            ),
        )
    print(f"  activity: {len(activity)} rows")

    # --- Insights (type-discriminated rows) ---
    insights = _load_jsonl(hub_dir / "insights.jsonl")
    for idx, i in enumerate(insights):
        itype = i.get("type", f"unknown-{idx}")
        conn.execute(
            "INSERT INTO insights (id, type, data) VALUES (?,?,?)",
            (itype, itype, json.dumps(i.get("data", i))),
        )
    print(f"  insights: {len(insights)} rows")

    # --- Releases ---
    releases = _load_jsonl(hub_dir / "releases.jsonl")
    for r in releases:
        conn.execute(
            """INSERT INTO releases
               (id, tag_name, name, body, author, author_id, is_latest, is_prerelease, assets, "order")
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                r["id"],
                r["tagName"],
                r["name"],
                r.get("body", ""),
                r.get("author", ""),
                r.get("authorId", ""),
                int(r.get("isLatest", False)),
                int(r.get("isPrerelease", False)),
                json.dumps(r.get("assets", [])),
                r.get("order", 0),
            ),
        )
    print(f"  releases: {len(releases)} rows")

    # --- Labels ---
    labels = _load_jsonl(hub_dir / "labels.jsonl")
    for l in labels:
        conn.execute(
            """INSERT INTO labels (id, name, color, description, "order") VALUES (?,?,?,?,?)""",
            (l["id"], l["name"], l["color"], l.get("description", ""), l.get("order", 0)),
        )
    print(f"  labels: {len(labels)} rows")

    # --- Security Advisories ---
    security = _load_jsonl(hub_dir / "security.jsonl")
    for s in security:
        conn.execute(
            """INSERT INTO security_advisories
               (id, severity, title, description, package, vulnerable_versions,
                patched_versions, state, cve_id, "order")
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                s["id"],
                s.get("severity", ""),
                s["title"],
                s.get("description", ""),
                s.get("package", ""),
                s.get("vulnerableVersions", ""),
                s.get("patchedVersions", ""),
                s.get("state", "open"),
                s.get("cveId"),
                s.get("order", 0),
            ),
        )
    print(f"  security_advisories: {len(security)} rows")

    # --- Code Scanning ---
    scanning = _load_jsonl(hub_dir / "code-scanning.jsonl")
    for s in scanning:
        conn.execute(
            """INSERT INTO code_scanning
               (id, rule, severity, description, file_path, line_number, state, "order")
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                s["id"],
                s["rule"],
                s.get("severity", ""),
                s.get("description", ""),
                s.get("file", ""),
                s.get("line", 0),
                s.get("state", "open"),
                s.get("order", 0),
            ),
        )
    print(f"  code_scanning: {len(scanning)} rows")

    # --- Settings (single row, stored as JSON blob) ---
    settings_data = _load_jsonl(hub_dir / "settings.jsonl")
    for idx, s in enumerate(settings_data):
        conn.execute(
            "INSERT INTO settings (id, data) VALUES (?,?)",
            ("default", json.dumps(s)),
        )
    print(f"  settings: {len(settings_data)} rows")

    # --- Deployments ---
    deployments = _load_jsonl(hub_dir / "deployments.jsonl")
    for d in deployments:
        conn.execute(
            """INSERT INTO deployments
               (id, environment, status, url, creator, "order")
               VALUES (?,?,?,?,?,?)""",
            (
                d["id"],
                d.get("environment", ""),
                d.get("status", ""),
                d.get("url", ""),
                d.get("creator", ""),
                d.get("order", 0),
            ),
        )
    print(f"  deployments: {len(deployments)} rows")

    # --- Packages ---
    packages = _load_jsonl(hub_dir / "packages.jsonl")
    for p in packages:
        conn.execute(
            """INSERT INTO packages
               (id, name, type, version, downloads, "order")
               VALUES (?,?,?,?,?,?)""",
            (
                p["id"],
                p["name"],
                p.get("type", ""),
                p.get("version", ""),
                p.get("downloads", 0),
                p.get("order", 0),
            ),
        )
    print(f"  packages: {len(packages)} rows")

    conn.commit()
    conn.close()
    print(f"  -> {MICROHUB_DB}")


# ---------------------------------------------------------------------------
# shared.db
# ---------------------------------------------------------------------------

USERS_DDL = """\
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
"""

IMAGES_DDL = """\
CREATE TABLE IF NOT EXISTS images (
    filename TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    data BLOB NOT NULL
);
"""


# ---------------------------------------------------------------------------
# microlendar.db
# ---------------------------------------------------------------------------

MICROLENDAR_EVENTS_DDL = """\
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    start_time TEXT,
    end_time TEXT,
    category TEXT NOT NULL DEFAULT 'Work',
    is_task INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    is_conflict INTEGER NOT NULL DEFAULT 0,
    attendees TEXT NOT NULL DEFAULT '[]',
    location TEXT NOT NULL DEFAULT '',
    task_type TEXT NOT NULL DEFAULT 'events',
    event_order INTEGER NOT NULL DEFAULT 0
);
"""


def build_microlendar_db() -> None:
    if MICROLENDAR_DB.exists():
        MICROLENDAR_DB.unlink()
    MICROLENDAR_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(MICROLENDAR_DB)

    conn.execute(MICROLENDAR_EVENTS_DDL)

    events_file = DATA_DIR / "catalogs" / "microlendar" / "events.jsonl"
    count = 0
    for line in events_file.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        conn.execute(
            "INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                row["id"],
                row.get("owner_id", "user000"),
                row.get("title", ""),
                row.get("description", ""),
                row.get("start_time"),
                row.get("end_time"),
                row.get("category", "Work"),
                int(row.get("is_task", False)),
                int(row.get("is_completed", False)),
                int(row.get("is_conflict", False)),
                json.dumps(row.get("attendees", [])),
                row.get("location", ""),
                row.get("task_type", "events"),
                row.get("order", 0),
            ),
        )
        count += 1

    conn.commit()
    conn.close()
    print(f"  events: {count} rows")
    print(f"  -> {MICROLENDAR_DB}")


# ---------------------------------------------------------------------------
# microscholar.db
# ---------------------------------------------------------------------------

MICROSCHOLAR_PAPERS_DDL = """\
CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    title_html TEXT NOT NULL DEFAULT '',
    author_ids TEXT NOT NULL DEFAULT '[]',
    authors TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    year INTEGER NOT NULL DEFAULT 0,
    snippet TEXT NOT NULL DEFAULT '',
    cited_by INTEGER NOT NULL DEFAULT 0,
    pdf_link TEXT NOT NULL DEFAULT '',
    pdf_source TEXT NOT NULL DEFAULT '',
    is_book INTEGER NOT NULL DEFAULT 0,
    is_target_paper INTEGER NOT NULL DEFAULT 0,
    task_type TEXT NOT NULL DEFAULT 'noise',
    "order" INTEGER NOT NULL DEFAULT 0
);
"""

MICROSCHOLAR_ALERTS_DDL = """\
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0,
    related_paper_id TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0
);
"""

MICROSCHOLAR_COAUTHORS_DDL = """\
CREATE TABLE IF NOT EXISTS coauthors (
    author_id_1 TEXT NOT NULL,
    author_id_2 TEXT NOT NULL,
    shared_papers TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (author_id_1, author_id_2)
);
"""


def build_microscholar_db() -> None:
    MICROSCHOLAR_DB.parent.mkdir(parents=True, exist_ok=True)
    if MICROSCHOLAR_DB.exists():
        MICROSCHOLAR_DB.unlink()

    conn = sqlite3.connect(MICROSCHOLAR_DB)

    conn.execute(MICROSCHOLAR_PAPERS_DDL)
    conn.execute(MICROSCHOLAR_ALERTS_DDL)
    conn.execute(MICROSCHOLAR_COAUTHORS_DDL)

    # Papers
    papers = _load_jsonl(DATA_DIR / "catalogs" / "microscholar" / "papers.jsonl")
    for p in papers:
        conn.execute(
            """INSERT INTO papers
               (id, title, title_html, author_ids, authors, source, year,
                snippet, cited_by, pdf_link, pdf_source, is_book,
                is_target_paper, task_type, "order")
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                p["id"],
                p.get("title", ""),
                p.get("titleHtml", ""),
                json.dumps(p.get("authorIds", [])),
                p.get("authors", ""),
                p.get("source", ""),
                p.get("year", 0),
                p.get("snippet", ""),
                p.get("citedBy", 0),
                p.get("pdfLink", ""),
                p.get("pdfSource", ""),
                int(p.get("isBook", False)),
                int(p.get("isTargetPaper", False)),
                p.get("taskType", "noise"),
                p.get("order", 0),
            ),
        )

    # Alerts
    alerts = _load_jsonl(DATA_DIR / "catalogs" / "microscholar" / "alerts.jsonl")
    for a in alerts:
        conn.execute(
            """INSERT INTO alerts
               (id, type, title, description, is_read, related_paper_id, "order")
               VALUES (?,?,?,?,?,?,?)""",
            (
                a["id"],
                a.get("type", ""),
                a.get("title", ""),
                a.get("description", ""),
                int(a.get("isRead", False)),
                a.get("relatedPaperId", ""),
                a.get("order", 0),
            ),
        )

    # Coauthors
    coauthors = _load_jsonl(DATA_DIR / "catalogs" / "microscholar" / "coauthors.jsonl")
    for c in coauthors:
        conn.execute(
            """INSERT INTO coauthors
               (author_id_1, author_id_2, shared_papers, "order")
               VALUES (?,?,?,?)""",
            (
                c["authorId1"],
                c["authorId2"],
                json.dumps(c.get("sharedPapers", [])),
                c.get("order", 0),
            ),
        )

    conn.commit()
    conn.close()
    print(f"  papers:    {len(papers)}")
    print(f"  alerts:    {len(alerts)}")
    print(f"  coauthors: {len(coauthors)}")
    print(f"  -> {MICROSCHOLAR_DB}")


# ---------------------------------------------------------------------------
# microtube.db
# ---------------------------------------------------------------------------

MICROTUBE_VIDEOS_DDL = """\
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    task TEXT NOT NULL DEFAULT 'general',
    "order" INTEGER NOT NULL DEFAULT 0,
    channel_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    dislikes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    duration TEXT NOT NULL DEFAULT '0:00',
    thumbnail_color TEXT NOT NULL DEFAULT '#333',
    thumbnail_src TEXT NOT NULL DEFAULT '',
    video_src TEXT NOT NULL DEFAULT '',
    published_at TEXT NOT NULL DEFAULT '',
    is_live INTEGER NOT NULL DEFAULT 0,
    is_short INTEGER NOT NULL DEFAULT 0
);
"""

MICROTUBE_CHANNELS_DDL = """\
CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    handle TEXT NOT NULL DEFAULT '',
    subscribers INTEGER NOT NULL DEFAULT 0,
    videos INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    avatar_color TEXT NOT NULL DEFAULT '#333',
    avatar_src TEXT NOT NULL DEFAULT '',
    banner_src TEXT NOT NULL DEFAULT '',
    is_verified INTEGER NOT NULL DEFAULT 0,
    is_self INTEGER NOT NULL DEFAULT 0
);
"""

MICROTUBE_COMMENTS_DDL = """\
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    task TEXT NOT NULL DEFAULT 'general',
    "order" INTEGER NOT NULL DEFAULT 0,
    video_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    likes INTEGER NOT NULL DEFAULT 0,
    replies INTEGER NOT NULL DEFAULT 0
);
"""

MICROTUBE_NOTIFICATIONS_DDL = """\
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    task TEXT NOT NULL DEFAULT 'general',
    "order" INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT '',
    channel_id TEXT NOT NULL DEFAULT '',
    video_id TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0
);
"""


def build_microtube_db() -> None:
    MICROTUBE_DB.parent.mkdir(parents=True, exist_ok=True)
    if MICROTUBE_DB.exists():
        MICROTUBE_DB.unlink()

    conn = sqlite3.connect(MICROTUBE_DB)

    conn.execute(MICROTUBE_VIDEOS_DDL)
    conn.execute(MICROTUBE_CHANNELS_DDL)
    conn.execute(MICROTUBE_COMMENTS_DDL)
    conn.execute(MICROTUBE_NOTIFICATIONS_DDL)

    # Videos
    videos = _load_jsonl(DATA_DIR / "catalogs" / "microtube" / "videos.jsonl")
    for v in videos:
        conn.execute(
            """INSERT INTO videos
               (id, task, "order", channel_id, title, description, views, likes,
                dislikes, comments, duration, thumbnail_color, thumbnail_src,
                video_src, published_at, is_live, is_short)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                v["id"],
                v.get("task", "general"),
                v.get("order", 0),
                v.get("channel_id", ""),
                v.get("title", ""),
                v.get("description", ""),
                v.get("views", 0),
                v.get("likes", 0),
                v.get("dislikes", 0),
                v.get("comments", 0),
                v.get("duration", "0:00"),
                v.get("thumbnailColor", "#333"),
                v.get("thumbnailSrc", ""),
                v.get("videoSrc", ""),
                v.get("publishedAt", ""),
                int(v.get("isLive", False)),
                int(v.get("isShort", False)),
            ),
        )

    # Channels
    channels = _load_jsonl(DATA_DIR / "catalogs" / "microtube" / "channels.jsonl")
    for ch in channels:
        conn.execute(
            """INSERT INTO channels
               (id, name, handle, subscribers, videos, description,
                avatar_color, avatar_src, banner_src, is_verified, is_self)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                ch["id"],
                ch.get("name", ""),
                ch.get("handle", ""),
                ch.get("subscribers", 0),
                ch.get("videos", 0),
                ch.get("description", ""),
                ch.get("avatarColor", "#333"),
                ch.get("avatarSrc", ""),
                ch.get("bannerSrc", ""),
                int(ch.get("isVerified", False)),
                int(ch.get("isSelf", False)),
            ),
        )

    # Comments
    comments = _load_jsonl(DATA_DIR / "catalogs" / "microtube" / "comments.jsonl")
    for c in comments:
        conn.execute(
            """INSERT INTO comments
               (id, task, "order", video_id, user_id, content, likes, replies)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                c["id"],
                c.get("task", "general"),
                c.get("order", 0),
                c.get("video_id", ""),
                c.get("user_id", ""),
                c.get("content", ""),
                c.get("likes", 0),
                c.get("replies", 0),
            ),
        )

    # Notifications
    notifications = _load_jsonl(DATA_DIR / "catalogs" / "microtube" / "notifications.jsonl")
    for n in notifications:
        conn.execute(
            """INSERT INTO notifications
               (id, task, "order", type, channel_id, video_id, message, is_read)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                n["id"],
                n.get("task", "general"),
                n.get("order", 0),
                n.get("type", ""),
                n.get("channel_id", ""),
                n.get("video_id", ""),
                n.get("message", ""),
                int(n.get("isRead", False)),
            ),
        )

    conn.commit()
    conn.close()
    print(f"  videos:        {len(videos)}")
    print(f"  channels:      {len(channels)}")
    print(f"  comments:      {len(comments)}")
    print(f"  notifications: {len(notifications)}")
    print(f"  -> {MICROTUBE_DB}")


# ---------------------------------------------------------------------------
# shared.db
# ---------------------------------------------------------------------------

def build_shared_db() -> None:
    if SHARED_DB.exists():
        SHARED_DB.unlink()

    conn = sqlite3.connect(SHARED_DB)

    conn.execute(USERS_DDL)
    conn.execute(IMAGES_DDL)

    # --- Users ---
    users_path = DATA_DIR / "catalogs" / "users.json"
    with open(users_path, encoding="utf-8") as fh:
        users = json.load(fh)

    for u in users:
        conn.execute(
            "INSERT INTO users (id, data) VALUES (?,?)",
            (u["id"], json.dumps(u)),
        )
    print(f"  users: {len(users)} rows")

    # --- Images ---
    images_dir = DATA_DIR / "public" / "author-photos"
    img_count = 0
    for p in sorted(images_dir.iterdir()):
        if p.name.startswith("."):
            continue
        ct, _ = mimetypes.guess_type(p.name)
        if ct is None:
            ct = "application/octet-stream"
        conn.execute(
            "INSERT INTO images (filename, content_type, data) VALUES (?,?,?)",
            (p.name, ct, p.read_bytes()),
        )
        img_count += 1
    print(f"  images: {img_count} rows")

    conn.commit()
    conn.close()
    print(f"  -> {SHARED_DB}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Building micromail.db ...")
    build_micromail_db()
    print()
    print("Building microchat.db ...")
    build_microchat_db()
    print()
    print("Building microdin.db ...")
    build_microdin_db()
    print()
    print("Building microfy.db ...")
    build_microfy_db()
    print()
    print("Building microgram.db ...")
    build_microgram_db()
    print()
    print("Building microhood.db ...")
    build_microhood_db()
    print()
    print("Building microhub.db ...")
    build_microhub_db()
    print()
    print("Building microlendar.db ...")
    build_microlendar_db()
    print()
    print("Building microscholar.db ...")
    build_microscholar_db()
    print()
    print("Building microtube.db ...")
    build_microtube_db()
    print()
    print("Building shared.db ...")
    build_shared_db()
    print()
    print("Done.")
