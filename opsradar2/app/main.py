from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.api import api_router
from app.core.config import settings
from app.core.database import engine, Base
from app.models import calendar, chunk, document, issue, organization, report, todo

app = FastAPI(
    title="OpsRadar API",
    version="1.0.0",
    description="운영 인텔리전스 AI — 백엔드 API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙
app.mount("/static", StaticFiles(directory="frontend"), name="static")

app.include_router(api_router, prefix="/api/v1")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# 루트 → index.html 반환
@app.get("/")
def root():
    return FileResponse("frontend/index.html")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "OpsRadar"}
