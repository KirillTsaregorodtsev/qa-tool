# Project Context

## Goal

Rewrite the existing Source project into a new Target application with a clean local web UI.

## Paths

- Source project: `/Users/qamacos.3/PycharmProjects/cloud-qa`
- Target project: `/Users/qamacos.3/Work/my_team/qa-web-app`

## Source Rules

- Source project is read-only by default.
- Do not edit Source unless Kirill explicitly approves.
- Use Source for behavior reference, compatibility checks, and analysis.

## Target Rules

- All new code goes into Target project.
- Confirm resolved Target path before creating/modifying files.
- Preserve Source behavior unless Kirill explicitly asks to improve it.

## Accepted Decisions

- D-1: Frontend framework: React + Vite.
- D-2: App is localhost-only for v1, no auth. It should be runnable in Docker. Bind to `127.0.0.1` by default.
- D-3: API key is provided via Docker/container env. Do not ask users to paste API keys into UI. Do not expose/store API key in frontend.
- D-4: No DB for v1. In-progress run state may be lost on restart. Completed reports/artifacts must be persisted to mounted reports volume.
- D-5: Fix known bugs B-1/B-2 in rewrite. Do not preserve known buggy behavior.
- D-6: Vendor/pin `speedtest.py` in repo/container image. Do not fetch it live from GitHub at runtime.
- D-7: Baremetal-only for v1. Defer inference/GPU workflows.
- D-8: Omit/disable Stop Run in v1.
- D-9: Feature priority after quotas: (1) Regions list, (2) New Run form, (3) Run progress, (4) Report view, (5) Cleanup.
- D-10: Volume layout — project-local mounted volume at `/Users/qamacos.3/Work/my_team/qa-web-app/volume/` on host, mounted to `/app/volume` in container.
- D-11: `settings.json` is the editable runtime config used by backend and UI. UI may edit safe settings. UI must not display SSH key contents. See schema below.
- D-12: New Run form preloads from `run_defaults` in `settings.json`. Saves selected region/flavor/count back to `run_defaults` after a run starts successfully.
- D-13: `speedtest-cli` vendored at latest stable release/tag (not master, not live fetch). Pinned commit SHA documented in the vendored file.
- D-14: `CLIENT_ID` configurable via `settings.json`/env, legacy default `130485`. Override allowed.
- D-15: `GET /api/flavors?region_id=N` is in v1 scope. New Run form fetches flavors per selected region. Saved `flavor_id` in `run_defaults` is validated against current region's flavors before use.

## Known Bugs (Fixed in Rewrite)

- B-1: `speedtest.py` fetched live from GitHub via `curl | python3` on remote BM server — silently fails if unreachable. Fix: vendor in image, copy via SSH.
- B-2: `addresses["pub_net"][0].addr` — hardcoded network name causes `KeyError` on non-standard projects/regions. Fix: iterate all `addresses` values, pick first version=4 non-private IP, raise clear error if none found.

## Volume Layout

Host path: `/Users/qamacos.3/Work/my_team/qa-web-app/volume/`

```
volume/
  config/
    app.env        # startup/default env values (not committed if contains secrets)
    settings.json  # editable runtime config
    ssh_key        # SSH private key for connecting to provisioned BM servers (not committed)
  reports/         # CSV reports output
  cache/           # reserved for future use
```

Docker mount: `-v /Users/qamacos.3/Work/my_team/qa-web-app/volume:/app/volume`

Default container paths:
- `CONFIG_DIR=/app/volume/config`
- `REPORTS_DIR=/app/volume/reports`
- `SSH_KEY_PATH=/app/volume/config/ssh_key`

Rules:
- Do not bake SSH keys into Docker image.
- Do not commit secrets from `volume/config/`.
- App does not take responsibility for secure storage of the SSH key.

## settings.json Schema

```json
{
  "client_id": "130485",
  "ssh_key_path": "/app/volume/config/ssh_key",
  "reports_dir": "/app/volume/reports",
  "run_defaults": {
    "region_id": null,
    "servers_count": 1,
    "flavor_id": null
  }
}
```

## Docker Runtime Requirements

- `CLOUD_API_KEY` — GCore API key (required, from env).
- `CONFIG_DIR` — path to config dir (default `/app/volume/config`).
- `REPORTS_DIR` — path to reports dir (default `/app/volume/reports`).
- `SSH_KEY_PATH` — path to SSH private key (default `/app/volume/config/ssh_key`).
- `MAX_WORKERS` — thread pool size (default `5`).
- `CLIENT_ID` — GCore client ID for quota checks (default `130485`, overridable).

Example:

```bash
docker run \
  -e CLOUD_API_KEY=*** \
  -v /Users/qamacos.3/Work/my_team/qa-web-app/volume:/app/volume \
  -p 127.0.0.1:8080:8080 \
  qa-web-app
```
