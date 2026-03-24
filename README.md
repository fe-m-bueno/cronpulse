# CronPulse

Um dashboard de monitoramento de cron jobs local-first. Um único binário / comando `npx` que inicia um servidor web local em `localhost:7575`. Zero configuração, sem internet, sem contas, sem telemetria.

## Sobre o CronPulse

CronPulse detecta automaticamente todos os cron jobs (no Linux e macOS) e scheduled tasks (no Windows), exibindo um dashboard limpo e moderno para monitorar:

- Status de execução em tempo real
- Histórico de execuções com duração e exit codes
- Logs de stdout/stderr com live streaming
- Agendamentos em formato legível
- Próxima execução com contagem regressiva
- Execução manual de jobs ("Run Now")

### Características Principais

- **Detecção Automática** — Lê `crontab -l` (Linux/macOS) ou `schtasks` (Windows)
- **Zero Config** — Rode o comando, abra o navegador, pronto
- **Local e Privado** — Sem telemetria, sem contas, sem internet necessária
- **Tempo Real** — Status atualizado em tempo real via Server-Sent Events (SSE)
- **Multiplataforma** — Linux, macOS e Windows com o mesmo codebase
- **Persistência** — SQLite para histórico e logs
- **Docker** — Suporte completo com auto-restart
- **Instalação como Serviço** — Systemd (Linux), launchd (macOS), Task Scheduler (Windows)

## Preview

[Imagens do dashboard virão aqui — grid de job cards, detalhes de job, visualizador de logs]

## Requisitos

- **Node.js** 20.0.0 ou superior
- **pnpm** 8.0.0 ou superior (gerenciador de pacotes)
- Sistema operacional: **Linux**, **macOS** ou **Windows**

### Instalação do Node.js e pnpm

**Linux e macOS:**
```bash
# Instalar Node.js (via nvm recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Instalar pnpm
npm install -g pnpm
```

**Windows:**
Baixe o instalador em https://nodejs.org (versão 20+) e instale. Depois:
```powershell
npm install -g pnpm
```

## Instalação e Build

### Opção 1: NPX (Recomendado para Uso)

```bash
npx cronpulse
```

O dashboard abrirá automaticamente em `http://localhost:7575`.

### Opção 2: Build Local (para Desenvolvimento)

```bash
# Clone ou acesse o repositório
cd cronpulse

# Instale as dependências
pnpm install

# Build
pnpm build

# Inicie
pnpm start
```

### Opção 3: Docker

```bash
docker compose up -d
```

Acesse `http://localhost:7575`.

## Como Usar

### Linha de Comando (CLI)

#### Iniciar o Dashboard

```bash
# Porto padrão (7575)
cronpulse

# Porto customizado
cronpulse --port 3000

# Com logs verbose
cronpulse --verbose

# Não abrir navegador automaticamente
cronpulse --no-open
```

#### Listar Cron Jobs

```bash
cronpulse list
```

Exibe uma tabela com todos os jobs detectados, status e próxima execução.

#### Executar um Job Manualmente

```bash
cronpulse run "job-name"
```

Executa um job específico pelo nome ou ID, mostrando logs em tempo real no terminal.

### Interface Web

Acesse `http://localhost:7575` no seu navegador.

#### Dashboard Principal

- **Grid de Jobs** — Cada card mostra nome, agendamento, status, próxima execução, última execução
- **Botão [Run Now]** — Executa o job manualmente
- **Toggle de Visualização** — Mude entre grid e lista
- **Botão [Scan]** — Força uma nova detecção de jobs
- **Resumo de Status** — Conta de jobs por status (running, succeeded, failed, overdue, idle)

#### Detalhe de Job

Clique em um job card para ver:

- Comando completo em um bloco de código
- Agendamento (expressão cron e formato legível)
- Status detalhado
- Histórico de execuções (tabela com timestamp, duração, exit code, trigger)

#### Visualizador de Logs

Clique em uma execução no histórico para ver:

- Saída stdout (branco)
- Saída stderr (vermelho)
- Auto-scroll com toggle para fixar no final
- Se o job estiver rodando: streaming em tempo real
- Botão para copiar logs completos
- Busca/filtro nos logs

#### Configurações

Página `/settings` para ajustar:

- Caminho da fonte de crontab (auto-detectado, pode ser alterado)
- Intervalo de refresh
- Retenção máxima de logs (padrão: 50 execuções por job)
- Porta do servidor

