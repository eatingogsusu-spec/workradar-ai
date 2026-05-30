from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        CheckConstraint("chunk_index >= 0", name="document_chunks_index_check"),
        CheckConstraint("page_number IS NULL OR page_number > 0", name="document_chunks_page_check"),
        UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_document_index"),
        Index("idx_document_chunks_document_id", "document_id"),
        Index("idx_document_chunks_project_id", "project_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    document: Mapped[Document] = relationship("Document", back_populates="chunks")
    project: Mapped[Project] = relationship("Project", back_populates="document_chunks")
    embedding_refs: Mapped[list[ChunkEmbedding]] = relationship("ChunkEmbedding", back_populates="chunk", cascade="all, delete-orphan")
    source_todos: Mapped[list[Todo]] = relationship("Todo", back_populates="source_chunk")


class ChunkEmbedding(Base):
    __tablename__ = "chunk_embeddings"
    __table_args__ = (
        UniqueConstraint("faiss_index_path", "faiss_index_id", name="uq_chunk_embeddings_faiss_ref"),
        Index("idx_chunk_embeddings_chunk_id", "chunk_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    chunk_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="CASCADE"), nullable=False)
    faiss_index_path: Mapped[str] = mapped_column(String(500), nullable=False)
    faiss_index_id: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    chunk: Mapped[DocumentChunk] = relationship("DocumentChunk", back_populates="embedding_refs")
