# handler for the microhub (code hosting) environment.
# reads immutable repo/issue/pr/commit data from catalogs.py, mutable state from session.py.
# provides functions for listing repos, files, issues, prs, commits, workflows, wiki, and more.
#
# flow: server.py route -> microhub handler -> reads MICROHUB_*_CATALOG + session -> returns data
# example: POST /microhub/issues/{id}/comment -> add_comment() -> appends to session.microhub_user_created_comments

from __future__ import annotations

import bisect
import json
import sqlite3
import time
from typing import TYPE_CHECKING

from server.catalogs import (
    MICROHUB_REPOSITORY_CATALOG,
    MICROHUB_FILE_CATALOG,
    MICROHUB_ISSUE_CATALOG,
    MICROHUB_PR_CATALOG,
    MICROHUB_COMMIT_CATALOG,
    MICROHUB_WORKFLOW_RUN_CATALOG,
    MICROHUB_WORKFLOW_CATALOG,
    MICROHUB_WIKI_CATALOG,
    MICROHUB_PROJECT_CATALOG,
    MICROHUB_ACTIVITY_CATALOG,
    MICROHUB_INSIGHT_CATALOG,
    MICROHUB_RELEASE_CATALOG,
    MICROHUB_LABEL_CATALOG,
    MICROHUB_SECURITY_CATALOG,
    MICROHUB_CODE_SCANNING_CATALOG,
    MICROHUB_SETTINGS_CATALOG,
    MICROHUB_DEPLOYMENT_CATALOG,
    MICROHUB_PACKAGE_CATALOG,
    USER_CATALOG,
)

if TYPE_CHECKING:
    from server.session import Session


# ---------------------------------------------------------------------------
# Row builders -- convert catalog rows (snake_case) to API format (camelCase)
# ---------------------------------------------------------------------------

def _resolve_user(user_id: str) -> dict:
    """Return resolved user fields for a given user ID."""
    u = USER_CATALOG.get(user_id, {})
    return {"name": u.get("name", "Unknown"), "avatarUrl": u.get("avatarUrl", "")}


def _build_issue_row(raw: dict) -> dict:
    resolved = _resolve_user(raw["author_id"])
    raw_comments = raw["comments"] if isinstance(raw["comments"], list) else json.loads(raw["comments"])
    # Resolve comment authors (copy to avoid mutating catalog data)
    comments = []
    for c in raw_comments:
        rc = dict(c)
        if "authorId" in rc or "author_id" in rc:
            cid = rc.get("authorId", rc.get("author_id", ""))
            cr = _resolve_user(cid)
            rc["authorAvatarUrl"] = cr["avatarUrl"]
        comments.append(rc)
    return {
        "id": raw["id"],
        "number": raw["number"],
        "title": raw["title"],
        "body": raw["body"],
        "state": raw["state"],
        "author": raw["author"],
        "authorId": raw["author_id"],
        "authorAvatarUrl": resolved["avatarUrl"],
        "assignees": raw["assignees"] if isinstance(raw["assignees"], list) else json.loads(raw["assignees"]),
        "labelIds": raw["label_ids"] if isinstance(raw["label_ids"], list) else json.loads(raw["label_ids"]),
        "comments": comments,
        "milestone": raw.get("milestone"),
        "order": raw["order"],
    }


