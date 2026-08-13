# CronPulse

A local-first cron job monitoring dashboard. A single binary / `npx` command that starts a local web server at `localhost:7575`. Zero configuration, no internet, no accounts, no telemetry.

## About CronPulse

CronPulse automatically detects every cron job (on Linux and macOS) and scheduled task (on Windows), and presents a clean, modern dashboard for monitoring:

- Real-time execution status
- Run history with duration and exit codes
- stdout/stderr logs with live streaming
- Schedules in human-readable form
- Next run with a countdown
- Manual job execution ("Run Now")

### Key Characteristics

- **Automatic detection** — Reads `crontab -l` (Linux/macOS) or `schtasks` (Windows)
- **Zero config** — Run the command, open the browser, done
- **Local and private** — No telemetry, no accounts, no internet required
- **Real time** — Status updated live via Server-Sent Events (SSE)
- **Cross-platform** — Linux, macOS, and Windows from the same codebase
- **Persistence** — SQLite for history and logs
- **Docker** — Full support with auto-restart
- **Install as a service** — systemd (Linux), launchd (macOS), Task Scheduler (Windows)

## Preview

[Dashboard images go here — job card grid, job details, log viewer]

## Requirements

- **Node.js** 20.0.0 or later
- **pnpm** 8.0.0 or later (package manager)
- Operating system: **Linux**, **macOS**, or **Windows**

### Installing Node.js and pnpm

**Linux and macOS:**
```bash
# Install Node.js (via nvm, recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Install pnpm
npm install -g pnpm
```

**Windows:**
Download the installer from https://nodejs.org (version 20+) and install it. Then:
```powershell
npm install -g pnpm
```

## Installation and Build

### Option 1: NPX (Recommended for Use)

```bash
npx cronpulse
```

The dashboard opens automatically at `http://localhost:7575`.

### Option 2: Local Build (for Development)

```bash
# Clone or open the repository
cd cronpulse

# Install the dependencies
pnpm install

# Build
pnpm build

# Start
pnpm start
```

### Option 3: Docker

```bash
docker compose up -d
```

Open `http://localhost:7575`.

## How to Use

### Command Line (CLI)

#### Starting the Dashboard

```bash
# Default port (7575)
cronpulse

# Custom port
cronpulse --port 3000

# With verbose logs
cronpulse --verbose

# Don't open the browser automatically
cronpulse --no-open
```

#### Listing Cron Jobs

```bash
cronpulse list
```

Prints a table with every detected job, its status, and its next run.

#### Running a Job Manually

```bash
cronpulse run "job-name"
```

Runs a specific job by name or ID, showing live logs in the terminal.

### Web Interface

Open `http://localhost:7575` in your browser.

#### Main Dashboard

- **Job grid** — Each card shows the name, schedule, status, next run, and last run
- **[Run Now] button** — Runs the job manually
- **View toggle** — Switch between grid and list
- **[Scan] button** — Forces a fresh job detection
- **Status summary** — A count of jobs by status (running, succeeded, failed, overdue, idle)

#### Job Detail

Click a job card to see:

- The full command in a code block
- The schedule (cron expression and human-readable form)
- Detailed status
- Run history (a table with timestamp, duration, exit code, and trigger)

#### Log Viewer

Click a run in the history to see:

- stdout output (white)
- stderr output (red)
- Auto-scroll with a toggle to pin to the bottom
- Live streaming if the job is running
- A button to copy the full logs
- Search/filter within the logs

#### Settings

The `/settings` page lets you adjust:

- The crontab source path (auto-detected, and changeable)
- The refresh interval
- Maximum log retention (default: 50 runs per job)
- The server port

## Setting Up as a Permanent Service

### Linux (systemd)

To run CronPulse automatically in the background, use a user service.

#### 1. Build the Project

```bash
cd /path/to/cronpulse
pnpm install
pnpm build
```

#### 2. Create the Service File

Create `~/.config/systemd/user/cronpulse.service`:

```ini
[Unit]
Description=CronPulse - Cron Job Monitoring Dashboard
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /path/to/cronpulse/dist/cli.js --no-open
WorkingDirectory=/path/to/cronpulse
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=CRONPULSE_PORT=7575

[Install]
WantedBy=default.target
```

**Replace `/path/to/cronpulse` with the absolute path of your repository.**

If you use nvm, find the node path:
```bash
which node
# /home/your-user/.nvm/versions/node/v20.x.x/bin/node
```

Use that path on the `ExecStart` line.

#### 3. Enable and Start the Service

```bash
# Reload systemd
systemctl --user daemon-reload

# Enable it to start automatically at boot
systemctl --user enable cronpulse

# Start the service
systemctl --user start cronpulse

# Check the status
systemctl --user status cronpulse

# View the logs
journalctl --user -u cronpulse -f
```

#### 4. Verification

```bash
# Should return "active (running)"
systemctl --user status cronpulse

# Test in the browser
curl http://localhost:7575/api/system
```