## Configuração como Serviço Permanente

### Linux (systemd)

Para rodar CronPulse automaticamente em background, use um user service.

#### 1. Build o Projeto

```bash
cd /caminho/para/cronpulse
pnpm install
pnpm build
```

#### 2. Crie o Arquivo de Serviço

Crie `~/.config/systemd/user/cronpulse.service`:

```ini
[Unit]
Description=CronPulse - Cron Job Monitoring Dashboard
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /caminho/para/cronpulse/dist/cli.js --no-open
WorkingDirectory=/caminho/para/cronpulse
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=CRONPULSE_PORT=7575

[Install]
WantedBy=default.target
```

**Substitua `/caminho/para/cronpulse` pelo path absoluto do seu repositório.**

Se estiver usando nvm, descubra o path do node:
```bash
which node
# /home/seu-usuario/.nvm/versions/node/v20.x.x/bin/node
```

Use esse path na linha `ExecStart`.

#### 3. Ative e Inicie o Serviço

```bash
# Recarregue o systemd
systemctl --user daemon-reload

# Ative para iniciar automaticamente no boot
systemctl --user enable cronpulse

# Inicie o serviço
systemctl --user start cronpulse

# Verifique o status
systemctl --user status cronpulse

# Veja os logs
journalctl --user -u cronpulse -f
```

#### 4. Verificação

```bash
# Deve retornar "active (running)"
systemctl --user status cronpulse

# Teste no navegador
curl http://localhost:7575/api/system
```

#### Comandos Úteis

```bash
# Reiniciar
systemctl --user restart cronpulse

# Parar
systemctl --user stop cronpulse

# Desabilitar auto-start
systemctl --user disable cronpulse

# Ver últimas linhas de log
journalctl --user -u cronpulse -n 50

# Logs em tempo real
journalctl --user -u cronpulse -f
```

### macOS (launchd)

macOS usa `launchd` em vez de systemd.

#### 1. Build o Projeto

```bash
cd /caminho/para/cronpulse
pnpm install
pnpm build
```

#### 2. Crie o Arquivo de Configuração

Crie `~/Library/LaunchAgents/com.cronpulse.plist`:

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
		<string>/caminho/para/cronpulse/dist/cli.js</string>
		<string>--no-open</string>
	</array>

	<key>WorkingDirectory</key>
	<string>/caminho/para/cronpulse</string>

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

**Substitua `/caminho/para/cronpulse` pelo path absoluto do seu repositório.**

Para encontrar o path de node:
```bash
which node
```

#### 3. Carregue o Agente

```bash
# Carregue o agente
launchctl load ~/Library/LaunchAgents/com.cronpulse.plist

# Verifique se está rodando
launchctl list | grep cronpulse

# Você deve ver algo como:
# - PID com números altos = rodando
# - PID -1 = erro ou não carregado
```

#### 4. Verificação

```bash
# Teste no navegador
curl http://localhost:7575/api/system

# Veja os logs
tail -f /tmp/cronpulse.log
tail -f /tmp/cronpulse.error.log
```

#### Comandos Úteis

```bash
# Descarregar (parar)
launchctl unload ~/Library/LaunchAgents/com.cronpulse.plist

# Recarregar
launchctl unload ~/Library/LaunchAgents/com.cronpulse.plist
launchctl load ~/Library/LaunchAgents/com.cronpulse.plist

# Listar processos launchd
launchctl list | grep cronpulse

# Remover permanentemente
rm ~/Library/LaunchAgents/com.cronpulse.plist
launchctl unload ~/Library/LaunchAgents/com.cronpulse.plist
```

### Windows (Task Scheduler ou NSSM)

Windows não tem cron nativo, mas CronPulse detecta `scheduled tasks`.

#### Opção A: Task Scheduler (Nativo)

A forma mais simples é usar o Task Scheduler do Windows para executar CronPulse na inicialização.

**1. Build o Projeto**

```powershell
cd C:\caminho\para\cronpulse
pnpm install
pnpm build
```

**2. Crie uma Scheduled Task**

Abra "Task Scheduler" (Windows):

