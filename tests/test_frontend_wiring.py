#!/usr/bin/env python3
"""Static analysis checks for frontend wiring.

Catches bugs like environment components reading bundled data instead of
the API — something backend-only tests (test_eval_sql.py) cannot detect.
Pure file-based checks; no running server needed.

Usage:
    cd SentinelBench
    .venv/bin/python tests/test_frontend_wiring.py
"""
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

FRONTEND_SRC = Path("sentinelbench/src")
ENV_DIR = FRONTEND_SRC / "environments"
HOOKS_DIR = FRONTEND_SRC / "hooks"

# No allowlist — every environment should be fully migrated to API data.
SYNTH_DATA_ALLOWLIST: set[str] = set()

# The only localStorage key allowed in environment components.
ALLOWED_LOCALSTORAGE = "adminConsoleEnabled"

# Legacy utilities that should no longer be imported anywhere in src/.
LEGACY_UTILITIES = [
    "TaskStateManager",
    "URLParameterHandler",
    "StorageErrorToast",
    "URLValidationToast",
]

# Colors
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
RESET = "\033[0m"

# Mapping from environment filename to hook function name.
# Most follow MicroFoo.tsx -> useMicrofooData, but MicroLendar keeps its
# capital L: useMicroLendarData.
HOOK_OVERRIDES = {
    "MicroLendar.tsx": "useMicroLendarData",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hook_name_for(env_filename: str) -> str:
    """Derive the expected hook function name from environment filename.

    MicroMail.tsx  -> useMicromailData
    MicroScholar.tsx -> useMicroscholarData
    MicroLendar.tsx -> useMicroLendarData (override)
    """
    if env_filename in HOOK_OVERRIDES:
        return HOOK_OVERRIDES[env_filename]
    stem = env_filename.removesuffix(".tsx")  # e.g. "MicroScholar"
    # "use" + first char uppercase + rest lowercased + "Data"
    lower = stem[0].upper() + stem[1:].lower()
    return f"use{lower}Data"


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------

def check_no_synthetic_data(env_files: list[Path]) -> tuple[list, list, list]:
    """Check 1: No syntheticData / ../data imports in environment components."""
    passes = []
    warns = []
    fails = []
    # Match import statements only — skip comments and string literals.
    import_from_data = re.compile(r'''^\s*import\s.*from\s+['"]\.\.\/data['"]''', re.MULTILINE)
    import_synthetic = re.compile(r'''^\s*import\s.*syntheticData''', re.MULTILINE)

    for f in env_files:
        name = f.name
        content = f.read_text()
        if import_from_data.search(content) or import_synthetic.search(content):
            if name in SYNTH_DATA_ALLOWLIST:
                warns.append(f"{name} imports ../data (allowlisted)")
            else:
                fails.append(f"{name} imports syntheticData or ../data")
        else:
            passes.append(f"No syntheticData in {name}")

    return passes, warns, fails


def check_no_legacy_utilities() -> tuple[list, list, list]:
    """Check 2: No legacy utility imports anywhere in src/."""
    passes = []
    fails = []

    for util in LEGACY_UTILITIES:
        found = []
        for ts_file in FRONTEND_SRC.rglob("*.ts"):
            if util in ts_file.read_text():
                found.append(str(ts_file))
        for tsx_file in FRONTEND_SRC.rglob("*.tsx"):
            if util in tsx_file.read_text():
                found.append(str(tsx_file))
        if found:
            fails.append(f"{util} found in: {', '.join(found)}")
        else:
            passes.append(f"No {util} in src/")

    return passes, [], fails


def check_hooks_fetch_config(hook_files: list[Path]) -> tuple[list, list, list]:
    """Check 3: Every hook fetches /api/data/config."""
    passes = []
    fails = []

    for f in hook_files:
        content = f.read_text()
        if "/api/data/config" in content:
            passes.append(f"{f.name} fetches /api/data/config")
        else:
            fails.append(f"{f.name} does NOT fetch /api/data/config")

    return passes, [], fails


def check_component_imports_hook(env_files: list[Path]) -> tuple[list, list, list]:
    """Check 4: Every environment component imports its hook."""
    passes = []
    fails = []

    for f in env_files:
        expected_hook = hook_name_for(f.name)
        content = f.read_text()
        if expected_hook in content:
            passes.append(f"{f.name} imports {expected_hook}")
        else:
            fails.append(f"{f.name} does NOT import {expected_hook}")

    return passes, [], fails


def check_no_direct_localstorage(env_files: list[Path]) -> tuple[list, list, list]:
    """Check 5: No direct localStorage in environment components (except adminConsoleEnabled)."""
    passes = []
    fails = []
    pattern = re.compile(r'localStorage\.\w+\(["\']([^"\']*)["\']')

    for f in env_files:
        name = f.name
        content = f.read_text()
        bad_uses = []
        for m in pattern.finditer(content):
            key = m.group(1)
            if key != ALLOWED_LOCALSTORAGE:
                bad_uses.append(key)
        if bad_uses:
            fails.append(f"{name} uses localStorage keys: {', '.join(bad_uses)}")
        else:
            passes.append(f"No disallowed localStorage in {name}")

    return passes, [], fails


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Verify we're in the right directory
    if not FRONTEND_SRC.is_dir():
        print(f"ERROR: {FRONTEND_SRC} not found. Run from SentinelBench/ directory.")
        sys.exit(1)

    env_files = sorted(ENV_DIR.glob("Micro*.tsx"))
    hook_files = sorted(HOOKS_DIR.glob("use*Data.ts"))

    if not env_files:
        print("ERROR: No environment files found.")
        sys.exit(1)
    if not hook_files:
        print("ERROR: No hook files found.")
        sys.exit(1)

    print("=" * 60)
    print("FRONTEND WIRING CHECKS")
    print("=" * 60)

    all_passes = []
    all_warns = []
    all_fails = []

    checks = [
        ("syntheticData / ../data imports", check_no_synthetic_data, [env_files]),
        ("legacy utility imports", check_no_legacy_utilities, []),
        ("hooks fetch /api/data/config", check_hooks_fetch_config, [hook_files]),
        ("component imports hook", check_component_imports_hook, [env_files]),
        ("direct localStorage usage", check_no_direct_localstorage, [env_files]),
    ]

    for label, fn, args in checks:
        passes, warns, fails = fn(*args)
        for p in passes:
            print(f"  [{GREEN}PASS{RESET}] {p}")
        for w in warns:
            print(f"  [{YELLOW}WARN{RESET}] {w}")
        for f in fails:
            print(f"  [{RED}FAIL{RESET}] {f}")
        all_passes.extend(passes)
        all_warns.extend(warns)
        all_fails.extend(fails)

    total = len(all_passes) + len(all_fails)
    passed = len(all_passes)

    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print("=" * 60)
    print(f"  Passed: {passed}/{total} checks")
    if all_warns:
        print(f"  Warnings: {len(all_warns)} (allowlisted exceptions)")
    if all_fails:
        print("  FAILURES:")
        for f in all_fails:
            print(f"    {f}")
    else:
        print("  ALL CHECKS PASSED")
    print("=" * 60)

    sys.exit(1 if all_fails else 0)


if __name__ == "__main__":
    main()
