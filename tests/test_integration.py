#!/usr/bin/env python3
"""End-to-end integration tests for all 10 migrated environments.

Validates the full lifecycle: /init -> /advance -> /evaluate -> /close.
Success is determined solely by eval_sql queries.
"""

import json
import subprocess
import sys
import time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.catalogs import (
    MICROCHAT_CALL_CATALOG,
    MICRODIN_MESSAGE_CATALOG,
    MICROFY_PLAYLIST_CATALOG,
    MICROGRAM_MESSAGE_CATALOG,
    MICROTUBE_COMMENT_CATALOG,
    MICROTUBE_VIDEO_CATALOG,
    load_catalogs,
)

BASE = "http://localhost:8000"
TIMEOUT = 5

load_catalogs()


def wait_for_server(max_wait=15):
    """Wait until the server is responding."""
    start = time.time()
    while time.time() - start < max_wait:
        try:
            r = requests.get(f"{BASE}/status", timeout=2)
            if r.status_code == 200:
                return True
        except requests.ConnectionError:
            pass
        time.sleep(0.5)
    return False


def get(path, **kwargs):
    r = requests.get(f"{BASE}{path}", timeout=TIMEOUT, **kwargs)
    r.raise_for_status()
    return r.json()


def post(path, json_body=None, **kwargs):
    r = requests.post(f"{BASE}{path}", json=json_body, timeout=TIMEOUT, **kwargs)
    r.raise_for_status()
    return r.json()


class IntegrationResult:
    def __init__(self, env_name):
        self.env_name = env_name
        self.steps = []
        self.passed = True

    def check(self, step_name, condition, detail=""):
        status = "PASS" if condition else "FAIL"
        if not condition:
            self.passed = False
        self.steps.append((step_name, status, detail))

    def report(self):
        header = f"{'PASS' if self.passed else 'FAIL'} - {self.env_name}"
        lines = [f"\n{'='*60}", header, '='*60]
        for step_name, status, detail in self.steps:
            line = f"  [{status}] {step_name}"
            if detail:
                line += f" -- {detail}"
            lines.append(line)
        return "\n".join(lines)


def build_init_body(scenario):
    """Build POST /init body from a scenario JSON."""
    return {
        "environment": scenario["environment"],
        "duration": scenario["duration"],
        "eval_sql": scenario.get("eval_sql", ""),
        "events": scenario["events"],
    }


def build_manual_init_body(environment, events, duration=120, eval_sql="SELECT 1"):
    """Build POST /init body for targeted branch coverage tests."""
    return {
        "environment": environment,
        "duration": duration,
        "eval_sql": eval_sql,
        "events": events,
    }


def ensure_closed():
    """Make sure server is in preinit state."""
    try:
        status = get("/status")
        if status.get("status") not in ("preinit",):
            get("/close")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Test: MicroMail
# ---------------------------------------------------------------------------
def test_micromail():
    t = IntegrationResult("MicroMail (micromail-unread-absolute-passive)")
    ensure_closed()

    try:
        # 1. Load scenario
        scenario = get("/scenarios/micromail-unread-absolute-passive")
        t.check("Load scenario", scenario["id"] == "micromail-unread-absolute-passive",
                f"id={scenario.get('id')}")

        # 2. Init
        body = build_init_body(scenario)
        init_resp = post("/init", body)
        t.check("POST /init", init_resp["success"] and init_resp["status"] == "ready",
                f"status={init_resp.get('status')}")

        # 3. Advance a few ticks -- bring in some emails
        adv = get("/advance", params={"time": 30})
        t.check("GET /advance?time=30", adv["success"],
                f"sim_time={adv.get('simulation_time')}, processed={len(adv.get('processed_events', []))}")
        events_processed = len(adv.get("processed_events", []))
        t.check("Events processed > 0", events_processed > 0, f"count={events_processed}")

        # 4. Fetch data endpoints
        config = get("/data/config")
        t.check("GET /data/config", config["environment"] == "micromail",
                f"env={config.get('environment')}, task={config.get('task')}")

        emails = get("/data/micromail-emails")
        email_count = len(emails.get("emails", []))
        t.check("GET /data/micromail-emails", email_count > 0, f"count={email_count}")

        users = get("/data/users")
        user_count = len(users.get("users", []))
        t.check("GET /data/users", user_count > 0, f"count={user_count}")

        # 5. Advance past condition_at to deliver enough emails for the eval
        #    (must happen BEFORE mutations that reduce unread count)
        expected_emails = len(scenario["events"])
        adv2 = get("/advance", params={"time": scenario["duration"]})
        t.check("GET /advance to end", adv2["success"],
                f"sim_time={adv2.get('simulation_time')}")

        emails_full = get("/data/micromail-emails")
        full_count = len(emails_full.get("emails", []))
        t.check("All scenario emails delivered", full_count == expected_emails,
                f"count={full_count}, expected={expected_emails}")

        eval_resp = post("/evaluate")
        t.check("Evaluate success (unread threshold met)", eval_resp.get("success", False),
                f"success={eval_resp.get('success')}, detail={eval_resp.get('detail')}")

        # 6. Mutations (after success condition is latched)
        first_email_id = emails_full["emails"][0]["id"]
        read_resp = post(f"/data/micromail-emails/{first_email_id}/read")
        t.check(f"POST /data/micromail-emails/{first_email_id}/read", read_resp.get("success"),
                f"response={read_resp}")

        # Verify it's read now
        emails_after = get("/data/micromail-emails")
        target = [e for e in emails_after["emails"] if e["id"] == first_email_id]
        is_read = target[0].get("isRead", False) if target else False
        t.check("Email marked as read", is_read, f"isRead={is_read}")

        # Flag an email
        flag_resp = post(f"/data/micromail-emails/{first_email_id}/flag")
        t.check(f"POST /data/micromail-emails/{first_email_id}/flag", flag_resp.get("success"))

        # Move an email
        move_resp = post(f"/data/micromail-emails/{first_email_id}/move", {"folder": "archive"})
        t.check(f"POST /data/micromail-emails/{first_email_id}/move", move_resp.get("success"))

        # Verify mutation applied (email should now be in archive)
        emails_moved = get("/data/micromail-emails")
        moved_email = [e for e in emails_moved["emails"] if e["id"] == first_email_id]
        t.check("Email moved to archive", moved_email[0].get("folder") == "archive",
                f"folder={moved_email[0].get('folder')}")

        # Mark email as unread (undo)
        unread_resp = post(f"/data/micromail-emails/{first_email_id}/unread")
        t.check(f"POST /data/micromail-emails/{first_email_id}/unread", unread_resp.get("success"))

        # 7. Evaluate (after mutations -- email moved to archive reduces inbox count)
        eval_final = post("/evaluate")
        t.check("POST /evaluate (post-mutation may fail)", eval_final.get("success") is not None,
                f"success={eval_final.get('success')}")

        # 8. Close
        close = get("/close")
        t.check("GET /close", close["success"] and close["status"] == "preinit")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: MicroChat