def _build_pr_row(raw: dict) -> dict:
    resolved = _resolve_user(raw["author_id"])
    raw_comments = raw["comments"] if isinstance(raw["comments"], list) else json.loads(raw["comments"])
    comments = []
    for c in raw_comments:
        rc = dict(c)
        if "authorId" in rc or "author_id" in rc:
            cid = rc.get("authorId", rc.get("author_id", ""))
            cr = _resolve_user(cid)
            rc["authorAvatarUrl"] = cr["avatarUrl"]
        comments.append(rc)
    return {
        "id": raw["id"],
        "number": raw["number"],
        "title": raw["title"],
        "body": raw["body"],
        "state": raw["state"],
        "author": raw["author"],
        "authorId": raw["author_id"],
        "authorAvatarUrl": resolved["avatarUrl"],
        "assignees": raw["assignees"] if isinstance(raw["assignees"], list) else json.loads(raw["assignees"]),
        "reviewers": raw["reviewers"] if isinstance(raw["reviewers"], list) else json.loads(raw["reviewers"]),
        "labelIds": raw["label_ids"] if isinstance(raw["label_ids"], list) else json.loads(raw["label_ids"]),
        "sourceBranch": raw["source_branch"],
        "targetBranch": raw["target_branch"],
        "commits": raw["commits"],
        "additions": raw["additions"],
        "deletions": raw["deletions"],
        "filesChanged": raw["files_changed"],
        "reviewStatus": raw["review_status"],
        "checks": raw["checks"] if isinstance(raw["checks"], list) else json.loads(raw["checks"]),
        "comments": comments,
        "order": raw["order"],
    }


def _build_commit_row(raw: dict) -> dict:
    resolved = _resolve_user(raw["author_id"])
    return {
        "id": raw["id"],
        "sha": raw["sha"],
        "message": raw["message"],
        "description": raw.get("description"),
        "author": raw["author"],
        "authorId": raw["author_id"],
        "authorAvatarUrl": resolved["avatarUrl"],
        "branch": raw["branch"],
        "additions": raw["additions"],
        "deletions": raw["deletions"],
        "filesChanged": raw["files_changed"] if isinstance(raw["files_changed"], list) else json.loads(raw["files_changed"]),
        "verified": bool(raw["verified"]),
        "order": raw["order"],
    }


def _build_file_row(raw: dict) -> dict:
    return {
        "id": raw["id"],
        "name": raw["name"],
        "path": raw["path"],
        "type": raw["type"],
        "parentId": raw["parent_id"],
        "size": raw.get("size"),
        "language": raw.get("language"),
        "lastCommit": raw["last_commit"] if isinstance(raw["last_commit"], dict) else json.loads(raw["last_commit"]),
        "content": raw.get("content"),
        "order": raw["order"],
    }


def _build_run_row(raw: dict) -> dict:
    resolved = _resolve_user(raw["actor_id"])
    return {
        "id": raw["id"],
        "workflowId": raw["workflow_id"],
        "workflowName": raw["workflow_name"],
        "runNumber": raw["run_number"],
        "status": raw["status"],
        "conclusion": raw.get("conclusion"),
        "branch": raw["branch"],
        "commit": {"sha": raw["commit_sha"], "message": raw["commit_message"]},
        "actor": raw["actor"],
        "actorId": raw["actor_id"],
        "actorAvatarUrl": resolved["avatarUrl"],
        "event": raw["event"],
        "duration": raw.get("duration"),
        "jobs": raw["jobs"] if isinstance(raw["jobs"], list) else json.loads(raw["jobs"]),
        "order": raw["order"],
    }


def _build_wiki_row(raw: dict) -> dict:
    resolved = _resolve_user(raw["last_edited_by_id"])
    return {
        "id": raw["id"],
        "title": raw["title"],
        "slug": raw["slug"],
        "content": raw["content"],
        "lastEditedBy": raw["last_edited_by"],
        "lastEditedById": raw["last_edited_by_id"],
        "lastEditedByAvatarUrl": resolved["avatarUrl"],
        "order": raw["order"],
    }


def _build_project_row(raw: dict) -> dict:
    return {
        "id": raw["id"],
        "name": raw["name"],
        "description": raw["description"],
        "state": raw["state"],
        "creator": raw["creator"],
        "creatorId": raw["creator_id"],
        "columns": raw["columns"] if isinstance(raw["columns"], list) else json.loads(raw["columns"]),
        "order": raw["order"],
    }


