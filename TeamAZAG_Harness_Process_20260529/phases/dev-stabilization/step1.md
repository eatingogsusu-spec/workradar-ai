# 1단계: 서비스/리포지토리 연결

## 읽을 파일

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- 0단계에서 만든 API 계약 문서
- `opsradar2/app/api/v1/endpoints/*.py`
- `opsradar2/app/services/*.py`
- `opsradar2/app/repositories/*.py`
- `opsradar2/app/models/*.py`

## 작업

0단계에서 확인한 임시 구현 백엔드 경로 중 우선순위가 가장 높은 부분을
타입이 정해진 스키마, 서비스 함수, 비동기 리포지토리를 사용해 구현합니다.
엔드포인트 핸들러는 HTTP 처리와 의존성 주입에만 집중하게
유지합니다.

새로 구현한 응답과 리포지토리/서비스 판단에 대해 집중된 테스트를
추가합니다.

## 완료 기준

```powershell
python -m compileall opsradar2/app
python -m pytest opsradar2/tests
```

## 하지 말 것

- SQLAlchemy 쿼리를 엔드포인트 핸들러에 직접 넣지 않습니다. 리포지토리
  경계는 채택한 아키텍처의 일부입니다.
- 인증 정보를 커밋하거나 특정 개발자의 로컬 `.env`에 의존하지 않습니다.
