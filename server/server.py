# the main fastapi application. defines all api routes and manages the simulation lifecycle.
# on startup, calls catalogs.load_catalogs() to populate in-memory data.
# routes use schemas.py for request/response validation and delegate business logic to handlers/.
# holds a single global Session (from session.py) representing the current simulation.
#
# lifecycle: /init (create session) -> /advance (tick time, fire events) -> /close (tear down)
# flow: client -> server.py route -> schemas.py validates -> handler processes -> session.py mutates
# example: GET /micromail/emails -> server.py -> micromail handler reads catalogs + session -> MicromailEmailResponse

from __future__ import annotations

import asyncio
import datetime
import json
import os
import sqlite3
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Form, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response

from server.catalogs import (
    MICRODIN_COMPANY_CATALOG,
    MICROFY_ARTIST_CATALOG,
    MICROHOOD_STOCK_CATALOG,
    USER_CATALOG,
    load_catalogs,
)
from server.handlers import micromail as micromail_handler
from server.handlers import microchat as microchat_handler
from server.handlers import microdin as microdin_handler
from server.handlers import microfy as microfy_handler
from server.handlers import microgram as microgram_handler
from server.handlers import microhood as microhood_handler
from server.handlers import microhub as microhub_handler
from server.handlers import microlendar as microlendar_handler
from server.handlers import microscholar as microscholar_handler
from server.handlers import microtube as microtube_handler
from server.schemas import (

    CommentResponse,
    ConfigResponse,
    CreateEventResponse,
    CreatePlaylistResponse,
    CreateTaskResponse,
    EvaluateResponse,
    ForkResponse,
    InitPayload,
    MergeResponse,
    MicrochatCallsResponse,
    MicrochatConversationsResponse,
    MicrochatMessagesResponse,
    MicrochatReactRequest,
    MicrochatTeamsResponse,
    MicrodinCompaniesResponse,
    MicrodinConnectionsResponse,
    MicrodinConversationsResponse,
    MicrodinCreateConversationResponse,
    MicrodinProfileSectionResponse,
    MicrodinProfileSectionsResponse,
    MicrodinJobsResponse,
    MicrodinNotificationsResponse,
    MicrodinPostsResponse,
    MicrodinNetworkResponse,
    MicrofyAddToPlaylistRequest,
    MicrofyArtistsResponse,
    MicrofyCreatePlaylistRequest,
    MicrofyFollowedArtistsResponse,
    MicrofyMoodsResponse,
    MicrofyPlaylistsResponse,
    MicrofyTracksResponse,
    MicrogramActivityResponse,
    MicrogramCommentRequest,
    MicrogramFollowedUsersResponse,
    MicrogramMessagesResponse,
    MicrogramPostsResponse,
    MicrogramStoriesResponse,
    MicrogramUsersResponse,
    MicrohoodNewsResponse,
    MicrohoodOrderRequest,
    MicrohoodPortfolioResponse,
    MicrohoodStocksResponse,
    MicrohoodWatchlistResponse,
    MicrohubActivityResponse,
    MicrohubCodeScanningResponse,
    MicrohubCommentRequest,
    MicrohubCommitsResponse,
    MicrohubCreateIssueRequest,
    MicrohubCreateIssueResponse,
    MicrohubCreateRepoRequest,
    MicrohubCreateRepoResponse,
    MicrohubUserCreatedReposResponse,
    MicrohubDeploymentsResponse,
    MicrohubFilesResponse,
    MicrohubFollowingResponse,
    MicrohubInsightsResponse,
    MicrohubIssuesResponse,
    MicrohubLabelsResponse,
    MicrohubMergeRequest,
    MicrohubPackagesResponse,
    MicrohubProjectsResponse,
    MicrohubPrsResponse,
    MicrohubReleasesResponse,
    MicrohubRepositoryResponse,
    MicrohubRunsResponse,
    MicrohubSecurityResponse,
    MicrohubSettingsResponse,
    MicrohubUsersResponse,
    MicrohubWikiResponse,
    MicrohubWorkflowsResponse,
    MicrolendarCreateEventRequest,
    MicrolendarCreateTaskRequest,
    MicrolendarEventsResponse,
    MicrolendarTasksResponse,
    MicrolendarUpdateEventRequest,
    MicromailEmailResponse,
    MicromailMoveEmailRequest,
    MicromailSendEmailRequest,
    MicromailSendEmailResponse,
    MicroscholarAlertsResponse,
    MicroscholarCoauthorsResponse,
    MicroscholarPaperDetailResponse,
    MicroscholarPapersResponse,
    MicroscholarUsersResponse,
    MicrotubeAddToPlaylistRequest,
    MicrotubeChannelDetailResponse,
    MicrotubeChannelsResponse,
    MicrotubeCommentRequest,
    MicrotubeCommentsResponse,
    MicrotubeCreatePlaylistRequest,
    MicrotubeNotificationsResponse,
    MicrotubePlaylistsResponse,
    MicrotubeVideoDetailResponse,
    MicrotubeVideosResponse,
    OrderResponse,
    StarResponse,
    StateChangeResponse,
    SuccessResponse,
    ToggleCompleteResponse,
    ToggleDislikeResponse,
    ToggleFollowResponse,
    ToggleFollowingResponse,
    ToggleLikeResponse,
    ToggleMuteResponse,
    TogglePinResponse,
    ToggleSaveResponse,
    ToggleSubscribeResponse,
    ToggleWatchlistResponse,
    UsersResponse,
    WatchResponse,
)
from server.session import Session, build_event_timeline

_SHARED_DB = Path(__file__).parent / "shared.db"
_SCENARIOS: dict[str, dict] = {}

STATE_STARTING = "starting"
STATE_PREINIT = "preinit"
STATE_READY = "ready"
STATE_RUNNING_AUTO = "running_auto"
STATE_RUNNING_MANUAL = "running_manual"
STATE_COMPLETED = "completed"  # terminal state after /evaluate, /contact, or no more events

