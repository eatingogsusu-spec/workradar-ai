# 0단계: API 계약 감사

## 읽을 파일

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `opsradar2/frontend/index.html`
- `opsradar2/app/api/api.py`
- `opsradar2/app/api/v1/endpoints/*.py`
- `opsradar2/app/schemas/*.py`

## 작업

프론트엔드가 사용하는 요청/응답 데이터 형태와 등록된 FastAPI 라우트를 대조해
목록화합니다. 각 엔드포인트를 구현됨, 임시 구현, 누락, 불일치 중 하나로
표시한 간결한 API 계약 문서를 `docs/` 아래에
추가합니다.

기존 계약이 로드되지 못하게 막는 import, router 등록, schema 결함만
수정합니다. 비즈니스 구현은 1단계로 미룹니다.

## 완료 기준

```powershell
python -m compileall opsradar2/app
python scripts/execute.py --validate dev-stabilization
```

## 하지 말 것

- 이 단계에서 임시 비즈니스 로직을 구현하지 않습니다. 계약 불일치를
  먼저 이해한 뒤 영속성 동작을 바꿔야 하기 때문입니다.
- 불일치를 문서화하지 않은 채 프론트엔드 데이터 기대값을 바꾸지 않습니다.
