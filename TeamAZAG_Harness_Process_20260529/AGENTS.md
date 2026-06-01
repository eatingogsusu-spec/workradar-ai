# 프로젝트: TeamAZAG OpsRadar

## 애플리케이션 범위

- 배포 대상 애플리케이션은 `opsradar2/` 아래에 있습니다.
- 백엔드는 `/api/v1` 아래에 마운트된 FastAPI 서비스입니다.
- 현재 프론트엔드는 `opsradar2/frontend/index.html`에서 제공됩니다.
- PostgreSQL 접근은 SQLAlchemy async session을 사용합니다.

## 아키텍처 규칙

- 중요: 라우트 핸들러는 얇게 유지합니다. 비즈니스 판단은
  `opsradar2/app/services/`에 두고, 영속성 처리는
  `opsradar2/app/repositories/`에 둡니다.
- 중요: API 요청/응답 검증은 `opsradar2/app/schemas/`에서 처리합니다.
  프론트엔드가 사용하는 데이터 계약을 조용히 바꾸지 않습니다.
- 중요: 데이터베이스 작업은 `get_db()`와 async SQLAlchemy 패턴을 따릅니다.
  엔드포인트 안에서 임의의 DB 연결을 열지 않습니다.
- 중요: secret이나 실제 값이 들어간 `.env` 파일을 커밋하지 않습니다.
- AI 제공자와 벡터 저장소 연동은 기존 `app/ai/`, `app/services/`,
  `app/vectorstores/` 경계 안에 둡니다.

## 개발 절차

- 애플리케이션 동작을 바꾸기 전에 `docs/ARCHITECTURE.md`,
  `docs/ADR.md`, 그리고 해당 Harness step 문서를 읽습니다.
- 범위가 정해진 작업은 `phases/` 아래 단계 묶음 파일과 `scripts/execute.py`를
  통해 실행합니다.
- 엔드포인트 계약이나 영속성 동작을 구현할 때는 테스트를 추가하거나 갱신합니다.
- 커밋 메시지는 `feat:`, `fix:`, `docs:`, `test:`, `refactor:`,
  `chore:` 형식을 사용합니다.

## 검증

```powershell
python -m compileall opsradar2/app
python scripts/execute.py --validate dev-stabilization
```