#### Useful Commands

```bash
# Restart
systemctl --user restart cronpulse

# Stop
systemctl --user stop cronpulse

# Disable auto-start
systemctl --user disable cronpulse

# See the last lines of the log
journalctl --user -u cronpulse -n 50

# Live logs
journalctl --user -u cronpulse -f
```

### macOS (launchd)

macOS uses `launchd` instead of systemd.

#### 1. Build the Project

```bash
cd /path/to/cronpulse
pnpm install
pnpm build
```

#### 2. Create the Configuration File

Create `~/Library/LaunchAgents/com.cronpulse.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>com.cronpulse</string>

	<key>ProgramArguments</key>
	<array>
		<string>/usr/local/bin/node</string>
		<string>/path/to/cronpulse/dist/cli.js</string>
		<string>--no-open</string>
	</array>

	<key>WorkingDirectory</key>
	<string>/path/to/cronpulse</string>

	<key>RunAtLoad</key>
	<true/>

	<key>KeepAlive</key>
	<true/>

	<key>StandardOutPath</key>
	<string>/tmp/cronpulse.log</string>

	<key>StandardErrorPath</key>
	<string>/tmp/cronpulse.error.log</string>

	<key>EnvironmentVariables</key>
	<dict>
		<key>NODE_ENV</key>
		<string>production</string>
		<key>CRONPULSE_PORT</key>
		<string>7575</string>
	</dict>
</dict>
</plist>
```

**Replace `/path/to/cronpulse` with the absolute path of your repository.**

To find the node path:
```bash
which node
```

#### 3. Load the Agent

```bash
# Load the agent
launchctl load ~/Library/LaunchAgents/com.cronpulse.plist

# Check that it's running
launchctl list | grep cronpulse

# You should see something like:
# - a high-numbered PID = running
# - PID -1 = error or not loaded
```

#### 4. Verification

```bash
# Test in the browser
curl http://localhost:7575/api/system

# View the logs
tail -f /tmp/cronpulse.log
tail -f /tmp/cronpulse.error.log
```

#### Useful Commands

```bash
# Unload (stop)
launchctl unload ~/Library/LaunchAgents/com.cronpulse.plist

# Reload
launchctl unload ~/Library/LaunchAgents/com.cronpulse.plist
launchctl load ~/Library/LaunchAgents/com.cronpulse.plist

# List launchd processes
launchctl list | grep cronpulse

# Remove permanently
rm ~/Library/LaunchAgents/com.cronpulse.plist
launchctl unload ~/Library/LaunchAgents/com.cronpulse.plist
```

### Windows (Task Scheduler or NSSM)

Windows has no native cron, but CronPulse detects `scheduled tasks`.

#### Option A: Task Scheduler (Native)

The simplest approach is to use Windows Task Scheduler to run CronPulse at startup.

**1. Build the Project**

```powershell
cd C:\path\to\cronpulse
pnpm install
pnpm build
```

**2. Create a Scheduled Task**

Open "Task Scheduler" (Windows):

1. Start menu → "Task Scheduler"
2. Click "Create Basic Task..."
3. Name: `CronPulse`
4. Description: `CronPulse - Cron Job Monitoring Dashboard`
5. Trigger: "At log on" (or "At startup" if you prefer)
6. Action: "Start a program"
   - Program: `C:\Program Files\nodejs\node.exe` (or your Node.js path)
   - Arguments: `C:\path\to\cronpulse\dist\cli.js --no-open`
   - Start in: `C:\path\to\cronpulse`
7. Click "Finish"

**3. Additional Configuration**

Right-click the "CronPulse" task → "Properties":

- "General" tab: check "Run whether user is logged in or not"
- "General" tab: check "Run with highest privileges" (if needed)
- "Triggers" tab: click "New..." to add more triggers if you want

**4. Verification**

```powershell
# See the scheduled tasks
tasklist | findstr node

# Test in the browser
curl http://localhost:7575/api/system
```

#### Option B: NSSM (Recommended for a Windows Service)

NSSM (Non-Sucking Service Manager) is more robust for running Node.js as a Windows service.

**1. Download and Set Up NSSM**

```powershell
# Download NSSM from https://nssm.cc/download
# Extract it to C:\Program Files\nssm

# Open PowerShell as Administrator
cd "C:\Program Files\nssm\win64"
```

**2. Install the Service**

```powershell
.\nssm.exe install cronpulse C:\Program Files\nodejs\node.exe
```

A window appears. Configure it:

- **Path:** (already filled in with node.exe)
- **Startup directory:** `C:\path\to\cronpulse`
- **Arguments:** `C:\path\to\cronpulse\dist\cli.js --no-open`
- "Details" tab: set "Startup type" to "Automatic"
- Click "Install service"

**3. Start the Service**

```powershell
# Start
net start cronpulse

# Or via Services.msc:
# Open Services → find "cronpulse" → Start
```

