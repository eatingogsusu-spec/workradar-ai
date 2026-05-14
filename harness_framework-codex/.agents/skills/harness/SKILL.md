---
name: harness
description: Use when the user asks to use the Harness workflow, create or review phase/step plans, generate phases/* files, or run scripts/execute.py in this Codex project.
---

# Harness Workflow

This project uses the Harness workflow for planning and executing step-by-step implementation work with Codex.

## A. Explore

Before proposing work, read the project documents under `docs/`, especially:

- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`

Use sub-agents only when the user explicitly asks for delegated or parallel agent work.

## B. Discuss

If implementation needs product clarification or technical decisions, present the concrete decision points before creating execution files.

## C. Design Steps

When the user asks for an implementation plan, draft multiple steps and ask for feedback before writing phase files.

Step design rules:

1. Keep scope small: each step should affect one layer or module.
2. Make each step self-contained: it must be executable in an independent Codex session without prior chat context.
3. Force preparation: list relevant docs and files created or changed by previous steps.
4. Specify interfaces, not full implementations: provide function, class, or module signatures and critical constraints.
5. Use executable acceptance criteria such as `npm run build` and `npm run test`.
6. Make warnings concrete: use "Do not do X. Reason: Y."
7. Use short kebab-case step names such as `project-setup`, `core-types`, or `api-layer`.

## D. Create Files

After user approval, create or update these files.

### `phases/index.json`

Top-level phase index. If it already exists, append the new task to `phases`.

```json
{
  "phases": [
    {
      "dir": "0-mvp",
      "status": "pending"
    }
  ]
}
```

Rules:

- `dir`: task directory name.
- `status`: one of `pending`, `completed`, `error`, or `blocked`.
- Do not add timestamps manually. `scripts/execute.py` records them while running.

### `phases/{task-name}/index.json`

Task-level index.

```json
{
  "project": "<project-name>",
  "phase": "<task-name>",
  "steps": [
    { "step": 0, "name": "project-setup", "status": "pending" },
    { "step": 1, "name": "core-types", "status": "pending" },
    { "step": 2, "name": "api-layer", "status": "pending" }
  ]
}
```

Rules:

- `project`: project name from `AGENTS.md`.
- `phase`: task name and directory name.
- `steps[].step`: zero-based step number.
- `steps[].name`: kebab-case slug.
- `steps[].status`: initially `pending`.

Status fields:

| Transition | Fields | Writer |
| --- | --- | --- |
| to `completed` | `completed_at`, `summary` | Codex writes `summary`; `execute.py` writes timestamp |
| to `error` | `failed_at`, `error_message` | Codex writes message; `execute.py` writes timestamp |
| to `blocked` | `blocked_at`, `blocked_reason` | Codex writes reason; `execute.py` writes timestamp |

`summary` must be a useful one-line description for the next step, including created files, changed files, and key decisions.

Do not manually add task-level `created_at` or step-level `started_at`. `execute.py` records them.

### `phases/{task-name}/step{N}.md`

Create one Markdown file per step.

````markdown
# Step {N}: {name}

## Files To Read

First read these files and understand the architecture and design intent:

- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- {files created or changed by previous steps}

Read code from previous steps carefully before editing.

## Work

{Concrete implementation instructions. Include file paths, class/function signatures, behavior constraints, and only interface-level snippets unless exact implementation is required.}

## Acceptance Criteria

```bash
npm run build
npm run test
```

## Verification

1. Run the acceptance criteria commands.
2. Check the architecture checklist:
   - Does the work follow `ARCHITECTURE.md`?
   - Does it stay within `ADR.md` stack decisions?
   - Does it avoid violating CRITICAL rules in `AGENTS.md`?
3. Update `phases/{task-name}/index.json` for this step:
   - Success: set `"status": "completed"` and add `"summary": "one-line output summary"`.
   - Failure after 3 fix attempts: set `"status": "error"` and add `"error_message": "specific error"`.
   - User input needed: set `"status": "blocked"` and add `"blocked_reason": "specific reason"`, then stop.

## Do Not

- {Concrete forbidden action. Format: "Do not do X. Reason: Y."}
- Do not break existing tests.
````

## E. Execute

Only execute a planned task when the user asks for execution.

```bash
python scripts/execute.py {task-name}
python scripts/execute.py {task-name} --push
```

`execute.py` handles:

- creating or checking out `codex/{task-name}`
- injecting guardrails from `AGENTS.md` and `docs/*.md`
- passing completed step summaries to later steps
- retrying failed steps up to three times with the previous error message
- separating code and metadata commits
- recording `started_at`, `completed_at`, `failed_at`, and `blocked_at`

Recovery:

- For an `error` step, reset that step to `pending`, remove `error_message`, and rerun.
- For a `blocked` step, resolve `blocked_reason`, reset that step to `pending`, remove `blocked_reason`, and rerun.
