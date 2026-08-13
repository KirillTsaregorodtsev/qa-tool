# QA Web App

Local web UI for Gcore cloud QA workflows. FastAPI backend + React/Vite frontend,
localhost-only, no auth required.

---

## Prerequisites

- Docker + Docker Compose (tested with Compose v2 / `docker compose`)
- For local dev without Docker: Python 3.12+, Node 20+
- A Gcore API token (`CLOUD_API_KEY`)

---

## First-time setup

### 1. Create runtime directories

```bash
cd qa-web-app
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
# volume/config/app.env is gitignored — safe to store secrets here
printf 'CLOUD_API_KEY=replace-with-your-gcore-token\n' > volume/config/app.env
```

Replace `replace-with-your-gcore-token` with your actual token.
This file is in `.gitignore`; never commit it.

### 4. Add the SSH private key

Baremetal runs (New Run screen) need an SSH private key. Place it at:

```
volume/config/ssh_key
```

The file **must be named exactly `ssh_key`** — no extension (not `ssh_key.pem`,
not `id_rsa`). This is the default `SSH_KEY_PATH`. If your key file has a
different name, either rename it:

```bash
cp /path/to/your/private_key volume/config/ssh_key
chmod 600 volume/config/ssh_key
```

…or keep the name and point `SSH_KEY_PATH` at it (see Environment variables).

Notes:
- Use the **private** key (the file *without* `.pub`), unencrypted (no passphrase).
- It must match the Gcore SSH key registered under `ssh_key_name` (default `qa-chk-bare`).
- `ssh_key` is gitignored; never commit it.
- Not needed to just start the UI / browse Regions & Quotas — only for actual runs.

---

## Running with Docker Compose (recommended)

Requires `volume/config/app.env` with `CLOUD_API_KEY` set.

```bash
docker compose --env-file volume/config/app.env up --build
```

The first run builds the image (frontend + backend, ~1–2 min).
Subsequent runs skip the build if nothing changed:

```bash
docker compose --env-file volume/config/app.env up
```

Open the UI at `http://127.0.0.1:8080/`

Stop:

```bash
# Ctrl-C in the foreground terminal, or in another terminal:
docker compose down
```

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
podman compose down
# or
podman-compose down
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

### Backend only (no API key needed for smoke)

```bash
cd qa-web-app
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8080 --reload
```

Without `CLOUD_API_KEY` the app starts and serves the UI.
`/api/health` returns `{"status":"ok","api_key_configured":false}`.
Gcore-backed endpoints (regions, quotas, runs) will fail with 500 until a key is provided.

With a key:

```bash
CLOUD_API_KEY=replace-with-your-token \
  python -m uvicorn backend.main:app --host 127.0.0.1 --port 8080 --reload
```

### Frontend dev server (hot-reload)

Requires the backend running separately on port 8080.

```bash
cd qa-web-app/frontend
npm install   # first time only
npm run dev   # starts on http://localhost:5173
```

### Build frontend for production

```bash
cd qa-web-app/frontend
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

Find and stop the process:

```bash
lsof -ti:8080 | xargs kill
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
cd qa-web-app/frontend && npm run build
```

Or use `docker compose up --build` to rebuild the image.

### UI loads but data screens fail (502 / empty)

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
| `settings.json` | May contain project IDs / paths |
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
| `SSH_KEY_NAME` | Gcore SSH key name for BM create | `qa-chk-bare` |
| `IMAGE_NAME` | Baremetal image | `ubuntu-22.04-x64-ironic` |
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
cd qa-web-app && python -m pytest -q

# Frontend build
cd qa-web-app/frontend && npm run build

# Verify no yarn/pnpm lockfiles
test ! -f yarn.lock && test ! -f pnpm-lock.yaml && echo "ok"
```

---

## Implemented screens

| Screen | Status |
|--------|--------|
| Regions | Done |
| Quotas | Done |
| Settings | Done |
| New Run | Done |
| Run Progress | Done (polling via `GET /api/runs`) |
| Reports | Done |
| Cleanup | Done |
