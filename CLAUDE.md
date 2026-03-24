# CronPulse

Local-first cron job monitoring dashboard. A single binary / `npx` command that spins up a local web server on `localhost:7575`. Zero config, no internet, no accounts, no telemetry.

## How It Works

On startup, CronPulse:
1. Detects the OS (Linux, macOS, Windows)
2. Reads all cron jobs from `crontab -l` (Linux/Mac) or `schtasks /Query` (Windows)
3. Parses each entry: schedule, command, name
4. Starts a background watcher that tracks when each job was supposed to run and whether it actually did
5. Serves a dashboard on localhost

## Tech Stack

- **Backend**: Node.js with TypeScript
- **Framework**: Hono (lightweight, fast, perfect for local server)
- **Frontend**: React 19 with Vite (SPA served by the backend)
- **Styling**: TailwindCSS v4 + shadcn/ui
- **OS Integration**: `child_process` for running commands and reading crontab
- **Real-time**: SSE (Server-Sent Events) for live log streaming and status updates
- **Storage**: SQLite (via better-sqlite3) — single file, zero config, stores run history and logs
- **Packaging**: tsup to bundle, publish as npm package (`npx cronpulse`)
- **Linting**: Biome
- **Containerization**: Docker with auto-restart support

## Architecture

```
User's terminal                Browser (localhost:7575)
      │                              │
      ▼                              ▼
  $ cronpulse              ┌─────────────────┐
      │                    │   React SPA      │
      ▼                    │   - Job list     │
  ┌──────────┐             │   - Status cards │
  │  Hono    │◄───SSE──────│   - Log viewer   │
  │  Server  │             │   - Run button   │
  │          │────API──────►│                  │
  └──────────┘             └─────────────────┘
      │
      ├── reads crontab / schtasks
      ├── spawns child processes (Run Now)
      ├── captures stdout/stderr
      ├── writes to SQLite (run history)
      └── watches for scheduled executions
```

## Cron Job Detection

### Linux / macOS
- Run `crontab -l` to get user's crontab entries
- Parse each line: extract schedule (5 fields), command, and any inline comments as name
- Also check `/etc/cron.d/`, `/etc/cron.daily/`, etc. if running with elevated permissions
- Use `journalctl` or `/var/log/syslog` to check if a job actually ran

### Windows
- Run `schtasks /Query /FO CSV /V` to get all scheduled tasks
- Parse CSV output: extract task name, schedule, command, last run time, last result
- Use `Get-ScheduledTaskInfo` via PowerShell for richer data if available

### Parsing
- Store detected jobs in SQLite with a hash of (schedule + command) as stable ID so they persist across restarts
- Re-scan crontab every 30 seconds to pick up changes
- Parse cron expressions to calculate next run time (use `cron-parser` npm package)

## Database (SQLite)

**jobs** — `id` (hash), `name`, `schedule_expression`, `schedule_human` (e.g. "Every day at 3am"), `command`, `source` (crontab/schtasks/cron.d), `status` (idle/running/succeeded/failed/overdue), `last_run_at`, `last_duration_ms`, `next_run_at`, `enabled`, `created_at`, `updated_at`

**runs** — `id`, `job_id`, `started_at`, `finished_at`, `duration_ms`, `exit_code`, `stdout` (text), `stderr` (text), `trigger` (scheduled/manual), `status` (running/succeeded/failed)

SQLite file stored in `~/.cronpulse/data.db`.

## API Endpoints (Hono)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/jobs` | List all detected cron jobs with current status |
| GET | `/api/jobs/:id` | Single job detail |
| POST | `/api/jobs/:id/run` | Trigger manual execution, returns run ID |
| GET | `/api/jobs/:id/runs` | Paginated run history |
| GET | `/api/jobs/:id/runs/:runId` | Single run detail with full logs |
| GET | `/api/jobs/:id/runs/:runId/stream` | SSE stream of live stdout/stderr while running |
| POST | `/api/scan` | Force re-scan of crontab |
| GET | `/api/system` | OS info, uptime, crontab path, number of jobs detected |
| GET | `/api/events` | SSE stream of global status changes |

## Frontend Pages

### Dashboard (`/`)
- Header: "CronPulse" + system info (OS, number of jobs, uptime)
- Job cards in a grid/list (toggle view):
  - Job name (parsed from comment or generated from command)
  - Schedule in human-readable form + cron expression tooltip
  - Status badge with color + icon
  - Next run countdown
  - Last run: time ago + duration + exit code
  - **[Run Now]** button (with confirmation for destructive-looking commands)
  - Click card to expand or navigate to detail

### Job Detail (`/jobs/:id`)
- Full command displayed in a code block
- Status + schedule info
- **[Run Now]** button prominent at top
- Run history table: timestamp, duration, exit code, trigger type (manual/scheduled), status
- Click any run to open log viewer

### Log Viewer (panel or page)
- Terminal-style dark background
- stdout in white, stderr in red
- Auto-scroll with "pin to bottom" toggle
- If job is currently running: live streaming via SSE
- Copy full log button
- Search/filter within log

### Settings (`/settings`)
- Crontab source path (auto-detected, manually overridable)
- Refresh interval
- Max log retention (number of runs to keep per job, default 50)
- Port configuration

## Key Behaviors

### Run Now
- Spawns the job's command as a child process
- Captures stdout and stderr separately
- Streams output to the frontend via SSE in real-time
- Records exit code, duration, and full output in SQLite
- Updates job status immediately (running → succeeded/failed)

