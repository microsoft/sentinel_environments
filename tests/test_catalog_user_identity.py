"""Static audit for canonical user references in catalogs.

This guard is intentionally narrow: every env-specific catalog reference to a
user must resolve to data/catalogs/users.json.

It does not try to infer whether arbitrary display fields like "name" or
"author" should match a user field; those checks are app-specific and become
high-maintenance quickly.
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_DIR = ROOT / "data" / "catalogs"
USERS = {user["id"]: user for user in json.loads((CATALOG_DIR / "users.json").read_text())}


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


def test_all_catalog_user_ids_resolve_to_users_catalog():
    errors = []

    for path, lineno, row in _catalog_rows():
        for key_path, user_id in _walk_user_refs(row):
            if user_id not in USERS:
                errors.append(
                    f"{path}:{lineno} row={row.get('id')} field={key_path} unknown_user_id={user_id!r}"
                )

    assert not errors, "\n".join(errors)
