# eval harness cli for running all sentinelbench tasks and collecting results.
#
# flow: enumerate all scenario json files -> create result folders -> call run_task() for each
# example: python -m sentinel_api.eval_harness my_run --config eval_config.yaml
import argparse
import json
import shlex
import subprocess
import sys
import threading
import time
import traceback
from pathlib import Path

import requests
import yaml

DEFAULT_HOST = "http://localhost:8000"


def _raise_for_status_with_body(resp):
    try:
        resp.raise_for_status()
    except requests.HTTPError as e:
        body = (resp.text or "").strip()[:2000]
        raise requests.HTTPError(f"{e}\n\nResponse body:\n{body}", response=resp) from e


def _poll_until(host, target_states, valid_states=None):
    while True:
        resp = requests.get(f"{host}/status")
        _raise_for_status_with_body(resp)
        data = resp.json()
        if data["status"] in target_states:
            return data
        if valid_states and data["status"] not in valid_states:
            raise RuntimeError(f"Unexpected state: {data['status']}")
        time.sleep(1)


def _startup(host):
    # Always close any existing session first so we start clean,
    # regardless of what state the server is in (completed, ready, running, etc.)
    resp = requests.get(f"{host}/status")
    _raise_for_status_with_body(resp)
    if resp.json()["status"] != "preinit":
        requests.get(f"{host}/close")
        time.sleep(1)
    return _poll_until(host, target_states=["preinit"], valid_states=["stopping"])


def load_config(config_path):
    with open(config_path) as f:
        return yaml.safe_load(f) or {}


def discover_tasks():
    """Yield (environment, scenario_id, path) for every scenario JSON file."""
    sentinel_api_dir = Path(__file__).parent
    for path in sorted(sentinel_api_dir.glob("*/scenarios/*.json")):
        with open(path) as f:
            scenario = json.load(f)
        yield scenario["environment"], scenario["id"], path


def run_task(config, task_json_file, task_result_folder):
    host = config.get("host", DEFAULT_HOST)

    with open(task_json_file) as f:
        scenario = json.load(f)

    # 1. Close any existing session and wait for preinit
    _startup(host)

    # 2. Init the scenario
    init_payload = {
        "environment": scenario["environment"],
        "duration": scenario["duration"],
        "eval_sql": scenario.get("eval_sql", ""),
        "events": scenario["events"],
    }
    resp = requests.post(f"{host}/init", json=init_payload)
    _raise_for_status_with_body(resp)
    data = resp.json()
    assert data["status"] == "ready", f"Expected ready, got {data}"

    # 3. Build agent subprocess command, substituting __TASK_URL__ and __TASK_PROMPT__.
    task_url = f"{host}/redirect"
    task_prompt = scenario.get("prompt", "")
    agent_cmd = config["agent_subprocess"]

    if isinstance(agent_cmd, list):
        agent_cmd = [
            arg.replace("__TASK_URL__", task_url).replace("__TASK_PROMPT__", task_prompt)
            for arg in agent_cmd
        ]
        shell = False
    else:
        agent_cmd = agent_cmd.replace("__TASK_URL__", shlex.quote(task_url))
        agent_cmd = agent_cmd.replace("__TASK_PROMPT__", shlex.quote(task_prompt))
        shell = True

    def _tee(src, file):
        for line in src:
            sys.stdout.write(line)
            sys.stdout.flush()
            file.write(line)
            file.flush()

    output_file = task_result_folder / "output.txt"
    with open(output_file, "w") as out:
        with subprocess.Popen(
            agent_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            shell=shell,
            text=True,
        ) as proc:
            t = threading.Thread(target=_tee, args=(proc.stdout, out))
            t.start()
            try:
                proc.wait(timeout=900)  # 15 minutes
            except subprocess.TimeoutExpired:
                proc.kill()
            finally:
                t.join()

    # 4. Evaluate and write results as JSON
    resp = requests.post(f"{host}/evaluate")
    _raise_for_status_with_body(resp)
    result = resp.json()

    (task_result_folder / "results.json").write_text(json.dumps(result, indent=2))


def main():
    parser = argparse.ArgumentParser(description="SentinelBench eval harness.")
    parser.add_argument("run_name", help="Name of this evaluation run")
    parser.add_argument("--config", default="eval_config.yaml", help="Path to eval config YAML")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Sentinel API host")
    args = parser.parse_args()

    config = load_config(args.config)
    if args.host != DEFAULT_HOST:
        config["host"] = args.host
    results_root = Path("results") / args.run_name

    tasks = list(discover_tasks())
    print(f"Found {len(tasks)} tasks. Results -> {results_root}")

    for environment, scenario_id, task_path in tasks:
        task_result_folder = results_root / environment / scenario_id
        task_result_folder.mkdir(parents=True, exist_ok=True)
        if (task_result_folder / "results.json").exists():
            print(f"  Skipping {scenario_id} (already done)")
            continue
        if (task_result_folder / "error.txt").exists():
            print(f"  Skipping {scenario_id} (previous error)")
            continue
        print(f"  Running {scenario_id} ...")
        try:
            run_task(config, task_path, task_result_folder)
        except Exception as e:
            (task_result_folder / "error.txt").write_text(traceback.format_exc())
            print(f"  ERROR: {e}")

    print("Done.")


if __name__ == "__main__":
    main()