1. Menu Iniciar → "Task Scheduler"
2. Clique em "Create Basic Task..."
3. Nome: `CronPulse`
4. Descrição: `CronPulse - Cron Job Monitoring Dashboard`
5. Trigger: "At log on" (ou "At startup" se preferir)
6. Action: "Start a program"
   - Program: `C:\Program Files\nodejs\node.exe` (ou o path do seu Node.js)
   - Arguments: `C:\caminho\para\cronpulse\dist\cli.js --no-open`
   - Start in: `C:\caminho\para\cronpulse`
7. Clique em "Finish"

**3. Configuração Adicional**

Clique com botão direito na task "CronPulse" → "Properties":

- Aba "General": Marque "Run whether user is logged in or not"
- Aba "General": Marque "Run with highest privileges" (se necessário)
- Aba "Triggers": Clique em "New..." para adicionar mais triggers se quiser

**4. Verificação**

```powershell
# Veja as tasks agendadas
tasklist | findstr node

# Teste no navegador
curl http://localhost:7575/api/system
```

#### Opção B: NSSM (Recomendado para Serviço Windows)

NSSM (Non-Sucking Service Manager) é mais robusto para rodar Node.js como serviço Windows.

**1. Baixe e Configure o NSSM**

```powershell
# Baixe NSSM de https://nssm.cc/download
# Extraia para C:\Program Files\nssm

# Abra PowerShell como Administrador
cd "C:\Program Files\nssm\win64"
```

**2. Instale o Serviço**

```powershell
.\nssm.exe install cronpulse C:\Program Files\nodejs\node.exe
```

Uma janela aparecerá. Configure:

- **Path:** (já preenchido com node.exe)
- **Startup directory:** `C:\caminho\para\cronpulse`
- **Arguments:** `C:\caminho\para\cronpulse\dist\cli.js --no-open`
- Aba "Details": Defina "Startup type" como "Automatic"
- Clique "Install service"

**3. Inicie o Serviço**

```powershell
# Inicie
net start cronpulse

# Ou via Services.msc:
# Abra Services → Procure por "cronpulse" → Start
```

**4. Verificação**

```powershell
# Verifique se está rodando
Get-Service -Name cronpulse

# Teste no navegador
curl http://localhost:7575/api/system
```

**5. Comandos Úteis**

```powershell
# Parar o serviço
net stop cronpulse

# Reiniciar
net stop cronpulse
net start cronpulse

# Remover o serviço (como admin)
C:\Program Files\nssm\win64\nssm.exe remove cronpulse confirm

# Ver logs
nssm.exe get cronpulse AppStdout
```

## Docker

CronPulse funciona perfeitamente dentro de um container Docker com auto-restart.

### Docker Compose (Recomendado)

```bash
docker compose up -d
```

Acesse `http://localhost:7575`.

**Parar:**
```bash
docker compose down
```

**Logs:**
```bash
docker compose logs -f cronpulse
```

### Arquivo docker-compose.yml

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

### Configuração do Docker

#### Volumes

- **`cronpulse-data`**: Armazena o banco de dados SQLite (`data.db`)
- **`/var/spool/cron/crontabs`** (Linux): Acesso read-only aos crontabs do host
- **`/etc/cron.d`**: Acesso read-only aos crons do sistema
- **`/var/at/tabs`** (macOS): Acesso read-only aos crontabs do macOS

#### Variáveis de Ambiente

```bash
# Arquivo .env
CRONPULSE_PORT=7575
CRONPULSE_LOG_RETENTION=50
```

#### Detecção de Docker

CronPulse detecta automaticamente que está rodando em Docker (checando `/.dockerenv`). Quando em Docker:

- Lê crontabs do host de `/host-crontabs/` (volumes bind-mount)
- Executa "Run Now" dentro do container (não no host)
- Ambiente `CRONPULSE_DOCKER=true` força o modo Docker

#### Healthcheck

O docker-compose inclui um healthcheck que testa `GET /api/system` a cada 30 segundos. Se falhar 3 vezes, o container é reiniciado.

### Docker: Build Manual

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

## Referência de API

CronPulse expõe uma API REST via Hono para integração com outros sistemas.

### Base URL

```
http://localhost:7575/api
```

### Autenticação

Nenhuma autenticação necessária (local-only).

### Jobs

#### GET /jobs

Lista todos os jobs detectados com status atual.

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

**Status valores:**
- `idle` — Agendado, próxima execução no futuro
- `running` — Executando neste momento
- `succeeded` — Última execução completou com exit code 0
- `failed` — Última execução completou com exit code != 0
- `overdue` — Próxima execução já passou, mas nenhuma execução foi registrada

