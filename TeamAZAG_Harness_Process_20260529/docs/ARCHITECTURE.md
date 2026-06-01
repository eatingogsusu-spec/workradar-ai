# 아키텍처

## 런타임 구조

`opsradar2/app/main.py`는 FastAPI 애플리케이션을 만들고, 로컬 프론트엔드를
제공하며, 버전이 붙은 라우터를 `/api/v1`에 마운트합니다. API 라우터는
calendar, documents, todos, issues, dashboard, reports, knowledge, chat
엔드포인트 모듈을 묶습니다.

## 백엔드 계층

| 계층 | 위치 | 책임 |
| --- | --- | --- |
| HTTP 엔드포인트 | `opsradar2/app/api/v1/endpoints/` | HTTP 입력을 해석하고 타입이 정해진 API 출력을 반환 |
| 스키마 | `opsradar2/app/schemas/` | 요청/응답 모델 |
| 서비스 | `opsradar2/app/services/` | 애플리케이션 워크플로와 리포지토리 간 판단 |
| 리포지토리 | `opsradar2/app/repositories/` | async SQLAlchemy 영속성 처리 |
| 모델 | `opsradar2/app/models/` | 관계형 데이터베이스 엔티티 |
| AI와 벡터 | `opsradar2/app/ai/`, `opsradar2/app/vectorstores/` | 추출, 생성, 검색 어댑터 |

## 현재 기준 상태

`dev` 브랜치는 부분 구현 상태입니다. Calendar 엔드포인트는 리포지토리와
데이터베이스 의존성에 연결되어 있지만, todo, issue, document, dashboard,
report, knowledge, chat 경로 중 상당수는 아직 임시 데이터를 반환하거나
TODO 작업을 포함합니다. Harness 단계는 API 계약을 바꾸기 전에 기존 동작과
계획된 동작을 구분해야 합니다.

## 변경 체크리스트

- 단계에서 명시적으로 프론트와 백엔드를 함께 수정하지 않는 한 `/api/v1`
  prefix와 프론트가 소비하는 응답 형태를 유지합니다.
- 데이터베이스 작업은 비동기 방식과 의존성 주입을 유지합니다.
- 구현한 엔드포인트 경로마다 검증을 추가합니다.
- AI 연동과 인증 정보는 설정 가능한 외부 의존성으로 취급합니다.
