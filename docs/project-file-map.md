# TeamAZAG / TeamMemory 프로젝트 파일 지도

작성 기준일: 2026-05-25

이 문서는 현재 워크스페이스에 무엇이 들어 있는지, 어느 파일이 실제 구현 대상인지, 어느 파일이 초안/복사본/생성 결과물인지 빠르게 판단하기 위한 안내서다.

## 1. 먼저 결론

현재 폴더에는 하나의 완성된 앱만 있는 것이 아니라 아래 네 종류가 함께 있다.

| 구분 | 위치 | 의미 | 지금 수정 대상으로 볼지 |
| --- | --- | --- | --- |
| 현재 실행 후보 | `app/`, `db/`, `frontend/`, `docs/`, `alembic/` | FastAPI API, PostgreSQL v3 설계, 정적 프론트 데모 | 우선 확인 대상 |
| 차기 백엔드 구조 초안 | `opsradar_v2/` | API/Service/Repository/AI 계층을 나눈 별도 FastAPI 골격 | 채택 여부를 먼저 결정 |
| 작업 절차 템플릿 | `harness_framework-codex/` | Codex 단계 실행과 설계 문서 템플릿 | 제품 코드 아님 |
| 복사본/스냅샷/생성물 | `_Project_AZAG_rebuild/`, `_github_remote_snapshots/`, `project_azag_untracked_backup/`, ERD 이미지/PDF, 로컬 DB 데이터 | 복원/비교/열람용 자료 | 직접 개발 기준으로 삼지 않음 |

가장 중요한 사실은 DB 기준이 섞여 있다는 점이다.

- `db/schema.postgresql.sql`과 현재 `app/main.py`는 v3 설계다. `analysis_jobs`, `project_reports`, `chat_sessions`, `handoff_items` 등이 있다.
- `app/models.py`, Alembic 최초 migration, `opsradar_v2/app/models/`는 예전 설계를 상당 부분 유지한다. `weekly_reports`, `monthly_reports`, `ai_summaries`를 사용한다.
- `frontend/index.html`은 완성 화면처럼 보이지만 API 연동 앱이 아니라 브라우저 안의 배열 데이터를 조작하는 시연용 단일 HTML이다.

따라서 기능을 더 붙이기 전에 `v3 DB + 어느 백엔드 구조를 공식 구현으로 할지`를 먼저 고정해야 한다.

## 2. 추천 열람 순서

| 순서 | 파일/폴더 | 무엇을 확인하는가 |
| --- | --- | --- |
| 1 | `docs/PRD.md` | 이 프로젝트가 해결하려는 문제와 MVP 우선순위 |
| 2 | `frontend/index.html` | 현재 목표 화면과 사용자가 누르게 될 기능 |
| 3 | `docs/teamazag-functions-v3.md` | 화면 기능이 어떤 DB 데이터로 이어져야 하는지 |
| 4 | `db/schema.postgresql.sql` | 현재 v3 기준 데이터 구조 |
| 5 | `app/main.py` | 현재 루트 API가 실제로 지원하는 기능 |
| 6 | `opsradar_v2/README.md`와 `opsradar_v2/app/` | 계층형 백엔드로 옮길지 판단 |
| 7 | `app/models.py`, `alembic/` | v3 기준으로 다시 맞춰야 할 이전 설계 영역 |

## 3. 현재 루트 애플리케이션

### 최상위 파일

