# Architecture Decisions

## ADR-001: Apply Harness At Repository Root

Status: Accepted

The `dev` branch application already lives at `opsradar2/`. Harness control
files are added at repository root so phase execution edits and validates the
actual application tree rather than a copied template directory.

## ADR-002: Preserve The Existing FastAPI Layering

Status: Accepted

The current project has endpoint, schema, service, repository, and model
directories. New implementation work must preserve this separation and move
persistence out of route handlers when completing placeholder endpoints.

## ADR-003: Stabilize Contracts Before Completing Features

Status: Accepted

The frontend and backend are present on `dev`, but multiple endpoint modules
are incomplete. The first Harness phase audits route contracts and introduces
verification before broader implementation so merges do not accidentally
change payload shapes.
