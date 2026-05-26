---
name: review
description: Use when reviewing TeamAZAG changes against Harness architecture and verification rules.
---

# Project Review

Read `AGENTS.md`, `docs/ARCHITECTURE.md`, and `docs/ADR.md`, then review the
diff with findings first.

Check that endpoint contracts remain consistent with the frontend, async
database access remains in repositories/services, secrets are not committed,
and changed behavior has runnable verification.