| 파일 | 역할 | 현재 판단 |
| --- | --- | --- |
| `README.md` | PostgreSQL 중심 TeamAZAG DB Starter 안내, API 초안과 실행 순서 | 일부 내용이 구형이다. `weekly_reports`, `monthly_reports`, `chat_messages.sources_json` 설명은 v3 SQL과 다름 |
| `PROJECT_CONTEXT.md` | Harness 템플릿 출처와 Codex 작업 규칙 설명 | 제품 기능보다 작업 방식 설명 |
| `requirements.txt` | 루트 API 실행 의존성: FastAPI, Uvicorn, SQLAlchemy, Alembic, Psycopg | 루트 앱용 최소 의존성 |
| `alembic.ini` | Alembic 설정과 기본 PostgreSQL 접속 URL | migration 사용 시 필요 |
| `.gitignore` | Python/IDE/환경파일/로컬 PostgreSQL 데이터 제외 규칙 | `db/*.ps1`도 무시하므로 로컬 스크립트가 커밋에서 빠질 수 있음 |
| `harness_framework-codex.zip` | 템플릿 압축 사본 | 제품 실행에 불필요 |
| `.uvicorn-8001.out.log`, `.uvicorn-8001.err.log` | 로컬 서버 실행 로그 | 빈 로컬 산출물, 코드 아님 |
| `.venv/` | Python 가상환경 | 생성 환경, 수정 대상 아님 |

### `app/`: 현재 루트 FastAPI 서버

| 파일 | 역할 | 연결 관계/주의점 |
| --- | --- | --- |
| `app/__init__.py` | Python 패키지 표시 파일 | 로직 없음 |
| `app/database.py` | `DATABASE_URL`을 읽고 SQLAlchemy 동기 엔진과 `get_db()` 세션 의존성 생성 | `app/main.py`가 모든 DB 접근에 사용. 기본 DB는 `teamazag` |
| `app/main.py` | 루트 FastAPI 앱 본체. 프론트 정적 제공, CORS, Pydantic 요청 모델, SQL 기반 CRUD/API 라우트를 한 파일에 구현 | 현재 실행 백엔드의 중심 파일. ORM이 아니라 v3 SQL 테이블명을 직접 사용 |
| `app/models.py` | SQLAlchemy ORM 모델 초안 | v2 계열 모델. 현재 v3 SQL/API와 바로 맞지 않으므로 공식 ORM으로 사용하려면 개편 필요 |

`app/main.py`가 제공하는 기능:

| 영역 | 엔드포인트/행동 | 구현 상태 |
| --- | --- | --- |
| 서버/프론트 | `/`, `/health`, `/front/*` | `frontend/`가 있으면 정적 페이지를 제공 |
| 데모 전용 | `/api/dashboard`, `/api/assistant/chat` | DB를 읽지 않는 고정/규칙 기반 응답 |
| 프로젝트 | `GET /projects`, `GET /users/{user_id}/projects` | DB 조회 |
| 대시보드 | `GET /projects/{project_id}/dashboard` | v3 테이블을 집계 조회 |
| Todo | 조회, AI 승인대기 조회, 생성, 수정, 승인/거절 | DB CRUD 구현 |
| 이슈 | 조회, 생성, 수정 | DB CRUD 구현. 상태 이력 기록 API는 없음 |
| 문서 | 조회, 메타데이터 생성 | 실제 파일 업로드/파싱은 없음 |
| 채팅 | 메시지 생성, 메시지/출처 조회 | 세션/메시지 저장은 구현. AI 답변 생성/RAG 저장은 없음 |
| 인수인계 | 최신 보고서와 항목 조회 | DB 조회 구현 |

### `db/`: 데이터베이스 설계와 검증

| 파일/폴더 | 역할 | 현재 판단 |
| --- | --- | --- |
| `db/schema.postgresql.sql` | 현재 기본 PostgreSQL DDL. 22개 테이블의 v3 스키마 | `app/main.py`가 기대하는 기준 스키마 |
| `db/seed.postgresql.sql` | v3 화면 시연용 사용자, 문서, 분석, Todo, 이슈, 보고서, 채팅, 활동 로그 샘플 데이터 | 현재 수정 표시가 있는 작업 파일 |
| `db/dashboard-queries.postgresql.sql` | 화면별 조회 SQL 예시 9종 | 현재 수정 표시가 있는 작업 파일 |
| `db/verify.postgresql.sql` | v3 테이블/제약/FAISS 참조 구조 확인 쿼리 | 기본 검증 파일 |
| `db/schema.v3.postgresql.sql` | `schema.postgresql.sql`과 거의 같은 별도 v3 사본 | 중복 기준을 없애고 하나만 공식화할 필요 있음 |
| `db/verify.v3.postgresql.sql` | `verify.postgresql.sql`과 거의 같은 별도 v3 검증 사본 | 중복 관리 위험 |
| `db/apply-local-teamazag.ps1` | 포트 `55432` 로컬 검증 DB를 재생성하고 기본 schema/verify 실행 | 로컬 도움 스크립트이며 `.gitignore`에 의해 추적되지 않음 |
| `db/run-v3-local.ps1` | 기본 PostgreSQL 서비스에 v3 전용 schema/verify를 적용하는 스크립트 | 로컬 도움 스크립트이며 추적되지 않음 |
| `db/local_pgdata_teamazag/` | 검증용 PostgreSQL 데이터 디렉터리, 약 1,400개 내부 파일 포함 | 실행 데이터. 열람/수정/커밋 대상 아님 |
| `db/local_pg_teamazag.log` | 검증용 PostgreSQL 로그 | 실행 산출물 |