# ---------------------------------------------------------------------------
def test_microchat():
    t = IntegrationResult("MicroChat (microchat-unread-absolute-passive)")
    ensure_closed()

    try:
        # 1. Load scenario
        scenario = get("/scenarios/microchat-unread-absolute-passive")
        t.check("Load scenario", scenario["id"] == "microchat-unread-absolute-passive")

        # 2. Init
        body = build_init_body(scenario)
        init_resp = post("/init", body)
        t.check("POST /init", init_resp["success"] and init_resp["status"] == "ready",
                f"status={init_resp.get('status')}")

        # 4. Advance
        adv = get("/advance", params={"time": 30})
        t.check("GET /advance?time=30", adv["success"],
                f"sim_time={adv.get('simulation_time')}, processed={len(adv.get('processed_events', []))}")

        # 5. Fetch data endpoints
        config = get("/data/config")
        t.check("GET /data/config", config["environment"] == "microchat",
                f"env={config.get('environment')}")

        teams = get("/data/microchat-teams")
        t.check("GET /data/microchat-teams", len(teams.get("teams", [])) > 0,
                f"count={len(teams.get('teams', []))}")

        messages = get("/data/microchat-messages")
        msg_count = len(messages.get("messages", []))
        t.check("GET /data/microchat-messages", msg_count > 0, f"count={msg_count}")

        conversations = get("/data/microchat-conversations")
        conv_count = len(conversations.get("conversations", []))
        t.check("GET /data/microchat-conversations", conv_count > 0, f"count={conv_count}")

        calls = get("/data/microchat-calls")
        t.check("GET /data/microchat-calls", "calls" in calls, f"count={len(calls.get('calls', []))}")

        # Filter messages by conversation_id
        if conversations["conversations"]:
            first_conv_id = conversations["conversations"][0]["id"]
            filtered = get("/data/microchat-messages", params={"conversation_id": first_conv_id})
            t.check(f"GET /data/microchat-messages?conversation_id={first_conv_id}",
                    all(m["conversationId"] == first_conv_id for m in filtered.get("messages", [])),
                    f"count={len(filtered.get('messages', []))}")

        # 6. Advance to end and evaluate BEFORE mutations (reads would reduce unread count)
        adv2 = get("/advance", params={"time": scenario["duration"]})
        t.check("GET /advance to end", adv2["success"])

        eval_resp = post("/evaluate")
        t.check("POST /evaluate (unread threshold met)", eval_resp.get("success"),
                f"success={eval_resp.get('success')}, detail={eval_resp.get('detail')}")

        # 7. Mutations (after eval is latched)
        if messages["messages"]:
            first_msg_id = messages["messages"][0]["id"]
            read_resp = post(f"/data/microchat-messages/{first_msg_id}/read")
            t.check(f"POST /data/microchat-messages/{first_msg_id}/read", read_resp.get("success"))

            react_resp = post(f"/data/microchat-messages/{first_msg_id}/react", {"emoji": "thumbsup"})
            t.check(f"POST /data/microchat-messages/{first_msg_id}/react", react_resp.get("success"))

        if conversations["conversations"]:
            cid = conversations["conversations"][0]["id"]
            mute_resp = post(f"/data/microchat-conversations/{cid}/mute")
            t.check(f"POST /data/microchat-conversations/{cid}/mute", mute_resp.get("success"),
                    f"isMuted={mute_resp.get('isMuted')}")

            pin_resp = post(f"/data/microchat-conversations/{cid}/pin")
            t.check(f"POST /data/microchat-conversations/{cid}/pin", pin_resp.get("success"),
                    f"isPinned={pin_resp.get('isPinned')}")

        # 8. Close
        close = get("/close")
        t.check("GET /close", close["success"] and close["status"] == "preinit")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: MicroDin
