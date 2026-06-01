from fastapi import FastAPI

from app.api.api import api_router
from app.core.config import settings
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(title=settings.PROJECT_NAME, version=settings.API_VERSION)
    app.include_router(api_router, prefix=settings.API_PREFIX)
    return app


app = create_app()
