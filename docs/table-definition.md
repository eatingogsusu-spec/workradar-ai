# TeamAZAG Table Definition

작성일: 2026-05-21  
기준 프론트: `opsradar_final_front.html`

이 문서는 최종 프론트에 들어간 기능을 기준으로 기존 테이블 정의를 새 ERD 설계로 교체한 버전입니다.

## 테이블 요약

| 영역 | 테이블 | 목적 |
| --- | --- | --- |
| 기본 | `users` | 로그인 사용자, 담당자, 작성자, 검토자 |
| 기본 | `teams` | TeamAZAG 작업 공간 |
| 기본 | `projects` | 모든 운영 데이터의 기준 단위 |
| 기본 | `project_members` | 프로젝트별 사용자 역할 |
| 문서/RAG | `documents` | 업로드된 회의록, 로그, 채팅 export, 보고서 파일 |
| 문서/RAG | `document_chunks` | RAG 검색과 근거 표시를 위한 문서 조각 |
| 문서/RAG | `chunk_embeddings` | FAISS 인덱스 파일 경로와 index id 참조 |
| AI 분석 | `analysis_jobs` | 파일 분석 작업 단위 |
| AI 분석 | `analysis_steps` | parsing, chunking, embedding, AI analysis 단계 상태 |
| AI 분석 | `ai_extractions` | AI가 추출한 Todo, 이슈, 요약, 결정사항, 리스크 후보 |
| Todo | `todos` | AI 제안/수동 등록 Todo, 승인 상태, 신뢰도, 근거 |
| 이슈 | `issues` | 확정 이슈와 AI 이슈 후보 |
| 이슈 | `issue_status_history` | 이슈 상태 변화 이력 |
| 캘린더 | `project_events` | 회의, 마감, 부재, 마일스톤, 배포 일정 |
| 캘린더 | `risk_windows` | AI가 예측한 위험 구간 |
| 보고서 | `project_reports` | 주간/월간 보고서 초안과 편집본 |
| 인수인계 | `handoff_reports` | 인수인계 문서 단위 |
| 인수인계 | `handoff_items` | 결정사항, 다음 액션, 미해결 이슈, 온보딩 항목 |
| AI Assistant | `chat_sessions` | 프로젝트별 AI 대화 세션 |
| AI Assistant | `chat_messages` | 사용자/AI 메시지 |
| AI Assistant | `chat_message_sources` | AI 답변의 출처 문서/chunk |
| 로그 | `project_activity_logs` | 대시보드 최근 활동과 감사 로그 |

## 핵심 제약

| 테이블 | 주요 제약 |
| --- | --- |
| `users` | `email` unique, `role`은 `admin/manager/member/viewer` |
| `projects` | `team_id`, `created_by` 필수, 종료일은 시작일 이후 |
| `project_members` | `(project_id, user_id)` unique |
| `documents` | 프로젝트와 업로더 필수, 상태는 업로드부터 분석 완료/실패까지 관리 |
| `document_chunks` | `(document_id, chunk_index)` unique |
| `chunk_embeddings` | `(faiss_index_path, faiss_index_id)` unique, 벡터 payload는 저장하지 않음 |
| `analysis_jobs` | 진행률 0-100, 상태는 `queued/running/completed/failed/cancelled` |
| `analysis_steps` | 한 job 안에서 step name unique |
| `ai_extractions` | confidence 0-100, 추출 원문은 `extracted_json`에 저장 |
| `todos` | `blocked` 상태 지원, AI 제안은 `approval_status = pending` |
| `issues` | 후보/확정은 `is_candidate`로 구분, 심각도와 상태 check |
| `project_events` | 캘린더 일정 타입과 위험도 check |
| `risk_windows` | 시작일/종료일 범위 check, confidence 0-100 |
| `project_reports` | 주간/월간 통합, 같은 기간의 version unique |
| `handoff_items` | 관련 Todo/Issue/Document 선택 연결 |
| `chat_message_sources` | 메시지별 여러 출처 지원 |
| `project_activity_logs` | `metadata`는 JSON object만 허용 |

## Todo 승인 모델

```text
source_type = manual, approval_status = approved  -> 사용자가 직접 만든 공식 Todo
source_type = ai,     approval_status = pending   -> AI가 제안했고 검토 대기
source_type = ai,     approval_status = approved  -> 사용자가 승인한 AI Todo
source_type = ai,     approval_status = rejected  -> 사용자가 반려한 AI Todo
```

## 이슈 후보 모델

```text
is_candidate = true   -> 이슈 후보 탭
is_candidate = false  -> 확정 이슈 탭
status = blocked      -> 리스크가 작업 진행을 막는 상태
```

## RAG 출처 모델

AI Assistant 답변은 `chat_messages`에 저장하고, 답변 근거는 `chat_message_sources`로 분리합니다.

```text
chat_messages 1:N chat_message_sources
chat_message_sources.document_id -> documents.id
chat_message_sources.chunk_id    -> document_chunks.id
```

## 프론트 화면별 사용 테이블

| 화면 | 사용 테이블 |
| --- | --- |
| Dashboard | `projects`, `todos`, `issues`, `risk_windows`, `project_activity_logs` |
| 운영 로그 분석 | `documents`, `document_chunks`, `chunk_embeddings`, `analysis_jobs`, `analysis_steps`, `ai_extractions` |
| Todo | `todos`, `users`, `documents`, `document_chunks`, `ai_extractions`, `issues` |
| 이슈 로그 | `issues`, `issue_status_history`, `documents`, `document_chunks`, `ai_extractions` |
| 캘린더 | `project_events`, `risk_windows`, `todos`, `issues`, `users` |
| 인수인계 센터 | `handoff_reports`, `handoff_items`, `todos`, `issues`, `documents`, `users` |
| 보고서 | `project_reports`, `todos`, `issues`, `risk_windows` |
| AI Assistant | `chat_sessions`, `chat_messages`, `chat_message_sources`, `documents`, `document_chunks` |

## 적용 파일

- ERD: `docs/team-memory-erd.mmd`
- DB 설계 문서: `docs/db-design-v2.md`
- 기능 정리 문서: `docs/teamazag-functions-v3.md`
- 생성 SQL: `db/schema.postgresql.sql`
- 검증 SQL: `db/verify.postgresql.sql`
