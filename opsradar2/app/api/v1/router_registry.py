"""Central API router registry.

New endpoint modules should be registered here instead of adding more
imports and include_router calls to app.api.api.
"""

from dataclasses import dataclass

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    calendar,
    chat,
    dashboard,
    documents,
    issues,
    knowledge,
    members,
    projects,
    reports,
    system,
    todos,
)


@dataclass(frozen=True)
class RouterSpec:
    router: APIRouter
    prefix: str
    tag: str


API_ROUTERS: tuple[RouterSpec, ...] = (
    RouterSpec(auth.router, "/auth", "auth"),
    RouterSpec(calendar.router, "/calendar", "calendar"),
    RouterSpec(projects.router, "/projects", "projects"),
    RouterSpec(documents.router, "/documents", "documents"),
    RouterSpec(todos.router, "/todos", "todos"),
    RouterSpec(issues.router, "/issues", "issues"),
    RouterSpec(dashboard.router, "/dashboard", "dashboard"),
    RouterSpec(reports.router, "/reports", "reports"),
    RouterSpec(knowledge.router, "/knowledge", "knowledge"),
    RouterSpec(members.router, "/members", "members"),
    RouterSpec(chat.router, "/chat", "chat"),
    RouterSpec(system.router, "/system", "system"),
)


def include_api_routers(api_router: APIRouter) -> None:
    for spec in API_ROUTERS:
        api_router.include_router(spec.router, prefix=spec.prefix, tags=[spec.tag])
