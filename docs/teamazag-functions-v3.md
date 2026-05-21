# TeamAZAG Final Front Feature Summary

작성일: 2026-05-21  
기준 프론트: `opsradar_final_front.html`

최종 프론트 화면에 들어간 기능을 기준으로 ERD와 테이블 설계를 다시 정리한 문서입니다.

## 화면별 기능

| 화면 | 기능 | 필요한 데이터 |
| --- | --- | --- |
| Dashboard | AI 운영 추론, High Risk 이슈, Blocked 작업, 마감 임박 Todo, 빠른 이동 | 프로젝트, Todo 집계, 이슈 집계, 리스크 구간, 최근 활동 |
| 운영 로그 분석 | 파일 업로드, 분석 단계 표시, 분석 결과 카드, 근거 chunk 미리보기 | 문서, chunk, FAISS 참조, 분석 job, 분석 step, AI 추출 결과 |
| Todo | AI 제안/진행/완료 탭, 승인/수정/반려, 우선순위, 신뢰도, 근거 상세 패널 | Todo, 담당자, 승인 상태, 출처 문서/chunk, AI extraction, 연결 이슈 |
| 이슈 로그 | 확정 이슈/후보/해결 탭, 상태 변화 이력, 근거 chunk, 후보 확정/무시 | 이슈, 이슈 상태 이력, 후보 여부, 신뢰도, 출처 문서/chunk |
| 캘린더 | 월간 일정, 마감/부재/마일스톤, AI 리스크 예측, 자연어 일정 등록 | 프로젝트 일정, 부재 일정, 마일스톤, 리스크 구간 |
| 인수인계 센터 | 부재 현황, 결정사항 로그, 다음 액션, 미해결 이슈, 온보딩 문서 연결 | 인수인계 보고서, 인수인계 항목, 관련 Todo/Issue/Document |
| 기술 문서 | 아키텍처, 기술 스택, 핵심 API, ERD, DB 테이블 명세 | ERD 문서, 테이블 정의, API 명세 |
| 보고서 | 주간/월간 전환, AI 초안 생성, 직접 편집, 저장/공유 | 프로젝트 보고서, 보고서 타입, 버전, 상태, 본문 |
| AI Assistant | RAG 연결 상태, 운영 질문 답변, 출처 표시, 일반 답변 fallback | 채팅 세션, 메시지, 메시지별 출처 문서/chunk |

## 핵심 데이터 흐름

1. 사용자가 회의록, 로그, 채팅 export, 이슈 로그 파일을 업로드합니다.
2. 파일 메타데이터는 `documents`에 저장됩니다.
3. 원문은 `document_chunks`로 쪼개지고, FAISS 참조는 `chunk_embeddings`에 저장됩니다.
4. 분석 작업은 `analysis_jobs`로 생성되고, 단계별 진행 상황은 `analysis_steps`에 저장됩니다.
5. AI가 Todo, 이슈 후보, 요약, 결정사항, 인수인계 항목, 리스크를 추출해 `ai_extractions`에 저장합니다.
6. 검토 대상 Todo는 `todos.approval_status = 'pending'`으로 생성됩니다.
7. 이슈 후보는 `issues.is_candidate = true`로 생성되고, 확정되면 `false`로 바뀝니다.
8. 이슈 상태 변화는 `issue_status_history`에 누적됩니다.
9. 캘린더 일정은 `project_events`, AI 위험 구간은 `risk_windows`에 저장됩니다.
10. 인수인계 센터는 `handoff_reports`, `handoff_items`로 구성됩니다.
11. AI Assistant는 `chat_sessions`, `chat_messages`, `chat_message_sources`로 질문/답변/출처를 저장합니다.

## ERD 반영 포인트

| 반영 | 이유 |
| --- | --- |
| `analysis_jobs`, `analysis_steps` | 프론트에 파일 분석 진행 단계가 표시됨 |
| `ai_extractions` | AI가 뽑은 후보를 업무 테이블로 바로 확정하기 전에 원본 형태로 보관 |
| `issue_status_history` | 이슈 화면에 상태 변화 이력이 필요 |
| `project_events` | 캘린더가 Todo 마감 외에 회의, 부재, 마일스톤을 표시 |
| `risk_windows` | 대시보드/캘린더의 AI 리스크 예측 구간 저장 |
| `project_reports` | 주간/월간 보고서를 하나의 모델로 통합 |
| `handoff_items` | 결정사항, 다음 액션, 미해결 이슈, 온보딩 항목을 카드 단위로 저장 |
| `chat_sessions`, `chat_message_sources` | AI Assistant 대화와 근거 출처를 분리 저장 |
| `project_activity_logs` | 대시보드 최근 활동과 감사 로그에 사용 |

## 로컬 적용 순서

검증용 로컬 PostgreSQL 클러스터는 `db/local_pgdata_teamazag`에 만들고 `55432` 포트에서 실행했습니다. 기존 로컬 PostgreSQL 서비스의 `postgres` 비밀번호가 달라도 이 검증 클러스터에서는 아래 순서로 테이블을 만들 수 있습니다.

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\createdb.exe' -h 127.0.0.1 -p 55432 -U postgres teamazag_front_check
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -h 127.0.0.1 -p 55432 -U postgres -d teamazag_front_check -f db/schema.postgresql.sql
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -h 127.0.0.1 -p 55432 -U postgres -d teamazag_front_check -f db/verify.postgresql.sql
```

Linux 반영 전에는 로컬 검증 DB에서 전체 테이블과 FK/check constraint가 정상 생성되는지 먼저 확인합니다.
