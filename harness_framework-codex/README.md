# TeamMemory DB Starter

프로젝트 단위 인수인계 서비스 TeamMemory의 DB 초안 산출물입니다.

## Files

- `docs/db-design-v2.md`: 프로젝트 중심 ERD v2와 설계 원칙
- `docs/table-definition.md`: 테이블 정의서
- `db/schema.postgresql.sql`: PostgreSQL DDL
- `db/seed.postgresql.sql`: 팀원 5명 기준 샘플 데이터
- `db/dashboard-queries.postgresql.sql`: 화면별 조회 쿼리

## Recommended Order

```bash
psql -d teammemory -f db/schema.postgresql.sql
psql -d teammemory -f db/seed.postgresql.sql
```

## Backend Contract Draft

백엔드와 먼저 맞춰야 할 API는 다음입니다.

```text
GET /projects/{project_id}/dashboard
GET /projects/{project_id}/todos
POST /projects/{project_id}/todos
PATCH /todos/{todo_id}
GET /projects/{project_id}/issues
POST /projects/{project_id}/issues
PATCH /issues/{issue_id}
GET /projects/{project_id}/documents
POST /projects/{project_id}/documents
POST /projects/{project_id}/chat
GET /projects/{project_id}/chat/messages
GET /projects/{project_id}/handoff/latest
```

## Notes

- 기본 DB는 PostgreSQL 기준입니다.
- 벡터 검색은 DB 내부 embedding 저장이 아니라 `chunk_embeddings.vector_store`와 `chunk_embeddings.vector_id`로 외부 vector store를 참조합니다.
- 모든 핵심 화면 데이터는 `project_id`를 기준으로 조회합니다.
