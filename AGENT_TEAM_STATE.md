# Agent Team State

## Current Phase

v1 scope complete (2026-06-09). All planned slices committed.

## Completed

### Regions
- `backend/routers/regions.py` — `GET /api/regions`
  - Returns `id`, `display_name`, `keystone_name`, `has_baremetal`
  - Response envelope: `{"regions": [...], "_dev": {"requests": [...]}}`
- `frontend/src/screens/RegionsScreen.jsx`
  - Sortable columns (Region ID, Name, Keystone Name)
  - Client-side filter, click-to-copy Region ID
  - States: loading, error, empty, loaded

### Quotas
- `backend/routers/quotas.py` — `GET /api/quotas?region_id=N&servers_count=M`
  - Fields: `baremetal_hf_count`, `external_ip_count`, `baremetal_infrastructure_count`
  - Pass/fail: `headroom > count` for HF/IP; `headroom >= count` for infrastructure
  - `None` values → 0/0/0/False safe fallback
  - `overall_sufficient`: true only when all three pass
  - 502 on API error, 422 on missing `region_id`
- `frontend/src/screens/QuotasScreen.jsx`
  - Region dropdown (BM-only), servers count input
  - Progress bars, headroom + OK/Insufficient badges per quota row
  - Overall green/red banner
  - "Proceed to New Run" shortcut when all pass

### Flavors + New Run
- `backend/routers/flavors.py` — `GET /api/flavors?region_id=N` (committed)
- `frontend/src/screens/NewRunScreen.jsx` (committed)
  - Fields: region (dropdown), flavor (dropdown, fetched per region), servers count, Jira ticket ID
  - Preloads defaults from `settings.json` → `run_defaults`
  - Validates saved `flavor_id` against current region's flavors before use
  - "Check Quotas" shortcut

### Settings
- `backend/routers/settings.py` — `GET /api/settings`, `PUT /api/settings` (committed)
- `frontend/src/screens/SettingsScreen.jsx` (committed)
- Settings disclosure section added (safe-config note: API key / SSH key / reports never exposed in UI)

### Runs + Provisioner — `a753bc8`
- `backend/routers/runs.py` — `POST /api/runs` (201 + background task), `GET /api/runs`, `GET /api/runs/{run_id}`
- `backend/run_store.py` — thread-safe, JSON-persisted `RunStore`; auto-loads existing records on startup
- `backend/provisioner.py` — BM provisioner; B-2 fix: `_get_public_ipv4` iterates all address groups
- `backend/config.py` — `ssh_key_name` and `image_name` added to Settings + _DEFAULTS
- `tests/test_runs.py` — 9 pytest tests; provisioner monkeypatched; temp dir isolation

### Run Progress screen — `476024a`
- `frontend/src/screens/RunProgressScreen.jsx` — polls `GET /api/runs` every 5s; run list + detail panel + server table
- `frontend/src/App.jsx` — `RunProgressScreen` imported and wired for `activeScreen === 'run-progress'`
- `frontend/src/screens/NewRunScreen.jsx` — `onNavigate` prop added; "View Progress" button in success banner
- No SSE endpoint (polling sufficient for v1; D-19: Run Progress reachable from New Run success only, no sidebar nav item)

### Dev request tracing
- `backend/gcore_client.py` — `httpx.Client` event hook; thread-local `start_capture()` / `stop_capture()`
- All API responses include `"_dev": {"requests": [{"method": "...", "url": "..."}]}`

### Provisioner bug fix — `backend/provisioner.py` (2026-05-22, b65b30e)
- `instances.get()` was missing `region_id` and `project_id`; Gcore SDK requires them per-call
- Server provisioned successfully but IP fetch failed: "Missing cloud_region_id argument"
- Fix: pass both args explicitly (already available as `_provision_one` parameters)
- Verified by QA agent: 20/20 tests, no other bare `instances.get` calls found

### Reports slice (2026-05-22)
- `backend/services/__init__.py` + `backend/services/reporter.py` — CSV generation from `RunRecord`; full 10-column header (checker columns blank until checker slice); filename `{jira_task_id}_{YYYYMMDD_HHMMSS}.csv`
- `backend/routers/reports.py` — `GET /api/reports` (list), `GET /api/reports/{filename}/download` (FileResponse); path traversal protection via `_SAFE_FILENAME` regex + `resolve().relative_to()`
- `backend/provisioner.py` — calls `write_report()` after run finishes (done or failed); exception is caught/logged, never propagates
- `backend/main.py` — `reports` router registered
- `frontend/src/screens/ReportsScreen.jsx` — full implementation: `/api/reports` list, loading/empty/error states, Download button per row
- `frontend/src/App.jsx` — `ReportsScreen` imported and wired for `activeScreen === 'reports'`
- `tests/test_reports.py` — 11 tests: reporter unit + endpoint integration
- Decisions: D-A=option1 (full header, blank checker fields); D-B=done+failed both generate report
- Verified: 20/20 pytest, frontend build ✓