v3 기본 스키마의 영역:

| 영역 | 테이블 |
| --- | --- |
| 사용자/프로젝트 | `users`, `teams`, `projects`, `project_members` |
| 문서/RAG | `documents`, `document_chunks`, `chunk_embeddings` |
| AI 분석 | `analysis_jobs`, `analysis_steps`, `ai_extractions` |
| 업무 | `todos`, `issues`, `issue_status_history` |
| 캘린더/위험 | `project_events`, `risk_windows` |
| 보고/인수인계 | `project_reports`, `handoff_reports`, `handoff_items` |
| AI 채팅 | `chat_sessions`, `chat_messages`, `chat_message_sources` |
| 활동/감사 기초 | `project_activity_logs` |

### `alembic/`: DB migration 초안

| 파일 | 역할 | 현재 판단 |
| --- | --- | --- |
| `alembic/env.py` | Alembic이 `app.models.Base`와 `DATABASE_URL`을 이용하도록 연결 | ORM이 구형이면 migration도 구형 기준이 됨 |
| `alembic/versions/20260513_0001_create_teammemory_schema.py` | 초기 스키마 생성/삭제 migration | `weekly_reports`, `monthly_reports`, `ai_summaries` 기반의 이전 스키마. v3 SQL과 불일치 |

### `frontend/`: 현재 화면 데모

| 파일 | 역할 | 현재 판단 |
| --- | --- | --- |
| `frontend/index.html` | CSS, HTML, JavaScript가 모두 들어 있는 단일 화면 데모. Dashboard, 분석 업로드 흐름, Todo, 이슈, 캘린더, 인수인계, 보고서, AI Assistant 화면 제공 | `fetch()` 호출이 없고 `todos`, `issues`, `chatResponses` 배열로 동작한다. 즉 디자인/시연물이지 서버 연결 프론트는 아님 |

현재 프론트가 보여주는 기능은 v3 DB 설계를 만든 기준이지만, 실제 API 연동 작업은 아직 남아 있다.

### `docs/`: 제품/DB/ERD 문서

| 파일/폴더 | 역할 | 현재 판단 |
| --- | --- | --- |
| `docs/PRD.md` | TeamMemory 목표, 사용자, 핵심 흐름, UC-00~UC-09, MVP 순위 | 제품 요구사항의 기준 문서 |
| `docs/teamazag-functions-v3.md` | 최종 프론트 화면별 기능과 필요한 데이터, v3 데이터 흐름 | v3 기능-DB 연결 기준 |
| `docs/teamazag-db-design-v3.md` | v3 테이블 설계 원칙과 화면 대응 | v3 설계 설명본 |
| `docs/db-design-v2.md` | 이름은 v2지만 현재 내용은 v3 문서와 동일한 상태 | 이름/중복 정리가 필요 |
| `docs/table-definition.md` | 테이블 요약, 핵심 제약, Todo 승인/이슈 후보/RAG 출처 모델 | DB 구현 시 참고 문서 |
| `docs/team-memory-erd.mmd` | Mermaid 전체 ERD 원본 | `teamazag-erd-v3.mmd`와 중복 여부를 정리할 대상 |
| `docs/teamazag-erd-v3.mmd` | v3 Mermaid ERD 사본 | 신규/비추적 파일 |
| `docs/project-azag-erdcloud-white.{svg,html,pdf}` | 전체 ERD 열람/공유용 렌더링 산출물 | 사람이 보는 산출물, 직접 편집보다 생성 스크립트를 고침 |
| `docs/erd-split/` | 영역별 ERD 5종의 `.mmd`, `.svg`, `.html`, `.png`, `.pdf`와 인덱스 | 생성/공유용 결과물 |
| `docs/notion-db-images/` | Notion에서 가져온 것으로 보이는 페이지 이미지 16개 | 참고 이미지, 제품 코드 아님 |
| `docs/project-file-map.md` | 이 파일. 전체 구조와 수정 우선순위 안내 | 온보딩/정리 문서 |

