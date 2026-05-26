# Architecture

## Runtime Layout

`opsradar2/app/main.py` creates the FastAPI application, serves the local
frontend, and mounts the versioned router at `/api/v1`. The API router composes
calendar, documents, todos, issues, dashboard, reports, knowledge, and chat
endpoint modules.

## Backend Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| HTTP endpoints | `opsradar2/app/api/v1/endpoints/` | Parse HTTP input and return typed API output |
| Schemas | `opsradar2/app/schemas/` | Request and response models |
| Services | `opsradar2/app/services/` | Application workflows and cross-repository decisions |
| Repositories | `opsradar2/app/repositories/` | Async SQLAlchemy persistence |
| Models | `opsradar2/app/models/` | Relational database entities |
| AI and vectors | `opsradar2/app/ai/`, `opsradar2/app/vectorstores/` | Extraction, generation, and retrieval adapters |

## Current Baseline

The `dev` branch is partially implemented. Calendar endpoints are connected to
a repository and database dependency, while several todo, issue, document,
dashboard, report, knowledge, and chat paths still return placeholder data or
contain TODO work. Harness steps must distinguish existing behavior from
planned behavior before changing API contracts.

## Change Checklist

- Preserve the `/api/v1` prefix and frontend-consumed response shapes unless a
  step explicitly updates both sides.
- Keep database operations asynchronous and dependency-injected.
- Add verification for each implemented endpoint path.
- Treat AI integrations and credentials as configurable external dependencies.
