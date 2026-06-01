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