### `tools/`: ERD 산출물 생성기

| 파일 | 역할 | 출력 위치 |
| --- | --- | --- |
| `tools/generate_erdcloud_assets.py` | 전체 DB ERD를 SVG/HTML로 렌더링하는 생성 스크립트 | `docs/project-azag-erdcloud-white.svg`, `.html` |
| `tools/generate_split_erds.py` | core, AI/문서, Todo/이슈, 보고/인수인계, assistant/RAG 영역별 ERD 생성 | `docs/erd-split/` |
| `tools/__pycache__/` | Python 실행 캐시 | 수정/커밋 대상 아님 |

## 4. `opsradar_v2/`: 계층형 백엔드 초안

이 폴더는 루트 `app/main.py`와 별개의 애플리케이션 구조다. 좋은 방향의 폴더 분리는 되어 있지만 아직 실제 제품 백엔드로 연결 완료된 것은 아니다.

### 기본 파일

| 파일 | 역할 | 구현 상태 |
| --- | --- | --- |
| `opsradar_v2/README.md` | 구조와 실행 방법 설명 | 이 폴더의 안내서 |
| `opsradar_v2/requirements.txt` | `pydantic-settings`, `python-multipart`까지 포함한 의존성 | 루트와 별도 관리 중 |
| `opsradar_v2/.env.example` | DB, API prefix, FAISS, AI provider, 비밀키 환경변수 예시 | 실제 `.env` 생성 기준 |
| `opsradar_v2/.gitignore` | 이 하위 앱용 제외 규칙 | 설정 파일 |
| `opsradar_v2/data/faiss/.gitkeep` | FAISS 파일 저장 폴더를 Git에 유지 | 실제 인덱스는 아직 없음 |
| `opsradar_v2/tests/__init__.py` | 테스트 패키지 표시 | 실제 테스트 없음 |

### 실행/설정 계층

| 파일 | 역할 | 구현 상태 |
| --- | --- | --- |
| `opsradar_v2/app/main.py` | 앱 생성, 로깅 초기화, `/api/v1` 라우터 장착 | 기본 앱 진입점 구현 |
| `opsradar_v2/app/core/config.py` | 환경변수 로딩, DB URL/FAISS/AI provider/토큰 설정 | 구현됨. 기본 DB 이름은 루트와 다른 `opsradar` |
| `opsradar_v2/app/core/database.py` | SQLAlchemy async 엔진, 세션, `create_all()` | 구현됨. 루트의 동기 DB 방식과 별개 |
| `opsradar_v2/app/core/logging.py` | 기본 로깅 설정 | 간단 구현 |
| `opsradar_v2/app/core/security.py` | UTC 시각과 토큰 만료 계산 | 인증/인가 자체는 미구현 |

### API 엔드포인트 계층