# ---------------------------------------------------------------------------
def test_microdin():
    t = IntegrationResult("MicroDin (microdin-connections-absolute-passive)")
    ensure_closed()

    try:
        # 1. Load scenario
        scenario = get("/scenarios/microdin-connections-absolute-passive")
        t.check("Load scenario", scenario["id"] == "microdin-connections-absolute-passive")

        # 2. Init
        body = build_init_body(scenario)
        init_resp = post("/init", body)
        t.check("POST /init", init_resp["success"] and init_resp["status"] == "ready",
                f"status={init_resp.get('status')}")

        # 4. Advance
        adv = get("/advance", params={"time": 30})
        t.check("GET /advance?time=30", adv["success"],
                f"sim_time={adv.get('simulation_time')}, processed={len(adv.get('processed_events', []))}")

        # 5. Fetch data endpoints
        config = get("/data/config")
        t.check("GET /data/config", config["environment"] == "microdin",
                f"env={config.get('environment')}")

        posts = get("/data/microdin-posts")
        post_count = len(posts.get("posts", []))
        t.check("GET /data/microdin-posts", post_count > 0, f"count={post_count}")

        connections = get("/data/microdin-connections")
        conn_count = len(connections.get("connections", []))
        t.check("GET /data/microdin-connections", conn_count > 0, f"count={conn_count}")

        din_convos = get("/data/microdin-conversations")
        din_conv_count = len(din_convos.get("conversations", []))
        t.check("GET /data/microdin-conversations", din_conv_count > 0, f"count={din_conv_count}")

        notifications = get("/data/microdin-notifications")
        notif_count = len(notifications.get("notifications", []))
        t.check("GET /data/microdin-notifications", notif_count > 0, f"count={notif_count}")

        jobs = get("/data/microdin-jobs")
        job_count = len(jobs.get("jobs", []))
        t.check("GET /data/microdin-jobs", job_count > 0, f"count={job_count}")

        companies = get("/data/microdin-companies")
        t.check("GET /data/microdin-companies", len(companies.get("companies", [])) > 0,
                f"count={len(companies.get('companies', []))}")

        # 6. Mutations
        # Like a post
        if posts["posts"]:
            pid = posts["posts"][0]["id"]
            like_resp = post(f"/data/microdin-posts/{pid}/like")
            t.check(f"POST /data/microdin-posts/{pid}/like", like_resp.get("success"),
                    f"isLiked={like_resp.get('isLiked')}")

        # Accept a connection
        pending = [c for c in connections["connections"] if c.get("status") == "pending"]
        if pending:
            cid = pending[0]["id"]
            accept_resp = post(f"/data/microdin-connections/{cid}/accept")
            t.check(f"POST /data/microdin-connections/{cid}/accept", accept_resp.get("success"))

        # Read a notification
        if notifications["notifications"]:
            nid = notifications["notifications"][0]["id"]
            nread_resp = post(f"/data/microdin-notifications/{nid}/read")
            t.check(f"POST /data/microdin-notifications/{nid}/read", nread_resp.get("success"))

        # Read a conversation
        if din_convos["conversations"]:
            dcid = din_convos["conversations"][0]["id"]
            dcread_resp = post(f"/data/microdin-conversations/{dcid}/read")
            t.check(f"POST /data/microdin-conversations/{dcid}/read", dcread_resp.get("success"))

        # Apply to a job
        if jobs["jobs"]:
            jid = jobs["jobs"][0]["id"]
            apply_resp = post(f"/data/microdin-jobs/{jid}/apply")
            t.check(f"POST /data/microdin-jobs/{jid}/apply", apply_resp.get("success"))

        # Advance to end
        adv2 = get("/advance", params={"time": 120})
        t.check("GET /advance?time=120", adv2["success"])

        # 7. Evaluate
        eval_resp = post("/evaluate")
        t.check("POST /evaluate", eval_resp.get("success") is not None,
                f"success={eval_resp.get('success')}")

        # 8. Close
        close = get("/close")
        t.check("GET /close", close["success"] and close["status"] == "preinit")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: MicroFy
# ---------------------------------------------------------------------------
def test_microfy():
    t = IntegrationResult("MicroFy (microfy-likes-absolute-passive)")
    ensure_closed()

    try:
        # 1. Load scenario
        scenario = get("/scenarios/microfy-likes-absolute-passive")
        t.check("Load scenario", scenario["id"] == "microfy-likes-absolute-passive")

        # 2. Init
        body = build_init_body(scenario)
        init_resp = post("/init", body)
        t.check("POST /init", init_resp["success"] and init_resp["status"] == "ready",
                f"status={init_resp.get('status')}")

        # 4. Advance
        adv = get("/advance", params={"time": 30})
        t.check("GET /advance?time=30", adv["success"],
                f"sim_time={adv.get('simulation_time')}, processed={len(adv.get('processed_events', []))}")

        # 5. Fetch data endpoints
        config = get("/data/config")
        t.check("GET /data/config", config["environment"] == "microfy",
                f"env={config.get('environment')}")

        tracks = get("/data/microfy-tracks")
        track_count = len(tracks.get("tracks", []))
        t.check("GET /data/microfy-tracks", track_count > 0, f"count={track_count}")

        playlists = get("/data/microfy-playlists")
        pl_count = len(playlists.get("playlists", []))
        t.check("GET /data/microfy-playlists", pl_count > 0, f"count={pl_count}")

        moods = get("/data/microfy-moods")
        mood_count = len(moods.get("moods", []))
        t.check("GET /data/microfy-moods", mood_count > 0, f"count={mood_count}")

        followed = get("/data/microfy-followed-artists")
        t.check("GET /data/microfy-followed-artists", "followed_artists" in followed,
                f"count={len(followed.get('followed_artists', []))}")

        artists = get("/data/microfy-artists")
        t.check("GET /data/microfy-artists", len(artists.get("artists", [])) > 0,
                f"count={len(artists.get('artists', []))}")

        # 6. Mutations
        # Like a track
        if tracks["tracks"]:
            tid = tracks["tracks"][0]["id"]
            like_resp = post(f"/data/microfy-tracks/{tid}/like")
            t.check(f"POST /data/microfy-tracks/{tid}/like", like_resp.get("success"),
                    f"isLiked={like_resp.get('isLiked')}")

            # Play a track
            play_resp = post(f"/data/microfy-tracks/{tid}/play")
            t.check(f"POST /data/microfy-tracks/{tid}/play", play_resp.get("success"))

        # Create a playlist
        create_pl = post("/data/microfy-playlists", {"name": "Test Playlist", "description": "Integration test"})
        t.check("POST /data/microfy-playlists (create)", create_pl.get("success"),
                f"id={create_pl.get('playlist', {}).get('id')}")

        # Add track to the playlist
        if create_pl.get("success") and tracks["tracks"]:
            pl_id = create_pl["playlist"]["id"]
            add_resp = post(f"/data/microfy-playlists/{pl_id}/add", {"track_id": tracks["tracks"][0]["id"]})
            t.check(f"POST /data/microfy-playlists/{pl_id}/add", add_resp.get("success"))

        # Follow an artist
        if artists.get("artists"):
            aid = artists["artists"][0]["id"]
            follow_resp = post(f"/data/microfy-artists/{aid}/follow")
            t.check(f"POST /data/microfy-artists/{aid}/follow", follow_resp.get("success"),
                    f"isFollowed={follow_resp.get('isFollowed')}")

        # Advance to end
        adv2 = get("/advance", params={"time": 120})
        t.check("GET /advance?time=120", adv2["success"])

        # 7. Evaluate
        eval_resp = post("/evaluate")
        t.check("POST /evaluate", eval_resp.get("success") is not None,
                f"success={eval_resp.get('success')}")

        # 8. Close
        close = get("/close")
        t.check("GET /close", close["success"] and close["status"] == "preinit")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: MicroGram
