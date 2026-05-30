---
name: harness
description: phase와 scripts/execute.py를 통해 범위가 정해진 TeamAZAG 작업을 계획하거나 실행할 때 사용합니다.
---

# Harness 워크플로

## 탐색

수정하기 전에 `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ADR.md`, 선택한
phase 파일, 그리고 관련 `opsradar2/` 파일을 읽습니다.

## 계획

각 step은 하나의 동작 경계에 맞게 좁게 유지합니다. step에는 읽을 파일,
수행할 작업, acceptance criteria, 명확한 제외 범위가 있어야 합니다.
프론트엔드나 문서화된 계약과 맞지 않는 엔드포인트 동작을 임의로 만들지
않습니다.

## 실행

phase를 실행하기 전에 먼저 검증합니다.

```powershell
python scripts/execute.py --validate dev-stabilization
python scripts/execute.py dev-stabilization
```

성공하면 step status를 `completed`로 바꾸고 짧은 `summary`를 남깁니다.
제품 판단이 필요하면 `blocked`와 `blocked_reason`을 사용하고, 검증을
통과할 수 없으면 `error`와 `error_message`를 사용합니다.