#### GET /jobs/:id

Obtém detalhes de um job específico.

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

Executa um job manualmente.

**Query Parameters:**
- `skipSleep` (boolean, opcional) — Se true, remove `sleep` inicial do comando

**Response:**
```json
{
  "runId": "run_xyz789"
}
```

Status HTTP: 202 Accepted

#### POST /jobs/:id/stop

Para uma execução em progresso de um job.

**Response:**
```json
{
  "stopped": 1
}
```

### Execuções (Runs)

#### GET /jobs/:id/runs

Lista histórico de execuções de um job.

**Query Parameters:**
- `limit` (number, default 20) — Quantas execuções retornar
- `offset` (number, default 0) — Paginação

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

Obtém detalhes completos de uma execução com logs.

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

Server-Sent Events stream de logs em tempo real enquanto o job está rodando.

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

### Sistema

#### GET /system

Informações do sistema e CronPulse.

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

**Campos:**
- `os` — "linux", "darwin" (macOS), ou "win32"
- `uptime` — Segundos desde boot do sistema
- `crontabPath` — Caminho ou comando usado para ler crontabs
- `jobCount` — Número de jobs detectados
- `version` — Versão do CronPulse
- `isDocker` — Se está rodando em Docker

#### POST /scan

Força uma rescans de crontabs/scheduled tasks.

**Response:**
```json
{
  "scanned": 5,
  "jobs": [...]
}
```

### Eventos

#### GET /events

Server-Sent Events stream de eventos globais (status changes, etc).

**Response (SSE):**
```
event: job:status-change
data: {"jobId":"a1b2c3d4e5f6g7h8","status":"running"}

event: job:status-change
data: {"jobId":"a1b2c3d4e5f6g7h8","status":"succeeded"}

event: jobs:updated
data: {"jobCount":5}
```

**Tipos de eventos:**
- `job:status-change` — Status de um job mudou
- `jobs:updated` — Número de jobs mudou (após scan)

## Arquitetura

CronPulse funciona em camadas bem definidas:

### Diagrama de Arquitetura

```
Terminal / Navegador
        │
        ▼
    CLI (Node.js) ─── ou ─── SPA (React)
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

### Componentes

#### Detector (`src/core/detector.ts`)

Detecta o SO e lê cron jobs:

- `detectOS()` → "linux" | "darwin" | "win32"
- `isDocker()` → boolean
- `readCrontab()` → Array de RawCronEntry
  - Linux/macOS: executa `crontab -l`, lê `/etc/cron.d/`
  - Windows: executa `schtasks /Query`
  - Docker: lê arquivos em `/host-crontabs/`
- `parseCrontabOutput()` → extrai schedule, command, name de linhas crontab

#### Parser (`src/core/parser.ts`)

Processa expressões cron:

- `getNextRunTime(expression)` → Date | null
- `toHumanReadable(expression)` → string (ex: "Every day at 3:00 AM")
- `generateJobId(schedule, command)` → string (hash SHA256 truncado)

Usa a biblioteca `cron-parser` para calcular próximas execuções.

#### Executor (`src/core/executor.ts`)

Executa jobs como child processes:

- `executeJob(job, trigger, skipSleep)` → runId
  - Spawna um processo child do comando do job
  - Captura stdout e stderr (máximo 1MB por stream)
  - Emite eventos de output em tempo real
  - Registra no banco de dados
  - Atualiza status do job (succeeded/failed baseado no exit code)
- `stopRun(runId)` → boolean (envia SIGTERM, depois SIGKILL)
- `stopJobRuns(jobId)` → número de processos parados

#### Scanner (`src/core/scanner.ts`)

Detecção contínua de cron jobs:

- `scanCrontab()` → Lê todos os crontabs, faz upsert no DB, remove jobs obsoletos
- `scanCrontabIfChanged()` → Scans apenas se houver mudança (otimização)

#### Watcher (`src/core/watcher.ts`)

Loops em background para monitoramento:

- `startWatcher()` → inicia 2 intervalos:
  - A cada 30 segundos: `scanCrontabIfChanged()`
  - A cada 10 segundos: `checkOverdueJobs()`
- `checkOverdueJobs()` → verifica jobs que deveriam ter rodado:
  - Busca logs em journalctl / syslog / Event Viewer
  - Se encontrou execução: marca como succeeded
  - Se passou da hora e sem execução: marca como overdue

#### Syslog (`src/core/syslog.ts`)

Leitura de logs do sistema:

- Linux: `journalctl -t CRON` ou `/var/log/syslog` via grep
- macOS: parse do journalctl similar ao Linux
- Windows: `Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-TaskScheduler/Operational'; ...}`
- `commandMatchesCronLog()` → match fuzzy entre comando do job e comando no log

