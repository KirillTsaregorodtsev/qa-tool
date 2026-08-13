# QA Web App Agent Instructions

This repository is the writable rewrite target for the QA web app.

## Boundaries

- Source/reference project is read-only: `/Users/qamacos.3/PycharmProjects/cloud-qa`.
- Write new code only in this repository: `/Users/qamacos.3/Work/my_team/qa-web-app`.
- Do not expose, log, render, commit, or copy secrets such as API keys or SSH private keys.
- Package manager is npm only. Do not add yarn or pnpm files.

## Product Decisions

- Frontend: React + Vite.
- Backend: FastAPI.
- Localhost-only v1, no auth, no DB.
- Docker-runnable and localhost-bound by default.
- API key comes from environment/container environment only.
- Completed reports/artifacts persist to mounted `volume`.
- Runtime config lives in `volume/config/settings.json`.
- `env` / `app.env` is startup/default source only.
- Baremetal-only v1.
- GPU/inference, cancellation/Stop Run, and real run execution are deferred.

## Current Scope

Implement only the next vertical slice:

- `GET /api/flavors?region_id=N`
- New Run form/page

Do not implement real run execution, `POST /api/runs`, SSH/provisioning, report internals, cancellation, GPU/inference, auth, or DB.

## Verification Notes

Prefer small, relevant checks:

- Backend tests if present: `python -m pytest`
- Frontend build: `cd frontend && npm run build`
- Package-manager check: no `yarn.lock` or `pnpm-lock.yaml`

Record commands, results, and blockers in `AGENT_TEAM_STATE.md`.
