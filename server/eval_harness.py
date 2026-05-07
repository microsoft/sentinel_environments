# eval harness cli for running all sentinel environments tasks and collecting results.
#
# flow: enumerate all scenario json files -> create result folders -> call run_task() for each
# example: python -m server.eval_harness my_run --config eval_config.yaml
import argparse
import csv
import json
import os
import shlex
import signal
import subprocess
import sys
import threading
import time
import traceback
from pathlib import Path
from urllib.parse import urlencode, urlparse, urlunparse

import requests
import yaml

from server.server import STATE_COMPLETED, STATE_RUNNING_AUTO
from server.timing import kill_at_wall, validate_speed_factor

DEFAULT_API_URL = "http://localhost:8000"


def _raise_for_status_with_body(resp):
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        body = (resp.text or "").strip()[:2000]
        raise requests.HTTPError(f"{e}\n\nResponse body:\n{body}", response=resp) from e


def _poll_until(api_url, target_states, valid_states=None):
    while True:
        resp = requests.get(f"{api_url}/status")
        _raise_for_status_with_body(resp)
        data = resp.json()
        if data["status"] in target_states:
            return data
        if valid_states and data["status"] not in valid_states:
            raise RuntimeError(f"Unexpected state: {data['status']}")
        time.sleep(1)


def _startup(api_url):
    # Always close any existing session first so we start clean,
    # regardless of what state the server is in (completed, ready, running, etc.)
    resp = requests.get(f"{api_url}/status")
    _raise_for_status_with_body(resp)
    if resp.json()["status"] != "preinit":
        requests.get(f"{api_url}/close")
        time.sleep(1)
    return _poll_until(api_url, target_states=["preinit"], valid_states=["stopping"])


def load_config(config_path):
    with open(config_path) as f:
        return yaml.safe_load(f) or {}


def discover_tasks(name_filter=None):
    """Yield (environment, scenario_id, path) for every scenario JSON file.

    If name_filter is a lowercased substring, only scenarios whose id contains
    it are yielded; None means all.
    """
    scenarios_root = Path(__file__).resolve().parent.parent / "scenarios"
    for path in sorted(scenarios_root.glob("*/*.json")):
        if path.name == "dev.json":
            continue
        with open(path) as f:
            scenario = json.load(f)
        if not scenario.get("prompt"):
            print(f"Skipping {path}: empty or missing prompt", file=sys.stderr, flush=True)
            continue
        if name_filter is not None and name_filter not in scenario["id"].lower():
            continue
        yield scenario["environment"], scenario["id"], path


def _build_server_url(api_url, path, frontend_url=None, query=None):
    # The agent must connect to the same hostname it uses for the frontend,
    # but hit the API server's endpoint on the API port.
    if not frontend_url:
        base = f"{api_url}{path}"
        if query:
            return f"{base}?{urlencode(query)}"
        return base
    api_parts = urlparse(api_url)
    frontend_parts = urlparse(frontend_url)
    netloc = (
        f"{frontend_parts.hostname}:{api_parts.port}"
        if api_parts.port
        else (frontend_parts.hostname or api_parts.netloc)
    )
    return urlunparse(
        (
            frontend_parts.scheme or api_parts.scheme,
            netloc,
            path,
            "",
            urlencode(query) if query else "",
            "",
        )
    )


def _build_task_url(api_url, frontend_url=None):
    query = {"frontend_url": frontend_url} if frontend_url else None
    return _build_server_url(api_url, "/redirect", frontend_url, query=query)


def _build_contact_url(api_url, frontend_url=None):
    return _build_server_url(api_url, "/contact", frontend_url)