#### Database (`src/db/`)

SQLite com 3 tabelas:

- **jobs** → um por job detectado
  - id (hash), name, schedule_expression, schedule_human, command, source
  - status, last_run_at, last_duration_ms, next_run_at
  - enabled, created_at, updated_at
- **runs** → histórico de execuções
  - id, job_id, started_at, finished_at, duration_ms, exit_code
  - stdout, stderr, trigger_type, status
- **settings** → configurações do app

Acesso via `getDb()`, operações query diretas com `db.prepare()`.

### Fluxo de Detecção de Job Overdue

1. CLI inicia → `scanCrontab()` detecta todos os jobs e armazena no DB
2. Watcher inicia em background
3. A cada 30s: verifica se houve mudanças nos crontabs
4. A cada 10s: `checkOverdueJobs()`:
   - Para cada job: se `now > nextRunAt`
   - Busca: CronPulse registrou execução? (tabela runs)
   - Busca: Sistema cron daemon executou? (journalctl/syslog/Event Viewer)
   - Se encontrou: status = "succeeded"
   - Se não encontrou: status = "overdue"

### Fluxo de Execução Manual ("Run Now")

1. Frontend clica botão "Run Now"
2. POST `/api/jobs/:id/run` retorna `runId`
3. `executeJob(job, "manual")`:
   - Cria entrada em DB runs com status "running"
   - Spawna child process do comando
   - Inicia buffering de stdout e stderr
   - Emite eventos `run:output` para cada chunk
4. Child process encerra:
   - Calcula duration e determina status (exit code 0 → succeeded, else → failed)
   - Atualiza DB runs
   - Atualiza DB jobs: lastRunAt, lastDurationMs, nextRunAt
   - Emite evento `run:complete`
   - Prune de runs antigos (keep últimas 50, configurável)
5. Frontend recebe eventos via SSE ou polling

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto ou defina variáveis de ambiente:

```bash
# .env exemplo
CRONPULSE_PORT=7575
CRONPULSE_DOCKER=false
CRONPULSE_CRONTAB_PATH=
CRONPULSE_DATA_DIR=/home/user/.cronpulse
CRONPULSE_LOG_RETENTION=50
CRONPULSE_HOST_EXEC=false
```

**Variáveis:**

| Variável | Default | Descrição |
|----------|---------|-----------|
| `CRONPULSE_PORT` | `7575` | Porta do servidor HTTP |
| `CRONPULSE_DOCKER` | auto-detectado | Force modo Docker (true/false) |
| `CRONPULSE_CRONTAB_PATH` | auto-detectado | Caminho customizado para crontab (ex: `/etc/crontab`) |
| `CRONPULSE_DATA_DIR` | `~/.cronpulse` | Diretório para SQLite e dados |
| `CRONPULSE_LOG_RETENTION` | `50` | Quantas execuções guardar por job |
| `CRONPULSE_HOST_EXEC` | `false` | Em Docker: permitir execução no host (requer socket) |

### Arquivo .env.example

```bash
CRONPULSE_PORT=7575
CRONPULSE_DOCKER=
CRONPULSE_CRONTAB_PATH=
CRONPULSE_DATA_DIR=
CRONPULSE_LOG_RETENTION=50
CRONPULSE_HOST_EXEC=false
```

## Desenvolvimento

### Setup

```bash
# Clonar/acessar repo
cd cronpulse

# Instalar dependências
pnpm install

# Instalar dependências do frontend
cd frontend && pnpm install && cd ..
```

### Rodando em Desenvolvimento

```bash
# Backend + Frontend com hot reload
pnpm dev
```

Abre dois processos simultâneos:
- Backend: TypeScript com tsx watch em localhost:7575
- Frontend: Vite dev server em localhost:5173 (proxy para backend)

### Build