### Cleanup slice (2026-06-09) — `f315816`
- `backend/routers/cleanup.py` — `DELETE /api/runs/{run_id}/instances`; sequential delete via `cloud.instances.delete`; 404/409 guards; run status → `"cleaned"`; returns `{run_id, deleted, failed}`
- `backend/main.py` — cleanup router registered
- `frontend/src/screens/CleanupScreen.jsx` — run list (done/failed/cleaned), detail panel, Delete Instances button with loading/success/error/disabled states
- `frontend/src/App.jsx` — CleanupScreen wired, "Cleanup" sidebar item added
- `tests/test_cleanup.py` — 8 tests

### Checker slice (2026-06-09, committed) — `f46d7a9`
_Previously implemented 2026-05-22, committed 2026-06-09_
- `backend/vendor/speedtest.py` — vendored speedtest-cli v2.1.3 (pinned tag, fixes B-1/D-6/D-13)
- `backend/vendor/__init__.py` — package marker
- `backend/services/checker.py` — SSH checker: single session per server, 10-retry connect, 120s exec timeout, SFTP speedtest upload, 5 SSH checks (CPU/RAM/Disk/DiskCount/Ping/Speed) + 1 HTTP check (Console OK); partial results on failure; never raises
- `backend/run_store.py` — `ServerRecord` extended with 7 checker fields: `cpu`, `ram`, `disk`, `disk_count`, `console_ok`, `ping`, `speed` (all `Optional[str]`)
- `backend/services/reporter.py` — CSV now uses real checker fields instead of blank strings
- `backend/provisioner.py` — calls `check_server()` after successful provisioning; server stays `"ready"` on checker failure (D-D)
- `tests/test_checker.py` — 14 unit tests, paramiko/requests monkeypatched, no real SSH
- Decisions: D-A=single SSH session, D-B=120s timeout, D-C=ubuntu hardcoded, D-D=server stays ready, D-E=partial results
- Verified: 40/40 pytest, frontend build ✓

### Startup fix — `backend/main.py` (2026-05-22)
- `lifespan()` no longer calls `get_settings()` outside try/except
- Missing `CLOUD_API_KEY` now logs a warning instead of crashing uvicorn startup
- App starts, serves UI, and returns `{"status":"ok","api_key_configured":false}` from `/api/health` when key is absent
- Verified: `env -i python -m uvicorn backend.main:app` → startup complete, health 200

### Infrastructure
- FastAPI app, dual-path static serving (container + local dev)
- `PROD_API_KEY` fallback in config
- Volume layout, `.gitignore`, `Dockerfile`, `requirements.txt`
- Hygiene/smoke gate passed

## Source Behavior: Reports (preserved-behavior notes from analyst 2026-05-22)

- CSV filename pattern: `{jira_task_id}_{YYYYMMDD_HHMMSS}.csv` — one file per run
- CSV columns (exact): `Server ID`, `CPU`, `RAM`, `Disk`, `Disk Count`, `IP Address`, `Instance ID`, `Console OK`, `Ping`, `Speed`
- All servers from one run are rows in the same file; no summary/aggregation rows
- Report generated at end of run (after all workers complete), not per-server or on-demand
- Source has no download/view mechanism — manual file retrieval only; we add that in UI
- CPU field: source strips prefix (`model name : `) to just the value after the last `:`
- `Console OK` column is raw HTTP status + body string (e.g., `"200 {...}"`)
- `Speed` column is two lines: `Download: X Mbit/s` / `Upload: X Mbit/s` concatenated
- **Current `ServerRecord` does not carry check fields** (`cpu`, `ram`, `disk`, etc.) — checker is a future slice
- Reports slice will generate partial CSV from available fields only; extended when checker lands

## Next Task

Awaiting Kirill's direction.

## Post-v1 Changes (2026-06-27)

### TODO-1: Fix server index display (RunProgressScreen)
- `frontend/src/screens/RunProgressScreen.jsx` — added `tdIndex` style with `whiteSpace: 'nowrap'` and `width: '1%'`; index column header also gets `whiteSpace: 'nowrap'`
- Fixes vertical rendering of server numbers ≥ 10

### fix(settings): remove redundant Project ID/Name inputs (2026-06-27) — `397aead`
- `frontend/SettingsScreen.jsx` — removed Project ID and Project Name text inputs (duplicated dropdown info); state + submit logic unchanged

### fix(config): default image ubuntu-26.04-x64-ironic (2026-06-27) — `5742453`
- `backend/config.py` — `_DEFAULTS["image_name"]` updated
- `backend/routers/settings.py` — fallback value updated

### TODO-3: Image info in New Run + Run Progress (2026-06-27)
- `backend/run_store.py` — `image_id: Optional[str] = None` in RunRecord
- `backend/routers/runs.py` — `POST /api/runs` accepts `image_id`
- `backend/provisioner.py` — uses `record.image_id` when set, falls back to `_get_image_id()` + `settings.image_name`
- `frontend/NewRunScreen.jsx` — fetches images by region, matches `image_name`, shows read-only name+ID block (warning if not found), passes `image_id` to POST
- `frontend/RunProgressScreen.jsx` — "Image ID" meta item in detail panel
- `tests/test_runs.py` — 7 new tests; 77/77 pass

