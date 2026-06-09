from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.api import api_router
from app.core.config import settings


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
FRONTEND_BUILD = FRONTEND / "build"
FRONTEND_DIST = FRONTEND / "dist"
FRONTEND_OUTPUT = FRONTEND_BUILD if FRONTEND_BUILD.exists() else FRONTEND_DIST
FRONTEND_ENTRY = (
    FRONTEND_OUTPUT / "index.html" if FRONTEND_OUTPUT.exists() else FRONTEND / "index.html"
)
FRONTEND_PUBLIC_STATIC = FRONTEND / "public" / "static"
FRONTEND_STATIC = (
    FRONTEND_OUTPUT / "static" if (FRONTEND_OUTPUT / "static").exists() else FRONTEND_PUBLIC_STATIC
)

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


react_assets = FRONTEND_OUTPUT / "assets"
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


@app.api_route("/static/{asset_type}/{asset_path:path}", methods=["GET", "HEAD"])
def frontend_static_asset(asset_type: str, asset_path: str):
    for static_root in (FRONTEND_STATIC, FRONTEND_PUBLIC_STATIC):
        candidate = (static_root / asset_type / asset_path).resolve()
        if candidate.is_file() and candidate.is_relative_to(static_root.resolve()):
            return FileResponse(candidate)
    raise HTTPException(status_code=404, detail="Not found")


@app.get("/{path:path}")
def spa_fallback(path: str):
    if path.startswith(("api/", "docs", "openapi.json", "redoc")):
        raise HTTPException(status_code=404, detail="Not found")
    for static_root in (FRONTEND_OUTPUT, FRONTEND / "public"):
        candidate = (static_root / path).resolve()
        if candidate.is_file() and candidate.is_relative_to(static_root.resolve()):
            return FileResponse(candidate)
    if FRONTEND_OUTPUT.exists() and FRONTEND_ENTRY.exists() and "." not in Path(path).name:
        return FileResponse(FRONTEND_ENTRY)
    return FileResponse(FRONTEND / "index.html")