# ---------------------------------------------------------------------------
def test_microgram():
    t = IntegrationResult("MicroGram (microgram-likes-absolute-passive)")
    ensure_closed()

    try:
        # 1. Load scenario
        scenario = get("/scenarios/microgram-likes-absolute-passive")
        t.check("Load scenario", scenario["id"] == "microgram-likes-absolute-passive")

        # 2. Init
        body = build_init_body(scenario)
        init_resp = post("/init", body)
        t.check("POST /init", init_resp["success"] and init_resp["status"] == "ready",
                f"status={init_resp.get('status')}")

        # 4. Advance
        adv = get("/advance", params={"time": 30})
        t.check("GET /advance?time=30", adv["success"],
                f"sim_time={adv.get('simulation_time')}, processed={len(adv.get('processed_events', []))}")

        # 5. Fetch data endpoints
        config = get("/data/config")
        t.check("GET /data/config", config["environment"] == "microgram",
                f"env={config.get('environment')}")

        gram_posts = get("/data/microgram-posts")
        gp_count = len(gram_posts.get("posts", []))
        t.check("GET /data/microgram-posts", gp_count > 0, f"count={gp_count}")

        gram_stories = get("/data/microgram-stories")
        gs_count = len(gram_stories.get("stories", []))
        t.check("GET /data/microgram-stories", gs_count > 0, f"count={gs_count}")

        gram_messages = get("/data/microgram-messages")
        gm_count = len(gram_messages.get("messages", []))
        t.check("GET /data/microgram-messages", gm_count > 0, f"count={gm_count}")

        gram_activity = get("/data/microgram-activity")
        ga_count = len(gram_activity.get("activity", []))
        t.check("GET /data/microgram-activity", ga_count > 0, f"count={ga_count}")

        gram_followed = get("/data/microgram-followed-users")
        t.check("GET /data/microgram-followed-users", "followed_users" in gram_followed,
                f"count={len(gram_followed.get('followed_users', []))}")

        # 6. Mutations
        # Like a post
        if gram_posts["posts"]:
            gpid = gram_posts["posts"][0]["id"]
            like_resp = post(f"/data/microgram-posts/{gpid}/like")
            t.check(f"POST /data/microgram-posts/{gpid}/like", like_resp.get("success"),
                    f"isLiked={like_resp.get('isLiked')}")

            # Save a post
            save_resp = post(f"/data/microgram-posts/{gpid}/save")
            t.check(f"POST /data/microgram-posts/{gpid}/save", save_resp.get("success"),
                    f"isSaved={save_resp.get('isSaved')}")

            # Comment on a post
            comment_resp = post(f"/data/microgram-posts/{gpid}/comment", {"text": "Integration test comment"})
            t.check(f"POST /data/microgram-posts/{gpid}/comment", comment_resp.get("success"),
                    f"comment_id={comment_resp.get('comment', {}).get('id')}")

        # View a story
        if gram_stories["stories"]:
            gsid = gram_stories["stories"][0]["id"]
            view_resp = post(f"/data/microgram-stories/{gsid}/view")
            t.check(f"POST /data/microgram-stories/{gsid}/view", view_resp.get("success"))

        # Follow a user
        follow_resp = post("/data/microgram-users/user001/follow")
        t.check("POST /data/microgram-users/user001/follow", follow_resp.get("success"),
                f"isFollowed={follow_resp.get('isFollowed')}")

        # Advance to end
        adv2 = get("/advance", params={"time": 120})
        t.check("GET /advance?time=120", adv2["success"])

        # 7. Evaluate
        eval_resp = post("/evaluate")
        t.check("POST /evaluate", eval_resp.get("success") is not None,
                f"success={eval_resp.get('success')}")

        # 8. Close
        close = get("/close")
        t.check("GET /close", close["success"] and close["status"] == "preinit")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: MicroHood
# ---------------------------------------------------------------------------
def test_microhood():
    t = IntegrationResult("MicroHood (microhood-portfolio-absolute-passive)")
    ensure_closed()

    try:
        # 1. Load scenario
        scenario = get("/scenarios/microhood-portfolio-absolute-passive")
        t.check("Load scenario", scenario["id"] == "microhood-portfolio-absolute-passive")

        # 2. Init
        body = build_init_body(scenario)
        init_resp = post("/init", body)
        t.check("POST /init", init_resp["success"] and init_resp["status"] == "ready",
                f"status={init_resp.get('status')}")

        # 4. Advance
        adv = get("/advance", params={"time": 30})
        t.check("GET /advance?time=30", adv["success"],
                f"sim_time={adv.get('simulation_time')}, processed={len(adv.get('processed_events', []))}")

        # 5. Fetch data endpoints
        config = get("/data/config")
        t.check("GET /data/config", config["environment"] == "microhood",
                f"env={config.get('environment')}")

        stocks = get("/data/microhood-stocks")
        stock_count = len(stocks.get("stocks", []))
        t.check("GET /data/microhood-stocks", stock_count > 0, f"count={stock_count}")

        # Verify price interpolation fields
        if stocks["stocks"]:
            s0 = stocks["stocks"][0]
            has_price_fields = all(k in s0 for k in ["currentPrice", "change", "changePercent"])
            t.check("Stock has price interpolation fields", has_price_fields,
                    f"keys={list(s0.keys())}")

        watchlist = get("/data/microhood-watchlist")
        wl_count = len(watchlist.get("watchlist", []))
        t.check("GET /data/microhood-watchlist", wl_count > 0, f"count={wl_count}")
        if watchlist["watchlist"]:
            w0 = watchlist["watchlist"][0]
            has_watchlist_fields = all(k in w0 for k in ["price", "change", "changePercent"])
            t.check("Watchlist has price interpolation fields", has_watchlist_fields,
                f"keys={list(w0.keys())}")

        news = get("/data/microhood-news")
        news_count = len(news.get("news", []))
        t.check("GET /data/microhood-news", news_count > 0, f"count={news_count}")

        portfolio = get("/data/microhood-portfolio")
        t.check("GET /data/microhood-portfolio",
                all(k in portfolio for k in ["buying_power", "portfolio_value", "positions_value"]),
                f"buying_power={portfolio.get('buying_power')}, portfolio_value={portfolio.get('portfolio_value')}")

        # 6. Mutations
        # Buy a stock
        if stocks["stocks"]:
            symbol = stocks["stocks"][0]["symbol"]
            order_resp = post(f"/data/microhood-stocks/{symbol}/order",
                              {"action": "buy", "quantity": 1, "type": "market"})
            t.check(f"POST /data/microhood-stocks/{symbol}/order (buy)", order_resp.get("success"),
                    f"order={order_resp.get('order')}")

            # Sell it back
            sell_resp = post(f"/data/microhood-stocks/{symbol}/order",
                             {"action": "sell", "quantity": 1, "type": "market"})
            t.check(f"POST /data/microhood-stocks/{symbol}/order (sell)", sell_resp.get("success"),
                    f"order={sell_resp.get('order')}")

        # Toggle watchlist
        if watchlist["watchlist"]:
            wsym = watchlist["watchlist"][0]["symbol"]
            toggle_resp = post(f"/data/microhood-watchlist/{wsym}/toggle")
            t.check(f"POST /data/microhood-watchlist/{wsym}/toggle", toggle_resp.get("success"),
                    f"inWatchlist={toggle_resp.get('inWatchlist')}")

        # Advance to end
        adv2 = get("/advance", params={"time": 120})
        t.check("GET /advance?time=120", adv2["success"])

        # 7. Evaluate
        eval_resp = post("/evaluate")
        t.check("POST /evaluate", eval_resp.get("success") is not None,
                f"success={eval_resp.get('success')}")

        # 8. Close
        close = get("/close")
        t.check("GET /close", close["success"] and close["status"] == "preinit")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: MicroHub
