# 2단계: 검증과 인수인계

## 읽을 파일

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- 0단계와 1단계의 산출물 및 요약
- `opsradar2/README.md`
- `opsradar2/tests/`

## 작업

안정화한 API 계약에 대한 회귀 테스트를 완성하고, `opsradar2/README.md`의
설치/검증 안내를 갱신합니다. 아직 남아 있는 임시 구현 모듈은 명시적인
후속 작업으로 문서화합니다.

## 완료 기준

```powershell
python -m compileall opsradar2/app
python -m pytest opsradar2/tests
```

## 하지 말 것

- 구현되지 않은 AI 또는 검색 동작이 완료됐다고 말하지 않습니다.
  인수인계 문서는 실제 실행 가능한 동작을 반영해야 합니다.
- 감사한 안정화 범위를 넘어 API 계약을 넓히지 않습니다.