```bash
# Build backend (TypeScript → JavaScript em dist/)
pnpm build:backend

# Build frontend (React → bundle estático em dist/frontend/)
pnpm build:frontend

# Ambos
pnpm build
```

### Linting e Type Check

```bash
# Lint com Biome
pnpm lint

# Fix automático
pnpm lint:fix

# Type check
pnpm typecheck
```

### Estrutura de Diretórios

```
cronpulse/
├── .env.example           # Exemplo de variáveis
├── .gitignore
├── README.md              # Este arquivo
├── CLAUDE.md              # Especificação técnica completa
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
│   ├── cli.ts             # Entrada CLI (commands: start, list, run)
│   ├── types/
│   │   └── index.ts       # Types compartilhados (Job, Run, etc)
│   ├── core/              # Lógica principal
│   │   ├── detector.ts    # Detecção de OS, leitura crontab/schtasks
│   │   ├── parser.ts      # Parse de expressões cron
│   │   ├── executor.ts    # Execução de jobs como child process
│   │   ├── watcher.ts     # Loops de background para monitoramento
│   │   ├── scanner.ts     # Scan de crontabs + upsert DB
│   │   ├── syslog.ts      # Leitura de logs do sistema
│   │   ├── docker.ts      # Detecção Docker e read de crontabs
│   │   └── events.ts      # EventEmitter para pub/sub
│   ├── db/                # Camada de dados SQLite
│   │   ├── index.ts       # Conexão, migrations
│   │   ├── jobs.ts        # Queries de jobs
│   │   └── runs.ts        # Queries de execuções
│   └── server/            # API HTTP (Hono)
│       ├── index.ts       # Setup do servidor
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
│       ├── main.tsx       # Entry point React
│       ├── App.tsx        # Router principal
│       ├── pages/
│       │   ├── Dashboard.tsx     # Listagem de jobs
│       │   ├── JobDetail.tsx     # Detalhe + histórico
│       │   └── Settings.tsx      # Configurações
│       ├── components/
│       │   ├── JobCard.tsx       # Card de um job
│       │   ├── StatusBadge.tsx   # Status badge colorido
│       │   ├── LogViewer.tsx     # Terminal com logs
│       │   ├── RunHistory.tsx    # Tabela de execuções
│       │   ├── Countdown.tsx     # Contagem regressiva
│       │   ├── TimeAgo.tsx       # "há X minutos"
│       │   └── ui/               # shadcn/ui components
│       ├── hooks/
│       │   ├── useJobs.ts        # Fetch jobs + auto-refresh
│       │   ├── useSSE.ts         # Hook para SSE
│       │   └── useTheme.ts       # Dark mode toggle
│       ├── lib/
│       │   ├── api.ts            # Funções de API
│       │   └── utils.ts          # Utilitários (cn, etc)
│       └── styles/
│           └── globals.css       # TailwindCSS v4 + overrides
│
└── dist/                  # Build output (gitignored)
    ├── cli.js
    └── frontend/
        └── index.html
```

## Troubleshooting

### Porta já está em uso

**Erro:** `listen EADDRINUSE :::7575`

**Solução:**

Linux/macOS:
```bash
# Encontre o PID usando a porta
lsof -i :7575

# Mate o processo
kill -9 <PID>

# Ou use uma porta diferente
cronpulse --port 3000
```

Windows:
```powershell
# Encontre o PID usando a porta
netstat -ano | findstr :7575

# Mate o processo
taskkill /PID <PID> /F

# Ou use uma porta diferente
cronpulse --port 3000
```

### CronPulse não detecta cron jobs

**Problema:** Dashboard mostra "No cron jobs detected" mas você tem crons.

**Causas e soluções:**

1. **Crontab vazio ou sem jobs**
   ```bash
   crontab -l
   ```
   Se vazio, adicione um job:
   ```bash
   (crontab -l 2>/dev/null; echo "*/5 * * * * /path/to/script.sh") | crontab -
   ```

2. **Em Docker: crontabs não estão bind-mounted**
   Verifique `docker-compose.yml`:
   ```yaml
   volumes:
     - /var/spool/cron/crontabs:/host-crontabs:ro
   ```

3. **Permissões insuficientes**
   ```bash
   # Linux/macOS: tente com sudo
   sudo cronpulse
   ```