# ---------------------------------------------------------------------------
def test_microhub():
    t = IntegrationResult("MicroHub (microhub-browse-absolute-passive)")
    ensure_closed()

    try:
        # 1. Load scenario
        scenario = get("/scenarios/microhub-browse-absolute-passive")
        t.check("Load scenario", scenario["id"] == "microhub-browse-absolute-passive",
                f"id={scenario.get('id')}")

        # 2. Init
        body = build_init_body(scenario)
        init_resp = post("/init", body)
        t.check("POST /init", init_resp["success"] and init_resp["status"] == "ready",
                f"status={init_resp.get('status')}")

        # 3. Advance
        adv = get("/advance", params={"time": 30})
        t.check("GET /advance?time=30", adv["success"],
                f"sim_time={adv.get('simulation_time')}, processed={len(adv.get('processed_events', []))}")

        # 4. Fetch data endpoints
        config = get("/data/config")
        t.check("GET /data/config", config["environment"] == "microhub",
                f"env={config.get('environment')}")

        repo = get("/data/microhub-repository")
        repo_data = repo.get("repository", {})
        t.check("GET /data/microhub-repository", repo_data.get("name") is not None,
                f"name={repo_data.get('name')}")

        files = get("/data/microhub-files")
        file_count = len(files.get("files", []))
        t.check("GET /data/microhub-files", file_count > 0, f"count={file_count}")

        issues = get("/data/microhub-issues")
        issue_count = len(issues.get("issues", []))
        t.check("GET /data/microhub-issues", issue_count > 0, f"count={issue_count}")

        pulls = get("/data/microhub-pulls")
        pr_count = len(pulls.get("prs", []))
        t.check("GET /data/microhub-pulls", pr_count >= 0, f"count={pr_count}")

        commits = get("/data/microhub-commits")
        commit_count = len(commits.get("commits", []))
        t.check("GET /data/microhub-commits", commit_count > 0, f"count={commit_count}")

        runs = get("/data/microhub-runs")
        run_count = len(runs.get("runs", []))
        t.check("GET /data/microhub-runs", run_count > 0, f"count={run_count}")

        workflows = get("/data/microhub-workflows")
        workflow_count = len(workflows.get("workflows", []))
        t.check("GET /data/microhub-workflows", workflow_count > 0, f"count={workflow_count}")

        wiki = get("/data/microhub-wiki")
        wiki_count = len(wiki.get("pages", []))
        t.check("GET /data/microhub-wiki", wiki_count > 0, f"count={wiki_count}")

        insights = get("/data/microhub-insights")
        insight_count = len(insights.get("insights", []))
        t.check("GET /data/microhub-insights", insight_count > 0, f"count={insight_count}")

        releases = get("/data/microhub-releases")
        t.check("GET /data/microhub-releases", "releases" in releases,
                f"count={len(releases.get('releases', []))}")

        security = get("/data/microhub-security")
        security_count = len(security.get("advisories", []))
        t.check("GET /data/microhub-security", security_count > 0, f"count={security_count}")

        code_scanning = get("/data/microhub-code-scanning")
        scan_count = len(code_scanning.get("alerts", []))
        t.check("GET /data/microhub-code-scanning", scan_count > 0, f"count={scan_count}")

        activity = get("/data/microhub-activity")
        t.check("GET /data/microhub-activity", "activity" in activity,
                f"count={len(activity.get('activity', []))}")

        # 5. Mutations
        # Star the repo
        star_resp = post("/data/microhub-repository/star")
        t.check("POST /data/microhub-repository/star", star_resp.get("success"),
                f"isStarred={star_resp.get('isStarred')}")

        # Watch the repo
        watch_resp = post("/data/microhub-repository/watch")
        t.check("POST /data/microhub-repository/watch", watch_resp.get("success"),
                f"isWatching={watch_resp.get('isWatching')}")

        # Comment on an issue
        if issues["issues"]:
            iid = issues["issues"][0]["id"]
            comment_resp = post(f"/data/microhub-issues/{iid}/comment",
                                {"body": "Integration test comment"})
            t.check(f"POST /data/microhub-issues/{iid}/comment", comment_resp.get("success"))

        # Comment on a PR
        if pulls.get("prs"):
            prid = pulls["prs"][0]["id"]
            pr_comment = post(f"/data/microhub-pulls/{prid}/comment",
                              {"body": "Integration test PR comment"})
            t.check(f"POST /data/microhub-pulls/{prid}/comment", pr_comment.get("success"))

        # Advance to end
        adv2 = get("/advance", params={"time": 120})
        t.check("GET /advance?time=120", adv2["success"])

        # 6. Evaluate
        eval_resp = post("/evaluate")
        t.check("POST /evaluate", eval_resp.get("success") is not None,
                f"success={eval_resp.get('success')}")

        # 7. Close
        close = get("/close")
        t.check("GET /close", close["success"] and close["status"] == "preinit")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: MicroLendar