**4. Verification**

```powershell
# Check that it's running
Get-Service -Name cronpulse

# Test in the browser
curl http://localhost:7575/api/system
```

**5. Useful Commands**

```powershell
# Stop the service
net stop cronpulse

# Restart
net stop cronpulse
net start cronpulse

# Remove the service (as admin)
C:\Program Files\nssm\win64\nssm.exe remove cronpulse confirm

# View logs
nssm.exe get cronpulse AppStdout
```

## Docker

CronPulse works well inside a Docker container with auto-restart.

### Docker Compose (Recommended)

```bash
docker compose up -d
```

Open `http://localhost:7575`.

**Stop:**
```bash
docker compose down
```

**Logs:**
```bash
docker compose logs -f cronpulse
```

### The docker-compose.yml File

```yaml
services:
  cronpulse:
    build: .
    restart: unless-stopped
    ports:
      - "${CRONPULSE_PORT:-7575}:7575"
    volumes:
      - cronpulse-data:/root/.cronpulse
      - /var/spool/cron/crontabs:/host-crontabs:ro
      - /etc/cron.d:/host-cron.d:ro
    environment:
      - CRONPULSE_DOCKER=true
      - CRONPULSE_PORT=7575
      - CRONPULSE_LOG_RETENTION=${CRONPULSE_LOG_RETENTION:-50}
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:7575/api/system"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

volumes:
  cronpulse-data:
```

### Docker Configuration

#### Volumes

- **`cronpulse-data`**: Stores the SQLite database (`data.db`)
- **`/var/spool/cron/crontabs`** (Linux): Read-only access to the host's crontabs
- **`/etc/cron.d`**: Read-only access to the system crons
- **`/var/at/tabs`** (macOS): Read-only access to macOS crontabs

#### Environment Variables

```bash
# .env file
CRONPULSE_PORT=7575
CRONPULSE_LOG_RETENTION=50
```

#### Docker Detection

CronPulse automatically detects that it is running in Docker (by checking `/.dockerenv`). When in Docker, it:

- Reads the host's crontabs from `/host-crontabs/` (bind-mounted volumes)
- Runs "Run Now" inside the container (not on the host)
- Treats `CRONPULSE_DOCKER=true` as forcing Docker mode

#### Healthcheck

The docker-compose file includes a healthcheck that tests `GET /api/system` every 30 seconds. If it fails 3 times, the container is restarted.

### Docker: Manual Build

```bash
docker build -t cronpulse:latest .
docker run -d \
  -p 7575:7575 \
  -v cronpulse-data:/root/.cronpulse \
  -v /var/spool/cron/crontabs:/host-crontabs:ro \
  -v /etc/cron.d:/host-cron.d:ro \
  -e CRONPULSE_DOCKER=true \
  -e CRONPULSE_PORT=7575 \
  --name cronpulse \
  --restart unless-stopped \
  cronpulse:latest
```

## API Reference

CronPulse exposes a REST API via Hono for integration with other systems.

### Base URL

```
http://localhost:7575/api
```

### Authentication

No authentication required (local-only).

### Jobs

#### GET /jobs

Lists every detected job with its current status.

**Response:**
```json
[
  {
    "id": "a1b2c3d4e5f6g7h8",
    "name": "Backup Nightly",
    "scheduleExpression": "0 2 * * *",
    "scheduleHuman": "Every day at 2:00 AM",
    "command": "cd /home/user && ./backup.sh",
    "source": "crontab",
    "status": "idle",
    "lastRunAt": "2026-03-24T02:00:45Z",
    "lastDurationMs": 5420,
    "nextRunAt": "2026-03-25T02:00:00Z",
    "enabled": true,
    "createdAt": "2026-03-20T10:30:00Z",
    "updatedAt": "2026-03-24T02:00:45Z"
  }
]
```

**Status values:**
- `idle` — Scheduled, next run in the future
- `running` — Executing right now
- `succeeded` — Last run completed with exit code 0
- `failed` — Last run completed with a non-zero exit code
- `overdue` — The next run time has passed but no run was recorded

#### GET /jobs/:id

Gets the details of a specific job.

**Response:**
```json
{
  "id": "a1b2c3d4e5f6g7h8",
  "name": "Backup Nightly",
  "scheduleExpression": "0 2 * * *",
  "scheduleHuman": "Every day at 2:00 AM",
  "command": "cd /home/user && ./backup.sh",
  "source": "crontab",
  "status": "idle",
  "lastRunAt": "2026-03-24T02:00:45Z",
  "lastDurationMs": 5420,
  "nextRunAt": "2026-03-25T02:00:00Z",
  "enabled": true,
  "createdAt": "2026-03-20T10:30:00Z",
  "updatedAt": "2026-03-24T02:00:45Z"
}
```

#### POST /jobs/:id/run

Runs a job manually.