def _build_activity_row(raw: dict) -> dict:
    resolved = _resolve_user(raw["actor_id"])
    return {
        "id": raw["id"],
        "type": raw["type"],
        "actor": raw["actor"],
        "actorId": raw["actor_id"],
        "actorAvatarUrl": resolved["avatarUrl"],
        "repo": raw["repo"],
        "payload": raw["payload"] if isinstance(raw["payload"], dict) else json.loads(raw["payload"]),
        "order": raw["order"],
    }


def _build_release_row(raw: dict) -> dict:
    resolved = _resolve_user(raw["author_id"])
    return {
        "id": raw["id"],
        "tagName": raw["tag_name"],
        "name": raw["name"],
        "body": raw["body"],
        "author": raw["author"],
        "authorId": raw["author_id"],
        "authorAvatarUrl": resolved["avatarUrl"],
        "isLatest": bool(raw["is_latest"]),
        "isPrerelease": bool(raw["is_prerelease"]),
        "assets": raw["assets"] if isinstance(raw["assets"], list) else json.loads(raw["assets"]),
        "order": raw["order"],
    }


def _build_label_row(raw: dict) -> dict:
    return {
        "id": raw["id"],
        "name": raw["name"],
        "color": raw["color"],
        "description": raw["description"],
        "order": raw["order"],
    }


def _build_security_row(raw: dict) -> dict:
    return {
        "id": raw["id"],
        "severity": raw["severity"],
        "title": raw["title"],
        "description": raw["description"],
        "package": raw["package"],
        "vulnerableVersions": raw["vulnerable_versions"],
        "patchedVersions": raw["patched_versions"],
        "state": raw["state"],
        "cveId": raw.get("cve_id"),
        "order": raw["order"],
    }


def _build_code_scanning_row(raw: dict) -> dict:
    return {
        "id": raw["id"],
        "rule": raw["rule"],
        "severity": raw["severity"],
        "description": raw["description"],
        "file": raw["file_path"],
        "line": raw["line_number"],
        "state": raw["state"],
        "order": raw["order"],
    }


def _build_deployment_row(raw: dict) -> dict:
    return {
        "id": raw["id"],
        "environment": raw["environment"],
        "status": raw["status"],
        "url": raw["url"],
        "creator": raw["creator"],
        "order": raw["order"],
    }


def _build_package_row(raw: dict) -> dict:
    return {
        "id": raw["id"],
        "name": raw["name"],
        "type": raw["type"],
        "version": raw["version"],
        "downloads": raw["downloads"],
        "order": raw["order"],
    }


# ---------------------------------------------------------------------------
# Star waypoint interpolation
# ---------------------------------------------------------------------------
# Stars follow the same event-driven waypoint pattern as MicroHood prices:
# scenarios declare [[time, stars], ...] and the server linearly interpolates
# between adjacent waypoints on every read. This lets a scenario guarantee
# "repository reaches N stars at t=T" — the count climbs continuously toward
# N and crosses exactly at T — instead of stepping instantaneously.

def _interpolate_stars(waypoints: list[list[float]], sim_time: float) -> float:
    if sim_time <= waypoints[0][0]:
        return waypoints[0][1]
    if sim_time >= waypoints[-1][0]:
        return waypoints[-1][1]
    times = [w[0] for w in waypoints]
    idx = bisect.bisect_right(times, sim_time) - 1
    t0, v0 = waypoints[idx]
    t1, v1 = waypoints[idx + 1]
    return v0 + (v1 - v0) * (sim_time - t0) / (t1 - t0)


def _add_star_waypoint(session: Session, time: float, stars: float) -> None:
    waypoints = session.microhub_star_waypoints
    # Seed (0, initial_star_count) if this is the first explicit waypoint at t > 0,
    # so interpolation from the start is well-defined.
    if not waypoints and time > 0:
        waypoints.append([0.0, float(session.microhub_star_count)])
    entry = [float(time), float(stars)]
    idx = bisect.bisect_right([w[0] for w in waypoints], entry[0])
    waypoints.insert(idx, entry)


