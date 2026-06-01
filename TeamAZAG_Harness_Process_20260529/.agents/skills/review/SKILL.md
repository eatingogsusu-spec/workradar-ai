---
name: review
description: TeamAZAG 변경 사항을 Harness 아키텍처와 검증 규칙에 맞춰 리뷰할 때 사용합니다.
---

# 프로젝트 리뷰

`AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ADR.md`를 읽은 뒤 diff를
리뷰합니다. 답변은 발견 사항을 먼저 적습니다.

프론트엔드와 엔드포인트 계약이 일치하는지, async 데이터베이스 접근이
repositories/services 경계 안에 남아 있는지, secret이 커밋되지 않았는지,
변경된 동작에 실행 가능한 검증이 있는지 확인합니다.