**Query Parameters:**
- `skipSleep` (boolean, optional) — If true, strips a leading `sleep` from the command

**Response:**
```json
{
  "runId": "run_xyz789"
}
```

HTTP status: 202 Accepted

#### POST /jobs/:id/stop

Stops a job's run that is in progress.

**Response:**
```json
{
  "stopped": 1
}
```

### Runs

#### GET /jobs/:id/runs

Lists a job's run history.

**Query Parameters:**
- `limit` (number, default 20) — How many runs to return
- `offset` (number, default 0) — Pagination

**Response:**
```json
[
  {
    "id": "run_xyz789",
    "jobId": "a1b2c3d4e5f6g7h8",
    "startedAt": "2026-03-24T02:00:45Z",
    "finishedAt": "2026-03-24T02:05:47Z",
    "durationMs": 302000,
    "exitCode": 0,
    "stdout": "Backup started...\nBackup completed.\n",
    "stderr": "",
    "trigger": "scheduled",
    "status": "succeeded"
  }
]
```

#### GET /jobs/:id/runs/:runId

Gets the full details of a run, with logs.

**Response:**
```json
{
  "id": "run_xyz789",
  "jobId": "a1b2c3d4e5f6g7h8",
  "startedAt": "2026-03-24T02:00:45Z",
  "finishedAt": "2026-03-24T02:05:47Z",
  "durationMs": 302000,
  "exitCode": 0,
  "stdout": "Backup started...\nBackup completed.\n",
  "stderr": "",
  "trigger": "scheduled",
  "status": "succeeded"
}
```

#### GET /jobs/:id/runs/:runId/stream

A Server-Sent Events stream of live logs while the job is running.

**Response (SSE):**
```
event: output
data: {"stream":"stdout","data":"Backup started...\n"}

event: output
data: {"stream":"stdout","data":"Processing files...\n"}

event: output
data: {"stream":"stderr","data":"Warning: Low disk space\n"}

event: complete
data: {"exitCode":0,"status":"succeeded"}
```

### System

#### GET /system

System and CronPulse information.

**Response:**
```json
{
  "os": "linux",
  "uptime": 864000,
  "crontabPath": "crontab -l",
  "jobCount": 5,
  "version": "0.1.0",
  "isDocker": false
}
```

**Fields:**
- `os` — "linux", "darwin" (macOS), or "win32"
- `uptime` — Seconds since the system booted
- `crontabPath` — The path or command used to read crontabs
- `jobCount` — Number of detected jobs
- `version` — The CronPulse version
- `isDocker` — Whether it is running in Docker

#### POST /scan

Forces a rescan of crontabs/scheduled tasks.

**Response:**
```json
{
  "scanned": 5,
  "jobs": [...]
}
```

### Events

#### GET /events

A Server-Sent Events stream of global events (status changes, and so on).

**Response (SSE):**
```
event: job:status-change
data: {"jobId":"a1b2c3d4e5f6g7h8","status":"running"}

event: job:status-change
data: {"jobId":"a1b2c3d4e5f6g7h8","status":"succeeded"}

event: jobs:updated
data: {"jobCount":5}
```

**Event types:**
- `job:status-change` — A job's status changed
- `jobs:updated` — The number of jobs changed (after a scan)

## Architecture

CronPulse works in well-defined layers:

### Architecture Diagram

```
Terminal / Browser
        │
        ▼
    CLI (Node.js) ─── or ─── SPA (React)
        │                        │
        ▼                        ▼
    ┌─────────────────────┐
    │   Hono HTTP Server  │
    │  (localhost:7575)   │
    └─────────────────────┘
        │
        ├── /api/jobs       → DB Jobs
        ├── /api/runs       → DB Runs
        ├── /api/system     → System Info
        ├── /api/events     → SSE Broadcast
        └── /api/scan       → Scanner
        │
        ▼
    ┌──────────────────────────────────────┐
    │          Core (TypeScript)            │
    │                                       │
    │  ┌─ Detector ─────────────────────┐  │
    │  │ • detectOS()                   │  │
    │  │ • readCrontab() / readSchtasks │  │
    │  │ • isDocker()                   │  │
    │  └────────────────────────────────┘  │
    │                                       │
    │  ┌─ Parser ───────────────────────┐  │
    │  │ • getNextRunTime()             │  │
    │  │ • toHumanReadable()            │  │
    │  │ • generateJobId()              │  │
    │  └────────────────────────────────┘  │
    │                                       │
    │  ┌─ Executor ──────────────────────┐ │
    │  │ • executeJob()                 │ │
    │  │ • spawn child process          │ │
    │  │ • capture stdout/stderr        │ │
    │  │ • emit events                  │ │
    │  └────────────────────────────────┘ │
    │                                       │
    │  ┌─ Watcher ──────────────────────┐  │
    │  │ • Background interval loops    │  │
    │  │ • checkOverdueJobs()           │  │
    │  │ • scanCrontabIfChanged()       │  │
    │  └────────────────────────────────┘  │
    │                                       │
    │  ┌─ Scanner ──────────────────────┐  │
    │  │ • scanCrontab()                │  │
    │  │ • Parse cron entries           │  │
    │  │ • Upsert into DB               │  │
    │  └────────────────────────────────┘  │
    │                                       │
    │  ┌─ Syslog ───────────────────────┐  │
    │  │ • getRecentCronRuns()          │  │
    │  │ • journalctl / grep syslog     │  │
    │  │ • Windows Event Viewer         │  │
    │  └────────────────────────────────┘  │
    │                                       │
    │  ┌─ Events ───────────────────────┐  │
    │  │ • EventEmitter                 │  │
    │  │ • job:status-change            │  │
    │  │ • run:output / run:complete    │  │
    │  └────────────────────────────────┘  │
    └──────────────────────────────────────┘
        │
        ▼
    ┌──────────────────────┐
    │  SQLite (better-     │
    │  sqlite3)            │
    │                      │
    │  tables:             │
    │  • jobs              │
    │  • runs              │
    │  • settings          │
    └──────────────────────┘
        │
        ▼
    ~/.cronpulse/data.db
```