4. **Crontab em local customizado**
   ```bash
   cronpulse --no-open  # inicia
   # Em outro terminal:
   export CRONPULSE_CRONTAB_PATH=/caminho/customizado/crontab
   ```

5. **Teste a detecção**
   ```bash
   cronpulse list
   ```
   Deve mostrar jobs encontrados.

### Job sempre mostra status "overdue"

**Problema:** Job tem status "overdue" mesmo que tenha rodado.

**Causas e soluções:**

1. **Sistema cron não registra execução em syslog**

   Verifique se syslog está habilitado:
   ```bash
   # Linux: verifique se CRON está nos logs
   journalctl -t CRON | tail
   # ou
   grep CRON /var/log/syslog | tail
   ```

   Se vazio, o daemon cron pode não estar logando. Configure syslog:
   ```bash
   # Edite /etc/rsyslog.d/50-default.conf
   # Descomente ou adicione:
   # cron.*      /var/log/cron.log
   ```

2. **Horário do sistema dessincronizado**
   ```bash
   # Verifique a hora
   date

   # Sincronize com NTP
   sudo timedatectl set-ntp true
   ```

3. **Comando é diferente entre crontab e syslog**

   CronPulse faz matching fuzzy do comando. Se o comando no crontab é `backup.sh` mas o syslog registra `/home/user/scripts/backup.sh`, pode não dar match.

4. **Force um re-scan no dashboard**

   Clique no botão [Scan] para forçar re-detecção.

### Logs de job não aparecem no log viewer

**Problema:** Clico em "Run Now", mas os logs não aparecem.

**Causas e soluções:**

1. **Frontend não está conectado ao SSE**

   Verifique no console do navegador (F12):
   ```javascript
   // Teste a conexão SSE
   const sse = new EventSource('/api/jobs/JOB_ID/runs/RUN_ID/stream');
   sse.onmessage = (e) => console.log(e.data);
   sse.onerror = (e) => console.error('SSE error', e);
   ```

2. **Comando não produz output**

   Teste se o comando realmente produz saída:
   ```bash
   /caminho/do/comando
   ```

   Se silencioso, adicione logging:
   ```bash
   echo "Started job" && /caminho/do/comando && echo "Finished"
   ```

3. **CORS bloqueando requisição**

   Verifique no console do navegador se há erro de CORS.
   CronPulse permite CORS para localhost, mas se tiver proxy reverso, configure CORS no proxy.

4. **Buffer limite atingido**

   Máximo 1MB de saída por stream (stdout/stderr). Se exceder, saída é truncada.
   Verifique o tamanho:
   ```bash
   /caminho/do/comando 2>&1 | wc -c
   ```

### Job roda manualmente mas não roda agendado

**Problema:** "Run Now" funciona, mas o sistema cron não roda automaticamente.

**Causas e soluções:**

1. **Cron daemon não está rodando**

   Linux:
   ```bash
   sudo service cron status
   # Se stopped:
   sudo service cron start
   ```

   macOS:
   ```bash
   sudo launchctl list | grep cron
   # Deve listar com PID
   ```

2. **Hora de execução no passado**

   Se o crontab tem `0 2 * * *` (2:00 AM) e você configurou em 15:00, nunca rodará até amanhã às 2:00 AM.

   Para testar, mude para poucos minutos à frente:
   ```bash
   # Edite crontab para rodar em 2 minutos
   crontab -e
   # Mude "0 2 * * *" para "$(date +%M) $(date +%H) * * *" (próximo minuto)

   # Aguarde e verifique se rodou:
   cronpulse list
   ```

3. **Variáveis de ambiente não definidas**

   Cron roda com ambiente mínimo. Se seu script precisa de `$PATH` customizado:
   ```bash
   # Adicione ao crontab:
   PATH=/usr/local/bin:/usr/bin:/bin
   SHELL=/bin/bash
   0 2 * * * cd /home/user && ./backup.sh
   ```

4. **Permissões do arquivo de script**

   ```bash
   chmod +x /caminho/do/script.sh
   ```

5. **Syslog desabilitado ou sem permissão de leitura**

   CronPulse tenta detectar execução via syslog/journalctl. Se desabilitado:

   Linux (systemd):
   ```bash
   # Habilite journalctl para CRON
   sudo journalctl -t CRON -n 10
   ```

### CronPulse crash ao iniciar

**Erro:** `Error: ENOENT: no such file or directory, open '/home/user/.cronpulse/data.db'`

