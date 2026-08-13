# Agent Team State

## Current Phase

Implementing: `POST /api/runs` — in-memory run store + BM provisioner (no live Gcore smoke without Kirill).

## Committed Baseline

`f18401b Add project settings flow`

## Completed Slices

| Slice | Commit | Status |
|-------|--------|--------|
| Init + infra | `8e98910` | done |
| Regions | `dcf6693` | done |
| Quotas | `dcf6693` | done |
| Flavors + New Run form | `15e2341` | done |
| Project settings flow | `f18401b` | done |

---

## Next Slice: `POST /api/runs`

### Scope

- `backend/run_store.py` — thread-safe in-memory run store (dict + `threading.Lock`)
- `backend/services/provisioner.py` — BM server creation + task polling + B-2 IP fix
- `backend/routers/runs.py` — `POST /api/runs`; starts provisioner as background task; returns `{run_id, status}`
- Wire new router into `backend/main.py`
- Add `ssh_key_name` and `image_name` to `settings.json` schema + `config.py`

### Non-goals for this slice

- `GET /api/runs/{id}/events` SSE and progress UI (slice 4)
- Report generation, CSV output (slice 5)
- Cleanup endpoint (slice 6)
- SSH checks, speedtest (slice 7)
- Real SSH/provisioning verification — no live smoke without Kirill

---

### Backend Assignment

Files to create / modify (all in `/Users/qamacos.3/Work/my_team/qa-web-app/`):

**`backend/run_store.py`** (new)
- `RunRecord` dataclass: `run_id`, `status` (pending/running/done/failed), `region_id`, `flavor_id`, `servers_count`, `jira_ticket_id`, `created_at`, `servers: list[ServerRecord]`
- `ServerRecord`: `index`, `status`, `task_id`, `instance_id`, `ip_address`, `error`
- Module-level `_store: dict[str, RunRecord]` + `threading.Lock`
- `create_run(...)`, `get_run(run_id)`, `list_runs()`, `update_server(run_id, index, **fields)`

**`backend/services/provisioner.py`** (new)
- `get_image_id(client, project_id, region_id, image_name) -> str` — iterate baremetal images, match by name
- `get_instance_ip(client, instance_id) -> str` — B-2 fix: iterate all `addresses` values, pick first version=4 non-private address; raise clear error if none found
- `run_provisioner(run_id, region_id, flavor_id, servers_count, jira_ticket_id, image_name, ssh_key_name)` — sync; runs in `asyncio.to_thread`
  - For each server index 1..N: call `cloud.baremetal.servers.create(...)`, wait via `wait_for_task_sync`, get IP; update run store on each step
  - `wait_for_task_sync` adapted from source (`task.state in ("NEW","RUNNING")` -> sleep; FINISHED -> return; else -> raise)
  - Instance name pattern: `qa_autotest_bm_{jira_ticket_id or run_id}_tk_{i}`
  - Interfaces: `[{"type": "external"}]`
  - Catch per-server errors, mark server failed, continue remaining servers

**`backend/routers/runs.py`** (new)
- `POST /api/runs` body: `{region_id: int, flavor_id: str, servers_count: int, jira_ticket_id: str | null}`
- Validate: `region_id` required, `servers_count` >= 1
- Require API key configured (return 503 + clear message if not)
- Create run record, kick off `asyncio.to_thread(run_provisioner, ...)`, return `{run_id, status: "pending"}`
- Return `_dev` trace consistent with other routers

**`backend/main.py`** — add `from backend.routers import runs` + `app.include_router(runs.router, prefix="/api")`

**`backend/config.py`** — add `ssh_key_name: str = "qa-chk-bare"` and `image_name: str = "ubuntu-22.04-x64-ironic"` to settings; load from `settings.json` if present

**`volume/config/settings.example.json`** — add `ssh_key_name` and `image_name` fields

### Frontend Assignment

No new screen work needed. `NewRunScreen.jsx` already calls `POST /api/runs` and handles `{run_id, status}` in the success banner. Confirm no changes needed after backend is wired.

