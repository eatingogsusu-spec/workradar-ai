# Azure VM PostgreSQL 적용 및 VS Code 연결

현재 프로젝트의 실행 기준은 `db/schema.postgresql.sql`과 `app/main.py`입니다. 이 스키마는 화면/API가 사용하는 v3 구조이며 총 22개 테이블을 생성합니다.

`app/models.py`와 `alembic/versions/20260513_0001_create_teammemory_schema.py`는 이전 설계가 남아 있으므로, Azure VM의 빈 `azag_db`를 처음 구성할 때는 Alembic 대신 아래 SQL 파일을 직접 실행합니다.

## 1. DBeaver에서 ERD 테이블 생성

대상 DB가 비어 있을 때 아래 순서로 진행합니다.

1. DBeaver에서 연결된 `azag_db`를 선택합니다.
2. SQL Editor에서 `db/schema.postgresql.sql` 파일을 엽니다.
3. 연결 대상이 `azag_db`인지 확인한 뒤 전체 스크립트를 실행합니다.
4. SQL Editor에서 `db/verify.postgresql.sql` 파일을 열고 실행합니다.
5. Database Navigator에서 `public` -> `Tables`를 새로 고침합니다.

검증 결과에서 아래 22개 테이블이 표시되면 스키마 적용이 완료된 것입니다.

```text
users, teams, projects, project_members
documents, document_chunks, chunk_embeddings
analysis_jobs, analysis_steps, ai_extractions
todos, issues, issue_status_history
project_events, risk_windows, project_reports
handoff_reports, handoff_items
chat_sessions, chat_messages, chat_message_sources
project_activity_logs
```

화면 시연용 샘플 데이터가 필요한 개발 DB에만 `db/seed.postgresql.sql`을 추가 실행합니다. 실제 서비스 데이터를 저장할 DB라면 seed 파일은 실행하지 않습니다.

이미 일부 테이블이 만들어진 DB에는 생성 SQL을 반복 실행하지 않습니다. `CREATE TABLE` 충돌이 나면 먼저 현재 테이블 상태를 확인한 후 마이그레이션 방식을 정합니다.

### `project_activity_logs` 누락 오류 복구

아래 오류가 나오면 스키마의 마지막 테이블 생성 구문이 실행되기 전에 seed 또는 조회 SQL이 실행된 상태입니다.

```text
ERROR: relation "project_activity_logs" does not exist
```

DBeaver에서 `db/repair.project-activity-logs.postgresql.sql`만 먼저 실행한 뒤 `db/verify.postgresql.sql`을 실행합니다.

이미 `db/seed.postgresql.sql` 실행 중 마지막 `project_activity_logs` INSERT에서 오류가 났다면, DBeaver의 Auto-commit 설정에 따라 앞선 샘플 데이터가 이미 저장됐을 수 있습니다. 아래 조회로 확인한 뒤 진행합니다.

```sql
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM chat_messages;
SELECT COUNT(*) FROM project_activity_logs;
```

- `projects` 또는 `chat_messages`에 이미 데이터가 있으면 seed 전체를 재실행하지 말고 `db/seed.postgresql.sql`의 마지막 `INSERT INTO project_activity_logs` 구문만 실행합니다.
- 모두 `0`이면 `db/seed.postgresql.sql` 전체를 실행해도 됩니다.

## 2. VS Code에서 API를 Azure DB에 연결

루트 FastAPI 앱은 `app/database.py`에서 `DATABASE_URL` 환경 변수를 읽습니다. 비밀번호는 코드나 Git에 넣지 않고 로컬 `.env` 파일로 관리합니다.

PowerShell 터미널에서 프로젝트 루트 기준으로 실행합니다.

```powershell
Copy-Item .env.example .env
```

생성된 `.env`에서 DBeaver에 사용한 접속 정보를 입력합니다.

```dotenv
DATABASE_URL=postgresql+psycopg://AZAG_DB_USER:YOUR_PASSWORD@AZURE_VM_PUBLIC_IP:5432/azag_db
```

- 비밀번호에 `@`, `#`, `/`, `:` 같은 문자가 있으면 URL 인코딩된 값으로 넣습니다.
- DBeaver에서 SSL을 사용하도록 연결했다면 URL 끝에 `?sslmode=require`를 추가합니다.
- `.env`는 `.gitignore`에 포함되어 있으므로 커밋하지 않습니다.

VS Code에서 Python 인터프리터를 `.venv`로 선택하고, Run and Debug에서 `TeamAZAG API (Azure PostgreSQL)`를 실행합니다. 이 실행 설정은 `.vscode/launch.json`에 준비되어 있으며 `.env`의 연결 주소를 자동으로 전달합니다.

터미널에서 직접 확인하려면 아래 명령을 실행합니다.

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001
```

브라우저에서 `http://127.0.0.1:8001/health`를 열어 다음 응답을 확인합니다.

```json
{"status":"ok"}
```

`/health`는 서버 실행 상태만 확인하며 DB를 조회하지 않습니다. Azure DB 연결과 스키마까지 확인하려면 `http://127.0.0.1:8001/projects`를 조회합니다. seed 데이터를 넣지 않은 빈 DB라면 `[]`가 정상 응답이며, 연결과 테이블 조회가 성공했다는 의미입니다.

## 3. VS Code에서 DB를 직접 조회하는 방법

API 실행과 별도로 VS Code 안에서 SQL을 조회하려면 `SQLTools`와 `SQLTools PostgreSQL/Cockroach Driver` 확장을 설치한 뒤 새 PostgreSQL 연결을 생성합니다.

입력 값은 DBeaver 연결과 동일하게 둡니다.

| 항목 | 값 |
| --- | --- |
| Server/Host | Azure VM 공인 IP 또는 DNS |
| Port | `5432` 또는 설정한 PostgreSQL 포트 |
| Database | `azag_db` |
| Username/Password | DBeaver에 사용한 DB 계정 |
| SSL | DBeaver 연결 설정과 동일 |

접속 후 SQLTools에서 아래 쿼리를 실행해 연결과 테이블 개수를 확인할 수 있습니다.

```sql
SELECT current_database(), current_user;

SELECT COUNT(*) AS azag_table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'teams', 'projects', 'project_members',
    'documents', 'document_chunks', 'chunk_embeddings',
    'analysis_jobs', 'analysis_steps', 'ai_extractions',
    'todos', 'issues', 'issue_status_history',
    'project_events', 'risk_windows', 'project_reports',
    'handoff_reports', 'handoff_items',
    'chat_sessions', 'chat_messages', 'chat_message_sources',
    'project_activity_logs'
  );
```

`azag_table_count`가 `22`이면 VS Code에서도 같은 스키마를 보고 있습니다.

## 4. 네트워크 점검 메모

원격 접속이 이미 되더라도 PostgreSQL 포트는 가능한 한 모든 인터넷 주소에 공개하지 말고, Azure Network Security Group과 PostgreSQL `pg_hba.conf`에서 필요한 개발자 공인 IP만 허용하는 구성이 적합합니다.