**Solução:**

O diretório de dados não foi criado. CronPulse deve criar automaticamente, mas se falhar:

```bash
# Crie manualmente
mkdir -p ~/.cronpulse
chmod 700 ~/.cronpulse

# Ou com CRONPULSE_DATA_DIR customizado:
mkdir -p /caminho/customizado
export CRONPULSE_DATA_DIR=/caminho/customizado
cronpulse
```

### Permissão negada ao ler crontab

**Erro:** `Error: Permission denied: running 'crontab -l'`

**Solução:**

Em alguns sistemas, `crontab -l` requer privilégios:

```bash
# Rode com sudo
sudo cronpulse

# Ou configure o caminho direto se tiver permissão:
export CRONPULSE_CRONTAB_PATH=/var/spool/cron/crontabs/seu-usuario
cronpulse
```

### Em Docker: jobs do host não aparecem

**Problema:** Em Docker, CronPulse não vê os cron jobs do host.

**Causas e soluções:**

1. **Volumes não estão bind-mounted**

   Verifique `docker-compose.yml`:
   ```yaml
   volumes:
     - /var/spool/cron/crontabs:/host-crontabs:ro
     - /etc/cron.d:/host-cron.d:ro
   ```

2. **Crontabs em local diferente**

   Alguns SOs guardam crontabs em `/var/at/tabs` (macOS) ou outro lugar.

   Customize o mount:
   ```yaml
   volumes:
     - /seu/local/crontab:/host-crontabs:ro
   ```

3. **Permissões de leitura**

   O container precisa permissão de leitura:
   ```bash
   ls -la /var/spool/cron/crontabs/
   # Deve ser readable pelo container
   ```

### Rate limit ou comportamento anormal em produção

**Problema:** Muitos jobs, sistema lento ou CPU alta.

**Otimizações:**

1. **Reduzir frequência de scan**

   Modifique `src/core/watcher.ts`:
   ```typescript
   // Aumente intervalo (default 30s)
   setInterval(() => scanCrontabIfChanged(), 60_000);
   ```

2. **Reduzir retenção de logs**

   ```bash
   export CRONPULSE_LOG_RETENTION=20  # Padrão: 50
   ```

3. **Filtrar jobs desnecessários**

   Se muitos jobs sistem (ex: `/etc/cron.d/`), considere editar o detector para ignorar certos arquivos.

## Limitações Conhecidas

1. **Windows:** CronPulse detecta `schtasks` mas não modifica (read-only). Editar scheduled tasks ainda requer GUI do Windows.

2. **macOS Notarization:** Se distribuir como app macOS standalone, será necessário notarizar com Apple.

3. **Docker:** Run Now executa **dentro do container**, não no host (a menos que configure `CRONPULSE_HOST_EXEC=true` com Docker socket mount).

4. **Buffer de Output:** Máximo 1MB de saída (stdout + stderr combinado). Comandos que excedem são truncados.

5. **Scheduling:** CronPulse detecta quando jobs deveriam ter rodado, mas não "força" execução. É puramente um monitor.

## Contribuindo

CronPulse é open source! Para contribuir:

1. Clone o repositório
2. Crie uma branch: `git checkout -b feature/sua-feature`
3. Faça commits: `git commit -am 'Add feature'`
4. Push: `git push origin feature/sua-feature`
5. Abra um Pull Request

### Checklist de Código

- [ ] Rodar `pnpm lint:fix` antes de commitar
- [ ] Rodar `pnpm typecheck` — sem erros TypeScript
- [ ] Testar em Linux, macOS e Windows se possível
- [ ] Incluir testes para novas features
- [ ] Atualizar documentação se necessário

## Suporte

Problemas ou dúvidas? Abra uma issue no GitHub com:

- Sistema operacional e versão
- Versão do Node.js (`node --version`)
- Passos para reproduzir o problema
- Saída de `cronpulse --verbose`

## Licença

[Adicione licença aqui — ex: MIT]

## Créditos

CronPulse foi construído com:

- **Hono** — Framework HTTP ligero
- **React 19** — UI declarativa
- **Vite** — Build tool rápido
- **TailwindCSS** — Utility-first CSS
- **shadcn/ui** — Componentes UI
- **better-sqlite3** — SQLite nativo para Node
- **cron-parser** — Parse de expressões cron