### QA / Review Assignment

- `python3 -m compileall -q backend`
- `cd frontend && npm run build`
- No `yarn.lock` / `pnpm-lock.yaml`
- `git diff --check`
- Isolated venv FastAPI smoke: `POST /api/runs` without API key -> 503; basic structure check
- Verify no secret values in any response or log output
- Verify no write to `/Users/qamacos.3/PycharmProjects/cloud-qa`

---

## Decisions Needed from Kirill Before Implementation

| # | Question | Default from source |
|---|----------|---------------------|
| D-16? | `ssh_key_name` — new `settings.json` field (recommended) or parsed from `ssh_key_path` filename? | Source hardcodes `"qa-chk-bare"` |
| D-17? | `image_name` — new `settings.json` field (recommended) or hardcoded? | Source hardcodes `"ubuntu-22.04-x64-ironic"` |
| D-18? | `POST /api/runs` — return immediately with `{run_id, status: "pending"}` and provision in background (recommended), or block until all BM create requests are submitted? | Recommended: background |

---

## Remaining Scope (v1) — After This Slice

| # | Slice |
|---|-------|
| 4 | `GET /api/runs/{id}/events` SSE + `RunProgressScreen.jsx` |
| 5 | `backend/services/reporter.py` + `GET /api/reports` + `ReportsScreen.jsx` |
| 6 | `DELETE /api/runs/{id}/instances` + `CleanupScreen.jsx` |
| 7 | Vendor `speedtest.py` (fix B-1) + `backend/services/checker.py` |
| 8 | `GET /api/runs` run list screen |

---

## Standing Scope Restrictions

- No DB — run state in-memory only (D-4)
- No auth (D-2)
- No GPU/inference (D-7)
- No Stop Run (D-8)
- Do not fetch speedtest live at runtime (D-6)
- Do not modify source project
- Baremetal only for v1

## Known Risks

| # | Risk |
|---|------|
| R-5 | In-memory run state lost on restart — accepted for v1, surface clearly in UI |
| R-6 | `wait_for_task_sync` is a blocking poll loop — must run in `asyncio.to_thread` |
| R-7 | B-2 (pub_net hardcoded) — fixed in provisioner.py `get_instance_ip` |

---

## 2026-05-17 Checkpoint — Frontend

### Completed this session

- **UI layer review** (`App.jsx`, `SettingsScreen.jsx`, `NewRunScreen.jsx`):
  - Fixed `showUnavailableFlavors` dep bug in flavors effect (no API re-fetch on checkbox toggle)
  - Fixed `flavorsStatus` set from filtered list instead of raw list
  - Fixed `SettingsScreen` `loadProjects` catch polluting shared error banner
- **Region labels**: added `keystone_name` to dropdown options in `NewRunScreen.jsx` and `QuotasScreen.jsx` — format `Display Name · keystone · id`
- **New Run — Jira + POST /api/runs**:
  - Added Jira Ticket ID field (required, placeholder `GCLOUD2-12345`)
  - `handleStart` now: saves `run_defaults` best-effort → `POST /api/runs` → shows `{run_id, status}` result
  - Field name aligned with backend contract: `jira_task_id`
  - `validate()` enforces non-blank `jira_task_id`; sends trimmed string (never null)
  - Removed stale `infoMsg`/`saving` states; replaced with `submitPhase` + `runResult`
  - Button label tracks phase: Start → Saving... → Starting...; spinner shown during all submit phases

### Stopping point

`frontend/src/screens/NewRunScreen.jsx` — `validate()` and `handleStart` finalised. All frontend changes uncommitted per Kirill instruction.

### Next action when resuming

Commit session frontend changes when Kirill approves, then move to slice 4: `GET /api/runs/{id}/events` SSE + `RunProgressScreen.jsx` (blocked on backend `POST /api/runs` being committed first).

### Open blockers

- Backend `POST /api/runs` not yet in `main.py` — frontend will receive 404 until wired
- D-16/D-17/D-18 (ssh_key_name, image_name, sync vs async provisioning) still open
