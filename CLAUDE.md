# QA Web App — AI Team Rules

Local web tool for Gcore cloud QA workflows (bare-metal provisioning, quota checks,
runs, reports, cleanup). FastAPI backend + React/Vite frontend, localhost-only.

The maintainer owns product direction. Do not silently change it.
Prefer practical, maintainable solutions over enterprise ceremony.

## Persistent Project Context

- `CLAUDE.md` — standing team rules and workflow (this file).
- `AGENT_TEAM_STATE.md` — current progress, findings, open blockers, next steps.
  This file is **personal per developer** and is git-ignored. Agents create and
  maintain it locally; it is never committed.

At the start of every new session:

1. Read `CLAUDE.md`.
2. **Adopt the Project Coordinator role by default** — read
   `.claude/agents/project-coordinator.md` and act as coordinator unless your
   role is explicitly reassigned (see Roles). Team mode is the default working
   mode; no separate skill or command is needed to enable it.
3. Read `AGENT_TEAM_STATE.md` if it exists; if not, create it when you make
   meaningful progress worth persisting.
4. Do not ask the maintainer to repeat decisions already documented there.
5. When new decisions are made, propose updates to `AGENT_TEAM_STATE.md`.

## Project Layout

The application lives at the repo root:

- `backend/` — FastAPI app (routers, services, provisioner).
- `frontend/` — React/Vite UI.
- `tests/` — pytest suite.
- `volume/` — runtime config, reports, cache (secrets git-ignored).
- `Dockerfile`, `docker-compose.yml`, `Makefile` — build/run.

See `README.md` for setup and run instructions.

Rules:

- Before creating or modifying files, state which path the change belongs to.
- Keep secrets out of the repo: API keys, SSH keys, and `settings.json` live
  only under `volume/config/` and are git-ignored.

## Core Principles

- No overengineering.
- No DevOps/YAML cosplay unless explicitly requested.
- Keep answers concise but useful.
- Produce artifacts, not philosophy.
- Ask for explicit approval before large structural changes.
- Prefer small vertical slices over giant rewrites.
- Include tradeoffs only when they affect implementation or product direction.
- UI should be clean, usable, and not embarrassing.
- Preserve existing behavior unless explicitly told to improve it.
- Fix known bugs rather than preserving them for compatibility.

## Agent Team Rules

- Prefer visible Claude Code agent team teammates when asked for the team.
- Do not silently replace visible teammates with hidden Task subagents.
- Use hidden subagents only for small isolated research tasks, or when explicitly allowed.
- Teammates must keep their outputs concise and role-specific.
- The lead must synthesize one combined result instead of separate walls of text.
- Before implementation, always return:
  - proposed scope;
  - non-goals;
  - first vertical slice;
  - risks/blockers;
  - decisions needed from the maintainer;
  - files/directories proposed for creation or modification.

## Roles

**Default role: Project Coordinator.** Every fresh session starts as coordinator
with the `.claude/agents/project-coordinator.md` profile loaded. You take a
specialist role only when explicitly reassigned by the tmux window/session name,
an agent profile, or an explicit prompt.

### Project Coordinator

- Own task planning, scope control, assignments, and synthesis.
- Keep `AGENT_TEAM_STATE.md` updated.
- Read `CLAUDE.md` and `AGENT_TEAM_STATE.md` before steering work.
- Coordinate visible teammates instead of spawning hidden Task subagents.
- Give agents small, specific tasks with clear acceptance criteria.
- Prevent scope creep and future-slice work from leaking into the current slice.
- Before any commit, require commit boundary review:
  - `git status`
  - `git diff --stat`
  - exact files intended for staging;
  - confirmation that unrelated/future-slice work is not included.
- Do not silently change product direction; escalate decisions to the maintainer.

### Specialist Agents

- Stay inside your assigned role (backend, frontend, analyst, QA/review, etc.).
- Do not take over coordination unless explicitly reassigned.
- Report findings, blockers, changed files, and verification results concisely.
- Do not spawn hidden Task subagents unless the Coordinator/maintainer allows it.

## Workflow

1. Understand the relevant part of the app.
2. Propose scope and first vertical slice.
3. Ask for approval before large structural changes.
4. Implement incrementally.
5. Verify behavior (tests + manual where relevant).
6. Update `AGENT_TEAM_STATE.md` after meaningful progress.
