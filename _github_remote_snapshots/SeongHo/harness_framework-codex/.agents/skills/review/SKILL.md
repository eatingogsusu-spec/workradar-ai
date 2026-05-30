---
name: review
description: Use when the user asks to review local changes, validate a diff, check Harness guardrails, or replace the former Claude /review command in this Codex project.
---

# Project Review

Use this skill to review changes against the project's local contracts.

## Inputs To Read

Before reviewing changes, read:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`

Then inspect changed files with Git.

## Checklist

Check:

1. Architecture compliance: changed files follow `ARCHITECTURE.md`.
2. Stack compliance: changes stay within `ADR.md`.
3. Tests: new behavior has tests.
4. CRITICAL rules: changes avoid violating `AGENTS.md`.
5. Buildability: validation commands pass, or inability to run them is stated clearly.

## Output

For code reviews, lead with concrete findings ordered by severity and include file and line references. If there are no findings, say so explicitly.

Then include this checklist table:

| Item | Result | Notes |
| --- | --- | --- |
| Architecture compliance | pass/fail | {detail} |
| Stack compliance | pass/fail | {detail} |
| Tests | pass/fail | {detail} |
| CRITICAL rules | pass/fail | {detail} |
| Buildability | pass/fail | {detail} |

If there are violations, propose concrete fixes.
