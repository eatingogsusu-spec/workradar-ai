# DEV Comparison Baseline

## Compared Revisions

| Side | Revision | Notes |
| --- | --- | --- |
| Remote integration baseline | `origin/dev` at `53d8985` | Latest fetched `dev` branch from `juwon02/TeamAZAG` |
| Existing local branch | `SeongHo` at `54f9899` plus uncommitted files | Preserved in the original worktree |

The remote branch is named `dev` in lowercase; there is no separate uppercase
`DEV` branch in the fetched remote references.

## Structural Differences

| Area | `origin/dev` | Existing local worktree |
| --- | --- | --- |
| Backend app | `opsradar2/` FastAPI skeleton and partial implementations | `opsradar_v2/` plus root `app/` database-oriented implementation |
| Frontend | `opsradar2/frontend/index.html` | Untracked `frontend/` plus DB-oriented artifacts |
| Database/design assets | Limited application models | Root `db/`, Alembic, ERD assets, and detailed DB documentation |
| Harness | Not present before this branch | Nested `harness_framework-codex/` DB-design template |

## Integration Consequence

The trees are not a simple fast-forward update. Moving the current local files
directly onto `dev` would mix different app roots and DB approaches. This
branch therefore applies Harness to the fetched `dev` code independently and
leaves later integration decisions to explicit reviewed steps.
