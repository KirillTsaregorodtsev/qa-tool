# QA Web App

Local web UI for Gcore cloud QA workflows. FastAPI backend + React/Vite frontend,
localhost-only.

---

## Prerequisites

- Docker + Docker Compose (tested with Compose v2 / `docker compose`) — the
  Docker path needs nothing else installed.
- For local dev without Docker only: Python 3.12+ (backend), Node 20+ (frontend).
- A Gcore API token (`CLOUD_API_KEY`) — needed for the Regions / Quotas / Runs screens.
- A Gcore SSH key registered under `ssh_key_name` (default `qa-ssh-keyname-example`)
  — needed only for actual baremetal runs, not to browse the UI.

---

## First-time setup

Run all commands from the repository root.

### 1. Create runtime directories

```bash
mkdir -p volume/config volume/reports volume/cache
```

### 2. Copy the settings template

```bash
cp volume/config/settings.example.json volume/config/settings.json
```

Edit `volume/config/settings.json` to set your `project_id`, `ssh_key_name`, etc.
**Do not put API keys or SSH private-key text in this file.**

### 3. Create the secrets env-file

```bash
printf 'CLOUD_API_KEY=replace-with-your-gcore-token\n' > volume/config/app.env
```

Replace `replace-with-your-gcore-token` with your actual token.
This file is in `.gitignore`; never commit it.

### 4. Add the SSH private key

Baremetal runs (New Run screen) need an SSH private key. Copy your key into the
config dir under the name `ssh_key`:

```bash
cp /path/to/your/private_key volume/config/ssh_key
chmod 600 volume/config/ssh_key
```

The command above already puts the key at the expected location with the
expected name — the original key is not renamed or modified; a copy is saved as
`volume/config/ssh_key`.

Notes:
- Use the **private** key (the file *without* `.pub`), unencrypted (no passphrase).
- It must match the Gcore SSH key registered under `ssh_key_name` (default `qa-ssh-keyname-example`).
- Advanced: to load the key from a different path, set `SSH_KEY_PATH` (see Environment variables).
- Not needed to just start the UI / browse Regions & Quotas — only for actual runs.

---

## Running with Docker Compose (recommended)

Requires `volume/config/app.env` with `CLOUD_API_KEY` set.

```bash
docker compose --env-file volume/config/app.env up --build
```

The first run builds the image (frontend + backend, ~1–2 min).
For later starts, use `up` — it reuses the existing image without rebuilding.
If the source code, dependencies, or `Dockerfile` changed, run `up --build`
again to pick up the changes:

```bash
docker compose --env-file volume/config/app.env up
```

Open the UI at `http://127.0.0.1:8080/`

Stop:

```bash
# Ctrl-C in the foreground terminal, or in another terminal:
docker compose --env-file volume/config/app.env down
```

Pass `--env-file` on `down` too — Compose interpolates the config (including the
required `CLOUD_API_KEY`) on every command, and omitting it can fail the same way.

Custom port (default 8080):

```bash
QA_WEB_APP_PORT=9090 docker compose --env-file volume/config/app.env up
```

---

## Running with Podman

Podman is a rootless Docker-compatible runtime. Commands mirror Docker closely;
the main difference is that `podman compose` requires either Podman v4.7+ (built-in)
or the separate `podman-compose` package.

### Option A — podman compose (recommended if available)

```bash
# Podman v4.7+ built-in compose:
podman compose --env-file volume/config/app.env up --build

# Or with the standalone podman-compose tool:
podman-compose --env-file volume/config/app.env up --build
```

The `docker-compose.yml` in this repo is compatible with both.

Stop:

```bash
podman compose --env-file volume/config/app.env down
# or
podman-compose --env-file volume/config/app.env down
```

### Option B — podman build + podman run

Build the image:

```bash
podman build -t qa-web-app .
```

Run with a localhost-only port bind and mounted volume:

```bash
podman run --rm \
  --name qa-web-app \
  --env-file volume/config/app.env \
  -e CONFIG_DIR=/app/volume/config \
  -e REPORTS_DIR=/app/volume/reports \
  -e SSH_KEY_PATH=/app/volume/config/ssh_key \
  -v "$PWD/volume:/app/volume:z" \
  -p 127.0.0.1:8080:8080 \
  qa-web-app
```

For a custom host port, change the left side of `-p`, e.g. `-p 127.0.0.1:9090:8080`.

Note the `:z` flag on the volume mount — required on SELinux-enabled systems (Fedora, RHEL, etc.)
to relabel the volume so the container can access it. Omit on macOS or non-SELinux Linux.

Open the UI at `http://127.0.0.1:8080/`

Stop:

```bash
podman stop qa-web-app
```

### Podman notes

- Podman runs rootless by default — no `sudo` needed.
- If volume contents are not readable inside the container, add `:z` (shared relabel)
  or `:Z` (private relabel) to the `-v` flag.
- On macOS, Podman requires a VM (`podman machine`). Start it once before use:
  ```bash
  podman machine init
  podman machine start
  ```
- `CLOUD_API_KEY` rules are identical to Docker: set it in `volume/config/app.env`
  and pass `--env-file volume/config/app.env`.

---

## Running without Docker (local dev / smoke)

### 1. Install backend dependencies

```bash
python -m pip install -r requirements.txt
```

(Use a virtualenv if you prefer: `python -m venv .venv && source .venv/bin/activate`.)

### 2. Point the runtime paths at the local `volume/`

The path defaults are container paths (`/app/volume/...`); the backend does not
auto-detect a local layout. For local dev, override them to the repo's `volume/`
dir (run from the repo root):