# ---------------------------------------------------------------------------
def test_microlendar():
    t = IntegrationResult("MicroLendar (microlendar-events-absolute-passive)")
    ensure_closed()

    try:
        # 1. Load scenario
        scenario = get("/scenarios/microlendar-events-absolute-passive")
        t.check("Load scenario", scenario["id"] == "microlendar-events-absolute-passive",
                f"id={scenario.get('id')}")

        # 2. Init
        body = build_init_body(scenario)
        init_resp = post("/init", body)
        t.check("POST /init", init_resp["success"] and init_resp["status"] == "ready",
                f"status={init_resp.get('status')}")

        # 3. Advance
        adv = get("/advance", params={"time": 30})
        t.check("GET /advance?time=30", adv["success"],
                f"sim_time={adv.get('simulation_time')}, processed={len(adv.get('processed_events', []))}")

        # 4. Fetch data endpoints
        config = get("/data/config")
        t.check("GET /data/config", config["environment"] == "microlendar",
                f"env={config.get('environment')}")

        events = get("/data/microlendar-events")
        event_count = len(events.get("events", []))
        t.check("GET /data/microlendar-events", event_count > 0, f"count={event_count}")

        tasks = get("/data/microlendar-tasks")
        task_count = len(tasks.get("tasks", []))
        t.check("GET /data/microlendar-tasks", task_count > 0, f"count={task_count}")

        # 5. Mutations
        # Create an event
        create_event = post("/data/microlendar-events", {
            "title": "Integration Test Event",
            "date": "2026-04-01",
            "startTime": "10:00",
            "endTime": "11:00",
        })
        t.check("POST /data/microlendar-events (create)", create_event.get("success"),
                f"id={create_event.get('event', {}).get('id')}")

        # Update an event
        if events["events"]:
            eid = events["events"][0]["id"]
            update_resp = post(f"/data/microlendar-events/{eid}/update",
                               {"title": "Updated Event Title"})
            t.check(f"POST /data/microlendar-events/{eid}/update", update_resp.get("success"))

        # Create a task
        create_task = post("/data/microlendar-tasks", {
            "title": "Integration Test Task",
            "dueDate": "2026-04-01",
        })
        t.check("POST /data/microlendar-tasks (create)", create_task.get("success"),
                f"id={create_task.get('task', {}).get('id')}")

        # Complete a task
        if tasks["tasks"]:
            tid = tasks["tasks"][0]["id"]
            complete_resp = post(f"/data/microlendar-tasks/{tid}/complete")
            t.check(f"POST /data/microlendar-tasks/{tid}/complete", complete_resp.get("success"))

        # Advance to end
        adv2 = get("/advance", params={"time": 120})
        t.check("GET /advance?time=120", adv2["success"])

        # 6. Evaluate
        eval_resp = post("/evaluate")
        t.check("POST /evaluate", eval_resp.get("success") is not None,
                f"success={eval_resp.get('success')}")

        # 7. Close
        close = get("/close")
        t.check("GET /close", close["success"] and close["status"] == "preinit")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: MicroScholar
# ---------------------------------------------------------------------------
def test_microscholar():
    t = IntegrationResult("MicroScholar (microscholar-search-absolute-passive)")
    ensure_closed()

    try:
        # 1. Load scenario
        scenario = get("/scenarios/microscholar-search-absolute-passive")
        t.check("Load scenario", scenario["id"] == "microscholar-search-absolute-passive",
                f"id={scenario.get('id')}")

        # 2. Init
        body = build_init_body(scenario)
        init_resp = post("/init", body)
        t.check("POST /init", init_resp["success"] and init_resp["status"] == "ready",
                f"status={init_resp.get('status')}")

        # 3. Advance
        adv = get("/advance", params={"time": 30})
        t.check("GET /advance?time=30", adv["success"],
                f"sim_time={adv.get('simulation_time')}, processed={len(adv.get('processed_events', []))}")

        # 4. Fetch data endpoints
        config = get("/data/config")
        t.check("GET /data/config", config["environment"] == "microscholar",
                f"env={config.get('environment')}")

        papers = get("/data/microscholar-papers")
        paper_count = len(papers.get("papers", []))
        t.check("GET /data/microscholar-papers", paper_count > 0, f"count={paper_count}")

        alerts = get("/data/microscholar-alerts")
        t.check("GET /data/microscholar-alerts", "alerts" in alerts,
                f"count={len(alerts.get('alerts', []))}")

        coauthors = get("/data/microscholar-coauthors")
        coauthor_count = len(coauthors.get("coauthors", []))
        t.check("GET /data/microscholar-coauthors", coauthor_count > 0, f"count={coauthor_count}")

        # Fetch single paper
        if papers["papers"]:
            pid = papers["papers"][0]["id"]
            single = get(f"/data/microscholar-papers/{pid}")
            t.check(f"GET /data/microscholar-papers/{pid}",
                    single.get("paper", {}).get("id") == pid,
                    f"id={single.get('paper', {}).get('id')}")

        # 5. Mutations
        # Cite a paper
        if papers["papers"]:
            pid = papers["papers"][0]["id"]
            cite_resp = post(f"/data/microscholar-papers/{pid}/cite")
            t.check(f"POST /data/microscholar-papers/{pid}/cite", cite_resp.get("success"))

            # Save a paper
            save_resp = post(f"/data/microscholar-papers/{pid}/save")
            t.check(f"POST /data/microscholar-papers/{pid}/save", save_resp.get("success"),
                    f"isSaved={save_resp.get('isSaved')}")

        # Read an alert
        if alerts["alerts"]:
            aid = alerts["alerts"][0]["id"]
            read_resp = post(f"/data/microscholar-alerts/{aid}/read")
            t.check(f"POST /data/microscholar-alerts/{aid}/read", read_resp.get("success"))

        # Advance to end
        adv2 = get("/advance", params={"time": 120})
        t.check("GET /advance?time=120", adv2["success"])

        # 6. Evaluate
        eval_resp = post("/evaluate")
        t.check("POST /evaluate", eval_resp.get("success") is not None,
                f"success={eval_resp.get('success')}")

        # 7. Close
        close = get("/close")
        t.check("GET /close", close["success"] and close["status"] == "preinit")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: MicroTube
