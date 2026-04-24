"""Tests for speed_factor plumbing.

speed_factor is a load-time scalar: at /init, authored event times (and
condition_at, event_timeline_end) are divided by speed_factor. After that
wall-clock == sim-clock, 1:1. So speed_factor > 1 is faster (events fire
sooner in wall-time); speed_factor < 1 is slower; MAX_SPEED_FACTOR = 4.0
is the fastest allowed.
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

import pytest
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.schemas import InitPayload
from server.session import Session
from server.timing import (
    KILL_AT,
    MAX_CONDITION_AT,
    MAX_SPEED_FACTOR,
    REACTION_WINDOW,
    kill_at_wall,
    validate_speed_factor,
)


# ---------------------------------------------------------------------------
# validate_speed_factor
# ---------------------------------------------------------------------------

def test_validate_speed_factor_default_one():
    assert validate_speed_factor(1.0) == 1.0


def test_validate_speed_factor_max_allowed():
    assert validate_speed_factor(MAX_SPEED_FACTOR) == MAX_SPEED_FACTOR


def test_validate_speed_factor_small_allowed():
    # No floor on slow side — 0.1x (10x slower) is fine.
    assert validate_speed_factor(0.1) == 0.1


def test_validate_speed_factor_above_max_raises():
    with pytest.raises(ValueError, match="above MAX_SPEED_FACTOR"):
        validate_speed_factor(MAX_SPEED_FACTOR * 2)


def test_validate_speed_factor_zero_raises():
    with pytest.raises(ValueError, match="must be positive"):
        validate_speed_factor(0.0)


def test_validate_speed_factor_negative_raises():
    with pytest.raises(ValueError, match="must be positive"):
        validate_speed_factor(-1.0)


# ---------------------------------------------------------------------------
# kill_at_wall
# ---------------------------------------------------------------------------

def test_kill_at_wall_default_matches_constant():
    # speed_factor=1 → kill_at_wall equals KILL_AT.
    assert kill_at_wall(1.0) == KILL_AT


def test_kill_at_wall_reaction_window_stays_constant():
    # Reaction window is 30 wall-sec independent of speed_factor.
    # kill_at_wall(sf) - MAX_CONDITION_AT / sf == REACTION_WINDOW for all sf.
    for sf in (0.25, 0.5, 1.0, 2.0, 4.0):
        assert kill_at_wall(sf) - MAX_CONDITION_AT / sf == pytest.approx(REACTION_WINDOW)


def test_kill_at_wall_shrinks_with_faster_speed():
    # Faster speed_factor → shorter wall-clock run.
    assert kill_at_wall(2.0) == pytest.approx(MAX_CONDITION_AT / 2.0 + REACTION_WINDOW)
    assert kill_at_wall(4.0) == pytest.approx(MAX_CONDITION_AT / 4.0 + REACTION_WINDOW)


def test_kill_at_wall_grows_with_slower_speed():
    assert kill_at_wall(0.5) == pytest.approx(MAX_CONDITION_AT / 0.5 + REACTION_WINDOW)


# ---------------------------------------------------------------------------
# InitPayload schema
# ---------------------------------------------------------------------------

def _base_payload(**overrides):
    body = {
        "environment": "micromail",
        "event_timeline_end": 720.0,
        "eval_sql": "",
        "events": [],
    }
    body.update(overrides)
    return body


def test_init_payload_default_speed_factor():
    p = InitPayload(**_base_payload())
    assert p.speed_factor == 1.0


def test_init_payload_accepts_valid_speed_factor():
    p = InitPayload(**_base_payload(speed_factor=2.5))
    assert p.speed_factor == 2.5


def test_init_payload_rejects_above_max():
    with pytest.raises(ValidationError):
        InitPayload(**_base_payload(speed_factor=MAX_SPEED_FACTOR * 2))


def test_init_payload_rejects_zero():
    with pytest.raises(ValidationError):
        InitPayload(**_base_payload(speed_factor=0.0))


# ---------------------------------------------------------------------------
# /init event-time scaling
# ---------------------------------------------------------------------------

def test_init_scales_event_times_for_fast_speed():
    """speed_factor=2.0 halves every authored event time."""
    from fastapi.testclient import TestClient
    from server import server as srv

    with TestClient(srv.app) as client:
        # Ensure preinit
        if client.get("/status").json()["status"] != "preinit":
            client.get("/close")

        resp = client.post(
            "/init",
            json={
                "environment": "micromail",
                "event_timeline_end": 720.0,
                "eval_sql": "",
                "condition_at": 600.0,
                "speed_factor": 2.0,
                "events": [
                    {"time": 4.0, "type": "noop", "payload": {}},
                    {"time": 300.0, "type": "noop", "payload": {}},
                ],
            },
        )
        assert resp.status_code == 200
        session = srv._session
        assert session is not None
        assert [e["time"] for e in session.events] == [2.0, 150.0]
        assert session.condition_at == 300.0
        assert session.event_timeline_end == 360.0
        client.get("/close")


def test_init_scales_event_times_for_slow_speed():
    """speed_factor=0.5 doubles every authored event time."""
    from fastapi.testclient import TestClient
    from server import server as srv

    with TestClient(srv.app) as client:
        if client.get("/status").json()["status"] != "preinit":
            client.get("/close")

        resp = client.post(
            "/init",
            json={
                "environment": "micromail",
                "event_timeline_end": 720.0,
                "eval_sql": "",
                "condition_at": 300.0,
                "speed_factor": 0.5,
                "events": [{"time": 10.0, "type": "noop", "payload": {}}],
            },
        )
        assert resp.status_code == 200
        session = srv._session
        assert session is not None
        assert session.events[0]["time"] == 20.0
        assert session.condition_at == 600.0
        assert session.event_timeline_end == 1440.0
        client.get("/close")


def test_init_default_speed_factor_is_identity():
    """speed_factor=1.0 leaves authored values untouched."""
    from fastapi.testclient import TestClient
    from server import server as srv

    with TestClient(srv.app) as client:
        if client.get("/status").json()["status"] != "preinit":
            client.get("/close")

        resp = client.post(
            "/init",
            json={
                "environment": "micromail",
                "event_timeline_end": 720.0,
                "eval_sql": "",
                "condition_at": 600.0,
                "events": [{"time": 42.0, "type": "noop", "payload": {}}],
            },
        )
        assert resp.status_code == 200
        session = srv._session
        assert session is not None
        assert session.events[0]["time"] == 42.0
        assert session.condition_at == 600.0
        assert session.event_timeline_end == 720.0
        client.get("/close")


# ---------------------------------------------------------------------------
# _run_auto timing: wall == sim, 1:1
# ---------------------------------------------------------------------------

def _make_session(speed_factor: float, events: list[dict]) -> Session:
    return Session(
        status="running_auto",
        simulation_time=0.0,
        start_wall_time=time.time(),
        events=events,
        next_event_index=0,
        environment="micromail",
        event_timeline_end=720.0,
        baseline_metrics={},
        speed_factor=speed_factor,
    )


async def _drive_auto(session: Session, wall_budget: float) -> None:
    """Run _run_auto for up to wall_budget wall-seconds, then cancel."""
    from server import server as srv

    task = asyncio.create_task(srv._run_auto(session))
    try:
        await asyncio.wait_for(task, timeout=wall_budget)
    except asyncio.TimeoutError:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


def test_run_auto_wall_equals_sim_at_default_speed():
    """After ~1 wall-sec, simulation_time is ~1."""
    async def run():
        session = _make_session(speed_factor=1.0, events=[{"time": 100.0, "type": "noop"}])
        await _drive_auto(session, wall_budget=1.1)
        return session.simulation_time

    sim_time = asyncio.run(run())
    assert 0.5 <= sim_time <= 1.8, f"sim_time={sim_time}"


def test_run_auto_wall_equals_sim_regardless_of_speed():
    """speed_factor field doesn't warp the runtime clock — wall == sim either way."""
    async def run(sf):
        session = _make_session(speed_factor=sf, events=[{"time": 100.0, "type": "noop"}])
        await _drive_auto(session, wall_budget=1.1)
        return session.simulation_time

    # Scaling already happened at /init; here events are already post-scale.
    for sf in (0.25, 1.0, 4.0):
        sim_time = asyncio.run(run(sf))
        assert 0.5 <= sim_time <= 1.8, f"sf={sf} sim_time={sim_time}"


def test_run_auto_fires_event_on_wall_clock():
    """An event at t=1 fires after ~1 wall-sec, independent of speed_factor field."""
    fired: list[dict] = []

    async def run():
        from server import server as srv

        # Patch dispatch to record events without needing a handler.
        original = srv._dispatch_process_event
        srv._dispatch_process_event = lambda sess, ev: fired.append(ev)
        try:
            session = _make_session(
                speed_factor=2.0,
                events=[{"time": 1.0, "type": "noop", "payload": {}}],
            )
            await _drive_auto(session, wall_budget=1.6)
        finally:
            srv._dispatch_process_event = original

    asyncio.run(run())
    assert len(fired) == 1