def _current_star_count(session: Session) -> int:
    if session.microhub_star_waypoints:
        base = _interpolate_stars(session.microhub_star_waypoints, session.simulation_time)
    else:
        base = session.microhub_star_count
    return max(0, int(round(base + session.microhub_star_offset)))


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def compute_current_metrics(session: Session) -> dict:
    return {
        "star_count": _current_star_count(session),
        "fork_count": session.microhub_fork_count,
        "watch_count": session.microhub_watch_count,
        "issue_count": len(session.microhub_issues),
        "pr_count": len(session.microhub_prs),
        "commit_count": len(session.microhub_commits),
        "comment_count": len(session.microhub_user_created_comments),
    }


# ---------------------------------------------------------------------------
# Event processing
# ---------------------------------------------------------------------------

def process_event(session: Session, event: dict) -> None:
    etype = event["type"]

    if etype == "preload_repo":
        payload = event.get("payload", {})

        # Load repository (always loads all)
        for rid, raw in MICROHUB_REPOSITORY_CATALOG.items():
            session.microhub_repository = raw
            break  # Only one repo

        repo = session.microhub_repository
        session.microhub_star_count = payload.get("initial_stars", repo.get("stars", 0))
        session.microhub_fork_count = payload.get("initial_forks", repo.get("forks", 0))
        session.microhub_watch_count = payload.get("initial_watchers", repo.get("watchers", 0))
        if "initial_commits" in payload:
            repo["commits"] = int(payload["initial_commits"])
        if "default_branch" in payload:
            branch = str(payload["default_branch"])
            repo["defaultBranch"] = branch
            branches = list(repo.get("branches") or [])
            if branch not in branches:
                branches.insert(0, branch)
                repo["branches"] = branches

        # Bulk star waypoints: scenarios pass [[time, stars], ...] to drive the
        # count continuously from the initial value to each target. Seed with
        # (0, initial_stars) first so interpolation is defined from t=0.
        star_waypoints = payload.get("star_waypoints")
        if star_waypoints:
            for t, v in star_waypoints:
                _add_star_waypoint(session, float(t), float(v))

        # Load files
        file_ids = payload.get("file_ids", ["*"])
        if file_ids == ["*"]:
            file_ids = list(MICROHUB_FILE_CATALOG.keys())
        for fid in file_ids:
            raw = MICROHUB_FILE_CATALOG.get(fid)
            if raw:
                session.microhub_files.append(_build_file_row(raw))

        # Load issues
        issue_ids = payload.get("issue_ids", ["*"])
        if issue_ids == ["*"]:
            issue_ids = list(MICROHUB_ISSUE_CATALOG.keys())
        for iid in issue_ids:
            raw = MICROHUB_ISSUE_CATALOG.get(iid)
            if raw:
                row = _build_issue_row(raw)
                session.microhub_issues.append(row)
                session.microhub_issue_states[iid] = {"state": row["state"]}

        # Load pull requests
        pr_ids = payload.get("pr_ids", ["*"])
        if pr_ids == ["*"]:
            pr_ids = list(MICROHUB_PR_CATALOG.keys())
        for pid in pr_ids:
            raw = MICROHUB_PR_CATALOG.get(pid)
            if raw:
                row = _build_pr_row(raw)
                session.microhub_prs.append(row)
                session.microhub_pr_states[pid] = {"state": row["state"]}

        # Load commits
        commit_ids = payload.get("commit_ids", ["*"])
        if commit_ids == ["*"]:
            commit_ids = list(MICROHUB_COMMIT_CATALOG.keys())
        for cid in commit_ids:
            raw = MICROHUB_COMMIT_CATALOG.get(cid)
            if raw:
                session.microhub_commits.append(_build_commit_row(raw))

        # Load workflow runs
        run_ids = payload.get("run_ids", ["*"])
        if run_ids == ["*"]:
            run_ids = list(MICROHUB_WORKFLOW_RUN_CATALOG.keys())
        for rid in run_ids:
            raw = MICROHUB_WORKFLOW_RUN_CATALOG.get(rid)
            if raw:
                session.microhub_runs.append(_build_run_row(raw))

        # Load workflows
        wf_ids = payload.get("workflow_ids", ["*"])
        if wf_ids == ["*"]:
            wf_ids = list(MICROHUB_WORKFLOW_CATALOG.keys())
        for wid in wf_ids:
            raw = MICROHUB_WORKFLOW_CATALOG.get(wid)
            if raw:
                session.microhub_workflows.append(dict(raw))

        # Load wiki pages
        wiki_ids = payload.get("wiki_ids", ["*"])
        if wiki_ids == ["*"]:
            wiki_ids = list(MICROHUB_WIKI_CATALOG.keys())
        for wid in wiki_ids:
            raw = MICROHUB_WIKI_CATALOG.get(wid)
            if raw:
                session.microhub_wiki.append(_build_wiki_row(raw))

        # Load projects
        proj_ids = payload.get("project_ids", ["*"])
        if proj_ids == ["*"]:
            proj_ids = list(MICROHUB_PROJECT_CATALOG.keys())
        for pid in proj_ids:
            raw = MICROHUB_PROJECT_CATALOG.get(pid)
            if raw:
                session.microhub_projects.append(_build_project_row(raw))

        # Load activity
        act_ids = payload.get("activity_ids", ["*"])
        if act_ids == ["*"]:
            act_ids = list(MICROHUB_ACTIVITY_CATALOG.keys())
        for aid in act_ids:
            raw = MICROHUB_ACTIVITY_CATALOG.get(aid)
            if raw:
                session.microhub_activity.append(_build_activity_row(raw))

        # Load insights
        insight_ids = payload.get("insight_ids", ["*"])
        if insight_ids == ["*"]:
            insight_ids = list(MICROHUB_INSIGHT_CATALOG.keys())
        for iid in insight_ids:
            raw = MICROHUB_INSIGHT_CATALOG.get(iid)
            if raw:
                session.microhub_insights.append(raw)

        # Load releases
        release_ids = payload.get("release_ids", ["*"])
        if release_ids == ["*"]:
            release_ids = list(MICROHUB_RELEASE_CATALOG.keys())
        for rid in release_ids:
            raw = MICROHUB_RELEASE_CATALOG.get(rid)
            if raw:
                session.microhub_releases.append(_build_release_row(raw))

        # Load labels
        label_ids = payload.get("label_ids", ["*"])
        if label_ids == ["*"]:
            label_ids = list(MICROHUB_LABEL_CATALOG.keys())
        for lid in label_ids:
            raw = MICROHUB_LABEL_CATALOG.get(lid)
            if raw:
                session.microhub_labels.append(_build_label_row(raw))

        # Load security advisories
        sec_ids = payload.get("security_ids", ["*"])
        if sec_ids == ["*"]:
            sec_ids = list(MICROHUB_SECURITY_CATALOG.keys())
        for sid in sec_ids:
            raw = MICROHUB_SECURITY_CATALOG.get(sid)
            if raw:
                session.microhub_security.append(_build_security_row(raw))

        # Load code scanning
        scan_ids = payload.get("scanning_ids", ["*"])
        if scan_ids == ["*"]:
            scan_ids = list(MICROHUB_CODE_SCANNING_CATALOG.keys())
        for sid in scan_ids:
            raw = MICROHUB_CODE_SCANNING_CATALOG.get(sid)
            if raw:
                session.microhub_code_scanning.append(_build_code_scanning_row(raw))

        # Load settings
        for sid, raw in MICROHUB_SETTINGS_CATALOG.items():
            session.microhub_settings = raw
            break  # Single row

        # Load deployments
        dep_ids = payload.get("deployment_ids", ["*"])
        if dep_ids == ["*"]:
            dep_ids = list(MICROHUB_DEPLOYMENT_CATALOG.keys())
        for did in dep_ids:
            raw = MICROHUB_DEPLOYMENT_CATALOG.get(did)
            if raw:
                session.microhub_deployments.append(_build_deployment_row(raw))

        # Load packages
        pkg_ids = payload.get("package_ids", ["*"])
        if pkg_ids == ["*"]:
            pkg_ids = list(MICROHUB_PACKAGE_CATALOG.keys())
        for pid in pkg_ids:
            raw = MICROHUB_PACKAGE_CATALOG.get(pid)
            if raw:
                session.microhub_packages.append(_build_package_row(raw))

        # Capture baseline after preload
        session.baseline_metrics = compute_current_metrics(session)

    elif etype == "new_issue":
        issue_id = event.get("payload", {}).get("issue_id")
        raw = MICROHUB_ISSUE_CATALOG.get(issue_id)
        if raw and issue_id not in session.microhub_issue_states:
            row = _build_issue_row(raw)
            # Issue arrives mid-session, so override its catalog ordering: bump its
            # number above all existing issues so it sorts to the top of the list,
            # and stamp createdAt so it displays "just now" and ages in real time.
            existing_numbers = [i.get("number", 0) for i in session.microhub_issues]
            existing_numbers += [i.get("number", 0) for i in session.microhub_user_created_issues]
            row["number"] = (max(existing_numbers) if existing_numbers else 0) + 1
            row["createdAt"] = int(time.time() * 1000)
            session.microhub_issues.append(row)
            session.microhub_issue_states[issue_id] = {"state": row["state"]}

    elif etype == "stars_waypoint":
        payload = event.get("payload", {})
        event_time = float(event.get("time", 0.0))
        if "stars" in payload:
            _add_star_waypoint(session, event_time, float(payload["stars"]))
        elif "delta" in payload:
            # Resolve the current interpolated value first, then add the delta as
            # a new waypoint so the curve continues from that point onward.
            if session.microhub_star_waypoints:
                current = _interpolate_stars(session.microhub_star_waypoints, event_time)
            else:
                current = float(session.microhub_star_count)
            _add_star_waypoint(session, event_time, max(0.0, current + float(payload["delta"])))



