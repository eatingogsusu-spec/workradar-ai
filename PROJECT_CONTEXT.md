# Project Context

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