# ---------------------------------------------------------------------------
def test_microtube():
    t = IntegrationResult("MicroTube (microtube-subscribers-absolute-passive)")
    ensure_closed()

    try:
        # 1. Load scenario
        scenario = get("/scenarios/microtube-subscribers-absolute-passive")
        t.check("Load scenario", scenario["id"] == "microtube-subscribers-absolute-passive",
                f"id={scenario.get('id')}")

        # 2. Init
        body = build_init_body(scenario)
        init_resp = post("/init", body)
        t.check("POST /init", init_resp["success"] and init_resp["status"] == "ready",
                f"status={init_resp.get('status')}")

        # 3. Advance
        adv = get("/advance", params={"time": 30})
        t.check("GET /advance?time=30", adv["success"],
                f"sim_time={adv.get('simulation_time')}, processed={len(adv.get('processed_events', []))}")

        # 4. Fetch data endpoints
        config = get("/data/config")
        t.check("GET /data/config", config["environment"] == "microtube",
                f"env={config.get('environment')}")

        videos = get("/data/microtube-videos")
        video_count = len(videos.get("videos", []))
        t.check("GET /data/microtube-videos", video_count > 0, f"count={video_count}")

        channels = get("/data/microtube-channels")
        channel_count = len(channels.get("channels", []))
        t.check("GET /data/microtube-channels", channel_count > 0, f"count={channel_count}")

        comments = get("/data/microtube-comments")
        t.check("GET /data/microtube-comments", "comments" in comments,
                f"count={len(comments.get('comments', []))}")

        notifications = get("/data/microtube-notifications")
        notif_count = len(notifications.get("notifications", []))
        t.check("GET /data/microtube-notifications", notif_count >= 0,
                f"count={notif_count}")

        playlists = get("/data/microtube-playlists")
        t.check("GET /data/microtube-playlists", "playlists" in playlists,
                f"count={len(playlists.get('playlists', []))}")

        # Fetch single video
        if videos["videos"]:
            vid = videos["videos"][0]["id"]
            single = get(f"/data/microtube-videos/{vid}")
            t.check(f"GET /data/microtube-videos/{vid}",
                    single.get("video", {}).get("id") == vid,
                    f"id={single.get('video', {}).get('id')}")

        # Fetch single channel
        if channels["channels"]:
            chid = channels["channels"][0]["id"]
            single_ch = get(f"/data/microtube-channels/{chid}")
            t.check(f"GET /data/microtube-channels/{chid}",
                    single_ch.get("channel", {}).get("id") == chid,
                    f"id={single_ch.get('channel', {}).get('id')}")

        # 5. Mutations
        # Like a video
        if videos["videos"]:
            vid = videos["videos"][0]["id"]
            like_resp = post(f"/data/microtube-videos/{vid}/like")
            t.check(f"POST /data/microtube-videos/{vid}/like", like_resp.get("success"),
                    f"isLiked={like_resp.get('isLiked')}")

            # Watch a video
            watch_resp = post(f"/data/microtube-videos/{vid}/watch")
            t.check(f"POST /data/microtube-videos/{vid}/watch", watch_resp.get("success"))

            # Save a video
            save_resp = post(f"/data/microtube-videos/{vid}/save")
            t.check(f"POST /data/microtube-videos/{vid}/save", save_resp.get("success"),
                    f"isSaved={save_resp.get('isSaved')}")

        # Subscribe to a channel
        if channels["channels"]:
            chid = channels["channels"][0]["id"]
            sub_resp = post(f"/data/microtube-channels/{chid}/subscribe")
            t.check(f"POST /data/microtube-channels/{chid}/subscribe", sub_resp.get("success"),
                    f"isSubscribed={sub_resp.get('isSubscribed')}")

        # Post a comment
        if videos["videos"]:
            vid = videos["videos"][0]["id"]
            comment_resp = post("/data/microtube-comments",
                                {"video_id": vid, "content": "Integration test comment"})
            t.check("POST /data/microtube-comments (create)", comment_resp.get("success"))

        # Read a notification
        if notifications["notifications"]:
            nid = notifications["notifications"][0]["id"]
            nread_resp = post(f"/data/microtube-notifications/{nid}/read")
            t.check(f"POST /data/microtube-notifications/{nid}/read", nread_resp.get("success"))

        # Advance to end
        adv2 = get("/advance", params={"time": 120})
        t.check("GET /advance?time=120", adv2["success"])

        # 6. Evaluate
        eval_resp = post("/evaluate")
        t.check("POST /evaluate", eval_resp.get("success") is not None,
                f"success={eval_resp.get('success')}")

        # 7. Close
        close = get("/close")
        t.check("GET /close", close["success"] and close["status"] == "preinit")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: supported dedicated item endpoints
