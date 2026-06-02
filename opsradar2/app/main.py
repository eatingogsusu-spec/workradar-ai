from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.api import api_router


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

app.mount("/static", StaticFiles(directory=FRONTEND), name="static")
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return FileResponse(FRONTEND / "index.html")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "OpsRadar", "app": "opsradar2"}
