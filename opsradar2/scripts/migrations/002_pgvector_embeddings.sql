CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE chunk_embeddings
    ALTER COLUMN faiss_index_id DROP NOT NULL,
    ALTER COLUMN vector_external_id DROP NOT NULL;

ALTER TABLE chunk_embeddings
    ADD COLUMN IF NOT EXISTS embedding vector(1536),
    ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(50) NOT NULL DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS error_message TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_chunk_embeddings_chunk_model'
    ) THEN
        ALTER TABLE chunk_embeddings
            ADD CONSTRAINT uq_chunk_embeddings_chunk_model UNIQUE (chunk_id, embedding_model);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_model_status
    ON chunk_embeddings(embedding_model, embedding_status);

CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_embedding_cosine
    ON chunk_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
    WHERE embedding IS NOT NULL;
