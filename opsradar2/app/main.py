from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.api import api_router

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"



ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

app = FastAPI(
    title="OpsRadar API",
    version="1.0.0",

    description="운영 인텔리전스 AI 백엔드 API",

)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def disable_frontend_cache(request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store"
    return response


app.mount("/static", StaticFiles(directory=FRONTEND), name="static")

app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
def root():
    return FileResponse(FRONTEND / "index.html")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "OpsRadar", "app": "opsradar2"}
