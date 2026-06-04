from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.api import api_router
from app.core.config import settings


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
FRONTEND_DIST = FRONTEND / "dist"
FRONTEND_ENTRY = FRONTEND_DIST / "index.html" if FRONTEND_DIST.exists() else FRONTEND / "index.html"
FRONTEND_STATIC = FRONTEND_DIST if FRONTEND_DIST.exists() else FRONTEND

app = FastAPI(
    title="OpsRadar API",
    version="1.0.0",
    description="OpsRadar operations intelligence API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.FRONTEND_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def disable_frontend_cache(request, call_next):
    response = await call_next(request)
    if (
        request.url.path == "/"
        or request.url.path.startswith("/static/")
        or request.url.path.startswith("/assets/")
    ):
        response.headers["Cache-Control"] = "no-store"
    return response


if FRONTEND_STATIC.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_STATIC), name="static")

react_assets = FRONTEND_DIST / "assets"
if react_assets.exists():
    app.mount("/assets", StaticFiles(directory=react_assets), name="assets")

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return FileResponse(FRONTEND_ENTRY)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "OpsRadar",
        "app": "opsradar2",
        "db_schema": settings.DB_SCHEMA,
    }


@app.get("/{path:path}")
def spa_fallback(path: str):
    if path.startswith(("api/", "docs", "openapi.json", "redoc")):
        raise HTTPException(status_code=404, detail="Not found")
    if FRONTEND_DIST.exists() and FRONTEND_ENTRY.exists() and "." not in Path(path).name:
        return FileResponse(FRONTEND_ENTRY)
    return FileResponse(FRONTEND / "index.html")