app = FastAPI(title="Sentinel API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global simulation state -- one active session at a time, matching Docker protocol
_state: str = STATE_STARTING
_session: Optional[Session] = None
_run_task: Optional[asyncio.Task] = None


_ENV_NAMES = [
    "micromail", "microchat", "microdin", "microfy", "microgram",
    "microhood", "microhub", "microlendar", "microscholar", "microtube",
]
_REPO_ROOT = Path(__file__).resolve().parent.parent
_SCENARIO_DIRS = {
    name: _REPO_ROOT / "scenarios" / name for name in _ENV_NAMES
}


def _load_scenarios() -> None:
    for scenario_dir in _SCENARIO_DIRS.values():
        if not scenario_dir.exists():
            continue
        for path in scenario_dir.glob("*.json"):
            if path.name == "dev.json":
                continue
            with open(path, encoding="utf-8") as f:
                scenario = json.load(f)
            _SCENARIOS[scenario["id"]] = scenario


def _build_dev_session(dev_value: str) -> Optional[Session]:
    """Build a pre-populated session for dev mode (SENTINEL_DEV env var).

    Returns a Session with all events fired, or None if no dev.json found.
    - "all" or "1": load dev.json for every environment
    - "<env name>":  load dev.json for that single environment
    """
    val = dev_value.strip().lower()
    if val in ("all", "1", "true"):
        env_names = _ENV_NAMES
    elif val in _ENV_NAMES:
        env_names = [val]
    else:
        print(f"[DEV] Unknown SENTINEL_DEV value: {dev_value!r}")
        print(f"[DEV] Use 'all', '1', or one of: {', '.join(_ENV_NAMES)}")
        return None

    session = Session(
        status=STATE_READY,
        simulation_time=0,
        start_wall_time=None,
        events=[],
        next_event_index=0,
        environment=env_names[0],
        event_timeline_end=9999,
        eval_sql="",
        baseline_metrics={},
    )

    loaded = []
    for env_name in env_names:
        dev_path = _SCENARIO_DIRS[env_name] / "dev.json"
        if not dev_path.exists():
            print(f"[DEV] No dev.json for {env_name}, skipping")
            continue
        with open(dev_path, encoding="utf-8") as f:
            dev_scenario = json.load(f)
        session.environment = env_name
        for event in build_event_timeline(dev_scenario["events"]):
            _dispatch_process_event(session, event)
        loaded.append(env_name)

    if not loaded:
        print("[DEV] No dev.json files found, skipping auto-init")
        return None

    session.environment = loaded[0] if len(loaded) == 1 else "all"
    print(f"[DEV] Loaded: {', '.join(loaded)}")
    return session


@app.on_event("startup")
def _startup() -> None:
    global _state, _session
    load_catalogs()
    _load_scenarios()
    _state = STATE_PREINIT

    dev = os.getenv("SENTINEL_DEV")
    if dev:
        session = _build_dev_session(dev)
        if session is not None:
            _session = session
            _state = STATE_READY


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_session() -> Session:
    if _session is None:
        raise HTTPException(status_code=409, detail="No active simulation. Call /init first.")
    return _session


def _next_event_time(session: Session) -> Optional[float]:
    idx = session.next_event_index
    if idx < len(session.events):
        return float(session.events[idx]["time"])
    return None


def _dispatch_process_event(session: Session, event: dict) -> None:
    if session.environment == "micromail":
        micromail_handler.process_event(session, event)
    elif session.environment == "microchat":
        microchat_handler.process_event(session, event)
    elif session.environment == "microdin":
        microdin_handler.process_event(session, event)
    elif session.environment == "microfy":
        microfy_handler.process_event(session, event)
    elif session.environment == "microgram":
        microgram_handler.process_event(session, event)
    elif session.environment == "microhood":
        microhood_handler.process_event(session, event)
    elif session.environment == "microhub":
        microhub_handler.process_event(session, event)
    elif session.environment == "microlendar":
        microlendar_handler.process_event(session, event)
    elif session.environment == "microscholar":
        microscholar_handler.process_event(session, event)
    elif session.environment == "microtube":
        microtube_handler.process_event(session, event)
    else:
        raise ValueError(f"Unknown environment: {session.environment}")



def _advance_session(session: Session, up_to_time: float) -> list[dict]:
    processed = []
    while session.next_event_index < len(session.events):
        event = session.events[session.next_event_index]
        if event["time"] > up_to_time:
            break
        _dispatch_process_event(session, event)
        processed.append(event)
        session.next_event_index += 1
    session.simulation_time = up_to_time
    return processed


async def _run_auto(session: Session) -> None:
    global _state, _run_task
    try:
        while session.next_event_index < len(session.events):
            await asyncio.sleep(0.25)
            if _state == STATE_COMPLETED:
                # Stop if we've reached a terminal state (e.g. after /evaluate or /contact)
                break
            assert session.start_wall_time is not None and session.start_wall_time > 0
            wall_elapsed = time.time() - session.start_wall_time
            _advance_session(session, wall_elapsed)
        _state = STATE_COMPLETED
    finally:
        if _run_task is asyncio.current_task():
            _run_task = None


# ---------------------------------------------------------------------------
# Harness endpoints -- flat protocol matching Docker server
# ---------------------------------------------------------------------------

@app.get("/status")
async def status() -> JSONResponse:
    net = _next_event_time(_session) if _session else None
    result: dict = {
        "success": True,
        "status": _state,
        "simulation_time": round(_session.simulation_time, 2) if _session else 0,
        "next_event_time": net,
    }
    return JSONResponse(content=result)


@app.post("/init")
async def init(payload: InitPayload) -> JSONResponse:
    global _state, _session

    if _state != STATE_PREINIT:
        raise HTTPException(
            status_code=409,
            detail=f"Wrong state: /init must be called in state '{STATE_PREINIT}'. Current: '{_state}'.",
        )

    events = build_event_timeline([e.model_dump() for e in payload.events])

    # speed_factor is applied once, at load time: authored event times (and
    # anything measured on the same clock) are divided by speed_factor so the
    # whole timeline compresses or expands. After this, wall-clock == sim-clock.
    sf = payload.speed_factor
    for event in events:
        event["time"] = event["time"] / sf
    scaled_condition_at = (
        payload.condition_at / sf if payload.condition_at is not None else None
    )
    scaled_timeline_end = payload.event_timeline_end / sf

    _session = Session(
        status=STATE_READY,
        simulation_time=0,
        start_wall_time=None,
        events=events,
        next_event_index=0,
        environment=payload.environment,
        event_timeline_end=scaled_timeline_end,
        eval_sql=payload.eval_sql,
        condition_at=scaled_condition_at,
        speed_factor=sf,
        baseline_metrics={},
    )

    # Process t=0 preload events immediately
    _advance_session(_session, 0)
    _state = STATE_READY

    return JSONResponse(content={
        "success": True,
        "status": _state,
        "simulation_time": _session.simulation_time,
        "next_event_time": _next_event_time(_session),
    })


@app.get("/advance")
async def advance(time: float) -> JSONResponse:
    global _state
    session = _require_session()

    if _state not in (STATE_READY, STATE_RUNNING_MANUAL):
        raise HTTPException(
            status_code=409,
            detail=f"Wrong state: /advance requires '{STATE_READY}' or '{STATE_RUNNING_MANUAL}'. Current: '{_state}'.",
        )

    _state = STATE_RUNNING_MANUAL
    processed = _advance_session(session, time)

    return JSONResponse(content={
        "success": True,
        "status": _state,
        "simulation_time": session.simulation_time,
        "next_event_time": _next_event_time(session),
        "processed_events": processed,
    })


@app.get("/play")
async def play() -> JSONResponse:
    global _state, _run_task
    session = _require_session()

    if _state not in (STATE_READY, STATE_RUNNING_MANUAL):
        raise HTTPException(
            status_code=409,
            detail=f"Wrong state: /play requires '{STATE_READY}' or '{STATE_RUNNING_MANUAL}'. Current: '{_state}'.",
        )

    _state = STATE_RUNNING_AUTO
    session.start_wall_time = time.time()
    _run_task = asyncio.create_task(_run_auto(session))

    return JSONResponse(content={
        "success": True,
        "status": _state,
        "simulation_time": session.simulation_time,
        "next_event_time": _next_event_time(session),
    })


@app.get("/redirect")
async def redirect(
    request: Request,
    frontend_url: Optional[str] = Query(None),
) -> RedirectResponse:
    global _state, _run_task
    session = _require_session()

    if _state not in (STATE_READY, STATE_RUNNING_MANUAL):
        raise HTTPException(
            status_code=409,
            detail=f"Wrong state: /redirect requires '{STATE_READY}' or '{STATE_RUNNING_MANUAL}'. Current: '{_state}'.",
        )

    _state = STATE_RUNNING_AUTO
    session.start_wall_time = time.time()
    _run_task = asyncio.create_task(_run_auto(session))

    redirect_origin = frontend_url or f"{request.url.scheme}://{request.url.hostname}:5173"
    url = f"{redirect_origin}/{session.environment}"
    return RedirectResponse(url=url, status_code=302)


_CONTACT_FORM_HTML = """<!doctype html>
<html><head><meta charset="utf-8"><title>Contact</title></head>
<body>
<form method="post" action="/contact">
  <label for="message">Submit your message here: </label><br>
  <textarea id="message" name="message" rows="10" cols="60"></textarea><br>
  <button type="submit">Submit</button>
</form>
</body></html>
"""

_CONTACT_THANKS_HTML = """<!doctype html>
<html><head><meta charset="utf-8"><title>Thank you</title></head>
<body><p>Thank you for your message. The task is now complete.</p></body></html>
"""


@app.get("/contact")
async def contact_get() -> HTMLResponse:
    global _state
    session = _require_session()
    # Allow the contact form to be reloaded or revisited after completion
    if _state not in (STATE_READY, STATE_RUNNING_AUTO, STATE_RUNNING_MANUAL, STATE_COMPLETED):
        raise HTTPException(
            status_code=409,
            detail=f"Wrong state: /contact requires an active session. Current: '{_state}'.",
        )
    _state = STATE_COMPLETED
    if session.contact_get_time is None:
        session.contact_get_time = int(session.simulation_time)
    return HTMLResponse(content=_CONTACT_FORM_HTML)


@app.post("/contact")
async def contact_post(message: str = Form("")) -> HTMLResponse:
    global _state
    session = _require_session()
    # Allow the contact form to be reloaded or revisited after completion
    if _state not in (STATE_READY, STATE_RUNNING_AUTO, STATE_RUNNING_MANUAL, STATE_COMPLETED):
        raise HTTPException(
            status_code=409,
            detail=f"Wrong state: /contact requires an active session. Current: '{_state}'.",
        )
    _state = STATE_COMPLETED
    if session.contact_post_time is None:
        session.contact_post_time = int(session.simulation_time)
        session.contact_message = message
    return HTMLResponse(content=_CONTACT_THANKS_HTML)


@app.get("/close")
async def close() -> JSONResponse:
    global _state, _session, _run_task
    if _run_task is not None and not _run_task.done():
        _run_task.cancel()
        try:
            await _run_task
        except (asyncio.CancelledError, Exception):
            pass
    _run_task = None
    _session = None
    _state = STATE_PREINIT  # Ready to accept a new /init
    return JSONResponse(content={"success": True, "status": _state})


# ---------------------------------------------------------------------------
# Data endpoints -- shared
# ---------------------------------------------------------------------------

@app.get("/data/config", response_model=ConfigResponse)
async def data_config(request: Request) -> ConfigResponse:
    session = _require_session()
    env = session.environment
    # In dev "all" mode, detect which environment the frontend needs from the Referer path
    if env == "all":
        referer = request.headers.get("referer", "")
        for name in _ENV_NAMES:
            if f"/{name}" in referer:
                env = name
                break
    self_user = next((u for u in USER_CATALOG.values() if u.get("isSelf")), None)
    initial_date = session.microlendar_initial_date if env == "microlendar" else None
    return ConfigResponse(
        environment=env,
        event_timeline_end=session.event_timeline_end,
        speed_factor=session.speed_factor,
        selfUser=self_user,
        initial_date=initial_date,
    )



def _dispatch_materialize(session: Session, conn: sqlite3.Connection) -> None:
    if session.environment == "micromail":
        micromail_handler.materialize_to_sqlite(session, conn)
    elif session.environment == "microchat":
        microchat_handler.materialize_to_sqlite(session, conn)
    elif session.environment == "microdin":
        microdin_handler.materialize_to_sqlite(session, conn)
    elif session.environment == "microfy":
        microfy_handler.materialize_to_sqlite(session, conn)
    elif session.environment == "microgram":
        microgram_handler.materialize_to_sqlite(session, conn)
    elif session.environment == "microhood":
        microhood_handler.materialize_to_sqlite(session, conn)
    elif session.environment == "microhub":
        microhub_handler.materialize_to_sqlite(session, conn)
    elif session.environment == "microlendar":
        microlendar_handler.materialize_to_sqlite(session, conn)
    elif session.environment == "microscholar":
        microscholar_handler.materialize_to_sqlite(session, conn)
    elif session.environment == "microtube":
        microtube_handler.materialize_to_sqlite(session, conn)
    else:
        raise ValueError(f"Unknown environment: {session.environment}")


@app.post("/evaluate", response_model=EvaluateResponse)
async def evaluate() -> EvaluateResponse:
    global _state
    session = _require_session()
    _state = STATE_COMPLETED # Stops the simulation

    if not session.eval_sql:
        return EvaluateResponse(
            success=False,
            detail="no eval_sql configured",
            evaluation_time=session.simulation_time,
            condition_at=session.condition_at,
            contact_get_time=session.contact_get_time,
            contact_post_time=session.contact_post_time,
            contact_message=session.contact_message,
        )

    conn = sqlite3.connect(":memory:")
    try:
        conn.execute("CREATE TABLE session_meta (key TEXT PRIMARY KEY, value TEXT)")
        conn.execute(
            "INSERT INTO session_meta VALUES (?, ?)",
            ("simulation_time", str(session.simulation_time)),
        )
        conn.execute(
            "INSERT INTO session_meta VALUES (?, ?)",
            ("event_timeline_end", str(session.event_timeline_end)),
        )
        for k, v in session.baseline_metrics.items():
            conn.execute(
                "INSERT INTO session_meta VALUES (?, ?)",
                (f"baseline_{k}", str(v)),
            )

        _dispatch_materialize(session, conn)

        try:
            row = conn.execute(session.eval_sql).fetchone()
        except Exception as e:
            return EvaluateResponse(
                success=False,
                detail=f"eval_sql error: {e}\nQuery: {session.eval_sql}",
                evaluation_time=session.simulation_time,
                condition_at=session.condition_at,
                contact_get_time=session.contact_get_time,
                contact_post_time=session.contact_post_time,
                contact_message=session.contact_message,
            )
        sql_pass = bool(row and row[0])

        return EvaluateResponse(
            # The SQL condition both needs to be met (sql_pass) AND the
            # contact form needs to have been submitted (contact_post_time is not None)
            success=session.contact_get_time is not None and \
                    session.contact_get_time >= session.condition_at and \
                    sql_pass,
            detail=f"eval_sql returned {row[0] if row else None}",
            evaluation_time=session.simulation_time,
            condition_at=session.condition_at,
            contact_get_time=session.contact_get_time,
            contact_post_time=session.contact_post_time,
            contact_message=session.contact_message,
        )
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Shared data endpoints
# ---------------------------------------------------------------------------

@app.get("/data/users", response_model=UsersResponse)
async def data_users() -> UsersResponse:
    users = list(USER_CATALOG.values())
    return UsersResponse(users=users)


# ---------------------------------------------------------------------------
# MicroMail data endpoints
# ---------------------------------------------------------------------------

@app.get("/data/micromail-emails", response_model=MicromailEmailResponse)
async def data_emails() -> MicromailEmailResponse:
    session = _require_session()
    result = []
    for email in session.micromail_emails:
        st = session.micromail_email_states.get(email["id"], {})
        result.append({**email, **st})
    return MicromailEmailResponse(emails=result)


@app.post("/data/micromail-emails/{email_id}/read", response_model=SuccessResponse)
async def data_mark_email_read(email_id: str) -> dict:
    session = _require_session()
    if email_id not in session.micromail_email_states:
        raise HTTPException(status_code=404, detail=f"Email not found: {email_id}")
    session.micromail_email_states[email_id]["isRead"] = True
    return {"success": True}


@app.post("/data/micromail-emails/{email_id}/unread", response_model=SuccessResponse)
async def data_mark_email_unread(email_id: str) -> dict:
    session = _require_session()
    if email_id not in session.micromail_email_states:
        raise HTTPException(status_code=404, detail=f"Email not found: {email_id}")
    session.micromail_email_states[email_id]["isRead"] = False
    return {"success": True}


@app.post("/data/micromail-emails/{email_id}/flag", response_model=SuccessResponse)
async def data_flag_email(email_id: str) -> dict:
    session = _require_session()
    if email_id not in session.micromail_email_states:
        raise HTTPException(status_code=404, detail=f"Email not found: {email_id}")
    current = session.micromail_email_states[email_id].get("isFlagged", False)
    session.micromail_email_states[email_id]["isFlagged"] = not current
    return {"success": True}


@app.post("/data/micromail-emails/{email_id}/move", response_model=SuccessResponse)
async def data_move_email(email_id: str, body: MicromailMoveEmailRequest) -> dict:
    session = _require_session()
    if email_id not in session.micromail_email_states:
        raise HTTPException(status_code=404, detail=f"Email not found: {email_id}")
    session.micromail_email_states[email_id]["folder"] = body.folder
    return {"success": True}


@app.post("/data/micromail-emails/{email_id}/pin", response_model=TogglePinResponse)
async def data_pin_email(email_id: str) -> dict:
    session = _require_session()
    if email_id not in session.micromail_email_states:
        raise HTTPException(status_code=404, detail=f"Email not found: {email_id}")
    current = session.micromail_email_states[email_id].get("isPinned", False)
    session.micromail_email_states[email_id]["isPinned"] = not current
    return {"success": True, "isPinned": not current}


@app.delete("/data/micromail-emails/{email_id}", response_model=SuccessResponse)
async def data_delete_email(email_id: str) -> dict:
    session = _require_session()
    if email_id not in session.micromail_email_states:
        raise HTTPException(status_code=404, detail=f"Email not found: {email_id}")
    session.micromail_emails = [e for e in session.micromail_emails if e["id"] != email_id]
    session.micromail_email_states.pop(email_id, None)
    return {"success": True}


@app.post("/data/micromail-emails/send", response_model=MicromailSendEmailResponse)
async def data_send_email(body: MicromailSendEmailRequest) -> dict:
    session = _require_session()
    if body.folder not in ("sent", "drafts"):
        raise HTTPException(status_code=400, detail="folder must be 'sent' or 'drafts'")
    row = micromail_handler.send_email(
        session,
        to=body.to,
        cc=body.cc,
        bcc=body.bcc,
        subject=body.subject,
        body=body.body,
        folder=body.folder,
    )
    return {"success": True, "email": row}


# ---------------------------------------------------------------------------
# MicroChat data endpoints
# ---------------------------------------------------------------------------

@app.get("/data/microchat-teams", response_model=MicrochatTeamsResponse)
async def data_teams() -> MicrochatTeamsResponse:
    session = _require_session()
    return MicrochatTeamsResponse(teams=session.microchat_teams)


@app.get("/data/microchat-messages", response_model=MicrochatMessagesResponse)
async def data_messages(
    conversation_id: Optional[str] = Query(None),
) -> MicrochatMessagesResponse:
    session = _require_session()
    result = []
    for msg in session.microchat_messages:
        st = session.microchat_message_states.get(msg["id"], {})
        merged = {**msg, **st}
        if conversation_id and msg["conversationId"] != conversation_id:
            continue
        result.append(merged)
    return MicrochatMessagesResponse(messages=result)


@app.get("/data/microchat-conversations", response_model=MicrochatConversationsResponse)
async def data_conversations() -> MicrochatConversationsResponse:
    session = _require_session()
    # Merge conversation data with computed unread counts and mute state
    msg_states = session.microchat_message_states
    messages = session.microchat_messages

    # Compute unread counts per conversation
    unread_by_conv: dict[str, int] = {}
    for m in messages:
        if not msg_states.get(m["id"], {}).get("isRead", False):
            unread_by_conv[m["conversationId"]] = unread_by_conv.get(m["conversationId"], 0) + 1

    # Find last message per conversation
    last_msg_by_conv: dict[str, dict] = {}
    for m in messages:
        cid = m["conversationId"]
        if cid not in last_msg_by_conv or m.get("order", 0) > last_msg_by_conv[cid].get("order", 0):
            last_msg_by_conv[cid] = m

    result = []
    for conv in session.microchat_conversations:
        cid = conv["id"]
        conv_state = session.microchat_conversation_states.get(cid, {})
        last = last_msg_by_conv.get(cid)
        result.append({
            **conv,
            "unreadCount": unread_by_conv.get(cid, 0),
            "isPinned": conv_state.get("isPinned", conv.get("isPinned", False)),
            "isMuted": conv_state.get("isMuted", conv.get("isMuted", False)),
            "lastMessage": {
                "content": last["content"],
                "senderName": last.get("senderName", ""),
                "timestamp": last.get("timestamp", ""),
            } if last else None,
        })
    return MicrochatConversationsResponse(conversations=result)


@app.get("/data/microchat-calls", response_model=MicrochatCallsResponse)
async def data_calls() -> MicrochatCallsResponse:
    session = _require_session()
    return MicrochatCallsResponse(calls=session.microchat_calls)


@app.post("/data/microchat-messages/{message_id}/read", response_model=SuccessResponse)
async def data_mark_message_read(message_id: str) -> dict:
    session = _require_session()
    if message_id not in session.microchat_message_states:
        raise HTTPException(status_code=404, detail=f"Message not found: {message_id}")
    session.microchat_message_states[message_id]["isRead"] = True
    return {"success": True}


@app.post("/data/microchat-messages/{message_id}/react", response_model=SuccessResponse)
async def data_react_message(message_id: str, body: MicrochatReactRequest) -> dict:
    session = _require_session()
    # Find message and add reaction
    for msg in session.microchat_messages:
        if msg["id"] == message_id:
            reactions = msg.get("reactions", [])
            # Check if emoji already exists
            for r in reactions:
                if r["emoji"] == body.emoji:
                    if "user000" in r["userIds"]:
                        r["userIds"].remove("user000")
                    else:
                        r["userIds"].append("user000")
                    return {"success": True}
            reactions.append({"emoji": body.emoji, "userIds": ["user000"]})
            msg["reactions"] = reactions
            return {"success": True}
    raise HTTPException(status_code=404, detail=f"Message not found: {message_id}")


@app.post("/data/microchat-conversations/{conversation_id}/mute", response_model=ToggleMuteResponse)
async def data_mute_conversation(conversation_id: str) -> dict:
    session = _require_session()
    state = session.microchat_conversation_states.get(conversation_id, {})
    state["isMuted"] = not state.get("isMuted", False)
    session.microchat_conversation_states[conversation_id] = state
    return {"success": True, "isMuted": state["isMuted"]}


@app.post("/data/microchat-conversations/{conversation_id}/pin", response_model=TogglePinResponse)
async def data_pin_conversation(conversation_id: str) -> dict:
    session = _require_session()
    state = session.microchat_conversation_states.get(conversation_id, {})
    state["isPinned"] = not state.get("isPinned", False)
    session.microchat_conversation_states[conversation_id] = state
    return {"success": True, "isPinned": state["isPinned"]}


# ---------------------------------------------------------------------------
# MicroDin data endpoints
# ---------------------------------------------------------------------------

@app.get("/data/microdin-posts", response_model=MicrodinPostsResponse)
async def data_posts() -> MicrodinPostsResponse:
    session = _require_session()
    result = []
    for post in session.microdin_posts:
        st = session.microdin_post_states.get(post["id"], {})
        result.append({**post, **st})
    return MicrodinPostsResponse(posts=result)


@app.get("/data/microdin-connections", response_model=MicrodinConnectionsResponse)
async def data_connections() -> MicrodinConnectionsResponse:
    session = _require_session()
    result = []
    for conn in session.microdin_connections:
        st = session.microdin_connection_states.get(conn["id"], {})
        result.append({**conn, **st})
    return MicrodinConnectionsResponse(connections=result)


@app.get("/data/microdin-conversations", response_model=MicrodinConversationsResponse)
async def data_din_conversations() -> MicrodinConversationsResponse:
    session = _require_session()
    msg_states = session.microdin_message_states
    messages = session.microdin_messages

    # Compute unread counts per conversation
    unread_by_conv: dict[str, int] = {}
    for m in messages:
        if not msg_states.get(m["id"], {}).get("isRead", False):
            unread_by_conv[m["conversationId"]] = unread_by_conv.get(m["conversationId"], 0) + 1

    # Group messages by conversation
    msgs_by_conv: dict[str, list[dict]] = {}
    for m in messages:
        cid = m["conversationId"]
        merged = {**m, **msg_states.get(m["id"], {})}
        msgs_by_conv.setdefault(cid, []).append(merged)

    result = []
    for conv in session.microdin_conversations:
        cid = conv["id"]
        conv_msgs = msgs_by_conv.get(cid, [])
        last_msg = conv_msgs[-1] if conv_msgs else None
        result.append({
            **conv,
            "unreadCount": unread_by_conv.get(cid, 0),
            "messages": conv_msgs,
            "lastMessage": last_msg["content"] if last_msg else "",
        })
    return MicrodinConversationsResponse(conversations=result)


@app.get("/data/microdin-notifications", response_model=MicrodinNotificationsResponse)
async def data_notifications() -> MicrodinNotificationsResponse:
    session = _require_session()
    result = []
    for notif in session.microdin_notifications:
        st = session.microdin_notification_states.get(notif["id"], {})
        result.append({**notif, **st})
    return MicrodinNotificationsResponse(notifications=result)


@app.get("/data/microdin-jobs", response_model=MicrodinJobsResponse)
async def data_jobs() -> MicrodinJobsResponse:
    session = _require_session()
    result = []
    for job in session.microdin_jobs:
        st = session.microdin_job_states.get(job["id"], {})
        result.append({**job, **st})
    return MicrodinJobsResponse(jobs=result)


@app.post("/data/microdin-posts/{post_id}/comments", response_model=SuccessResponse)
async def data_din_post_comment(post_id: str, payload: dict) -> dict:
    session = _require_session()
    target = next((p for p in session.microdin_posts if p["id"] == post_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail=f"Post not found: {post_id}")

    text = (payload or {}).get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment text is required")

    self_user = next((u for u in USER_CATALOG.values() if u.get("isSelf")), {})
    comment_id = f"user-comment-{int(datetime.datetime.utcnow().timestamp() * 1000)}"
    comment = {
        "id": comment_id,
        "authorId": self_user.get("id", "self"),
        "authorName": self_user.get("name", "You"),
        "authorAvatarUrl": self_user.get("avatarUrl", ""),
        "text": text,
        "likes": 0,
    }
    target.setdefault("comments", []).append(comment)
    return {"success": True}


@app.post("/data/microdin-posts/{post_id}/like", response_model=ToggleLikeResponse)
async def data_like_post(post_id: str) -> dict:
    session = _require_session()
    if post_id not in session.microdin_post_states:
        raise HTTPException(status_code=404, detail=f"Post not found: {post_id}")
    current = session.microdin_post_states[post_id].get("isLiked", False)
    session.microdin_post_states[post_id]["isLiked"] = not current
    # Update the likes count on the post
    for post in session.microdin_posts:
        if post["id"] == post_id:
            post["likes"] = post["likes"] + (1 if not current else -1)
            break
    return {"success": True, "isLiked": not current}


@app.post("/data/microdin-connections/{connection_id}/accept", response_model=SuccessResponse)
async def data_accept_connection(connection_id: str) -> dict:
    session = _require_session()
    if connection_id not in session.microdin_connection_states:
        raise HTTPException(status_code=404, detail=f"Connection not found: {connection_id}")
    session.microdin_connection_states[connection_id]["status"] = "accepted"
    return {"success": True}


@app.post("/data/microdin-connections/{connection_id}/ignore", response_model=SuccessResponse)
async def data_ignore_connection(connection_id: str) -> dict:
    session = _require_session()
    if connection_id not in session.microdin_connection_states:
        raise HTTPException(status_code=404, detail=f"Connection not found: {connection_id}")
    session.microdin_connection_states[connection_id]["status"] = "ignored"
    return {"success": True}


@app.post("/data/microdin-conversations/{conversation_id}/read", response_model=SuccessResponse)
async def data_din_read_conversation(conversation_id: str) -> dict:
    session = _require_session()
    # Mark all messages in this conversation as read
    for m in session.microdin_messages:
        if m["conversationId"] == conversation_id:
            session.microdin_message_states[m["id"]]["isRead"] = True
    return {"success": True}


@app.post("/data/microdin-conversations", response_model=MicrodinCreateConversationResponse)
async def data_din_create_conversation(payload: dict) -> dict:
    """Create a conversation with a target user. Returns the existing one if a
    1:1 conversation between self and that user already exists."""
    session = _require_session()
    target_user_id = (payload or {}).get("userId", "").strip()
    if not target_user_id:
        raise HTTPException(status_code=400, detail="userId is required")

    self_user = next((u for u in USER_CATALOG.values() if u.get("isSelf")), {})
    self_id = self_user.get("id", "self")

    for conv in session.microdin_conversations:
        participants = conv.get("participantIds") or [p.get("id") for p in conv.get("participants", [])]
        if participants and set(participants) == {self_id, target_user_id}:
            return {"conversationId": conv["id"], "created": False}

    target_user = USER_CATALOG.get(target_user_id, {})
    conv_id = f"user-conv-{int(datetime.datetime.utcnow().timestamp() * 1000)}"
    conv_row = {
        "id": conv_id,
        "participantIds": [self_id, target_user_id],
        "participants": [
            {"id": self_id, "name": self_user.get("name", "You"), "avatarUrl": self_user.get("avatarUrl", "")},
            {"id": target_user_id, "name": target_user.get("name", "Unknown"), "avatarUrl": target_user.get("avatarUrl", "")},
        ],
    }
    session.microdin_conversations.append(conv_row)
    return {"conversationId": conv_id, "created": True}


@app.post("/data/microdin-conversations/{conversation_id}/messages", response_model=SuccessResponse)
async def data_din_send_message(conversation_id: str, payload: dict) -> dict:
    session = _require_session()
    if not any(c["id"] == conversation_id for c in session.microdin_conversations):
        raise HTTPException(status_code=404, detail=f"Conversation not found: {conversation_id}")

    content = (payload or {}).get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content is required")

    self_user = next((u for u in USER_CATALOG.values() if u.get("isSelf")), {})
    sender_id = self_user.get("id", "self")
    msg_id = f"user-msg-{int(datetime.datetime.utcnow().timestamp() * 1000)}"
    ts = datetime.datetime.utcnow().isoformat() + "Z"
    order = max((m.get("order", 0) for m in session.microdin_messages if m.get("conversationId") == conversation_id), default=0) + 1

    row = {
        "id": msg_id,
        "conversationId": conversation_id,
        "senderId": sender_id,
        "senderName": self_user.get("name", "You"),
        "content": content,
        "timestamp": ts,
        "order": order,
    }
    session.microdin_messages.append(row)
    session.microdin_message_states[msg_id] = {"isRead": True}
    return {"success": True}


@app.post("/data/microdin-notifications/{notification_id}/read", response_model=SuccessResponse)
async def data_mark_notification_read(notification_id: str) -> dict:
    session = _require_session()
    if notification_id not in session.microdin_notification_states:
        raise HTTPException(status_code=404, detail=f"Notification not found: {notification_id}")
    session.microdin_notification_states[notification_id]["isRead"] = True
    return {"success": True}


@app.post("/data/microdin-jobs/{job_id}/apply", response_model=SuccessResponse)
async def data_apply_job(job_id: str) -> dict:
    session = _require_session()
    if job_id not in session.microdin_job_states:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    session.microdin_job_states[job_id]["isApplied"] = True
    return {"success": True}


@app.get("/data/microdin-companies", response_model=MicrodinCompaniesResponse)
async def data_din_companies() -> MicrodinCompaniesResponse:
    return MicrodinCompaniesResponse(companies=list(MICRODIN_COMPANY_CATALOG.values()))


@app.get("/data/microdin-network", response_model=MicrodinNetworkResponse)
async def data_din_network() -> MicrodinNetworkResponse:
    users = [u for u in USER_CATALOG.values() if u.get("microdin")]
    return MicrodinNetworkResponse(users=users)


@app.get("/data/microdin-profile-stats")
async def data_din_profile_stats() -> dict:
    session = _require_session()
    return {
        "profileViewCount": session.microdin_profile_view_count,
        "pageVisitorCount": session.microdin_page_visitor_count,
        "connectionsCount": session.microdin_connections_count,
        "initialConnectionIds": session.microdin_initial_connection_ids,
    }


@app.get("/data/microdin-profile-sections", response_model=MicrodinProfileSectionsResponse)
async def data_din_profile_sections() -> MicrodinProfileSectionsResponse:
    session = _require_session()
    return MicrodinProfileSectionsResponse(sections=list(session.microdin_profile_sections))


@app.post("/data/microdin-profile-sections", response_model=MicrodinProfileSectionResponse)
async def data_din_add_profile_section(payload: dict) -> dict:
    session = _require_session()
    section_type = (payload or {}).get("type", "").strip()
    if not section_type:
        raise HTTPException(status_code=400, detail="type is required")
    title = (payload or {}).get("title", "").strip()
    subtitle = (payload or {}).get("subtitle", "").strip()
    content = (payload or {}).get("content", "").strip()
    if not title and not content:
        raise HTTPException(status_code=400, detail="title or content is required")
    section_id = f"user-section-{int(datetime.datetime.utcnow().timestamp() * 1000)}"
    row = {
        "id": section_id,
        "type": section_type,
        "title": title,
        "subtitle": subtitle,
        "content": content,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
    }
    session.microdin_profile_sections.append(row)
    return {"section": row}


# ---------------------------------------------------------------------------
# MicroFy data endpoints
# ---------------------------------------------------------------------------

@app.get("/data/microfy-tracks", response_model=MicrofyTracksResponse)
async def data_tracks() -> MicrofyTracksResponse:
    session = _require_session()
    result = []
    for track in session.microfy_tracks:
        st = session.microfy_track_states.get(track["id"], {})
        result.append({**track, **st})
    return MicrofyTracksResponse(tracks=result)


@app.get("/data/microfy-playlists", response_model=MicrofyPlaylistsResponse)
async def data_playlists() -> MicrofyPlaylistsResponse:
    session = _require_session()
    # Combine catalog playlists and user-created playlists
    all_playlists = list(session.microfy_playlists) + [
        {**p, "source": "user"} for p in session.microfy_user_created_playlists
    ]
    return MicrofyPlaylistsResponse(playlists=all_playlists)


@app.get("/data/microfy-moods", response_model=MicrofyMoodsResponse)
async def data_moods() -> MicrofyMoodsResponse:
    session = _require_session()
    return MicrofyMoodsResponse(moods=session.microfy_moods)


@app.post("/data/microfy-tracks/{track_id}/like", response_model=ToggleLikeResponse)
async def data_like_track(track_id: str) -> dict:
    session = _require_session()
    if track_id not in session.microfy_track_states:
        raise HTTPException(status_code=404, detail=f"Track not found: {track_id}")
    current = session.microfy_track_states[track_id].get("isLiked", False)
    session.microfy_track_states[track_id]["isLiked"] = not current
    return {"success": True, "isLiked": not current}


@app.post("/data/microfy-tracks/{track_id}/play", response_model=SuccessResponse)
async def data_play_track(track_id: str) -> dict:
    session = _require_session()
    if track_id not in session.microfy_track_states:
        raise HTTPException(status_code=404, detail=f"Track not found: {track_id}")
    session.microfy_track_states[track_id]["userPlayCount"] = (
        session.microfy_track_states[track_id].get("userPlayCount", 0) + 1
    )
    return {"success": True}


@app.post("/data/microfy-playlists", response_model=CreatePlaylistResponse)
async def data_create_playlist(body: MicrofyCreatePlaylistRequest) -> dict:
    session = _require_session()
    pl_id = f"user-playlist-{len(session.microfy_user_created_playlists) + 1}"
    playlist = {
        "id": pl_id,
        "name": body.name,
        "description": body.description,
        "trackIds": [],
        "source": "user",
    }
    session.microfy_user_created_playlists.append(playlist)
    return {"success": True, "playlist": playlist}


@app.post("/data/microfy-playlists/{playlist_id}/add", response_model=SuccessResponse)
async def data_add_to_playlist(playlist_id: str, body: MicrofyAddToPlaylistRequest) -> dict:
    session = _require_session()
    for pl in session.microfy_user_created_playlists:
        if pl["id"] == playlist_id:
            if body.track_id not in pl["trackIds"]:
                pl["trackIds"].append(body.track_id)
            return {"success": True}
    raise HTTPException(status_code=404, detail=f"Playlist not found: {playlist_id}")


@app.post("/data/microfy-artists/{artist_id}/follow", response_model=ToggleFollowResponse)
async def data_follow_artist(artist_id: str) -> dict:
    session = _require_session()
    if artist_id in session.microfy_followed_artists:
        session.microfy_followed_artists.discard(artist_id)
        return {"success": True, "isFollowed": False}
    else:
        session.microfy_followed_artists.add(artist_id)
        return {"success": True, "isFollowed": True}


@app.get("/data/microfy-followed-artists", response_model=MicrofyFollowedArtistsResponse)
async def data_followed_artists() -> MicrofyFollowedArtistsResponse:
    session = _require_session()
    return MicrofyFollowedArtistsResponse(followed_artists=list(session.microfy_followed_artists))


@app.get("/data/microfy-artists", response_model=MicrofyArtistsResponse)
async def data_fy_artists() -> MicrofyArtistsResponse:
    return MicrofyArtistsResponse(artists=list(MICROFY_ARTIST_CATALOG.values()))


# ---------------------------------------------------------------------------
# MicroGram data endpoints
# ---------------------------------------------------------------------------

@app.get("/data/microgram-posts", response_model=MicrogramPostsResponse)
async def data_gram_posts() -> MicrogramPostsResponse:
    session = _require_session()
    result = []
    for post in session.microgram_posts:
        st = session.microgram_post_states.get(post["id"], {})
        result.append({**post, **st})
    return MicrogramPostsResponse(posts=result)


@app.get("/data/microgram-stories", response_model=MicrogramStoriesResponse)
async def data_gram_stories() -> MicrogramStoriesResponse:
    session = _require_session()
    result = []
    for story in session.microgram_stories:
        st = session.microgram_story_states.get(story["id"], {})
        result.append({**story, **st})
    return MicrogramStoriesResponse(stories=result)


@app.get("/data/microgram-messages", response_model=MicrogramMessagesResponse)
async def data_gram_messages() -> MicrogramMessagesResponse:
    session = _require_session()
    result = []
    for conversation in session.microgram_messages:
        merged_messages = []
        unread_count = 0
        for message in conversation.get("messages", []):
            merged = {**message, **session.microgram_message_states.get(message["id"], {})}
            if not merged.get("isRead", False):
                unread_count += 1
            merged_messages.append(merged)

        result.append({
            **conversation,
            "messages": merged_messages,
            "unreadCount": unread_count,
        })

    return MicrogramMessagesResponse(messages=result)


@app.get("/data/microgram-activity", response_model=MicrogramActivityResponse)
async def data_gram_activity() -> MicrogramActivityResponse:
    session = _require_session()
    return MicrogramActivityResponse(activity=session.microgram_activity)


@app.get("/data/microgram-followed-users", response_model=MicrogramFollowedUsersResponse)
async def data_gram_followed_users() -> MicrogramFollowedUsersResponse:
    session = _require_session()
    return MicrogramFollowedUsersResponse(followed_users=list(session.microgram_followed_users))


@app.get("/data/microgram-users", response_model=MicrogramUsersResponse)
async def data_gram_users() -> MicrogramUsersResponse:
    users = [u for u in USER_CATALOG.values() if u.get("microgram")]
    return MicrogramUsersResponse(users=users)


@app.post("/data/microgram-posts/{post_id}/like", response_model=ToggleLikeResponse)
async def data_gram_like_post(post_id: str) -> dict:
    session = _require_session()
    if post_id not in session.microgram_post_states:
        raise HTTPException(status_code=404, detail=f"Post not found: {post_id}")
    current = session.microgram_post_states[post_id].get("isLiked", False)
    session.microgram_post_states[post_id]["isLiked"] = not current
    # Update the likes count on the post
    for post in session.microgram_posts:
        if post["id"] == post_id:
            post["likes"] = post["likes"] + (1 if not current else -1)
            break
    return {"success": True, "isLiked": not current}


@app.post("/data/microgram-posts/{post_id}/save", response_model=ToggleSaveResponse)
async def data_gram_save_post(post_id: str) -> dict:
    session = _require_session()
    if post_id not in session.microgram_post_states:
        raise HTTPException(status_code=404, detail=f"Post not found: {post_id}")
    current = session.microgram_post_states[post_id].get("isSaved", False)
    session.microgram_post_states[post_id]["isSaved"] = not current
    return {"success": True, "isSaved": not current}


@app.post("/data/microgram-posts/{post_id}/comment", response_model=CommentResponse)
async def data_gram_comment_post(post_id: str, body: MicrogramCommentRequest) -> dict:
    session = _require_session()
    if post_id not in session.microgram_post_states:
        raise HTTPException(status_code=404, detail=f"Post not found: {post_id}")
    comment_id = f"user-comment-{len(session.microgram_user_created_comments) + 1}"
    comment = {
        "id": comment_id,
        "postId": post_id,
        "text": body.text,
    }
    session.microgram_user_created_comments.append(comment)
    return {"success": True, "comment": comment}


@app.post("/data/microgram-stories/{story_id}/view", response_model=SuccessResponse)
async def data_gram_view_story(story_id: str) -> dict:
    session = _require_session()
    if story_id not in session.microgram_story_states:
        raise HTTPException(status_code=404, detail=f"Story not found: {story_id}")
    session.microgram_story_states[story_id]["isViewed"] = True
    return {"success": True}


@app.post("/data/microgram-conversations/{conversation_id}/read", response_model=SuccessResponse)
async def data_gram_read_conversation(conversation_id: str) -> dict:
    session = _require_session()
    conversation = next((conv for conv in session.microgram_messages if conv["id"] == conversation_id), None)
    if conversation is None:
        raise HTTPException(status_code=404, detail=f"Conversation not found: {conversation_id}")

    for message in conversation.get("messages", []):
        message_id = message.get("id")
        if not message_id:
            continue
        session.microgram_message_states[message_id] = {
            **session.microgram_message_states.get(message_id, {}),
            "isRead": True,
        }

    return {"success": True}


@app.post("/data/microgram-users/{user_id}/follow", response_model=ToggleFollowResponse)
async def data_gram_follow_user(user_id: str) -> dict:
    session = _require_session()
    if user_id in session.microgram_followed_users:
        session.microgram_followed_users.discard(user_id)
        return {"success": True, "isFollowed": False}
    else:
        session.microgram_followed_users.add(user_id)
        return {"success": True, "isFollowed": True}


# ---------------------------------------------------------------------------
# MicroHood data endpoints
# ---------------------------------------------------------------------------

@app.get("/data/microhood-stocks", response_model=MicrohoodStocksResponse)
async def data_hood_stocks() -> MicrohoodStocksResponse:
    session = _require_session()
    prices = microhood_handler.get_current_prices(session)
    states = session.microhood_stock_states
    result = []
    for stock in session.microhood_stocks:
        symbol = stock["symbol"]
        st = states.get(symbol, {})
        current_price = prices.get(symbol, 0)
        starting_price = session.microhood_starting_prices.get(symbol, current_price)
        change = current_price - starting_price
        change_percent = (change / starting_price * 100) if starting_price else 0
        result.append({
            **stock,
            "currentPrice": round(current_price, 2),
            "change": round(change, 2),
            "changePercent": round(change_percent, 2),
            "shares": st.get("shares", 0),
            "avgCost": st.get("avgCost", 0),
        })
    # Also evaluate success condition on each poll
    return MicrohoodStocksResponse(stocks=result)


@app.get("/data/microhood-watchlist", response_model=MicrohoodWatchlistResponse)
async def data_hood_watchlist() -> MicrohoodWatchlistResponse:
    session = _require_session()
    prices = microhood_handler.get_current_prices(session)
    result = []
    for item in session.microhood_watchlist:
        symbol = item["symbol"]
        st = session.microhood_watchlist_states.get(symbol, {})
        if st.get("inWatchlist", True):
            current_price = prices.get(symbol, item.get("price", 0))
            starting_price = session.microhood_starting_prices.get(symbol, current_price)
            change = current_price - starting_price
            change_percent = (change / starting_price * 100) if starting_price else 0
            result.append({
                **item,
                "price": round(current_price, 2),
                "change": round(change, 2),
                "changePercent": round(change_percent, 2),
                "inWatchlist": True,
            })
    return MicrohoodWatchlistResponse(watchlist=result)


@app.get("/data/microhood-news", response_model=MicrohoodNewsResponse)
async def data_hood_news() -> MicrohoodNewsResponse:
    session = _require_session()
    return MicrohoodNewsResponse(news=session.microhood_news)


@app.get("/data/microhood-portfolio", response_model=MicrohoodPortfolioResponse)
async def data_hood_portfolio() -> MicrohoodPortfolioResponse:
    session = _require_session()
    metrics = microhood_handler.compute_current_metrics(session)
    baseline = session.baseline_metrics
    total_gain = metrics["portfolio_value"] - baseline.get("portfolio_value", metrics["portfolio_value"])
    baseline_pv = baseline.get("portfolio_value", 1)
    total_gain_percent = (total_gain / baseline_pv * 100) if baseline_pv else 0
    return MicrohoodPortfolioResponse(
        buying_power=metrics["buying_power"],
        positions_value=metrics["positions_value"],
        portfolio_value=metrics["portfolio_value"],
        total_gain=round(total_gain, 2),
        total_gain_percent=round(total_gain_percent, 2),
    )


@app.post("/data/microhood-stocks/{symbol}/order", response_model=OrderResponse)
async def data_hood_order(symbol: str, body: MicrohoodOrderRequest) -> dict:
    session = _require_session()
    states = session.microhood_stock_states
    prices = microhood_handler.get_current_prices(session)
    current_price = prices.get(symbol, 0)
    effective_price = body.limit_price if (body.type == "limit" and body.limit_price) else current_price
    order_cost = effective_price * body.quantity

    if body.action == "buy":
        if order_cost > session.microhood_buying_power:
            raise HTTPException(status_code=400, detail="Insufficient buying power")
        session.microhood_buying_power -= order_cost
        st = states.get(symbol, {"shares": 0, "avgCost": 0})
        old_shares = st["shares"]
        old_cost = st["avgCost"]
        new_shares = old_shares + body.quantity
        new_avg = ((old_cost * old_shares) + order_cost) / new_shares if new_shares else 0
        states[symbol] = {"shares": new_shares, "avgCost": round(new_avg, 2)}

    elif body.action == "sell":
        st = states.get(symbol, {"shares": 0, "avgCost": 0})
        if body.quantity > st["shares"]:
            raise HTTPException(status_code=400, detail="Not enough shares")
        session.microhood_buying_power += order_cost
        new_shares = st["shares"] - body.quantity
        states[symbol] = {"shares": new_shares, "avgCost": st["avgCost"]}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {body.action}")

    # Record order
    session.microhood_orders.append({
        "symbol": symbol,
        "action": body.action,
        "quantity": body.quantity,
        "price": round(effective_price, 2),
        "type": body.type,
    })

    return {"success": True, "order": session.microhood_orders[-1]}


@app.post("/data/microhood-watchlist/{symbol}/toggle", response_model=ToggleWatchlistResponse)
async def data_hood_toggle_watchlist(symbol: str) -> dict:
    session = _require_session()
    st = session.microhood_watchlist_states.get(symbol)
    if st is not None:
        st["inWatchlist"] = not st.get("inWatchlist", True)
        return {"success": True, "inWatchlist": st["inWatchlist"]}
    # Add new item to watchlist
    stock = MICROHOOD_STOCK_CATALOG.get(symbol)
    if stock:
        session.microhood_watchlist.append({
            "symbol": symbol,
            "name": stock["name"],
            "price": stock.get("current_price", 0),
            "change": stock.get("change", 0),
            "changePercent": stock.get("change_percent", 0),
        })
        session.microhood_watchlist_states[symbol] = {"inWatchlist": True}
        return {"success": True, "inWatchlist": True}
    raise HTTPException(status_code=404, detail=f"Stock not found: {symbol}")


# ---------------------------------------------------------------------------
# MicroHub data endpoints
# ---------------------------------------------------------------------------

@app.get("/data/microhub-repository", response_model=MicrohubRepositoryResponse)
async def data_hub_repository() -> MicrohubRepositoryResponse:
    from server.handlers.microhub import _current_star_count
    session = _require_session()
    repo = dict(session.microhub_repository)
    repo["stars"] = _current_star_count(session)
    repo["forks"] = session.microhub_fork_count
    repo["watchers"] = session.microhub_watch_count
    repo["isStarred"] = session.microhub_starred
    repo["isWatched"] = session.microhub_watched
    repo["isForked"] = session.microhub_forked
    # Derive `visibility` from `isPrivate` unless explicitly set by a PATCH.
    if "visibility" not in repo:
        repo["visibility"] = "private" if repo.get("isPrivate") else "public"
    return MicrohubRepositoryResponse(repository=repo)


@app.get("/data/microhub-files", response_model=MicrohubFilesResponse)
async def data_hub_files() -> MicrohubFilesResponse:
    session = _require_session()
    return MicrohubFilesResponse(files=session.microhub_files)


@app.get("/data/microhub-issues", response_model=MicrohubIssuesResponse)
async def data_hub_issues() -> MicrohubIssuesResponse:
    session = _require_session()
    result = []
    for issue in session.microhub_issues:
        st = session.microhub_issue_states.get(issue["id"], {})
        merged = {**issue, **st}
        # Add user-added comments
        user_comments = [c for c in session.microhub_user_created_comments if c.get("targetId") == issue["id"]]
        if user_comments:
            merged["comments"] = list(merged.get("comments", [])) + user_comments
        result.append(merged)
    # Append user-created issues (also merge in user comments on them)
    for issue in session.microhub_user_created_issues:
        user_comments = [c for c in session.microhub_user_created_comments if c.get("targetId") == issue["id"]]
        if user_comments:
            issue = {**issue, "comments": list(issue.get("comments", [])) + user_comments}
        result.append(issue)
    return MicrohubIssuesResponse(issues=result)


@app.get("/data/microhub-pulls", response_model=MicrohubPrsResponse)
async def data_hub_pulls() -> MicrohubPrsResponse:
    session = _require_session()
    result = []
    for pr in session.microhub_prs:
        st = session.microhub_pr_states.get(pr["id"], {})
        merged = {**pr, **st}
        # Add user-added comments
        user_comments = [c for c in session.microhub_user_created_comments if c.get("targetId") == pr["id"]]
        if user_comments:
            merged["comments"] = list(merged.get("comments", [])) + user_comments
        # Check if merged by user
        if pr["id"] in session.microhub_merged_prs:
            merged["state"] = "merged"
        result.append(merged)
    # Append user-created PRs (also merge in user comments on them)
    for pr in session.microhub_user_created_prs:
        user_comments = [c for c in session.microhub_user_created_comments if c.get("targetId") == pr["id"]]
        if user_comments:
            pr = {**pr, "comments": list(pr.get("comments", [])) + user_comments}
        result.append(pr)
    return MicrohubPrsResponse(prs=result)


@app.get("/data/microhub-commits", response_model=MicrohubCommitsResponse)
async def data_hub_commits() -> MicrohubCommitsResponse:
    session = _require_session()
    return MicrohubCommitsResponse(commits=session.microhub_commits)


@app.get("/data/microhub-runs", response_model=MicrohubRunsResponse)
async def data_hub_runs() -> MicrohubRunsResponse:
    session = _require_session()
    return MicrohubRunsResponse(runs=session.microhub_runs)


@app.get("/data/microhub-workflows", response_model=MicrohubWorkflowsResponse)
async def data_hub_workflows() -> MicrohubWorkflowsResponse:
    session = _require_session()
    return MicrohubWorkflowsResponse(workflows=session.microhub_workflows)


@app.get("/data/microhub-wiki", response_model=MicrohubWikiResponse)
async def data_hub_wiki() -> MicrohubWikiResponse:
    session = _require_session()
    return MicrohubWikiResponse(pages=session.microhub_wiki)


@app.get("/data/microhub-projects", response_model=MicrohubProjectsResponse)
async def data_hub_projects() -> MicrohubProjectsResponse:
    session = _require_session()
    return MicrohubProjectsResponse(projects=session.microhub_projects)


@app.get("/data/microhub-activity", response_model=MicrohubActivityResponse)
async def data_hub_activity() -> MicrohubActivityResponse:
    session = _require_session()
    return MicrohubActivityResponse(activity=session.microhub_activity)


@app.get("/data/microhub-insights", response_model=MicrohubInsightsResponse)
async def data_hub_insights() -> MicrohubInsightsResponse:
    session = _require_session()
    return MicrohubInsightsResponse(insights=session.microhub_insights)


@app.get("/data/microhub-releases", response_model=MicrohubReleasesResponse)
async def data_hub_releases() -> MicrohubReleasesResponse:
    session = _require_session()
    return MicrohubReleasesResponse(releases=session.microhub_releases)


@app.get("/data/microhub-labels", response_model=MicrohubLabelsResponse)
async def data_hub_labels() -> MicrohubLabelsResponse:
    session = _require_session()
    return MicrohubLabelsResponse(labels=session.microhub_labels)


@app.get("/data/microhub-security", response_model=MicrohubSecurityResponse)
async def data_hub_security() -> MicrohubSecurityResponse:
    session = _require_session()
    return MicrohubSecurityResponse(advisories=session.microhub_security)


@app.get("/data/microhub-code-scanning", response_model=MicrohubCodeScanningResponse)
async def data_hub_code_scanning() -> MicrohubCodeScanningResponse:
    session = _require_session()
    return MicrohubCodeScanningResponse(alerts=session.microhub_code_scanning)


@app.get("/data/microhub-settings", response_model=MicrohubSettingsResponse)
async def data_hub_settings() -> MicrohubSettingsResponse:
    session = _require_session()
    return MicrohubSettingsResponse(settings=session.microhub_settings)


@app.get("/data/microhub-deployments", response_model=MicrohubDeploymentsResponse)
async def data_hub_deployments() -> MicrohubDeploymentsResponse:
    session = _require_session()
    return MicrohubDeploymentsResponse(deployments=session.microhub_deployments)


@app.get("/data/microhub-packages", response_model=MicrohubPackagesResponse)
async def data_hub_packages() -> MicrohubPackagesResponse:
    session = _require_session()
    return MicrohubPackagesResponse(packages=session.microhub_packages)


@app.get("/data/microhub-user-created-repos", response_model=MicrohubUserCreatedReposResponse)
async def data_hub_user_created_repos() -> MicrohubUserCreatedReposResponse:
    session = _require_session()
    return MicrohubUserCreatedReposResponse(repositories=list(session.microhub_user_created_repos))


@app.post("/data/microhub-repos", response_model=MicrohubCreateRepoResponse)
async def data_hub_create_repo(body: MicrohubCreateRepoRequest) -> dict:
    session = _require_session()
    if body.visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Repository name is required")
    self_user = next((u for u in USER_CATALOG.values() if u.get("isSelf")), {})
    owner = self_user.get("username") or "you"
    repo = {
        "id": f"user-repo-{len(session.microhub_user_created_repos) + 1}",
        "owner": owner,
        "ownerType": "user",
        "name": name,
        "fullName": f"{owner}/{name}",
        "description": body.description,
        "isPrivate": body.visibility == "private",
        "visibility": body.visibility,
        "isFork": False,
        "stars": 0,
        "forks": 0,
        "watchers": 0,
        "openIssues": 0,
        "language": "",
        "languageColor": "",
        "languages": [],
        "license": "",
        "defaultBranch": "main",
        "branches": ["main"],
        "tags": [],
        "topics": [],
        "commits": 1 if body.addReadme else 0,
        "isStarred": False,
        "isWatched": False,
        "isForked": False,
        "hasReadme": body.addReadme,
        "hasGitignore": body.addGitignore,
    }
    session.microhub_user_created_repos.append(repo)
    return {"success": True, "repository": repo}


@app.patch("/data/microhub-repository", response_model=SuccessResponse)
async def data_hub_patch_repository(payload: dict) -> dict:
    session = _require_session()
    if not session.microhub_repository:
        raise HTTPException(status_code=404, detail="Repository not initialized")
    allowed_fields = {"name", "description", "visibility"}
    updates = {k: v for k, v in (payload or {}).items() if k in allowed_fields}
    if not updates:
        raise HTTPException(status_code=400, detail="No updatable fields provided")
    if "visibility" in updates and updates["visibility"] not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")
    session.microhub_repository.update(updates)
    if "visibility" in updates:
        session.microhub_repository["isPrivate"] = updates["visibility"] == "private"
    return {"success": True}


@app.post("/data/microhub-repository/star", response_model=StarResponse)
async def data_hub_star() -> dict:
    from server.handlers.microhub import _current_star_count
    session = _require_session()
    # Adjust a user-driven offset that rides on top of the scenario's interpolated
    # baseline so the user's star doesn't disturb the scheduled star curve.
    if session.microhub_starred:
        session.microhub_starred = False
        session.microhub_star_offset -= 1
    else:
        session.microhub_starred = True
        session.microhub_star_offset += 1
    return {"success": True, "isStarred": session.microhub_starred, "starCount": _current_star_count(session)}


@app.post("/data/microhub-repository/watch", response_model=WatchResponse)
async def data_hub_watch() -> dict:
    session = _require_session()
    if session.microhub_watched:
        session.microhub_watched = False
        session.microhub_watch_count -= 1
    else:
        session.microhub_watched = True
        session.microhub_watch_count += 1
    return {"success": True, "isWatched": session.microhub_watched, "watchCount": session.microhub_watch_count}


@app.post("/data/microhub-repository/fork", response_model=ForkResponse)
async def data_hub_fork() -> dict:
    session = _require_session()
    if not session.microhub_forked:
        session.microhub_forked = True
        session.microhub_fork_count += 1
    return {"success": True, "isForked": session.microhub_forked, "forkCount": session.microhub_fork_count}


@app.post("/data/microhub-issues", response_model=MicrohubCreateIssueResponse)
async def data_hub_create_issue(body: MicrohubCreateIssueRequest) -> dict:
    session = _require_session()
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Issue title is required")
    self_user = next((u for u in USER_CATALOG.values() if u.get("isSelf")), {})
    # Issue numbers continue from the highest existing number (seeded + user-created).
    existing_numbers = [i.get("number", 0) for i in session.microhub_issues]
    existing_numbers += [i.get("number", 0) for i in session.microhub_user_created_issues]
    next_number = (max(existing_numbers) if existing_numbers else 0) + 1
    issue = {
        "id": f"user-issue-{len(session.microhub_user_created_issues) + 1}",
        "number": next_number,
        "title": title,
        "body": body.body,
        "state": "open",
        "author": self_user.get("username", "you"),
        "authorId": self_user.get("id", "self"),
        "assignees": [],
        "labelIds": [],
        "comments": [],
        "order": -1,
    }
    session.microhub_user_created_issues.append(issue)
    return {"success": True, "issue": issue}


@app.post("/data/microhub-issues/{issue_id}/comment", response_model=CommentResponse)
async def data_hub_comment_issue(issue_id: str, body: MicrohubCommentRequest) -> dict:
    session = _require_session()
    if issue_id not in session.microhub_issue_states:
        # Check user-created issues
        found = any(i["id"] == issue_id for i in session.microhub_user_created_issues)
        if not found:
            raise HTTPException(status_code=404, detail=f"Issue not found: {issue_id}")
    comment_id = f"user-comment-{len(session.microhub_user_created_comments) + 1}"
    comment = {
        "id": comment_id,
        "targetId": issue_id,
        "targetType": "issue",
        "author": "achen",
        "authorId": "user001",
        "body": body.body,
        "reactions": [],
        "order": len(session.microhub_user_created_comments),
    }
    session.microhub_user_created_comments.append(comment)
    return {"success": True, "comment": comment}


@app.post("/data/microhub-pulls/{pr_id}/comment", response_model=CommentResponse)
async def data_hub_comment_pr(pr_id: str, body: MicrohubCommentRequest) -> dict:
    session = _require_session()
    if pr_id not in session.microhub_pr_states:
        found = any(p["id"] == pr_id for p in session.microhub_user_created_prs)
        if not found:
            raise HTTPException(status_code=404, detail=f"PR not found: {pr_id}")
    comment_id = f"user-comment-{len(session.microhub_user_created_comments) + 1}"
    comment = {
        "id": comment_id,
        "targetId": pr_id,
        "targetType": "pr",
        "author": "achen",
        "authorId": "user001",
        "body": body.body,
        "reactions": [],
        "order": len(session.microhub_user_created_comments),
    }
    session.microhub_user_created_comments.append(comment)
    return {"success": True, "comment": comment}


@app.post("/data/microhub-issues/{issue_id}/close", response_model=StateChangeResponse)
async def data_hub_close_issue(issue_id: str) -> dict:
    session = _require_session()
    if issue_id not in session.microhub_issue_states:
        raise HTTPException(status_code=404, detail=f"Issue not found: {issue_id}")
    current = session.microhub_issue_states[issue_id].get("state", "open")
    new_state = "closed" if current == "open" else "open"
    session.microhub_issue_states[issue_id]["state"] = new_state
    return {"success": True, "state": new_state}


@app.post("/data/microhub-pulls/{pr_id}/merge", response_model=MergeResponse)
async def data_hub_merge_pr(pr_id: str, body: MicrohubMergeRequest) -> dict:
    session = _require_session()
    if pr_id not in session.microhub_pr_states:
        raise HTTPException(status_code=404, detail=f"PR not found: {pr_id}")
    if pr_id in session.microhub_merged_prs:
        return {"success": False, "error": "PR already merged"}
    session.microhub_merged_prs.add(pr_id)
    session.microhub_pr_states[pr_id]["state"] = "merged"
    return {"success": True, "state": "merged", "strategy": body.strategy}


@app.post("/data/microhub-users/{username}/follow", response_model=ToggleFollowingResponse)
async def data_hub_follow_user(username: str) -> dict:
    session = _require_session()
    if username in session.microhub_following_users:
        session.microhub_following_users.discard(username)
        return {"success": True, "isFollowing": False}
    else:
        session.microhub_following_users.add(username)
        return {"success": True, "isFollowing": True}


@app.get("/data/microhub-following", response_model=MicrohubFollowingResponse)
async def data_hub_following() -> MicrohubFollowingResponse:
    session = _require_session()
    return MicrohubFollowingResponse(following=list(session.microhub_following_users))


@app.get("/data/microhub-users", response_model=MicrohubUsersResponse)
async def data_hub_users() -> MicrohubUsersResponse:
    users = [u for u in USER_CATALOG.values() if u.get("microhub")]
    return MicrohubUsersResponse(users=users)


# ---------------------------------------------------------------------------
# MicroLendar data endpoints
# ---------------------------------------------------------------------------

@app.get("/data/microlendar-events", response_model=MicrolendarEventsResponse)
async def data_lendar_events() -> MicrolendarEventsResponse:
    session = _require_session()
    events = []
    category_colors = {"Work": "#039BE5", "Personal": "#7986CB", "Family": "#33B679"}
    for ev in session.microlendar_events:
        st = session.microlendar_event_states.get(ev["id"], {})
        if st.get("deleted"):
            continue
        if ev.get("is_task"):
            continue
        merged = {**ev, **st}
        # Normalize to CalendarEvent format
        start_time = merged.get("start_time")
        end_time = merged.get("end_time")
        start_dt = None
        if start_time and "T" in start_time:
            from datetime import datetime, timezone
            start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end_dt = None
        if end_time and "T" in end_time:
            from datetime import datetime, timezone
            end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
        def _fmt_time(dt):
            if dt is None:
                return ""
            h = dt.hour
            m = dt.minute
            ampm = "pm" if h >= 12 else "am"
            dh = h % 12 or 12
            return f"{dh}:{m:02d}{ampm}"
        events.append({
            "id": merged["id"],
            "title": merged.get("title", ""),
            "date": start_dt.strftime("%Y-%m-%d") if start_dt else "",
            "time": _fmt_time(start_dt),
            "endTime": _fmt_time(end_dt) if end_dt else None,
            "color": category_colors.get(merged.get("category", "Work"), "#039BE5"),
            "calendar": merged.get("category", "Work"),
            "description": merged.get("description", ""),
            "location": merged.get("location", ""),
            "attendees": merged.get("attendees", []),
            "isTask": False,
            "isCompleted": False,
            "isConflict": merged.get("is_conflict", False),
            "taskType": merged.get("task_type", "events"),
            "order": merged.get("event_order", 0),
        })
    # Also include user-created events
    for ev in session.microlendar_user_created_events:
        if not ev.get("deleted"):
            events.append(ev)
    # Evaluate success on each poll
    return MicrolendarEventsResponse(events=events)


@app.get("/data/microlendar-tasks", response_model=MicrolendarTasksResponse)
async def data_lendar_tasks() -> MicrolendarTasksResponse:
    session = _require_session()
    tasks = []
    for t in session.microlendar_tasks:
        st = session.microlendar_task_states.get(t["id"], {})
        if st.get("deleted"):
            continue
        tasks.append({
            "id": t["id"],
            "title": t.get("title", ""),
            "completed": st.get("completed", bool(t.get("is_completed", False))),
            "dueDate": t["start_time"].split("T")[0] if t.get("start_time") else None,
        })
    for t in session.microlendar_user_created_tasks:
        if not t.get("deleted"):
            tasks.append(t)
    return MicrolendarTasksResponse(tasks=tasks)


@app.post("/data/microlendar-events", response_model=CreateEventResponse)
async def data_lendar_create_event(body: MicrolendarCreateEventRequest) -> dict:
    session = _require_session()
    eid = f"user-event-{len(session.microlendar_user_created_events) + 1}"
    category_colors = {"Work": "#039BE5", "Personal": "#7986CB", "Family": "#33B679"}
    new_event = {
        "id": eid,
        "title": body.title,
        "date": body.date,
        "time": body.time,
        "endTime": body.endTime,
        "color": category_colors.get(body.calendar, "#039BE5"),
        "calendar": body.calendar,
        "description": body.description,
        "location": body.location,
        "attendees": [],
        "isTask": False,
        "isCompleted": False,
        "isConflict": False,
    }
    session.microlendar_user_created_events.append(new_event)
    return {"success": True, "event": new_event}


@app.post("/data/microlendar-events/{event_id}/update", response_model=SuccessResponse)
async def data_lendar_update_event(event_id: str, body: MicrolendarUpdateEventRequest) -> dict:
    session = _require_session()
    # Check catalog events
    if event_id in session.microlendar_event_states:
        updates = body.model_dump(exclude_none=True)
        session.microlendar_event_states[event_id].update(updates)
        return {"success": True}
    # Check user events
    for ev in session.microlendar_user_created_events:
        if ev["id"] == event_id:
            updates = body.model_dump(exclude_none=True)
            ev.update(updates)
            return {"success": True}
    raise HTTPException(status_code=404, detail=f"Event not found: {event_id}")


@app.post("/data/microlendar-events/{event_id}/delete", response_model=SuccessResponse)
async def data_lendar_delete_event(event_id: str) -> dict:
    session = _require_session()
    if event_id in session.microlendar_event_states:
        session.microlendar_event_states[event_id]["deleted"] = True
        return {"success": True}
    for ev in session.microlendar_user_created_events:
        if ev["id"] == event_id:
            ev["deleted"] = True
            return {"success": True}
    raise HTTPException(status_code=404, detail=f"Event not found: {event_id}")


@app.post("/data/microlendar-tasks", response_model=CreateTaskResponse)
async def data_lendar_create_task(body: MicrolendarCreateTaskRequest) -> dict:
    session = _require_session()
    tid = f"user-task-{len(session.microlendar_user_created_tasks) + 1}"
    new_task = {
        "id": tid,
        "title": body.title,
        "completed": False,
        "dueDate": body.dueDate,
    }
    session.microlendar_user_created_tasks.append(new_task)
    return {"success": True, "task": new_task}


@app.post("/data/microlendar-tasks/{task_id}/complete", response_model=ToggleCompleteResponse)
async def data_lendar_complete_task(task_id: str) -> dict:
    session = _require_session()
    if task_id in session.microlendar_task_states:
        current = session.microlendar_task_states[task_id].get("completed", False)
        session.microlendar_task_states[task_id]["completed"] = not current
        return {"success": True, "completed": not current}
    for t in session.microlendar_user_created_tasks:
        if t["id"] == task_id:
            t["completed"] = not t.get("completed", False)
            return {"success": True, "completed": t["completed"]}
    raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")


@app.post("/data/microlendar-tasks/{task_id}/delete", response_model=SuccessResponse)
async def data_lendar_delete_task(task_id: str) -> dict:
    session = _require_session()
    if task_id in session.microlendar_task_states:
        session.microlendar_task_states[task_id]["deleted"] = True
        return {"success": True}
    for t in session.microlendar_user_created_tasks:
        if t["id"] == task_id:
            t["deleted"] = True
            return {"success": True}
    raise HTTPException(status_code=404, detail=f"Task not found: {task_id}")


# ---------------------------------------------------------------------------
# MicroScholar data endpoints
# ---------------------------------------------------------------------------

@app.get("/data/microscholar-papers", response_model=MicroscholarPapersResponse)
async def data_scholar_papers(
    search: Optional[str] = Query(None),
    advanced: Optional[bool] = Query(None),
    allWords: Optional[str] = Query(None),
    exactPhrase: Optional[str] = Query(None),
    atLeastOne: Optional[str] = Query(None),
    without: Optional[str] = Query(None),
    author: Optional[str] = Query(None),
    publication: Optional[str] = Query(None),
    dateStart: Optional[str] = Query(None),
    dateEnd: Optional[str] = Query(None),
) -> MicroscholarPapersResponse:
    session = _require_session()
    papers = []
    for p in session.microscholar_papers:
        st = session.microscholar_paper_states.get(p["id"], {})
        papers.append({**p, **st})

    # Server-side search filtering
    if advanced:
        if allWords and allWords.strip():
            words = allWords.lower().split()
            papers = [
                p for p in papers
                if all(
                    w in f"{p.get('title', '')} {p.get('snippet', '')} {p.get('authors', '')}".lower()
                    for w in words
                )
            ]
        if exactPhrase and exactPhrase.strip():
            phrase = exactPhrase.lower()
            papers = [
                p for p in papers
                if phrase in f"{p.get('title', '')} {p.get('snippet', '')}".lower()
            ]
        if atLeastOne and atLeastOne.strip():
            words = atLeastOne.lower().split()
            papers = [
                p for p in papers
                if any(
                    w in f"{p.get('title', '')} {p.get('snippet', '')} {p.get('authors', '')}".lower()
                    for w in words
                )
            ]
        if without and without.strip():
            words = without.lower().split()
            papers = [
                p for p in papers
                if not any(
                    w in f"{p.get('title', '')} {p.get('snippet', '')} {p.get('authors', '')}".lower()
                    for w in words
                )
            ]
        if author and author.strip():
            aq = author.lower()
            papers = [p for p in papers if aq in p.get("authors", "").lower()]
        if publication and publication.strip():
            pq = publication.lower()
            papers = [p for p in papers if pq in p.get("source", "").lower()]
        if dateStart and dateStart.strip():
            try:
                sy = int(dateStart)
                papers = [p for p in papers if p.get("year", 0) >= sy]
            except ValueError:
                pass
        if dateEnd and dateEnd.strip():
            try:
                ey = int(dateEnd)
                papers = [p for p in papers if p.get("year", 9999) <= ey]
            except ValueError:
                pass
    elif search and search.strip():
        q = search.lower()
        papers = [
            p for p in papers
            if q in p.get("title", "").lower()
            or q in p.get("authors", "").lower()
            or q in p.get("snippet", "").lower()
            or q in p.get("source", "").lower()
        ]

    return MicroscholarPapersResponse(papers=papers)


@app.get("/data/microscholar-papers/{paper_id}", response_model=MicroscholarPaperDetailResponse)
async def data_scholar_paper_detail(paper_id: str) -> MicroscholarPaperDetailResponse:
    session = _require_session()
    for p in session.microscholar_papers:
        if p["id"] == paper_id:
            st = session.microscholar_paper_states.get(paper_id, {})
            return MicroscholarPaperDetailResponse(paper={**p, **st})
    raise HTTPException(status_code=404, detail=f"Paper not found: {paper_id}")


@app.post("/data/microscholar-papers/{paper_id}/cite", response_model=SuccessResponse)
async def data_scholar_cite_paper(paper_id: str) -> dict:
    session = _require_session()
    if paper_id not in session.microscholar_paper_states:
        raise HTTPException(status_code=404, detail=f"Paper not found: {paper_id}")
    session.microscholar_paper_states[paper_id]["isCited"] = True
    return {"success": True}


@app.post("/data/microscholar-papers/{paper_id}/save", response_model=ToggleSaveResponse)
async def data_scholar_save_paper(paper_id: str) -> dict:
    session = _require_session()
    if paper_id not in session.microscholar_paper_states:
        raise HTTPException(status_code=404, detail=f"Paper not found: {paper_id}")
    current = session.microscholar_paper_states[paper_id].get("isSaved", False)
    session.microscholar_paper_states[paper_id]["isSaved"] = not current
    return {"success": True, "isSaved": not current}


@app.get("/data/microscholar-alerts", response_model=MicroscholarAlertsResponse)
async def data_scholar_alerts() -> MicroscholarAlertsResponse:
    session = _require_session()
    alerts = []
    for a in session.microscholar_alerts:
        st = session.microscholar_alert_states.get(a["id"], {})
        alerts.append({**a, **st})
    return MicroscholarAlertsResponse(alerts=alerts)


@app.post("/data/microscholar-alerts/{alert_id}/read", response_model=SuccessResponse)
async def data_scholar_mark_alert_read(alert_id: str) -> dict:
    session = _require_session()
    if alert_id not in session.microscholar_alert_states:
        raise HTTPException(status_code=404, detail=f"Alert not found: {alert_id}")
    session.microscholar_alert_states[alert_id]["isRead"] = True
    return {"success": True}


@app.get("/data/microscholar-coauthors", response_model=MicroscholarCoauthorsResponse)
async def data_scholar_coauthors() -> MicroscholarCoauthorsResponse:
    session = _require_session()
    return MicroscholarCoauthorsResponse(coauthors=session.microscholar_coauthors)


@app.get("/data/microscholar-users", response_model=MicroscholarUsersResponse)
async def data_scholar_users() -> MicroscholarUsersResponse:
    users = [u for u in USER_CATALOG.values() if u.get("microscholar")]
    return MicroscholarUsersResponse(users=users)


# ---------------------------------------------------------------------------
# MicroTube data endpoints
# ---------------------------------------------------------------------------

@app.get("/data/microtube-videos", response_model=MicrotubeVideosResponse)
async def data_tube_videos(
    search: Optional[str] = Query(None),
) -> MicrotubeVideosResponse:
    session = _require_session()
    videos = []
    for v in session.microtube_videos:
        st = session.microtube_video_states.get(v["id"], {})
        watched = v["id"] in session.microtube_watched_videos
        videos.append({**v, **st, "isWatched": watched})
    if search and search.strip():
        q = search.lower()
        videos = [
            v for v in videos
            if q in v.get("title", "").lower()
            or q in v.get("description", "").lower()
            or q in v.get("channelName", "").lower()
        ]
    return MicrotubeVideosResponse(videos=videos)


@app.get("/data/microtube-videos/{video_id}", response_model=MicrotubeVideoDetailResponse)
async def data_tube_video_detail(video_id: str) -> MicrotubeVideoDetailResponse:
    session = _require_session()
    for v in session.microtube_videos:
        if v["id"] == video_id:
            st = session.microtube_video_states.get(video_id, {})
            watched = video_id in session.microtube_watched_videos
            return MicrotubeVideoDetailResponse(video={**v, **st, "isWatched": watched})
    raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")


@app.get("/data/microtube-channels", response_model=MicrotubeChannelsResponse)
async def data_tube_channels() -> MicrotubeChannelsResponse:
    session = _require_session()
    channels = []
    for ch in session.microtube_channels:
        st = session.microtube_channel_states.get(ch["id"], {})
        channels.append({**ch, **st})
    return MicrotubeChannelsResponse(channels=channels)


@app.get("/data/microtube-channels/{channel_id}", response_model=MicrotubeChannelDetailResponse)
async def data_tube_channel_detail(channel_id: str) -> MicrotubeChannelDetailResponse:
    session = _require_session()
    for ch in session.microtube_channels:
        if ch["id"] == channel_id:
            st = session.microtube_channel_states.get(channel_id, {})
            # Include channel's videos
            channel_videos = [
                {**v, **session.microtube_video_states.get(v["id"], {})}
                for v in session.microtube_videos
                if v.get("channel_id") == channel_id
            ]
            return MicrotubeChannelDetailResponse(channel={**ch, **st, "channelVideos": channel_videos})
    raise HTTPException(status_code=404, detail=f"Channel not found: {channel_id}")


@app.get("/data/microtube-comments", response_model=MicrotubeCommentsResponse)
async def data_tube_comments(
    video_id: Optional[str] = Query(None),
) -> MicrotubeCommentsResponse:
    session = _require_session()
    comments = list(session.microtube_comments)
    # Include user-created comments
    comments.extend(session.microtube_user_created_comments)
    if video_id:
        comments = [c for c in comments if c.get("video_id") == video_id]
    return MicrotubeCommentsResponse(comments=comments)


@app.get("/data/microtube-notifications", response_model=MicrotubeNotificationsResponse)
async def data_tube_notifications() -> MicrotubeNotificationsResponse:
    session = _require_session()
    notifications = []
    for n in session.microtube_notifications:
        st = session.microtube_notification_states.get(n["id"], {})
        notifications.append({**n, **st})
    return MicrotubeNotificationsResponse(notifications=notifications)


@app.get("/data/microtube-playlists", response_model=MicrotubePlaylistsResponse)
async def data_tube_playlists() -> MicrotubePlaylistsResponse:
    session = _require_session()
    return MicrotubePlaylistsResponse(playlists=session.microtube_user_created_playlists)


@app.post("/data/microtube-videos/{video_id}/like", response_model=ToggleLikeResponse)
async def data_tube_like_video(video_id: str) -> dict:
    session = _require_session()
    if video_id not in session.microtube_video_states:
        raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")
    st = session.microtube_video_states[video_id]
    current = st.get("isLiked", False)
    st["isLiked"] = not current
    if not current:
        st["isDisliked"] = False
    return {"success": True, "isLiked": st["isLiked"]}


@app.post("/data/microtube-videos/{video_id}/dislike", response_model=ToggleDislikeResponse)
async def data_tube_dislike_video(video_id: str) -> dict:
    session = _require_session()
    if video_id not in session.microtube_video_states:
        raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")
    st = session.microtube_video_states[video_id]
    current = st.get("isDisliked", False)
    st["isDisliked"] = not current
    if not current:
        st["isLiked"] = False
    return {"success": True, "isDisliked": st["isDisliked"]}


@app.post("/data/microtube-videos/{video_id}/save", response_model=ToggleSaveResponse)
async def data_tube_save_video(video_id: str) -> dict:
    session = _require_session()
    if video_id not in session.microtube_video_states:
        raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")
    st = session.microtube_video_states[video_id]
    current = st.get("isSaved", False)
    st["isSaved"] = not current
    return {"success": True, "isSaved": st["isSaved"]}


@app.post("/data/microtube-videos/{video_id}/watch", response_model=SuccessResponse)
async def data_tube_watch_video(video_id: str) -> dict:
    session = _require_session()
    if video_id not in session.microtube_video_states:
        raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")
    session.microtube_watched_videos.add(video_id)
    return {"success": True}


@app.post("/data/microtube-comments", response_model=CommentResponse)
async def data_tube_post_comment(body: MicrotubeCommentRequest) -> dict:
    session = _require_session()
    comment = {
        "id": f"user-cmt-{len(session.microtube_user_created_comments) + 1}",
        "video_id": body.video_id,
        "content": body.content,
        "user_id": "user000",
        "userName": "You",
        "userAvatar": "",
        "likes": 0,
        "replies": 0,
    }
    session.microtube_user_created_comments.append(comment)
    return {"success": True, "comment": comment}


@app.post("/data/microtube-channels/{channel_id}/subscribe", response_model=ToggleSubscribeResponse)
async def data_tube_subscribe_channel(channel_id: str) -> dict:
    session = _require_session()
    if channel_id not in session.microtube_channel_states:
        raise HTTPException(status_code=404, detail=f"Channel not found: {channel_id}")
    st = session.microtube_channel_states[channel_id]
    current = st.get("isSubscribed", False)
    st["isSubscribed"] = not current
    base = next((c["subscribers"] for c in session.microtube_channels if c["id"] == channel_id), 0)
    effective = st.get("subscribers", base)
    effective = effective + 1 if st["isSubscribed"] else max(0, effective - 1)
    st["subscribers"] = effective
    return {"success": True, "isSubscribed": st["isSubscribed"]}


@app.post("/data/microtube-notifications/{notif_id}/dismiss", response_model=SuccessResponse)
async def data_tube_dismiss_notification(notif_id: str) -> dict:
    session = _require_session()
    if notif_id not in session.microtube_notification_states:
        raise HTTPException(status_code=404, detail=f"Notification not found: {notif_id}")
    session.microtube_notification_states[notif_id]["isDismissed"] = True
    return {"success": True}


@app.post("/data/microtube-notifications/{notif_id}/read", response_model=SuccessResponse)
async def data_tube_read_notification(notif_id: str) -> dict:
    session = _require_session()
    if notif_id not in session.microtube_notification_states:
        raise HTTPException(status_code=404, detail=f"Notification not found: {notif_id}")
    session.microtube_notification_states[notif_id]["isRead"] = True
    return {"success": True}


@app.post("/data/microtube-playlists", response_model=CreatePlaylistResponse)
async def data_tube_create_playlist(body: MicrotubeCreatePlaylistRequest) -> dict:
    session = _require_session()
    playlist = {
        "id": f"pl-user-{len(session.microtube_user_created_playlists) + 1}",
        "name": body.name,
        "video_ids": [],
    }
    session.microtube_user_created_playlists.append(playlist)
    return {"success": True, "playlist": playlist}


@app.post("/data/microtube-playlists/{playlist_id}/add", response_model=SuccessResponse)
async def data_tube_add_to_playlist(playlist_id: str, body: MicrotubeAddToPlaylistRequest) -> dict:
    session = _require_session()
    for pl in session.microtube_user_created_playlists:
        if pl["id"] == playlist_id:
            if body.video_id not in pl["video_ids"]:
                pl["video_ids"].append(body.video_id)
            return {"success": True}
    raise HTTPException(status_code=404, detail=f"Playlist not found: {playlist_id}")


# ---------------------------------------------------------------------------
# Image serving
# ---------------------------------------------------------------------------

@app.get("/data/images/{filename}")
async def serve_image(filename: str) -> Response:
    conn = sqlite3.connect(_SHARED_DB)
    row = conn.execute(
        "SELECT content_type, data FROM images WHERE filename = ?", (filename,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail=f"Image not found: {filename}")
    return Response(content=row[1], media_type=row[0])


# ---------------------------------------------------------------------------
# Scenario listing
# ---------------------------------------------------------------------------

@app.get("/scenarios")
async def list_scenarios() -> JSONResponse:
    return JSONResponse(content={"scenarios": list(_SCENARIOS.keys())})


@app.get("/scenarios/{scenario_id}")
async def get_scenario(scenario_id: str) -> JSONResponse:
    sc = _SCENARIOS.get(scenario_id)
    if sc is None:
        raise HTTPException(status_code=404, detail=f"Scenario not found: {scenario_id}")
    return JSONResponse(content=sc)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.server:app", host="0.0.0.0", port=8000, workers=1)