### TODO-2 / D-20: Batch cancel (2026-06-27)
- `backend/run_store.py` — `cancelled: bool = False` on `RunRecord`; `cancel_run()` method
- `backend/routers/runs.py` — `PATCH /api/runs/{run_id}/cancel` (200/404/409)
- `backend/provisioner.py` — pre-create check in `_provision_one`; final status `"cancelled"` only when `statuses <= {"cancelled"}`; bug fix: was `"running" not in statuses` (too broad)
- `frontend/src/screens/RunProgressScreen.jsx` — Cancel button in detail panel (running only), spinner, inline error
- `tests/test_runs.py` — 10 new tests added; 70/70 pass
- `requests==2.32.3` confirmed in requirements.txt; test_checker.py now collects

### Image cache slice (2026-06-27) — `62f1e28`
- `backend/services/image_cache.py` (new) — in-memory cache keyed by `(project_id, region_id)`, `threading.Lock`, no TTL; `get/set/invalidate/clear`
- `backend/routers/images.py` — `fetch_images(project_id, region_id)` helper with pair-safe capture (try/except `stop_capture` once); `GET /api/images` gains `refresh: bool` to bypass cache; error path (502) never caches; redundant `stop_capture()` removed from router
- `backend/main.py` — lifespan best-effort warm-up (guards `project_id` + `run_defaults.region_id` + `cloud_api_key`; try/except → `logging.warning`; never crashes startup); reuses `fetch_images`
- `frontend/src/screens/SettingsScreen.jsx` — `loadImages(regionId, refresh)`; small circular-arrows (↻) refresh button; auto-refetch images only on real `project_id` change (`savedProjectIdRef` baseline)
- `frontend/src/screens/NewRunScreen.jsx` — same ↻ refresh button; `loadImages(regionId, refresh)`; still refetches on region change (now cache-backed)
- `tests/test_images.py` — cache hit / refresh-bypass / separate keys / warm-up / no-API-key / 502-not-cached / get_client-raises-keeps-capture-clean
- QA verdict: READY (84/84 pytest, frontend build ✓)
- Accepted v1 gaps (non-blocking): thundering herd on cold key; unbounded cache growth (no TTL/limit)
- Known minor (deferred to next session, see TODO.txt #4): Settings refresh spinner shifts the ↻ button instead of swapping in place — RESOLVED 2026-06-29 (`a9abb5e`)

### fix(settings): swap refresh spinner in place (2026-06-29) — `a9abb5e`
- `frontend/src/screens/SettingsScreen.jsx` — removed standalone spinner rendered beside the ↻ button; spinner now swaps in-place with the ↻ SVG inside the button (same 13px slot) → no layout shift
- Scope: only SettingsScreen.jsx (+8/−6); NewRun and backend untouched
- QA verdict: PASS (build clean, 43 modules, 0 warnings); closes TODO.txt #4

## Remaining Scope (v1)

All v1 slices shipped.

## Deferred / Untracked Files (do not commit yet)

- `qa-web-app/frontend/src/screens/OperationsScreen.jsx` — future slice
- `qa-web-app/frontend/src/screens/ReportsScreen.jsx` — done, committed in Reports slice
- `qa-web-app/docker-compose.yml`, `.dockerignore`, `README.md`, `.claude/` — deferred infra/docs
- `KLAVA.md`, `old_KLAVA.md` — excluded per Kirill decision
- `.claude/settings.json` — tooling config, not part of any slice

## Scope Restrictions (standing)

- No DB — run state in-memory + JSON files only (D-4)
- No auth (D-2)
- No GPU/inference (D-7)
- No Stop Run (D-8)
- Do not fetch speedtest live at runtime (D-6)
- Do not modify Source project
- Baremetal only for v1 (D-7)

## Known Risks

| # | Risk |
|---|------|
| R-5 | In-memory run state lost on restart (JSON files survive; in-memory cache rebuilt on start) — accepted for v1 |
| R-6 | `_wait_for_task` is a blocking poll loop in `provisioner.py` — runs in FastAPI `BackgroundTasks` thread pool; acceptable for v1 but will block workers long-term |
| R-7 | ~~B-1 (speedtest live fetch)~~ — resolved: speedtest.py vendored at v2.1.3, uploaded via SFTP |
| R-8 | ~~SSE for run progress~~ — resolved: polling via `GET /api/runs` used instead (sufficient for v1) |
| R-9 | `task.created_resources.instances[0]` in `provisioner.py:85` — unguarded index; empty list would raise `IndexError` surfaced as `failed` status. Pre-existing, low severity, out of scope for now |

## Accepted Decisions

See `PROJECT_CONTEXT.md` for D-1..D-15.

- D-19: Run Progress reachable from New Run success only (no sidebar nav item) for this slice.
