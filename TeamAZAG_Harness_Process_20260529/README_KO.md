# TeamAZAG 하네스 프로세스

이 폴더는 TeamAZAG OpsRadar 프로젝트에 적용한 Codex 하네스 운영 절차만
분리한 전달본입니다. 제품 소스 전체가 아니라, 팀원이 동일한 방식으로
작업을 쪼개고 검증할 수 있게 필요한 제어 파일만 담았습니다.

## 포함 파일

| 경로 | 용도 |
| --- | --- |
| `AGENTS.md` | 프로젝트 작업 규칙, 아키텍처 경계, 검증 명령 |
| `PROJECT_CONTEXT.md` | 하네스 적용 배경과 기준 브랜치 정보 |
| `docs/ARCHITECTURE.md` | 현재 앱 구조와 계층별 책임 |
| `docs/ADR.md` | 하네스 적용 방식에 대한 의사결정 |
| `docs/DEV_COMPARISON.md` | 원격 dev와 기존 로컬 작업 차이 요약 |
| `phases/index.json` | 전체 단계 묶음 목록 |
| `phases/dev-stabilization/` | dev 안정화 단계 묶음의 단계별 작업 지시 |
| `scripts/execute.py` | 단계 묶음/단계 검증 및 Codex 실행 스크립트 |
| `.agents/skills/harness/SKILL.md` | 하네스 실행용 에이전트 지침 |
| `.agents/skills/review/SKILL.md` | 변경 리뷰용 에이전트 지침 |

## 기본 흐름

1. `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ADR.md`를 먼저 읽습니다.
2. 작업할 단계 묶음의 `index.json`과 `step*.md`를 확인합니다.
3. 실행 전 단계 묶음 상태와 단계 정의를 검증합니다.
4. 단계 지시에 적힌 파일만 우선 읽고, 지정된 범위 안에서 구현합니다.
5. 완료 기준 명령을 통과시킵니다.
6. 완료된 단계는 `completed`와 `summary`를 남깁니다.
7. 판단이 필요한 경우 `blocked`와 `blocked_reason`을 남기고 멈춥니다.

## 명령

프로젝트 루트에 이 하네스 파일들을 배치한 뒤 실행합니다.

```powershell
python scripts/execute.py --validate dev-stabilization
python scripts/execute.py dev-stabilization
```

현재 dev 안정화 단계 묶음의 검증 기준은 아래와 같습니다.

```powershell
python -m compileall opsradar2/app
python -m pytest opsradar2/tests
```

## 현재 단계 묶음 구성

| 단계 | 이름 | 목적 |
| --- | --- | --- |
| 0 | API 계약 감사 | 프론트 요청/응답과 FastAPI 라우트 계약을 먼저 점검 |
| 1 | 서비스/리포지토리 연결 | 우선순위가 높은 임시 구현 API를 서비스/리포지토리 구조로 구현 |
| 2 | 검증과 인수인계 | 회귀 테스트, README, 남은 후속 작업 정리 |

## 팀 작업 규칙 요약

- 라우터는 얇게 유지하고, 비즈니스 판단은 `services/`, DB 접근은
  `repositories/`에 둡니다.
- 프론트가 소비하는 API 데이터 형태는 임의로 바꾸지 않습니다.
- SQLAlchemy 작업은 비동기 session과 `get_db()` 흐름을 유지합니다.
- `.env`나 실제 인증 정보는 커밋하지 않습니다.
- 각 단계는 명시된 완료 기준을 통과해야 완료 처리합니다.

## 전달 시 주의

이 폴더는 하네스 절차 전달본입니다. 실제 실행하려면 대상 프로젝트 루트에
복사하고, `opsradar2/` 같은 제품 앱 폴더가 함께 있어야 합니다.
