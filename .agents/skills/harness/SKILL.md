---
name: harness
description: Use when planning or executing scoped TeamAZAG work through phases and scripts/execute.py.
---

# Harness Workflow

## Explore

Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ADR.md`, the selected phase
files, and relevant files under `opsradar2/` before editing.

## Plan

Keep each step scoped to one behavior boundary. A step must state files to
read, work to perform, acceptance criteria, and concrete exclusions. Do not
invent endpoint behavior without matching frontend or documented contracts.

## Execute

Validate a phase before running it:

```bash
python scripts/execute.py --validate dev-stabilization
python scripts/execute.py dev-stabilization
```

On success, update the step status to `completed` and write a concise
`summary`. Use `blocked` with `blocked_reason` when a product decision is
required, or `error` with `error_message` when verification cannot pass.
