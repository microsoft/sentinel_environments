# SentinelBench Frontend

Skeleton web UI for 10 Micro* environments used by the SentinelBench benchmark.

Each environment is a single-page React app backed by a FastAPI server (`sentinel_api/`). The server drives the simulation lifecycle: `/init` loads a scenario, `/advance` ticks time and fires events, and `POST /evaluate` runs a SQL query against materialized session state to determine success.

## Environments

MicroMail, MicroChat, MicroDin, MicroFy, MicroGram, MicroHood, MicroHub, MicroLendar, MicroScholar, MicroTube.

## Running

```bash
npm install
npm run dev   # localhost:5173, proxies /api/* to localhost:8000
```

## Evaluation

Success is determined solely by SQL evaluation queries. The harness calls `POST /evaluate` after the agent completes, which materializes session state into an in-memory SQLite database and runs the scenario's `eval_sql` query.
