from fastapi import APIRouter
from app.api.v1.endpoints import documents, todos, issues, dashboard, reports, knowledge, chat

api_router = APIRouter()

api_router.include_router(documents.router,  prefix="/documents",  tags=["documents"])
api_router.include_router(todos.router,      prefix="/todos",      tags=["todos"])
api_router.include_router(issues.router,     prefix="/issues",     tags=["issues"])
api_router.include_router(dashboard.router,  prefix="/dashboard",  tags=["dashboard"])
api_router.include_router(reports.router,    prefix="/reports",    tags=["reports"])
api_router.include_router(knowledge.router,  prefix="/knowledge",  tags=["knowledge"])
api_router.include_router(chat.router,       prefix="/chat",       tags=["chat"])
