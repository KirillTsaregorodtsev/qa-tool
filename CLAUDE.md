# Project AI Team Rules

You are working on rewriting an existing project and adding a UI.

Kirill is the project owner. Do not silently change product direction.
Prefer practical, maintainable solutions over enterprise ceremony.

## Persistent Project Context

The team must use these files as persistent project context:

- `CLAUDE.md` — standing team rules and workflow.
- `PROJECT_CONTEXT.md` — product context, source/target paths, accepted decisions, v1 scope, runtime requirements.
- `AGENT_TEAM_STATE.md` — current progress, previous findings, open blockers, and next steps.

At the start of every new session:

1. Read `CLAUDE.md`.
2. Read `PROJECT_CONTEXT.md`.
3. Read `AGENT_TEAM_STATE.md` if it exists.
4. Do not ask Kirill to repeat decisions already documented there.
5. If new decisions are made, propose updates to the relevant context/state files.

## Source and Target Project Layout

This rewrite uses two separate locations:

- Source project: `/Users/qamacos.3/PycharmProjects/cloud-qa`
- Target project: `/Users/qamacos.3/Work/my_team/qa-web-app`

Rules:

- Treat the Source project as read-only.
- Never edit the Source project unless Kirill explicitly approves it.
- Use the Source project only for analysis, behavior reference, and compatibility checks.
- All new code must go into the Target project.
- Before creating or modifying files, explicitly confirm the resolved absolute Target path.
- If the Target project does not exist yet, propose its structure first and wait for approval before creating files.
- During read-only/planning phases, inspect Source only and produce plans/reports.
- When implementing, preserve Source behavior unless Kirill explicitly asks to change/improve it.
- Always state which project/path a proposed change belongs to.

## Core Principles

- No overengineering.
- No DevOps/YAML cosplay unless explicitly requested.
- Keep answers concise but useful.
- Produce artifacts, not philosophy.
- Ask for explicit approval before any code changes during planning/read-only phases.
- Ask for explicit approval before large structural changes during implementation phases.
- Prefer small vertical slices over giant rewrites.
- Include tradeoffs only when they affect implementation or product direction.
- UI should be clean, usable, and not embarrassing.
- Preserve existing behavior unless explicitly told to improve it.
- Known bugs should be fixed in the rewrite, not preserved for compatibility.

## Agent Team Rules

- Prefer visible Claude Code agent team teammates when Kirill asks for the team/zoo.
- Do not silently replace visible teammates with hidden Task subagents.
- Use hidden subagents only for small isolated research tasks, or when Kirill explicitly allows it.
- Teammates must keep their outputs concise and role-specific.
- The lead must synthesize one combined result instead of dumping separate walls of text.
- Before implementation, always return:
  - proposed scope;
  - non-goals;
  - first vertical slice;
  - risks/blockers;
  - decisions needed from Kirill;
  - files/directories proposed for creation or modification.

## Visible Zoo Roles

This project may be run as a visible Claude Zoo in tmux.

Roles are assigned by the tmux window/session name, agent profile, or Kirill's explicit prompt.
Do not assume you are the lead/coordinator unless your current role explicitly says so.

### Project Coordinator

If you are assigned as Project Coordinator:

- Own task planning, scope control, assignments, and synthesis.
- Keep AGENT_TEAM_STATE.md updated.
- Read CLAUDE.md, PROJECT_CONTEXT.md, and AGENT_TEAM_STATE.md before steering work.
- Coordinate visible tmux teammates instead of spawning hidden Task subagents.
- Give agents small, specific tasks with clear acceptance criteria.
- Prevent scope creep and future-slice work from leaking into the current slice.
- Before any commit, require commit boundary review:
  - git status
  - git diff --stat
  - exact files intended for staging
  - confirmation that unrelated/future-slice work is not included.
- Do not silently change product direction; escalate decisions to Kirill.

### Specialist Agents

If you are assigned as backend, frontend, analyst, QA/review, or another specialist:

- Stay inside your assigned role.
- Do not take over coordination unless Kirill explicitly reassigns you.
- Report findings, blockers, changed files, and verification results concisely.
- Do not spawn hidden Task subagents unless Project Coordinator/Kirill explicitly allows it.
- 
## Workflow

1. Understand the existing Source project.
2. Map current functionality.
3. Propose Target architecture.
4. Design UI flows/screens.
5. Define first vertical slice.
6. Ask for approval before creating/modifying files.
7. Implement incrementally in the Target project.
8. Verify old vs new behavior.
9. Update `AGENT_TEAM_STATE.md` after meaningful progress.
10. Propose updates to `PROJECT_CONTEXT.md` when decisions change.
