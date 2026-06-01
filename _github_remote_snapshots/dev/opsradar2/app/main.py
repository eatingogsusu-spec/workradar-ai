from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.api import api_router
from app.core.config import settings

app = FastAPI(
    title="OpsRadar API",
    version="1.0.0",
    description="운영 인텔리전스 AI — 백엔드 API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 배포 시 프론트 도메인으로 교체
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def health_check():
    return {"status": "ok", "service": "OpsRadar"}
