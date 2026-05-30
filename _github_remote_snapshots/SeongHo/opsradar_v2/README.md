# OpsRadar v2

OpsRadar v2 is the FastAPI backend for project-centered documents, AI-extracted Todos/issues, dashboards, weekly/monthly reports, handoff knowledge, and AI assistant workflows.

## Structure

- `app/core`: environment, database, logging, security
- `app/api/v1/endpoints`: UC-01 through UC-07 HTTP routes
- `app/models`: SQLAlchemy models matching the PostgreSQL ERD
- `app/schemas`: Pydantic request/response contracts
- `app/repositories`: database query layer
- `app/services`: business logic layer
- `app/ai`: parser, chunker, embedder, prompt, LLM, and analysis pipeline
- `app/vectorstores`: FAISS index management
- `data/faiss`: FAISS index file storage

## Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Run commands from the `opsradar_v2` directory so `.env` and `data/faiss` resolve correctly.