# ---------------------------------------------------------------------------
# Bulk actions
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Materialization for SQL-based evaluation
# ---------------------------------------------------------------------------

def materialize_to_sqlite(session: Session, conn: sqlite3.Connection) -> None:
    # Repository as key-value pairs
    conn.execute("CREATE TABLE repository (key TEXT, value TEXT)")
    for k, v in session.microhub_repository.items():
        conn.execute("INSERT INTO repository VALUES (?,?)", (k, json.dumps(v) if isinstance(v, (dict, list)) else str(v)))

    conn.execute("CREATE TABLE files (id TEXT, name TEXT, path TEXT, type TEXT, parentId TEXT)")
    conn.executemany(
        "INSERT INTO files VALUES (?,?,?,?,?)",
        [(f.get("id"), f.get("name"), f.get("path"), f.get("type"), f.get("parentId")) for f in session.microhub_files],
    )

    conn.execute("CREATE TABLE issues (id TEXT, number INT, title TEXT, body TEXT, state TEXT, author TEXT)")
    conn.executemany(
        "INSERT INTO issues VALUES (?,?,?,?,?,?)",
        [(i.get("id"), int(i.get("number", 0)), i.get("title"), i.get("body", ""), i.get("state"), i.get("author")) for i in session.microhub_issues],
    )

    conn.execute("CREATE TABLE issue_states (issue_id TEXT, state TEXT)")
    conn.executemany(
        "INSERT INTO issue_states VALUES (?,?)",
        [(iid, s.get("state", "open")) for iid, s in session.microhub_issue_states.items()],
    )

    conn.execute("CREATE TABLE prs (id TEXT, number INT, title TEXT, state TEXT, author TEXT)")
    conn.executemany(
        "INSERT INTO prs VALUES (?,?,?,?,?)",
        [(p.get("id"), int(p.get("number", 0)), p.get("title"), p.get("state"), p.get("author")) for p in session.microhub_prs],
    )

    conn.execute("CREATE TABLE pr_states (pr_id TEXT, state TEXT)")
    conn.executemany(
        "INSERT INTO pr_states VALUES (?,?)",
        [(pid, s.get("state", "open")) for pid, s in session.microhub_pr_states.items()],
    )

    conn.execute("CREATE TABLE commits (id TEXT, sha TEXT, message TEXT, author TEXT)")
    conn.executemany(
        "INSERT INTO commits VALUES (?,?,?,?)",
        [(c.get("id"), c.get("sha"), c.get("message"), c.get("author")) for c in session.microhub_commits],
    )

    conn.execute("CREATE TABLE user_created_comments (id TEXT, target_type TEXT, target_id TEXT, body TEXT)")
    conn.executemany(
        "INSERT INTO user_created_comments VALUES (?,?,?,?)",
        [
            (
                c.get("id"),
                c.get("target_type") or c.get("targetType"),
                c.get("target_id") or c.get("targetId"),
                c.get("body"),
            )
            for c in session.microhub_user_created_comments
        ],
    )

    conn.execute("CREATE TABLE user_created_issues (id TEXT, title TEXT, body TEXT)")
    conn.executemany(
        "INSERT INTO user_created_issues VALUES (?,?,?)",
        [(i.get("id"), i.get("title"), i.get("body")) for i in session.microhub_user_created_issues],
    )

    conn.execute("CREATE TABLE user_created_prs (id TEXT, title TEXT, body TEXT)")
    conn.executemany(
        "INSERT INTO user_created_prs VALUES (?,?,?)",
        [(p.get("id"), p.get("title"), p.get("body")) for p in session.microhub_user_created_prs],
    )

    conn.execute("CREATE TABLE merged_prs (pr_id TEXT)")
    conn.executemany(
        "INSERT INTO merged_prs VALUES (?)",
        [(pid,) for pid in session.microhub_merged_prs],
    )

    conn.execute("CREATE TABLE following_users (username TEXT)")
    conn.executemany(
        "INSERT INTO following_users VALUES (?)",
        [(u,) for u in session.microhub_following_users],
    )

    # Repo flags as key-value
    conn.execute("CREATE TABLE repo_flags (key TEXT, value TEXT)")
    for k, v in [
        ("starred", "1" if session.microhub_starred else "0"),
        ("watched", "1" if session.microhub_watched else "0"),
        ("forked", "1" if session.microhub_forked else "0"),
        ("star_count", str(_current_star_count(session))),
        ("fork_count", str(session.microhub_fork_count)),
        ("watch_count", str(session.microhub_watch_count)),
    ]:
        conn.execute("INSERT INTO repo_flags VALUES (?,?)", (k, v))

    # Additional list tables stored as JSON blobs
    for table_name, data_list in [
        ("runs", session.microhub_runs),
        ("workflows", session.microhub_workflows),
        ("wiki", session.microhub_wiki),
        ("projects", session.microhub_projects),
        ("activity", session.microhub_activity),
        ("releases", session.microhub_releases),
        ("labels", session.microhub_labels),
        ("security", session.microhub_security),
        ("code_scanning", session.microhub_code_scanning),
        ("deployments", session.microhub_deployments),
        ("packages", session.microhub_packages),
    ]:
        conn.execute(f"CREATE TABLE [{table_name}] (id TEXT, data TEXT)")
        conn.executemany(
            f"INSERT INTO [{table_name}] VALUES (?,?)",
            [(item.get("id"), json.dumps(item)) for item in data_list],
        )
