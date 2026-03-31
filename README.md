<div align="center">

<!-- Replace with your own banner/logo path -->
<img src="banner.svg" alt="SentinelBench Logo">

*A benchmark for evaluating AI agents on long-horizon monitoring tasks.*

[![Paper (arXiv)](https://img.shields.io/badge/Paper-arXiv-b31b1b)](https://arxiv.org/abs/ARXIV_ID_TODO)
[![Citation](https://img.shields.io/badge/Cite-BibTeX-blue)](#citation)
[![Website](https://img.shields.io/badge/Website-Live-brightgreen)](https://sentinel-bench.vercel.app/)
[![Blog](https://img.shields.io/badge/Blog-Post-6f42c1)](https://www.microsoft.com/en-us/research/blog/tell-me-when-building-agents-that-can-wait-monitor-and-act/?msockid=00fd3664922e643528ea20339334658d)

</div>

---

**SentinelBench** is a benchmark for evaluating AI agents on **long-horizon monitoring tasks**. SentinelBench addresses a critical gap in current evaluations by testing whether agents can *wait*, *monitor*, and *act* over extended periods of time.

> **Status**: Under active development. Part of ongoing research on enabling agents to complete long-duration tasks.

## Motivation

Modern Browser Use Agents (BUA) and Computer Use Agents (CUA) excel at short-horizon tasks, but their performance declines sharply on tasks requiring continual monitoring. Recent studies show that while state-of-the-art models succeed in nearly all tasks taking humans less than four minutes, their success rate falls below 10% for tasks exceeding four hours. This decay follows a constant "hazard rate," meaning the probability of success decreases exponentially with task duration.

Current agents fail at long-duration monitoring due to:

- **Exponential decay**: Success rates drop exponentially with task duration
- **Context overflow**: Repeated information storage overwhelms context windows
- **Rate limiting**: Aggressive polling triggers API and website limits
- **Attention drift**: Agents lose focus, hallucinate, or deviate from instructions

SentinelBench provides a controlled testbed to evaluate these failure modes and measure progress on long-horizon agent capabilities.

## Benchmark Structure

SentinelBench consists of **10 high-fidelity web-app environment replicas** (Micro* environments), each exposing **20 objective task variants**, evaluated at **5 durations**:

```
10 environments × 20 variants × 5 durations = 1,000 task configurations
```

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

> **Note on Data Types**: Environments marked "Text-only (JSONL)" use structured text data without AI-generated media. Environments with synthetic data use AI-generated images, videos, or audio created via the scripts in `data-generation/`. See [Synthetic Data Generation](#synthetic-data-generation) for details.

### Task Dimensions

Each environment defines **20 task variants** via URL parameters:

```
5 task types × 2 criteria × 2 activity = 20 variants
```

| Dimension | Options | Description |
|-----------|---------|-------------|
| **Task Type** | 5 per environment | Environment-specific monitoring targets (e.g., unread emails, GitHub stars) |
| **Criteria** | `absolute` / `relative` | Fixed threshold vs. threshold relative to baseline at task start |
| **Activity** | `passive` / `active` | Monitor-only vs. monitor + perform verifiable end action |

### Durations

All tasks are **time-based**: the success condition becomes satisfiable exactly at the specified duration. Tasks cannot complete early.

- 15 minutes
- 30 minutes
- 1 hour
- 2 hours
- 4 hours

The benchmark supports arbitrary durations via URL parameters for stress-testing persistence over longer periods.

### Example Task URL

```
/micromail?task=junk&criteria=relative&activity=active&duration=3600
```

This configures: *Monitor for new junk emails relative to baseline, perform cleanup action when threshold met, 1-hour duration.*

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

- **URL parameter stripping**: Parameters are captured on first render, then stripped from the URL to prevent agents from reading their assignment
- **State persistence**: Task state persists across browser refreshes via localStorage
- **Deterministic timing**: Events occur at predictable intervals based on duration parameter

### Recommended Dataset Splits

For system development, split at the **environment level**:

| Split | Environments | Configurations | Purpose |
|-------|--------------|----------------|---------|
| Reporting | 7 | 700 | Main results |
| Validation | 2 | 200 | System selection/tuning |
| Held-out Test | 1 | 100 | Blind evaluation (not released) |

## Quick Start

### Run the Frontend (Manual Testing)

```bash
cd sentinelbench
npm install
npm run dev
```

Visit `http://localhost:5174` to interact with tasks manually.

### Run Agent Evaluations

```bash
# Setup Python environment
python3 -m venv .venv
source .venv/bin/activate
cd evals/browseruse_sentinelbench

# Install dependencies
pip install browser-use inspect-ai langchain-openai langchain-anthropic python-dotenv
playwright install chromium

# System dependencies (Linux/WSL2)
sudo apt-get install -y libnspr4 libnss3 libasound2t64
sudo service dbus start  # WSL2 only

# Configure API keys
echo "OPENAI_API_KEY=your_key" > .env
echo "ANTHROPIC_API_KEY=your_key" >> .env

# Run evaluation
python browseruse_sentinelbench.py
```

## System Requirements

- **OS**: Linux (Ubuntu 20.04+), macOS, or Windows WSL2
- **Python**: 3.11+
- **Node.js**: 18+
- **Memory**: 8GB+ recommended for AI evaluations
- **API Keys**: OpenAI, Anthropic, or Google (depending on models tested)

## Related Work

SentinelBench is designed to complement existing agent benchmarks:

| Benchmark | Focus | Long-Horizon Aspect |
|-----------|-------|---------------------|
| GAIA | General AI Q&A | Single-turn, no persistent monitoring |
| WebVoyager | Real web browsing | Multi-step navigation, one session |
| AssistantBench | User-like web tasks | Time-consuming but continuous runs |
| WebGames | Interactive web challenges | Complex tasks, no idle periods |
| **SentinelBench** | Monitoring tasks | 15min–4h waits with periodic checking |

## Research Context

SentinelBench is part of research on **SentinelSteps**, a method for enabling multi-agent orchestration systems to handle long-duration conditional tasks. SentinelSteps extend standard plan steps with:

- A natural-language termination condition
- An adaptive sleep schedule between checks
- State preservation across monitoring iterations

The approach is implemented in [Magentic-UI](https://github.com/microsoft/magentic-ui), an open-source multi-agent system.

## Repository Structure

```
SentinelBench/
├── sentinelbench/src/
│   ├── environments/      # Micro* environment implementations
│   ├── data/              # Synthetic data (users, emails, events, etc.)
│   ├── config/            # Task variants
│   └── utils/             # Task state management, timestamps
├── data-generation/       # Synthetic data generation scripts and prompts
│   ├── scripts/           # Generation scripts (batch_image_gen.py, SLURM jobs)
│   ├── prompts/           # Prompt files organized by environment
│   └── docs/              # REPRODUCTION.md, COMPLIANCE.md
├── evals/                 # Evaluation harnesses
├── docs/                  # Documentation
└── paper/                 # Research paper draft
```

## Synthetic Data Generation

The `data-generation/` folder contains all scripts and prompts used to generate synthetic media for SentinelBench environments.

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

These environments rely solely on the JSONL files in `sentinelbench/src/data/content/` which contain all necessary text-based content for benchmark tasks.

### Running Data Generation

See [`data-generation/docs/REPRODUCTION.md`](data-generation/docs/REPRODUCTION.md) for detailed instructions on regenerating synthetic assets. Requirements include:

- **GPU**: NVIDIA A100 (images) or B200 Blackwell (video/audio)
- **VRAM**: 32GB+ for images, 80GB+ for video
- **HuggingFace account**: Required for gated model access (FLUX.2-dev)

```bash
cd data-generation/scripts
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
huggingface-cli login

# Generate user avatars
python batch_image_gen.py --mode image --model flux2-dev \
    --prompt_file ../prompts/users/avatars-prompts.txt \
    --output_dir ./generated_avatars
```

## Documentation

- **[Quick Start Guide](docs/01-getting-started/quick-start.md)** - Get running in 5 minutes
- **[Task Development Guide](docs/03-task-development/task-guide.md)** - Create new environments/tasks
- **[Architecture Overview](docs/03-task-development/architecture-overview.md)** - System design

## License

[License information to be added]

## Citation

Citation information will be provided upon publication.

## 👥 Authors

- Matheus Kunzler Maldaner — [GitHub](https://github.com/matheusmaldaner)
- Adam Fourney — [GitHub](https://github.com/afourney)
- Hussein Mozannar — [GitHub](https://github.com/husseinmozannar)
- Gagan Bansal — [GitHub](https://github.com/gagb)
- Maya Murad — [GitHub](https://github.com/mmurad2)