def run_task(config, task_json_file, task_result_folder):
    api_url = config.get("api_url", DEFAULT_API_URL)
    frontend_url = config.get("frontend_url")
    speed_factor = validate_speed_factor(float(config.get("speed_factor", 1.0)))

    with open(task_json_file) as f:
        scenario = json.load(f)

    # 1. Close any existing session and wait for preinit
    _startup(api_url)

    # 2. Init the scenario
    init_payload = {
        "environment": scenario["environment"],
        "event_timeline_end": scenario["event_timeline_end"],
        "eval_sql": scenario.get("eval_sql", ""),
        "condition_at": scenario.get("condition_at"),
        "speed_factor": speed_factor,
        "events": scenario["events"],
        "start_page": scenario.get("start_page"),
    }
    resp = requests.post(f"{api_url}/init", json=init_payload)
    _raise_for_status_with_body(resp)
    data = resp.json()
    assert data["status"] == "ready", f"Expected ready, got {data}"

    # 3. Build agent subprocess command, substituting __TASK_URL__ and __TASK_PROMPT__.
    task_url = _build_task_url(api_url, frontend_url)
    contact_url = _build_contact_url(api_url, frontend_url)
    task_prompt = scenario.get("prompt", "")
    task_prompt = (
        f"{task_prompt}\n\n"
        f"Once the necessary conditions are met and/or actions are taken, you can reach "
        f"me by submitting the form at {contact_url}. Visit and submit this form *ONLY ONCE, "
        f"AT THE END OF THE TASK*. If you visit this page too early, you will not be able to "
        f"return, and the task will fail."
    )
    agent_cmd = config["agent_subprocess"]
    base_dir = str(Path(__file__).resolve().parent.parent)

    if isinstance(agent_cmd, list):
        agent_cmd = [
            arg.replace("__TASK_URL__", task_url)
            .replace("__TASK_PROMPT__", task_prompt)
            .replace("__BASE_DIR__", base_dir)
            for arg in agent_cmd
        ]
        shell = False
    else:
        agent_cmd = agent_cmd.replace("__TASK_URL__", shlex.quote(task_url))
        agent_cmd = agent_cmd.replace("__TASK_PROMPT__", shlex.quote(task_prompt))
        agent_cmd = agent_cmd.replace("__BASE_DIR__", shlex.quote(base_dir))
        shell = True

    def _tee(src, file):
        for line in src:
            sys.stdout.write(line)
            sys.stdout.flush()
            file.write(line)
            file.flush()

    task_result_folder_abs = Path(task_result_folder).resolve()
    output_file = task_result_folder_abs / "output.txt"
    print(f"Prompt:\n{task_prompt}\n", flush=True)
    prev_cwd = os.getcwd()
    try:
        os.chdir(task_result_folder_abs)
        with open(output_file, "w") as out:
            with subprocess.Popen(
                agent_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                shell=shell,
                text=True,
                start_new_session=True,
            ) as proc:
                t = threading.Thread(target=_tee, args=(proc.stdout, out))
                t.start()
                try:
                    proc.wait(kill_at_wall(speed_factor))
                except subprocess.TimeoutExpired:
                    resp = requests.get(f"{api_url}/status", timeout=5)
                    resp.raise_for_status()

                    # Throw errors if keys are missing, to help debugging if the server is not responding as expected.
                    status_json = resp.json()
                    server_state = status_json["status"]
                    sim_time = status_json["simulation_time"]

                    # Use proc.wait(timeout=...) rather than time.sleep() so the
                    # agent can exit early if it finishes during the grace window.
                    if server_state == STATE_COMPLETED:
                        print(
                            "Agent subprocess timed out but server is in 'completed' state; "
                            "granting 90s grace before kill...",
                            flush=True,
                        )
                        try:
                            proc.wait(timeout=90)
                        except subprocess.TimeoutExpired:
                            pass
                    elif server_state == STATE_RUNNING_AUTO and sim_time is not None:
                        slop = kill_at_wall(speed_factor) - float(sim_time)
                        if slop > 0:
                            print(
                                f"Agent subprocess timed out but simulation_time={sim_time:.2f} "
                                f"is short of kill_at_wall by {slop:.2f}s (startup overhead); "
                                f"waiting for the sim clock to catch up...",
                                flush=True,
                            )
                            try:
                                proc.wait(timeout=slop)
                            except subprocess.TimeoutExpired:
                                pass

                    print("Agent subprocess timed out, killing process group...", flush=True)
                    try:
                        os.killpg(proc.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        print(
                            "Process group already exited before kill; nothing to signal.",
                            flush=True,
                        )
                    proc.wait()
                finally:
                    t.join()
    finally:
        os.chdir(prev_cwd)

    # 4. Evaluate and write results as JSON
    resp = requests.post(f"{api_url}/evaluate")
    _raise_for_status_with_body(resp)
    result = resp.json()

    (task_result_folder / "results.json").write_text(json.dumps(result, indent=2))


def cmd_run(args):
    config = load_config(args.config)
    if args.api_url != DEFAULT_API_URL:
        config["api_url"] = args.api_url
    if args.frontend_url:
        config["frontend_url"] = args.frontend_url
    results_root = Path("results") / args.run_name

    name_filter = args.filter.lower() if args.filter else None
    tasks = list(discover_tasks(name_filter=name_filter))
    if name_filter is not None:
        print(f"Filtering to tasks containing: {args.filter!r}", flush=True)
    print(f"Found {len(tasks)} tasks. Results -> {results_root}", flush=True)

    for environment, scenario_id, task_path in tasks:
        task_result_folder = results_root / environment / scenario_id
        task_result_folder.mkdir(parents=True, exist_ok=True)
        if (task_result_folder / "results.json").exists():
            print(f"  Skipping {scenario_id} (already done)", flush=True)
            continue
        if (task_result_folder / "error.txt").exists():
            print(f"  Skipping {scenario_id} (previous error)", flush=True)
            continue
        print(f"  Running {scenario_id} ...", flush=True)
        try:
            run_task(config, task_path, task_result_folder)
        except Exception as e:
            (task_result_folder / "error.txt").write_text(traceback.format_exc())
            print(f"  ERROR: {e}", flush=True)

    print("Done.", flush=True)


def cmd_grade(args):
    results_root = Path("results") / args.run_name
    if not results_root.is_dir():
        raise SystemExit(f"Results directory not found: {results_root}")

    name_filter = args.filter.lower() if args.filter else None

    rows = []
    for results_file in sorted(results_root.glob("*/*/results.json")):
        name = results_file.parent.name
        if name_filter is not None and name_filter not in name.lower():
            continue
        with open(results_file) as f:
            data = json.load(f)
        success = bool(data.get("success"))
        evaluation_time = data.get("evaluation_time")
        stop_time = data.get("contact_get_time")
        condition_at = data.get("condition_at")

        if success and stop_time is not None and condition_at is not None:
            reaction_time = stop_time - condition_at
            if reaction_time < 0:
                raise RuntimeError(
                    f"Task {name} reports success but reaction_time is negative "
                    f"(stop_time={stop_time}, condition_at={condition_at}). "
                    f"This indicates a serious problem."
                )
        else:
            reaction_time = None

        costs_file = results_file.parent / "costs.json"
        prompt_tokens = completion_tokens = tool_calls = None
        if costs_file.is_file():
            with open(costs_file) as f:
                costs = json.load(f)
            prompt_tokens = costs.get("prompt_tokens")
            completion_tokens = costs.get("completion_tokens")
            tool_calls = costs.get("tool_calls")

        rows.append({
            "name": name,
            "evaluation_time": evaluation_time,
            "success": success,
            "stop_time": stop_time,
            "condition_at": condition_at,
            "reaction_time": reaction_time,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "tool_calls": tool_calls,
        })

    if name_filter is not None and not rows:
        raise SystemExit(f"No tasks in {results_root} matched --filter {args.filter!r}.")

    def fmt(v):
        return "" if v is None else str(v)

    headers = [
        "name", "evaluation_time", "success", "stop_time", "condition_at",
        "reaction_time", "prompt_tokens", "completion_tokens", "tool_calls",
    ]

    total = len(rows)
    successes = [r for r in rows if r["success"]]
    success_rate = (len(successes) / total) if total else 0.0
    reaction_times = [r["reaction_time"] for r in successes if r["reaction_time"] is not None]
    avg_reaction = (sum(reaction_times) / len(reaction_times)) if reaction_times else None

    def avg(field):
        vals = [r[field] for r in rows if r[field] is not None]
        return (sum(vals) / len(vals)) if vals else None

    avg_prompt = avg("prompt_tokens")
    avg_completion = avg("completion_tokens")
    avg_tool_calls = avg("tool_calls")

    if args.csv:
        writer = csv.writer(sys.stdout)
        writer.writerow(headers)
        for r in rows:
            writer.writerow([fmt(r[h]) for h in headers])
        sys.stdout.write("\n")
        summary = [
            ("Total Tasks", total),
            ("Successes", len(successes)),
            ("Task Success Rate", f"{success_rate:.4f}"),
            ("Average Reaction Time", "" if avg_reaction is None else f"{avg_reaction:.1f}"),
            ("Average Prompt Tokens", "" if avg_prompt is None else f"{avg_prompt:.1f}"),
            ("Average Completion Tokens", "" if avg_completion is None else f"{avg_completion:.1f}"),
            ("Average Tool Calls", "" if avg_tool_calls is None else f"{avg_tool_calls:.1f}"),
        ]
        for key, value in summary:
            writer.writerow([key, value])
        return

    widths = {h: len(h) for h in headers}
    for r in rows:
        for h in headers:
            widths[h] = max(widths[h], len(fmt(r[h])))

    def print_row(vals):
        print(" | ".join(fmt(v).ljust(widths[h]) for h, v in zip(headers, vals)))

    print_row(headers)
    print("-+-".join("-" * widths[h] for h in headers))
    for r in rows:
        print_row([r[h] for h in headers])

    print()
    print(f"Total Tasks: {total}")
    print(f"Task Success Rate: {success_rate:.1%} ({len(successes)}/{total})")
    if avg_reaction is None:
        print("Average Reaction Time: N/A")
    else:
        print(f"Average Reaction Time: {avg_reaction:.1f}s")
    print(f"Average Prompt Tokens: {'N/A' if avg_prompt is None else f'{avg_prompt:.1f}'}")
    print(f"Average Completion Tokens: {'N/A' if avg_completion is None else f'{avg_completion:.1f}'}")
    print(f"Average Tool Calls: {'N/A' if avg_tool_calls is None else f'{avg_tool_calls:.1f}'}")


def main():
    parser = argparse.ArgumentParser(description="Sentinel Environments eval harness.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="Run all scenarios and collect results")
    p_run.add_argument("run_name", help="Name of this evaluation run")
    p_run.add_argument("--config", default="eval_config.yaml", help="Path to eval config YAML")
    p_run.add_argument("--api-url", default=DEFAULT_API_URL, help="Sentinel API base URL")
    p_run.add_argument("--frontend-url", help="Frontend base URL passed to /redirect")
    p_run.add_argument(
        "--filter",
        default=None,
        help="Optional case-insensitive substring; only scenarios whose id contains it are run.",
    )
    p_run.set_defaults(func=cmd_run)

    p_grade = sub.add_parser("grade", help="Summarize results from a previous run")
    p_grade.add_argument("run_name", help="Name of the evaluation run to grade")
    p_grade.add_argument(
        "--filter",
        default=None,
        help="Optional case-insensitive substring; only tasks whose name contains it are graded.",
    )
    p_grade.add_argument(
        "--csv",
        action="store_true",
        help="Render output as CSV (rows, blank line, then key,value summary) instead of the default table.",
    )
    p_grade.set_defaults(func=cmd_grade)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
