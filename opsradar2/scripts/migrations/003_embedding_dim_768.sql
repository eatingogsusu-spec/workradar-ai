-- Move chunk_embeddings.embedding from vector(1536) (Azure text-embedding-3-*)
-- to vector(768) (local Ollama nomic-embed-text), matching EMBEDDING_DIMENSION.
--
-- 1536-dim vectors cannot be reinterpreted as 768-dim, so any existing Azure rows are
-- dropped rather than converted; re-run scripts/backfill_pgvector_embeddings.py after.
--
-- The ivfflat index is dropped and NOT recreated: it buckets rows into `lists` clusters
-- and probes one by default, so at low row counts it silently drops results (at 88 rows
-- a top_k=3 search returned 1 row). Exact search is fast into the low tens of thousands
-- of chunks. Recreate it when the table is large, with lists ~= rows/1000.

BEGIN;

SET LOCAL search_path TO opsradar2;

DROP INDEX IF EXISTS idx_chunk_embeddings_embedding_cosine;

DELETE FROM chunk_embeddings
WHERE embedding IS NOT NULL
  AND embedding_dimension <> 768;

ALTER TABLE chunk_embeddings
    ALTER COLUMN embedding TYPE vector(768);

COMMIT;