| 파일 | 역할 | 구현 상태 |
| --- | --- | --- |
| `app/api/api.py` | documents, todos, issues, dashboard, reports, knowledge, chat 라우터 묶음 | 구현됨 |
| `app/api/deps.py` | DB 세션 FastAPI dependency 타입 | 구현됨 |
| `app/api/v1/endpoints/documents.py` | 프로젝트 문서 목록 조회 | 조회만 존재 |
| `app/api/v1/endpoints/todos.py` | 공식 Todo와 후보 Todo 목록 조회 | 생성/수정/승인 API 없음 |
| `app/api/v1/endpoints/issues.py` | 이슈 목록과 후보 목록 조회 | 생성/확정/상태변경 API 없음 |
| `app/api/v1/endpoints/dashboard.py` | 대시보드 summary 조회 | service 호출 |
| `app/api/v1/endpoints/reports.py` | 주간/월간/최신 인수인계 조회 | 이전 보고서 모델 사용 |
| `app/api/v1/endpoints/knowledge.py` | 온보딩 brief 조회 | 서비스가 미구현 안내만 반환 |
| `app/api/v1/endpoints/chat.py` | AI Assistant POST | 실제 AI 없이 고정 문장 반환 |
| 각 `__init__.py` | Python 패키지 경계 표시 | 로직 없음 |

### 데이터 모델 계층

| 파일 | 역할 | 구현 상태/주의점 |
| --- | --- | --- |
| `app/models/__init__.py` | Base, TimestampMixin, User, Team, Project, ProjectMember, ChatMessage, AISummary 정의 및 나머지 모델 re-export | v2 모델 기반 |
| `app/models/document.py` | `Document` ORM | 문서 모델 |
| `app/models/chunk.py` | `DocumentChunk`, `ChunkEmbedding` ORM | 문서 chunk/벡터 참조 |
| `app/models/todo.py` | `Todo` ORM | 승인 후보 구조 포함 |
| `app/models/issue.py` | `Issue` ORM | 후보 여부 포함 |
| `app/models/report.py` | `WeeklyReport`, `MonthlyReport`, `HandoffReport` ORM | v3의 통합 `project_reports`와 불일치 |

### 요청/응답 스키마 계층

| 파일 | 역할 |
| --- | --- |
| `app/schemas/document.py` | 문서 생성/조회 Pydantic 모델 |
| `app/schemas/todo.py` | Todo 생성/조회 모델 |
| `app/schemas/issue.py` | 이슈 생성/조회 모델 |
| `app/schemas/dashboard.py` | 집계 응답 모델 |
| `app/schemas/report.py` | 주간/월간/인수인계 응답 모델 |
| `app/schemas/chat.py` | 질문, 메시지, 답변 응답 모델 |
| `app/schemas/__init__.py` | 패키지 표시 |

### Repository/Service 계층

| 파일 | 역할 | 구현 상태 |
| --- | --- | --- |
| `app/repositories/document_repository.py` | Document DB 조회 | 기본 조회 |
| `app/repositories/chunk_repository.py` | Chunk DB 조회 | 기본 조회 |
| `app/repositories/todo_repository.py` | Todo 공식/후보 조회 | 기본 조회 |
| `app/repositories/issue_repository.py` | Issue 조회 | 기본 조회 |
| `app/repositories/report_repository.py` | 보고서/인수인계 조회 | 구형 보고서 모델 기준 |
| `app/services/document_service.py` | 문서 repository 호출 | 얇은 전달 계층 |
| `app/services/todo_service.py` | Todo 목록 서비스 | 조회 중심 |
| `app/services/issue_service.py` | Issue 목록 서비스 | 조회 중심 |
| `app/services/report_service.py` | 보고서 조회 서비스 | 조회 중심 |
| `app/services/dashboard_service.py` | Todo/Issue/Handoff 집계 | ORM 집계 구현, v2 모델 기준 |
| `app/services/knowledge_service.py` | 인수인계/온보딩 지식 요약 | 아직 미구현 메시지 반환 |
| 각 `__init__.py` | 패키지 표시 | 로직 없음 |

### AI/벡터/유틸리티 계층