### Status Detection
- On startup, calculate `next_run_at` for each job from its cron expression
- Every 10 seconds, check: if `now > next_run_at` and no run was recorded → mark as overdue
- When a run completes: update status based on exit code (0 = succeeded, else failed)
- If a job is running: show "running" with elapsed time

### Status Colors
- **Gray**: scheduled/idle
- **Blue pulse**: running
- **Green**: succeeded
- **Red**: failed
- **Yellow**: overdue

### Log Retention
- Keep last 50 runs per job by default (configurable)
- Prune old runs on startup and after each new run

## CLI Interface

```bash
# Start the dashboard (default port 7575)
$ cronpulse

# Custom port
$ cronpulse --port 3000

# Run with verbose backend logging
$ cronpulse --verbose

# Just list detected cron jobs without starting server
$ cronpulse list

# Run a specific job by name/id from terminal
$ cronpulse run "nightly-backup"
```

## Docker Support

CronPulse can run inside a Docker container with auto-restart, useful for always-on monitoring without a persistent terminal session.

### Dockerfile
- Multi-stage build: build stage (Node + Vite) → production stage (Node slim)
- Expose port 7575
- Volume mount for `~/.cronpulse/` (SQLite persistence)
- Volume mount for host crontab access (read-only)
- `NODE_ENV=production`

### Docker Compose
- Service `cronpulse` with `restart: unless-stopped` for auto-restart on crash or reboot
- Bind mount host crontab files read-only:
  - `/var/spool/cron/crontabs:/host-crontabs:ro` (Linux)
  - `/var/at/tabs:/host-crontabs:ro` (macOS)
  - `/etc/cron.d:/host-cron.d:ro`
- Named volume for `~/.cronpulse/` data persistence
- Port mapping `7575:7575` (configurable via `.env`)
- Optional healthcheck hitting `GET /api/system`

### Host Crontab Access from Container
- When running in Docker, CronPulse detects it's containerized (check for `/.dockerenv` or `CRONPULSE_DOCKER=true` env var)
- Instead of running `crontab -l`, reads crontab files from the bind-mounted `/host-crontabs/` directory
- "Run Now" executes commands **inside the container** by default; optionally can execute on host via a mounted Docker socket or SSH (configurable, off by default for security)
- Environment variable `CRONPULSE_CRONTAB_PATH` to override crontab source path

### CLI Docker Commands
```bash
# Run with Docker (auto-restart enabled)
$ docker compose up -d

# View logs
$ docker compose logs -f cronpulse

# Stop
$ docker compose down
```

### Environment Variables (Docker)
| Variable | Default | Description |
|----------|---------|-------------|
| `CRONPULSE_PORT` | `7575` | Server port |
| `CRONPULSE_DOCKER` | auto-detected | Force Docker mode |
| `CRONPULSE_CRONTAB_PATH` | auto-detected | Override crontab source path |
| `CRONPULSE_DATA_DIR` | `~/.cronpulse` | SQLite and config storage directory |
| `CRONPULSE_LOG_RETENTION` | `50` | Max runs to keep per job |
| `CRONPULSE_HOST_EXEC` | `false` | Allow executing commands on host (requires Docker socket mount) |

## Design Principles

- **Zero config** — run the command, open the browser, done
- **Read-only by default** — CronPulse never modifies crontab, it only reads and executes
- **Local only** — no internet required, no telemetry, no accounts
- **Fast startup** — should be ready in under 1 second
- **Portable** — works on Linux, macOS, and Windows with the same codebase
- **Resilient** — Docker auto-restart ensures monitoring survives crashes and reboots

## Development Commands

```bash
# Install dependencies
pnpm install

# Dev mode (backend + frontend with hot reload)
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start

# Lint
pnpm lint

# Type check
pnpm typecheck

# Docker build and run
docker compose up -d --build
```

## Project Structure

```
cronpulse/
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── biome.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── src/
│   ├── cli.ts              # CLI entry point (commander)
│   ├── server/
│   │   ├── index.ts         # Hono server setup
│   │   ├── routes/
│   │   │   ├── jobs.ts      # /api/jobs routes
│   │   │   ├── runs.ts      # /api/jobs/:id/runs routes
│   │   │   ├── system.ts    # /api/system + /api/scan
│   │   │   └── events.ts    # /api/events SSE
│   │   └── middleware/
│   │       └── cors.ts
│   ├── core/
│   │   ├── detector.ts      # OS detection + crontab reading
│   │   ├── parser.ts        # Cron expression parsing
│   │   ├── executor.ts      # Job execution + output capture
│   │   ├── watcher.ts       # Background scheduler watcher
│   │   └── docker.ts        # Docker-specific detection and crontab reading
│   ├── db/
│   │   ├── index.ts         # SQLite connection + migrations
│   │   ├── jobs.ts          # Job queries
│   │   └── runs.ts          # Run queries
│   └── types/
│       └── index.ts         # Shared TypeScript types
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── JobDetail.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── JobCard.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── LogViewer.tsx
│   │   │   ├── RunHistory.tsx
│   │   │   └── Countdown.tsx
│   │   ├── hooks/
│   │   │   ├── useSSE.ts
│   │   │   └── useJobs.ts
│   │   └── lib/
│   │       ├── api.ts
│   │       └── utils.ts
│   └── tailwind.config.ts
└── tsup.config.ts
```
