# Architecture

## Overview
TeamMemory의 DB는 프로젝트 중심 구조다. `users`는 행위자이고, `projects`가 문서, Todo, 이슈, 채팅, 보고서, 인수인계 결과의 소유 범위다.

## Data Ownership
- `teams`는 여러 `projects`를 가진다.
- `users`와 `projects`는 `project_members`로 N:N 연결된다.
- `documents`, `todos`, `issues`, `chat_messages`, `weekly_reports`, `handoff_reports`, `ai_summaries`는 모두 `project_id`를 가진다.
- `document_chunks`도 검색 필터 성능과 프로젝트 단위 RAG를 위해 `project_id`를 중복 저장한다.

## Storage Strategy
- PostgreSQL을 기본 RDB로 사용한다.
- 문서 파일 본문은 DB에 직접 저장하지 않고 `documents.storage_path`에 저장 위치만 둔다.
- 문서 검색용 chunk 본문은 `document_chunks.content`에 저장한다.
- embedding vector는 DB에 저장하지 않는다. `chunk_embeddings`에는 외부 vector store 이름, vector ID, embedding 모델만 저장한다.
- AI가 추출한 반정형 결과는 `jsonb`에 저장하되, 화면 집계에 필요한 Todo와 Issue는 별도 테이블에 저장한다.

## Dashboard Data
대시보드는 다음 데이터를 프로젝트 기준으로 조회한다.

- 최신 주간 보고의 `progress_rate`
- 이번 주 Todo 전체/완료/지연 수
- 미해결 이슈 및 진행 중 이슈 수
- 최신 인수인계 보고서의 `handoff_score`와 누락 항목 수

## File Layout
```text
db/
  schema.postgresql.sql
  seed.postgresql.sql
  dashboard-queries.postgresql.sql
docs/
  PRD.md
  ARCHITECTURE.md
  ADR.md
  db-design-v2.md
  table-definition.md
phases/
  index.json
  db-design-v2/
    index.json
    step0.md
    step1.md
    step2.md
```