### Components

#### Detector (`src/core/detector.ts`)

Detects the OS and reads cron jobs:

- `detectOS()` → "linux" | "darwin" | "win32"
- `isDocker()` → boolean
- `readCrontab()` → an array of RawCronEntry
  - Linux/macOS: runs `crontab -l`, reads `/etc/cron.d/`
  - Windows: runs `schtasks /Query`
  - Docker: reads files in `/host-crontabs/`
- `parseCrontabOutput()` → extracts schedule, command, and name from crontab lines

#### Parser (`src/core/parser.ts`)

Processes cron expressions:

- `getNextRunTime(expression)` → Date | null
- `toHumanReadable(expression)` → string (for example, "Every day at 3:00 AM")
- `generateJobId(schedule, command)` → string (a truncated SHA256 hash)

Uses the `cron-parser` library to compute upcoming runs.

#### Executor (`src/core/executor.ts`)

Runs jobs as child processes:

- `executeJob(job, trigger, skipSleep)` → runId
  - Spawns a child process for the job's command
  - Captures stdout and stderr (at most 1MB per stream)
  - Emits output events in real time
  - Records the run in the database
  - Updates the job's status (succeeded/failed based on the exit code)
- `stopRun(runId)` → boolean (sends SIGTERM, then SIGKILL)
- `stopJobRuns(jobId)` → the number of processes stopped

#### Scanner (`src/core/scanner.ts`)

Continuous cron job detection:

- `scanCrontab()` → Reads every crontab, upserts into the DB, removes stale jobs
- `scanCrontabIfChanged()` → Scans only when something changed (an optimization)

#### Watcher (`src/core/watcher.ts`)

Background loops for monitoring:

- `startWatcher()` → starts 2 intervals:
  - Every 30 seconds: `scanCrontabIfChanged()`
  - Every 10 seconds: `checkOverdueJobs()`
- `checkOverdueJobs()` → checks jobs that should have run:
  - Looks for logs in journalctl / syslog / Event Viewer
  - If a run was found: marks it succeeded
  - If the time has passed with no run: marks it overdue

#### Syslog (`src/core/syslog.ts`)

Reading system logs:

- Linux: `journalctl -t CRON` or `/var/log/syslog` via grep
- macOS: journalctl parsing similar to Linux
- Windows: `Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-TaskScheduler/Operational'; ...}`
- `commandMatchesCronLog()` → fuzzy matching between the job's command and the command in the log

#### Database (`src/db/`)

SQLite with 3 tables:

- **jobs** → one per detected job
  - id (hash), name, schedule_expression, schedule_human, command, source
  - status, last_run_at, last_duration_ms, next_run_at
  - enabled, created_at, updated_at
- **runs** → run history
  - id, job_id, started_at, finished_at, duration_ms, exit_code
  - stdout, stderr, trigger_type, status
- **settings** → app configuration

Accessed via `getDb()`, with direct queries through `db.prepare()`.

### Overdue Job Detection Flow

1. The CLI starts → `scanCrontab()` detects every job and stores it in the DB
2. The watcher starts in the background
3. Every 30s: checks whether the crontabs changed
4. Every 10s: `checkOverdueJobs()`:
   - For each job: if `now > nextRunAt`
   - Look: did CronPulse record a run? (the runs table)
   - Look: did the system cron daemon run it? (journalctl/syslog/Event Viewer)
   - If found: status = "succeeded"
   - If not found: status = "overdue"

### Manual Execution Flow ("Run Now")

1. The frontend clicks the "Run Now" button
2. POST `/api/jobs/:id/run` returns a `runId`
3. `executeJob(job, "manual")`:
   - Creates a runs entry in the DB with status "running"
   - Spawns a child process for the command
   - Starts buffering stdout and stderr
   - Emits `run:output` events for each chunk