```bash
export CONFIG_DIR="$PWD/volume/config"
export REPORTS_DIR="$PWD/volume/reports"
export SSH_KEY_PATH="$PWD/volume/config/ssh_key"
```

### 3. Start the backend

Without `CLOUD_API_KEY` the app starts and serves the UI.
`/api/health` returns `{"status":"ok","api_key_configured":false}`.
Gcore-backed endpoints (regions, quotas, runs) fail until a key is provided.

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8080 --reload
```

With a key — load it from `app.env` rather than typing it on the command line
(a plain `CLOUD_API_KEY=... uvicorn` leaves the token in your shell history):

```bash
set -a; . volume/config/app.env; set +a   # exports CLOUD_API_KEY from the file
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8080 --reload
```

### Frontend dev server (hot-reload)

Requires the backend running separately on port 8080.

```bash
cd frontend
npm ci        # first time only — reproducible install from package-lock.json
npm run dev   # starts on http://localhost:5173
```

### Build frontend for production

```bash
cd frontend
npm run build   # output: frontend/dist/
```

---

## Health check

```bash
curl http://127.0.0.1:8080/api/health
# With key:    {"status":"ok","api_key_configured":true}
# Without key: {"status":"ok","api_key_configured":false}
```

---

## Common errors

### `required variable CLOUD_API_KEY is missing a value`

```
error while interpolating services.qa-web-app.environment.CLOUD_API_KEY:
required variable CLOUD_API_KEY is missing a value
```

`docker compose` requires the key at startup time.
Fix: create `volume/config/app.env` and pass it:

```bash
echo "CLOUD_API_KEY=your-token" > volume/config/app.env
docker compose --env-file volume/config/app.env up
```

### Port already in use

```
Error: bind: address already in use 127.0.0.1:8080
```

Find what's listening, check it's yours, then stop it:

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN   # shows the PID and command
kill <PID>                         # kill the PID you identified
```

Or change the port:

```bash
QA_WEB_APP_PORT=9090 docker compose --env-file volume/config/app.env up
```

### Frontend not built (backend returns JSON at `/`)

```json
{"message": "Frontend not built. Run: cd frontend && npm run build"}
```

Build the frontend:

```bash
cd frontend && npm run build
```

Or use `docker compose up --build` to rebuild the image.

### UI loads but data screens fail or are empty

Check the health endpoint and verify your API key is configured:

```bash
curl http://127.0.0.1:8080/api/health
```

If `api_key_configured` is `false`, confirm `CLOUD_API_KEY` is in `app.env`
and that you passed `--env-file volume/config/app.env` to `docker compose`.

---

## Volume layout

```
volume/
  config/
    app.env                  # Docker secrets env-file — gitignored, never commit
    settings.json            # Runtime config — gitignored, never commit
    settings.example.json    # Safe template — committed
    ssh_key                  # SSH private key for BM servers — gitignored, never commit
  reports/                   # CSV reports written after completed runs — gitignored
  cache/                     # Reserved for future use
```

Container paths:
- `CONFIG_DIR=/app/volume/config`
- `REPORTS_DIR=/app/volume/reports`
- `SSH_KEY_PATH=/app/volume/config/ssh_key`

---

## What must NOT be committed from volume/config

| File | Why |
|------|-----|
| `app.env` | Contains `CLOUD_API_KEY` |
| `settings.json` | Environment-specific config (and potentially sensitive internal paths) — not a shared default |
| `ssh_key` | SSH private key for baremetal servers |

All three are in `.gitignore`. Run `git status` before committing to verify.

---

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `CLOUD_API_KEY` | Gcore API token — required for Gcore calls | — |
| `PROD_API_KEY` | Fallback name for the API token | — |
| `CONFIG_DIR` | Path to `settings.json` dir | `/app/volume/config` |
| `REPORTS_DIR` | Reports output dir | `/app/volume/reports` |
| `SSH_KEY_PATH` | SSH private key path | `/app/volume/config/ssh_key` |
| `MAX_WORKERS` | Thread-pool workers | `5` |
| `CLIENT_ID` | Gcore client ID | `130485` |
| `PROJECT_ID` | Gcore project ID | `309102` |
| `PROJECT_NAME` | Display name (optional) | — |
| `SSH_KEY_NAME` | Gcore SSH key name for BM create | `qa-ssh-keyname-example` |
| `IMAGE_NAME` | Baremetal image | `ubuntu-26.04-x64-ironic` |
| `BASE_URL` | Gcore API base URL | `https://api.gcore.com` |

Merge order: hardcoded defaults → `settings.json` → env vars.
API key is env-only.

---

## Safe-use boundaries

- **Bind to localhost.** The container exposes port 8080 bound to `127.0.0.1` on the host.
  Do not expose it publicly.
- **No auth in v1.** Anyone with access to the UI can trigger backend actions.
- **No DB in v1.** Run state is in-memory and is lost on restart.
  Completed reports persist under `volume/reports/`.
- **Secrets stay out of git and UI.**
  Never paste `CLOUD_API_KEY`, SSH private key, or any token into `settings.json`
  or screenshot the Settings screen with live tokens visible.
- **Live provisioning requires approval.**
  Do not click **Start** in the New Run screen against a real API key unless
  the action, region, flavor, image, SSH key name, and cleanup plan are approved.

---

## Quick dev checks

```bash
# Backend tests
python -m pytest -q

# Frontend build
cd frontend && npm run build

# Verify no yarn/pnpm lockfiles
test ! -f yarn.lock && test ! -f pnpm-lock.yaml && echo "ok"
```
