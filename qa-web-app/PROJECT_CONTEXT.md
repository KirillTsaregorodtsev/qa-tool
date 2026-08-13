# QA Web App Project Context

Date: 2026-05-17

## Purpose

Rewrite the old QA project into a new local web app with a FastAPI backend and React/Vite frontend. The old project is a read-only reference; the new implementation should be clean, Docker-runnable, and safe for local use.

## Paths

- Read-only source/reference: `/Users/qamacos.3/PycharmProjects/cloud-qa`
- Writable target: `/Users/qamacos.3/Work/my_team/qa-web-app`

## Existing Target Structure

- `backend/main.py`: FastAPI app, CORS, frontend static mount, health endpoint.
- `backend/config.py`: config/env/settings merge and run defaults model.
- `backend/gcore_client.py`: shared Gcore client and request capture.
- `backend/routers/regions.py`: `GET /api/regions`.
- `backend/routers/quotas.py`: `GET /api/quotas`.
- `frontend/src/App.jsx`: sidebar shell and screen routing state.
- `frontend/src/screens/RegionsScreen.jsx`: regions table.
- `frontend/src/screens/QuotasScreen.jsx`: quota checks.
- `volume/config/settings.example.json`: safe example runtime config.
- `volume/config/settings.json`: local runtime settings, ignored by git.

## Runtime Config

Local layout:

```text
volume/config/
volume/reports/
volume/cache/
```

Docker mount target:

```text
/app/volume
```

Default paths:

```text
CONFIG_DIR=/app/volume/config
REPORTS_DIR=/app/volume/reports
SSH_KEY_PATH=/app/volume/config/ssh_key
```

Runtime-editable config should be `settings.json`. UI may edit safe settings, but must never display SSH private key contents.

## Current Implemented Slice

- `/api/health`
- `/api/regions`
- config merge
- Gcore client using `CLOUD_API_KEY` with `PROD_API_KEY` fallback
- `/api/quotas?region_id=N`
- `/api/flavors?region_id=N` with baremetal capacity included
- `/api/projects` for selecting cloud project by ID/name
- safe `/api/settings` and `PATCH /api/settings/run-defaults`
- safe `PATCH /api/settings/project`
- dark/sidebar UI shell
- Regions screen
- Quotas screen
- New Run screen
- Settings screen with project selection

## Latest Slice: Flavors and New Run

Implemented:

- `GET /api/flavors?region_id=N`
- New Run form

New Run behavior:

- Load regions.
- Fetch flavors after selected region changes.
- Preload `run_defaults` from settings/config.
- Let user override selected region/flavor/server count.
- Validate required fields.
- On valid Start, save selected defaults back to settings.
- Clearly communicate that real run execution is not implemented yet.
- Hide `capacity === 0` flavors by default.
- Show unavailable flavors when checkbox is enabled; zero-capacity options remain disabled/grey and show `capacity 0`.
- Project is configured in Settings and displayed on New Run. Backend Gcore calls use configured `project_id`; region selection remains separate as `region_id`.

Strict anti-scope:

- no real run execution
- no `POST /api/runs`
- no SSH/provisioning
- no report generation/view internals beyond existing structure
- no cancellation/Stop Run
- no GPU/inference
- no auth
- no DB
