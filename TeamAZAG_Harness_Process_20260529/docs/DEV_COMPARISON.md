# DEV 비교 기준

## 비교한 리비전

| 구분 | 리비전 | 메모 |
| --- | --- | --- |
| 원격 통합 기준 | `origin/dev`의 `53d8985` | `juwon02/TeamAZAG`에서 fetch한 최신 `dev` 브랜치 |
| 기존 로컬 브랜치 | `SeongHo`의 `54f9899`와 미커밋 파일 | 원래 작업 트리에 보존됨 |

원격 브랜치 이름은 소문자 `dev`입니다. fetch된 원격 reference에는 별도의
대문자 `DEV` 브랜치가 없습니다.

## 구조 차이

| 영역 | `origin/dev` | 기존 로컬 작업 트리 |
| --- | --- | --- |
| 백엔드 앱 | `opsradar2/` FastAPI 골격과 부분 구현 | `opsradar_v2/`와 루트 `app/`의 DB 중심 구현 |
| 프론트엔드 | `opsradar2/frontend/index.html` | 추적되지 않은 `frontend/`와 DB 중심 산출물 |
| 데이터베이스/설계 자료 | 제한적인 애플리케이션 모델 | 루트 `db/`, Alembic, ERD 자료, 상세 DB 문서 |
| Harness | 이 브랜치 전에는 없음 | 중첩된 `harness_framework-codex/` DB 설계 템플릿 |

## 통합상 결론

두 트리는 단순히 앞으로만 병합되는 업데이트 관계가 아닙니다. 현재 로컬 파일을
그대로 `dev`에 얹으면 서로 다른 앱 루트와 DB 접근 방식이 섞입니다. 그래서
이 브랜치는 fetch된 `dev` 코드에 Harness를 독립적으로 적용하고, 이후 통합
판단은 명시적인 리뷰 단계로 넘깁니다.