| 파일 | 역할 | 구현 상태 |
| --- | --- | --- |
| `app/ai/file_parser.py` | 파일 내용을 읽는 파서 자리 | 최소 골격 |
| `app/ai/chunker.py` | 텍스트 chunk 분리 | 간단 구현 |
| `app/ai/embedder.py` | 임베딩 생성 인터페이스 | 실제 임베딩 대신 0 벡터 반환 |
| `app/ai/prompt_builder.py` | 추출용 프롬프트 문자열 생성 | 최소 구현 |
| `app/ai/llm_client.py` | LLM 호출 인터페이스 | `mock`만 `{}` 반환, 실제 provider는 `NotImplementedError` |
| `app/ai/analysis_runner.py` | prompt builder와 LLM client 연결 | 호출 흐름만 구현 |
| `app/vectorstores/faiss_store.py` | 프로젝트별 FAISS 인덱스 경로 생성 | 파일 경로만 관리, 검색/저장 미구현 |
| `app/utils/text_normalizer.py` | 공백 정규화 | 작은 유틸 |
| `app/utils/date_parser.py` | ISO 날짜 파싱 | 작은 유틸 |
| `app/utils/alias_normalizer.py` | 문자열 별칭 정규화 | 작은 유틸 |
| `app/integrations/README.md` | 외부 연동 코드를 둘 자리 설명 | 코드 없음 |
| `app/jobs/README.md` | 배치/비동기 작업을 둘 자리 설명 | 코드 없음 |
| 모든 `__pycache__/` | 실행으로 생성된 바이트코드 캐시 | 수정/커밋 대상 아님 |

## 5. Harness 템플릿

`harness_framework-codex/`는 제품 애플리케이션이 아니라 작업 절차와 초기 DB 설계를 관리하던 템플릿 폴더다.

| 위치 | 역할 |
| --- | --- |
| `AGENTS.md` | 프로젝트 작업 규칙: project 중심 데이터, password hash, vector 참조, 문서 동기화 원칙 |
| `README.md` | 템플릿 설명과 초기 API 계약 |
| `.codex/config.toml`, `.codex/hooks.json`, `.codex/hooks/tdd-guard.sh` | Codex 실행/가드 설정 |
| `.agents/skills/harness/SKILL.md`, `.agents/skills/review/SKILL.md` | 템플릿용 작업/리뷰 지침 |
| `docs/PRD.md`, `ARCHITECTURE.md`, `ADR.md`, `UI_GUIDE.md`, `db-design-v2.md`, `table-definition.md` | 초창기 설계 문서 |
| `db/schema.postgresql.sql`, `seed.postgresql.sql`, `dashboard-queries.postgresql.sql` | 초창기 SQL 자료 |
| `phases/index.json`, `phases/db-design-v2/*` | 단계별 작업 상태와 지시문. `index.json`은 현재 수정 상태 |
| `scripts/execute.py`, `scripts/test_execute.py` | 단계 작업 실행/테스트 도구 |

## 6. 복사본, 스냅샷, 생성 자료

| 위치 | 내용 | 사용 원칙 |
| --- | --- | --- |
| `_Project_AZAG_rebuild/` | 루트 프로젝트의 재구성 사본. 프론트 HTML과 v3 schema는 루트와 같은 파일이 있으나 API/문서 등은 다른 버전 | 복원/비교할 때만 사용, 여기서 신규 개발하지 않음 |
| `project_azag_untracked_backup/` | ERD HTML/SVG/PNG/PDF 및 분할 ERD 백업 | 결과물 백업 |
| `_github_remote_snapshots/SeongHo/` | SeongHo 브랜치의 전체 프로젝트 스냅샷 | 과거/원격 비교용 |
| `_github_remote_snapshots/dev/` | dev 쪽 `opsradar2` 백엔드 스냅샷 | 비교용 |
| `_github_remote_snapshots/SeongWoo/` | AI 관련 모듈과 dummy 문서 데이터 | 가져올 기능 검토용 |
| `_github_remote_snapshots/*.zip` | 브랜치 다운로드 압축물 | 보관본 |
| `docs/**/*.svg`, `docs/**/*.png`, `docs/**/*.pdf`, `docs/**/*.html` | ERD를 보기 편하게 렌더링한 산출물 | 원본 `.mmd`/생성 스크립트 변경 후 재생성 |

## 7. 현재 서로 맞지 않는 부분

