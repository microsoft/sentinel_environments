<div align="center">

<!-- Replace with your own banner/logo path -->
<img src="banner.svg" alt="Sentinel Environments Logo">

*A benchmark for evaluating AI agents on long-horizon monitoring tasks.*

[![Citation](https://img.shields.io/badge/Cite-BibTeX-blue)](#citation)
[![Blog](https://img.shields.io/badge/Blog-Post-6f42c1)](https://www.microsoft.com/en-us/research/blog/tell-me-when-building-agents-that-can-wait-monitor-and-act/)

</div>

---

**Sentinel Environments** is a benchmark for evaluating AI agents on **long-horizon monitoring tasks**, addressing a critical gap in current evaluations by testing whether agents can *wait*, *monitor*, and *act* over extended periods of time.

> **Status**: Under active development. Part of ongoing research on enabling agents to complete long-duration tasks.

## Motivation

Modern Browser Use Agents (BUA) and Computer Use Agents (CUA) excel at short-horizon tasks, but their performance declines sharply on tasks requiring continual monitoring. Recent studies show that while state-of-the-art models succeed in nearly all tasks taking humans less than four minutes, their success rate falls below 10% for tasks exceeding four hours. This decay follows a constant "hazard rate," meaning the probability of success decreases exponentially with task duration.

Current agents fail at long-duration monitoring due to:

- **Exponential decay**: Success rates drop exponentially with task duration
- **Context overflow**: Repeated information storage overwhelms context windows
- **Rate limiting**: Aggressive polling triggers API and website limits
- **Attention drift**: Agents lose focus, hallucinate, or deviate from instructions

This benchmark provides a controlled testbed to evaluate these failure modes and measure progress on long-horizon agent capabilities.

## Benchmark Structure

The benchmark consists of **10 high-fidelity web-app environment replicas** (Micro* environments), each with **20 objective task variants** at configurable durations:

### Environments

| Environment | Category | Description | Data Type |
|-------------|----------|-------------|-----------|
| MicroMail | Email client | Inbox, folders, filtering | Synthetic images |
| MicroChat | Team messaging | Chat and notifications | Synthetic images |
| MicroDin | Professional network | Connections, posts, jobs | Synthetic images |
| MicroHub | Code hosting | Repository stars, issues, PRs, releases | Text-only (JSONL) |
| MicroHood | Stock trading | Price and portfolio tracking | Text-only (JSONL) |
| MicroGram | Photo sharing | Social feed and engagement metrics | Synthetic images |
| MicroTube | Video platform | Video uploads and subscriber counts | Synthetic video/images |
| MicroFy | Music streaming | Playlist updates and new releases | Synthetic audio |
| MicroLendar | Calendar | Event scheduling and reminders | Text-only (JSONL) |
| MicroScholar | Academic search | Citation counts and new papers | Text-only (JSONL) |

> **Note on Data Types**: Environments marked "Text-only (JSONL)" use structured text data without AI-generated media. Environments with synthetic data use AI-generated images, videos, or audio created via the scripts in `data_generation/`. See [Synthetic Data Generation](#synthetic-data-generation) for details.

### Task Dimensions

Each environment defines **20 task variants** via scenario JSON files:

```
5 task types × 2 criteria × 2 activity = 20 variants
```

| Dimension | Options | Description |
|-----------|---------|-------------|
| **Task Type** | 5 per environment | Environment-specific monitoring targets (e.g., unread emails, GitHub stars) |
| **Criteria** | `absolute` / `relative` | Fixed threshold vs. threshold relative to baseline at task start |
| **Activity** | `passive` / `active` | Monitor-only vs. monitor + perform verifiable end action |

### Durations

All tasks are **time-based**: the success condition becomes satisfiable exactly at the specified duration. Tasks cannot complete early. Durations are configurable per scenario -- scale up for stress-testing persistence or scale down for rapid iteration.

### Example Scenario

Each task is defined as a JSON file in `scenarios/<env>/`:

```json
{
  "id": "micromail-junk-relative-active",
  "environment": "micromail",
  "prompt": "Notify when 10 new junk emails arrive.",
  "events": [ ... ],
  "eval_sql": "SELECT ..."
}
```

Event timings within each scenario control the effective duration -- scale them up or down to adjust task length.

The eval harness discovers these scenarios automatically and runs them against an agent subprocess.

## Evaluation Protocol

### Success Criteria

Each task has a SQL evaluation query (`eval_sql`). The harness calls `POST /evaluate` after the agent completes, which materializes session state to an in-memory SQLite database and runs the query. Success is determined solely by whether the query returns a truthy value.

For `activity=active` tasks, the SQL query checks whether the required action was performed by examining the database state directly.

### Metrics

| Metric | Description |
|--------|-------------|
| **Accuracy** | Binary: did the agent achieve the desired state? (eval_sql returns true) |
| **Elapsed Time** | Wall-clock time until termination (agent stop or timeout) |
| **Cost** | Token usage and API costs |

### Anti-Gaming Measures

- **Server-side state**: All task state is managed by the API server, not exposed to the agent
- **Deterministic timing**: Events occur at predictable intervals based on scenario duration
- **SQL-based evaluation**: Success is determined by `eval_sql` queries against materialized session state

### Recommended Dataset Splits

For system development, split at the **environment level**:

| Split | Environments | Configurations | Purpose |
|-------|--------------|----------------|---------|
| Reporting | 7 | 700 | Main results |
| Validation | 2 | 200 | System selection/tuning |
| Held-out Test | 1 | 100 | Blind evaluation (not released) |

## Quick Start

A convenience script launches all components in a single tmux session:

```bash
./start.sh
```

This opens 3 tmux windows: **server** (API on `:8000`), **frontend** (Vite on `:5173`), and **harness** (shell ready for eval runs).

### 1. API Server

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt

# Build the SQLite databases from JSONL catalogs (required on first setup)
python -m server.scripts.build_db

uvicorn server.server:app --host 0.0.0.0 --port 8000
```

> **Note:** The `.db` files are not checked into git. You must run `build_db` before starting the server. Re-run it whenever the JSONL catalogs in `data/catalogs/` change.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to interact with environments manually. The frontend proxies API requests to `localhost:8000`, so the API server must be running.

### Dev Mode

Set `SENTINEL_DEV` to skip the `/init` flow and preload environment data on startup:

```bash
# Backend -- preload all environments
SENTINEL_DEV=all uvicorn server.server:app --reload --port 8000

# Backend -- preload a single environment
SENTINEL_DEV=microfy uvicorn server.server:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm run dev
```

Each environment has a `scenarios/dev.json` that uses `["*"]` wildcards to load all catalog data. New catalog entries are picked up automatically.

### 3. Eval Harness

The eval harness discovers all scenario JSON files, runs each against an agent subprocess, and collects results.

**Configure your agent** by creating an `eval_config.yaml` in the repo root:

```yaml
host: http://localhost:8000

# Command to launch your agent. Placeholders:
#   __TASK_URL__    - replaced with the task start URL (GET triggers simulation start + redirect)
#   __TASK_PROMPT__ - replaced with the task's natural language prompt
#
# Use a list for direct execution, or a string for shell execution (placeholders are shell-escaped).
agent_subprocess: ["your-agent-command", "--url", "__TASK_URL__", "--prompt", "__TASK_PROMPT__"]
```

**Run:**

```bash
python -m server.eval_harness <run_name> [--config eval_config.yaml] [--api-url http://localhost:8000]
```

Results are written to `results/<run_name>/<environment>/<scenario_id>/`:

| File | Description |
|------|-------------|
| `results.json` | Evaluation result (`success`, `detail`) |
| `output.txt` | Agent subprocess stdout/stderr |
| `error.txt` | Harness error traceback (if the task failed to run) |

Tasks with an existing `results.json` or `error.txt` are skipped, so runs can be resumed after interruption.

**Example:**

```bash
python -m server.eval_harness my_first_run
# Found 56 tasks. Results -> results/my_first_run
#   Running micromail-inbox-absolute-active ...
#   Running micromail-cc-absolute-active ...
#   ...
# Done.
```

## System Requirements

- **OS**: Linux (Ubuntu 20.04+), macOS, or Windows WSL2
- **Python**: 3.11+
- **Node.js**: 18+
- **Memory**: 8GB+ recommended for AI evaluations
- **API Keys**: OpenAI, Anthropic, or Google (depending on models tested)

## Related Work

This benchmark is designed to complement existing agent benchmarks:

| Benchmark | Focus | Long-Horizon Aspect |
|-----------|-------|---------------------|
| GAIA | General AI Q&A | Single-turn, no persistent monitoring |
| WebVoyager | Real web browsing | Multi-step navigation, one session |
| AssistantBench | User-like web tasks | Time-consuming but continuous runs |
| WebGames | Interactive web challenges | Complex tasks, no idle periods |
| **Sentinel Environments** | Monitoring tasks | Configurable-duration waits with periodic checking |

## Research Context

This benchmark is part of research on **SentinelSteps**, a method for enabling multi-agent orchestration systems to handle long-duration conditional tasks. SentinelSteps extend standard plan steps with:

- A natural-language termination condition
- An adaptive sleep schedule between checks
- State preservation across monitoring iterations

The approach is implemented in [Magentic-UI](https://github.com/microsoft/magentic-ui), an open-source multi-agent system.

## Repository Structure

```
sentinel_environments/
├── server/                # FastAPI backend (handlers, scenarios, SQLite databases)
│   ├── handlers/          # Per-environment request handlers
│   ├── scripts/           # build_db.py (JSONL → SQLite)
│   ├── <env>/             # .db file + scenarios/*.json per environment
│   ├── server.py          # Main FastAPI app
│   └── run_simulation.py  # CLI evaluation harness
├── frontend/              # React/Vite frontend
│   ├── src/
│   │   ├── environments/  # Micro* UI components
│   │   ├── hooks/         # API data hooks
│   │   └── data/          # Type definitions and JSONL source data
│   └── public/            # Static media (images, audio, video)
├── data_generation/       # Synthetic data generation scripts and prompts
│   ├── scripts/           # Generation scripts (batch_image_gen.py, SLURM jobs)
│   ├── prompts/           # Prompt files organized by environment
│   └── docs/              # REPRODUCTION.md, COMPLIANCE.md
└── tests/                 # Integration, E2E, and eval_sql tests
```

## Synthetic Data Generation

The `data_generation/` folder contains all scripts and prompts used to generate synthetic media for Sentinel Environments.

### Generated Asset Types

| Asset Type | Model | Environments |
|------------|-------|--------------|
| User avatars & banners | FLUX.2-dev | All environments |
| Post/story images | FLUX.2-dev | MicroGram, MicroDin |
| Document attachments | FLUX.2-dev | MicroMail |
| Company logos & banners | FLUX.2-dev | MicroDin, MicroTube |
| Video content | Wan2.2-T2V-14B | MicroTube |
| Music tracks | ACE-Step | MicroFy |

### Environments Without Synthetic Media

The following environments use **text-only JSONL data** and do not require AI-generated media:

- **MicroHub** (code hosting) - Uses structured repository data (commits, issues, PRs, releases)
- **MicroHood** (stock trading) - Uses stock price traces and market data
- **MicroLendar** (calendar) - Uses calendar event data
- **MicroScholar** (academic search) - Uses academic paper metadata

These environments rely solely on the JSONL files in `frontend/src/data/content/` which contain all necessary text-based content for benchmark tasks.

### Running Data Generation

See [`data_generation/docs/REPRODUCTION.md`](data_generation/docs/REPRODUCTION.md) for detailed instructions on regenerating synthetic assets. Requirements include:

- **GPU**: NVIDIA A100 (images) or B200 Blackwell (video/audio)
- **VRAM**: 32GB+ for images, 80GB+ for video
- **HuggingFace account**: Required for gated model access (FLUX.2-dev)

```bash
cd data_generation/scripts
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
huggingface-cli login

# Generate user avatars
python batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file ../prompts/users/avatars-prompts.txt \
    --output_dir ./generated_avatars
```

## License

This project is licensed under the [MIT License](LICENSE).

## Citation

Citation information will be provided upon publication.

## 👥 Authors

- Matheus Kunzler Maldaner -- [GitHub](https://github.com/matheusmaldaner)
- Adam Fourney -- [GitHub](https://github.com/afourney)
- Amanda Swearngin -- [GitHub](https://github.com/amaswea)
- Hussein Mozannar -- [GitHub](https://github.com/husseinmozannar)
- Gagan Bansal -- [GitHub](https://github.com/gagb)
- Maya Murad -- [GitHub](https://github.com/mmurad2)
