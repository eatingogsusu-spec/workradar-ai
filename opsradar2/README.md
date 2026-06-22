# OpsRadar 2

OpsRadar 2는 운영 로그와 참고 문서를 분석하여 Todo, 이슈, 일정, 보고서와 인수인계 업무를 관리하는 내부 운영 지원 시스템입니다.

- Backend: FastAPI, SQLAlchemy, PostgreSQL, pgvector
- Frontend: 기존 Vanilla JS 화면 위에 React 화면을 단계적으로 전환하는 구조
- AI: Azure OpenAI 기반 문서 요약·추출·검색(설정된 경우에만 활성화)

## 프로젝트 구조

```text
app/             FastAPI API, 서비스, 저장소, AI 처리
frontend/        기존 화면과 React 전환 코드
schema.sql       opsradar2 스키마 생성
bootstrap.sql    기본 데이터 생성
scripts/         로컬 실행과 DB 검증 도구
tests/           회귀 테스트
docs/            API·DB·백엔드 구조 문서
```

## 사전 준비

- Python 3.11 이상
- Node.js 20 이상
- PostgreSQL(필요 시 pgvector 확장 포함)

`.env.example`을 복사하여 로컬 설정을 만듭니다. `.env`에는 DB 접속 정보, JWT 키, Azure OpenAI 키 같은 비밀값이 들어갈 수 있으므로 커밋하지 않습니다.

```powershell
Copy-Item .env.example .env
```

최소 DB 설정 예시입니다.

```dotenv
DATABASE_URL=postgresql+asyncpg://AZAG_DB_USER:YOUR_PASSWORD@LINUX_DB_HOST:5432/azag_db
DB_SCHEMA=opsradar2
```

## 데이터베이스 초기화

공용 DB에서는 기존 `public` 스키마를 건드리지 않고 `opsradar2` 스키마를 사용합니다. 새 환경에서만 아래 순서로 실행합니다.

```powershell
$env:PGPASSWORD = "YOUR_PASSWORD"
psql -h LINUX_DB_HOST -p 5432 -U AZAG_DB_USER -d azag_db -c "CREATE SCHEMA IF NOT EXISTS opsradar2 AUTHORIZATION AZAG_DB_USER; SET search_path TO opsradar2;" -f schema.sql
psql -h LINUX_DB_HOST -p 5432 -U AZAG_DB_USER -d azag_db -c "SET search_path TO opsradar2, public;" -f bootstrap.sql
Remove-Item Env:PGPASSWORD
```

기존 로컬 DB 호환 작업에만 `migrate_local_schema_compat.sql`을 사용합니다. 운영 DB에 임의로 실행하지 않습니다.

## 로컬 실행

프로젝트 루트에서 Python 의존성을 설치하고 API를 실행합니다.

```powershell
pip install -r requirements.txt
python scripts/dev_server.py
```

- 화면: `http://127.0.0.1:8002/`
- 상태 확인: `http://127.0.0.1:8002/health`
- API 문서: `http://127.0.0.1:8002/docs`

OpsRadar 2의 기본 포트는 `8002`입니다.

## React 번들

프런트엔드는 기존 화면을 유지하면서 React 화면을 추가하는 전환 구조입니다. Vite 번들은 `frontend/public/static/react/`에 생성되며 Git에서 제외됩니다.

새로 clone한 뒤 또는 `frontend/src/react-mount/`를 수정한 뒤에는 아래 명령을 실행합니다.

```powershell
Set-Location frontend
npm ci
npm run vite:build
Set-Location ..
```

생성된 번들은 FastAPI가 `/static/react/` 경로로 제공합니다. `frontend/public/index.html`의 React CSS와 module script 참조를 제거하지 않습니다.

## 검증 도구

DB 연결과 필수 테이블은 다음으로 확인합니다.

```powershell
python scripts/verify_database.py
```

`verify_persistence.py`는 Todo·일정·이슈·보고서를 실제 DB에 만들었다가 정리하는 통합 검증입니다. 로컬 또는 전용 검증 DB에서만 실행합니다.

```powershell
python scripts/verify_persistence.py
```

변경한 Python 또는 정적 JavaScript는 관련 파일 단위로 문법을 확인합니다.

```powershell
python -m py_compile app/ai/summarizer.py
node --check frontend/public/static/js/api-integration.js
node --check frontend/public/static/react/main.js
```

## 관련 문서

- `docs/db-setup-guide.md`: DB 설정
- `docs/api-contracts.md`: API 계약
- `docs/backend-base.md`: 백엔드 계층 규칙
- `HANDOFF_20260621_v3.md`: 최근 인수인계와 후속 작업 메모