| 문제 | 관련 파일 | 왜 먼저 해결해야 하는가 |
| --- | --- | --- |
| v3 SQL과 ORM/migration 불일치 | `db/schema.postgresql.sql`, `app/main.py` 대 `app/models.py`, `alembic/`, `opsradar_v2/app/models/` | 어느 경로로 DB를 만들었는지에 따라 API가 깨질 수 있음 |
| 백엔드가 두 벌 존재 | `app/` 대 `opsradar_v2/app/` | 기능을 어디에 추가할지 결정하지 않으면 중복 구현이 계속됨 |
| 프론트가 시연 데이터로만 동작 | `frontend/index.html` | UI 클릭 결과가 DB/API에 저장되지 않음 |
| 인증/권한이 요구사항보다 뒤처짐 | `docs/PRD.md`, `app/main.py`, `opsradar_v2/app/core/security.py` | PRD의 최우선 UC-00인데 실제 접근 통제가 없음. 루트 앱은 CORS도 전체 허용 |
| AI/RAG가 설계만 있고 실제 처리가 없음 | `frontend/index.html`, 루트 `app/main.py`, `opsradar_v2/app/ai/`, `app/vectorstores/` | 분석/assistant가 실데이터 근거 기반으로 작동하지 않음 |
| 자동 테스트가 사실상 없음 | `opsradar_v2/tests/__init__.py`, 루트 전체 | 스키마/API를 바꿀 때 회귀 확인이 어려움 |
| 문서/SQL/복사본 중복 | `docs/*v3*`, `docs/db-design-v2.md`, `db/*.v3.*`, 복사 폴더 | 팀원이 어떤 파일을 수정해야 하는지 계속 헷갈림 |

## 8. 무엇을 고칠지 결정하는 우선순위

| 우선순위 | 해야 할 결정/작업 | 대상 파일 |
| --- | --- | --- |
| 1 | 공식 DB 기준을 v3로 확정하고 ORM/Alembic을 v3에 맞춘다 | `db/schema.postgresql.sql`, `app/models.py`, `alembic/` |
| 2 | 공식 백엔드를 루트 단일 파일로 계속 갈지, `opsradar_v2` 계층 구조로 옮길지 결정한다 | `app/`, `opsradar_v2/app/` |
| 3 | 프론트의 주요 동작을 실제 API에 연결한다 | `frontend/index.html`, 선택한 백엔드 |
| 4 | 로그인/역할/프로젝트 권한/감사 로그를 먼저 구현한다 | PRD UC-00, 백엔드/DB |
| 5 | 문서 업로드, 분석 job, chunk, AI 추출, FAISS/RAG 파이프라인을 실제화한다 | v3 DB, AI 계층 |
| 6 | API와 DB 검증 테스트를 추가한다 | 새 `tests/`와 DB 검증 흐름 |
| 7 | 복사본/중복 문서/생성 파일의 보관 정책을 정한다 | 저장소 구조 전체 |

## 9. 현재 작업 상태 주의

확인 시점에 Git 작업 트리에는 다음 변경/추가 항목이 있었다. 이미 진행 중인 작업일 수 있으므로, 정리나 리팩터링을 시작할 때 무심코 덮어쓰지 않아야 한다.

- 수정됨: `app/main.py`, `db/dashboard-queries.postgresql.sql`, `db/seed.postgresql.sql`, `harness_framework-codex/phases/db-design-v2/index.json`
- 새로 존재함: `frontend/`, `_Project_AZAG_rebuild/`, `_github_remote_snapshots/`, `project_azag_untracked_backup/`, `docs/notion-db-images/`, `docs/teamazag-db-design-v3.md`, `docs/teamazag-erd-v3.mmd`, `db/schema.v3.postgresql.sql`, `db/verify.v3.postgresql.sql`

이 프로젝트에서 당장 코드를 고치기 전에 할 가장 효율적인 일은 `v3를 공식 기준으로 선언하고`, `루트 app`과 `opsradar_v2` 중 하나를 공식 백엔드로 선택하는 것이다. 그 선택이 끝나면 나머지 파일은 정리할 것, 옮길 것, 삭제 후보가 명확해진다.