# ---------------------------------------------------------------------------
def test_supported_item_actions():
    t = IntegrationResult("Supported item endpoints")
    ensure_closed()

    try:
        # Test a supported per-email action with MicroMail
        scenario = get("/scenarios/micromail-unread-absolute-passive")
        body = build_init_body(scenario)
        init_resp = post("/init", body)
        t.check("Init MicroMail for endpoint test", init_resp["success"])

        adv = get("/advance", params={"time": 60})
        t.check("Advance to deliver emails", adv["success"])

        emails = get("/data/micromail-emails").get("emails", [])
        unread = next((e for e in emails if not e.get("isRead", False)), None)
        t.check("Find unread MicroMail email", unread is not None)

        if unread is not None:
            read_resp = post(f"/data/micromail-emails/{unread['id']}/read")
            t.check("POST /data/micromail-emails/{id}/read", read_resp.get("success"),
                    f"response={read_resp}")

            emails_after = get("/data/micromail-emails").get("emails", [])
            updated = next((e for e in emails_after if e.get("id") == unread["id"]), None)
            t.check("MicroMail email marked as read",
                    updated is not None and updated.get("isRead") is True,
                    f"updated={updated}")

        close = get("/close")
        t.check("Close after MicroMail endpoint test", close["success"])

        # Test a supported per-issue action with MicroHub
        scenario2 = get("/scenarios/microhub-browse-absolute-passive")
        body2 = build_init_body(scenario2)
        init_resp2 = post("/init", body2)
        t.check("Init MicroHub for endpoint test", init_resp2["success"])

        adv2 = get("/advance", params={"time": 30})
        t.check("Advance MicroHub", adv2["success"])

        issues = get("/data/microhub-issues").get("issues", [])
        open_issue = next((i for i in issues if i.get("state") == "open"), None)
        t.check("Find open MicroHub issue", open_issue is not None)

        if open_issue is not None:
            close_issue_resp = post(f"/data/microhub-issues/{open_issue['id']}/close")
            t.check("POST /data/microhub-issues/{id}/close", close_issue_resp.get("success"),
                    f"response={close_issue_resp}")

            issues_after = get("/data/microhub-issues").get("issues", [])
            updated_issue = next((i for i in issues_after if i.get("id") == open_issue["id"]), None)
            t.check("MicroHub issue closed",
                    updated_issue is not None and updated_issue.get("state") == "closed",
                    f"updated={updated_issue}")

        close2 = get("/close")
        t.check("Close after MicroHub endpoint test", close2["success"])

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: State machine edge cases
# ---------------------------------------------------------------------------
def test_state_machine():
    t = IntegrationResult("State Machine (cross-cutting)")
    ensure_closed()

    try:
        # Verify preinit status
        status = get("/status")
        t.check("Initial status is preinit", status["status"] == "preinit")

        # /advance before /init should fail
        try:
            get("/advance", params={"time": 10})
            t.check("/advance before /init returns 409", False, "Expected 409 but got 200")
        except requests.HTTPError as e:
            t.check("/advance before /init returns 409", e.response.status_code == 409,
                    f"status={e.response.status_code}")

        # /data/config before /init should fail
        try:
            get("/data/config")
            t.check("/data/config before /init returns 409", False, "Expected 409 but got 200")
        except requests.HTTPError as e:
            t.check("/data/config before /init returns 409", e.response.status_code == 409,
                    f"status={e.response.status_code}")

        # /close should still work (idempotent)
        close = get("/close")
        t.check("/close in preinit", close["success"])

    except Exception as e:
        t.check("EXCEPTION", False, str(e))

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: /play endpoint
# ---------------------------------------------------------------------------
def test_play_endpoint():
    t = IntegrationResult("Play endpoint")
    ensure_closed()

    try:
        scenario = get("/scenarios/micromail-unread-absolute-passive")
        init_resp = post("/init", build_init_body(scenario))
        t.check("POST /init", init_resp["success"] and init_resp["status"] == "ready",
                f"status={init_resp.get('status')}")

        play_resp = get("/play")
        t.check("GET /play", play_resp.get("success") and play_resp.get("status") == "running_auto",
                f"status={play_resp.get('status')}, next_event_time={play_resp.get('next_event_time')}")

        time.sleep(0.25)
        status = get("/status")
        t.check("/status reflects running or completed after /play",
                status.get("status") in ("running_auto", "completed"),
                f"status={status.get('status')}")

        close = get("/close")
        t.check("GET /close", close["success"] and close["status"] == "preinit")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()


# ---------------------------------------------------------------------------
# Test: event branch coverage for scenario-only event types
# ---------------------------------------------------------------------------
def test_event_branch_coverage():
    t = IntegrationResult("Event branch coverage")

    try:
        ensure_closed()
        microchat_call_id = next(iter(MICROCHAT_CALL_CATALOG))
        body = build_manual_init_body("microchat", [
            {"time": 1, "type": "new_call", "payload": {"call_id": microchat_call_id}},
        ])
        post("/init", body)
        get("/advance", params={"time": 2})
        calls = get("/data/microchat-calls")
        call_ids = {call["id"] for call in calls.get("calls", [])}
        t.check("MicroChat new_call event loads call", microchat_call_id in call_ids,
                f"count={len(call_ids)}")
        get("/close")

        microfy_playlist_id = next(iter(MICROFY_PLAYLIST_CATALOG))
        body = build_manual_init_body("microfy", [
            {"time": 1, "type": "new_playlist", "payload": {"playlist_id": microfy_playlist_id}},
        ])
        post("/init", body)
        get("/advance", params={"time": 2})
        playlists = get("/data/microfy-playlists")
        playlist_ids = {playlist["id"] for playlist in playlists.get("playlists", [])}
        t.check("MicroFy new_playlist event loads playlist", microfy_playlist_id in playlist_ids,
                f"count={len(playlist_ids)}")
        get("/close")

        microdin_message_id = next(iter(MICRODIN_MESSAGE_CATALOG))
        body = build_manual_init_body("microdin", [
            {"time": 1, "type": "new_message", "payload": {"message_id": microdin_message_id}},
        ])
        post("/init", body)
        get("/advance", params={"time": 2})
        conversations = get("/data/microdin-conversations")
        din_message_ids = {
            message["id"]
            for conversation in conversations.get("conversations", [])
            for message in conversation.get("messages", [])
        }
        t.check("MicroDin new_message event loads conversation message", microdin_message_id in din_message_ids,
                f"count={len(din_message_ids)}")
        get("/close")

        microgram_message_id = next(iter(MICROGRAM_MESSAGE_CATALOG))
        body = build_manual_init_body("microgram", [
            {"time": 1, "type": "new_message", "payload": {"message_id": microgram_message_id}},
        ])
        post("/init", body)
        get("/advance", params={"time": 2})
        gram_messages = get("/data/microgram-messages")
        gram_message_ids = {message["id"] for message in gram_messages.get("messages", [])}
        t.check("MicroGram new_message event loads direct message", microgram_message_id in gram_message_ids,
                f"count={len(gram_message_ids)}")
        get("/close")

        microtube_video_id = next(iter(MICROTUBE_VIDEO_CATALOG))
        body = build_manual_init_body("microtube", [
            {"time": 1, "type": "new_video", "payload": {"video_id": microtube_video_id}},
        ])
        post("/init", body)
        get("/advance", params={"time": 2})
        videos = get("/data/microtube-videos")
        video_ids = {video["id"] for video in videos.get("videos", [])}
        t.check("MicroTube new_video event loads video", microtube_video_id in video_ids,
                f"count={len(video_ids)}")
        get("/close")

        microtube_comment_id = next(iter(MICROTUBE_COMMENT_CATALOG))
        body = build_manual_init_body("microtube", [
            {"time": 1, "type": "new_comment", "payload": {"comment_id": microtube_comment_id}},
        ])
        post("/init", body)
        get("/advance", params={"time": 2})
        comments = get("/data/microtube-comments")
        comment_ids = {comment["id"] for comment in comments.get("comments", [])}
        t.check("MicroTube new_comment event loads comment", microtube_comment_id in comment_ids,
                f"count={len(comment_ids)}")
        get("/close")

    except Exception as e:
        t.check("EXCEPTION", False, str(e))
        try:
            get("/close")
        except Exception:
            pass

    assert t.passed, "\n" + t.report()
