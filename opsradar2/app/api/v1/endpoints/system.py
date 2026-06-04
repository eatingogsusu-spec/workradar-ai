"""Runtime metadata for frontend clients."""

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def api_health():
    return {
        "status": "ok",
        "service": "OpsRadar",
        "app": "opsradar2",
        "api_version": "v1",
        "db_schema": settings.DB_SCHEMA,
    }


@router.get("/frontend-config")
async def frontend_config():
    return {
        "apiBase": "/api/v1",
        "healthPath": "/api/v1/system/health",
        "docsPath": "/docs",
        "features": {
            "dashboard": True,
            "todos": True,
            "issues": True,
            "calendar": True,
            "reports": True,
            "assistant": True,
            "handoff": True,
        },
    }