4. The child process exits:
   - Computes the duration and determines the status (exit code 0 → succeeded, otherwise → failed)
   - Updates the runs table
   - Updates the jobs table: lastRunAt, lastDurationMs, nextRunAt
   - Emits a `run:complete` event
   - Prunes old runs (keeping the last 50, configurable)
5. The frontend receives events via SSE or polling

## Configuration

### Environment Variables

Create a `.env` file at the project root or set environment variables:

```bash
# example .env
CRONPULSE_PORT=7575
CRONPULSE_DOCKER=false
CRONPULSE_CRONTAB_PATH=
CRONPULSE_DATA_DIR=/home/user/.cronpulse
CRONPULSE_LOG_RETENTION=50
CRONPULSE_HOST_EXEC=false
```

**Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `CRONPULSE_PORT` | `7575` | HTTP server port |
| `CRONPULSE_DOCKER` | auto-detected | Force Docker mode (true/false) |
| `CRONPULSE_CRONTAB_PATH` | auto-detected | Custom crontab path (for example, `/etc/crontab`) |
| `CRONPULSE_DATA_DIR` | `~/.cronpulse` | Directory for SQLite and data |
| `CRONPULSE_LOG_RETENTION` | `50` | How many runs to keep per job |
| `CRONPULSE_HOST_EXEC` | `false` | In Docker: allow execution on the host (requires a socket) |

### The .env.example File

```bash
CRONPULSE_PORT=7575
CRONPULSE_DOCKER=
CRONPULSE_CRONTAB_PATH=
CRONPULSE_DATA_DIR=
CRONPULSE_LOG_RETENTION=50
CRONPULSE_HOST_EXEC=false
```

## Development

### Setup

```bash
# Clone/open the repo
cd cronpulse

# Install the dependencies
pnpm install

# Install the frontend dependencies
cd frontend && pnpm install && cd ..
```

### Running in Development

```bash
# Backend + frontend with hot reload
pnpm dev
```

This opens two processes at once:
- Backend: TypeScript with tsx watch on localhost:7575
- Frontend: Vite dev server on localhost:5173 (proxying to the backend)

### Build

```bash
# Build the backend (TypeScript → JavaScript in dist/)
pnpm build:backend

# Build the frontend (React → a static bundle in dist/frontend/)
pnpm build:frontend

# Both
pnpm build
```

### Linting and Type Checking

```bash
# Lint with Biome
pnpm lint

# Automatic fixes
pnpm lint:fix

# Type check
pnpm typecheck
```

### Directory Structure

```
cronpulse/
├── .env.example           # Example variables
├── .gitignore
├── README.md              # This file
├── CLAUDE.md              # Full technical specification
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── biome.json
├── tsup.config.ts
├── Dockerfile
├── docker-compose.yml
├── cronpulse.service      # Systemd unit file (Linux)
│
├── src/
│   ├── cli.ts             # CLI entry point (commands: start, list, run)
│   ├── types/
│   │   └── index.ts       # Shared types (Job, Run, etc.)
│   ├── core/              # Core logic
│   │   ├── detector.ts    # OS detection, reading crontab/schtasks
│   │   ├── parser.ts      # Cron expression parsing
│   │   ├── executor.ts    # Running jobs as child processes
│   │   ├── watcher.ts     # Background monitoring loops
│   │   ├── scanner.ts     # Crontab scanning + DB upsert
│   │   ├── syslog.ts      # Reading system logs
│   │   ├── docker.ts      # Docker detection and crontab reading
│   │   └── events.ts      # EventEmitter for pub/sub
│   ├── db/                # SQLite data layer
│   │   ├── index.ts       # Connection, migrations
│   │   ├── jobs.ts        # Job queries
│   │   └── runs.ts        # Run queries
│   └── server/            # HTTP API (Hono)
│       ├── index.ts       # Server setup
│       ├── middleware/
│       │   └── cors.ts    # CORS middleware
│       └── routes/
│           ├── jobs.ts    # GET/POST /api/jobs
│           ├── runs.ts    # GET /api/jobs/:id/runs
│           ├── system.ts  # GET /api/system, POST /api/scan
│           └── events.ts  # GET /api/events (SSE)
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── components.json    # shadcn/ui config
│   ├── index.html
│   └── src/
│       ├── main.tsx       # React entry point
│       ├── App.tsx        # Main router
│       ├── pages/
│       │   ├── Dashboard.tsx     # Job listing
│       │   ├── JobDetail.tsx     # Detail + history
│       │   └── Settings.tsx      # Settings
│       ├── components/
│       │   ├── JobCard.tsx       # A job's card
│       │   ├── StatusBadge.tsx   # Colored status badge
│       │   ├── LogViewer.tsx     # Terminal with logs
│       │   ├── RunHistory.tsx    # Run table
│       │   ├── Countdown.tsx     # Countdown
│       │   ├── TimeAgo.tsx       # "X minutes ago"
│       │   └── ui/               # shadcn/ui components
│       ├── hooks/
│       │   ├── useJobs.ts        # Fetch jobs + auto-refresh
│       │   ├── useSSE.ts         # SSE hook
│       │   └── useTheme.ts       # Dark mode toggle
│       ├── lib/
│       │   ├── api.ts            # API functions
│       │   └── utils.ts          # Utilities (cn, etc.)
│       └── styles/
│           └── globals.css       # TailwindCSS v4 + overrides
│
└── dist/                  # Build output (gitignored)
    ├── cli.js
    └── frontend/
        └── index.html
```

