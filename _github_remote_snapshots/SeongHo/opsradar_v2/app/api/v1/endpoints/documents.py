from uuid import UUID

from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.document import DocumentRead
from app.services.document_service import DocumentService


router = APIRouter()


@router.get("", response_model=list[DocumentRead])
async def list_documents(project_id: UUID, db: DbSession) -> list[DocumentRead]:
    return await DocumentService(db).list_documents(project_id)
