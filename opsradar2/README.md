# OpsRadar 2

TeamAZAG OpsRadar의 FastAPI 백엔드와 정적 프론트엔드입니다.

## 데이터베이스 기준

공용 개발 데이터베이스는 리눅스 서버의 PostgreSQL `azag_db`입니다.
OpsRadar 2 테이블은 기존 `public` 구조와 분리된 `opsradar2` 스키마에
저장합니다. 빈 스키마를 처음 구성할 때는 `schema.sql`을 기준으로 사용합니다.
애플리케이션 시작 과정에서는 테이블을 자동 생성하거나 변경하지 않습니다.

`azag_db`에 `opsradar2` 스키마를 만들고 기준 테이블을 한 번 적용합니다.

```powershell
$env:PGPASSWORD = "YOUR_PASSWORD"
psql -h LINUX_DB_HOST -p 5432 -U AZAG_DB_USER -d azag_db -c "CREATE SCHEMA IF NOT EXISTS opsradar2 AUTHORIZATION AZAG_DB_USER; SET search_path TO opsradar2;" -f schema.sql
psql -h LINUX_DB_HOST -p 5432 -U AZAG_DB_USER -d azag_db -c "SET search_path TO opsradar2, public;" -f bootstrap.sql
Remove-Item Env:PGPASSWORD
```

대상 데이터베이스와 `opsradar2` 스키마의 기준 테이블 18개를 확인합니다.

```powershell
$env:PGPASSWORD = "YOUR_PASSWORD"
psql -h LINUX_DB_HOST -p 5432 -U AZAG_DB_USER -d azag_db -c "SELECT current_database(), current_user;"
psql -h LINUX_DB_HOST -p 5432 -U AZAG_DB_USER -d azag_db -c "SELECT COUNT(*) AS opsradar2_table_count FROM information_schema.tables WHERE table_schema = 'opsradar2';"
Remove-Item Env:PGPASSWORD
```

기존 `public` 스키마는 유지합니다. `migrate_local_schema_compat.sql`은
기존 로컬 호환 DB에만 사용하며 새 리눅스 `opsradar2` 스키마에는 사용하지
않습니다.

## 로컬 API 설정

예시 파일을 복사해 로컬 비밀 설정 파일을 만든 뒤 리눅스 PostgreSQL 접속
정보를 입력합니다.

```powershell
Copy-Item .env.example .env
```

URL에는 비동기 SQLAlchemy 드라이버를 사용해야 합니다.

```dotenv
DATABASE_URL=postgresql+asyncpg://AZAG_DB_USER:YOUR_PASSWORD@LINUX_DB_HOST:5432/azag_db
DB_SCHEMA=opsradar2
```

비밀번호에 특수 문자가 있다면 URL 인코딩하세요. `.env`는 커밋하지 않습니다.

`opsradar2/`에서 의존성을 설치하고 API를 실행합니다.

```powershell
pip install -r requirements.txt
python scripts/dev_server.py
```

API 상태 확인 주소는 `http://127.0.0.1:8010/health`, 프론트엔드 주소는
`http://127.0.0.1:8010/`입니다.

OpsRadar 2 확인에는 반드시 `8010` 포트를 사용합니다. 다른 로컬 프로젝트가
사용 중인 `8000` 또는 `3000` 포트는 OpsRadar 2 실행 화면이 아닙니다.

DB 연결과 기준 테이블을 확인합니다.

```powershell
python scripts/verify_database.py
```

Todo, 이슈, 이슈 기반 Todo, 캘린더, 보고서의 실제 저장 흐름을 확인합니다.
검증용 데이터는 실행 후 삭제하고 기존 주간 보고서는 원래 상태로 복원합니다.

```powershell
python scripts/verify_persistence.py
```

## 검증

저장소 루트에서 실행합니다.

```powershell
python -m compileall opsradar2/app
python scripts/execute.py --validate dev-stabilization
```