## Troubleshooting

### Port Already in Use

**Error:** `listen EADDRINUSE :::7575`

**Fix:**

Linux/macOS:
```bash
# Find the PID using the port
lsof -i :7575

# Kill the process
kill -9 <PID>

# Or use a different port
cronpulse --port 3000
```

Windows:
```powershell
# Find the PID using the port
netstat -ano | findstr :7575

# Kill the process
taskkill /PID <PID> /F

# Or use a different port
cronpulse --port 3000
```

### CronPulse Doesn't Detect Cron Jobs

**Problem:** The dashboard shows "No cron jobs detected" but you do have crons.

**Causes and fixes:**

1. **Empty crontab, or no jobs**
   ```bash
   crontab -l
   ```
   If it is empty, add a job:
   ```bash
   (crontab -l 2>/dev/null; echo "*/5 * * * * /path/to/script.sh") | crontab -
   ```

2. **In Docker: the crontabs are not bind-mounted**
   Check `docker-compose.yml`:
   ```yaml
   volumes:
     - /var/spool/cron/crontabs:/host-crontabs:ro
   ```

3. **Insufficient permissions**
   ```bash
   # Linux/macOS: try with sudo
   sudo cronpulse
   ```

4. **Crontab in a custom location**
   ```bash
   cronpulse --no-open  # starts it
   # In another terminal:
   export CRONPULSE_CRONTAB_PATH=/custom/path/crontab
   ```

5. **Test the detection**
   ```bash
   cronpulse list
   ```
   It should show the jobs it found.

### A Job Always Shows "overdue"

**Problem:** A job has "overdue" status even though it ran.

**Causes and fixes:**

1. **The system cron doesn't record runs in syslog**

   Check whether syslog is enabled:
   ```bash
   # Linux: check whether CRON appears in the logs
   journalctl -t CRON | tail
   # or
   grep CRON /var/log/syslog | tail
   ```

   If it is empty, the cron daemon may not be logging. Configure syslog:
   ```bash
   # Edit /etc/rsyslog.d/50-default.conf
   # Uncomment or add:
   # cron.*      /var/log/cron.log
   ```

2. **System clock out of sync**
   ```bash
   # Check the time
   date

   # Sync with NTP
   sudo timedatectl set-ntp true
   ```

3. **The command differs between crontab and syslog**

   CronPulse matches commands fuzzily. If the crontab command is `backup.sh` but syslog records `/home/user/scripts/backup.sh`, it may not match.

4. **Force a re-scan in the dashboard**

   Click the [Scan] button to force re-detection.

### Job Logs Don't Appear in the Log Viewer

**Problem:** I click "Run Now" but the logs don't appear.

**Causes and fixes:**

1. **The frontend isn't connected to SSE**

   Check the browser console (F12):
   ```javascript
   // Test the SSE connection
   const sse = new EventSource('/api/jobs/JOB_ID/runs/RUN_ID/stream');
   sse.onmessage = (e) => console.log(e.data);
   sse.onerror = (e) => console.error('SSE error', e);
   ```

2. **The command produces no output**

   Test whether the command really produces output:
   ```bash
   /path/to/command
   ```

   If it is silent, add logging:
   ```bash
   echo "Started job" && /path/to/command && echo "Finished"
   ```

3. **CORS blocking the request**

   Check the browser console for a CORS error.
   CronPulse allows CORS for localhost, but if you have a reverse proxy, configure CORS on the proxy.

4. **Buffer limit reached**

   At most 1MB of output per stream (stdout/stderr). Beyond that, the output is truncated.
   Check the size:
   ```bash
   /path/to/command 2>&1 | wc -c
   ```

### A Job Runs Manually but Not on Schedule

**Problem:** "Run Now" works, but the system cron doesn't run it automatically.

**Causes and fixes:**

1. **The cron daemon isn't running**

   Linux:
   ```bash
   sudo service cron status
   # If stopped:
   sudo service cron start
   ```

   macOS:
   ```bash
   sudo launchctl list | grep cron
   # It should be listed with a PID
   ```

