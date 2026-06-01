# Project Context

This project is based on the Codex Harness template generated from:

- Source template: `C:\Users\sunghokim\Downloads\harness_framework-main.zip`
- Converted workspace folder: `C:\Users\sunghokim\Documents\New project\harness_framework-codex`
- Converted zip: `C:\Users\sunghokim\Documents\New project\harness_framework-codex.zip`

Use `harness_framework-codex` as the baseline for this project's handoff and step-based Codex workflow.

Key baseline conventions:

- Use `AGENTS.md` instead of `CLAUDE.md`.
- Use `.agents/skills/*/SKILL.md` instead of `.claude/commands`.
- Use `.codex/` hooks and config for Codex-specific guardrails.
- Use `scripts/execute.py` to run phase steps through `codex exec`.
- Use branch names with the `codex/` prefix.

## Dev Harness Snapshot

This branch applies a Codex Harness workflow to the latest `origin/dev`
application snapshot.

- Upstream baseline: `origin/dev` at `53d8985` (`fix all`)
- Harness adoption branch: `codex/dev-harness`
- Product application directory: `opsradar2/`

The existing local `SeongHo` worktree was intentionally left untouched because
it contains independent DB, documentation, and application changes. See
`docs/DEV_COMPARISON.md` for the initial comparison.

## Harness Commands

```bash
python scripts/execute.py --validate dev-stabilization
python scripts/execute.py dev-stabilization
```

Harness steps work from this repository root so that changes apply to the
actual `opsradar2/` application rather than to a detached template copy.
