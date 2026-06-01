# TeamAZAG DB Design

작성일: 2026-05-21  
기준 프론트: `opsradar_final_front.html`

## 설계 원칙

- 모든 운영 데이터는 `projects`를 중심으로 연결합니다.
- 팀/사용자/프로젝트 권한은 `teams`, `users`, `project_members`에서 관리합니다.
- 문서 원문은 `documents`, 검색 단위는 `document_chunks`, FAISS 참조는 `chunk_embeddings`에 저장합니다.
- AI 분석 진행 상태는 `analysis_jobs`, `analysis_steps`로 분리합니다.
- AI가 추출한 원시 결과는 `ai_extractions`에 저장하고, 검토 후 `todos`, `issues`, `handoff_items` 등 업무 테이블로 승격합니다.
- Todo와 이슈는 모두 출처 문서/chunk와 연결할 수 있어야 합니다.
- 이슈는 현재 상태뿐 아니라 `issue_status_history`로 변화 이력을 남깁니다.
- 캘린더는 TODO 마감일만으로 부족하므로 `project_events`를 사용합니다.
- AI가 예측한 위험 기간은 `risk_windows`에 저장합니다.
- 보고서는 주간/월간을 `project_reports` 하나로 통합하고 `status`, `version`을 둡니다.
- AI Assistant는 세션/메시지/출처를 별도 테이블로 관리합니다.

## 주요 테이블

| 영역 | 테이블 | 설명 |
| --- | --- | --- |
| 기본 | `users`, `teams`, `projects`, `project_members` | 사용자, 팀, 프로젝트, 멤버십 |
| 문서/RAG | `documents`, `document_chunks`, `chunk_embeddings` | 업로드 파일, chunk, FAISS 참조 |
| AI 분석 | `analysis_jobs`, `analysis_steps`, `ai_extractions` | 분석 작업, 단계별 상태, AI 추출 결과 |
| TODO | `todos` | AI 제안/수동 TODO, 승인 상태, 근거 chunk |
| 이슈 | `issues`, `issue_status_history` | 이슈 후보/확정, 상태 변화 이력 |
| 캘린더 | `project_events`, `risk_windows` | 회의/마감/부재/마일스톤, AI 리스크 구간 |
| 보고서 | `project_reports` | 주간/월간 보고서, AI 초안, 버전/상태 |
| 인수인계 | `handoff_reports`, `handoff_items` | 인수인계 문서와 카드형 항목 |
| AI Assistant | `chat_sessions`, `chat_messages`, `chat_message_sources` | RAG 대화와 출처 |
| 활동 로그 | `project_activity_logs` | 대시보드 최근 활동/감사 로그 |

## ERD

ERD 원본은 `docs/team-memory-erd.mmd`입니다.

```mermaid
%% docs/team-memory-erd.mmd 참고
```

## 프론트 기능 대응

| 기능 | 사용 테이블 |
| --- | --- |
| 운영 로그 파일 업로드 | `documents` |
| Parsing/chunk/embedding/AI 분석 단계 표시 | `analysis_jobs`, `analysis_steps` |
| 근거 chunk 표시 | `document_chunks` |
| AI Todo 제안 | `ai_extractions`, `todos` |
| Todo 승인/수정/반려 | `todos.approval_status`, `todos.reviewed_by`, `todos.reviewed_at` |
| 이슈 후보 확정/무시 | `issues.is_candidate`, `issues.status` |
| 이슈 상태 변화 이력 | `issue_status_history` |
| 캘린더 일정/부재/마일스톤 | `project_events` |
| 리스크 구간 예측 | `risk_windows` |
| 인수인계 결정사항/다음 액션/미해결 이슈 | `handoff_reports`, `handoff_items` |
| 주간/월간 보고서 작성 | `project_reports` |
| AI Assistant RAG 답변 | `chat_sessions`, `chat_messages`, `chat_message_sources` |

## 적용 파일

- ERD: `docs/team-memory-erd.mmd`
- 테이블 정의: `docs/table-definition.md`
- 기능 문서: `docs/teamazag-functions-v3.md`
- 생성 SQL: `db/schema.postgresql.sql`
- 검증 SQL: `db/verify.postgresql.sql`

## 로컬/리눅스 적용 메모

기존 로컬 PostgreSQL 서비스는 실행 중이지만 `postgres` 계정 비밀번호가 확인되지 않았습니다. 대신 워크스페이스 안에 별도 검증용 PostgreSQL 클러스터를 만들고 `55432` 포트에서 `teamazag_front_check` DB에 `db/schema.postgresql.sql`, `db/verify.postgresql.sql`을 순서대로 적용했습니다.

검증 결과:

- 생성 테이블: 22개
- 생성 인덱스: 42개
- check constraint: 47개
- FK 참조: 55개
- `todos.status`에 `blocked` 포함 확인
- `project_reports` 기간/version unique 확인
