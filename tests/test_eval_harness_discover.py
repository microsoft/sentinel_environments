"""Tests for eval_harness.discover_tasks task-id / substring filtering."""
from server.eval_harness import discover_tasks


def _pick_known_scenario():
    """Return one (env, scenario_id) that exists in the repo's scenarios/ tree."""
    for env, sid, _path in discover_tasks():
        return env, sid
    raise RuntimeError("no scenarios discovered")


def test_discover_tasks_no_filter_yields_many():
    tasks = list(discover_tasks())
    assert len(tasks) > 1, "expected the repo to contain multiple scenarios"


def test_discover_tasks_exact_task_id_matches_one():
    _, sid = _pick_known_scenario()
    tasks = list(discover_tasks(task_id=sid))
    assert len(tasks) == 1
    assert tasks[0][1] == sid


def test_discover_tasks_unknown_task_id_yields_nothing():
    tasks = list(discover_tasks(task_id="this-scenario-does-not-exist-xyz"))
    assert tasks == []


def test_discover_tasks_filter_substring_narrows_results():
    all_tasks = list(discover_tasks())
    # Pick a substring guaranteed to match at least one id.
    _, sid = _pick_known_scenario()
    needle = sid[: max(3, len(sid) // 2)].lower()
    filtered = list(discover_tasks(name_filter=needle))
    assert 0 < len(filtered) <= len(all_tasks)
    for _env, fid, _path in filtered:
        assert needle in fid.lower()


def test_discover_tasks_task_id_and_filter_combine_as_and():
    _, sid = _pick_known_scenario()
    # Same id, matching filter -> yields the task.
    tasks = list(discover_tasks(task_id=sid, name_filter=sid.lower()))
    assert len(tasks) == 1
    # Same id, non-matching filter -> empty.
    tasks = list(discover_tasks(task_id=sid, name_filter="zzz-no-match"))
    assert tasks == []
