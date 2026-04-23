"""Static audit for catalog user identity consistency.

Guards against two classes of catalog bugs:
1. env-specific user references that do not resolve to data/catalogs/users.json
2. copied user display fields that drift from the canonical user catalog

Deliberately out of scope:
- group/team names that are not meant to identify a single user
- fields that carry only a username with no companion userId to resolve
"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_DIR = ROOT / "data" / "catalogs"
USERS = {user["id"]: user for user in json.loads((CATALOG_DIR / "users.json").read_text())}
SELF_USER_IDS = {uid for uid, user in USERS.items() if user.get("isSelf")}


def _read_jsonl(path: Path) -> list[tuple[int, dict]]:
    rows = []
    for lineno, line in enumerate(path.read_text().splitlines(), start=1):
        if line.strip():
            rows.append((lineno, json.loads(line)))
    return rows


def _looks_like_user_ref_key(key: str) -> bool:
    lowered = key.lower()
    if lowered == "id":
        return False
    return (
        lowered.endswith("id")
        or lowered.endswith("_id")
        or lowered.endswith("ids")
        or lowered.endswith("_ids")
        or lowered == "attendees"
    )


def _walk_user_refs(value: object, key_path: str = ""):
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{key_path}.{key}" if key_path else key
            if _looks_like_user_ref_key(key):
                values = child if isinstance(child, list) else [child]
                for index, item in enumerate(values):
                    if isinstance(item, str) and item.startswith("user"):
                        item_path = child_path
                        if isinstance(child, list):
                            item_path = f"{child_path}[{index}]"
                        yield item_path, item
            if isinstance(child, (dict, list)):
                yield from _walk_user_refs(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            child_path = f"{key_path}[{index}]" if key_path else f"[{index}]"
            if isinstance(child, (dict, list)):
                yield from _walk_user_refs(child, child_path)


def _catalog_rows():
    for path in sorted(CATALOG_DIR.rglob("*")):
        if path.name in {"users.json", "entities.json"}:
            continue
        if path.suffix == ".jsonl":
            for lineno, row in _read_jsonl(path):
                yield path.relative_to(ROOT), lineno, row
        elif path.suffix == ".json":
            data = json.loads(path.read_text())
            if isinstance(data, dict):
                yield path.relative_to(ROOT), 1, data
            elif isinstance(data, list):
                for lineno, row in enumerate(data, start=1):
                    if isinstance(row, dict):
                        yield path.relative_to(ROOT), lineno, row


def _error(path: Path, lineno: int, row_id: str | None, field: str, actual: object, expected: object) -> str:
    location = f"{path}:{lineno}"
    if row_id:
        location += f" row={row_id}"
    return f"{location} field={field} actual={actual!r} expected={expected!r}"


def _direct_counterparty_id(row: dict) -> str | None:
    for uid in row.get("participantIds", []):
        if uid not in SELF_USER_IDS:
            return uid
    return None


def _first_name_slug(full_name: str) -> str:
    first_name = full_name.split()[0].lower()
    return re.sub(r"[^a-z0-9]+", "-", first_name).strip("-")


def test_all_catalog_user_ids_resolve_to_users_catalog():
    errors = []

    for path, lineno, row in _catalog_rows():
        for key_path, user_id in _walk_user_refs(row):
            if user_id not in USERS:
                errors.append(
                    f"{path}:{lineno} row={row.get('id')} field={key_path} unknown_user_id={user_id!r}"
                )

    assert not errors, "\n".join(errors)


def test_microchat_user_identity_fields_match_users_catalog():
    errors = []

    calls_path = CATALOG_DIR / "microchat" / "calls.jsonl"
    for lineno, row in _read_jsonl(calls_path):
        user_id = row.get("userId")
        if user_id in USERS:
            expected = USERS[user_id]["name"]
            if row.get("name") != expected:
                errors.append(
                    _error(calls_path.relative_to(ROOT), lineno, row.get("id"), "name", row.get("name"), expected)
                )

    conversations_path = CATALOG_DIR / "microchat" / "conversations.jsonl"
    for lineno, row in _read_jsonl(conversations_path):
        if row.get("type") != "direct":
            continue
        user_id = _direct_counterparty_id(row)
        if user_id in USERS:
            expected_name = USERS[user_id]["name"]
            if row.get("name") != expected_name:
                errors.append(
                    _error(
                        conversations_path.relative_to(ROOT),
                        lineno,
                        row.get("id"),
                        "name",
                        row.get("name"),
                        expected_name,
                    )
                )

            expected_id = f"direct-{_first_name_slug(expected_name)}"
            if row.get("id") != expected_id:
                errors.append(
                    _error(
                        conversations_path.relative_to(ROOT),
                        lineno,
                        row.get("id"),
                        "id",
                        row.get("id"),
                        expected_id,
                    )
                )

    assert not errors, "\n".join(errors)


def test_microfy_playlist_owner_names_match_users_catalog():
    errors = []
    path = CATALOG_DIR / "microfy" / "playlists.jsonl"

    for lineno, row in _read_jsonl(path):
        user_id = row.get("ownerId")
        if user_id in USERS:
            expected = USERS[user_id]["name"]
            if row.get("ownerName") != expected:
                errors.append(
                    _error(path.relative_to(ROOT), lineno, row.get("id"), "ownerName", row.get("ownerName"), expected)
                )

    assert not errors, "\n".join(errors)


def test_microhub_user_identity_fields_match_users_catalog():
    errors = []

    username_rules = [
        ("issues.jsonl", "author", "authorId"),
        ("prs.jsonl", "author", "authorId"),
        ("commits.jsonl", "author", "authorId"),
        ("releases.jsonl", "author", "authorId"),
        ("activity.jsonl", "actor", "actorId"),
        ("projects.jsonl", "creator", "creatorId"),
        ("workflow-runs.jsonl", "actor", "actorId"),
        ("wiki.jsonl", "lastEditedBy", "lastEditedById"),
    ]

    base = CATALOG_DIR / "microhub"

    for filename, field, user_id_field in username_rules:
        path = base / filename
        for lineno, row in _read_jsonl(path):
            user_id = row.get(user_id_field)
            if user_id in USERS:
                expected = USERS[user_id]["username"]
                if row.get(field) != expected:
                    errors.append(
                        _error(path.relative_to(ROOT), lineno, row.get("id"), field, row.get(field), expected)
                    )

            if filename in {"issues.jsonl", "prs.jsonl"}:
                for comment in row.get("comments", []):
                    comment_user_id = comment.get("authorId")
                    if comment_user_id in USERS:
                        expected = USERS[comment_user_id]["username"]
                        if comment.get("author") != expected:
                            errors.append(
                                _error(
                                    path.relative_to(ROOT),
                                    lineno,
                                    comment.get("id"),
                                    "comments.author",
                                    comment.get("author"),
                                    expected,
                                )
                            )

    settings_path = base / "settings.jsonl"
    for lineno, row in _read_jsonl(settings_path):
        for index, collaborator in enumerate(row.get("collaborators", []), start=1):
            user_id = collaborator.get("userId")
            if user_id in USERS:
                expected = USERS[user_id]["username"]
                if collaborator.get("username") != expected:
                    errors.append(
                        _error(
                            settings_path.relative_to(ROOT),
                            lineno,
                            f"collaborators[{index}]",
                            "username",
                            collaborator.get("username"),
                            expected,
                        )
                    )

    insights_path = base / "insights.jsonl"
    for lineno, row in _read_jsonl(insights_path):
        if row.get("type") != "contributors":
            continue
        for index, contributor in enumerate(row.get("data", []), start=1):
            user_id = contributor.get("userId")
            if user_id in USERS:
                expected = USERS[user_id]["username"]
                if contributor.get("username") != expected:
                    errors.append(
                        _error(
                            insights_path.relative_to(ROOT),
                            lineno,
                            f"data[{index}]",
                            "username",
                            contributor.get("username"),
                            expected,
                        )
                    )

    assert not errors, "\n".join(errors)