2. **The run time is in the past**

   If the crontab says `0 2 * * *` (2:00 AM) and you set it up at 15:00, it will not run until 2:00 AM tomorrow.

   To test, change it to a few minutes ahead:
   ```bash
   # Edit the crontab to run in 2 minutes
   crontab -e
   # Change "0 2 * * *" to "$(date +%M) $(date +%H) * * *" (the next minute)

   # Wait, then check whether it ran:
   cronpulse list
   ```

3. **Environment variables not set**

   Cron runs with a minimal environment. If your script needs a custom `$PATH`:
   ```bash
   # Add to the crontab:
   PATH=/usr/local/bin:/usr/bin:/bin
   SHELL=/bin/bash
   0 2 * * * cd /home/user && ./backup.sh
   ```

4. **Script file permissions**

   ```bash
   chmod +x /path/to/script.sh
   ```

5. **Syslog disabled or unreadable**

   CronPulse tries to detect runs via syslog/journalctl. If that is disabled:

   Linux (systemd):
   ```bash
   # Enable journalctl for CRON
   sudo journalctl -t CRON -n 10
   ```

### CronPulse Crashes on Startup

**Error:** `Error: ENOENT: no such file or directory, open '/home/user/.cronpulse/data.db'`

**Fix:**

The data directory was not created. CronPulse should create it automatically, but if that fails:

```bash
# Create it manually
mkdir -p ~/.cronpulse
chmod 700 ~/.cronpulse

# Or with a custom CRONPULSE_DATA_DIR:
mkdir -p /custom/path
export CRONPULSE_DATA_DIR=/custom/path
cronpulse
```

### Permission Denied Reading the Crontab

**Error:** `Error: Permission denied: running 'crontab -l'`

**Fix:**

On some systems, `crontab -l` requires privileges:

```bash
# Run with sudo
sudo cronpulse

# Or point at the path directly if you have permission:
export CRONPULSE_CRONTAB_PATH=/var/spool/cron/crontabs/your-user
cronpulse
```

### In Docker: Host Jobs Don't Appear

**Problem:** In Docker, CronPulse doesn't see the host's cron jobs.

**Causes and fixes:**

1. **The volumes aren't bind-mounted**

   Check `docker-compose.yml`:
   ```yaml
   volumes:
     - /var/spool/cron/crontabs:/host-crontabs:ro
     - /etc/cron.d:/host-cron.d:ro
   ```

2. **Crontabs in a different location**

   Some operating systems keep crontabs in `/var/at/tabs` (macOS) or elsewhere.

   Customize the mount:
   ```yaml
   volumes:
     - /your/crontab/location:/host-crontabs:ro
   ```

3. **Read permissions**

   The container needs read permission:
   ```bash
   ls -la /var/spool/cron/crontabs/
   # It must be readable by the container
   ```

### Rate Limiting or Abnormal Behavior in Production

**Problem:** Many jobs, a slow system, or high CPU.

**Optimizations:**

1. **Reduce the scan frequency**

   Modify `src/core/watcher.ts`:
   ```typescript
   // Increase the interval (default 30s)
   setInterval(() => scanCrontabIfChanged(), 60_000);
   ```

2. **Reduce log retention**

   ```bash
   export CRONPULSE_LOG_RETENTION=20  # Default: 50
   ```

3. **Filter out unnecessary jobs**

   If there are many system jobs (from `/etc/cron.d/`, for example), consider editing the detector to ignore certain files.

## Known Limitations

1. **Windows:** CronPulse detects `schtasks` but does not modify them (read-only). Editing scheduled tasks still requires the Windows GUI.

2. **macOS notarization:** If you distribute it as a standalone macOS app, you will need to notarize it with Apple.

3. **Docker:** Run Now executes **inside the container**, not on the host (unless you configure `CRONPULSE_HOST_EXEC=true` with a Docker socket mount).

4. **Output buffer:** At most 1MB of output (stdout + stderr combined). Commands that exceed it are truncated.

5. **Scheduling:** CronPulse detects when jobs should have run, but does not "force" execution. It is purely a monitor.

## Contributing

CronPulse is open source. To contribute:

1. Clone the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Make commits: `git commit -am 'Add feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

### Code Checklist

- [ ] Run `pnpm lint:fix` before committing
- [ ] Run `pnpm typecheck` — no TypeScript errors
- [ ] Test on Linux, macOS, and Windows if possible
- [ ] Include tests for new features
- [ ] Update the documentation if needed

## Support

Problems or questions? Open an issue on GitHub with:

- Your operating system and version
- Your Node.js version (`node --version`)
- Steps to reproduce the problem
- The output of `cronpulse --verbose`

## License

[Add a license here — for example, MIT]

## Credits

CronPulse is built with:

- **Hono** — A lightweight HTTP framework
- **React 19** — Declarative UI
- **Vite** — A fast build tool
- **TailwindCSS** — Utility-first CSS
- **shadcn/ui** — UI components
- **better-sqlite3** — Native SQLite for Node
- **cron-parser** — Cron expression parsing
